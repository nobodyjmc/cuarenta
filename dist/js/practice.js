import { chooseBotMove } from './bot.js';
import { createGame, legalMoves, publicView } from './engine.js';

// The opening and the replayable Easy replies let a player following the hints
// see a match, 2 + 4 with a 6, two valid bases for the same card, ronda, limpia,
// ladder and caída over four deals. Any other legal play can change the lesson.
const PRACTICE_SEED = 2617;

function seededRandom(seed) {
  let cursor = seed;
  return () => {
    cursor = (Math.imul(1664525, cursor) + 1013904223) >>> 0;
    return cursor / 0x100000000;
  };
}

export function createPracticeGame(comboPoints = 2) {
  const random = seededRandom(PRACTICE_SEED);
  // Reserve one random draw for the engine's fallback ID without using it to
  // shuffle. That keeps the cards identical even in browsers without randomUUID.
  let needsId = !globalThis.crypto?.randomUUID;
  random();
  return createGame({
    difficulty: 'easy', dealer: 1, comboPoints,
    random: () => {
      if (!needsId) return random();
      needsId = false;
      return Math.random();
    },
  });
}

export function choosePracticeReply(state) {
  const view = publicView(state, 1);
  const random = seededRandom(Math.imul(0x9e3779b9, view.revision));
  const command = chooseBotMove(view, { random });
  if (!command) return null;
  return legalMoves(view, 1).find((move) => move.cardId === command.cardId &&
    move.captureIds.length === command.captureIds.length &&
    move.captureIds.every((id) => command.captureIds.includes(id))) ?? null;
}

function hintValue(move) {
  // Value immediate points, then cards toward cartón. For equal captures, show
  // the simpler matching base first.
  return Number(move.winsGame) * 100 + move.points * 10 + move.captureIds.length +
    Number(move.kind === 'match') * 0.1;
}

export function practiceHint(state) {
  const moves = legalMoves(publicView(state, 0), 0);
  return moves.reduce((best, move) => !best || hintValue(move) > hintValue(best) ? move : best, null);
}
