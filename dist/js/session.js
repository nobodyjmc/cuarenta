import { createGame, applyMove, advanceRound, publicView, assertInvariant } from './engine.js';

const SAVE_KEY = 'cuarenta.local.game.v1';
const PREFS_KEY = 'cuarenta.local.preferences.v1';
const DEFAULT_FELT_THEME = 'quito';
const DEFAULT_FELT_COLOR = '#287458';
const DEFAULT_MUSIC_VOLUME = .32;
const DEFAULT_MUSIC_TRACK = 'faroles';
export const LOCAL_MUSIC_TRACK = 'local';
const MUSIC_TRACK_IDS = [DEFAULT_MUSIC_TRACK, 'patio', LOCAL_MUSIC_TRACK];

export const FELT_THEMES = Object.freeze(['quito', 'borgona', 'azul', 'carbon', 'custom']);

export function normalizeFeltColor(value) {
  return typeof value === 'string' && value.length === 7 && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : DEFAULT_FELT_COLOR;
}

function validateSavedState(state) {
  assertInvariant(state);
  const reject = () => { throw new Error('Partida guardada incoherente'); };
  if (!state.players.every(p => typeof p.name === 'string' && p.name.length <= 20)) reject();
  if (state.deck.length !== (4 - state.deal) * 10) reject();
  const hands = state.players.map(p => p.hand.length);
  if (state.status === 'playing') {
    if (state.discarded.length || state.roundSummary !== null || state.players.some(p => p.score >= 40)) reject();
    if (hands[0] !== hands[1] && hands[state.turn] !== hands[1 - state.turn] + 1) reject();
  }
  const validEvent = item => item && typeof item.id === 'string' && typeof item.text === 'string' && item.text.length < 500 && typeof item.kind === 'string';
  if (!state.history.every(validEvent)) reject();
  if (state.lastEvent !== null && (!state.lastEvent || typeof state.lastEvent.text !== 'string' || typeof state.lastEvent.kind !== 'string')) reject();
  if (state.status === 'round-end') {
    const summary = state.roundSummary;
    for (const key of ['captured', 'base', 'awarded']) {
      if (!Array.isArray(summary[key]) || summary[key].length !== 2 || summary[key].some(n => !Number.isInteger(n) || n < 0 || n > 40)) reject();
    }
    if (summary.leftover !== state.discarded.length || summary.captured.some((n, i) => n !== state.players[i].captured.length)) reject();
  }
}

export class LocalSession {
  #state = null;
  #storage;
  warning = '';

  constructor(storage) {
    try { this.#storage = storage ?? globalThis.localStorage; }
    catch { this.warning = 'El navegador no permite guardar. Puedes jugar, pero la partida se perderá al cerrar.'; }
    try {
      const saved = this.#storage?.getItem(SAVE_KEY);
      if (saved) {
        const envelope = JSON.parse(saved);
        if (envelope.format !== 1 || !envelope.state || !['solo', 'pass'].includes(envelope.state.mode)) throw new Error('Formato no compatible');
        validateSavedState(envelope.state);
        this.#state = envelope.state;
      }
    } catch {
      this.warning = 'La partida guardada no se pudo recuperar. Puedes iniciar una nueva.';
    }
  }

  get hasGame() { return this.#state !== null; }
  get revision() { return this.#state?.revision ?? -1; }

  view(playerId = 0) {
    return this.#state ? publicView(this.#state, playerId) : null;
  }

  dispatch(command) {
    let next;
    if (command.type === 'NEW_GAME') next = createGame(command.options);
    else if (!this.#state) throw new Error('Primero debes iniciar una partida.');
    else if (command.type === 'PLAY') next = applyMove(this.#state, command.move);
    else if (command.type === 'NEXT_ROUND') next = advanceRound(this.#state);
    else throw new Error('Acción no reconocida.');
    assertInvariant(next);
    this.#state = next;
    try {
      if (!this.#storage) throw new Error('Sin almacenamiento');
      this.#storage.setItem(SAVE_KEY, JSON.stringify({ format: 1, savedAt: Date.now(), state: next }));
      this.warning = '';
    } catch {
      this.warning = 'La partida continúa, pero no se pudo guardar. Mantén esta ventana abierta.';
    }
    return this.view(0);
  }
}

export function loadPreferences(storage) {
  const fallback = {
    sound: false,
    music: false,
    musicVolume: DEFAULT_MUSIC_VOLUME,
    musicTrack: DEFAULT_MUSIC_TRACK,
    reducedMotion: false,
    quickBot: false,
    feedbackMode: true,
    feedbackChallenge: 0,
    tableLayout: 'horizontal',
    feltTheme: DEFAULT_FELT_THEME,
    feltColor: DEFAULT_FELT_COLOR,
  };
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(PREFS_KEY) || '{}');
    const feedbackChallenge = Number.isInteger(saved.feedbackChallenge) ? Math.max(-3, Math.min(3, saved.feedbackChallenge)) : 0;
    return {
      sound: saved.sound === true,
      music: saved.music === true,
      musicVolume: Number.isFinite(saved.musicVolume) ? Math.max(0, Math.min(1, saved.musicVolume)) : DEFAULT_MUSIC_VOLUME,
      musicTrack: MUSIC_TRACK_IDS.includes(saved.musicTrack) ? saved.musicTrack : DEFAULT_MUSIC_TRACK,
      reducedMotion: saved.reducedMotion === true,
      quickBot: saved.quickBot === true,
      feedbackMode: saved.feedbackMode === undefined ? true : saved.feedbackMode === true,
      feedbackChallenge,
      tableLayout: saved.tableLayout === 'vertical' ? 'vertical' : 'horizontal',
      feltTheme: FELT_THEMES.includes(saved.feltTheme) ? saved.feltTheme : DEFAULT_FELT_THEME,
      feltColor: normalizeFeltColor(saved.feltColor),
    };
  } catch { return fallback; }
}

export function savePreferences(preferences, storage) {
  try { (storage ?? globalThis.localStorage).setItem(PREFS_KEY, JSON.stringify(preferences)); return true; }
  catch { return false; }
}
