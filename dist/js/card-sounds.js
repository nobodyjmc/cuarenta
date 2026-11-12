import { CARD_SAMPLE_RATE, CARD_SAMPLES } from './card-sound-samples.js';

const cache = new WeakMap();

function effectBuffer(context, effect) {
  let buffers = cache.get(context);
  if (!buffers) {
    buffers = new Map();
    cache.set(context, buffers);
  }
  if (buffers.has(effect)) return buffers.get(effect);

  // The bundled recordings use mono signed 16-bit PCM in little-endian order.
  const bytes = atob(CARD_SAMPLES[effect]);
  const buffer = context.createBuffer(1, bytes.length / 2, CARD_SAMPLE_RATE);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    const offset = index * 2;
    const word = bytes.charCodeAt(offset) | (bytes.charCodeAt(offset + 1) << 8);
    samples[index] = (word < 32768 ? word : word - 65536) / 32768;
  }
  buffers.set(effect, buffer);
  return buffer;
}

export function playCardSound(context, effect) {
  if (!Object.hasOwn(CARD_SAMPLES, effect)) return;
  const source = context.createBufferSource();
  source.buffer = effectBuffer(context, effect);
  source.playbackRate.value = .985 + Math.random() * .03;
  source.connect(context.destination);
  source.start();
}
