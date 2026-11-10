import test from 'node:test';
import assert from 'node:assert/strict';
import { RANKS, SUITS, createDeck, createGame, legalMoves, applyMove, advanceRound, assertInvariant, publicView } from '../dist/js/engine.js';
import { chooseBotMove } from '../dist/js/bot.js';

const all = () => createDeck();
const card = (id) => all().find((candidate) => candidate.id === id);
const h = (rank) => `hearts-${rank}`;
const s = (rank) => `spades-${rank}`;
const d = (rank) => `diamonds-${rank}`;
const c = (rank) => `clubs-${rank}`;

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function fixture({ hand0 = [h('7')], hand1 = [s('K')], table = [], captured0 = [], captured1 = [], scores = [0, 0], comboPoints = 2, lastPlay = null, rondas = [null, null], version = 2 } = {}) {
  const state = createGame({ dealer: 1, random: rng(7), comboPoints });
  state.status = 'playing'; state.winner = null; state.turn = 0;
  state.players[0].hand = hand0.map(card); state.players[1].hand = hand1.map(card);
  state.players[0].captured = captured0.map(card); state.players[1].captured = captured1.map(card);
  state.players.forEach((player, id) => { player.score = scores[id]; });
  state.table = table.map(card); state.discarded = [];
  state.rules.id = `cuarenta-local-v${version}-combo-${comboPoints}`;
  state.rondas = rondas;
  state.lastPlay = lastPlay && version === 2 ? { fromRonda: false, ...lastPlay } : lastPlay;
  if (version === 1) { delete state.rondas; delete state.difficulty; }
  state.history = []; state.lastEvent = null;
  const used = new Set([...hand0, ...hand1, ...table, ...captured0, ...captured1]);
  state.deck = all().filter((candidate) => !used.has(candidate.id));
  assertInvariant(state);
  return state;
}

function play(state, move = legalMoves(state, state.turn)[0]) {
  return applyMove(state, { playerId: state.turn, cardId: move.cardId, captureIds: move.captureIds, expectedRevision: state.revision });
}

// Force a complete initial permutation through the public test RNG injection.
function orderedRandom(prefix, fallback = 0.999999999) {
  const desired = [...prefix, ...all().map((value) => value.id).filter((id) => !prefix.includes(id))];
  const current = all().map((value) => value.id);
  const values = [];
  for (let i = current.length - 1; i > 0; i -= 1) {
    const j = current.indexOf(desired[i]);
    values.push((j + 0.1) / (i + 1));
    [current[i], current[j]] = [current[j], current[i]];
  }
  return () => values.length ? values.shift() : typeof fallback === 'function' ? fallback() : fallback;
}

test('deck and initial deal have forty unique cards, immutable rank definitions, and explicit profiles', () => {
  assert.equal(all().length, 40);
  assert.equal(new Set(all().map((value) => value.id)).size, 40);
  assert.deepEqual(RANKS, ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K']);
  assert.equal(SUITS.length, 4);
  const state = createGame({ dealer: 1, mode: 'pass', comboPoints: 4, random: rng(2) });
  assert.equal(state.turn, 0); assert.equal(state.deck.length, 30);
  assert.deepEqual(state.players.map((player) => player.hand.length), [5, 5]);
  assert.equal(state.rules.comboPoints, 4); assert.equal(state.table.length, 0);
  assertInvariant(state);
  assert.throws(() => createGame({ comboPoints: 3 }), /2 o 4/);
  assert.throws(() => createGame({ random: () => 1 }), /azar/);
});

test('sum, optional equality base, and mandatory ladder match the proposed SRS examples', () => {
  let state = fixture({ hand0: [h('7')], table: [h('3'), h('4'), h('J'), h('Q')] });
  assert.deepEqual(legalMoves(state, 0)[0].captureIds, [h('3'), h('4'), h('J'), h('Q')]);
  assert.equal(legalMoves(state, 0)[0].kind, 'sum');
  state = fixture({ hand0: [h('6')], table: [h('A'), h('2'), h('3')] });
  assert.equal(legalMoves(state, 0)[0].captureIds.length, 3);
  state = fixture({ hand0: [h('4')], table: [h('A'), h('3'), s('4')] });
  assert.deepEqual(legalMoves(state, 0).map((move) => move.kind), ['match', 'sum']);
  assert(legalMoves(state, 0).every((move) => move.captureIds.length < 3));
  state = fixture({ hand0: [h('7')], table: [s('7'), h('J'), h('K')] });
  assert.deepEqual(legalMoves(state, 0)[0].captureIds, [s('7'), h('J')]);
  state = fixture({ hand0: [h('7')], table: [s('7'), h('J'), s('J'), h('Q')] });
  assert.equal(legalMoves(state, 0).length, 2);
  assert(legalMoves(state, 0).every((move) => move.captureIds.length === 3));
});

test('figures do not sum, aces do not wrap after K, and drops are legal only without a capture', () => {
  const state = fixture({ hand0: [h('J'), h('K')], hand1: [d('K')], table: [h('5'), h('6'), h('A'), s('K')] });
  const moves = legalMoves(state, 0);
  assert.equal(moves.find((move) => move.cardId === h('J')).kind, 'drop');
  assert.deepEqual(moves.find((move) => move.cardId === h('K')).captureIds, [s('K')]);
  assert.throws(() => applyMove(state, { playerId: 0, cardId: h('K'), captureIds: [], expectedRevision: 0 }), /Captura inválida/);
});

test('fall requires the exact immediately previous card as equality base, never a sum or ladder', () => {
  let state = fixture({ table: [s('7'), h('J')], lastPlay: { playerId: 1, cardId: s('7'), round: 1, deal: 1 } });
  assert.equal(legalMoves(state, 0)[0].fall, true);
  state = fixture({ table: [h('3'), h('4')], lastPlay: { playerId: 1, cardId: h('4'), round: 1, deal: 1 } });
  assert.equal(legalMoves(state, 0)[0].fall, false);
  state = fixture({ table: [s('7'), h('J')], lastPlay: { playerId: 1, cardId: h('J'), round: 1, deal: 1 } });
  assert.equal(legalMoves(state, 0)[0].fall, false);
  state = fixture({ table: [s('7')], lastPlay: null });
  assert.equal(legalMoves(state, 0)[0].fall, false);
  state = fixture({ table: [s('7'), d('7')], lastPlay: { playerId: 1, cardId: d('7'), round: 1, deal: 1 } });
  assert.deepEqual(legalMoves(state, 0).map((move) => move.fall), [false, true]);
});

test('combo profile is fixed; 38 disables clean points but a fall still ends the game exactly once', () => {
  for (const comboPoints of [2, 4]) {
    let state = fixture({ table: [s('7')], comboPoints, lastPlay: { playerId: 1, cardId: s('7'), round: 1, deal: 1 } });
    assert.equal(legalMoves(state, 0)[0].points, comboPoints);
    state = fixture({ table: [s('7')], comboPoints, scores: [38, 0] });
    assert.equal(legalMoves(state, 0)[0].clean, true);
    assert.equal(play(state).players[0].score, 38);
    state = fixture({ table: [s('7')], comboPoints, scores: [38, 0], lastPlay: { playerId: 1, cardId: s('7'), round: 1, deal: 1 } });
    const result = play(state);
    assert.equal(result.status, 'finished'); assert.equal(result.winner, 0);
    assert.equal(result.players[0].score, 40); assert.equal(result.roundSummary, null);
    assert.throws(() => play(result, { cardId: h('7'), captureIds: [] }), /no admite/);
  }
});

test('invalid actions preserve the original state; legal transition is immutable and revision checked', () => {
  const state = fixture({ table: [s('7'), h('J')] });
  const original = structuredClone(state);
  const action = { playerId: 0, cardId: h('7'), captureIds: [s('7'), h('J')], expectedRevision: 0 };
  assert.throws(() => applyMove(state, { ...action, expectedRevision: 4 }), /estado cambió/);
  assert.throws(() => applyMove(state, { ...action, playerId: 1 }), /turno/);
  assert.throws(() => applyMove(state, { ...action, cardId: s('K') }), /tu mano/);
  assert.throws(() => applyMove(state, { ...action, captureIds: [s('7')] }), /Captura inválida/);
  assert.throws(() => applyMove(state, { ...action, captureIds: [s('7'), s('7')] }), /repetidas/);
  assert.deepEqual(state, original);
  const result = applyMove(state, { ...action, captureIds: action.captureIds.slice().reverse() });
  assert.equal(result.revision, 1); assert.equal(result.players[0].captured.length, 3);
  assert.deepEqual(state, original); assertInvariant(result);
});

test('v2 ronda always scores two, four equal cards win before ronda, and simultaneous quads cannot loop', () => {
  let state = createGame({ dealer: 1, random: orderedRandom([h('A'), s('A'), c('A'), h('2'), h('3'), h('4'), h('5'), h('6'), h('7'), h('J')]) });
  assert.equal(state.players[0].score, 2);
  assert.equal(state.history.filter((item) => item.kind === 'ronda').length, 1);
  const quad = [h('A'), s('A'), c('A'), d('A')];
  state = createGame({ dealer: 1, random: orderedRandom([...quad, h('2')]) });
  assert.equal(state.status, 'finished'); assert.equal(state.winner, 0);
  assert.equal(state.players[0].score, 0); assert.equal(state.history.some((item) => item.kind === 'ronda'), false);
  const double = [...quad, h('2'), h('3'), s('3'), c('3'), d('3'), h('4')];
  assert.throws(() => createGame({ dealer: 1, random: orderedRandom(double) }), /repartir otra vez/);
  state = createGame({ dealer: 1, random: orderedRandom(double, rng(83)) });
  assert.equal(state.status, 'playing'); assert.equal(state.winner, null);
  assert.equal(state.history.some((item) => item.kind === 'redeal'), true);
  assertInvariant(state);
  for (const score of [28, 30, 38]) {
    // End a turn just before an automatic new deal containing a triple.
    state = fixture({ hand0: [h('K')], hand1: [], table: [], scores: [score, 0] });
    const prefix = [h('A'), s('A'), c('A'), h('2'), h('3'), h('4'), h('5'), h('6'), h('7'), h('J')];
    const keep = new Set([...prefix, h('K')]);
    state.deck = prefix.map(card); state.players[1].captured = all().filter((value) => !keep.has(value.id));
    const next = play(state);
    assert.equal(next.deal, 2); assert.equal(next.lastPlay, null);
    assert.equal(next.players[0].score, score + 2);
    assert.equal(next.status, score === 38 ? 'finished' : 'playing');
    assertInvariant(next);
  }
});

function ending(n0, n1, scores = [0, 0]) {
  const remaining = all().filter((value) => ![h('K'), s('K')].includes(value.id));
  const captured0 = remaining.splice(0, n0 - 2).map((value) => value.id);
  const captured1 = remaining.splice(0, n1).map((value) => value.id);
  const table = [s('K'), ...remaining.map((value) => value.id)];
  const state = fixture({ hand0: [h('K')], hand1: [], table, captured0, captured1, scores });
  assert.equal(state.deck.length, 0);
  return play(state, legalMoves(state, 0).find((move) => move.captureIds.includes(s('K'))));
}

test('carton covers exact twenty, excess, ties, unequal minorities, discarded leftovers, and cap thirty', () => {
  for (const [n0, n1, base] of [[20, 18, [6, 0]], [21, 17, [8, 0]], [22, 16, [8, 0]], [20, 20, [2, 0]], [18, 18, [2, 0]], [19, 18, [0, 0]]]) {
    const state = ending(n0, n1);
    assert.equal(state.status, 'round-end');
    assert.deepEqual(state.roundSummary.captured, [n0, n1]);
    assert.deepEqual(state.roundSummary.base, base);
    assert.equal(state.discarded.length, 40 - n0 - n1);
    assert.equal(state.table.length, 0); assertInvariant(state);
  }
  let state = ending(26, 12, [28, 0]);
  assert.deepEqual(state.roundSummary.base, [12, 0]);
  assert.deepEqual(state.roundSummary.awarded, [2, 0]);
  assert.equal(state.players[0].score, 30);
  state = ending(26, 12, [38, 0]);
  assert.equal(state.players[0].score, 38); assert.equal(state.status, 'round-end');
  assert.deepEqual(state.roundSummary.awarded, [0, 0]);
});

test('advance resets the card cycle, preserves score, changes dealer, and cannot skip an unfinished cycle', () => {
  const state = ending(21, 17, [30, 30]);
  const next = advanceRound(state, { random: rng(12) });
  assert.equal(next.round, 2); assert.equal(next.deal, 1); assert.equal(next.dealer, 0);
  assert.equal(next.turn, 1); assert.equal(next.revision, state.revision + 1);
  assert.deepEqual(next.players.map((player) => player.score), [30, 30]);
  assert.equal(next.discarded.length, 0); assert.equal(next.table.length, 0);
  assert.equal(next.players[0].captured.length, 0); assert.equal(next.roundSummary, null);
  assert.throws(() => advanceRound(next), /después del conteo/);
  assertInvariant(next);
});

test('public projection and bot do not receive opponents hands or the future deck, and are detached', () => {
  const state = createGame({ dealer: 1, random: rng(3) });
  const view = publicView(state, 0);
  assert.equal(view.players[1].hand, null); assert.equal(view.players[1].handCount, 5);
  assert.equal(view.deck, undefined); assert.equal(view.discarded, undefined);
  assert.equal(view.players[1].captured, undefined);
  for (const secret of [...state.players[1].hand, ...state.deck]) assert.equal(JSON.stringify(view).includes(secret.id), false);
  assert.deepEqual(legalMoves(view, 0), legalMoves(state, 0));
  const before = structuredClone(view);
  const action = chooseBotMove(view); assert.deepEqual(view, before);
  assertInvariant(applyMove(state, action));
  view.players[0].hand[0].rank = 'K'; view.table.push(card(h('A')));
  assert.notDeepEqual(view.players[0].hand, state.players[0].hand);
  assert.equal(state.table.length, 0);
  assert.equal(chooseBotMove(publicView(state, 1)), null);
});

test('invariants reject duplicate cards, altered identities, illegal scores, and inconsistent terminal state', () => {
  const state = createGame({ dealer: 1, random: rng(1) });
  for (const corrupt of [
    (value) => { value.deck[0] = value.deck[1]; },
    (value) => { value.deck[0].rank = '8'; },
    (value) => { value.players[0].score = 31; },
    (value) => { value.status = 'round-end'; },
    (value) => { value.winner = 0; },
  ]) {
    const invalid = structuredClone(state); corrupt(invalid);
    assert.throws(() => assertInvariant(invalid), /Estado inválido/);
  }
});

test('120 seeded complete games preserve cards, alternate hands, end once, and keep bounded history', () => {
  let cycles = 0;
  let actions = 0;
  for (let seed = 1; seed <= 120; seed += 1) {
    const random = rng(seed);
    let state = createGame({ mode: seed % 2 ? 'solo' : 'pass', comboPoints: seed % 2 ? 2 : 4, random });
    let steps = 0;
    while (state.status !== 'finished') {
      assert(steps++ < 4000, `Game ${seed} did not finish`);
      if (state.status === 'round-end') { cycles += 1; state = advanceRound(state, { random }); }
      else {
        const action = chooseBotMove(publicView(state, state.turn));
        assert(action); state = applyMove(state, action); actions += 1;
      }
      assertInvariant(state);
      assert(state.history.length <= 120);
    }
    assert([0, 1].includes(state.winner));
    assert.equal(state.history.filter((item) => ['victory', 'four-kind', 'ronda-fall', 'ronda-victory'].includes(item.kind)).length, 1);
  }
  assert(cycles > 100, `Only ${cycles} complete cycles`);
  assert(actions > 4000, `Only ${actions} accepted moves`);
});

test('v2 records the three original ronda cards privately and preserves difficulty through JSON and cycles', () => {
  const prefix = [h('A'), s('A'), c('A'), h('2'), h('3'), h('4'), h('5'), h('6'), h('7'), h('J')];
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const state = createGame({ difficulty, dealer: 1, random: orderedRandom(prefix) });
    assert.equal(state.rules.id, 'cuarenta-local-v2-combo-2');
    assert.deepEqual(state.rondas, [{ rank: 'A', cardIds: prefix.slice(0, 3) }, null]);
    const restored = JSON.parse(JSON.stringify(state));
    assertInvariant(restored);
    assert.deepEqual(restored, state);
    assert.equal(publicView(restored, 0).difficulty, difficulty);
    assert.deepEqual(publicView(restored, 0).rondas, state.rondas);
    assert.deepEqual(publicView(restored, 1).rondas, [null, null]);
    const hidden = JSON.stringify(publicView(restored, 1));
    prefix.slice(0, 3).forEach((id) => assert.equal(hidden.includes(id), false));
    const after = play(restored, legalMoves(restored, 0).find((move) => move.cardId === h('A')));
    assert.equal(after.lastPlay.fromRonda, true);
    assert.equal(publicView(after, 0).lastPlay.fromRonda, true);
    assert.equal(Object.hasOwn(publicView(after, 1).lastPlay, 'fromRonda'), false);
    assert.deepEqual(publicView(after, 1).rondas, [null, null]);
    assert.equal(after.difficulty, difficulty);
    const cycleEnd = ending(21, 17, [30, 30]); cycleEnd.difficulty = difficulty;
    assert.equal(advanceRound(cycleEnd, { random: rng(12) }).difficulty, difficulty);
  }
  assert.equal(createGame({ random: rng(3) }).difficulty, 'medium');
  assert.throws(() => createGame({ difficulty: 'superhuman' }), /Dificultad/);
});

test('ronda explanation is private in projected history and last event while scores remain authoritative', () => {
  const prefix = [h('A'), s('A'), c('A'), h('2'), h('3'), h('4'), h('5'), h('6'), h('7'), h('J')];
  const state = createGame({ dealer: 1, random: orderedRandom(prefix) });
  const original = structuredClone(state);
  const owner = publicView(state, 0);
  const rival = publicView(state, 1);
  assert.equal(state.lastEvent.kind, 'ronda');
  assert.equal(owner.lastEvent.kind, 'ronda');
  assert.equal(owner.history.some((item) => item.kind === 'ronda'), true);
  assert.equal(rival.history.some((item) => item.kind === 'ronda'), false);
  assert.equal(rival.lastEvent.kind, 'deal');
  assert.equal(rival.lastEvent.id, undefined);
  assert.equal(rival.players[0].score, 2);
  assert.equal(rival.players[0].hand, null);
  assert.deepEqual(rival.rondas, [null, null]);
  assert.deepEqual(state, original);
  const after = play(state, legalMoves(state, 0).find((move) => move.cardId === h('A')));
  const afterRival = publicView(after, 1);
  assert.equal(afterRival.lastPlay.cardId, h('A'));
  assert.equal(afterRival.lastPlay.playerId, 0);
  assert.equal(Object.hasOwn(afterRival.lastPlay, 'fromRonda'), false);
  assert.equal(afterRival.lastEvent.kind, 'drop');
  assert.equal(afterRival.lastEvent.playerId, 0);
  assert.equal(afterRival.lastEvent.text, after.lastEvent.text);
  assert.equal(afterRival.history.some((item) => item.kind === 'ronda'), false);
  // A non-ronda rival play also omits the property; false must not be a clue.
  const ordinary = fixture({ table: [s('7')], lastPlay: { playerId: 1, cardId: s('7'), round: 1, deal: 1 } });
  assert.equal(Object.hasOwn(publicView(ordinary, 0).lastPlay, 'fromRonda'), false);
});

test('an immediate equality fall on the first, second or third original ronda card wins below forty', () => {
  const originals = [s('7'), d('7'), c('7')];
  for (let index = 0; index < originals.length; index += 1) {
    const state = fixture({
      hand0: [h('7')], hand1: [...originals.slice(index + 1), s('K')],
      table: [originals[index]], captured0: originals.slice(0, index), scores: [0, 2],
      rondas: [null, { rank: '7', cardIds: originals }],
      lastPlay: { playerId: 1, cardId: originals[index], round: 1, deal: 1, fromRonda: true },
    });
    const restored = JSON.parse(JSON.stringify(state));
    const move = legalMoves(restored, 0)[0];
    assert.equal(move.fall, true); assert.equal(move.rondaFall, true); assert.equal(move.winsGame, true);
    assert.deepEqual(legalMoves(publicView(restored, 0), 0), legalMoves(restored, 0).map((candidate) => ({ ...candidate, rondaFall: false, winsGame: false })));
    const next = play(restored, move);
    assert.equal(next.status, 'finished'); assert.equal(next.winner, 0);
    assert.equal(next.players[0].score, 2); assert.equal(next.lastEvent.kind, 'ronda-fall');
    assert.equal(publicView(next, 0).lastEvent.kind, 'ronda-fall');
    assert.equal(publicView(next, 1).lastEvent.kind, 'ronda-fall');
    assert.equal(next.roundSummary, null); assert.equal(next.deal, 1);
    assert.equal(next.history.filter((item) => item.kind === 'ronda-fall').length, 1);
    assert.throws(() => play(next, move), /no admite/);
    assert.throws(() => advanceRound(next), /después del conteo/);
    assertInvariant(next);
  }
});

test('capturing ronda through a sum, a ladder or a later equality never gives the special victory', () => {
  const cases = [
    { hand0: [h('7')], hand1: [c('4'), d('4')], table: [h('3'), s('4')], rank: '4', originals: [s('4'), c('4'), d('4')], previous: s('4'), fromRonda: true },
    { hand0: [h('7')], hand1: [c('J'), d('J')], table: [s('7'), s('J')], rank: 'J', originals: [s('J'), c('J'), d('J')], previous: s('J'), fromRonda: true },
    { hand0: [h('7')], hand1: [c('7'), d('7')], table: [s('7'), h('2')], rank: '7', originals: [s('7'), c('7'), d('7')], previous: h('2'), fromRonda: false },
  ];
  for (const value of cases) {
    const state = fixture({ ...value, rondas: [null, { rank: value.rank, cardIds: value.originals }], lastPlay: { playerId: 1, cardId: value.previous, round: 1, deal: 1, fromRonda: value.fromRonda } });
    for (const move of legalMoves(state, 0)) {
      assert.equal(move.fall, false); assert.equal(move.rondaFall, false); assert.equal(move.winsGame, false);
      assert.equal(play(state, move).status, 'playing');
    }
  }
  const ordinary = fixture({ table: [s('7')], lastPlay: { playerId: 1, cardId: s('7'), round: 1, deal: 1 } });
  assert.equal(legalMoves(ordinary, 0)[0].fall, true);
  assert.equal(legalMoves(ordinary, 0)[0].rondaFall, false);
  assert.equal(play(ordinary).status, 'playing');
});

test('a winning ronda fall on the last hand card never deals again or performs a cycle count', () => {
  for (const emptyDeck of [false, true]) {
    const originals = [s('7'), c('7'), d('7')];
    const state = fixture({ hand0: [h('7')], hand1: [], table: [s('7')], captured0: originals.slice(1),
      rondas: [null, { rank: '7', cardIds: originals }],
      lastPlay: { playerId: 1, cardId: s('7'), round: 1, deal: 1, fromRonda: true } });
    if (emptyDeck) { state.players[1].captured.push(...state.deck); state.deck = []; state.deal = 4; state.lastPlay.deal = 4; }
    const next = play(state);
    assert.equal(next.status, 'finished'); assert.equal(next.winner, 0);
    assert.equal(next.deal, state.deal); assert.equal(next.roundSummary, null);
    assert.equal(next.deck.length, state.deck.length);
    assert.equal(next.history.filter((item) => ['deal', 'round-end'].includes(item.kind)).length, 0);
    assert.equal(next.history.filter((item) => item.kind === 'ronda-fall').length, 1);
    assertInvariant(next);
  }
  const ordinaryWinningFall = fixture({ scores: [38, 0], table: [s('7')], lastPlay: { playerId: 1, cardId: s('7'), round: 1, deal: 1 } });
  assert.equal(legalMoves(ordinaryWinningFall, 0)[0].winsGame, true);
  assert.equal(legalMoves(ordinaryWinningFall, 0)[0].rondaFall, false);
});

test('ronda provenance clears at every deal and every card cycle', () => {
  const state = fixture({ hand0: [h('K')], hand1: [], captured0: [h('A'), s('A'), c('A')], rondas: [{ rank: 'A', cardIds: [h('A'), s('A'), c('A')] }, null] });
  const prefix = [h('2'), h('3'), h('4'), h('5'), h('6'), s('2'), s('3'), s('4'), s('5'), s('6')];
  const keep = new Set([...prefix, h('K'), h('A'), s('A'), c('A')]);
  state.deck = prefix.map(card);
  state.players[1].captured = all().filter((value) => !keep.has(value.id));
  const next = play(state);
  assert.equal(next.deal, 2); assert.equal(next.lastPlay, null); assert.deepEqual(next.rondas, [null, null]);
  const cycleEnd = ending(20, 18);
  cycleEnd.rondas = [{ rank: 'A', cardIds: [h('A'), d('A'), c('A')] }, null];
  assertInvariant(cycleEnd);
  const nextCycle = advanceRound(cycleEnd, { random: orderedRandom(prefix) });
  assert.equal(nextCycle.round, 2); assert.equal(nextCycle.lastPlay, null); assert.deepEqual(nextCycle.rondas, [null, null]);
});

test('v2 rondas at thirty and thirty-eight award two, and two winning rondas resolve only once in deal order', () => {
  const first = [h('A'), s('A'), c('A'), h('2'), h('3')];
  const second = [h('4'), s('4'), c('4'), h('5'), h('6')];
  for (const score of [30, 36, 38]) {
    const state = ending(20, 18, [score, score]);
    // New cycle rotates dealer to zero, so seat one receives the first hand.
    const next = advanceRound(state, { random: orderedRandom([...first, ...second]) });
    assert.equal(next.players[1].score, score + 2);
    assert.equal(next.players[0].score, score === 38 ? 38 : score + 2);
    assert.equal(next.winner, score === 38 ? 1 : null);
    assert.equal(next.history.filter((item) => item.kind === 'ronda-victory').length, score === 38 ? 1 : 0);
  }
  const state = ending(20, 18, [38, 38]);
  const next = advanceRound(state, { random: orderedRandom([...first, h('4'), s('4'), c('4'), d('4'), h('5')]) });
  assert.equal(next.winner, 0); assert.equal(next.lastEvent.kind, 'four-kind');
  assert.deepEqual(next.players.map((player) => player.score), [38, 38]);
});

test('legacy v1 saves retain the old ronda cap and cannot win by falling on a ronda', () => {
  for (const score of [28, 30, 38]) {
    const state = fixture({ version: 1, hand0: [h('K')], hand1: [], scores: [score, 0] });
    const prefix = [h('A'), s('A'), c('A'), h('2'), h('3'), h('4'), h('5'), h('6'), h('7'), h('J')];
    const keep = new Set([...prefix, h('K')]);
    state.deck = prefix.map(card); state.players[1].captured = all().filter((value) => !keep.has(value.id));
    const next = play(JSON.parse(JSON.stringify(state)));
    assert.equal(next.players[0].score, score === 28 ? 30 : score);
    assert.equal(next.status, 'playing'); assert.equal(next.rules.id, 'cuarenta-local-v1-combo-2');
    assert.equal(next.rondas, undefined); assert.equal(next.difficulty, undefined);
    assert.equal(publicView(next, 0).difficulty, 'medium');
  }
  const state = fixture({ version: 1, table: [s('7')], lastPlay: { playerId: 1, cardId: s('7'), round: 1, deal: 1, fromRonda: true } });
  const move = legalMoves(state, 0)[0];
  assert.equal(move.rondaFall, false); assert.equal(move.winsGame, false);
  assert.equal(play(state).status, 'playing');
});

test('ronda corruption, private metadata inconsistencies, unknown levels and stale provenance are rejected', () => {
  const prefix = [h('A'), s('A'), c('A'), h('2'), h('3')];
  const state = createGame({ dealer: 1, random: orderedRandom(prefix) });
  for (const corrupt of [
    (value) => { delete value.rondas; },
    (value) => { value.rondas[0].cardIds.pop(); },
    (value) => { value.rondas[0].cardIds[1] = value.rondas[0].cardIds[0]; },
    (value) => { value.rondas[0].cardIds[2] = d('A'); },
    (value) => { value.rondas[0].rank = 'K'; },
    (value) => { value.rondas[1] = value.rondas[0]; },
    (value) => { value.difficulty = 'superhuman'; },
    (value) => { delete value.difficulty; },
  ]) {
    const invalid = structuredClone(state); corrupt(invalid);
    assert.throws(() => assertInvariant(invalid), /Estado inválido/);
  }
  const played = play(state, legalMoves(state, 0).find((move) => move.cardId === h('A')));
  for (const corrupt of [
    value => { value.lastPlay.fromRonda = false; },
    value => { delete value.lastPlay.fromRonda; },
    value => { value.lastPlay.deal += 1; },
    value => { value.lastPlay.round += 1; },
  ]) {
    const invalid = structuredClone(played); corrupt(invalid);
    assert.throws(() => assertInvariant(invalid), /Estado inválido/);
  }
});
