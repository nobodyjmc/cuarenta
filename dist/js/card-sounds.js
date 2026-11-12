const patterns = {
  deal: [
    { at: 0, slide: .038, force: .34 },
    { at: .065, slide: .034, force: .30 },
    { at: .128, slide: .037, force: .38 },
    { at: .195, slide: .035, force: .32 },
    { at: .26, slide: .045, force: .40 },
  ],
  place: [{ at: 0, slide: .014, force: .58 }],
  capture: [
    { at: 0, slide: .074, force: .43 },
    { at: .086, slide: .041, force: .49 },
  ],
  fall: [
    { at: 0, slide: .01, force: .98 },
    { at: .047, slide: .065, force: .41 },
  ],
  win: [
    { at: 0, slide: .015, force: 1.08 },
    { at: .065, slide: .05, force: .56 },
    { at: .128, slide: .059, force: .48 },
    { at: .214, slide: .046, force: .78 },
  ],
};

const cache = new WeakMap();
const tail = .082;

function renderContact(samples, rate, { at, slide, force }) {
  const start = Math.round(at * rate);
  const length = Math.min(samples.length - start, Math.ceil((slide + tail) * rate));
  const filter = cutoff => 1 - Math.exp(-2 * Math.PI * cutoff / rate);
  const paperFilter = filter(6500);
  const slapFilter = filter(2300);
  const tableFilter = filter(410);
  const lowFilter = filter(65);
  let seed = (start + 17) * 2685821;
  let paper = 0;
  let slap = 0;
  let table = 0;
  let low = 0;

  for (let index = 0; index < length; index++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const noise = (seed >>> 0) / 0x80000000 - 1;
    paper += (noise - paper) * paperFilter;
    slap += (noise - slap) * slapFilter;
    table += (noise - table) * tableFilter;
    low += (table - low) * lowFilter;

    const age = index / rate;
    if (age < slide) {
      // Paper slipping over the felt before it makes contact.
      const phase = age / slide;
      const pressure = 4 * phase * (1 - phase);
      samples[start + index] += (paper - table) * pressure * .24 * force;
    } else {
      // A bright leading edge followed by the short, softer table impact.
      const contact = age - slide;
      const attack = Math.min(1, contact / .001);
      const snap = (paper - slap) * Math.exp(-contact / .0045) * .66;
      const slapBody = (slap - table) * Math.exp(-contact / .012) * .78;
      const thump = (table - low) * Math.exp(-contact / .021) * 1.15;
      samples[start + index] += (snap + slapBody + thump) * attack * force;
    }
  }
}

function effectBuffer(context, effect) {
  let buffers = cache.get(context);
  if (!buffers) {
    buffers = new Map();
    cache.set(context, buffers);
  }
  if (buffers.has(effect)) return buffers.get(effect);
  const contacts = patterns[effect];
  const duration = Math.max(...contacts.map(({ at, slide }) => at + slide)) + tail;
  const buffer = context.createBuffer(1, Math.ceil(duration * context.sampleRate), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (const contact of contacts) renderContact(samples, context.sampleRate, contact);
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index];
    samples[index] = .62 * sample / (1 + Math.abs(sample));
  }
  buffers.set(effect, buffer);
  return buffer;
}

export function playCardSound(context, effect) {
  if (!Object.hasOwn(patterns, effect)) return;
  const source = context.createBufferSource();
  source.buffer = effectBuffer(context, effect);
  source.playbackRate.value = .97 + Math.random() * .06;
  source.connect(context.destination);
  source.start();
}
