// Tokio Haneda (RJTT) – Wintermorgen: Morgenrot über der Bucht, Fuji, Tokyo Tower und Skytree
import { createRng } from '../core/rng.js';
import { linearSky, stars } from './paint.js';

const TAU = Math.PI * 2;

// --- Layout (Ebenen-Koordinaten) --------------------------------------------------------
const HORIZON = 452;   // Wasserlinie der Bucht (far)
const SHORE = 476;     // Nordufer der Flughafeninsel (mid)
const GROUND = 503;    // Grundlinie Terminals/Tower (mid)
const GATE_Y = 522;
const TAXI_Y = 556;
const RWY = { x1: 150, x2: 2250, y: 600, d: 22 };
const SEAWALL = 630;   // Südkante der Insel, davor Wasser
// Sonne gehört zur fernen Ebene: steigt zwischen den Brückentürmen auf
const SUN = { x: 895, y: 378, r: 22 };

const FUJI = { x: 380, top: 150 };
const TT = { x: 1185, h: 190 };    // Tokyo Tower
const ST = { x: 1525, h: 396 };    // Tokyo Skytree
const BR = { a: 718, t1: 800, t2: 990, b: 1072, deck: 422, top: 368 }; // Hängebrücke

// Tower steht hinter Terminal 3 – so überdeckt er bei keinem Schwenk Fuji oder Tokyo Tower
const TWR = { x: 1108, roof: 231, mast: 1080 };
const RADAR = { x: 428, y: 410 };
const HANGAR_A = { x: 28, w: 168, top: 429 };
const T3 = { x1: 470, x2: 1560, mid: 1015, half: 545 };
const T2 = { x1: 1790, x2: 2372, roof: 430 };
const GATES = [
  { x: 545, dir: 1 }, { x: 730, dir: 1 }, { x: 915, dir: 1 }, { x: 1100, dir: 1 }, { x: 1285, dir: 1 }, { x: 1450, dir: 1 },
  { x: 1925, dir: -1 }, { x: 2110, dir: -1 }, { x: 2295, dir: -1 },
];
const T3_ROOF = (x) => { const f = (x - T3.mid) / T3.half; return 414 + 18 * f * f; };

// --- kleine Helfer ------------------------------------------------------------------------
function vg(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function hg(ctx, x0, x1, stops) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function poly(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
// Vereinigung mehrerer Ellipsen als ein Pfad → gleichmäßige Deckkraft
function blob(ctx, list) {
  ctx.beginPath();
  for (const [cx, cy, rx, ry] of list) {
    ctx.moveTo(cx + rx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  }
}
// Weicher Lichtschein; der Verlauf endet in derselben Farbe (sonst entsteht ein Grauschleier)
function glow(ctx, x, y, r, color, alpha = 1) {
  const [cr, cg, cb, ca = 1] = color.slice(color.indexOf('(') + 1, -1).split(',').map(Number);
  const a = ca * alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
  g.addColorStop(0.35, `rgba(${cr},${cg},${cb},${a * 0.42})`);
  g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function disc(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function lamp(ctx, x, y, r, color, halo, haloR = r * 5, haloA = 0.6) {
  glow(ctx, x, y, haloR, halo, haloA);
  disc(ctx, x, y, r, color);
}
function hash(n) {
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13;
  n = Math.imul(n, 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}
// Langgezogener Wolkenschleier aus Ellipsen
function streak(ctx, rng, cx, cy, len, th, top, bottom, alpha) {
  const n = 6 + Math.floor(len / 70);
  const list = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1) - 0.5;
    const k = 1 - Math.abs(f) * 1.1;
    list.push([cx + f * len * 0.9 + rng.range(-1, 1) * len * 0.03, cy + rng.range(-0.3, 0.3) * th,
      len * rng.range(0.12, 0.22) * (0.5 + k * 0.5), th * rng.range(0.4, 0.75) * (0.35 + k * 0.65)]);
  }
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = vg(ctx, cy - th, cy + th * 0.8, [[0, top], [1, bottom]]);
  blob(ctx, list);
  ctx.fill();
  ctx.restore();
}
function ripples(ctx, rng, x0, x1, y0, y1, n, light, dark) {
  for (let i = 0; i < n; i++) {
    const f = rng.next() ** 1.7;
    const y = y0 + (y1 - y0) * f;
    ctx.fillStyle = rng.chance(0.6) ? light : dark;
    ctx.fillRect(rng.range(x0, x1), y, rng.range(5, 30) * (0.5 + f * 1.4), rng.range(0.4, 0.9) * (0.7 + f));
  }
}
// Gemeinsamer Wasserverlauf für mid und near (nahtloser Übergang)
function waterFill(ctx) {
  return vg(ctx, SEAWALL, 720, [[0, '#a596c2'], [0.25, '#8783b2'], [0.6, '#5f6697'], [1, '#434d7d']]);
}

// --- Deterministisches Layout (auch für drawDynamic) ---------------------------------
let LAYOUT = null;
function layout() {
  if (LAYOUT) return LAYOUT;
  const r = createRng(0x48d2e7);
  const L = { farLights: [], ledDots: [], roofLights: [], nearLanterns: [], railLights: [], pineLights: [], stoneLights: [] };

  // Stadt: Dichte um Skytree / Shinjuku-Silhouette
  const dens = (x) => 0.2 + 0.8 * Math.exp(-(((x - 1420) / 280) ** 2)) + 0.55 * Math.exp(-(((x - 1700) / 110) ** 2));
  const roofs = ['flat', 'flat', 'flat', 'antenna', 'step', 'slant', 'crown'];
  L.back = [];
  for (let x = 1000; x < 1815;) {
    const w = r.range(9, 22);
    const t = Math.min(1, (x - 1000) / 150);
    L.back.push({ x, w, h: (14 + dens(x) * 74 + r.range(0, 24)) * t + 6, roof: r.pick(roofs) });
    x += w + r.range(-3, 1.5);
  }
  L.mid = [];
  for (let x = 1060; x < 1815;) {
    const w = r.range(11, 25);
    const t = Math.min(1, (x - 1060) / 110);
    L.mid.push({ x, w, h: (12 + dens(x) * 62 + r.range(0, 30)) * t + 8, roof: r.pick(roofs) });
    x += w + r.range(2, 9);
  }
  L.front = [];
  for (let x = 1090; x < 1815;) {
    const w = r.range(10, 26);
    L.front.push({ x, w, h: r.range(7, 30) + dens(x) * 10, roof: r.pick(['flat', 'flat', 'step', 'slant']) });
    x += w + r.range(0, 5);
  }
  // Industrie (Kawasaki) am linken Ufer
  L.ind = [];
  for (let x = 10; x < 640;) {
    const w = r.range(14, 36);
    L.ind.push({ x, w, h: r.range(4, 15), tank: r.chance(0.3) });
    x += w + r.range(2, 12);
  }
  L.chimneys = [{ x: 118, h: 58 }, { x: 178, h: 44 }, { x: 392, h: 68 }, { x: 538, h: 42 }];
  for (const c of L.chimneys) L.farLights.push({ x: c.x, y: HORIZON - c.h - 1.5, r: 3, period: 1.8, phase: r.next(), kind: 'red' });

  // Hindernisfeuer auf hohen Gebäuden
  for (const b of L.mid) if (b.h > 82) L.farLights.push({ x: b.x + b.w / 2, y: HORIZON - b.h - (b.roof === 'antenna' ? b.h * 0.15 : 2), r: 2.6, period: 1.6 + r.next(), phase: r.next(), kind: 'red' });
  L.farLights.push({ x: ST.x, y: HORIZON - ST.h + 1, r: 5, period: 1.2, phase: 0, kind: 'redStrong' });
  L.farLights.push({ x: ST.x, y: HORIZON - ST.h * 0.745, r: 3, period: 1.2, phase: 0.5, kind: 'red' });
  L.farLights.push({ x: ST.x - 15, y: HORIZON - ST.h * 0.555, r: 2.6, period: 2.0, phase: 0.2, kind: 'red' });
  L.farLights.push({ x: ST.x + 15, y: HORIZON - ST.h * 0.555, r: 2.6, period: 2.0, phase: 0.7, kind: 'red' });
  L.farLights.push({ x: TT.x, y: HORIZON - TT.h, r: 3.5, period: 1.5, phase: 0.3, kind: 'red' });
  L.farLights.push({ x: 456, y: HORIZON - 36, r: 4, period: 0, phase: 0, kind: 'flare' });

  // LED-Weihnachtsbäume (mid): Platz zwischen den Terminals und Aussichtsdeck auf T2
  L.ledTrees = [
    { x: 1676, base: GROUND, h: 120 }, { x: 1598, base: GROUND, h: 46 }, { x: 1756, base: GROUND, h: 40 },
    { x: 1846, base: T2.roof - 1, h: 30 }, { x: 1886, base: T2.roof - 1, h: 40 }, { x: 1928, base: T2.roof - 1, h: 33 }, { x: 1966, base: T2.roof - 1, h: 25 },
  ];
  for (const t of L.ledTrees) {
    t.dots = [];
    const strands = Math.max(7, Math.round(t.h / 6));
    const hw = t.h * 0.3;
    for (let k = 0; k < strands * 2; k++) {
      const front = k % 2 === 0;
      const phi = -Math.PI / 2 + ((k + 0.5) / (strands * 2)) * Math.PI;
      const sx = Math.sin(phi);
      for (let s = 0.06; s <= 1; s += 3.2 / t.h) {
        const p = { x: t.x + sx * hw * s, y: t.base - t.h + s * (t.h - 3), front, blue: r.chance(0.68) };
        t.dots.push(p);
        if (front) {
          p.h = hash(L.ledDots.length);
          L.ledDots.push(p);
        }
      }
    }
  }
  // Lichterkette unter der Dachkante von T3 und an Halle 1
  for (let x = T3.x1 - 12, i = 0; x <= T3.x2 + 12; x += 8, i++) L.roofLights.push({ x, y: T3_ROOF(x) + 10 + Math.sin((x / 64) * Math.PI) * 1.6, blue: i % 3 !== 0 });
  L.hangarLights = [];
  for (let x = HANGAR_A.x + 2, i = 0; x <= HANGAR_A.x + HANGAR_A.w - 2; x += 6, i++) {
    L.hangarLights.push({ x, y: HANGAR_A.top + 2.4 + Math.abs(Math.sin(((x - HANGAR_A.x) / 42) * Math.PI)) * 2.6, blue: i % 3 !== 0 });
  }
  // Anflugbefeuerung (Lauflicht von rechts zur Schwelle)
  L.rabbit = [];
  for (let x = 2398; x > RWY.x2 + 10; x -= 17) L.rabbit.push(x);

  // Vordergrund
  L.pines = [
    {
      trunk: [[230, 716], [190, 622], [306, 540], [262, 374]], w0: 22, w1: 6,
      pads: [[262, 366, 54, 18], [236, 344, 30, 12], [194, 412, 48, 15], [322, 420, 60, 16], [148, 470, 56, 16], [376, 480, 78, 17], [230, 520, 42, 13], [104, 538, 40, 13]],
      yuki: true,
    },
    {
      trunk: [[1700, 716], [1722, 660], [1660, 600], [1688, 512]], w0: 19, w1: 6,
      pads: [[1688, 506, 48, 16], [1712, 486, 28, 11], [1640, 538, 46, 15], [1752, 548, 58, 16], [1600, 578, 42, 13], [1794, 590, 46, 14], [1700, 586, 32, 11]],
      lights: true,
    },
    {
      trunk: [[2862, 716], [2884, 640], [2798, 582], [2830, 432]], w0: 18, w1: 5,
      pads: [[2830, 426, 48, 16], [2806, 410, 26, 10], [2780, 464, 50, 15], [2892, 478, 58, 16], [2740, 516, 44, 14], [2930, 542, 40, 13], [2822, 556, 36, 12]],
    },
  ];
  // Lichter an Kiefer 2 (hängen an den Polsterunterkanten)
  for (const [cx, cy, rx, ry] of L.pines.find((p) => p.lights).pads) {
    for (let a = 0.15; a < Math.PI - 0.1; a += 0.32) L.pineLights.push({ x: cx + Math.cos(a) * rx * 0.92, y: cy + Math.sin(a) * ry * 0.75 + 2, warm: r.chance(0.5) });
  }
  // Winter-Illumination der Yukitsuri-Seile (warme Lämpchen wie in japanischen Gärten)
  const yp = L.pines.find((p) => p.yuki);
  const [ytx, yty] = [yp.trunk[3][0], yp.trunk[3][1] - 64];
  for (const [cx, cy, rx] of yp.pads) {
    for (const s of [-1, 1]) {
      const ex = cx + s * rx * 0.8;
      const ey = cy - 2;
      const len = Math.hypot(ex - ytx, ey - yty);
      for (let d = 18; d < len - 3; d += 13) L.pineLights.push({ x: ytx + ((ex - ytx) * d) / len, y: yty + ((ey - yty) * d) / len, warm: true });
    }
  }
  L.pineLights.forEach((p, i) => { p.h = hash(i + 500); });
  L.stones = [{ x: 560, s: 118 }, { x: 1380, s: 104 }, { x: 2040, s: 120 }];
  for (const s of L.stones) L.stoneLights.push({ x: s.x, y: 714 - s.s * 0.65 });
  L.lanternStrings = [[740, 960, 1180], [2470, 2700]];
  for (const posts of L.lanternStrings) {
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i], b = posts[i + 1];
      const n = Math.round((b - a) / 34);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        L.nearLanterns.push({ x: a + (b - a) * t, y: 566 + Math.sin(t * Math.PI) * 20 + 7, red: (k + i) % 3 !== 1 });
      }
    }
  }
  for (let x = 0; x < 3000; x += 50) {
    for (let k = 0; k < 8; k++) {
      const t = (k + 0.5) / 8;
      L.railLights.push({ x: x + 50 * t, y: 666 + Math.sin(t * Math.PI) * 6, warm: k % 2 === 0, h: hash(L.railLights.length) });
    }
  }
  L.torii = { x: 2330, base: 712 };
  LAYOUT = L;
  return L;
}

// --- Himmel ---------------------------------------------------------------------------------
function crescent(ctx, x, y, r, sx, sy) {
  glow(ctx, x, y, r * 5, 'rgba(225,232,255,0.22)');
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(sy - y, sx - x));
  disc(ctx, 0, 0, r, 'rgba(190,200,240,0.16)'); // Erdschein
  ctx.fillStyle = '#fbf5e6';
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, r * 0.42, r, 0, Math.PI / 2, -Math.PI / 2, true);
  ctx.fill();
  ctx.restore();
}

function drawSun(ctx, rng, { x, y, r }) {
  glow(ctx, x, y, 300, 'rgba(255,190,140,0.42)');
  glow(ctx, x, y, 110, 'rgba(255,226,180,0.8)');
  glow(ctx, x, y, 46, 'rgba(255,246,220,0.9)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(7, 0.42);
  glow(ctx, 0, 0, 56, 'rgba(255,240,210,0.55)');
  ctx.restore();
  const g = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, r);
  g.addColorStop(0, '#fffef8');
  g.addColorStop(0.7, '#fff3d6');
  g.addColorStop(1, '#ffdca0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  // dünne Wolkenbänder vor der Sonne
  streak(ctx, rng, x + 40, y + 6, 260, 4, '#ffcfa6', '#fff0d2', 0.6);
  streak(ctx, rng, x - 70, y + 24, 200, 3.5, '#f6b8a4', '#ffe2c0', 0.55);
}

function paintSky(ctx, { w, h, rng }) {
  linearSky(ctx, w, h, [
    [0, '#1f3166'], [0.16, '#2f4480'], [0.33, '#5862a0'], [0.45, '#9585b8'], [0.53, '#d29bb3'],
    [0.585, '#f3b2a2'], [0.625, '#ffcb9c'], [0.665, '#ffdcb2'], [1, '#ffe6c4'],
  ]);
  // Die Sonnenscheibe malt die ferne Ebene; hier nur der breite warme Schein
  const sx = w * 0.5;
  glow(ctx, sx, SUN.y + 30, Math.max(520, w * 0.6), 'rgba(255,186,150,0.4)');
  stars(ctx, rng, w, 150, Math.round(w / 24), { minR: 0.35, maxR: 1.05, alpha: 0.6 });
  crescent(ctx, Math.max(40, w * 0.12), 94, 9.5, sx, SUN.y);
  // ruhige Schleierwolken, unten vom Morgenrot angestrahlt
  streak(ctx, rng, w * 0.24, 206, w * 0.34, 8, '#8c83b8', '#e7a8bb', 0.5);
  streak(ctx, rng, w * 0.83, 172, w * 0.26, 6, '#7d7bb2', '#d8a0bd', 0.4);
  streak(ctx, rng, w * 0.42, 296, w * 0.42, 11, '#b58db5', '#ffc4aa', 0.55);
  streak(ctx, rng, w * 0.06, 344, w * 0.24, 8, '#c497b6', '#ffcdb0', 0.5);
  streak(ctx, rng, w * 0.92, 326, w * 0.28, 7, '#c598b8', '#ffd0b4', 0.45);
}

// --- Ferne Ebene: Fuji, Bucht, Skyline ----------------------------------------------------
function fujiHW(d) { return 22 + 0.43 * Math.pow(Math.max(0, d), 1.25); }

function drawFuji(ctx, rng) {
  const { x: cx, top } = FUJI;
  const D = HORIZON + 6 - top;
  // Punkt auf dem Kegel: u ∈ [-1, 1] quer zum Hang, d = Tiefe unter dem Gipfel.
  // Linien mit konstantem u sind Falllinien – Schneezungen und Rinnen folgen so dem Hang.
  const at = (u, d) => [cx + u * fujiHW(d), top + d];
  const left = [];
  const right = [];
  for (let d = D; d >= 2; d -= 4) left.push([cx - fujiHW(d) + Math.sin(d * 0.09) * 1.3, top + d]);
  for (let d = 2; d <= D; d += 4) right.push([cx + fujiHW(d) + Math.sin(d * 0.11 + 1) * 1.3, top + d]);
  const rim = [[cx - 22, top + 1], [cx - 15, top - 2.5], [cx - 7, top + 0.5], [cx + 1, top - 3], [cx + 9, top], [cx + 16, top - 1.5], [cx + 22, top + 1]];
  const outline = [...left, ...rim, ...right];
  const ridgeX = (d) => cx + 2 + d * 0.2 + d * d * 0.0009 + Math.sin(d * 0.09) * 3 + Math.sin(d * 0.31) * 1.4 + Math.sin(d * 0.023) * 6;
  const ridge = [];
  for (let d = 0; d <= D; d += 3) ridge.push([ridgeX(d), top + d]);
  const lit = [...ridge, ...right.slice().reverse(), [cx + 22, top + 1], [cx + 16, top - 1.5], [cx + 9, top], [cx + 1, top - 3]];
  const sunny = (u, d) => at(u, d)[0] > ridgeX(d);

  // Schneegrenze d(u): welliger Grundverlauf + Zungen in den Rinnen + Felsgrate, die in den Schnee ragen
  const tongues = [];
  for (let u = -1.06; u < 1.06; u += rng.range(0.026, 0.06)) {
    // zum Rand hin verkürzt: dort sieht man den Hang im Profil
    const edge = Math.max(0.12, 1 - Math.abs(u) ** 1.8);
    const long = rng.chance(0.28 * edge);
    tongues.push([u + rng.range(-0.006, 0.006), rng.range(0.011, 0.022) * (long ? 1.35 : 1), (long ? rng.range(30, 74) : rng.range(5, 22)) * edge]);
    if (rng.chance(0.4)) tongues.push([u + rng.range(0.012, 0.026), rng.range(0.014, 0.03), -rng.range(5, 12) * edge]);
  }
  const base = (u) => 104 + 9 * Math.sin(u * 4.3 + 0.6) + 4 * Math.sin(u * 11.7 + 2.1) + 2.5 * Math.sin(u * 23 + 1);
  const snowD = (u, ext = 0, grow = 1) => {
    let d = base(u) + ext;
    for (const [tu, tw, len] of tongues) {
      const s = Math.abs(u - tu) / (tw * grow);
      if (s < 1) d += (len > 0 ? len * grow : len) * (1 - s) ** 1.3;
    }
    return d;
  };
  const snowPath = (f) => {
    ctx.beginPath();
    ctx.moveTo(cx - 700, top - 40);
    for (let u = -1.1; u <= 1.1; u += 0.0015) {
      const [x, y] = at(u, f(u));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(cx + 700, top - 40);
    ctx.closePath();
  };
  // Schmaler Streifen entlang einer Falllinie; taper: 'both' (Grat/Rinne) oder 'down' (Schneerest unter einer Zunge)
  const fallStreak = (u, d0, d1, wu, color, taper = 'both') => {
    const n = 16;
    const k = (i) => (taper === 'both' ? Math.sin((Math.PI * i) / n) ** 0.7 : (1 - i / n) ** 0.85);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const [x, y] = at(u - wu * k(i), d0 + ((d1 - d0) * i) / n);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    for (let i = n; i >= 0; i--) {
      const [x, y] = at(u + wu * k(i), d0 + ((d1 - d0) * i) / n);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  ctx.save();
  poly(ctx, outline);
  ctx.fillStyle = vg(ctx, top, HORIZON, [[0, '#3c4780'], [0.5, '#4b5590'], [1, '#5f659d']]);
  ctx.fill();
  ctx.clip();
  // Sonnenseite
  poly(ctx, lit);
  ctx.fillStyle = hg(ctx, cx, cx + 560, [[0, '#706fa8'], [0.35, '#827db2'], [1, '#9488bb']]);
  ctx.fill();
  // Rinnen und Grate im Fels unterhalb der Schneegrenze
  for (let i = 0; i < 24; i++) {
    const u = rng.range(-0.86, 0.86);
    const d0 = snowD(u) - 6;
    const d1 = d0 + rng.range(36, 110) * (1 - Math.abs(u) ** 2 * 0.6);
    const sun = sunny(u, d0 + 30);
    fallStreak(u, d0, d1, rng.range(0.007, 0.016), sun ? 'rgba(255,214,206,0.09)' : 'rgba(24,30,76,0.14)');
  }
  // durchscheinender Altschnee als weicher Übergang
  const old = (u) => snowD(u, 13 + 6 * Math.sin(u * 9.1 + 1.3), 1.4);
  snowPath(old);
  ctx.fillStyle = 'rgba(206,208,240,0.26)';
  ctx.fill();
  ctx.save();
  poly(ctx, lit);
  ctx.clip();
  snowPath(old);
  ctx.fillStyle = 'rgba(255,214,208,0.2)';
  ctx.fill();
  ctx.restore();
  // Schneereste in den Rinnen unter langen Zungen
  for (const [tu, tw, len] of tongues) {
    if (len < 26 || Math.abs(tu) > 0.9) continue;
    const d0 = snowD(tu) - 3;
    const sun = sunny(tu, d0);
    fallStreak(tu, d0, d0 + rng.range(10, 30), tw * 0.36, sun ? 'rgba(255,232,226,0.4)' : 'rgba(214,216,242,0.36)', 'down');
  }
  // Schneekappe
  snowPath(snowD);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = vg(ctx, top, top + 170, [[0, '#e6e7f7'], [0.55, '#bfc2e5'], [1, '#a3a8d6']]);
  ctx.fillRect(cx - 300, top - 20, 600, 240);
  poly(ctx, lit);
  ctx.fillStyle = vg(ctx, top, top + 170, [[0, '#fffaf6'], [0.45, '#ffe4dc'], [1, '#f6bcc0']]);
  ctx.fill();
  // Grate im Schnee als weiche Schattenstreifen entlang der Falllinien
  for (let i = 0; i < 12; i++) {
    const u = rng.range(-0.85, 0.85);
    const d0 = rng.range(14, 44);
    const d1 = snowD(u) + 4;
    const sun = sunny(u, (d0 + d1) / 2);
    fallStreak(u, d0, d1, rng.range(0.008, 0.015), sun ? 'rgba(214,140,156,0.13)' : 'rgba(96,100,168,0.14)');
  }
  ctx.restore();
  // Dunst zum Fuß hin
  ctx.fillStyle = vg(ctx, top + 150, HORIZON, [[0, 'rgba(236,188,204,0)'], [0.55, 'rgba(236,188,204,0.3)'], [1, 'rgba(240,196,206,0.66)']]);
  ctx.fillRect(cx - 700, top + 140, 1400, HORIZON - top);
  ctx.restore();
  // Streiflicht an der Sonnenkante (nur im Schnee)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,224,200,0.75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx + 9, top);
  const edgeD = snowD(1) - 6;
  for (let d = 2; d <= edgeD; d += 4) ctx.lineTo(cx + fujiHW(d) + Math.sin(d * 0.11 + 1) * 1.3 - 0.4, top + d);
  ctx.stroke();
  ctx.restore();
}

function hillBand(ctx, x0, x1, baseY, waves, color) {
  ctx.beginPath();
  ctx.moveTo(x0, HORIZON + 2);
  for (let x = x0; x <= x1; x += 5) {
    let y = baseY;
    for (const [f, a, p] of waves) y -= Math.sin(x * f + p) * a;
    const k = Math.min(1, (x1 - x) / 160);
    ctx.lineTo(x, HORIZON - (HORIZON - y) * k);
  }
  ctx.lineTo(x1, HORIZON + 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function industry(ctx, rng, L) {
  for (const b of L.ind) {
    const top = HORIZON + 1 - b.h;
    if (b.tank) {
      const r = Math.min(b.w * 0.4, 9);
      for (let x = b.x + r; x < b.x + b.w - r * 0.5; x += r * 2.3) {
        ctx.fillStyle = hg(ctx, x - r, x + r, [[0, '#7c78a6'], [0.6, '#a59cc4'], [1, '#c3a9c6']]);
        ctx.fillRect(x - r, HORIZON + 1 - r * 0.9, r * 2, r * 0.9);
        ctx.beginPath();
        ctx.ellipse(x, HORIZON + 1 - r * 0.9, r, r * 0.28, 0, Math.PI, TAU);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = vg(ctx, top, HORIZON, [[0, '#8a83b0'], [1, '#a294bd']]);
      ctx.fillRect(b.x, top, b.w, b.h);
      ctx.fillStyle = 'rgba(255,214,180,0.45)';
      ctx.fillRect(b.x, top, b.w, 0.8);
      for (let x = b.x + 2; x < b.x + b.w - 2; x += rng.range(4, 9)) {
        if (rng.chance(0.35)) { ctx.fillStyle = rng.chance(0.7) ? '#ffd58e' : '#f4f2ff'; ctx.fillRect(x, top + rng.range(2, Math.max(2.5, b.h - 3)), 1.1, 1.1); }
      }
    }
  }
  // Schornsteine mit Dampffahnen (vom Morgenlicht rosa angestrahlt)
  for (const c of L.chimneys) {
    const top = HORIZON - c.h;
    ctx.fillStyle = hg(ctx, c.x - 2, c.x + 2, [[0, '#6f6b9c'], [1, '#a194be']]);
    ctx.fillRect(c.x - 1.8, top, 3.6, c.h + 1);
    ctx.fillStyle = '#e0533f';
    ctx.fillRect(c.x - 1.9, top, 3.8, 3);
    ctx.fillRect(c.x - 1.9, top + 6, 3.8, 3);
    ctx.fillStyle = '#f3ecef';
    ctx.fillRect(c.x - 1.9, top + 3, 3.8, 3);
    // dicht überlappende, weiche Puffs → zusammenhängende Fahne statt Perlenschnur
    for (let j = 39; j >= 0; j--) {
      const i = j / 3;
      const px = c.x + i * 5.5 + i * i * 0.75;
      const py = top - 3 - i * 3 + i * i * 0.1;
      const pr = 3 + i * 1.7;
      const a = Math.max(0.03, 0.5 - i * 0.034);
      glow(ctx, px - pr * 0.2, py + pr * 0.35, pr * 1.4, 'rgba(176,160,206,0.5)', a * 0.16);
      glow(ctx, px + pr * 0.1, py - pr * 0.1, pr * 1.45, 'rgba(255,242,240,0.95)', a * 0.5);
    }
  }
  // Abfackel-Mast
  ctx.fillStyle = '#7a76a4';
  ctx.fillRect(455, HORIZON - 34, 2, 35);
  glow(ctx, 456, HORIZON - 38, 10, 'rgba(255,170,80,0.6)');
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath(); ctx.ellipse(456, HORIZON - 38, 1.6, 3.6, 0, 0, TAU); ctx.fill();
}

const ROW_STYLE = {
  back: { top: '#a597c4', bottom: '#c6a8c4', win: 0.05, winA: 0.45, rim: 'rgba(255,214,190,0.5)' },
  mid: { top: '#706f9e', bottom: '#9787b4', win: 0.14, winA: 0.85, rim: 'rgba(255,206,170,0.7)' },
  front: { top: '#585a89', bottom: '#77709f', win: 0.2, winA: 0.95, rim: 'rgba(255,200,160,0.65)' },
};

function building(ctx, rng, b, st) {
  const top = HORIZON + 1 - b.h;
  const x = b.x;
  const w = b.w;
  ctx.fillStyle = vg(ctx, top - 10, HORIZON, [[0, st.top], [1, st.bottom]]);
  ctx.fillRect(x, top, w, b.h + 1);
  ctx.beginPath();
  if (b.roof === 'antenna') {
    ctx.rect(x + w * 0.3, top - 3, w * 0.4, 3);
    ctx.rect(x + w * 0.5 - 0.5, top - 3 - b.h * 0.15, 1, b.h * 0.15);
  } else if (b.roof === 'step') {
    ctx.rect(x + w * 0.15, top - b.h * 0.08, w * 0.7, b.h * 0.08);
    ctx.rect(x + w * 0.3, top - b.h * 0.14, w * 0.4, b.h * 0.06);
  } else if (b.roof === 'slant') {
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, top - w * 0.45);
    ctx.lineTo(x + w, top);
  } else if (b.roof === 'crown') {
    ctx.moveTo(x + w * 0.1, top);
    ctx.lineTo(x + w * 0.5, top - w * 0.5);
    ctx.lineTo(x + w * 0.9, top);
  }
  ctx.fill();
  if (st.win > 0) {
    ctx.save();
    ctx.globalAlpha = st.winA;
    for (let yy = top + 3; yy < HORIZON - 3; yy += 3.6) {
      for (let xx = x + 1.6; xx < x + w - 2; xx += 2.8) {
        if (rng.chance(st.win)) {
          ctx.fillStyle = rng.chance(0.75) ? '#ffd690' : '#e8f0ff';
          ctx.fillRect(xx, yy, 1.2, 1.5);
        }
      }
    }
    ctx.restore();
  }
  ctx.fillStyle = st.rim;
  ctx.fillRect(x < SUN.x ? x + w - 1 : x, top, 1, b.h);
}

function drawSkytree(ctx, x, base, H) {
  const yAt = (t) => base - H * t;
  const prof = (t) => {
    if (t < 0.53) return 6.6 + 15.5 * Math.pow(1 - t / 0.53, 1.9);
    if (t < 0.7) return 6.6 - ((t - 0.53) / 0.17) * 1.3;
    if (t < 0.76) return 4.6;
    return 2.8 - ((t - 0.76) / 0.24) * 1.9;
  };
  glow(ctx, x, yAt(0.45), 170, 'rgba(110,160,255,0.22)');
  glow(ctx, x, yAt(0.62), 60, 'rgba(160,200,255,0.3)');
  const pts = [];
  for (let t = 0; t <= 1.0001; t += 0.01) pts.push([x - prof(t), yAt(t)]);
  for (let t = 1; t >= -0.0001; t -= 0.01) pts.push([x + prof(t), yAt(t)]);
  ctx.save();
  poly(ctx, pts);
  ctx.fillStyle = hg(ctx, x - 22, x + 22, [[0, '#9fb3e2'], [0.42, '#eef3ff'], [0.62, '#dbe5fb'], [1, '#8ea3d6']]);
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = vg(ctx, yAt(0.76), base, [[0, 'rgba(110,170,255,0.12)'], [1, 'rgba(100,160,255,0.38)']]);
  ctx.fillRect(x - 25, yAt(0.76), 50, H * 0.76 + 2);
  ctx.strokeStyle = 'rgba(60,110,210,0.5)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let y = yAt(0.76) - 30; y < base; y += 4.5) {
    ctx.moveTo(x - 25, y);
    ctx.lineTo(x + 25, y + 30);
    ctx.moveTo(x + 25, y);
    ctx.lineTo(x - 25, y + 30);
  }
  ctx.stroke();
  ctx.restore();
  // Aussichtsdecks
  const deck = (y, hw, h) => {
    ctx.fillStyle = '#e6edfc';
    ctx.beginPath();
    ctx.ellipse(x, y, hw, h / 2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8fa5d8';
    ctx.fillRect(x - hw + 1, y + h * 0.18, hw * 2 - 2, h * 0.22);
    ctx.fillStyle = '#fff1c9';
    ctx.fillRect(x - hw + 1.5, y - h * 0.18, hw * 2 - 3, h * 0.26);
  };
  deck(yAt(0.565), 14, 6);
  deck(yAt(0.548), 15.5, 7);
  deck(yAt(0.532), 13, 5);
  deck(yAt(0.712), 9.5, 5);
  ctx.fillStyle = '#c9d6f4';
  ctx.fillRect(x - 0.6, yAt(1) - 2, 1.2, 3);
}

function drawTokyoTower(ctx, x, base, H) {
  const yAt = (t) => base - H * t;
  const prof = (t) => {
    if (t < 0.4) return 7.5 + 27 * Math.pow(1 - t / 0.4, 2.1);
    if (t < 0.44) return 7.5;
    if (t < 0.7) return 7 - ((t - 0.44) / 0.26) * 3.4;
    if (t < 0.725) return 3.6;
    return 2.2 - ((t - 0.725) / 0.275) * 1.6;
  };
  glow(ctx, x, yAt(0.3), 120, 'rgba(255,140,70,0.32)');
  glow(ctx, x, yAt(0.55), 50, 'rgba(255,190,120,0.35)');
  const pts = [];
  for (let t = 0; t <= 1.0001; t += 0.01) pts.push([x - prof(t), yAt(t)]);
  for (let t = 1; t >= -0.0001; t -= 0.01) pts.push([x + prof(t), yAt(t)]);
  ctx.save();
  poly(ctx, pts);
  // Bogen zwischen den Beinen
  ctx.moveTo(x - 22, base + 0.5);
  ctx.quadraticCurveTo(x, base - 64, x + 22, base + 0.5);
  ctx.closePath();
  ctx.clip('evenodd');
  const bands = [[0, 0.13, 0], [0.13, 0.17, 1], [0.17, 0.29, 0], [0.29, 0.33, 1], [0.33, 0.44, 0], [0.44, 0.5, 1], [0.5, 0.56, 0],
    [0.56, 0.62, 1], [0.62, 0.725, 0], [0.725, 0.8, 1], [0.8, 0.87, 0], [0.87, 0.93, 1], [0.93, 1.01, 0]];
  for (const [a, b, white] of bands) {
    ctx.fillStyle = white ? '#f6ece6' : '#f2572c';
    ctx.fillRect(x - 40, yAt(b), 80, yAt(a) - yAt(b) + 0.2);
  }
  ctx.fillStyle = hg(ctx, x - 36, x + 36, [[0, 'rgba(255,230,190,0.3)'], [0.4, 'rgba(255,230,190,0.1)'], [0.55, 'rgba(70,20,60,0)'], [1, 'rgba(70,20,60,0.38)']]);
  ctx.fillRect(x - 40, yAt(1), 80, H + 2);
  ctx.strokeStyle = 'rgba(120,30,20,0.5)';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  for (let y = yAt(0.72) - 40; y < base; y += 4) {
    ctx.moveTo(x - 40, y);
    ctx.lineTo(x + 40, y + 40);
    ctx.moveTo(x + 40, y);
    ctx.lineTo(x - 40, y + 40);
  }
  ctx.stroke();
  ctx.restore();
  // Aussichtsdecks
  ctx.fillStyle = '#f7efe8';
  ctx.fillRect(x - 12, yAt(0.445), 24, H * 0.045);
  ctx.fillStyle = '#ffd58c';
  ctx.fillRect(x - 11, yAt(0.437), 22, 2.4);
  ctx.fillStyle = '#f7efe8';
  ctx.fillRect(x - 6, yAt(0.73), 12, 4);
  ctx.fillStyle = '#ffd58c';
  ctx.fillRect(x - 5.2, yAt(0.725), 10.4, 1.4);
}

function specialBuildings(ctx, rng) {
  const base = HORIZON + 1;
  // Zwillingsturm mit gestuften Kronen (Rathaus-Silhouette)
  ctx.fillStyle = vg(ctx, base - 160, base, [[0, '#6c6b9b'], [1, '#9284b2']]);
  ctx.fillRect(1676, base - 74, 66, 74);
  for (const tx of [1678, 1720]) {
    ctx.fillRect(tx, base - 142, 20, 142);
    ctx.fillRect(tx + 3, base - 152, 14, 10);
    ctx.fillRect(tx + 6, base - 158, 8, 6);
    ctx.fillStyle = 'rgba(255,206,170,0.7)';
    ctx.fillRect(tx, base - 142, 1, 142);
    ctx.fillStyle = vg(ctx, base - 160, base, [[0, '#6c6b9b'], [1, '#9284b2']]);
  }
  // Kokon-Turm
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(1618, base - 64, 10, 66, 0, 0, TAU);
  ctx.fillStyle = hg(ctx, 1608, 1628, [[0, '#7f80b2'], [0.5, '#a9a5cf'], [1, '#6c6b9b']]);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(230,230,255,0.35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let y = base - 140; y < base; y += 7) { ctx.moveTo(1606, y); ctx.lineTo(1630, y + 12); ctx.moveTo(1630, y); ctx.lineTo(1606, y + 12); }
  ctx.stroke();
  ctx.restore();
  // Breiter Turm mit runder Krone
  ctx.fillStyle = vg(ctx, base - 130, base, [[0, '#6f6e9e'], [1, '#9587b4']]);
  ctx.fillRect(1290, base - 116, 30, 116);
  ctx.beginPath();
  ctx.ellipse(1305, base - 116, 15, 6, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,206,170,0.6)';
  ctx.fillRect(1290, base - 116, 1, 116);
  ctx.save();
  ctx.globalAlpha = 0.8;
  for (let y = base - 110; y < base - 4; y += 3.6) for (let x = 1292; x < 1318; x += 2.8) if (rng.chance(0.16)) { ctx.fillStyle = '#ffd690'; ctx.fillRect(x, y, 1.2, 1.5); }
  ctx.restore();
  // Spitzturm mit Uhr-Krone
  ctx.fillStyle = vg(ctx, base - 150, base, [[0, '#67679a'], [1, '#9184b2']]);
  ctx.fillRect(1652, base - 120, 18, 120);
  ctx.fillRect(1655, base - 132, 12, 12);
  ctx.beginPath();
  ctx.moveTo(1656, base - 132);
  ctx.lineTo(1661, base - 156);
  ctx.lineTo(1666, base - 132);
  ctx.fill();
  ctx.fillStyle = '#fff1cf';
  ctx.beginPath(); ctx.arc(1661, base - 126, 2, 0, TAU); ctx.fill();
}

function drawBridge(ctx) {
  const { a, t1, t2, b, deck, top } = BR;
  const wl = HORIZON + 7;
  // Pfeiler der Rampen
  ctx.fillStyle = '#a49cc4';
  for (let x = a - 66; x <= b + 60; x += 22) {
    if (x > a + 4 && x < b - 4) continue;
    ctx.fillRect(x - 1, deck + 6, 2, wl - deck - 6);
  }
  // Fahrbahn (zweistöckig mit Fachwerk)
  const dl = a - 72;
  const dr = b + 66;
  ctx.fillStyle = '#efe8f0';
  ctx.fillRect(dl, deck, dr - dl, 2.4);
  ctx.fillStyle = '#c8c0da';
  ctx.fillRect(dl, deck + 5.6, dr - dl, 1.8);
  ctx.strokeStyle = 'rgba(120,112,160,0.85)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = dl; x < dr; x += 4) { ctx.moveTo(x, deck + 2.4); ctx.lineTo(x + 2, deck + 5.6); ctx.lineTo(x + 4, deck + 2.4); }
  ctx.stroke();
  // Türme
  for (const tx of [t1, t2]) {
    for (const s of [-1, 1]) {
      ctx.fillStyle = s < 0 ? '#c2bcd8' : '#f6eef2';
      ctx.fillRect(tx + s * 5 - 1.7, top, 3.4, wl - top);
    }
    ctx.fillStyle = '#efe7ef';
    for (const yy of [top, top + 16, deck + 8]) ctx.fillRect(tx - 7, yy, 14, 2.2);
    ctx.fillStyle = 'rgba(255,215,195,0.8)';
    ctx.fillRect(tx + 5.7, top, 0.8, wl - top);
  }
  // Tragseile
  const mid = (t1 + t2) / 2;
  const cable = (x) => {
    if (x <= t1) { const f = (x - a) / (t1 - a); return deck - 1 + (top + 2 - deck + 1) * f * f; }
    if (x >= t2) { const f = (b - x) / (b - t2); return deck - 1 + (top + 2 - deck + 1) * f * f; }
    const f = (x - mid) / (t2 - mid);
    return deck - 3 + (top + 2 - deck + 3) * f * f;
  };
  ctx.strokeStyle = 'rgba(240,232,242,0.85)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  for (let x = a + 4; x < b; x += 3.5) {
    if (Math.abs(x - t1) < 3 || Math.abs(x - t2) < 3) continue;
    ctx.moveTo(x, cable(x));
    ctx.lineTo(x, deck);
  }
  ctx.stroke();
  ctx.strokeStyle = '#f4ecf2';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(a, cable(a));
  for (let x = a; x <= b; x += 2) ctx.lineTo(x, cable(x));
  ctx.stroke();
  // Beleuchtung
  for (let x = a + 3; x < b; x += 7) disc(ctx, x, cable(x) - 0.3, 0.55, '#fffbe8');
  for (let x = dl + 2; x < dr; x += 5) disc(ctx, x, deck - 0.4, 0.5, '#fff2c8');
  glow(ctx, (t1 + t2) / 2, deck - 10, 120, 'rgba(255,240,220,0.12)');
}

function paintFar(ctx, w, rng) {
  const L = layout();
  drawSun(ctx, rng, SUN);
  // Bucht
  ctx.fillStyle = vg(ctx, HORIZON, 720, [[0, '#e1b2bc'], [0.05, '#b6a0c3'], [0.2, '#8d88b6'], [1, '#56608f']]);
  ctx.fillRect(-10, HORIZON, w + 20, 720 - HORIZON);
  ripples(ctx, rng, -20, w, HORIZON + 2, 720, 340, 'rgba(255,226,214,0.28)', 'rgba(60,64,112,0.2)');
  drawFuji(ctx, rng);
  streak(ctx, rng, 340, 326, 400, 8, '#c39fc0', '#ffd2c0', 0.5);
  streak(ctx, rng, 690, 372, 520, 7, '#b49ac2', '#f9c6b8', 0.45);
  hillBand(ctx, -20, 1120, 428, [[0.006, 10, 0.3], [0.017, 5, 1.7], [0.041, 2, 0.4]], '#ab9bc4');
  hillBand(ctx, -20, 990, 440, [[0.008, 7, 2.1], [0.023, 4, 0.9], [0.05, 1.5, 0.2]], '#958cba');
  industry(ctx, rng, L);
  for (const b of L.back) building(ctx, rng, b, ROW_STYLE.back);
  drawSkytree(ctx, ST.x, HORIZON + 1, ST.h);
  for (const b of L.mid) building(ctx, rng, b, ROW_STYLE.mid);
  specialBuildings(ctx, rng);
  drawTokyoTower(ctx, TT.x, HORIZON + 1, TT.h);
  for (const b of L.front) building(ctx, rng, b, ROW_STYLE.front);
  // Kugelbau am Ufer (Odaiba)
  const ox = 1150;
  ctx.fillStyle = '#6c6b9b';
  ctx.fillRect(ox - 15, HORIZON - 34, 4, 35);
  ctx.fillRect(ox + 11, HORIZON - 34, 4, 35);
  ctx.fillRect(ox - 15, HORIZON - 36, 30, 4);
  ctx.fillRect(ox - 15, HORIZON - 14, 30, 3);
  const sg = ctx.createRadialGradient(ox - 4, HORIZON - 26, 1, ox - 2, HORIZON - 24, 8);
  sg.addColorStop(0, '#f6f0ff');
  sg.addColorStop(0.6, '#c0bbe0');
  sg.addColorStop(1, '#8a86b6');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(ox - 2, HORIZON - 24, 7.5, 0, TAU); ctx.fill();
  drawBridge(ctx);
  // Uferlinie
  ctx.fillStyle = 'rgba(70,70,120,0.55)';
  ctx.fillRect(-10, HORIZON, w + 20, 1.3);
  ctx.fillStyle = 'rgba(255,230,220,0.35)';
  ctx.fillRect(-10, HORIZON + 1.3, w + 20, 0.7);
  // Spiegelungen der Wahrzeichen
  const refl = (x, wid, color, n) => {
    ctx.fillStyle = color;
    for (let k = 0; k < n; k++) ctx.fillRect(x - wid / 2 + Math.sin(k * 1.7) * 1.4, HORIZON + 2.5 + k * 2.3, wid * (1 - k / (n + 2)), 1.1);
  };
  refl(TT.x, 9, 'rgba(255,140,80,0.4)', 10);
  refl(ST.x, 7, 'rgba(150,195,255,0.4)', 10);
  refl((BR.t1 + BR.t2) / 2, 150, 'rgba(255,246,230,0.16)', 4);
  for (const b of L.front) if (rng.chance(0.4)) refl(b.x + b.w / 2, 3, 'rgba(255,214,150,0.25)', 5);
}

// --- Mittlere Ebene: der Flughafen --------------------------------------------------------
function landside(ctx, rng, w) {
  // Straße hinter den Terminals
  ctx.fillStyle = '#a4a6c4';
  ctx.fillRect(-10, 487, w + 20, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let x = 0; x < w; x += 18) ctx.fillRect(x, 489.6, 8, 0.6);
  // kleine verschneite Bäume und Laternen in den Lücken
  for (const x of [8, 18, 338, 466, 1572, 1586, 1770, 1780, 2384, 2394]) {
    const hh = rng.range(10, 15);
    ctx.fillStyle = '#4a5f66';
    ctx.beginPath(); ctx.moveTo(x - hh * 0.32, 488); ctx.lineTo(x, 488 - hh); ctx.lineTo(x + hh * 0.32, 488); ctx.fill();
    ctx.fillStyle = '#eef1fa';
    ctx.beginPath(); ctx.moveTo(x - hh * 0.18, 488 - hh * 0.45); ctx.lineTo(x, 488 - hh); ctx.lineTo(x + hh * 0.18, 488 - hh * 0.45); ctx.fill();
  }
}

function hangars(ctx, rng, L) {
  // Halle A – Flachdach (Versteck)
  const { x: ax, w: aw, top: at } = HANGAR_A;
  ctx.fillStyle = vg(ctx, at, GROUND, [[0, '#b9bdd6'], [1, '#c9cce0']]);
  ctx.fillRect(ax, at, aw, GROUND - at);
  ctx.fillStyle = '#8f94b5';
  ctx.fillRect(ax, at + 2, aw, 15);
  ctx.strokeStyle = 'rgba(70,76,120,0.55)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let x = ax; x < ax + aw; x += 12) { ctx.moveTo(x, at + 17); ctx.lineTo(x + 6, at + 2); ctx.lineTo(x + 12, at + 17); }
  ctx.stroke();
  // Tore
  for (let x = ax + 4, i = 0; x < ax + aw - 4; x += 16, i++) {
    ctx.fillStyle = i % 2 ? '#cfd2e5' : '#c2c6dc';
    ctx.fillRect(x, at + 19, 15.4, GROUND - at - 19);
    ctx.fillStyle = 'rgba(80,86,130,0.25)';
    ctx.fillRect(x, at + 19, 0.8, GROUND - at - 19);
  }
  // halb offenes Tor mit warmem Innenlicht
  ctx.fillStyle = vg(ctx, at + 19, GROUND, [[0, '#e9b07a'], [1, '#ffd9a0']]);
  ctx.fillRect(ax + 68, at + 19, 30, GROUND - at - 19);
  ctx.strokeStyle = 'rgba(150,90,40,0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(ax + 70, GROUND - 22); ctx.lineTo(ax + 96, GROUND - 22);
  ctx.moveTo(ax + 74, GROUND - 22); ctx.lineTo(ax + 74, GROUND);
  ctx.moveTo(ax + 92, GROUND - 22); ctx.lineTo(ax + 92, GROUND);
  ctx.stroke();
  ctx.fillStyle = '#f6f8ff';
  ctx.fillRect(ax - 2, at - 2.5, aw + 4, 3.2);
  ctx.fillStyle = 'rgba(255,214,200,0.8)';
  ctx.fillRect(ax - 2, at - 2.8, aw + 4, 0.7);
  ctx.fillStyle = '#3d4675';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('1', ax + aw / 2, at + 13);
  for (const x of [ax + 30, ax + aw - 30]) lamp(ctx, x, at + 18, 1.3, '#fff8e8', 'rgba(255,240,200,0.7)', 9);
  // Lichterkette an der Dachkante
  ctx.strokeStyle = 'rgba(40,40,70,0.5)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  L.hangarLights.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  for (const p of L.hangarLights) lamp(ctx, p.x, p.y, 0.8, p.blue ? '#9cc8ff' : '#fff6e2', p.blue ? 'rgba(110,170,255,0.55)' : 'rgba(255,240,210,0.55)', 4);

  // Halle B – Tonnendach
  const bx = 210;
  const bw = 122;
  const bt = 448;
  ctx.fillStyle = vg(ctx, bt - 16, GROUND, [[0, '#b2b6d2'], [1, '#c6c9df']]);
  ctx.beginPath();
  ctx.moveTo(bx, GROUND);
  ctx.lineTo(bx, bt);
  ctx.quadraticCurveTo(bx + bw / 2, bt - 30, bx + bw, bt);
  ctx.lineTo(bx + bw, GROUND);
  ctx.fill();
  ctx.strokeStyle = '#f4f6fd';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(bx - 1, bt + 0.5);
  ctx.quadraticCurveTo(bx + bw / 2, bt - 30.5, bx + bw + 1, bt + 0.5);
  ctx.stroke();
  ctx.fillStyle = vg(ctx, bt + 6, GROUND, [[0, '#d99a6c'], [1, '#ffd49a']]);
  ctx.fillRect(bx + 8, bt + 6, bw - 16, GROUND - bt - 6);
  for (let x = bx + 8, i = 0; x < bx + bw - 8; x += 13, i++) {
    if (i >= 3 && i <= 5) continue;
    ctx.fillStyle = i % 2 ? '#c9cce1' : '#bcc0d8';
    ctx.fillRect(x, bt + 6, 12.6, GROUND - bt - 6);
  }
  ctx.fillStyle = 'rgba(130,80,40,0.55)';
  ctx.fillRect(bx + 50, GROUND - 26, 26, 1.2);
  ctx.fillRect(bx + 54, GROUND - 26, 1.2, 26);
  ctx.fillRect(bx + 70, GROUND - 26, 1.2, 26);
  glow(ctx, bx + 61, GROUND - 20, 30, 'rgba(255,200,130,0.35)');
}

function hanedaTower(ctx) {
  const x = TWR.x;
  // Schaft (Fuß steht hinter dem Terminal)
  ctx.beginPath();
  ctx.moveTo(x - 11, 476);
  ctx.lineTo(x - 8.5, 300);
  ctx.lineTo(x + 8.5, 300);
  ctx.lineTo(x + 11, 476);
  ctx.closePath();
  ctx.fillStyle = hg(ctx, x - 11, x + 11, [[0, '#9ca2c4'], [0.35, '#eef0f8'], [0.55, '#e2e5f2'], [1, '#8e94b8']]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,220,160,0.75)';
  for (let y = 310; y < 470; y += 9) ctx.fillRect(x - 1, y, 2, 4.5);
  ctx.fillStyle = 'rgba(120,126,170,0.5)';
  ctx.fillRect(x - 9.5, 360, 19, 1.4);
  ctx.fillRect(x - 10.2, 420, 20.4, 1.4);
  // ausgestellter Hals
  ctx.beginPath();
  ctx.moveTo(x - 8.5, 302);
  ctx.quadraticCurveTo(x - 10, 284, x - 24, 272);
  ctx.lineTo(x + 24, 272);
  ctx.quadraticCurveTo(x + 10, 284, x + 8.5, 302);
  ctx.closePath();
  ctx.fillStyle = hg(ctx, x - 24, x + 24, [[0, '#a4aacb'], [0.4, '#f1f3fa'], [1, '#9298bc']]);
  ctx.fill();
  // Technikgeschoss
  ctx.fillStyle = '#5c6389';
  ctx.fillRect(x - 25, 262, 50, 10);
  ctx.fillStyle = 'rgba(255,220,160,0.8)';
  for (let wx = x - 22; wx < x + 21; wx += 5) ctx.fillRect(wx, 265.5, 2.6, 2.4);
  // Kanzel (nach außen geneigtes Glas)
  ctx.beginPath();
  ctx.moveTo(x - 25, 262);
  ctx.lineTo(x - 31, 238);
  ctx.lineTo(x + 31, 238);
  ctx.lineTo(x + 25, 262);
  ctx.closePath();
  ctx.fillStyle = vg(ctx, 238, 262, [[0, '#33507e'], [0.5, '#4f7aa6'], [1, '#79b7c4']]);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,240,210,0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(25,35,70,0.7)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = -5; i <= 5; i++) { ctx.moveTo(x + i * 4.6, 262); ctx.lineTo(x + i * 5.6, 238); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,220,230,0.35)';
  ctx.beginPath();
  ctx.moveTo(x + 6, 240); ctx.lineTo(x + 16, 240); ctx.lineTo(x + 12, 260); ctx.lineTo(x + 3, 260);
  ctx.fill();
  // Dach (Versteck-Kante)
  ctx.fillStyle = vg(ctx, TWR.roof, TWR.roof + 7, [[0, '#fbfbff'], [1, '#b9bdd8']]);
  ctx.fillRect(x - 37, TWR.roof, 74, 7);
  ctx.fillStyle = '#f7f9ff';
  ctx.beginPath();
  ctx.moveTo(x - 37.5, TWR.roof + 0.5);
  ctx.quadraticCurveTo(x - 20, TWR.roof - 3.6, x, TWR.roof - 2.6);
  ctx.quadraticCurveTo(x + 20, TWR.roof - 3.8, x + 37.5, TWR.roof + 0.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,205,190,0.8)';
  ctx.fillRect(x + 20, TWR.roof - 2.2, 17, 0.8);
  // Mast mit Antennen am linken Rand
  ctx.fillStyle = '#d7dbea';
  ctx.fillRect(TWR.mast - 1, 199, 2, TWR.roof - 199);
  ctx.fillRect(TWR.mast - 5, 214, 10, 1.2);
  ctx.fillRect(TWR.mast - 3.5, 206, 7, 1);
  ctx.fillStyle = '#eef1fa';
  ctx.beginPath(); ctx.arc(TWR.mast + 7, TWR.roof - 4, 4, Math.PI, TAU); ctx.fill();
}

// Betriebsgebäude mit Feuerwache und Radarturm (Antenne dreht sich in drawDynamic)
function opsBuilding(ctx, rng) {
  const x1 = 344;
  const x2 = 462;
  const top = 470;
  ctx.fillStyle = vg(ctx, top, GROUND, [[0, '#c3c6dc'], [1, '#b0b4cf']]);
  ctx.fillRect(x1, top, x2 - x1, GROUND - top);
  ctx.fillStyle = '#5a6088';
  ctx.fillRect(x1, top + 4, x2 - x1, 6);
  ctx.fillStyle = 'rgba(255,220,160,0.9)';
  for (let x = x1 + 4; x < x2 - 4; x += 7) if (rng.chance(0.7)) ctx.fillRect(x, top + 5.5, 4, 3);
  for (let i = 0; i < 4; i++) {
    const dx = x1 + 8 + i * 22;
    ctx.fillStyle = '#c63f37';
    ctx.fillRect(dx, top + 15, 18, GROUND - top - 15);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let k = 1; k < 4; k++) ctx.fillRect(dx, top + 15 + k * 4.4, 18, 0.6);
    ctx.fillStyle = 'rgba(255,230,190,0.85)';
    ctx.fillRect(dx + 2, top + 16.5, 14, 2.2);
  }
  ctx.fillStyle = '#f6f8ff';
  ctx.fillRect(x1 - 2, top - 2.4, x2 - x1 + 4, 3);
  // Schlauchturm
  ctx.fillStyle = vg(ctx, 448, top, [[0, '#d2d5e6'], [1, '#b6bad3']]);
  ctx.fillRect(x1 + 2, 448, 14, top - 448);
  ctx.fillStyle = '#f6f8ff';
  ctx.fillRect(x1 + 1, 446, 16, 2.6);
  ctx.fillStyle = '#c63f37';
  ctx.fillRect(x1 + 2, 452, 14, 2);
  // Radarturm (Gitter)
  const { x, y } = RADAR;
  ctx.strokeStyle = '#7d82a6';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - 9, top); ctx.lineTo(x - 4, y + 8);
  ctx.moveTo(x + 9, top); ctx.lineTo(x + 4, y + 8);
  for (let yy = top; yy > y + 10; yy -= 9) {
    const k = (top - yy) / (top - y - 8);
    const hw = 9 - 5 * k;
    const hw2 = 9 - 5 * Math.min(1, (top - yy + 9) / (top - y - 8));
    ctx.moveTo(x - hw, yy); ctx.lineTo(x + hw2, yy - 9);
    ctx.moveTo(x + hw, yy); ctx.lineTo(x - hw2, yy - 9);
  }
  ctx.stroke();
  ctx.fillStyle = '#9ca2c2';
  ctx.fillRect(x - 6, y + 6, 12, 3);
  ctx.fillRect(x - 1.5, y + 2, 3, 4);
  ctx.fillStyle = '#f6f8ff';
  ctx.fillRect(x - 6.5, y + 5, 13, 1.2);
}

function ledTree(ctx, t, big) {
  const hw = t.h * 0.3;
  glow(ctx, t.x, t.base - t.h * 0.45, t.h * (big ? 1.0 : 0.9), 'rgba(100,160,255,0.45)');
  ctx.beginPath();
  ctx.moveTo(t.x, t.base - t.h);
  ctx.lineTo(t.x + hw, t.base - 2);
  ctx.lineTo(t.x - hw, t.base - 2);
  ctx.closePath();
  ctx.fillStyle = vg(ctx, t.base - t.h, t.base, [[0, 'rgba(40,70,150,0.45)'], [1, 'rgba(30,50,120,0.6)']]);
  ctx.fill();
  for (const p of t.dots) {
    if (p.front) continue;
    disc(ctx, p.x, p.y, 0.55, p.blue ? 'rgba(90,150,255,0.55)' : 'rgba(220,235,255,0.5)');
  }
  for (const p of t.dots) {
    if (!p.front) continue;
    disc(ctx, p.x, p.y, 0.8, p.blue ? '#6fb0ff' : '#f4f9ff');
  }
  // Stern
  const sy = t.base - t.h - 3;
  const r = big ? 6 : 3;
  glow(ctx, t.x, sy, r * 4, 'rgba(255,240,190,0.7)');
  ctx.fillStyle = '#fff5cf';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    ctx.lineTo(t.x + Math.cos(a) * rr, sy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  // Sockel
  ctx.fillStyle = '#eef1fa';
  ctx.beginPath();
  ctx.ellipse(t.x, t.base - 1, hw * 1.05, 2.2, 0, 0, TAU);
  ctx.fill();
}

function plaza(ctx, rng, L) {
  // Parkhaus / Bahnhof
  const x1 = 1574;
  const x2 = 1782;
  const top = 472;
  ctx.fillStyle = vg(ctx, top, GROUND, [[0, '#9a9cc0'], [1, '#8a8db3']]);
  ctx.fillRect(x1, top, x2 - x1, GROUND - top);
  for (let y = top + 6; y < GROUND - 4; y += 11) {
    ctx.fillStyle = 'rgba(40,44,80,0.55)';
    ctx.fillRect(x1 + 3, y, x2 - x1 - 6, 5);
    ctx.fillStyle = 'rgba(255,214,150,0.55)';
    ctx.fillRect(x1 + 3, y + 0.5, x2 - x1 - 6, 1);
  }
  ctx.fillStyle = '#d9dcec';
  ctx.fillRect(x1 - 2, top - 2, x2 - x1 + 4, 2.4);
  ctx.fillStyle = '#eef1fa';
  ctx.fillRect(x1 - 2, top - 3.4, x2 - x1 + 4, 1.4);
  for (const t of L.ledTrees.slice(0, 3)) ledTree(ctx, t, t.h > 100);
}

function glassFacade(ctx, rng, x1, x2, topAt, bottom, seed) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, bottom);
  for (let x = x1; x <= x2; x += 10) ctx.lineTo(x, topAt(x));
  ctx.lineTo(x2, topAt(x2));
  ctx.lineTo(x2, bottom);
  ctx.closePath();
  ctx.fillStyle = vg(ctx, 418, bottom, [[0, '#454d82'], [0.3, '#76739f'], [0.68, '#cf9ea8'], [1, '#f7c58f']]);
  ctx.fill();
  ctx.clip();
  // Spiegelungen
  ctx.fillStyle = 'rgba(255,228,236,0.12)';
  for (let x = x1 + 20 + (seed % 40); x < x2; x += rng.range(90, 170)) {
    const wdt = rng.range(18, 50);
    ctx.beginPath();
    ctx.moveTo(x, 400); ctx.lineTo(x + wdt, 400); ctx.lineTo(x + wdt - 40, bottom); ctx.lineTo(x - 40, bottom);
    ctx.fill();
  }
  // Baumstützen im Inneren
  ctx.strokeStyle = 'rgba(52,56,100,0.32)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let x = x1 + 60; x < x2 - 20; x += 136) {
    ctx.moveTo(x, bottom); ctx.lineTo(x, 470);
    ctx.lineTo(x - 16, topAt(x - 16) + 2);
    ctx.moveTo(x, 470); ctx.lineTo(x + 16, topAt(x + 16) + 2);
  }
  ctx.stroke();
  // Deckenlichter und Reisende
  for (let x = x1 + 8; x < x2 - 4; x += 16) {
    ctx.fillStyle = 'rgba(255,236,200,0.85)';
    ctx.fillRect(x, topAt(x) + 7, 3, 0.9);
  }
  for (let x = x1 + 4; x < x2 - 4; x += rng.range(3, 14)) {
    if (!rng.chance(0.55)) continue;
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(60,44,70,0.55)' : 'rgba(90,60,90,0.45)';
    const hh = rng.range(3.4, 4.6);
    ctx.fillRect(x, 466 - hh, 1.4, hh);
    if (rng.chance(0.4)) ctx.fillRect(x + rng.range(-1, 1), bottom - hh, 1.4, hh);
  }
  // Pfosten und Riegel
  ctx.fillStyle = 'rgba(36,42,86,0.55)';
  for (let x = x1; x <= x2; x += 11) ctx.fillRect(x, topAt(x), 0.9, bottom - topAt(x));
  ctx.fillStyle = '#3a4070';
  ctx.fillRect(x1, 466, x2 - x1, 2);
  ctx.fillStyle = 'rgba(36,42,86,0.45)';
  ctx.fillRect(x1, 447, x2 - x1, 0.8);
  ctx.fillRect(x1, 480, x2 - x1, 0.8);
  ctx.restore();
}

function terminal3(ctx, rng, L) {
  const { x1, x2 } = T3;
  const glassTop = (x) => T3_ROOF(x) + 11;
  glassFacade(ctx, rng, x1, x2, glassTop, 492, 7);
  // Sockel (Vorfeldebene)
  ctx.fillStyle = vg(ctx, 492, GROUND, [[0, '#8e93b4'], [1, '#7c81a5']]);
  ctx.fillRect(x1, 492, x2 - x1, GROUND - 492);
  for (let x = x1 + 30; x < x2 - 20; x += 64) {
    ctx.fillStyle = 'rgba(44,48,84,0.6)';
    ctx.fillRect(x, 494, 14, 9);
    ctx.fillStyle = 'rgba(255,214,150,0.6)';
    ctx.fillRect(x + 1, 495, 12, 1.2);
  }
  // Schriftzug
  ctx.save();
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('羽田空港  TOKYO HANEDA', 760, 441);
  ctx.restore();
  // geschwungenes Dach mit Überstand
  const r1 = x1 - 20;
  const r2 = x2 + 20;
  ctx.beginPath();
  ctx.moveTo(r1, T3_ROOF(r1) + 5);
  for (let x = r1; x <= r2; x += 8) ctx.lineTo(x, T3_ROOF(x) - 0.5);
  ctx.lineTo(r2, T3_ROOF(r2) + 5);
  for (let x = r2; x >= r1; x -= 8) ctx.lineTo(x, T3_ROOF(x) + 8);
  ctx.closePath();
  ctx.fillStyle = vg(ctx, 410, 440, [[0, '#fdf6f4'], [0.5, '#dcdcec'], [1, '#aeb2d0']]);
  ctx.fill();
  // Untersicht
  ctx.beginPath();
  for (let x = x1 - 14; x <= x2 + 14; x += 8) ctx.lineTo(x, T3_ROOF(x) + 8);
  for (let x = x2 + 14; x >= x1 - 14; x -= 8) ctx.lineTo(x, T3_ROOF(x) + 12);
  ctx.closePath();
  ctx.fillStyle = '#525887';
  ctx.fill();
  // Schnee und Morgenlicht auf der Oberkante
  ctx.beginPath();
  for (let x = r1 + 6; x <= r2 - 6; x += 6) ctx.lineTo(x, T3_ROOF(x) - 2.6 - Math.sin(x * 0.21) * 0.5);
  for (let x = r2 - 6; x >= r1 + 6; x -= 6) ctx.lineTo(x, T3_ROOF(x) - 0.2);
  ctx.closePath();
  ctx.fillStyle = '#f8faff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,206,190,0.8)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let x = r1 + 6; x <= r2 - 6; x += 6) ctx.lineTo(x, T3_ROOF(x) - 2.8 - Math.sin(x * 0.21) * 0.5);
  ctx.stroke();
  // Lichterkette unter der Traufe
  ctx.strokeStyle = 'rgba(40,40,70,0.5)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  L.roofLights.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  for (const p of L.roofLights) lamp(ctx, p.x, p.y, 0.8, p.blue ? '#9cc8ff' : '#fff6e2', p.blue ? 'rgba(110,170,255,0.55)' : 'rgba(255,240,210,0.55)', 4);
}

function terminal2(ctx, rng, L) {
  const { x1, x2, roof } = T2;
  glassFacade(ctx, rng, x1, x2, () => roof + 10, 492, 23);
  ctx.fillStyle = vg(ctx, 492, GROUND, [[0, '#8e93b4'], [1, '#7c81a5']]);
  ctx.fillRect(x1, 492, x2 - x1, GROUND - 492);
  // Mittelhalle (höher, dunkles Glas mit Lamellen)
  const cx1 = 2052;
  const cx2 = 2140;
  ctx.fillStyle = vg(ctx, 410, 492, [[0, '#3f4677'], [1, '#c99aa6']]);
  ctx.fillRect(cx1, 412, cx2 - cx1, 80);
  ctx.fillStyle = 'rgba(240,240,255,0.35)';
  for (let x = cx1 + 3; x < cx2; x += 5) ctx.fillRect(x, 414, 1, 76);
  ctx.fillStyle = 'rgba(255,224,170,0.9)';
  ctx.fillRect(cx1 + 6, 440, cx2 - cx1 - 12, 1.2);
  ctx.fillStyle = vg(ctx, 406, 414, [[0, '#fbf8fa'], [1, '#b5b9d5']]);
  ctx.fillRect(cx1 - 6, 406, cx2 - cx1 + 12, 7);
  ctx.fillStyle = '#f8faff';
  ctx.fillRect(cx1 - 6, 404.4, cx2 - cx1 + 12, 2);
  // Dach mit leicht aufgebogenen Enden
  const e1 = x1 - 16;
  const e2 = x2 + 16;
  const lift = (x) => {
    const d = Math.min(x - e1, e2 - x);
    return d < 34 ? ((34 - d) / 34) ** 2 * 6 : 0;
  };
  ctx.beginPath();
  for (let x = e1; x <= e2; x += 4) ctx.lineTo(x, roof - lift(x));
  for (let x = e2; x >= e1; x -= 4) ctx.lineTo(x, roof + 8 - lift(x) * 0.8);
  ctx.closePath();
  ctx.fillStyle = vg(ctx, roof - 6, roof + 8, [[0, '#fbf6f5'], [1, '#aeb2d0']]);
  ctx.fill();
  ctx.fillStyle = '#525887';
  ctx.fillRect(x1 - 6, roof + 8, x2 - x1 + 12, 3);
  ctx.beginPath();
  for (let x = e1 + 4; x <= e2 - 4; x += 4) ctx.lineTo(x, roof - lift(x) - 2.4 - Math.sin(x * 0.3) * 0.4);
  for (let x = e2 - 4; x >= e1 + 4; x -= 4) ctx.lineTo(x, roof - lift(x) + 0.2);
  ctx.closePath();
  ctx.fillStyle = '#f8faff';
  ctx.fill();
  // Aussichtsdeck mit Geländer und LED-Bäumen
  ctx.strokeStyle = 'rgba(70,76,120,0.7)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(1822, roof - 6); ctx.lineTo(2000, roof - 6);
  for (let x = 1822; x <= 2000; x += 6) { ctx.moveTo(x, roof - 6); ctx.lineTo(x, roof - 1); }
  ctx.stroke();
  for (const t of L.ledTrees.slice(3)) ledTree(ctx, t, false);
}

function jetBridge(ctx, g) {
  const d = g.dir;
  const ax = d > 0 ? Math.min(g.x + 104, T3.x2 - 10) : Math.max(g.x - 104, T2.x1 + 10);
  const ay = 484;
  const cx = g.x + d * 50;
  const cy = 496;
  // Stütze und Rotunde am Terminal
  ctx.fillStyle = '#6f7498';
  ctx.fillRect(ax - 2, ay + 6, 4, GROUND - ay - 4);
  ctx.fillStyle = hg(ctx, ax - 8, ax + 8, [[0, '#9aa0c0'], [0.5, '#e4e6f2'], [1, '#8e94b6']]);
  ctx.fillRect(ax - 8, ay - 10, 16, 19);
  ctx.fillStyle = '#f6f8ff';
  ctx.fillRect(ax - 8.5, ay - 11.4, 17, 1.8);
  // Tunnel (teleskopisch, drei Segmente)
  const seg = [[0, 0.38, 8.4], [0.34, 0.71, 7.8], [0.67, 1, 7.2]];
  for (const [a, b, hh] of seg) {
    const xa = ax + (cx - ax) * a;
    const ya = ay + (cy - ay) * a;
    const xb = ax + (cx - ax) * b;
    const yb = ay + (cy - ay) * b;
    ctx.beginPath();
    ctx.moveTo(xa, ya - hh); ctx.lineTo(xb, yb - hh); ctx.lineTo(xb, yb + hh); ctx.lineTo(xa, ya + hh);
    ctx.closePath();
    ctx.fillStyle = vg(ctx, Math.min(ya, yb) - hh, Math.max(ya, yb) + hh, [[0, '#f1f2f9'], [0.45, '#cfd2e4'], [1, '#7d83a8']]);
    ctx.fill();
    // Fensterband mit warmem Licht
    ctx.beginPath();
    ctx.moveTo(xa, ya - hh * 0.45); ctx.lineTo(xb, yb - hh * 0.45); ctx.lineTo(xb, yb + hh * 0.05); ctx.lineTo(xa, ya + hh * 0.05);
    ctx.closePath();
    ctx.fillStyle = '#353a64';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,214,150,0.85)';
    const n = Math.floor(Math.abs(xb - xa) / 5);
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      ctx.fillRect(xa + (xb - xa) * f - 1.2, ya + (yb - ya) * f - hh * 0.36, 2.4, hh * 0.3);
    }
    ctx.fillStyle = 'rgba(40,44,80,0.5)';
    ctx.fillRect(Math.min(xa, xb), (ya + yb) / 2 - hh, 0.8, hh * 2);
  }
  // Kabine, Faltenbalg, Fahrwerk
  ctx.fillStyle = hg(ctx, cx - 7, cx + 7, [[0, '#8e94b6'], [1, '#b6bad3']]);
  ctx.fillRect(cx - 7, cy - 8.5, 14, 17);
  ctx.fillStyle = '#262a4a';
  ctx.fillRect(cx - d * 9 - 2.5, cy - 8, 5, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let k = -6; k <= 6; k += 3) ctx.fillRect(cx - d * 9 - 2.5, cy + k, 5, 0.6);
  ctx.fillStyle = '#5e6488';
  ctx.fillRect(cx + d * 2 - 1.2, cy + 8, 2.4, GATE_Y - cy - 10);
  disc(ctx, cx + d * 2 - 3, GATE_Y - 2, 2, '#2b2f4e');
  disc(ctx, cx + d * 2 + 3, GATE_Y - 2, 2, '#2b2f4e');
  ctx.fillStyle = '#f2c94c';
  ctx.fillRect(cx - 7, cy + 6.6, 14, 1.4);
}

function apron(ctx, rng, w) {
  ctx.fillStyle = vg(ctx, GROUND, 544, [[0, '#8d92b2'], [1, '#a7abc6']]);
  ctx.fillRect(-10, GROUND, w + 20, 544 - GROUND);
  // feuchter Beton spiegelt das warme Terminallicht
  for (const [a, b] of [[T3.x1, T3.x2], [T2.x1, T2.x2]]) {
    ctx.fillStyle = vg(ctx, GROUND, GROUND + 18, [[0, 'rgba(255,200,140,0.35)'], [1, 'rgba(255,200,140,0)']]);
    ctx.fillRect(a, GROUND, b - a, 18);
    ctx.fillStyle = 'rgba(255,214,160,0.18)';
    for (let x = a + 4; x < b; x += 11) ctx.fillRect(x, GROUND + 1, 1.2, rng.range(5, 14));
  }
  // Fugen
  ctx.fillStyle = 'rgba(70,76,120,0.12)';
  for (const y of [512, 524, 535]) ctx.fillRect(-10, y, w + 20, 0.6);
  for (let x = 0; x < w; x += 42) ctx.fillRect(x, GROUND, 0.6, 41);
  // leichter Schnee
  for (let i = 0; i < 300; i++) {
    const y = GROUND + rng.next() ** 0.7 * 41;
    ctx.fillStyle = `rgba(246,248,255,${rng.range(0.25, 0.7).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(rng.range(0, w), y, rng.range(6, 30), rng.range(0.6, 1.6), 0, 0, TAU);
    ctx.fill();
  }
  // Sicherheitslinie und Gate-Markierungen
  ctx.fillStyle = 'rgba(214,58,58,0.75)';
  ctx.fillRect(T3.x1, 508, T3.x2 - T3.x1, 0.9);
  ctx.fillRect(T2.x1, 508, T2.x2 - T2.x1, 0.9);
  for (const g of GATES) {
    ctx.fillStyle = 'rgba(242,201,76,0.9)';
    ctx.fillRect(g.x - 95, GATE_Y + 2, 190, 1);
    ctx.fillRect(g.x + g.dir * 66 - 1, GATE_Y - 4, 2, 10);
    ctx.fillRect(g.x - g.dir * 95 - 1, GATE_Y + 2, 1, 18);
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(g.x + g.dir * 70 - 5, GATE_Y + 6, 10, 6);
    ctx.fillStyle = '#1d2033';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(100 + GATES.indexOf(g) * 2 + (g.dir > 0 ? 10 : 50)), g.x + g.dir * 70, GATE_Y + 11);
  }
  // Vorderkante
  ctx.fillStyle = 'rgba(242,201,76,0.8)';
  ctx.fillRect(-10, 542, w + 20, 1);
}

function floodMasts(ctx) {
  for (const x of [822, 1192, 1990, 2203]) {
    ctx.fillStyle = '#6e7398';
    ctx.fillRect(x - 1.2, 418, 2.4, 96);
    ctx.fillStyle = '#4a4f75';
    ctx.fillRect(x - 9, 414, 18, 4);
    for (let k = -2; k <= 2; k++) lamp(ctx, x + k * 3.5, 418.5, 1, '#fffbea', 'rgba(255,244,214,0.65)', 8);
    glow(ctx, x, 440, 40, 'rgba(255,240,210,0.12)');
  }
}

function vehicles(ctx) {
  const box = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y - h, w, h); };
  const wheels = (x, y, xs) => { for (const dx of xs) disc(ctx, x + dx, y - 1.2, 1.3, '#23263b'); };
  const tug = (x, y, c = '#f4f5f9') => {
    box(x, y - 1.5, 12, 4, c);
    box(x + 1, y - 5.5, 5, 4, c);
    ctx.fillStyle = '#5b7fae'; ctx.fillRect(x + 1.6, y - 8.6, 3.8, 2.2);
    wheels(x, y, [2.5, 9.5]);
  };
  const carts = (x, y, n) => {
    for (let i = 0; i < n; i++) {
      const cx = x + i * 10;
      box(cx, y - 2, 8.5, 6, i % 2 ? '#4c6fa8' : '#3f5f96');
      box(cx, y - 8, 8.5, 1, '#d9dcea');
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(cx, y - 8.8, 8.5, 0.8);
      wheels(cx, y, [2, 6.5]);
      if (i) { ctx.fillStyle = '#3a3e5c'; ctx.fillRect(cx - 1.6, y - 3, 1.6, 0.6); }
    }
  };
  const fuel = (x, y) => {
    box(x, y - 1.5, 30, 2, '#5a5f80');
    ctx.fillStyle = vg(ctx, y - 12, y - 3, [[0, '#ffffff'], [1, '#c9ccde']]);
    ctx.beginPath(); ctx.ellipse(x + 18, y - 7.5, 11, 4.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d33b3b'; ctx.fillRect(x + 8, y - 7.8, 21, 1.1);
    box(x, y - 3, 7, 8, '#eef0f6');
    ctx.fillStyle = '#5b7fae'; ctx.fillRect(x + 0.8, y - 10, 4, 3);
    wheels(x, y, [4, 18, 26]);
  };
  const catering = (x, y) => {
    box(x, y - 1.5, 26, 3, '#5a5f80');
    box(x + 7, y - 13, 19, 10, '#f5f6fa');
    ctx.strokeStyle = '#5a5f80'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x + 8, y - 4.5); ctx.lineTo(x + 24, y - 13); ctx.moveTo(x + 24, y - 4.5); ctx.lineTo(x + 8, y - 13); ctx.stroke();
    box(x, y - 3, 7, 7.5, '#f5f6fa');
    ctx.fillStyle = '#5b7fae'; ctx.fillRect(x + 0.8, y - 9.5, 4, 3);
    ctx.fillStyle = '#e0a63a'; ctx.fillRect(x + 7, y - 21, 19, 0.9);
    wheels(x, y, [4, 20]);
  };
  const belt = (x, y) => {
    box(x, y - 1.5, 18, 3.5, '#f2f3f8');
    ctx.strokeStyle = '#3a3e5c'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x + 2, y - 4); ctx.lineTo(x + 26, y - 14); ctx.stroke();
    wheels(x, y, [3, 14]);
  };
  const plow = (x, y) => {
    box(x, y - 1.5, 22, 7, '#ef8a2c');
    box(x + 13, y - 8.5, 8, 6, '#ef8a2c');
    ctx.fillStyle = '#5b7fae'; ctx.fillRect(x + 14, y - 13.4, 6, 3.4);
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(x + 15.6, y - 15.6, 2.6, 1.6);
    ctx.fillStyle = '#c9cbd8';
    ctx.beginPath(); ctx.moveTo(x + 22, y - 9); ctx.lineTo(x + 30, y - 1); ctx.lineTo(x + 22, y - 1); ctx.fill();
    ctx.fillStyle = '#f6f8ff';
    ctx.beginPath(); ctx.ellipse(x + 33, y - 2, 6, 3, 0, Math.PI, TAU); ctx.fill();
    wheels(x, y, [4, 16]);
  };
  tug(598, 536); carts(612, 537, 3);
  catering(682, 539);
  belt(842, 536);
  fuel(972, 539);
  tug(1056, 535, '#f2c94c'); carts(1070, 536, 2);
  catering(1236, 539);
  belt(1398, 537);
  plow(1500, 540);
  fuel(1860, 539);
  tug(2040, 536); carts(2054, 537, 3);
  catering(2236, 539);
}

function taxiway(ctx, rng, w) {
  // Verbindungswege zur Piste (Schnellabrollwege)
  ctx.fillStyle = '#585c76';
  for (const x of [180, 690, 1210, 1730, 2232]) {
    const slant = x === 180 || x === 2232 ? 0 : 34;
    ctx.beginPath();
    ctx.moveTo(x - 16, 563); ctx.lineTo(x + 16, 563); ctx.lineTo(x + 16 + slant, 590); ctx.lineTo(x - 16 + slant, 590);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,201,76,0.85)';
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x, 556); ctx.lineTo(x + slant, 590); ctx.stroke();
    for (let k = 0; k <= 6; k++) lamp(ctx, x + (slant * k) / 6, 563 + (27 * k) / 6, 0.55, '#9effc4', 'rgba(110,255,170,0.6)', 3);
  }
  ctx.fillStyle = vg(ctx, 547, 566, [[0, '#626680'], [1, '#535770']]);
  ctx.fillRect(-10, 547, w + 20, 18);
  // Schneereste am Rand
  ctx.fillStyle = 'rgba(240,243,252,0.65)';
  for (let x = 0; x < w; x += rng.range(8, 30)) ctx.fillRect(x, 547, rng.range(4, 20), rng.range(0.6, 1.4));
  ctx.fillStyle = 'rgba(242,201,76,0.95)';
  ctx.fillRect(-10, TAXI_Y - 0.5, w + 20, 1);
  ctx.fillStyle = 'rgba(242,201,76,0.5)';
  ctx.fillRect(-10, 548.4, w + 20, 0.5);
  ctx.fillRect(-10, 563.2, w + 20, 0.5);
  for (let x = 6; x < w; x += 15) lamp(ctx, x, TAXI_Y, 0.55, '#a8ffd0', 'rgba(110,255,170,0.5)', 3);
  for (let x = 12; x < w; x += 30) {
    lamp(ctx, x, 546.5, 0.75, '#8fb4ff', 'rgba(80,130,255,0.6)', 4.5);
    lamp(ctx, x + 15, 565.5, 0.75, '#8fb4ff', 'rgba(80,130,255,0.6)', 4.5);
  }
}

// Weiche Schneeverwehungen mit lila Schatten
function drifts(ctx, rng, w, y0, y1, n) {
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, w);
    const y = rng.range(y0, y1);
    const rx = rng.range(18, 70);
    const ry = rng.range(1.2, 2.6);
    ctx.fillStyle = 'rgba(160,166,210,0.22)';
    ctx.beginPath(); ctx.ellipse(x, y + ry * 0.6, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(x - rx * 0.1, y - ry * 0.2, rx * 0.8, ry * 0.55, 0, 0, TAU); ctx.fill();
  }
}

function strip(ctx, rng, w) {
  ctx.fillStyle = vg(ctx, 565, 589, [[0, '#e7e9f5'], [1, '#f1f3fa']]);
  ctx.fillRect(-10, 565.5, w + 20, 23.5);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(150,140,110,0.35)' : 'rgba(170,176,214,0.35)';
    ctx.fillRect(rng.range(0, w), rng.range(568, 587), rng.range(1, 4), 0.6);
  }
  drifts(ctx, rng, w, 569, 586, 46);
  // Schilder
  const sign = (x, kind) => {
    ctx.fillStyle = '#3a3e5c';
    ctx.fillRect(x + 1, 579, 0.8, 4);
    ctx.fillRect(x + 9, 579, 0.8, 4);
    ctx.fillStyle = kind === 'red' ? '#cf2f2f' : kind === 'black' ? '#1d1f2e' : '#f2c94c';
    ctx.fillRect(x, 573, 11, 6);
    ctx.fillStyle = kind === 'red' ? '#ffffff' : kind === 'black' ? '#f2c94c' : '#1d1f2e';
    ctx.fillRect(x + 2, 575.6, 7, 0.9);
  };
  for (const [x, k] of [[208, 'red'], [226, 'yellow'], [730, 'black'], [745, 'yellow'], [1250, 'black'], [1265, 'yellow'], [1770, 'black'], [1785, 'yellow'], [2196, 'red'], [2212, 'black']]) sign(x, k);
  // Windsack
  const wx = 980;
  ctx.fillStyle = '#5a5f80';
  ctx.fillRect(wx - 0.6, 566, 1.2, 20);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? '#f6f6fa' : '#f0702e';
    ctx.beginPath();
    ctx.moveTo(wx + i * 3.4, 566.4 + i * 0.35); ctx.lineTo(wx + (i + 1) * 3.4, 566.4 + (i + 1) * 0.35 + 0.2);
    ctx.lineTo(wx + (i + 1) * 3.4, 570.6 - (i + 1) * 0.35); ctx.lineTo(wx + i * 3.4, 570.6 - i * 0.35);
    ctx.fill();
  }
}

function runwayHND(ctx, rng, w) {
  const { x1, x2, y, d } = RWY;
  const t = y - d / 2;
  const b = y + d / 2;
  // Schneewälle am Rand
  ctx.fillStyle = '#f5f7fd';
  ctx.beginPath();
  for (let x = x1 - 30; x <= x2 + 30; x += 7) ctx.lineTo(x, t - 2.2 - Math.sin(x * 0.17) * 0.6);
  ctx.lineTo(x2 + 30, t); ctx.lineTo(x1 - 30, t);
  ctx.fill();
  ctx.fillStyle = '#8c90ae';
  ctx.fillRect(x1 - 8, t - 1.5, x2 - x1 + 16, d + 3);
  ctx.fillStyle = vg(ctx, t, b, [[0, '#4a4e66'], [0.5, '#3d4157'], [1, '#363a4f']]);
  ctx.fillRect(x1, t, x2 - x1, d);
  // Gummiabrieb in den Aufsetzzonen
  ctx.fillStyle = 'rgba(20,20,30,0.35)';
  for (let i = 0; i < 40; i++) {
    const x = x2 - rng.range(120, 520);
    ctx.fillRect(x, y + rng.range(-5, 3), rng.range(10, 60), rng.range(0.6, 1.6));
  }
  for (let i = 0; i < 12; i++) ctx.fillRect(x1 + rng.range(80, 300), y + rng.range(-5, 3), rng.range(10, 50), rng.range(0.6, 1.2));
  // Markierungen
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  for (let x = x1 + 70; x < x2 - 70; x += 46) ctx.fillRect(x, y - 0.6, 24, 1.2);
  ctx.globalAlpha = 0.7;
  ctx.fillRect(x1, t + 1, x2 - x1, 0.7);
  ctx.fillRect(x1, b - 1.7, x2 - x1, 0.7);
  ctx.globalAlpha = 1;
  for (const [sx, dir] of [[x1 + 6, 1], [x2 - 6, -1]]) {
    for (const yy of [t + 2.5, t + 5, t + 7.5, b - 8.5, b - 6, b - 3.5]) ctx.fillRect(dir > 0 ? sx : sx - 34, yy, 34, 1.3);
    for (let k = 0; k < 4; k++) {
      const xx = sx + dir * (70 + k * 48);
      ctx.fillRect(dir > 0 ? xx : xx - 16, t + 4, 16, 1.1);
      ctx.fillRect(dir > 0 ? xx : xx - 16, b - 5, 16, 1.1);
    }
    const ap = sx + dir * 130;
    ctx.fillRect(dir > 0 ? ap : ap - 34, t + 5.6, 34, 2.2);
    ctx.fillRect(dir > 0 ? ap : ap - 34, b - 7.8, 34, 2.2);
  }
  // Randfeuer, Schwellen- und Endfeuer
  for (let x = x1; x <= x2; x += 40) {
    lamp(ctx, x, t - 0.8, 0.75, '#fffaf0', 'rgba(255,248,225,0.6)', 4);
    lamp(ctx, x, b + 0.8, 0.85, '#fffaf0', 'rgba(255,248,225,0.6)', 5);
  }
  for (let yy = t; yy <= b; yy += 3.6) {
    lamp(ctx, x2 + 3, yy, 0.8, '#9dffbf', 'rgba(90,255,150,0.6)', 4);
    lamp(ctx, x1 - 3, yy, 0.8, '#ff8a80', 'rgba(255,70,60,0.6)', 4);
  }
  // PAPI
  for (let k = 0; k < 4; k++) {
    const px = x2 - 300 + k * 7;
    ctx.fillStyle = '#4a4f6e';
    ctx.fillRect(px - 2, b + 3, 4, 2.6);
    lamp(ctx, px, b + 3.6, 0.9, k < 2 ? '#ffffff' : '#ff6b6b', k < 2 ? 'rgba(255,255,240,0.7)' : 'rgba(255,60,60,0.7)', 5);
  }
}

// Anflugbefeuerung auf einem Stahlsteg (wie in Haneda über dem Wasser)
function lightPier(ctx, xa, xb, y) {
  ctx.fillStyle = vg(ctx, y - 5, y + 6, [[0, '#6a6f92'], [1, '#3d4262']]);
  ctx.fillRect(xa, y - 4, xb - xa, 9);
  ctx.strokeStyle = 'rgba(150,156,200,0.55)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = xa; x < xb; x += 8) { ctx.moveTo(x, y + 5); ctx.lineTo(x + 4, y - 4); ctx.lineTo(x + 8, y + 5); }
  ctx.stroke();
  ctx.fillStyle = '#f4f6fd';
  ctx.fillRect(xa, y - 5.4, xb - xa, 1.6);
  ctx.fillStyle = '#4a4f70';
  for (let x = xa + 4; x < xb; x += 17) ctx.fillRect(x - 1, y + 5, 2, 7);
}

function approachLights(ctx) {
  const { x1, x2, y } = RWY;
  lightPier(ctx, x2 + 8, 2410, y);
  for (let x = 2398; x > x2 + 10; x -= 17) {
    for (let k = -2; k <= 2; k++) lamp(ctx, x, y + k * 1.4 - 1, 0.6, '#fff6e0', 'rgba(255,246,220,0.5)', 3.2);
  }
  for (let k = -5; k <= 5; k++) lamp(ctx, 2330, y - 1 + k * 1.2, 0.6, '#fff6e0', 'rgba(255,246,220,0.5)', 3.2);
  // Gegenrichtung (inaktiv)
  lightPier(ctx, -10, x1 - 8, y);
  for (let x = 12; x < x1 - 10; x += 17) lamp(ctx, x, y - 1, 0.6, '#ffd9c8', 'rgba(255,200,190,0.4)', 3);
  // Landekurssender am linken Ende
  ctx.fillStyle = '#6f7496';
  for (let x = 40; x < 120; x += 5) ctx.fillRect(x, 616, 0.8, 8);
  ctx.fillRect(38, 616, 84, 1);
}

function southShore(ctx, rng, w) {
  ctx.fillStyle = vg(ctx, 612, SEAWALL, [[0, '#eef0f8'], [1, '#dfe2f0']]);
  ctx.fillRect(-10, 612, w + 20, SEAWALL - 612);
  drifts(ctx, rng, w, 616, 627, 36);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = 'rgba(160,150,120,0.3)';
    ctx.fillRect(rng.range(0, w), rng.range(616, 628), rng.range(1, 4), 0.6);
  }
  ctx.fillStyle = waterFill(ctx);
  ctx.fillRect(-10, SEAWALL, w + 20, 720 - SEAWALL);
  ripples(ctx, rng, -20, w, SEAWALL + 6, 720, 520, 'rgba(255,224,220,0.22)', 'rgba(40,46,92,0.2)');
  // Ufermauer
  ctx.fillStyle = vg(ctx, SEAWALL, SEAWALL + 8, [[0, '#a1a5c3'], [1, '#6e7398']]);
  ctx.fillRect(-10, SEAWALL, w + 20, 7);
  ctx.fillStyle = '#f6f8ff';
  ctx.fillRect(-10, SEAWALL - 1.4, w + 20, 1.8);
  ctx.fillStyle = 'rgba(40,44,80,0.35)';
  for (let x = 0; x < w; x += 24) ctx.fillRect(x, SEAWALL + 1, 0.6, 6);
  // Lichtspiegelungen der Pistenbefeuerung
  for (let x = RWY.x1; x <= RWY.x2; x += 40) {
    ctx.fillStyle = 'rgba(255,246,220,0.18)';
    for (let k = 0; k < 4; k++) ctx.fillRect(x - 1 + Math.sin(k * 2.1 + x) * 0.8, SEAWALL + 10 + k * 3.2, 2.2 - k * 0.3, 0.8);
  }
}

function paintMid(ctx, w, rng) {
  const L = layout();
  ctx.fillStyle = vg(ctx, SHORE, SEAWALL, [[0, '#c7c9e2'], [0.25, '#d8dbee'], [1, '#e9ecf7']]);
  ctx.fillRect(-10, SHORE, w + 20, SEAWALL - SHORE + 2);
  ctx.fillStyle = '#7f83a8';
  ctx.fillRect(-10, SHORE - 1, w + 20, 2.2);
  ctx.fillStyle = 'rgba(250,250,255,0.85)';
  ctx.fillRect(-10, SHORE - 2.2, w + 20, 1.2);
  landside(ctx, rng, w);
  hangars(ctx, rng, L);
  opsBuilding(ctx, rng);
  hanedaTower(ctx);
  plaza(ctx, rng, L);
  terminal3(ctx, rng, L);
  terminal2(ctx, rng, L);
  apron(ctx, rng, w);
  floodMasts(ctx);
  for (const g of GATES) jetBridge(ctx, g);
  vehicles(ctx);
  taxiway(ctx, rng, w);
  strip(ctx, rng, w);
  runwayHND(ctx, rng, w);
  approachLights(ctx);
  southShore(ctx, rng, w);
}

// --- Vordergrund ----------------------------------------------------------------------------
function tetrapod(ctx, x, y, s, rot, light, face) {
  const legs = [rot - Math.PI / 2, rot + Math.PI / 6, rot + (5 * Math.PI) / 6];
  const g = ctx.createLinearGradient(x, y - s, x, y + s);
  g.addColorStop(0, light ? '#c3c7de' : '#b3b8d3');
  g.addColorStop(0.5, light ? '#8f95b5' : '#7f86a8');
  g.addColorStop(1, light ? '#596080' : '#4a5172');
  ctx.fillStyle = g;
  ctx.beginPath();
  const tips = [];
  for (const a of legs) {
    const ex = x + Math.cos(a) * s;
    const ey = y + Math.sin(a) * s * 0.8;
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const w0 = s * 0.38;
    const w1 = s * 0.25;
    ctx.moveTo(x + nx * w0, y + ny * w0);
    ctx.lineTo(ex + nx * w1, ey + ny * w1);
    ctx.arc(ex, ey, w1, a + Math.PI / 2, a - Math.PI / 2, true);
    ctx.lineTo(x - nx * w0, y - ny * w0);
    ctx.closePath();
    tips.push([ex, ey, w1, a]);
  }
  ctx.fill();
  // vierter Arm zeigt zum Betrachter: Stirnfläche
  const fx = x + Math.cos(face) * s * 0.12;
  const fy = y + Math.sin(face) * s * 0.1;
  disc(ctx, fx, fy, s * 0.3, light ? '#c9cde2' : '#b9bdd6');
  disc(ctx, fx + s * 0.04, fy + s * 0.05, s * 0.22, light ? '#a9aecb' : '#989ebf');
  // Schnee auf nach oben zeigenden Flächen
  ctx.fillStyle = '#eef2fc';
  ctx.beginPath();
  for (const [ex, ey, w1, a] of tips) {
    if (Math.sin(a) > -0.45) continue;
    ctx.moveTo(ex + w1 * 0.9, ey - w1 * 0.5);
    ctx.ellipse(ex, ey - w1 * 0.5, w1 * 0.9, w1 * 0.42, 0, 0, TAU);
  }
  ctx.fill();
}

function pine(ctx, rng, p) {
  const [p0, p1, p2, p3] = p.trunk;
  const n = 28;
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(bezier(p0, p1, p2, p3, i / n));
  const width = (i) => p.w0 + (p.w1 - p.w0) * (i / n) ** 0.8;
  const leftSide = [];
  const rightSide = [];
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const wv = width(i) / 2 * (1 + (i < 3 ? (3 - i) * 0.12 : 0));
    leftSide.push([pts[i][0] + nx * wv, pts[i][1] + ny * wv]);
    rightSide.push([pts[i][0] - nx * wv, pts[i][1] - ny * wv]);
  }
  // Äste zu den Polstern
  ctx.strokeStyle = '#2f2632';
  ctx.lineCap = 'round';
  for (const [cx, cy, rx] of p.pads) {
    let best = 0;
    for (let i = 0; i <= n; i++) if (Math.abs(pts[i][1] - (cy + 26)) < Math.abs(pts[best][1] - (cy + 26))) best = i;
    const [sx, sy] = pts[best];
    ctx.lineWidth = Math.max(2, rx * 0.09);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + cx) / 2, sy - 2, cx, cy + 4);
    ctx.stroke();
    ctx.lineWidth *= 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 4);
    ctx.lineTo(cx + Math.sign(cx - sx || 1) * rx * 0.55, cy + 2);
    ctx.stroke();
  }
  poly(ctx, [...leftSide, ...rightSide.reverse()]);
  ctx.fillStyle = '#342a34';
  ctx.fill();
  // Rinde mit Streiflicht
  ctx.strokeStyle = 'rgba(160,120,130,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  rightSide.reverse();
  rightSide.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,14,24,0.45)';
  ctx.lineWidth = 0.7;
  for (let i = 2; i < n - 2; i += 2) {
    const [x, y] = pts[i];
    ctx.beginPath();
    ctx.moveTo(x - width(i) * 0.3, y);
    ctx.lineTo(x + width(i) * 0.2, y - 3);
    ctx.stroke();
  }
  // Nadelpolster (Wolkenschnitt) mit Schneehauben
  for (const [cx, cy, rx, ry] of p.pads) {
    const k = Math.max(3, Math.round(rx / 9));
    const bumps = [];
    for (let i = 0; i < k; i++) {
      const f = (i + 0.5) / k - 0.5;
      const br = (rx / k) * rng.range(1.05, 1.45) * (1 - Math.abs(f) * 0.4);
      bumps.push([cx + f * rx * 1.6 + rng.range(-2, 2), cy - ry * 0.2 + Math.abs(f) * ry * 0.75 + rng.range(-2, 2), br * 1.15, br * 0.95]);
    }
    const body = [[cx, cy + ry * 0.12, rx * 0.96, ry * 0.62], ...bumps];
    // Nadelbüschel an Unterkante und Seiten
    ctx.lineWidth = 1;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? '#2b5450' : '#10221f';
      ctx.beginPath();
      for (let a = 0.08; a < Math.PI - 0.08; a += 0.11) {
        const bx = cx + Math.cos(a) * rx * 0.94;
        const by = cy + ry * 0.12 + Math.sin(a) * ry * 0.6;
        const ox = Math.cos(a) * 2.5;
        for (let j = -1; j <= 1; j++) {
          ctx.moveTo(bx, by - 1.5);
          ctx.lineTo(bx + ox + j * 1.4 + (pass ? 0.6 : 0), by + 2.5 + rng.range(0, 2.5) - pass);
        }
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#16302f';
    blob(ctx, body);
    ctx.fill();
    ctx.fillStyle = '#21423f';
    blob(ctx, body.map(([x, y, a, b]) => [x, y - b * 0.12, a * 0.9, b * 0.78]));
    ctx.fill();
    ctx.fillStyle = '#2e5a54';
    blob(ctx, bumps.map(([x, y, a, b]) => [x + a * 0.15, y - b * 0.05, a * 0.6, b * 0.55]));
    ctx.fill();
    // Nadeltextur
    ctx.strokeStyle = 'rgba(80,140,120,0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = 0; i < rx * 0.8; i++) {
      const x = cx + rng.range(-0.8, 0.8) * rx;
      const y = cy + rng.range(-0.1, 0.5) * ry;
      ctx.moveTo(x, y);
      ctx.lineTo(x + rng.range(-2, 2), y - 2.5);
    }
    ctx.stroke();
    // Schnee nur auf den Oberseiten, Grün bleibt an den Rändern sichtbar
    const caps = bumps.filter(() => rng.chance(0.88)).map(([x, y, a, b]) => [x + rng.range(-1, 1), y - b * 0.5, a * rng.range(0.85, 1.0), b * rng.range(0.3, 0.4)]);
    ctx.fillStyle = '#8f98c6';
    blob(ctx, caps.map(([x, y, a, b]) => [x, y + 1.6, a * 0.96, b * 0.9]));
    ctx.fill();
    ctx.fillStyle = '#eef2fc';
    blob(ctx, caps);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,218,208,0.75)';
    blob(ctx, caps.map(([x, y, a, b]) => [x, y - b * 0.35, a * 0.6, b * 0.35]));
    ctx.fill();
  }
  // Yukitsuri: Seile, die die Äste gegen Schneelast stützen
  if (p.yuki) {
    const [tx, ty] = [p3[0], p3[1] - 64];
    ctx.strokeStyle = 'rgba(214,190,140,0.85)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const [cx, cy, rx] of p.pads) {
      for (const s of [-1, 1]) {
        ctx.moveTo(tx, ty);
        ctx.lineTo(cx + s * rx * 0.8, cy - 2);
      }
    }
    ctx.stroke();
    ctx.fillStyle = '#6d5a48';
    ctx.fillRect(tx - 1, ty, 2, 60);
    ctx.fillStyle = '#c9a66b';
    ctx.beginPath(); ctx.moveTo(tx - 5, ty + 2); ctx.lineTo(tx, ty - 7); ctx.lineTo(tx + 5, ty + 2); ctx.fill();
    ctx.fillStyle = '#f3f6fd';
    ctx.beginPath(); ctx.ellipse(tx, ty - 3, 3.5, 2, 0, 0, TAU); ctx.fill();
  }
}

function stoneLantern(ctx, x, base, s) {
  const stone = (x0, x1) => hg(ctx, x0, x1, [[0, '#55587a'], [0.55, '#8a8ca8'], [1, '#a9abc4']]);
  // Sockel
  ctx.fillStyle = stone(x - s * 0.23, x + s * 0.23);
  poly(ctx, [[x - s * 0.23, base], [x + s * 0.23, base], [x + s * 0.17, base - s * 0.1], [x - s * 0.17, base - s * 0.1]]);
  ctx.fill();
  // Schaft
  ctx.fillStyle = stone(x - s * 0.08, x + s * 0.08);
  poly(ctx, [[x - s * 0.085, base - s * 0.1], [x + s * 0.085, base - s * 0.1], [x + s * 0.07, base - s * 0.46], [x - s * 0.07, base - s * 0.46]]);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,40,70,0.4)';
  ctx.fillRect(x - s * 0.08, base - s * 0.3, s * 0.16, 1.2);
  // Plattform
  ctx.fillStyle = stone(x - s * 0.2, x + s * 0.2);
  poly(ctx, [[x - s * 0.1, base - s * 0.46], [x + s * 0.1, base - s * 0.46], [x + s * 0.2, base - s * 0.52], [x + s * 0.2, base - s * 0.555], [x - s * 0.2, base - s * 0.555], [x - s * 0.2, base - s * 0.52]]);
  ctx.fill();
  // Lichtkammer
  const ly = base - s * 0.555;
  const lh = s * 0.2;
  ctx.fillStyle = stone(x - s * 0.15, x + s * 0.15);
  ctx.fillRect(x - s * 0.15, ly - lh, s * 0.3, lh);
  glow(ctx, x, ly - lh * 0.5, s * 0.5, 'rgba(255,190,110,0.5)');
  ctx.fillStyle = '#ffd88a';
  ctx.fillRect(x - s * 0.075, ly - lh * 0.8, s * 0.15, lh * 0.6);
  ctx.fillStyle = '#fff3cf';
  ctx.beginPath(); ctx.arc(x, ly - lh * 0.5, s * 0.035, 0, TAU); ctx.fill();
  // Dach mit aufgebogenen Ecken
  const ry = ly - lh;
  ctx.fillStyle = stone(x - s * 0.34, x + s * 0.34);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.36, ry - s * 0.045);
  ctx.quadraticCurveTo(x, ry + s * 0.02, x + s * 0.36, ry - s * 0.045);
  ctx.quadraticCurveTo(x + s * 0.2, ry - s * 0.06, x + s * 0.09, ry - s * 0.13);
  ctx.lineTo(x - s * 0.09, ry - s * 0.13);
  ctx.quadraticCurveTo(x - s * 0.2, ry - s * 0.06, x - s * 0.36, ry - s * 0.045);
  ctx.fill();
  // Schneehaube
  ctx.fillStyle = '#b4bad9';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.37, ry - s * 0.04);
  ctx.quadraticCurveTo(x - s * 0.3, ry - s * 0.15, x - s * 0.08, ry - s * 0.2);
  ctx.quadraticCurveTo(x, ry - s * 0.24, x + s * 0.08, ry - s * 0.2);
  ctx.quadraticCurveTo(x + s * 0.3, ry - s * 0.15, x + s * 0.37, ry - s * 0.04);
  ctx.quadraticCurveTo(x, ry - s * 0.08, x - s * 0.37, ry - s * 0.04);
  ctx.fill();
  ctx.fillStyle = '#f4f7fe';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.35, ry - s * 0.06);
  ctx.quadraticCurveTo(x - s * 0.3, ry - s * 0.16, x - s * 0.08, ry - s * 0.21);
  ctx.quadraticCurveTo(x, ry - s * 0.25, x + s * 0.08, ry - s * 0.21);
  ctx.quadraticCurveTo(x + s * 0.28, ry - s * 0.16, x + s * 0.33, ry - s * 0.07);
  ctx.quadraticCurveTo(x, ry - s * 0.11, x - s * 0.35, ry - s * 0.06);
  ctx.fill();
  // Knauf
  const ky = ry - s * 0.25;
  ctx.fillStyle = stone(x - s * 0.05, x + s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.05, ky);
  ctx.quadraticCurveTo(x - s * 0.06, ky - s * 0.05, x, ky - s * 0.1);
  ctx.quadraticCurveTo(x + s * 0.06, ky - s * 0.05, x + s * 0.05, ky);
  ctx.fill();
  ctx.fillStyle = '#f4f7fe';
  ctx.beginPath(); ctx.ellipse(x - s * 0.005, ky - s * 0.065, s * 0.03, s * 0.018, 0, 0, TAU); ctx.fill();
}

function chochin(ctx, x, y, red) {
  const w = 12;
  const h = 17;
  ctx.strokeStyle = '#2a2430';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x, y); ctx.stroke();
  glow(ctx, x, y + h / 2, 22, red ? 'rgba(255,120,70,0.38)' : 'rgba(255,220,160,0.38)');
  const g = ctx.createRadialGradient(x - 1.5, y + h * 0.45, 1, x, y + h / 2, w * 0.75);
  if (red) { g.addColorStop(0, '#ffc07a'); g.addColorStop(0.45, '#f0603a'); g.addColorStop(1, '#a8231e'); } else { g.addColorStop(0, '#fffbea'); g.addColorStop(0.5, '#ffe6b4'); g.addColorStop(1, '#c99d6a'); }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y + h / 2, w / 2, h / 2, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = red ? 'rgba(110,20,16,0.4)' : 'rgba(140,100,60,0.35)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let k = 1; k < 7; k++) {
    const yy = y + (h * k) / 7;
    const ww = (w / 2) * Math.sqrt(1 - ((yy - y - h / 2) / (h / 2)) ** 2);
    ctx.moveTo(x - ww, yy);
    ctx.quadraticCurveTo(x, yy + 1, x + ww, yy);
  }
  ctx.stroke();
  ctx.fillStyle = '#1f1a22';
  ctx.fillRect(x - w * 0.3, y - 0.6, w * 0.6, 2.4);
  ctx.fillRect(x - w * 0.3, y + h - 1.8, w * 0.6, 2.4);
  if (red) {
    ctx.fillStyle = 'rgba(40,10,10,0.65)';
    ctx.fillRect(x - 1.6, y + 5, 3.2, 1);
    ctx.fillRect(x - 0.5, y + 4, 1, 8);
    ctx.fillRect(x - 2.4, y + 9, 4.8, 1);
  }
}

function lanternString(ctx, posts) {
  for (const px of posts) {
    ctx.fillStyle = hg(ctx, px - 3, px + 3, [[0, '#2c2129'], [1, '#5e4848']]);
    ctx.fillRect(px - 2.6, 560, 5.2, 154);
    ctx.fillStyle = '#f3f6fd';
    ctx.beginPath(); ctx.ellipse(px, 559.6, 4, 2.2, 0, Math.PI, TAU); ctx.fill();
  }
  ctx.strokeStyle = '#2a2430';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i];
    const b = posts[i + 1];
    ctx.moveTo(a, 566);
    ctx.quadraticCurveTo((a + b) / 2, 606, b, 566);
  }
  ctx.stroke();
}

function torii(ctx, cx, base) {
  const span = 72;
  const topY = base - 236;
  const verm = (x0, x1) => hg(ctx, x0, x1, [[0, '#9a2a20'], [0.45, '#d6432b'], [1, '#f2683f']]);
  for (const s of [-1, 1]) {
    const xb = cx + s * span;
    const xt = cx + s * (span - 5);
    ctx.fillStyle = verm(xb - 10, xb + 10);
    poly(ctx, [[xb - 10, base], [xb + 10, base], [xt + 8, topY], [xt - 8, topY]]);
    ctx.fill();
    ctx.fillStyle = '#1f1b24';
    ctx.fillRect(xb - 12, base - 20, 24, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(xb + 8, base - 20, 2, 20);
    ctx.fillStyle = '#f3f6fd';
    ctx.beginPath(); ctx.ellipse(xb, base - 20, 13, 2.2, 0, Math.PI, TAU); ctx.fill();
  }
  // Nuki
  const ny = topY + 48;
  ctx.fillStyle = vg(ctx, ny, ny + 10, [[0, '#ec5a36'], [1, '#a7301f']]);
  ctx.fillRect(cx - 96, ny, 192, 10);
  ctx.fillStyle = '#f3f6fd';
  ctx.fillRect(cx - 96, ny - 1.4, 192, 1.8);
  // Mittelstütze mit Tafel
  ctx.fillStyle = verm(cx - 5, cx + 5);
  ctx.fillRect(cx - 5, topY + 10, 10, 38);
  ctx.fillStyle = '#1d2140';
  ctx.fillRect(cx - 9, topY + 13, 18, 30);
  ctx.strokeStyle = '#d9b45a';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(cx - 8, topY + 14, 16, 28);
  ctx.fillStyle = '#e6c56a';
  ctx.font = 'bold 10px serif';
  ctx.textAlign = 'center';
  ctx.fillText('羽', cx, topY + 26);
  ctx.fillText('田', cx, topY + 38);
  // Shimaki + Kasagi (geschwungen, Enden schräg abgeschnitten)
  const half = 124;
  const yb = (x) => topY - 1 - 10 * Math.pow(Math.min(1.1, Math.abs(x - cx) / half), 3.6);
  ctx.fillStyle = vg(ctx, topY, topY + 11, [[0, '#ee5e38'], [1, '#a9311f']]);
  ctx.fillRect(cx - 104, topY, 208, 11);
  ctx.fillStyle = 'rgba(60,10,10,0.3)';
  ctx.fillRect(cx - 104, topY, 208, 1.4);
  const band = (b0, b1, t0, t1, fill) => {
    ctx.beginPath();
    for (let x = cx - half + b0; x <= cx + half - b0; x += 4) ctx.lineTo(x, yb(x) - b1);
    ctx.lineTo(cx + half - b0, yb(cx + half - b0) - b1);
    for (let x = cx + half + t0; x >= cx - half - t0; x -= 4) ctx.lineTo(x, yb(x) - t1(x));
    ctx.lineTo(cx - half - t0, yb(cx - half - t0) - t1(cx - half - t0));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  band(6, 0, 2, () => 9.5, vg(ctx, topY - 22, topY, [[0, '#f26a40'], [1, '#b4361f']]));
  band(2, 9, 6, () => 16, '#211d28');
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(cx - half + 10, yb(cx) - 8.6, (half - 10) * 2, 0.8);
  // Schnee auf dem Kasagi
  band(4, 15.5, 5, (x) => 18.5 + (1 - Math.min(1, Math.abs(x - cx) / half)) * 2.6 + Math.sin(x * 0.4) * 0.5, '#f4f7fe');
  ctx.fillStyle = 'rgba(255,212,196,0.6)';
  ctx.fillRect(cx + 20, yb(cx + 20) - 20.4, 70, 0.8);
}

function paintNear(ctx, w, rng) {
  const L = layout();
  // Wasser zwischen Insel und Ufer (gleicher Verlauf wie mid)
  ctx.fillStyle = waterFill(ctx);
  ctx.fillRect(-10, 648, w + 20, 60);
  ripples(ctx, rng, -20, w, 650, 690, 200, 'rgba(255,224,220,0.2)', 'rgba(30,36,80,0.22)');
  // Wellenbrecher aus Tetrapoden (dunkle Fugen dahinter)
  ctx.fillStyle = vg(ctx, 658, 700, [[0, 'rgba(36,40,78,0)'], [0.35, 'rgba(36,40,78,0.55)'], [1, 'rgba(30,34,70,0.8)']]);
  ctx.fillRect(-10, 658, w + 20, 42);
  for (let x = -10; x < w + 20; x += rng.range(24, 34)) tetrapod(ctx, x, 668 + rng.range(-2, 3), rng.range(15, 19), rng.range(0, TAU / 3), true, rng.range(0, TAU));
  for (let x = -4; x < w + 20; x += rng.range(28, 38)) tetrapod(ctx, x, 686 + rng.range(-3, 2), rng.range(19, 24), rng.range(0, TAU / 3), false, rng.range(0, TAU));
  // Promenade
  ctx.fillStyle = vg(ctx, 688, 720, [[0, '#d7dbee'], [1, '#aeb4d2']]);
  ctx.fillRect(-10, 690, w + 20, 30);
  ctx.fillStyle = '#4c5072';
  ctx.fillRect(-10, 690, w + 20, 3.2);
  ctx.fillStyle = '#f4f7fe';
  ctx.fillRect(-10, 688.6, w + 20, 2);
  ctx.fillStyle = 'rgba(80,86,130,0.25)';
  for (let x = 0; x < w; x += 36) ctx.fillRect(x, 693, 0.7, 27);
  // Geländer
  ctx.fillStyle = '#272c4a';
  for (let x = 0; x <= w; x += 50) ctx.fillRect(x - 1.5, 662, 3, 30);
  ctx.fillRect(-10, 662, w + 20, 2.6);
  ctx.fillRect(-10, 677, w + 20, 1.6);
  ctx.fillStyle = 'rgba(160,170,220,0.5)';
  for (let x = 0; x <= w; x += 50) ctx.fillRect(x + 0.8, 662, 0.7, 30);
  ctx.fillStyle = '#f4f7fe';
  ctx.fillRect(-10, 660.8, w + 20, 1.6);
  // Lichterkette am Geländer
  ctx.strokeStyle = 'rgba(30,30,50,0.55)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = 0; x < w; x += 50) { ctx.moveTo(x, 665); ctx.quadraticCurveTo(x + 25, 677, x + 50, 665); }
  ctx.stroke();
  for (const p of L.railLights) lamp(ctx, p.x, p.y, 0.95, p.warm ? '#fff0c8' : '#b8dcff', p.warm ? 'rgba(255,220,150,0.55)' : 'rgba(130,190,255,0.55)', 5);
  // Kugelförmig geschnittene Büsche
  for (const [x, s] of [[30, 16], [420, 14], [470, 11], [690, 15], [1270, 13], [1480, 16], [1530, 12], [1900, 14], [2150, 15], [2560, 13], [2760, 16], [2980, 14]]) {
    ctx.fillStyle = '#1e3638';
    blob(ctx, [[x, 708 - s * 0.6, s, s * 0.7], [x + s * 0.8, 710 - s * 0.4, s * 0.7, s * 0.5]]);
    ctx.fill();
    ctx.fillStyle = '#f2f5fd';
    blob(ctx, [[x - 1, 708 - s * 1.0, s * 0.8, s * 0.32], [x + s * 0.8, 710 - s * 0.72, s * 0.55, s * 0.24]]);
    ctx.fill();
  }
  for (const s of L.stones) stoneLantern(ctx, s.x, 714, s.s);
  for (const posts of L.lanternStrings) lanternString(ctx, posts);
  for (const p of L.nearLanterns) chochin(ctx, p.x, p.y, p.red);
  torii(ctx, L.torii.x, L.torii.base);
  for (const p of L.pines) pine(ctx, rng, p);
  for (const p of L.pineLights) lamp(ctx, p.x, p.y, 0.9, p.warm ? '#fff0c8' : '#cfe6ff', p.warm ? 'rgba(255,220,150,0.5)' : 'rgba(150,200,255,0.5)', 4.5);
  // Schneefläche vorne
  ctx.fillStyle = 'rgba(244,247,254,0.9)';
  ctx.beginPath();
  ctx.moveTo(-10, 720);
  for (let x = -10; x <= w + 10; x += 20) ctx.lineTo(x, 713 + Math.sin(x * 0.013) * 2 + Math.sin(x * 0.051) * 1.2);
  ctx.lineTo(w + 10, 720);
  ctx.fill();
}

// --- Animation pro Frame ------------------------------------------------------------------
let SPR = null;
function sprites() {
  if (SPR) return SPR;
  SPR = {};
  const cols = { white: '255,250,236', red: '255,52,40', blue: '120,175,255', warm: '255,186,110', green: '110,255,160', gold: '255,226,160', ice: '200,228,255' };
  for (const [k, c] of Object.entries(cols)) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${c},1)`);
    gr.addColorStop(0.18, `rgba(${c},0.75)`);
    gr.addColorStop(0.45, `rgba(${c},0.22)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    SPR[k] = cv;
  }
  return SPR;
}
function flare(ctx, img, x, y, r, a) {
  if (a <= 0.01) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
}
// Sonnenglitzern auf dem Wasser
function glitter(ctx, x, y0, rows, step, spread, t, q) {
  ctx.fillStyle = '#fff1cf';
  const n = Math.max(1, Math.round(3 * q));
  for (let i = 0; i < rows; i++) {
    const y = y0 + i * step;
    const sp = spread * (0.4 + i / rows);
    for (let j = 0; j < n; j++) {
      const s = Math.sin(t * 1.3 + i * 2.7 + j * 2.1);
      const a = Math.abs(Math.sin(t * 2.1 + i * 1.9 + j * 3.3));
      if (a < 0.25) continue;
      ctx.globalAlpha = a * 0.75;
      const len = 2 + a * (3 + i * 0.4);
      ctx.fillRect(x + s * sp - len / 2, y, len, 0.8 + i * 0.03);
    }
  }
  ctx.globalAlpha = 1;
}

function dynFar(ctx, t, view, S, L) {
  for (const b of L.farLights) {
    if (!view.isVisible('far', b.x, 20)) continue;
    if (b.kind === 'flare') {
      const f = 0.7 + 0.3 * Math.sin(t * 13) * Math.sin(t * 7.3);
      flare(ctx, S.warm, b.x, b.y, 9 * f, 0.8);
      continue;
    }
    const ph = ((t / b.period + b.phase) % 1);
    const on = b.kind === 'redStrong' ? (ph < 0.18 ? 1 : 0) : 0.5 + 0.5 * Math.cos(ph * TAU);
    flare(ctx, S.red, b.x, b.y, b.r * (b.kind === 'redStrong' ? 2.2 : 1.5), on);
  }
  ctx.globalAlpha = 1;
}

function dynMid(ctx, t, view, S, L) {
  const off = view.layerOffset('mid');
  const vw = view.viewW;
  const q = view.quality ?? 1;
  ctx.globalCompositeOperation = 'lighter';
  // Lauflicht der Anflugbefeuerung
  if (off + vw > RWY.x2) {
    const n = L.rabbit.length;
    const k = Math.floor((t * 2 % 1) * (n + 4));
    if (k < n) {
      flare(ctx, S.ice, L.rabbit[k], RWY.y - 1, 9, 1);
      flare(ctx, S.white, L.rabbit[k], RWY.y - 1, 3.5, 1);
    }
  }
  // Tower: Hindernisfeuer + Flughafen-Drehfeuer (grün/weiß)
  if (view.isVisible('mid', TWR.x, 60)) {
    flare(ctx, S.red, TWR.mast, 199, 5, 0.5 + 0.5 * Math.cos(t * TAU / 1.5));
    const ph = (t / 1.1) % 1;
    if (ph < 0.12) flare(ctx, S.green, TWR.mast, 213, 12, 1 - ph / 0.12);
    else if (ph > 0.5 && ph < 0.62) flare(ctx, S.white, TWR.mast, 213, 12, 1 - (ph - 0.5) / 0.12);
  }
  if (off < 220) {
    const a = 0.5 + 0.5 * Math.cos(t * TAU / 1.8);
    flare(ctx, S.red, 30, 427, 3.5, a);
    flare(ctx, S.red, 194, 427, 3.5, a);
  }
  // Funkeln der LED-Bäume
  const lim = 0.8;
  const share = 0.3 * q;
  for (let i = 0; i < L.ledDots.length; i++) {
    const p = L.ledDots[i];
    if (p.x < off - 10 || p.x > off + vw + 10) continue;
    const h = p.h;
    if (h > share) continue;
    const s = Math.sin(t * (1.6 + h * 9) + h * 130);
    if (s < lim) continue;
    const a = (s - lim) / (1 - lim);
    flare(ctx, p.blue ? S.blue : S.ice, p.x, p.y, 3.4, a);
  }
  // Lichterkette T3
  for (let i = 0; i < L.roofLights.length; i++) {
    const p = L.roofLights[i];
    if (p.x < off - 10 || p.x > off + vw + 10) continue;
    const s = Math.sin(t * 2.2 - i * 0.45);
    if (s < 0.75) continue;
    flare(ctx, p.blue ? S.blue : S.ice, p.x, p.y, 4, (s - 0.75) * 3);
  }
  if (off < HANGAR_A.x + HANGAR_A.w + 10) {
    for (let i = 0; i < L.hangarLights.length; i++) {
      const p = L.hangarLights[i];
      const s = Math.sin(t * 2.2 + i * 0.45);
      if (s < 0.75) continue;
      flare(ctx, p.blue ? S.blue : S.ice, p.x, p.y, 4, (s - 0.75) * 3);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Radarantenne dreht sich
  if (view.isVisible('mid', RADAR.x, 30)) {
    const c = Math.cos(t * 2.4);
    const hw = 1.5 + 10 * Math.abs(c);
    ctx.fillStyle = c > 0 ? '#eef0f8' : '#8e94b6';
    ctx.fillRect(RADAR.x - hw, RADAR.y - 2.5, hw * 2, 4.5);
    ctx.fillStyle = '#5e6488';
    ctx.fillRect(RADAR.x - hw, RADAR.y + 1.4, hw * 2, 0.8);
  }
  // Sonnenglitzern im Wasser vor der Insel (unter der Sonne der fernen Ebene)
  const sunX = off + SUN.x - view.layerOffset('far');
  glitter(ctx, sunX, SEAWALL + 9, 8, 2.6, 30, t + 3, q);
}

function dynNear(ctx, t, view, S, L) {
  const off = view.layerOffset('near');
  const vw = view.viewW;
  const vis = (x) => x > off - 30 && x < off + vw + 30;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < L.nearLanterns.length; i++) {
    const p = L.nearLanterns[i];
    if (!vis(p.x)) continue;
    const f = 0.22 + 0.08 * Math.sin(t * 5.3 + i * 1.7) * Math.sin(t * 3.1 + i);
    flare(ctx, S.warm, p.x, p.y + 8.5, 26, f);
  }
  for (let i = 0; i < L.stoneLights.length; i++) {
    const p = L.stoneLights[i];
    if (!vis(p.x)) continue;
    flare(ctx, S.warm, p.x, p.y, 34, 0.25 + 0.1 * Math.sin(t * 6.1 + i * 2) * Math.sin(t * 2.3 + i));
  }
  const q = view.quality ?? 1;
  for (let i = 0; i < L.railLights.length; i++) {
    const p = L.railLights[i];
    if (!vis(p.x)) continue;
    const s = Math.sin(t * 1.7 + p.h * 30);
    const thr = 0.9 - 0.1 * q;
    if (s < thr) continue;
    flare(ctx, p.warm ? S.gold : S.ice, p.x, p.y, 7, ((s - thr) / (1 - thr)) * 0.8);
  }
  for (let i = 0; i < L.pineLights.length; i++) {
    const p = L.pineLights[i];
    if (!vis(p.x)) continue;
    const s = Math.sin(t * 2.3 + p.h * 30);
    if (s < 0.8) continue;
    flare(ctx, p.warm ? S.gold : S.ice, p.x, p.y, 6, (s - 0.8) * 5);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// --- Szene ------------------------------------------------------------------------------------
export default {
  id: 'HND', iata: 'HND', icao: 'RJTT',
  name: 'Tokio Haneda', city: 'Tokio', country: 'Japan',
  subtitle: 'Morgenrot über Fuji und Bucht',
  theme: { accent: '#ff9f86', skyTop: '#1f3166', skyBottom: '#ffcb9c' },
  weather: { snow: 0.3 },
  layerTop: { far: 50, mid: 192, near: 298 },

  paintSky,

  paintLayer(ctx, layerId, { w, rng }) {
    if (layerId === 'far') paintFar(ctx, w, rng);
    else if (layerId === 'mid') paintMid(ctx, w, rng);
    else if (layerId === 'near') paintNear(ctx, w, rng);
  },

  drawDynamic(ctx, layerId, { t, view }) {
    if (layerId === 'sky') return;
    const S = sprites();
    const L = layout();
    ctx.save();
    if (layerId === 'far') dynFar(ctx, t, view, S, L);
    else if (layerId === 'mid') dynMid(ctx, t, view, S, L);
    else if (layerId === 'near') dynNear(ctx, t, view, S, L);
    ctx.restore();
  },

  traffic: {
    planeScale: { far: 0.38, mid: 1.0, near: 2.2 },
    runways: [
      { id: '34R', layer: 'mid', y: RWY.y, x1: RWY.x1, x2: RWY.x2, dir: -1, use: 'mixed', arrivalsPerMin: 3.6, departuresPerMin: 3.2, approach: { startY: 130, lowFlyLayer: null } },
    ],
    taxiways: [{ layer: 'mid', y: TAXI_Y, x1: 90, x2: 2330 }],
    gates: GATES.map((g) => ({ layer: 'mid', x: g.x, y: GATE_Y, dir: g.dir })),
    overflights: [
      { layer: 'far', yMin: 45, yMax: 190, perMin: 5, contrails: true },
      { layer: 'mid', yMin: 110, yMax: 250, perMin: 1.4, contrails: false },
    ],
    helicopters: 0.4,
    fleet: { narrow: 7, wide: 6, jumbo: 0.4, a380: 0, regional: 1.5, prop: 0.8 },
    // Neutrale Lackierungen ohne echte Airline-Marken
    liveries: [
      { body: '#f7f9fc', belly: '#dfe5ef', tail: '#13448f', accent: '#3d8fd6', cheatline: '#13448f', engine: '#13448f' },
      { body: '#ffffff', belly: '#e6e8ee', tail: '#ffffff', accent: '#d7263d', cheatline: null, engine: '#c9ced8' },
      { body: '#f4f6fa', belly: '#d5dbe6', tail: '#e88aa6', accent: '#b8406a', cheatline: '#e88aa6', engine: '#e6e9ef' },
      { body: '#f6f7f9', belly: '#cfd6e2', tail: '#1f2f4f', accent: '#f2a03d', cheatline: '#f2a03d', engine: '#1f2f4f' },
      { body: '#eef3f7', belly: '#c9d3df', tail: '#2c9bb8', accent: '#f6c445', cheatline: '#2c9bb8', engine: '#d8dee6' },
      { body: '#fbfbfb', belly: '#e1e4ea', tail: '#6b2d8f', accent: '#f0b23b', cheatline: null, engine: '#6b2d8f' },
      { body: '#f2f4f7', belly: '#d6dbe3', tail: '#c9302c', accent: '#ffffff', cheatline: '#c9302c', engine: '#c9ced6' },
      { body: '#ffffff', belly: '#e8ebf0', tail: '#0f7a5a', accent: '#9bd1b8', cheatline: '#0f7a5a', engine: '#0f7a5a' },
    ],
  },

  eagleZones: { far: [50, 330], mid: [70, 390], near: [40, 470] },
  // x = Mitte der Kante; Werte so gewählt, dass auch „x = linker Rand“ noch auf der Kante liegt
  hideSpots: [
    { layer: 'mid', x: 1015, y: 411, w: 70 },   // Dachscheitel Terminal 3
    { layer: 'mid', x: 1100, y: 228, w: 30 },   // Tower-Kanzeldach
    { layer: 'mid', x: 100, y: 426, w: 60 },    // Hangar 1
    { layer: 'mid', x: 2270, y: 427, w: 56 },   // Dach Terminal 2
    { layer: 'near', x: 2330, y: 453, w: 56 },  // Torii-Querbalken
  ],
};
