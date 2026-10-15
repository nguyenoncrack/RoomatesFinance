/** Tiny synthesized sound effects for the receipt printer (no audio files). Silent when sound is switched off. */
const PREF_KEY = "roommate-finance:music";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (window.localStorage.getItem(PREF_KEY) === "off") return null;
    ctx ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx.state === "closed" ? null : ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function click(c: AudioContext, at: number, gain: number) {
  const len = Math.floor(c.sampleRate * 0.025);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  f.type = "bandpass";
  f.frequency.value = 2400;
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
}

/** Lever clunk and a rising ratchet. */
export function playLever() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  tone(c, t, 160, 0.16, "square", 0.08, 70);
  for (let i = 0; i < 5; i++) click(c, t + 0.05 + i * 0.07, 0.25);
  tone(c, t + 0.42, 90, 0.12, "triangle", 0.12, 50);
}

/** Dot-matrix chatter for roughly `ms` milliseconds. */
export function playPrinting(ms: number) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.3;
  const end = t + ms / 1000 - 0.3;
  for (let at = t, i = 0; at < end; i++) {
    const burst = Math.floor(3 + (i % 3) * 2);
    for (let k = 0; k < burst && at < end; k++, at += 0.045) {
      click(c, at, 0.18);
      tone(c, at, 520 + (k % 2) * 90, 0.03, "square", 0.025);
    }
    at += 0.16;
  }
}

/** Finishing ding. */
export function playDing() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  tone(c, t, 1318, 0.5, "sine", 0.12);
  tone(c, t + 0.12, 1760, 0.7, "sine", 0.1);
}
