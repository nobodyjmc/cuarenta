const MAX_BYTES = 20 * 1024 * 1024;
const AUDIO_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/vnd.wave',
]);
const AUDIO_EXTENSION = /\.(mp3|m4a|wav)$/i;
const STORAGE_NAME = 'cuarenta-local-music';
const STORE_NAME = 'tracks';
const TRACK_KEY = 'local';

function isAudioFile(file) {
  return file instanceof Blob && file.size > 0 && file.size <= MAX_BYTES &&
    (AUDIO_TYPES.has(file.type.toLowerCase()) || AUDIO_EXTENSION.test(file.name ?? ''));
}

export class LocalMusic {
  #getContext;
  #file = null;
  #audio = null;
  #url = null;
  #context = null;
  #source = null;
  #gain = null;
  #volume = .35;
  #request = 0;

  constructor({ getContext } = {}) {
    this.#getContext = getContext;
  }

  get file() {
    return this.#file;
  }

  get isPlaying() {
    return Boolean(this.#audio && !this.#audio.paused && !this.#audio.ended &&
      (!this.#context || this.#context.state === 'running'));
  }

  load(file) {
    if (!isAudioFile(file)) return false;
    let audio;
    let url;
    try {
      audio = new Audio();
      url = URL.createObjectURL(file);
      audio.loop = true;
      audio.preload = 'metadata';
      audio.src = url;
    } catch {
      if (url) URL.revokeObjectURL(url);
      return false;
    }
    this.clear();
    this.#file = file;
    this.#audio = audio;
    this.#url = url;
    this.setVolume(this.#volume);
    return true;
  }

  async start({ volume = this.#volume } = {}) {
    const audio = this.#audio;
    if (!audio) return false;
    const request = ++this.#request;
    this.#connectGain();
    this.setVolume(volume);
    try {
      // Invoke both APIs within the gesture that started playback.
      const context = this.#context;
      const resume = context && context.state !== 'running'
        ? Promise.resolve(context.resume()).catch(() => {}) : undefined;
      await Promise.all([audio.play(), resume]);
      if (request !== this.#request) return false;
      if (this.isPlaying) return true;
    } catch {
      // A codec error or denied gesture must not interrupt the game.
    }
    if (request === this.#request) audio.pause();
    return false;
  }

  pause() {
    this.#request += 1;
    this.#audio?.pause();
  }

  setVolume(volume) {
    if (!Number.isFinite(volume)) return;
    this.#volume = Math.max(0, Math.min(1, volume));
    if (this.#gain) {
      const now = this.#context.currentTime;
      this.#gain.gain.cancelScheduledValues(now);
      this.#gain.gain.setTargetAtTime(this.#volume, now, .035);
    } else if (this.#audio) {
      this.#audio.muted = this.#volume === 0;
      this.#audio.volume = this.#volume;
    }
  }

  clear() {
    this.pause();
    this.#source?.disconnect();
    this.#gain?.disconnect();
    if (this.#audio) {
      this.#audio.removeAttribute('src');
      this.#audio.load();
    }
    if (this.#url) URL.revokeObjectURL(this.#url);
    this.#file = null;
    this.#audio = null;
    this.#url = null;
    this.#context = null;
    this.#source = null;
    this.#gain = null;
  }

  #connectGain() {
    if (this.#gain) return;
    let gain;
    try {
      const context = this.#getContext?.();
      if (!context || context.state === 'closed' || !context.createMediaElementSource) return;
      gain = context.createGain();
      gain.gain.value = this.#volume;
      gain.connect(context.destination);
      const source = context.createMediaElementSource(this.#audio);
      source.connect(gain);
      this.#audio.volume = 1;
      this.#audio.muted = false;
      this.#context = context;
      this.#source = source;
      this.#gain = gain;
    } catch {
      gain?.disconnect();
    }
  }
}

function openTrackStore() {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(STORAGE_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('No se pudo abrir el almacenamiento de música.'));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
  });
}

async function trackTransaction(mode, operation) {
  const database = await openTrackStore();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function readLocalTrack() {
  try {
    const file = await trackTransaction('readonly', store => store.get(TRACK_KEY));
    return isAudioFile(file) ? file : null;
  } catch {
    return null;
  }
}

export async function saveLocalTrack(file) {
  if (file !== null && !isAudioFile(file)) return false;
  try {
    await trackTransaction('readwrite', store => file === null
      ? store.delete(TRACK_KEY) : store.put(file, TRACK_KEY));
    return true;
  } catch {
    return false;
  }
}
