import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalSession, loadPreferences, savePreferences } from '../dist/js/session.js';
import { chooseBotMove } from '../dist/js/bot.js';
import { createDeck } from '../dist/js/engine.js';

const SAVE = 'cuarenta.local.game.v1';
const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
function start(storage) {
  const session = new LocalSession(storage);
  session.dispatch({ type: 'NEW_GAME', options: { dealer: 1, mode: 'pass', names: ['Joel', 'Invitado'], random: () => .99 } });
  return session;
}

test('a saved session restores every accepted move, a complete cycle and the next deal', () => {
  const storage = memoryStorage();
  let session = start(storage);
  let actions = 0;
  while (session.view().status === 'playing') {
    const id = session.view().turn;
    session.dispatch({ type: 'PLAY', move: chooseBotMove(session.view(id)) });
    const expected = session.view(id);
    session = new LocalSession(storage);
    assert.deepEqual(session.view(id), expected);
    assert.equal(session.warning, '');
    assert(++actions <= 40);
  }
  assert.equal(actions, 40);
  assert.equal(session.view().status, 'round-end');
  session.dispatch({ type: 'NEXT_ROUND' });
  const restored = new LocalSession(storage);
  assert.deepEqual(restored.view(), session.view());
  assert.equal(restored.view().round, 2);
});

test('stale duplicate commands do not change the game or its persisted revision', () => {
  const storage = memoryStorage();
  const session = start(storage);
  const command = { type: 'PLAY', move: chooseBotMove(session.view(0)) };
  session.dispatch(command);
  const saved = storage.getItem(SAVE);
  assert.throws(() => session.dispatch(command), /estado cambió/);
  assert.equal(session.revision, 1);
  assert.equal(storage.getItem(SAVE), saved);
});

test('damaged, unsupported and internally inconsistent saves are rejected safely', () => {
  const storage = memoryStorage();
  start(storage);
  const original = storage.getItem(SAVE);
  const alterations = [
    () => '{broken',
    e => { e.format = 99; },
    e => { e.state.players[0].hand[0] = e.state.players[1].hand[0]; },
    e => { e.state.deal = 2; },
    e => { e.state.players[0].name = 'x'.repeat(21); },
    e => { e.state.history[0].text = {}; },
    e => { e.state.lastEvent = { kind: 'deal', text: {} }; },
    e => { e.state.rules.comboPoints = 10; },
  ];
  for (const alter of alterations) {
    const envelope = JSON.parse(original);
    const value = alter(envelope);
    storage.setItem(SAVE, value ?? JSON.stringify(envelope));
    const recovered = new LocalSession(storage);
    assert.equal(recovered.hasGame, false);
    assert.match(recovered.warning, /no se pudo recuperar/);
  }
});

test('storage failure does not interrupt a match and private projections stay detached', () => {
  const blocked = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } };
  const session = start(blocked);
  assert.equal(session.hasGame, true);
  assert.match(session.warning, /no se pudo guardar/);
  const view = session.view(0);
  assert.equal(view.players[1].hand, null);
  assert.equal(view.deck, undefined);
  view.players[0].score = 40;
  assert.equal(session.view(0).players[0].score, 0);
  session.dispatch({ type: 'PLAY', move: chooseBotMove(session.view(0)) });
  assert.equal(session.revision, 1);
});

test('preferences accept booleans only, clamp local bot feedback, and tolerate unavailable storage', () => {
  const storage = memoryStorage();
  assert.equal(savePreferences({ sound: true, reducedMotion: true, quickBot: 'true', feedbackMode: 'false', feedbackChallenge: '3', tableLayout: 'diagonal' }, storage), true);
  assert.deepEqual(loadPreferences(storage), {
    sound: true, reducedMotion: true, quickBot: false, feedbackMode: false,
    feedbackChallenge: 0, tableLayout: 'horizontal', feltTheme: 'quito', feltColor: '#287458',
    music: false, musicVolume: .32, musicTrack: 'faroles',
  });
  assert.equal(savePreferences({ feedbackMode: true, feedbackChallenge: 9, tableLayout: 'vertical' }, storage), true);
  assert.deepEqual(loadPreferences(storage), {
    sound: false, reducedMotion: false, quickBot: false, feedbackMode: true,
    feedbackChallenge: 3, tableLayout: 'vertical', feltTheme: 'quito', feltColor: '#287458',
    music: false, musicVolume: .32, musicTrack: 'faroles',
  });
  assert.equal(savePreferences({}, { setItem() { throw Error('blocked'); } }), false);
  assert.deepEqual(loadPreferences({ getItem() { throw Error('blocked'); } }), {
    sound: false, reducedMotion: false, quickBot: false, feedbackMode: true,
    feedbackChallenge: 0, tableLayout: 'horizontal', feltTheme: 'quito', feltColor: '#287458',
    music: false, musicVolume: .32, musicTrack: 'faroles',
  });
});

test('music preferences restore an enabled track independently of sound effects and validate volume', () => {
  const storage = memoryStorage();
  assert.equal(savePreferences({ sound: false, music: true, musicVolume: 0, musicTrack: 'patio' }, storage), true);
  const quietMusic = loadPreferences(storage);
  assert.equal(quietMusic.sound, false);
  assert.equal(quietMusic.music, true);
  assert.equal(quietMusic.musicVolume, 0);
  assert.equal(quietMusic.musicTrack, 'patio');
  assert.equal(savePreferences({ ...quietMusic, musicTrack: 'local' }, storage), true);
  assert.equal(loadPreferences(storage).musicTrack, 'local');

  assert.equal(savePreferences({ ...quietMusic, musicVolume: 1.5 }, storage), true);
  assert.equal(loadPreferences(storage).musicVolume, 1);
  assert.equal(savePreferences({ ...quietMusic, musicVolume: -.2 }, storage), true);
  assert.equal(loadPreferences(storage).musicVolume, 0);

  assert.equal(savePreferences({ music: 'true', musicVolume: '.8', musicTrack: 'unknown' }, storage), true);
  const invalid = loadPreferences(storage);
  assert.equal(invalid.music, false);
  assert.equal(invalid.musicVolume, .32);
  assert.equal(invalid.musicTrack, 'faroles');
});

test('felt preferences preserve a custom color through preset changes and reject invalid values', () => {
  const storage = memoryStorage();
  assert.equal(savePreferences({ feltTheme: 'custom', feltColor: '#B06AEF' }, storage), true);
  const custom = loadPreferences(storage);
  assert.equal(custom.feltTheme, 'custom');
  assert.equal(custom.feltColor, '#b06aef');

  assert.equal(savePreferences({ ...custom, feltTheme: 'borgona' }, storage), true);
  const preset = loadPreferences(storage);
  assert.equal(preset.feltTheme, 'borgona');
  assert.equal(preset.feltColor, '#b06aef');

  assert.equal(savePreferences({ feltTheme: 'unknown', feltColor: 'var(--custom)' }, storage), true);
  const invalid = loadPreferences(storage);
  assert.equal(invalid.feltTheme, 'quito');
  assert.equal(invalid.feltColor, '#287458');
});

function roundRandom() {
  const first = ['hearts-5', 'clubs-5', 'diamonds-5', 'hearts-7', 'hearts-Q', 'spades-5', 'hearts-2', 'hearts-3', 'hearts-4', 'hearts-6'];
  const deck = createDeck().map(c => c.id);
  const desired = [...first, ...deck.filter(id => !first.includes(id))];
  const draws = [];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = deck.indexOf(desired[i]);
    draws.push((j + 0.1) / (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return () => draws.length ? draws.shift() : .99;
}

test('ronda and immediate-victory provenance survive closing and restoring a session', () => {
  const storage = memoryStorage();
  let session = new LocalSession(storage);
  session.dispatch({ type: 'NEW_GAME', options: { dealer: 1, mode: 'pass', names: ['Ana', 'Beto'], random: roundRandom(), difficulty: 'hard' } });
  assert.equal(session.view(0).players[0].score, 2);
  assert.equal(session.view(0).rondas[0].cardIds.length, 3);
  session.dispatch({ type: 'PLAY', move: { playerId: 0, cardId: 'hearts-5', captureIds: [], expectedRevision: 0 } });
  session = new LocalSession(storage);
  assert.equal(session.view(1).difficulty, 'hard');
  assert.equal(session.view(0).lastPlay.fromRonda, true);
  assert.equal(session.view(1).lastPlay.fromRonda, undefined);
  assert.equal(session.view(1).rondas[0], null);
  session.dispatch({ type: 'PLAY', move: { playerId: 1, cardId: 'spades-5', captureIds: ['hearts-5'], expectedRevision: 1 } });
  const restored = new LocalSession(storage);
  assert.equal(restored.view().status, 'finished');
  assert.equal(restored.view().winner, 1);
  assert.equal(restored.view().lastEvent.kind, 'ronda-fall');
  assert(restored.view().players[1].score < 40);
});

test('old saves keep the v1 rule profile and receive the default medium difficulty', () => {
  const storage = memoryStorage();
  const session = start(storage);
  const saved = JSON.parse(storage.getItem(SAVE));
  saved.state.rules.id = 'cuarenta-local-v1-combo-2';
  delete saved.state.rondas;
  delete saved.state.difficulty;
  storage.setItem(SAVE, JSON.stringify(saved));
  const restored = new LocalSession(storage);
  assert(restored.hasGame);
  assert.equal(restored.view().rules.id, 'cuarenta-local-v1-combo-2');
  assert.equal(restored.view().difficulty, 'medium');
  restored.dispatch({ type: 'PLAY', move: chooseBotMove(restored.view(restored.view().turn)) });
  assert.equal(restored.revision, session.revision + 1);
  assert.equal(restored.view().rules.id, 'cuarenta-local-v1-combo-2');
});

test('difficulty is persisted and unrecognized saved levels are rejected', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const storage = memoryStorage();
    const session = new LocalSession(storage);
    session.dispatch({ type: 'NEW_GAME', options: { difficulty } });
    assert.equal(new LocalSession(storage).view().difficulty, difficulty);
    const saved = JSON.parse(storage.getItem(SAVE));
    saved.state.difficulty = 'superpower';
    storage.setItem(SAVE, JSON.stringify(saved));
    assert.equal(new LocalSession(storage).hasGame, false);
  }
});
