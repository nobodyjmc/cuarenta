/** Local, serializable rules engine. No DOM, network, or bot access to hidden cards. */
export const RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K']);
export const SUITS = Object.freeze(['hearts', 'diamonds', 'clubs', 'spades']);
const STATUSES = ['playing', 'round-end', 'finished'];
const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'];
const copy = (value) => structuredClone(value);
const fail = (message) => { throw new Error(message); };
const numeric = (card) => RANKS.indexOf(card.rank) < 7 ? RANKS.indexOf(card.rank) + 1 : 0;
const hasRondaFall = (state) => state.rules.id === `cuarenta-local-v2-combo-${state.rules.comboPoints}`;

export function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: `${suit}-${rank}`, rank, suit })));
}

function randomInt(max, random) {
  if (random !== undefined) {
    if (typeof random !== 'function') fail('La fuente de azar debe ser una función.');
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) fail('El azar debe devolver un número entre 0 y 1, sin incluir 1.');
    return Math.floor(value * max);
  }
  if (!globalThis.crypto?.getRandomValues) fail('Este navegador no dispone de azar seguro.');
  // Rejection sampling avoids modulo bias. Fisher–Yates uses this bounded integer.
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % max;
}

function shuffle(cards, random) {
  const result = cards.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1, random);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function event(state, value) {
  const previous = state.history.at(-1)?.id ?? '';
  const sequence = Number(previous.split(':').at(-1)) + 1 || 1;
  state.history.push({ id: `${state.id}:${sequence}`, ...value });
  state.history = state.history.slice(-120);
  state.lastEvent = { ...value };
}

function ranksIn(hand) {
  const counts = new Map();
  for (const card of hand) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  return counts;
}

function finish(state, playerId, kind, text) {
  state.status = 'finished';
  state.winner = playerId;
  event(state, { kind, text, playerId });
}

function dealHands(state, random) {
  if (state.deck.length < 10 || state.players.some((player) => player.hand.length)) {
    fail('No se puede repartir: las manos deben estar vacías y deben quedar diez cartas.');
  }
  const first = 1 - state.dealer;
  state.turn = first;
  state.lastPlay = null;
  if (hasRondaFall(state)) state.rondas = [null, null];
  let repetitions = 0;
  while (true) {
    state.players[first].hand = state.deck.splice(0, 5);
    state.players[1 - first].hand = state.deck.splice(0, 5);
    const quads = state.players.map((player) => [...ranksIn(player.hand).values()].includes(4));
    if (!quads.every(Boolean)) break;
    repetitions += 1;
    // Fail without inventing a hand if a faulty injected random source cannot
    // produce a valid deal. Callers keep the previous immutable game state.
    if (repetitions >= 16) fail('No se pudo completar el reparto. Intenta repartir otra vez.');
    const returned = [...state.players[first].hand, ...state.players[1 - first].hand];
    state.players.forEach((player) => { player.hand = []; });
    state.deck = shuffle([...returned, ...state.deck], random);
  }
  if (repetitions) event(state, { kind: 'redeal', text: 'Cuatro iguales simultáneas: se repitió el reparto sin cambiar puntos.' });
  event(state, { kind: 'deal', text: `Reparto ${state.deal} del ciclo ${state.round}. Empieza ${state.players[first].name}.` });
  const quadWinner = state.players.find((player) => [...ranksIn(player.hand).values()].includes(4));
  if (quadWinner) {
    finish(state, quadWinner.id, 'four-kind', `${quadWinner.name} gana por recibir cuatro iguales.`);
    return;
  }
  for (const id of [first, 1 - first]) {
    const player = state.players[id];
    const triple = [...ranksIn(player.hand)].find(([, count]) => count === 3);
    if (triple && hasRondaFall(state)) {
      const rank = triple[0];
      state.rondas[id] = { rank, cardIds: player.hand.filter((card) => card.rank === rank).map((card) => card.id) };
    }
    if (triple && (hasRondaFall(state) || player.score < 30)) {
      player.score += 2;
      event(state, { kind: 'ronda', playerId: id, points: 2, text: `${player.name}: ronda, +2 puntos.` });
      if (player.score >= 40) {
        finish(state, id, 'ronda-victory', `${player.name} gana con 40 puntos al recibir una ronda.`);
        return;
      }
    }
  }
}

export function createGame({ mode = 'solo', names = ['Tú', 'Don Jacinto'], comboPoints = 2, difficulty = 'medium', random, dealer } = {}) {
  if (!['solo', 'pass'].includes(mode)) fail('Modalidad desconocida.');
  if (!DIFFICULTIES.includes(difficulty)) fail('Dificultad desconocida.');
  if (![2, 4].includes(comboPoints)) fail('Caída y limpia debe valer 2 o 4 puntos.');
  if (!Array.isArray(names) || names.length !== 2 || names.some((name) => typeof name !== 'string' || !name.trim())) fail('Se necesitan dos nombres.');
  if (dealer !== undefined && ![0, 1].includes(dealer)) fail('Repartidor inválido.');
  const selectedDealer = dealer ?? randomInt(2, random);
  const state = {
    schemaVersion: 1,
    id: globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${randomInt(0x100000000, random)}`,
    revision: 0,
    rules: { id: `cuarenta-local-v2-combo-${comboPoints}`, comboPoints },
    mode, difficulty, rondas: [null, null],
    players: names.map((name, id) => ({ id, name: name.trim().slice(0, 20), hand: [], score: 0, captured: [] })),
    deck: shuffle(createDeck(), random), table: [], discarded: [],
    dealer: selectedDealer, turn: 1 - selectedDealer, round: 1, deal: 1,
    status: 'playing', winner: null, lastPlay: null,
    history: [], roundSummary: null, lastEvent: null,
  };
  dealHands(state, random);
  assertInvariant(state);
  return state;
}

function basesFor(card, table) {
  const result = table.filter((other) => other.rank === card.rank)
    .map((other) => ({ kind: 'match', cards: [other] }));
  const target = numeric(card);
  if (!target) return result;
  const candidates = table.filter((other) => numeric(other) > 0 && numeric(other) < target);
  function visit(start, remaining, selected) {
    if (remaining === 0) {
      if (selected.length >= 2) result.push({ kind: 'sum', cards: selected.slice() });
      return;
    }
    for (let i = start; i < candidates.length; i += 1) {
      const value = numeric(candidates[i]);
      if (value <= remaining) visit(i + 1, remaining - value, [...selected, candidates[i]]);
    }
  }
  visit(0, target, []);
  return result;
}

function extend(base, rankIndex, table) {
  if (rankIndex >= RANKS.length) return [base];
  const choices = table.filter((card) => card.rank === RANKS[rankIndex]);
  if (!choices.length) return [base];
  return choices.flatMap((card) => extend([...base, card], rankIndex + 1, table));
}

/** Also accepts publicView: only the requested player's hand and public fields are read. */
export function legalMoves(state, playerId) {
  if (state.status !== 'playing' || state.turn !== playerId) return [];
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || !Array.isArray(player.hand)) return [];
  const moves = [];
  for (const card of player.hand) {
    const bases = basesFor(card, state.table);
    if (!bases.length) {
      moves.push({ cardId: card.id, captureIds: [], kind: 'drop', fall: false, clean: false, points: 0, rondaFall: false, winsGame: false });
      continue;
    }
    for (const base of bases) {
      const previous = state.lastPlay;
      const fall = Boolean(base.kind === 'match' && previous && previous.playerId === 1 - playerId &&
        previous.cardId === base.cards[0].id && previous.deal === state.deal && previous.round === state.round);
      for (const captured of extend(base.cards, RANKS.indexOf(card.rank) + 1, state.table)) {
        const clean = captured.length === state.table.length;
        const points = player.score === 38 ? (fall ? 2 : 0)
          : fall && clean ? state.rules.comboPoints : fall || clean ? 2 : 0;
        const rondaFall = Boolean(hasRondaFall(state) && fall && previous.fromRonda === true);
        const winsGame = rondaFall || player.score + points >= 40;
        moves.push({ cardId: card.id, captureIds: captured.map((value) => value.id), kind: base.kind, fall, clean, points, rondaFall, winsGame });
      }
    }
  }
  return moves;
}

function closeRound(state) {
  const captured = state.players.map((player) => player.captured.length);
  const base = [0, 0];
  if (captured[0] === captured[1]) base[1 - state.dealer] = 2;
  else {
    const majority = captured[0] > captured[1] ? 0 : 1;
    if (captured[majority] >= 20) base[majority] = 2 * Math.ceil((6 + captured[majority] - 20) / 2);
  }
  const awarded = state.players.map((player, id) => player.score >= 30 ? 0 : Math.min(base[id], 30 - player.score));
  const leftover = state.table.length;
  state.discarded.push(...state.table);
  state.table = [];
  state.players.forEach((player, id) => { player.score += awarded[id]; });
  state.roundSummary = { captured, base, awarded, leftover };
  state.status = 'round-end';
  state.lastPlay = null;
  event(state, { kind: 'round-end', text: `Ciclo ${state.round} terminado. Cartón: ${state.players[0].name} +${awarded[0]}, ${state.players[1].name} +${awarded[1]}.` });
}

export function applyMove(state, { playerId, cardId, captureIds = [], expectedRevision } = {}) {
  assertInvariant(state);
  if (state.status !== 'playing') fail('La partida no admite jugadas en este momento.');
  if (expectedRevision !== state.revision) fail('El estado cambió. Actualiza antes de jugar.');
  if (playerId !== state.turn) fail('No es tu turno.');
  if (!Array.isArray(captureIds) || captureIds.some((id) => typeof id !== 'string') || new Set(captureIds).size !== captureIds.length) fail('La selección contiene cartas inválidas o repetidas.');
  if (!state.players[playerId].hand.some((card) => card.id === cardId)) fail('Esa carta no pertenece a tu mano.');
  const selection = new Set(captureIds);
  const move = legalMoves(state, playerId).find((candidate) => candidate.cardId === cardId &&
    candidate.captureIds.length === selection.size && candidate.captureIds.every((id) => selection.has(id)));
  if (!move) fail('Captura inválida: elige una base y completa su escalera.');
  const next = copy(state);
  next.revision += 1;
  const player = next.players[playerId];
  const card = player.hand.splice(player.hand.findIndex((value) => value.id === cardId), 1)[0];
  if (move.captureIds.length) {
    const captured = next.table.filter((value) => selection.has(value.id));
    next.table = next.table.filter((value) => !selection.has(value.id));
    player.captured.push(card, ...captured);
  } else next.table.push(card);
  next.lastPlay = { playerId, cardId, deal: next.deal, round: next.round };
  if (hasRondaFall(next)) next.lastPlay.fromRonda = Boolean(next.rondas[playerId]?.cardIds.includes(cardId));
  player.score += move.points;
  next.turn = 1 - playerId;
  const label = move.fall && move.clean ? 'caída y limpia' : move.fall ? 'caída' : move.clean ? 'limpia' : move.kind === 'drop' ? 'juega' : 'captura';
  event(next, {
    kind: move.fall && move.clean ? 'fall-clean' : move.fall ? 'fall' : move.clean ? 'clean' : move.kind,
    playerId, points: move.points,
    text: `${player.name}: ${label} con ${card.rank}${move.points ? `, +${move.points} puntos` : ''}.`,
  });
  if (move.rondaFall) {
    finish(next, playerId, 'ronda-fall', `${player.name} gana la partida: caída a la ronda de ${state.players[1 - playerId].name}.`);
  } else if (player.score >= 40) finish(next, playerId, 'victory', `${player.name} gana con ${player.score} puntos.`);
  else if (next.players.every((candidate) => candidate.hand.length === 0)) {
    if (next.deck.length) {
      next.deal += 1;
      dealHands(next);
    } else closeRound(next);
  }
  assertInvariant(next);
  return next;
}

export function advanceRound(state, { random } = {}) {
  assertInvariant(state);
  if (state.status !== 'round-end') fail('Solo se puede avanzar después del conteo del ciclo.');
  const next = copy(state);
  next.revision += 1;
  next.round += 1;
  next.deal = 1;
  next.dealer = 1 - state.dealer;
  next.status = 'playing';
  next.roundSummary = null;
  next.lastPlay = null;
  next.table = [];
  next.discarded = [];
  next.players.forEach((player) => { player.hand = []; player.captured = []; });
  next.deck = shuffle(createDeck(), random);
  dealHands(next, random);
  assertInvariant(next);
  return next;
}

export function assertInvariant(state) {
  const invalid = (message) => fail(`Estado inválido: ${message}`);
  if (!state || state.schemaVersion !== 1) invalid('versión desconocida.');
  if (!['solo', 'pass'].includes(state.mode) || !STATUSES.includes(state.status)) invalid('modalidad o fase.');
  if (!Number.isInteger(state.revision) || state.revision < 0) invalid('revisión.');
  if (typeof state.id !== 'string' || !state.id) invalid('identificador.');
  if (![0, 1].includes(state.dealer) || ![0, 1].includes(state.turn)) invalid('turno o repartidor.');
  if (!Number.isInteger(state.round) || state.round < 1 || !Number.isInteger(state.deal) || state.deal < 1 || state.deal > 4) invalid('ciclo o reparto.');
  if (![2, 4].includes(state.rules?.comboPoints) || ![1, 2].some((version) => state.rules.id === `cuarenta-local-v${version}-combo-${state.rules.comboPoints}`)) invalid('perfil de reglas.');
  if ((state.difficulty !== undefined || hasRondaFall(state)) && !DIFFICULTIES.includes(state.difficulty)) invalid('dificultad.');
  if (!Array.isArray(state.players) || state.players.length !== 2) invalid('participantes.');
  if (![state.deck, state.table, state.discarded].every(Array.isArray)) invalid('ubicaciones.');
  const cards = [...state.deck, ...state.table, ...state.discarded];
  for (const [id, player] of state.players.entries()) {
    if (player.id !== id || typeof player.name !== 'string' || !player.name.trim()) invalid('asiento o nombre.');
    if (!Array.isArray(player.hand) || player.hand.length > 5 || !Array.isArray(player.captured)) invalid('mano o capturas.');
    if (!Number.isInteger(player.score) || player.score < 0 || player.score > 40 || player.score % 2) invalid('puntuación.');
    cards.push(...player.hand, ...player.captured);
  }
  if (cards.length !== 40 || new Set(cards.map((card) => card?.id)).size !== 40) invalid('las cuarenta cartas deben existir una sola vez.');
  for (const card of cards) {
    if (!card || !RANKS.includes(card.rank) || !SUITS.includes(card.suit) || card.id !== `${card.suit}-${card.rank}`) invalid('carta desconocida.');
  }
  if (state.rondas !== undefined || hasRondaFall(state)) {
    if (!Array.isArray(state.rondas) || state.rondas.length !== 2) invalid('rondas.');
    const rondaIds = [];
    for (const [playerId, ronda] of state.rondas.entries()) {
      if (ronda === null) continue;
      if (!ronda || !RANKS.includes(ronda.rank) || !Array.isArray(ronda.cardIds) || ronda.cardIds.length !== 3 || new Set(ronda.cardIds).size !== 3) invalid('ronda incompleta.');
      for (const cardId of ronda.cardIds) {
        if (!cards.some((card) => card.id === cardId && card.rank === ronda.rank) || state.deck.some((card) => card.id === cardId) || state.players[1 - playerId].hand.some((card) => card.id === cardId)) invalid('cartas originales de ronda.');
        rondaIds.push(cardId);
      }
    }
    if (new Set(rondaIds).size !== rondaIds.length) invalid('rondas repetidas.');
  }
  if (state.status === 'finished' ? ![0, 1].includes(state.winner) : state.winner !== null) invalid('ganador incompatible con la fase.');
  if (state.status === 'playing' && !state.players[state.turn].hand.length) invalid('jugador activo sin cartas.');
  if (state.status === 'round-end' && (state.deck.length || state.table.length || state.players.some((player) => player.hand.length) || !state.roundSummary)) invalid('conteo incompleto.');
  if (state.lastPlay !== null && (!state.lastPlay || ![0, 1].includes(state.lastPlay.playerId) || !cards.some((card) => card.id === state.lastPlay.cardId) || state.lastPlay.deal !== state.deal || state.lastPlay.round !== state.round)) invalid('última jugada.');
  if (state.lastPlay !== null && hasRondaFall(state) && (typeof state.lastPlay.fromRonda !== 'boolean' || state.lastPlay.fromRonda !== Boolean(state.rondas[state.lastPlay.playerId]?.cardIds.includes(state.lastPlay.cardId)))) invalid('procedencia de la última carta.');
  if (!Array.isArray(state.history) || state.history.length > 120 || new Set(state.history.map((item) => item.id)).size !== state.history.length) invalid('historial.');
  return true;
}

/** A detached projection, never a reference to secret state. The local device still
 * holds the full game; this is a bot/UI boundary, not network anti-cheat security. */
export function publicView(state, playerId) {
  if (![0, 1].includes(playerId)) fail('Asiento inválido para consultar la partida.');
  return copy({
    schemaVersion: state.schemaVersion, id: state.id, revision: state.revision,
    rules: state.rules, mode: state.mode, difficulty: state.difficulty ?? 'medium', currentPlayerId: playerId,
    rondas: (state.rondas ?? [null, null]).map((ronda, id) => id === playerId ? ronda : null),
    players: state.players.map((player) => ({
      id: player.id, name: player.name, score: player.score,
      hand: player.id === playerId ? player.hand : null,
      handCount: player.hand.length, capturedCount: player.captured.length,
    })),
    table: state.table, deckCount: state.deck.length, discardedCount: state.discarded.length,
    dealer: state.dealer, turn: state.turn, round: state.round, deal: state.deal,
    status: state.status, winner: state.winner, lastPlay: state.lastPlay,
    history: state.history, roundSummary: state.roundSummary, lastEvent: state.lastEvent,
  });
}
