import { createGame, applyMove, advanceRound, publicView, assertInvariant } from './engine.js';
import { TABLE_CITIES } from './table-art.js';

const SAVE_KEY = 'cuarenta.local.game.v1';
const PREFS_KEY = 'cuarenta.local.preferences.v1';
const DEFAULT_FELT_THEME = 'quito';
const DEFAULT_TABLE_CITY = 'quito';
const TABLE_CITY_IDS = new Set(TABLE_CITIES.map(({ id }) => id));
const DEFAULT_MUSIC_VOLUME = .32;
const DEFAULT_MUSIC_TRACK = 'juramento';
const MUSIC_TRACK_IDS = [DEFAULT_MUSIC_TRACK, 'reminiscencias'];

const FELT_SWATCHES = {
  quito: '#2c6a54',
  borgona: '#87394f',
  azul: '#1555a6',
  carbon: '#565862',
  violeta: '#63478d',
  cobre: '#834829',
  oceano: '#216a75',
  oliva: '#61632b',
};
export const FELT_THEMES = Object.freeze(Object.keys(FELT_SWATCHES));

// Convert the former custom color to one of the current presets on load.
function resolveFeltTheme(theme, color) {
  if (FELT_THEMES.includes(theme)) return theme;
  if (theme !== 'custom' || typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color) || color.length !== 7) {
    return DEFAULT_FELT_THEME;
  }
  const channels = hex => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const rgb = channels(color);
  if (Math.max(...rgb) - Math.min(...rgb) < 16) return 'carbon';

  let nearest = DEFAULT_FELT_THEME;
  let shortestDistance = Infinity;
  for (const [preset, swatch] of Object.entries(FELT_SWATCHES)) {
    const distance = channels(swatch).reduce((sum, channel, i) => sum + (channel - rgb[i]) ** 2, 0);
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearest = preset;
    }
  }
  return nearest;
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
    tableCity: DEFAULT_TABLE_CITY,
  };
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(PREFS_KEY) || '{}');
    const feedbackChallenge = Number.isInteger(saved.feedbackChallenge) ? Math.max(-3, Math.min(3, saved.feedbackChallenge)) : 0;
    return {
      sound: saved.sound === true,
      music: saved.music === true,
      musicVolume: Number.isFinite(saved.musicVolume) ? Math.max(0, Math.min(1, saved.musicVolume)) : DEFAULT_MUSIC_VOLUME,
      musicTrack: saved.musicTrack === 'patio' ? 'reminiscencias' :
        MUSIC_TRACK_IDS.includes(saved.musicTrack) ? saved.musicTrack : DEFAULT_MUSIC_TRACK,
      reducedMotion: saved.reducedMotion === true,
      quickBot: saved.quickBot === true,
      feedbackMode: saved.feedbackMode === undefined ? true : saved.feedbackMode === true,
      feedbackChallenge,
      tableLayout: saved.tableLayout === 'vertical' ? 'vertical' : 'horizontal',
      feltTheme: resolveFeltTheme(saved.feltTheme, saved.feltColor),
      tableCity: TABLE_CITY_IDS.has(saved.tableCity) ? saved.tableCity : DEFAULT_TABLE_CITY,
    };
  } catch { return fallback; }
}

export function savePreferences(preferences, storage) {
  try { (storage ?? globalThis.localStorage).setItem(PREFS_KEY, JSON.stringify(preferences)); return true; }
  catch { return false; }
}
