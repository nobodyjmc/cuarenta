import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeck, legalMoves } from '../dist/js/engine.js';
import { createTutorialLessons, validateTutorialLessons } from '../dist/js/tutorial.js';

const byId = (lessons, id) => lessons.find((lesson) => lesson.id === id);
const correct = (lesson) => lesson.choices.find((choice) => choice.correct);

test('the tutorial is deterministic, JSON serializable, fresh on every call, and has complete exercises', () => {
  const first = createTutorialLessons();
  assert.equal(first.length, 17);
  assert.deepEqual(first, createTutorialLessons());
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.equal(validateTutorialLessons(first), true);
  assert.equal(first.filter((lesson) => lesson.type === 'play').length, 10);
  assert.equal(first.filter((lesson) => lesson.type === 'quiz').length, 7);
  const known = new Set(createDeck().map((card) => card.id));
  for (const lesson of first) {
    const ids = [...lesson.hand, ...lesson.table].map((card) => card.id);
    assert(ids.every((id) => known.has(id)));
    assert.equal(new Set(ids).size, ids.length, lesson.id);
    assert(lesson.choices.every((choice) => choice.feedback.length > 10));
    assert(lesson.choices.filter((choice) => !choice.correct).every((choice) => choice.after === undefined));
  }
  first[0].hand[0].rank = 'BROKEN';
  first[0].choices[0].after.move.captureIds.length = 0;
  assert.notDeepEqual(first, createTutorialLessons());
  assert.equal(createTutorialLessons()[0].hand[0].rank, '7');
});

test('all correct tactical selections are legal using only the visible teaching hand and table', () => {
  for (const comboPoints of [2, 4]) {
    for (const lesson of createTutorialLessons(comboPoints).filter((value) => value.type === 'play')) {
      const view = {
        status: 'playing', turn: 0, round: 1, deal: 1,
        rules: { id: `cuarenta-local-v2-combo-${comboPoints}`, comboPoints },
        players: [{ id: 0, hand: lesson.hand, score: lesson.scores[0] }], table: lesson.table,
        lastPlay: lesson.lastCardId ? { playerId: 1, cardId: lesson.lastCardId, round: 1, deal: 1 } : null,
      };
      const moves = legalMoves(view, 0);
      for (const answer of lesson.choices) {
        const move = moves.find((candidate) => candidate.cardId === answer.cardId && JSON.stringify([...candidate.captureIds].sort()) === JSON.stringify([...answer.captureIds].sort()));
        assert.equal(Boolean(move), answer.legal, `${lesson.id}: ${answer.label}`);
        if (!answer.correct) continue;
        assert(move, lesson.id);
        assert(answer.after.event.kind, lesson.id);
        assert.deepEqual(answer.after.move.captureIds.slice().sort(), answer.captureIds.slice().sort());
        assert.equal(answer.after.hand.some((card) => card.id === answer.cardId), false);
        assert.equal(answer.after.score, answer.after.scores[0]);
      }
    }
  }
});

test('capture exercises cover sums, mandatory sequence, two valid bases and legal ordinary drops', () => {
  const lessons = createTutorialLessons();
  assert.equal(correct(byId(lessons, 'igualdad')).after.move.kind, 'match');
  assert.equal(correct(byId(lessons, 'igualdad')).after.score, 0);
  assert.equal(correct(byId(lessons, 'suma')).after.move.captureIds.length, 2);
  const pairOnly = byId(lessons, 'suma-dos');
  assert.deepEqual(correct(pairOnly).after.move.captureIds, ['hearts-2', 'hearts-4']);
  const tripleSum = pairOnly.choices.find((choice) => choice.captureIds.length === 3);
  assert.equal(tripleSum.legal, false);
  assert.equal(tripleSum.correct, false);
  assert.match(tripleSum.feedback, /Elige solo dos sumandos/);
  const ladder = correct(byId(lessons, 'escalera')).after;
  assert.deepEqual(ladder.move.captureIds.map((id) => id.split('-')[1]), ['7', 'J', 'Q', 'K']);
  assert.deepEqual(ladder.table.map((card) => card.rank), ['2']);
  const bases = byId(lessons, 'elegir-base').choices.filter((choice) => choice.correct);
  assert.deepEqual(bases.map((choice) => choice.after.move.kind), ['match', 'sum']);
  assert.equal(byId(lessons, 'elegir-base').choices.find((choice) => choice.captureIds.length === 3).legal, false);
  const drop = correct(byId(lessons, 'dejar-carta'));
  assert.deepEqual(drop.captureIds, []);
  assert.equal(drop.after.move.kind, 'drop');
  assert.equal(drop.after.table.at(-1).id, drop.cardId);
  assert.equal(drop.after.score, 0);
});

test('fall, clean and configurable combo lessons preserve distinct scoring reasons', () => {
  for (const comboPoints of [2, 4]) {
    const lessons = createTutorialLessons(comboPoints);
    const fall = correct(byId(lessons, 'caida')).after;
    assert.equal(fall.move.fall, true); assert.equal(fall.move.clean, false); assert.equal(fall.score, 2);
    const clean = correct(byId(lessons, 'limpia')).after;
    assert.equal(clean.move.fall, false); assert.equal(clean.move.clean, true); assert.equal(clean.score, 2);
    const combo = correct(byId(lessons, 'caida-limpia'));
    assert.equal(combo.label, `${comboPoints} puntos`);
    assert.equal(combo.after.move.fall, true); assert.equal(combo.after.move.clean, true);
    assert.equal(combo.after.score, comboPoints);
    assert.equal(combo.after.move.points, comboPoints);
  }
});

test('ronda examples preserve private notices and reveal special victory only in their result', () => {
  const lessons = createTutorialLessons();
  const ronda = byId(lessons, 'ronda-privada');
  assert.equal(ronda.hand.filter((card) => card.rank === '5').length, 3);
  assert.equal(correct(ronda).after.score, 2);
  assert.equal(correct(ronda).after.event.kind, 'ronda');
  assert.match(ronda.explanation, /marcador sigue siendo público/);
  const fall = byId(lessons, 'caida-ronda');
  assert.equal(fall.rondas, undefined);
  assert.equal(fall.hand.some((card) => ['clubs-7', 'diamonds-7'].includes(card.id)), false);
  assert.doesNotMatch(fall.prompt, /pertenece|ronda/);
  const result = correct(fall).after;
  assert.equal(result.move.rondaFall, true); assert.equal(result.winner, 0);
  assert.equal(result.score, 2); assert.equal(result.status, 'finished');
  assert.equal(result.event.kind, 'ronda-fall');
});

test('carton, thirty-eight, four alike and final challenge reflect actual engine results', () => {
  const lessons = createTutorialLessons();
  const carton = correct(byId(lessons, 'carton')).after;
  assert.deepEqual(carton.roundSummary.captured, [21, 17]);
  assert.deepEqual(carton.roundSummary.base, [8, 0]);
  assert.deepEqual(carton.roundSummary.awarded, [2, 0]);
  assert.equal(carton.roundSummary.leftover, 2); assert.equal(carton.score, 30);
  assert.match(correct(byId(lessons, 'empate-carton')).label, /base de 2/);
  const clean38 = correct(byId(lessons, 'treinta-ocho')).after;
  assert.equal(clean38.move.clean, true); assert.equal(clean38.score, 38); assert.equal(clean38.winner, null);
  const ronda38 = correct(byId(lessons, 'ronda-cierre')).after;
  assert.equal(ronda38.score, 40); assert.equal(ronda38.winner, 0); assert.equal(ronda38.event.kind, 'ronda-victory');
  const four = correct(byId(lessons, 'cuatro-iguales')).after;
  assert.equal(four.score, 0); assert.equal(four.winner, 0); assert.equal(four.event.kind, 'four-kind');
  const final = byId(lessons, 'desafio-final');
  assert.equal(final.choices.length, 4);
  assert(final.choices.every((choice) => choice.legal));
  assert.equal(final.choices.filter((choice) => choice.correct).length, 1);
  const victory = correct(final).after;
  assert.equal(victory.score, 40); assert.equal(victory.move.fall, true); assert.equal(victory.move.rondaFall, false);
  assert.equal(victory.winner, 0); assert.equal(victory.event.kind, 'victory');
});

test('invalid variants and malformed teaching data fail explicitly', () => {
  for (const variant of [0, 3, '2', null]) assert.throws(() => createTutorialLessons(variant), /2 o 4/);
  assert.throws(() => validateTutorialLessons([]), /vacías/);
  for (const mutate of [
    (lessons) => { lessons[1].id = lessons[0].id; },
    (lessons) => { lessons[0].choices.forEach((choice) => { choice.correct = false; }); },
    (lessons) => { lessons[0].choices[0].captureIds = ['not-a-card']; },
    (lessons) => { lessons[0].choices[0].captureIds.push(lessons[0].choices[0].captureIds[0]); },
    (lessons) => { delete lessons[0].choices[0].after; },
  ]) {
    const lessons = createTutorialLessons(); mutate(lessons);
    assert.throws(() => validateTutorialLessons(lessons));
  }
});
