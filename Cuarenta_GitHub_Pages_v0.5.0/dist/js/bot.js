import { createDeck, legalMoves, RANKS } from './engine.js';

const MAX_ANALYSED_MOVES = 64;
const MAX_EXPERT_CANDIDATES = 12;
const MAX_EXPERT_REPLY_MOVES = 8;

function command(view, move) {
  return { playerId: view.currentPlayerId, cardId: move.cardId, captureIds: move.captureIds.slice(), expectedRevision: view.revision };
}

function wins(move, score) {
  return move.winsGame === true || score + move.points >= 40;
}

function immediateValue(move, player) {
  const card = player.hand.find((candidate) => candidate.id === move.cardId);
  let value = move.points * 100 + move.captureIds.length * (player.score < 30 ? 3 : 1);
  if (move.kind === 'drop') {
    value += player.hand.filter((candidate) => candidate.rank === card.rank).length * 0.2;
    value += RANKS.indexOf(card.rank) * 0.01;
  }
  return value;
}

// Chance that a random hand contains no card in a given subset. The pool is an
// estimate from visible cards, not the actual deck or the rival's hidden hand.
function probabilityOfMissing(poolSize, subsetSize, handSize) {
  let result = 1;
  for (let index = 0; index < Math.min(handSize, poolSize); index += 1) {
    result *= Math.max(0, poolSize - subsetSize - index) / (poolSize - index);
  }
  return result;
}

function responseRisk(view, player, rival, move, unknownRanks) {
  if (!rival.handCount) return 0;
  const played = player.hand.find((card) => card.id === move.cardId);
  const captured = new Set(move.captureIds);
  const table = move.kind === 'drop' ? [...view.table, played] : view.table.filter((card) => !captured.has(card.id));
  const ownRonda = view.rondas?.[player.id];
  const fromRonda = Boolean(ownRonda?.cardIds?.includes(played.id));
  const lastPlay = { playerId: player.id, cardId: played.id, deal: view.deal, round: view.round, fromRonda };
  const risks = [];

  // Try every unknown rank as the rival's next card, including numerical sums
  // and mandatory ladders. Only a hypothetical one-card hand is constructed.
  for (const group of unknownRanks) {
    const responseView = {
      status: 'playing', turn: rival.id, currentPlayerId: rival.id,
      players: [{ id: player.id, score: player.score, hand: null }, { id: rival.id, score: rival.score, hand: [group.card] }],
      rules: view.rules, table, lastPlay, deal: view.deal, round: view.round,
    };
    let cost = 0;
    for (const reply of legalMoves(responseView, rival.id)) {
      const value = wins(reply, rival.score) ? 20000 : reply.points * 110 + reply.captureIds.length * (rival.score < 30 ? 4 : 1);
      cost = Math.max(cost, value);
    }
    risks.push({ cost, count: group.count });
  }

  // Expected strongest reply among the rival's hand, sampled without replacement.
  // Counts of previously collected cards are public, but their identities are
  // not exposed by the view; treating those cards as unknown avoids cheating.
  risks.sort((a, b) => b.cost - a.cost);
  const poolSize = unknownRanks.reduce((sum, group) => sum + group.count, 0);
  let cumulativeCount = 0;
  let previousChance = 0;
  let expectation = 0;
  for (const risk of risks) {
    cumulativeCount += risk.count;
    const chance = 1 - probabilityOfMissing(poolSize, cumulativeCount, rival.handCount);
    expectation += risk.cost * (chance - previousChance);
    previousChance = chance;
  }
  return expectation;
}

function tableAfterMove(table, move, card) {
  if (!move.captureIds.length) return [...table, card];
  const captured = new Set(move.captureIds);
  return table.filter((item) => !captured.has(item.id));
}

function replyCost(move, player) {
  if (wins(move, player.score)) return 20000;
  return move.points * 115 + move.captureIds.length * (player.score < 30 ? 5 : 1);
}

// Adds one adversarial ply: for each plausible unknown rank, the rival chooses
// a strong reply, then the bot searches its best answer with the cards it still
// holds. The rank frequencies are estimates, never the actual hidden hand.
function expertLineRisk(view, player, rival, move, unknownRanks, maxReplyMoves) {
  if (!rival.handCount) return 0;
  const played = player.hand.find((card) => card.id === move.cardId);
  const ownRemaining = player.hand.filter((card) => card.id !== move.cardId);
  const table = tableAfterMove(view.table, move, played);
  const ownRonda = view.rondas?.[player.id];
  const lastPlay = {
    playerId: player.id,
    cardId: played.id,
    deal: view.deal,
    round: view.round,
    fromRonda: Boolean(ownRonda?.cardIds?.includes(played.id)),
  };
  const scenarios = [];

  for (const group of unknownRanks) {
    const responseView = {
      status: 'playing',
      turn: rival.id,
      currentPlayerId: rival.id,
      players: [
        { id: player.id, score: player.score + move.points, hand: null },
        { id: rival.id, score: rival.score, hand: [group.card] },
      ],
      rules: view.rules,
      table,
      lastPlay,
      deal: view.deal,
      round: view.round,
    };
    const replies = legalMoves(responseView, rival.id)
      .map((reply) => ({ reply, cost: replyCost(reply, rival) }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, maxReplyMoves);

    let worstLine = -Infinity;
    for (const { reply, cost } of replies) {
      let counterplay = 0;
      if (cost < 20000 && ownRemaining.length) {
        const nextView = {
          status: 'playing',
          turn: player.id,
          currentPlayerId: player.id,
          players: view.players.map((seat) => ({
            id: seat.id,
            score: seat.id === player.id ? player.score + move.points : seat.score,
            hand: seat.id === player.id ? ownRemaining : null,
          })),
          rules: view.rules,
          rondas: view.rondas,
          table: tableAfterMove(table, reply, group.card),
          lastPlay: {
            playerId: rival.id,
            cardId: group.card.id,
            deal: view.deal,
            round: view.round,
            fromRonda: false,
          },
          deal: view.deal,
          round: view.round,
        };
        const followMoves = legalMoves(nextView, player.id);
        for (const follow of followMoves) {
          const value = wins(follow, nextView.players[player.id].score)
            ? 20000
            : immediateValue(follow, nextView.players[player.id]);
          counterplay = Math.max(counterplay, value);
        }
      }
      // The rival prefers a damaging reply that also limits our next answer.
      worstLine = Math.max(worstLine, cost - counterplay * 0.55);
    }
    scenarios.push({ cost: Number.isFinite(worstLine) ? worstLine : 0, count: group.count });
  }

  scenarios.sort((a, b) => b.cost - a.cost);
  const poolSize = unknownRanks.reduce((sum, group) => sum + group.count, 0);
  let cumulativeCount = 0;
  let previousChance = 0;
  let expectation = 0;
  for (const scenario of scenarios) {
    cumulativeCount += scenario.count;
    const chance = 1 - probabilityOfMissing(poolSize, cumulativeCount, rival.handCount);
    expectation += scenario.cost * (chance - previousChance);
    previousChance = chance;
  }
  return expectation;
}

/** Four local opponents. All decisions use only the bot's public projection:
 * easy picks randomly; medium values immediate gains; hard estimates a strong
 * rival reply; expert also searches the bot's best answer to that reply.
 * Hidden hands and the future deck are never read. */
export function chooseBotMove(view, { random = Math.random, feedbackChallenge = 0 } = {}) {
  const playerId = view.currentPlayerId;
  if (![0, 1].includes(playerId) || view.turn !== playerId || view.status !== 'playing') return null;
  const player = view.players.find((candidate) => candidate.id === playerId);
  const moves = legalMoves(view, playerId);
  if (!moves.length) return null;

  if (view.difficulty === 'easy') {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error('El azar del rival debe devolver un número entre 0 y 1, sin incluir 1.');
    return command(view, moves[Math.floor(sample * moves.length)]);
  }

  const victory = moves.find((move) => wins(move, player.score));
  if (victory) return command(view, victory);
  const ranked = moves.map((move) => ({ move, value: immediateValue(move, player) })).sort((a, b) => b.value - a.value);
  if (!['hard', 'expert'].includes(view.difficulty)) return command(view, ranked[0].move);

  const rival = view.players.find((candidate) => candidate.id === 1 - playerId);
  const known = new Set([...player.hand, ...view.table].map((card) => card.id));
  const groups = new Map();
  for (const card of createDeck()) {
    if (known.has(card.id)) continue;
    const group = groups.get(card.rank);
    if (group) group.count += 1;
    else groups.set(card.rank, { card, count: 1 });
  }
  const unknownRanks = [...groups.values()];
  const analysed = [];
  // Bound look-ahead on tables offering many equivalent ladder combinations.
  // All immediate victories were checked before applying this budget.
  for (const candidate of ranked.slice(0, MAX_ANALYSED_MOVES)) {
    const risk = responseRisk(view, player, rival, candidate.move, unknownRanks);
    analysed.push({ move: candidate.move, immediate: candidate.value, risk, value: candidate.value - risk });
  }
  if (view.difficulty === 'hard') {
    analysed.sort((a, b) => b.value - a.value);
    return command(view, analysed[0]?.move ?? ranked[0].move);
  }

  const adjustment = Number.isFinite(feedbackChallenge)
    ? Math.max(-3, Math.min(3, Math.trunc(feedbackChallenge)))
    : 0;
  const candidateBudget = Math.max(4, Math.min(24, MAX_EXPERT_CANDIDATES + adjustment * 4));
  const replyBudget = Math.max(3, Math.min(14, MAX_EXPERT_REPLY_MOVES + adjustment * 2));
  let best = ranked[0].move;
  let bestValue = -Infinity;
  analysed.sort((a, b) => b.value - a.value);
  for (const candidate of analysed.slice(0, candidateBudget)) {
    const lineRisk = expertLineRisk(view, player, rival, candidate.move, unknownRanks, replyBudget);
    const value = candidate.immediate - candidate.risk * 0.25 - lineRisk * 0.85;
    if (value > bestValue) {
      bestValue = value;
      best = candidate.move;
    }
  }
  return command(view, best);
}
