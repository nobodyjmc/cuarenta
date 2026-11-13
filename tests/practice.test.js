import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, assertInvariant, legalMoves, publicView } from '../dist/js/engine.js';
import { choosePracticeReply, createPracticeGame, practiceHint } from '../dist/js/practice.js';

function play(state, move) {
  assert(legalMoves(state, state.turn).some((legal) => legal.cardId === move.cardId &&
    legal.captureIds.length === move.captureIds.length &&
    legal.captureIds.every((id) => move.captureIds.includes(id))));
  const next = applyMove(state, { ...move, playerId: state.turn, expectedRevision: state.revision });
  assert.equal(next.revision, state.revision + 1);
  assertInvariant(next);
  return next;
}

function suggestedMove(state) {
  return state.turn === 0 ? practiceHint(state) : choosePracticeReply(state);
}

for (const comboPoints of [2, 4]) {
  test(`guided Easy play completes all four deals with the ${comboPoints}-point profile`, () => {
    let state = createPracticeGame(comboPoints);
    assert.equal(state.turn, 0);
    assert.equal(state.rules.comboPoints, comboPoints);
    assert.equal(state.difficulty, 'easy');
    assert.deepEqual(state.players.map((player) => player.hand.length), [5, 5]);
    assert.equal(state.deck.length, 30);

    const deals = new Set();
    const examples = new Set();
    for (let turn = 0; turn < 40 && state.status === 'playing'; turn += 1) {
      deals.add(state.deal);
      const move = suggestedMove(state);
      assert.deepEqual(move, suggestedMove(state));
      assert.equal(state.turn === 0 ? choosePracticeReply(state) : practiceHint(state), null);
      if (state.turn === 0) {
        const view = publicView(state, 0);
        const ranks = move.captureIds.map((id) => view.table.find((card) => card.id === id).rank);
        if (move.kind === 'drop') examples.add('drop');
        if (move.kind === 'match' && !move.fall && !move.clean && ranks.length === 1) examples.add('match');
        if (move.kind === 'sum' && ranks.slice(0, 2).sort().join(',') === '2,4') {
          assert.equal(view.players[0].hand.find((card) => card.id === move.cardId).rank, '6');
          const alternatives = legalMoves(view, 0).filter((candidate) => candidate.cardId === move.cardId);
          assert(alternatives.some((candidate) => candidate.kind === 'match'));
          examples.add('sum');
        }
        if (ranks.length > (move.kind === 'sum' ? 2 : 1)) examples.add('ladder');
        if (move.fall && !move.clean) examples.add('fall');
        if (move.clean && !move.fall) examples.add('clean');
        if (view.rondas[0]) {
          assert.equal(view.rondas[0].cardIds.length, 3);
          assert(view.history.some((entry) => entry.kind === 'ronda' && entry.playerId === 0 && entry.points === 2));
          examples.add('ronda');
        }
      }
      state = play(state, move);
    }

    assert.deepEqual(deals, new Set([1, 2, 3, 4]));
    assert.deepEqual(examples, new Set(['drop', 'match', 'sum', 'ladder', 'fall', 'clean', 'ronda']));
    assert.equal(state.status, 'round-end');
    assert.equal(state.revision, 40);
    const { captured, leftover } = state.roundSummary;
    assert.equal(captured[0] + captured[1] + leftover, 40);
    assert.equal(practiceHint(state), null);
    assert.equal(choosePracticeReply(state), null);
  });
}

test('another legal base changes the table and still lets both players continue', () => {
  let state = createPracticeGame();
  while (state.revision < 6) state = play(state, suggestedMove(state));
  const hint = practiceHint(state);
  assert.equal(hint.kind, 'sum');
  const match = legalMoves(state, 0).find((move) => move.cardId === hint.cardId && move.kind === 'match');
  const suggested = play(state, hint);
  const alternative = play(state, match);
  assert.notDeepEqual(alternative.table, suggested.table);
  assert.equal(alternative.turn, 1);
  state = play(alternative, choosePracticeReply(alternative));
  assert.equal(state.turn, 0);
  while (state.status === 'playing') state = play(state, suggestedMove(state));
  assert.equal(state.status, 'round-end');
  assert.equal(state.revision, 40);
});

test('replaying deals the same cards into a fresh game without changing another match', () => {
  const first = createPracticeGame();
  const original = structuredClone(first);
  const next = play(first, practiceHint(first));
  const replay = createPracticeGame();
  assert.deepEqual(first, original);
  assert.deepEqual(replay.deck, original.deck);
  assert.deepEqual(replay.players, original.players);
  assert.notEqual(replay.id, first.id);
  assert.equal(replay.revision, 0);
  assert.equal(next.revision, 1);
});

test('the practice deck does not depend on browser UUID support', () => {
  const expected = createPracticeGame();
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  try {
    const fallback = createPracticeGame();
    assert.deepEqual(fallback.deck, expected.deck);
    assert.deepEqual(fallback.players, expected.players);
    assert.notEqual(createPracticeGame().id, fallback.id);
  } finally {
    if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
    else delete globalThis.crypto;
  }
});
