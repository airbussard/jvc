// WebAudio-Synthese – keine Audiodateien. Alle Klänge werden zur Laufzeit aus Oszillatoren und Rauschen gebaut.
// Vertrag: audio.unlock(), play(name, { pan, vol }), setMuted(b), muted, startAmbience(id), stopAmbience()

const MUTE_KEY = 'weihad.muted';

// Mindestabstand (s) zwischen zwei gleichen Klängen – verhindert Klangbrei bei Dauerfeuer
const MIN_GAP = {
  throw: 0.04, hit: 0.035, miss: 0.06, empty: 0.09, reload: 0.3, 'reload-done': 0.2, screech: 1.1,
  bonus: 0.15, penalty: 0.35, combo: 0.2, countdown: 0.3, over: 2, click: 0.045, flap: 0.065,
  'jet-takeoff': 2.2, 'jet-landing': 2.2, 'jet-flyby': 1.6, heli: 5, jingle: 0.9,
};
// Verkehrsgeräusche teilen sich ein kleines Stimmen-Budget
const TRAFFIC = new Set(['jet-takeoff', 'jet-landing', 'jet-flyby', 'heli']);
const MAX_TRAFFIC_VOICES = 3;

let ctx = null;
let master = null;
let sfxBus = null;
let ambBus = null;
let noiseBuf = null;
let pinkBuf = null;
let muted = readMuted();
let primed = false;
let wantAmbience = null;
let amb = null;
let trafficVoices = 0;
const lastPlay = new Map();

function readMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function makeNoise(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Rosa Rauschen (Paul-Kellet-Filter), stereo – weicher Grundteppich für Wind und Meer
function makePink(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    // Schleifen-Naht weich überblenden
    const fade = Math.min(2048, len >> 4);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[i] = d[i] * k + d[len - fade + i] * (1 - k);
    }
  }
  return buf;
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC({ latencyHint: 'interactive' });
  } catch {
    try { ctx = new AC(); } catch { return null; }
  }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 14;
  comp.ratio.value = 4;
  comp.attack.value = 0.005;
  comp.release.value = 0.22;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.85;
  sfxBus = ctx.createGain();
  ambBus = ctx.createGain();
  sfxBus.connect(comp);
  ambBus.connect(comp);
  comp.connect(master);
  master.connect(ctx.destination);
  noiseBuf = makeNoise(2);
  pinkBuf = makePink(5);
  return ctx;
}

// --- Bausteine ------------------------------------------------------------------

// Ausgang eines Klangs: Lautstärke + Stereo-Position
function out(opts, level) {
  const g = ctx.createGain();
  g.gain.value = level * clamp(opts.vol ?? 1, 0, 1.5);
  const pan = clamp(Number(opts.pan) || 0, -1, 1);
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan * 0.8;
    g.connect(p);
    p.connect(sfxBus);
  } else {
    g.connect(sfxBus);
  }
  return g;
}

// Hüllkurve: schneller Anstieg, exponentielles Ausklingen
function env(dest, t, attack, peak, release, hold = 0) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  if (hold > 0) g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  g.connect(dest);
  return g;
}

function osc(type, freq, t, stop, dest) {
  const o = ctx.createOscillator();
  o.type = type;
  // Obertöne hoher Combos würden sonst die Nyquist-Grenze überschreiten
  o.frequency.setValueAtTime(Math.min(freq, ctx.sampleRate * 0.45), t);
  o.connect(dest);
  o.start(t);
  o.stop(stop);
  return o;
}

function noise(t, dur, dest, buf = noiseBuf) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.connect(dest);
  s.start(t, Math.random() * (buf.duration - 0.1));
  s.stop(t + dur);
  return s;
}

function filter(type, freq, q, dest) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  if (q != null) f.Q.value = q;
  f.connect(dest);
  return f;
}

// Glöckchen: Grundton + unharmonische Teiltöne
function bell(t, freq, level, dest, dur = 0.7) {
  for (const [mul, amp, len] of [[1, 1, 1], [2.76, 0.42, 0.55], [5.4, 0.2, 0.32], [8.93, 0.08, 0.2]]) {
    const g = env(dest, t, 0.002, level * amp, dur * len);
    osc('sine', freq * mul, t, t + dur * len + 0.05, g);
  }
}

// Schellenkranz: kurze Rausch-Impulse im hohen Band
function shaker(t, dur, level, dest) {
  const hp = filter('highpass', 5200, 0.7, dest);
  const bp = filter('bandpass', 8200, 1.4, hp);
  let x = t;
  let i = 0;
  while (x < t + dur) {
    const fall = 1 - (x - t) / dur;
    const g = env(bp, x, 0.004, level * (0.5 + 0.5 * fall) * rand(0.6, 1), rand(0.03, 0.07));
    noise(x, 0.1, g);
    x += rand(0.045, 0.085) * (i++ % 2 ? 1.25 : 0.8);
  }
}

function tone(t, freq, dur, type, level, dest) {
  const g = env(dest, t, 0.006, level, dur);
  return osc(type, freq, t, t + dur + 0.05, g);
}

function trafficVoice(seconds) {
  trafficVoices++;
  setTimeout(() => { trafficVoices = Math.max(0, trafficVoices - 1); }, seconds * 1000);
}

// --- Klänge -------------------------------------------------------------------------

const SOUNDS = {
  throw(t, o) {
    const out1 = out(o, 0.28);
    const g = env(out1, t, 0.05, 1, 0.24);
    const bp = filter('bandpass', 500, 1.1, g);
    bp.frequency.setValueAtTime(450, t);
    bp.frequency.exponentialRampToValueAtTime(2300, t + 0.11);
    bp.frequency.exponentialRampToValueAtTime(800, t + 0.3);
    noise(t, 0.34, bp);
  },

  hit(t, o) {
    const dst = out(o, 0.42);
    // Plopp
    const g = env(dst, t, 0.002, 0.75, 0.11);
    const p = osc('sine', 560, t, t + 0.16, g);
    p.frequency.exponentialRampToValueAtTime(150, t + 0.09);
    // Glöckchen
    const notes = [1568, 1760, 2093, 2349];
    bell(t + 0.025, notes[(Math.random() * notes.length) | 0], 0.16, dst, 0.65);
  },

  miss(t, o) {
    const dst = out(o, 0.12);
    const g = env(dst, t, 0.006, 1, 0.16);
    noise(t, 0.2, filter('lowpass', 650, 0.7, g));
    const g2 = env(dst, t, 0.003, 0.5, 0.09);
    const s = osc('sine', 180, t, t + 0.12, g2);
    s.frequency.exponentialRampToValueAtTime(90, t + 0.1);
  },

  empty(t, o) {
    const dst = out(o, 0.14);
    for (const dt of [0, 0.075]) {
      const g = env(dst, t + dt, 0.001, 1, 0.025);
      noise(t + dt, 0.04, filter('highpass', 2600, 0.8, g));
      tone(t + dt, 1900, 0.018, 'square', 0.12, dst);
    }
  },

  reload(t, o) {
    const dst = out(o, 0.3);
    // Stoff-Rascheln + Ratsche
    const rg = env(dst, t, 0.04, 0.35, 0.25);
    noise(t, 0.32, filter('bandpass', 1600, 0.6, rg));
    let x = t + 0.05;
    for (let i = 0; i < 7; i++) {
      const g = env(dst, x, 0.001, 0.9, 0.022);
      noise(x, 0.035, filter('bandpass', 3200 + i * 120, 5, g));
      x += 0.062 - i * 0.004;
    }
  },

  'reload-done'(t, o) {
    const dst = out(o, 0.16);
    tone(t, 784, 0.09, 'triangle', 0.7, dst);
    tone(t + 0.07, 1175, 0.16, 'triangle', 0.7, dst);
    bell(t + 0.07, 2350, 0.12, dst, 0.4);
  },

  // Adlerschrei: FM-Pfiff mit Vibrato, absteigend („kjiii-ärr“)
  screech(t, o) {
    const dst = out(o, 0.09);
    const hp = filter('highpass', 900, 0.7, dst);
    const call = (t0, f0, f1, f2, dur, level) => {
      const g = env(hp, t0, 0.025, level, dur * 0.75, dur * 0.2);
      const car = osc('sine', f0, t0, t0 + dur + 0.05, g);
      car.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.18);
      car.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      // Vibrato
      const vg = ctx.createGain();
      vg.gain.value = f1 * 0.035;
      vg.connect(car.frequency);
      osc('sine', rand(24, 32), t0, t0 + dur + 0.05, vg);
      // Rauheit über Frequenzmodulation
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = rand(130, 170);
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(f1 * 0.18, t0);
      mg.gain.linearRampToValueAtTime(f1 * 0.06, t0 + dur);
      mod.connect(mg);
      mg.connect(car.frequency);
      mod.start(t0);
      mod.stop(t0 + dur + 0.05);
      // Atem
      const ng = env(hp, t0, 0.02, level * 0.25, dur * 0.6);
      noise(t0, dur, filter('bandpass', f1, 2.5, ng));
    };
    call(t, 2300, 2900, 2400, 0.13, 0.7);
    call(t + 0.17, 2700, 2950, 1450, 0.62, 1);
  },

  bonus(t, o) {
    const dst = out(o, 0.2);
    [1047, 1319, 1568, 2093, 2637].forEach((f, i) => bell(t + i * 0.065, f, 0.42, dst, 0.55));
    shaker(t, 0.45, 0.35, dst);
  },

  penalty(t, o) {
    const dst = out(o, 0.12);
    const lp = filter('lowpass', 950, 0.9, dst);
    for (const dt of [0, 0.21]) {
      const g = env(lp, t + dt, 0.01, 0.8, 0.08, 0.1);
      osc('sawtooth', 98, t + dt, t + dt + 0.25, g);
      osc('sawtooth', 104, t + dt, t + dt + 0.25, g);
      osc('square', 49, t + dt, t + dt + 0.25, env(lp, t + dt, 0.01, 0.25, 0.08, 0.1));
    }
  },

  combo(t, o) {
    const dst = out(o, 0.15);
    const m = clamp(Number(o.multiplier) || 2, 2, 6);
    const base = 523.25 * Math.pow(2, (m - 2) * 3 / 12);
    [1, 1.25, 1.5, 2].forEach((k, i) => {
      tone(t + i * 0.055, base * k, 0.14, 'triangle', 0.7, dst);
      tone(t + i * 0.055, base * k * 2, 0.08, 'sine', 0.2, dst);
    });
    bell(t + 0.22, base * 4, 0.18, dst, 0.5);
  },

  countdown(t, o) {
    const dst = out(o, 0.14);
    const hi = (Number(o.seconds) || 9) <= 3;
    tone(t, hi ? 1318.5 : 987.8, 0.1, 'sine', 1, dst);
    tone(t, hi ? 2637 : 1975.5, 0.05, 'sine', 0.12, dst);
  },

  // „Jingle Bells“ (gemeinfrei): E E E – E E E – E G C D E
  over(t, o) {
    const dst = out(o, 0.17);
    const E = 659.25, G = 783.99, C = 523.25, D = 587.33;
    const beat = 0.15;
    const melody = [[E, 1], [E, 1], [E, 2], [E, 1], [E, 1], [E, 2], [E, 1], [G, 1], [C, 1.5], [D, 0.5], [E, 4]];
    let x = t;
    for (const [f, len] of melody) {
      const dur = len * beat;
      tone(x, f, Math.max(0.12, dur * 0.9), 'triangle', 0.8, dst);
      bell(x, f * 2, 0.12, dst, Math.min(0.6, dur + 0.2));
      x += dur;
    }
    // Bass: C – G – C
    tone(t, 130.8, 1.1, 'sine', 0.5, dst);
    tone(t + 1.2, 98, 0.6, 'sine', 0.45, dst);
    tone(t + 1.8, 130.8, 0.9, 'sine', 0.5, dst);
    shaker(x - 4 * beat, 0.7, 0.3, dst);
  },

  click(t, o) {
    const dst = out(o, 0.09);
    const g = env(dst, t, 0.001, 1, 0.035);
    const s = osc('sine', 1500, t, t + 0.05, g);
    s.frequency.exponentialRampToValueAtTime(800, t + 0.03);
  },

  // Fallblatt-Klappern
  flap(t, o) {
    const dst = out(o, 0.07);
    const g = env(dst, t, 0.001, 1, 0.018);
    noise(t, 0.03, filter('bandpass', rand(2600, 4200), 3, g));
  },

  jingle(t, o) {
    const dst = out(o, 0.24);
    shaker(t, 1.0, 0.45, dst);
    [2093, 2637, 3136, 2637, 3520].forEach((f, i) => bell(t + 0.08 + i * 0.13, f, 0.22, dst, 0.4));
  },

  'jet-takeoff'(t, o) {
    const dur = 4.4;
    trafficVoice(dur);
    const dst = out(o, 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 1.0);
    g.gain.linearRampToValueAtTime(1, t + 2.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dst);
    const lp = filter('lowpass', 240, 0.6, g);
    lp.frequency.setValueAtTime(240, t);
    lp.frequency.exponentialRampToValueAtTime(1700, t + 2.4);
    lp.frequency.exponentialRampToValueAtTime(700, t + dur);
    noise(t, dur, lp);
    // Grollen
    const rl = filter('lowpass', 150, 0.8, g);
    const r = osc('sawtooth', 48, t, t + dur, env(rl, t, 1.5, 0.55, 2.5, 0.4));
    r.frequency.linearRampToValueAtTime(62, t + 2.5);
    // Turbinen-Singen
    const w = osc('sine', 1700, t, t + dur, env(g, t, 1.4, 0.035, 2.6, 0.4));
    w.frequency.exponentialRampToValueAtTime(3100, t + 3);
  },

  'jet-landing'(t, o) {
    const dur = 4;
    trafficVoice(dur);
    const dst = out(o, 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9, t + 1.1);
    g.gain.linearRampToValueAtTime(0.5, t + 1.9);
    g.gain.linearRampToValueAtTime(0.85, t + 2.4); // Schubumkehr
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dst);
    const lp = filter('lowpass', 1300, 0.6, g);
    lp.frequency.setValueAtTime(1300, t);
    lp.frequency.exponentialRampToValueAtTime(450, t + 1.9);
    lp.frequency.exponentialRampToValueAtTime(900, t + 2.5);
    lp.frequency.exponentialRampToValueAtTime(300, t + dur);
    noise(t, dur, lp);
    const w = osc('sine', 2700, t, t + dur, env(g, t, 0.8, 0.03, 2.6, 0.3));
    w.frequency.exponentialRampToValueAtTime(1500, t + 3);
  },

  // Überflug mit Doppler-Absenkung
  'jet-flyby'(t, o) {
    const dur = 3.2;
    trafficVoice(dur);
    const dst = out({ ...o, pan: 0 }, 0.15);
    let node = dst;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      const c = clamp(Number(o.pan) || 0, -1, 1);
      const dir = (Number(o.dir) || (c > 0 ? -1 : 1)) > 0 ? 1 : -1;
      p.pan.setValueAtTime(clamp(c - dir * 0.45, -1, 1), t);
      p.pan.linearRampToValueAtTime(clamp(c + dir * 0.45, -1, 1), t + dur);
      p.connect(dst);
      node = p;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(node);
    const bp = filter('bandpass', 1400, 0.7, g);
    bp.frequency.setValueAtTime(1500, t);
    bp.frequency.setValueAtTime(1500, t + 1.2);
    bp.frequency.exponentialRampToValueAtTime(520, t + 1.8);
    noise(t, dur, bp);
    const w = osc('sine', 1650, t, t + dur, env(g, t, 1.2, 0.05, 1.8, 0.2));
    w.frequency.setValueAtTime(1650, t + 1.2);
    w.frequency.exponentialRampToValueAtTime(1150, t + 1.75);
  },

  // Hubschrauber: amplitudenmoduliertes Wummern
  heli(t, o) {
    const dur = 3.6;
    trafficVoice(dur);
    const dst = out(o, 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 1.1);
    g.gain.setValueAtTime(1, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dst);
    const am = ctx.createGain();
    am.gain.value = 0.5;
    am.connect(g);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rand(11, 13.5);
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg);
    lg.connect(am.gain);
    lfo.start(t);
    lfo.stop(t + dur);
    noise(t, dur, filter('lowpass', 320, 1.2, am));
    osc('sine', 68, t, t + dur, am);
  },
};

// --- Ambience ---------------------------------------------------------------------------

// Je Flughafen ein leicht anderer Grundteppich: [Filtertyp, Frequenz, Q, Pegel, LFO-Hz Filter, Filterhub, LFO-Hz Pegel, Pegelhub]
const WINTER = [
  ['bandpass', 520, 0.6, 0.06, 0.05, 260, 0.08, 0.55],
  ['bandpass', 1500, 5, 0.012, 0.11, 380, 0.07, 0.8],
  ['lowpass', 130, 0.7, 0.07, 0.02, 20, 0.05, 0.25],
];
const AMBIENCE = {
  FRA: WINTER,
  JFK: [['bandpass', 640, 0.6, 0.06, 0.06, 300, 0.09, 0.6], ['bandpass', 1750, 6, 0.012, 0.13, 420, 0.06, 0.8], ['lowpass', 140, 0.7, 0.07, 0.02, 20, 0.05, 0.25]],
  HND: [['bandpass', 460, 0.6, 0.05, 0.045, 200, 0.07, 0.5], ['bandpass', 1300, 5, 0.009, 0.09, 300, 0.06, 0.8], ['lowpass', 120, 0.7, 0.07, 0.02, 20, 0.05, 0.25]],
  DXB: [['bandpass', 320, 0.5, 0.06, 0.035, 140, 0.05, 0.4], ['lowpass', 120, 0.7, 0.075, 0.02, 15, 0.04, 0.2]],
  SXM: [['lowpass', 850, 0.5, 0.06, 0.13, 350, 0.13, 0.85], ['highpass', 3200, 0.5, 0.01, 0.13, 600, 0.13, 0.9], ['lowpass', 110, 0.7, 0.045, 0.02, 15, 0.05, 0.2]],
};

function startAmb(id) {
  if (amb?.id === id) return;
  stopAmb(1.2);
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(1, t + 2);
  g.connect(ambBus);
  const nodes = [];
  for (const [type, freq, q, level, lfoF, lfoDepth, lfoG, gainDepth] of AMBIENCE[id] || WINTER) {
    const lg = ctx.createGain();
    lg.gain.value = level;
    lg.connect(g);
    const f = filter(type, freq, q, lg);
    const src = ctx.createBufferSource();
    src.buffer = pinkBuf;
    src.loop = true;
    src.connect(f);
    src.start(t, Math.random() * 4);
    const l1 = ctx.createOscillator();
    l1.frequency.value = lfoF;
    const l1g = ctx.createGain();
    l1g.gain.value = lfoDepth;
    l1.connect(l1g);
    l1g.connect(f.frequency);
    const l2 = ctx.createOscillator();
    l2.frequency.value = lfoG;
    const l2g = ctx.createGain();
    l2g.gain.value = level * gainDepth;
    l2.connect(l2g);
    l2g.connect(lg.gain);
    l1.start(t);
    l2.start(t);
    nodes.push(src, l1, l2);
  }
  amb = { id, g, nodes };
}

function stopAmb(fade = 0.8) {
  if (!amb || !ctx) return;
  const { g, nodes } = amb;
  const t = ctx.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0.0001, t + fade);
  for (const n of nodes) {
    try { n.stop(t + fade + 0.05); } catch { /* schon gestoppt */ }
  }
  setTimeout(() => g.disconnect(), (fade + 0.2) * 1000);
  amb = null;
}

// Hintergrund-Tab: Audio anhalten
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (!muted) ctx.resume().catch(() => {});
  });
}

export const audio = {
  // Muss in einem Nutzer-Gesten-Handler aufgerufen werden (iOS)
  unlock() {
    // Ohne bisherige Nutzergeste würde der Browser den Kontext blockieren (und warnen)
    if (!ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const c = ensure();
    if (!c) return;
    if (!muted && c.state !== 'running') c.resume().catch(() => {});
    // Stumm gestartet: Kontext ruhen lassen statt mit Lautstärke 0 weiterzurechnen
    else if (muted && c.state === 'running') c.suspend().catch(() => {});
    if (!primed) {
      primed = true;
      // Stiller Puffer schaltet die Ausgabe auf älteren iOS-Versionen frei
      const s = c.createBufferSource();
      s.buffer = c.createBuffer(1, 1, 22050);
      s.connect(c.destination);
      s.start(0);
    }
    if (wantAmbience && !amb) startAmb(wantAmbience);
  },

  play(name, opts = {}) {
    if (muted || !ctx || ctx.state !== 'running') return;
    const fn = SOUNDS[name];
    if (!fn) return;
    const t = ctx.currentTime;
    const prev = lastPlay.get(name);
    if (prev != null && t - prev < (MIN_GAP[name] ?? 0.03)) return;
    if (TRAFFIC.has(name) && trafficVoices >= MAX_TRAFFIC_VOICES) return;
    lastPlay.set(name, t);
    try {
      fn(t + 0.005, opts || {});
    } catch (err) {
      console.warn('[weihad] audio', name, err);
    }
  },

  setMuted(b) {
    muted = !!b;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* privat */ }
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    if (muted) {
      master.gain.linearRampToValueAtTime(0, t + 0.12);
      setTimeout(() => { if (muted) ctx.suspend().catch(() => {}); }, 200);
    } else {
      ctx.resume().catch(() => {});
      master.gain.linearRampToValueAtTime(0.85, t + 0.2);
      if (wantAmbience && !amb) startAmb(wantAmbience);
    }
  },

  get muted() {
    return muted;
  },

  startAmbience(airportId) {
    wantAmbience = String(airportId || 'FRA').toUpperCase();
    if (ctx) startAmb(wantAmbience);
  },

  stopAmbience() {
    wantAmbience = null;
    stopAmb();
  },
};
