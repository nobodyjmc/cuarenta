// Keep these two relative URLs so the portable build can embed the same tracks.
export const MUSIC_TRACKS = Object.freeze([
  Object.freeze({ id: 'juramento', title: 'Nuestro Juramento', url: './assets/nuestro-juramento.mp3', balance: 1 }),
  Object.freeze({ id: 'reminiscencias', title: 'Reminiscencias', url: './assets/reminiscencias.mp3', balance: .85 }),
]);

// Leave headroom for the sound effects. Reminiscencias measures 1.4 dB louder.
const MAX_MUSIC_GAIN = .64;

export class TableMusic {
  #audio;
  #getContext;
  #context = null;
  #gain = null;
  #track = null;
  #volume = .32;
  #request = 0;

  constructor({ audio, getContext }) {
    this.#audio = audio;
    this.#getContext = getContext;
  }

  get isPlaying() {
    return !this.#audio.paused && !this.#audio.ended &&
      (!this.#context || this.#context.state === 'running');
  }

  async start({ trackId, volume = this.#volume } = {}) {
    const track = MUSIC_TRACKS.find(item => item.id === trackId) ?? MUSIC_TRACKS[0];
    const request = ++this.#request;
    try {
      if (track !== this.#track) {
        this.#audio.pause();
        this.#audio.src = track.url;
        this.#track = track;
      }
      this.#connectGain();
      this.setVolume(volume);

      // Invoke both browser APIs before awaiting, while the tap can unlock audio.
      const resume = this.#context && this.#context.state !== 'running'
        ? this.#context.resume() : undefined;
      await Promise.all([this.#audio.play(), resume]);
      return request === this.#request && this.isPlaying;
    } catch {
      if (request === this.#request) this.#audio.pause();
      return false;
    }
  }

  setVolume(value) {
    if (!Number.isFinite(value)) return;
    this.#volume = Math.max(0, Math.min(1, value));
    const level = this.#volume * MAX_MUSIC_GAIN * (this.#track?.balance ?? 1);
    if (this.#gain) {
      this.#gain.gain.setTargetAtTime(level, this.#context.currentTime, .035);
    } else {
      this.#audio.volume = level;
      this.#audio.muted = level === 0;
    }
  }

  pause() {
    this.#request += 1;
    this.#audio.pause();
  }

  #connectGain() {
    if (this.#gain) return;
    let gain;
    try {
      const context = this.#getContext();
      if (!context?.createMediaElementSource || context.state === 'closed') return;
      gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);
      const source = context.createMediaElementSource(this.#audio);
      source.connect(gain);
      this.#audio.volume = 1;
      this.#audio.muted = false;
      this.#context = context;
      this.#gain = gain;
    } catch {
      gain?.disconnect();
    }
  }
}
