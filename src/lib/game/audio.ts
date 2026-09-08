let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C({ latencyHint: "interactive" });
    } catch {
      ctx = new C();
    }
  }
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (c && c.state === "suspended") void c.resume();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockAudio();
  });
}

export function setMuted(next: boolean) {
  muted = next;
}

function jitter(n: number, amt = 0.045) {
  return n * (1 + (Math.random() * 2 - 1) * amt);
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  at = 0,
  dest?: AudioContext,
) {
  const c = dest ?? ac();
  if (!c || muted) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(40, freq), t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noiseBurst(dur: number, gain: number, at = 0, freq = 800, q = 1.1) {
  const c = ac();
  if (!c || muted) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = c.createGain();
  const t0 = c.currentTime + at;
  g.gain.setValueAtTime(Math.max(0.0002, gain), t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function hitClick(at = 0, gain = 0.05) {
  noiseBurst(0.035, gain, at, 2200, 2.4);
  tone(jitter(1680), 0.045, "triangle", gain * 0.7, at);
}

export const sfx = {
  tap() {
    tone(jitter(390, 0.06), 0.06, "triangle", 0.038);
    noiseBurst(0.03, 0.02, 0, 1400, 1.6);
  },
  spawn() {
    hitClick(0, 0.03);
    tone(jitter(520), 0.09, "sine", 0.045);
    tone(jitter(780), 0.11, "triangle", 0.028, 0.04);
  },
  merge(tier = 1, capstone = false, chain = "tide") {
    const t = Math.min(8, Math.max(1, tier));
    hitClick(0, 0.04 + t * 0.004);
    switch (chain) {
      case "hearth":
        noiseBurst(0.11, 0.055, 0, 160, 0.7);
        tone(jitter(174), 0.14, "triangle", 0.06);
        tone(jitter(262 + t * 18), 0.13, "sine", 0.042, 0.05);
        tone(jitter(392), 0.16, "sine", 0.032, 0.11);
        break;
      case "craft":
        noiseBurst(0.08, 0.05, 0, 420, 1.1);
        tone(jitter(196), 0.1, "triangle", 0.05);
        tone(jitter(330 + t * 22), 0.12, "sine", 0.04, 0.045);
        tone(jitter(494), 0.14, "triangle", 0.03, 0.1);
        break;
      case "net":
        noiseBurst(0.14, 0.05, 0.01, 780, 0.9);
        tone(jitter(247), 0.1, "sine", 0.045);
        tone(jitter(370 + t * 16), 0.13, "triangle", 0.038, 0.05);
        tone(jitter(554), 0.12, "sine", 0.028, 0.12);
        break;
      case "bloom":
        tone(jitter(659), 0.12, "sine", 0.048);
        tone(jitter(784 + t * 24), 0.16, "sine", 0.04, 0.05);
        tone(jitter(988), 0.18, "triangle", 0.03, 0.11);
        break;
      case "wreck":
        noiseBurst(0.09, 0.048, 0, 240, 0.8);
        tone(jitter(185), 0.12, "triangle", 0.05);
        tone(jitter(987), 0.1, "sine", 0.04, 0.04);
        tone(jitter(1174 + t * 20), 0.14, "triangle", 0.028, 0.1);
        break;
      case "keep":
        tone(jitter(1318), 0.09, "sine", 0.05);
        tone(jitter(1568 + t * 18), 0.12, "triangle", 0.042, 0.04);
        tone(jitter(1976), 0.16, "sine", 0.03, 0.1);
        break;
      case "hammer":
        noiseBurst(0.07, 0.055, 0, 520, 1.4);
        tone(jitter(311), 0.08, "square", 0.028);
        tone(jitter(415 + t * 20), 0.11, "triangle", 0.04, 0.04);
        tone(jitter(622), 0.13, "sine", 0.03, 0.09);
        break;
      case "paint":
        noiseBurst(0.1, 0.04, 0.01, 980, 1.2);
        tone(jitter(349), 0.1, "sine", 0.042);
        tone(jitter(523 + t * 16), 0.14, "triangle", 0.036, 0.05);
        tone(jitter(698), 0.14, "sine", 0.028, 0.11);
        break;
      case "lamp":
        tone(jitter(784), 0.12, "sine", 0.048);
        tone(jitter(988), 0.16, "triangle", 0.04, 0.05);
        tone(jitter(1174 + t * 22), 0.2, "sine", 0.032, 0.12);
        break;
      case "special":
        noiseBurst(0.1, 0.05, 0, 200, 0.7);
        tone(jitter(220), 0.12, "triangle", 0.05);
        tone(jitter(330), 0.12, "sine", 0.035, 0.06);
        tone(jitter(440 + t * 18), 0.16, "sine", 0.03, 0.12);
        break;
      default:
        noiseBurst(0.1, 0.04, 0.015, 860, 1.05);
        tone(jitter(659), 0.1, "sine", 0.05);
        tone(jitter(784 + t * 28), 0.14, "sine", 0.042, 0.045);
        tone(jitter(988), 0.16, "triangle", 0.032, 0.1);
        if (t >= 5) tone(jitter(1318), 0.2, "sine", 0.028, 0.15);
        break;
    }
    if (t >= 6) tone(jitter(1568), 0.18, "sine", 0.025, 0.18);
    if (capstone) {
      tone(jitter(1046), 0.22, "triangle", 0.04, 0.2);
      tone(jitter(1318), 0.26, "sine", 0.032, 0.28);
      tone(jitter(1760), 0.3, "sine", 0.024, 0.36);
    }
  },
  invalid() {
    tone(140, 0.14, "square", 0.03);
    noiseBurst(0.08, 0.02, 0, 180, 0.6);
  },
  deliver() {
    tone(jitter(523), 0.12, "sine", 0.05);
    tone(jitter(659), 0.14, "sine", 0.045, 0.08);
    tone(jitter(784), 0.2, "triangle", 0.04, 0.16);
    tone(jitter(1046), 0.22, "sine", 0.03, 0.26);
  },
  sell() {
    tone(jitter(880), 0.08, "triangle", 0.04);
    tone(jitter(1174), 0.1, "sine", 0.03, 0.05);
  },
  level() {
    tone(jitter(523), 0.12, "sine", 0.05);
    tone(jitter(784), 0.16, "sine", 0.045, 0.1);
    tone(jitter(1046), 0.22, "triangle", 0.04, 0.2);
  },
};
