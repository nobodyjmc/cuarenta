import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createDeck, createGame, legalMoves, publicView, applyMove, advanceRound, assertInvariant } from '../dist/js/engine.js';
import { chooseBotMove } from '../dist/js/bot.js';

const cards = createDeck();
const card = (id) => ({ ...cards.find((value) => value.id === id) });
function fixture({ hand = ['hearts-K', 'hearts-Q'], table = [], scores = [0, 0], difficulty = 'medium', lastPlay = null, ronda = null, seat = 0 } = {}) {
  return {
    currentPlayerId: seat, turn: seat, status: 'playing', revision: 7, round: 1, deal: 1,
    rules: { id: 'cuarenta-local-v2-combo-2', comboPoints: 2 }, difficulty,
    players: [0, 1].map((id) => ({ id, score: scores[id], hand: id === seat ? hand.map(card) : null, handCount: 5 })),
    table: table.map(card), lastPlay, rondas: seat === 0 ? [ronda, null] : [null, ronda],
  };
}
function rng(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function assertLegal(view, command) {
  assert.equal(command.playerId, view.currentPlayerId);
  assert.equal(command.expectedRevision, view.revision);
  assert(legalMoves(view, view.currentPlayerId).some((move) => move.cardId === command.cardId && JSON.stringify(move.captureIds) === JSON.stringify(command.captureIds)));
}

test('easy selects legal options with an injectable random source and repeatable seed', () => {
  const view = fixture({ difficulty: 'easy', hand: ['hearts-4', 'hearts-K'], table: ['spades-4', 'hearts-A', 'hearts-3'] });
  const moves = legalMoves(view, 0);
  assert.equal(moves.length, 3);
  assert.deepEqual(chooseBotMove(view, { random: () => 0 }).captureIds, ['spades-4']);
  assert.deepEqual(chooseBotMove(view, { random: () => 0.5 }).captureIds, ['hearts-A', 'hearts-3']);
  assert.equal(chooseBotMove(view, { random: () => 0.999 }).cardId, 'hearts-K');
  const first = rng(421), second = rng(421);
  for (let index = 0; index < 30; index += 1) {
    const move = chooseBotMove(view, { random: first });
    assert.deepEqual(move, chooseBotMove(view, { random: second }));
    assertLegal(view, move);
  }
  for (const value of [-1, 1, NaN, Infinity]) assert.throws(() => chooseBotMove(view, { random: () => value }), /azar/);
});

test('medium is the backwards-compatible default and prioritizes reaching forty', () => {
  const view = fixture({ hand: ['hearts-K', 'hearts-4'], table: ['spades-4', 'spades-K'], scores: [38, 0], lastPlay: { playerId: 1, cardId: 'spades-4', round: 1, deal: 1, fromRonda: false } });
  const chosen = chooseBotMove(view);
  assert.equal(chosen.cardId, 'hearts-4');
  assertLegal(view, chosen);
  delete view.difficulty;
  assert.deepEqual(chooseBotMove(view), chosen);
});

test('medium and hard take a caída a ronda even below forty points', () => {
  const view = fixture({ hand: ['hearts-K', 'hearts-7'], table: ['spades-7', 'spades-K'], lastPlay: { playerId: 1, cardId: 'spades-7', round: 1, deal: 1, fromRonda: true } });
  assert.equal(legalMoves(view, 0).find((move) => move.cardId === 'hearts-7').winsGame, true);
  for (const difficulty of ['medium', 'hard']) {
    view.difficulty = difficulty;
    assert.equal(chooseBotMove(view).cardId, 'hearts-7');
  }
});

test('expert remains legal at each feedback calibration bound', () => {
  const view = fixture({ difficulty: 'expert', hand: ['hearts-4', 'hearts-K'], table: ['spades-4', 'hearts-A', 'hearts-3'] });
  for (const feedbackChallenge of [-99, -3, 0, 3, 99]) {
    const before = JSON.stringify(view);
    const chosen = chooseBotMove(view, { feedbackChallenge });
    assertLegal(view, chosen);
    assert.equal(JSON.stringify(view), before);
  }
});

test('hard considers replies to the remaining table rather than only immediate capture size', () => {
  const view = fixture({
    hand: ['hearts-2', 'clubs-K', 'diamonds-J', 'diamonds-5', 'hearts-6'],
    table: ['spades-J', 'diamonds-2', 'spades-Q', 'hearts-J', 'spades-2', 'hearts-4'], scores: [10, 10],
  });
  const medium = chooseBotMove(view);
  view.difficulty = 'hard';
  const hard = chooseBotMove(view);
  assert.equal(medium.cardId, 'diamonds-J');
  assert.equal(hard.cardId, 'hearts-6');
  assert.deepEqual(hard.captureIds, ['diamonds-2', 'hearts-4']);
  assert.equal(medium.captureIds.length, hard.captureIds.length);
  assertLegal(view, hard);
});

test('hard protects a ronda from a possible immediate losing fall, at either seat', () => {
  const ronda = { rank: '7', cardIds: ['hearts-7', 'clubs-7', 'diamonds-7'] };
  for (const seat of [0, 1]) {
    const view = fixture({ hand: [...ronda.cardIds, 'hearts-K', 'hearts-Q'], ronda, seat });
    assert(ronda.cardIds.includes(chooseBotMove(view).cardId));
    view.difficulty = 'hard';
    assert(!ronda.cardIds.includes(chooseBotMove(view).cardId));
    // If the fourth copy is visible, there is no unknown card that can cause
    // that falling loss; the bot may safely capture with its ronda instead.
    view.table = [card('spades-7')];
    assert(ronda.cardIds.includes(chooseBotMove(view).cardId));
  }
});

test('all levels are pure and ignore hidden deck, opponent hand, and opponent ronda', () => {
  for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
    const view = fixture({ difficulty, hand: ['hearts-4', 'hearts-K'], table: ['spades-4', 'hearts-A', 'hearts-3'] });
    const original = structuredClone(view);
    const secret = () => { throw new Error('The bot tried to read a secret.'); };
    Object.defineProperty(view, 'deck', { get: secret });
    Object.defineProperty(view.players[1], 'hand', { get: secret });
    Object.defineProperty(view.rondas, 1, { get: secret });
    Object.defineProperty(view, 'history', { get: secret });
    const chosen = chooseBotMove(view, { random: () => 0 });
    assertLegal(view, chosen);
    assert.deepEqual(view.table, original.table);
    assert.deepEqual(view.players[0], original.players[0]);
    assert.equal(view.revision, original.revision);
    chosen.captureIds.push('not-a-card');
    assert.deepEqual(view.table, original.table);
  }
});

test('no command is produced outside the bot turn or without a playable hand', () => {
  const view = fixture();
  for (const patch of [{ currentPlayerId: 2 }, { turn: 1 }, { status: 'finished' }, { status: 'round-end' }]) assert.equal(chooseBotMove({ ...view, ...patch }), null);
  view.players[0].hand = [];
  assert.equal(chooseBotMove(view), null);
});

test('every difficulty completes real matches with legal commands and responsive decisions', () => {
  let decisions = 0;
  let slowest = 0;
  for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
    const random = rng(198);
    for (let game = 0; game < 4; game += 1) {
      let state = createGame({ difficulty, dealer: 1, random });
      for (let step = 0; state.status !== 'finished'; step += 1) {
        assert(step < 4000, 'The match must terminate.');
        if (state.status === 'round-end') { state = advanceRound(state, { random }); continue; }
        const view = publicView(state, state.turn);
        const before = JSON.stringify(view);
        const started = performance.now();
        const command = chooseBotMove(view, { random });
        slowest = Math.max(slowest, performance.now() - started);
        assertLegal(view, command);
        assert.equal(JSON.stringify(view), before);
        state = applyMove(state, command);
        assertInvariant(state);
        decisions += 1;
      }
      assert([0, 1].includes(state.winner));
    }
  }
  assert(decisions > 200);
  assert(slowest < 1000, `One bot decision took ${slowest.toFixed(0)} ms.`);
});
