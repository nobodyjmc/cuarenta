// Original pieces for Cuarenta. Each row is one bar in 3/4; melody entries are
// [beat, note, length in beats]. The bass and arpeggio accompany a requinto lead.
export const MUSIC_TRACKS = Object.freeze([
  Object.freeze({ id: 'faroles', title: 'Faroles de Quito' }),
  Object.freeze({ id: 'patio', title: 'Patio de la Ronda' }),
]);

const CHORDS = {
  Dm: ['D2', 'A2', 'F3', 'A3', 'D4'],
  Gm: ['G2', 'D3', 'G3', 'Bb3', 'D4'],
  A7: ['A2', 'E3', 'G3', 'C#4', 'E4'],
  Bb: ['Bb2', 'F3', 'Bb3', 'D4', 'F4'],
  F: ['F2', 'C3', 'F3', 'A3', 'C4'],
  C: ['C3', 'G3', 'C4', 'E4', 'G4'],
  E7: ['E2', 'B2', 'G#3', 'D4', 'E4'],
  G: ['G2', 'D3', 'G3', 'B3', 'D4'],
  'D/F#': ['F#2', 'D3', 'A3', 'D4', 'F#4'],
  Em: ['E2', 'B2', 'G3', 'B3', 'E4'],
  D: ['D2', 'A2', 'F#3', 'A3', 'D4'],
  Am: ['A2', 'E3', 'A3', 'C4', 'E4'],
  Bm: ['B2', 'F#3', 'B3', 'D4', 'F#4'],
};

const SCORES = {
  faroles: {
    bpm: 108,
    bars: [
      ['Dm', [[.5, 'A4', .45], [1, 'F5', 1], [2, 'E5', .5], [2.5, 'D5', .5]]],
      ['Gm', [[0, 'G5', .9], [1, 'D5', .72], [2, 'Bb4', .68]]],
      ['A7', [[0, 'C#5', 1.2], [1.5, 'B4', .4], [2, 'A4', .85]]],
      ['Dm', [[0, 'F4', .7], [.75, 'A4', .7], [1.5, 'D5', 1.4]]],
      ['Bb', [[.25, 'D5', .7], [1, 'F5', .52], [1.6, 'D5', .42], [2.15, 'Bb4', .75]]],
      ['Gm', [[0, 'G4', .9], [1, 'Bb4', .45], [1.5, 'D5', .95]]],
      ['A7', [[0, 'E5', .63], [.75, 'G5', .45], [1.25, 'E5', .44], [1.8, 'C#5', .92]]],
      ['Dm', [[0, 'D5', 2.4], [2.65, 'A4', .33]]],
      ['F', [[0, 'C5', .75], [.8, 'F5', .6], [1.5, 'A5', 1.22]]],
      ['C', [[0, 'G5', .9], [1.25, 'E5', .47], [1.75, 'G5', .45], [2.25, 'C5', .65]]],
      ['Bb', [[.25, 'D5', 1], [1.25, 'F5', .66], [2, 'Bb5', .83]]],
      ['A7', [[0, 'A5', .72], [.75, 'G5', .48], [1.25, 'E5', .45], [1.8, 'C#5', 1]]],
      ['Dm', [[0, 'D5', .52], [.6, 'F5', .66], [1.35, 'A5', .9]]],
      ['C', [[0, 'E5', 1.1], [1.25, 'D5', .45], [1.75, 'C5', .95]]],
      ['Bb', [[.25, 'Bb4', .65], [1, 'F5', .85], [2, 'D5', .88]]],
      ['A7', [[0, 'C#5', .64], [.75, 'A4', .48], [1.25, 'E5', 1.36]]],
      ['Gm', [[0, 'D5', .62], [.75, 'Bb4', .45], [1.25, 'G4', 1.3]]],
      ['Dm', [[.25, 'F4', .65], [1, 'A4', .85], [2, 'F5', .78]]],
      ['E7', [[0, 'E5', .8], [1, 'D5', .65], [1.75, 'B4', .5], [2.3, 'G#4', .6]]],
      ['A7', [[0, 'A4', .65], [.75, 'C#5', .63], [1.5, 'E5', 1.2]]],
      ['Bb', [[0, 'F5', .92], [1.25, 'D5', .65], [2, 'C5', .48], [2.5, 'Bb4', .45]]],
      ['Gm', [[0, 'G4', .95], [1.25, 'Bb4', .75], [2.25, 'D5', .56]]],
      ['A7', [[0, 'E5', .62], [.75, 'G5', .48], [1.25, 'F5', .45], [1.75, 'C#5', .94]]],
      ['Dm', [[0, 'D5', 2.7]]],
    ],
  },
  patio: {
    bpm: 116,
    bars: [
      ['G', [[.25, 'B4', .48], [.75, 'D5', .63], [1.5, 'G5', 1.25]]],
      ['D/F#', [[0, 'F#5', .55], [.6, 'A5', .6], [1.35, 'D5', .82], [2.35, 'A4', .55]]],
      ['Em', [[0, 'B4', .7], [.75, 'E5', .55], [1.5, 'G5', .58], [2.25, 'E5', .55]]],
      ['D', [[0, 'F#5', .74], [.75, 'E5', .46], [1.25, 'D5', 1.36]]],
      ['C', [[0, 'E5', .45], [.5, 'G5', .92], [1.5, 'E5', .65], [2.25, 'C5', .62]]],
      ['Am', [[.25, 'A4', .55], [.85, 'C5', .62], [1.55, 'E5', 1.2]]],
      ['D', [[0, 'F#5', .74], [.75, 'A5', .46], [1.25, 'F#5', .46], [1.75, 'D5', 1.16]]],
      ['G', [[0, 'G5', 2.14], [2.4, 'D5', .49]]],
      ['Bm', [[0, 'F#5', .58], [.65, 'D5', .66], [1.4, 'B4', 1.38]]],
      ['Em', [[.25, 'B4', .47], [.75, 'G4', .66], [1.5, 'E5', 1.16]]],
      ['C', [[0, 'C5', .52], [.6, 'E5', .68], [1.35, 'G5', .7], [2.15, 'C6', .6]]],
      ['D', [[0, 'A5', 1], [1.25, 'F#5', .45], [1.75, 'D5', 1.12]]],
      ['G', [[0, 'B4', .68], [.75, 'D5', .45], [1.25, 'G5', .62], [2, 'B5', .9]]],
      ['C', [[0, 'G5', .92], [1.1, 'E5', .55], [1.75, 'C5', 1.03]]],
      ['A7', [[.25, 'A4', .45], [.75, 'C#5', .55], [1.35, 'E5', .64], [2.1, 'G5', .76]]],
      ['D', [[0, 'F#5', .78], [1, 'A5', .6], [1.75, 'D5', .92]]],
      ['Em', [[0, 'E5', .75], [.85, 'G5', .55], [1.5, 'B5', 1.2]]],
      ['C', [[0, 'C6', .71], [.75, 'G5', .44], [1.25, 'E5', 1.27]]],
      ['Bm', [[.25, 'F#5', .66], [1, 'D5', .66], [1.75, 'B4', 1.05]]],
      ['Em', [[0, 'G4', .6], [.65, 'B4', .62], [1.35, 'E5', 1.45]]],
      ['Am', [[0, 'C5', .66], [.75, 'E5', .46], [1.25, 'A5', 1.35]]],
      ['D', [[0, 'F#5', .5], [.55, 'E5', .4], [1, 'D5', .9], [2, 'A4', .76]]],
      ['G', [[0, 'B4', .7], [.75, 'D5', .7], [1.5, 'G5', 1.27]]],
      ['G', [[0, 'D5', .75], [.85, 'G4', 1.92]]],
    ],
  },
};

const SAMPLE_RATE = 22050;
const PITCH_CLASS = { C: 0, 'C#': 1, D: 2, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, Bb: 10, B: 11 };
const TIMBRES = {
  lead: { partials: [1, .47, .31, .12, .09, .06, .033], decay: 2.9, attack: .0028 },
  chord: { partials: [1, .49, .18, .13, .07, .035], decay: 3.4, attack: .004 },
  bass: { partials: [1, .34, .14, .053], decay: 3.6, attack: .007 },
};

function noteFrequency(note) {
  const midi = 12 * (1 + Number(note.at(-1))) + PITCH_CLASS[note.slice(0, -1)];
  return 440 * 2 ** ((midi - 69) / 12);
}

function pluck(note, voice) {
  const { partials, decay, attack } = TIMBRES[voice];
  const frequency = noteFrequency(note);
  const angular = 2 * Math.PI * frequency;
  const samples = new Float32Array(Math.round(SAMPLE_RATE * 2));
  for (let index = 0; index < partials.length; index += 1) {
    const harmonic = index + 1;
    const step = angular * harmonic * (1 + index * .00035) / SAMPLE_RATE;
    const fade = Math.exp(-(decay + index * 3.15) / SAMPLE_RATE);
    const stepCos = Math.cos(step);
    const stepSin = Math.sin(step);
    let cosine = Math.cos(index * .34);
    let sine = Math.sin(index * .34);
    let amplitude = partials[index];
    for (let frame = 0; frame < samples.length; frame += 1) {
      samples[frame] += sine * amplitude;
      const nextSine = sine * stepCos + cosine * stepSin;
      cosine = cosine * stepCos - sine * stepSin;
      sine = nextSine;
      amplitude *= fade;
    }
  }

  const body = 2 * Math.PI * (voice === 'bass' ? 109 : 185) / SAMPLE_RATE;
  for (let frame = 0; frame < samples.length; frame += 1) {
    const time = frame / SAMPLE_RATE;
    const resonance = Math.sin(frame * body) * .062 * Math.exp(-time * 23);
    samples[frame] = (samples[frame] + resonance) * (1 - Math.exp(-time / attack));
  }
  return samples;
}

function makeLoop(context, score) {
  const beat = 60 / score.bpm;
  const length = Math.round(score.bars.length * 3 * beat * SAMPLE_RATE);
  const buffer = context.createBuffer(1, length, SAMPLE_RATE);
  const output = buffer.getChannelData(0);
  const plucks = new Map();

  function add(start, note, duration, level, voice) {
    const key = `${voice}:${note}`;
    if (!plucks.has(key)) plucks.set(key, pluck(note, voice));
    const sample = plucks.get(key);
    const first = Math.round(start * beat * SAMPLE_RATE);
    const release = Math.round(duration * beat * SAMPLE_RATE);
    const tail = Math.round(.14 * SAMPLE_RATE);
    const end = Math.min(sample.length, release + tail);
    for (let frame = 0; frame < end; frame += 1) {
      const envelope = frame < release ? 1 : ((end - frame) / tail) ** 2;
      let target = first + frame;
      if (target >= length) target -= length;
      output[target] += sample[frame] * envelope * level;
    }
  }

  for (const [index, [harmony, melody]] of score.bars.entries()) {
    const start = index * 3;
    const [root, fifth, low, middle, high] = CHORDS[harmony];
    const variation = 1 + .06 * Math.sin(index * 2.4);
    add(start, root, .88, .21 * variation, 'bass');
    add(start + .49, fifth, .47, .085, 'bass');
    const brush = [[1.015, low, .09], [1.04, middle, .065], [1.07, high, .047]];
    const answer = index % 4 === 3 ? [[2.03, middle, .062], [2.42, high, .045]]
      : [[1.98, low, .075], [2.02, middle, .060], [2.06, high, .052]];
    for (const [offset, note, level] of [...brush, ...answer]) {
      add(start + offset, note, .57, level * variation, 'chord');
    }
    for (const [noteIndex, [offset, note, duration]] of melody.entries()) {
      const accent = .27 + .032 * Math.cos(index + noteIndex * 1.6);
      add(start + offset + .009, note, duration, accent, 'lead');
    }
  }

  // Two quiet reflections suggest a small room. Wrap their tails so that the
  // last beat and the first beat meet continuously when the buffer repeats.
  const dry = new Float32Array(output);
  const firstEcho = Math.round(.023 * SAMPLE_RATE);
  const secondEcho = Math.round(.061 * SAMPLE_RATE);
  let peak = 0;
  for (let frame = 0; frame < length; frame += 1) {
    output[frame] += dry[(frame + length - firstEcho) % length] * .105;
    output[frame] += dry[(frame + length - secondEcho) % length] * .054;
    peak = Math.max(peak, Math.abs(output[frame]));
  }
  const normalize = .68 / Math.max(peak, .68);
  if (normalize < 1) {
    for (let frame = 0; frame < length; frame += 1) output[frame] *= normalize;
  }
  return buffer;
}

function clampVolume(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .35;
}

export class TableMusic {
  #getContext;
  #active = null;
  #cache = null;
  #paused = null;
  #request = 0;
  #volume = .35;

  constructor({ getContext }) {
    this.#getContext = getContext;
  }

  get isPlaying() {
    return this.#active?.context.state === 'running';
  }

  async start({ trackId = MUSIC_TRACKS[0].id, volume = this.#volume } = {}) {
    const track = MUSIC_TRACKS.find(({ id }) => id === trackId) ?? MUSIC_TRACKS[0];
    const request = ++this.#request;
    this.#volume = clampVolume(volume);
    let source;
    let gain;
    try {
      const context = this.#getContext();
      // Resume before the first await so a user's click can unlock audio.
      if (context.state !== 'running') await context.resume();
      if (request !== this.#request || context.state !== 'running') return false;
      if (this.#active?.context === context && this.#active.trackId === track.id) {
        this.setVolume(this.#volume);
        return true;
      }

      const cached = this.#cache;
      const buffer = cached?.context === context && cached.trackId === track.id
        ? cached.buffer : makeLoop(context, SCORES[track.id]);
      this.#cache = { context, trackId: track.id, buffer };
      source = context.createBufferSource();
      gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (this.#active?.source === source) this.#active = null;
      };
      const now = context.currentTime;
      const offset = this.#paused?.trackId === track.id ? this.#paused.offset : 0;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.#volume, now + .12);
      source.start(now, offset);
      this.#stopActive();
      this.#paused = null;
      this.#active = { context, trackId: track.id, source, gain, startedAt: now, offset };
      return true;
    } catch {
      source?.disconnect();
      gain?.disconnect();
      return false;
    }
  }

  setVolume(volume) {
    this.#volume = clampVolume(volume);
    if (!this.#active) return;
    const { gain, context } = this.#active;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(this.#volume, now, .035);
  }

  stop() {
    this.#request += 1;
    this.#paused = null;
    this.#stopActive();
  }

  pause() {
    this.#request += 1;
    if (!this.#active) return;
    const { context, trackId, source, startedAt, offset } = this.#active;
    this.#paused = { trackId, offset: (offset + context.currentTime - startedAt) % source.buffer.duration };
    this.#stopActive();
  }

  #stopActive() {
    if (!this.#active) return;
    const { source, gain, context } = this.#active;
    this.#active = null;
    const now = context.currentTime;
    if (context.state === 'running') {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, .018);
      source.stop(now + .09);
    } else {
      source.stop(now);
      source.disconnect();
      gain.disconnect();
    }
  }
}
