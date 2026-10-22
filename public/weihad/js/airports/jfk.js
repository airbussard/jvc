// New York JFK – klare Winternacht, Manhattan glüht jenseits der Jamaica Bay
import { linearSky, glow, snowCap, transparentOf } from './paint.js';

const TAU = Math.PI * 2;

// Feste Koordinaten – Verkehr, Verstecke und Malerei hängen daran
const FAR_BASE = 440;                            // Fußlinie der Skyline
const WATER = [441, 467];                        // Jamaica Bay
const FAR_RWY = { y: 477, x1: 120, x2: 1680 };   // ferne Piste 04L/22R
const FAR_TAXI = { y: 470.9, lanes: [472.3, 469.4] }; // Rollweg davor (Abflug-/Ankunftsspur)
const MID_TOP = 486;                             // Oberkante Flughafengelände (mid)
const BASE = 506;                                // Gebäudesockel
const GATE_Y = 522;
const TAXI_Y = 556;
const RWY = { y: 600, x1: 110, x2: 2290, depth: 22 };
const T4 = { x1: 380, x2: 1152, roof: 440, hall1: 690, hall2: 880 };
const T8 = { x1: 1878, x2: 2352, roof: 446 };
const TWA_X = 1500;
const TOWER_X = 1800;
const TREE = { x: 1272, y: 514, h: 152 };
const NEAR_ROAD = [654, 676];

// Parkpositionen (x = Fahrwerksmitte); bridge = Fluggastbrücke vor der Tür
const GATES = [
  { x: 168, dir: 1, bridge: false },
  { x: 512, dir: -1, bridge: true },
  { x: 714, dir: -1, bridge: true },
  { x: 916, dir: -1, bridge: true },
  { x: 1118, dir: -1, bridge: true },
  { x: 1990, dir: 1, bridge: true },
  { x: 2196, dir: 1, bridge: true },
];

const BULBS = ['255,72,72', '255,196,72', '86,226,118', '92,168,255', '255,238,214'];
const TREE_BULBS = ['255,64,64', '255,190,60', '80,220,120', '90,160,255', '255,245,220', '255,120,200'];

// Positionen für Animationen – werden beim Vorrendern gefüllt
const DYN = { far: null, mid: null, near: null };

// --- Hilfen -------------------------------------------------------------------

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(a, b, x) {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

const SPRITES = new Map();
// Weicher Lichtpunkt je Farbe, einmalig vorgerendert – pro Frame nur drawImage
function sprite(rgb) {
  let c = SPRITES.get(rgb);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, `rgba(${rgb},1)`);
    grd.addColorStop(0.14, `rgba(${rgb},0.62)`);
    grd.addColorStop(0.42, `rgba(${rgb},0.16)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    SPRITES.set(rgb, c);
  }
  return c;
}

function flare(ctx, x, y, r, rgb, a = 1) {
  if (a <= 0.02) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, a);
  ctx.drawImage(sprite(rgb), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prev;
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function hgrad(ctx, x0, x1, stops) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

// Elliptischer Lichtschein (z. B. Lichtpfütze am Boden)
function pool(ctx, x, y, rx, ry, rgba0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx / ry, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
  g.addColorStop(0, rgba0);
  g.addColorStop(1, transparentOf(rgba0));
  ctx.fillStyle = g;
  ctx.fillRect(-ry, -ry, ry * 2, ry * 2);
  ctx.restore();
}

function snowMound(ctx, x, y, w, h, lit = '#eef3fc', shade = '#a9b8d8') {
  ctx.fillStyle = vgrad(ctx, y - h, y, [[0, lit], [1, shade]]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + w * 0.12, y - h * 0.85, x + w * 0.3, y - h, x + w * 0.5, y - h);
  ctx.bezierCurveTo(x + w * 0.72, y - h, x + w * 0.86, y - h * 0.7, x + w, y);
  ctx.closePath();
  ctx.fill();
}

// Lichterkette mit Durchhang zwischen Haken; Birnen landen optional in der Funkel-Liste
function bulbString(ctx, list, x1, x2, y, { sag = 3, step = 7, hook = 42, colors = BULBS, r = 0.9, glowR = 4.5 } = {}) {
  ctx.strokeStyle = 'rgba(16,20,28,0.75)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = x1; x <= x2; x += 2) {
    const k = ((x - x1) % hook) / hook;
    const yy = y + Math.sin(k * Math.PI) * sag;
    if (x === x1) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.stroke();
  let i = 0;
  for (let x = x1 + step / 2; x < x2; x += step, i++) {
    const k = ((x - x1) % hook) / hook;
    const yy = y + Math.sin(k * Math.PI) * sag + 1;
    const c = colors[i % colors.length];
    flare(ctx, x, yy, glowR, c, 0.5);
    dot(ctx, x, yy, r, `rgb(${c})`);
    if (list) list.push({ x, y: yy, c, r: glowR * 1.4, ph: hash(x) * TAU, s: 1.2 + hash(x + 7) * 2.4 });
  }
}

// --- Himmel -------------------------------------------------------------------

function moonPos(w) {
  return { x: Math.round(w * 0.68), y: 128, r: 38 };
}

function paintSky(ctx, { w, h, rng }) {
  linearSky(ctx, w, h, [
    [0, '#040a1f'], [0.15, '#081636'], [0.32, '#122a5c'], [0.46, '#1e3c77'],
    [0.53, '#2f4882'], [0.565, '#5c5282'], [0.592, '#a2655a'], [0.615, '#d47e4c'], [1, '#e08d50'],
  ]);
  const m = moonPos(w);

  // Sterne – oben dichter, im Mondhof ausgedünnt
  const n = Math.round(w * 0.2);
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, w);
    const y = rng.next() ** 1.45 * 390;
    const dm = Math.hypot(x - m.x, y - m.y);
    if (dm < m.r * 2.2) continue;
    ctx.globalAlpha = (1 - y / 420) * rng.range(0.3, 1) * Math.min(1, dm / (m.r * 5));
    dot(ctx, x, y, rng.range(0.35, 1.05), rng.chance(0.2) ? '#c6d9ff' : rng.chance(0.1) ? '#ffe6c4' : '#ffffff');
  }
  ctx.globalAlpha = 1;
  // Einige helle Sterne mit feinen Strahlen
  for (let i = 0, k = Math.max(2, Math.round(w / 170)); i < k; i++) {
    const x = rng.range(10, w - 10);
    const y = rng.range(18, 280);
    if (Math.hypot(x - m.x, y - m.y) < m.r * 3) continue;
    const s = rng.range(3, 6);
    flare(ctx, x, y, s * 1.6, '200,220,255', 0.5);
    ctx.fillStyle = 'rgba(235,242,255,0.75)';
    ctx.fillRect(x - s, y - 0.25, s * 2, 0.5);
    ctx.fillRect(x - 0.25, y - s, 0.5, s * 2);
    dot(ctx, x, y, 0.9, '#ffffff');
  }

  // Schleierwolken über dem Horizont, von unten orange angestrahlt
  for (let i = 0, k = 2 + Math.round(w / 520); i < k; i++) {
    const cx = rng.range(-50, w + 50);
    const cy = rng.range(338, 404);
    const cw = rng.range(160, 360);
    pool(ctx, cx, cy, cw, rng.range(4, 8), 'rgba(170,120,150,0.22)');
    pool(ctx, cx + rng.range(-30, 30), cy + 3, cw * 0.7, 3, 'rgba(255,160,110,0.16)');
  }

  // Lichtglocke der Stadt
  ctx.save();
  ctx.translate(w * 0.5, 452);
  ctx.scale(Math.max(1, w / 760), 0.3);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 520);
  g.addColorStop(0, 'rgba(255,150,90,0.38)');
  g.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-520, -520, 1040, 520);
  ctx.restore();

  paintMoon(ctx, m.x, m.y, m.r);
}

function paintMoon(ctx, x, y, r) {
  glow(ctx, x, y, r * 7.5, 'rgba(150,180,255,0.17)');
  glow(ctx, x, y, r * 2.6, 'rgba(225,235,255,0.32)');
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#fffdf3');
  g.addColorStop(0.72, '#f1ebd4');
  g.addColorStop(1, '#d4ccb0');
  dot(ctx, x, y, r, g);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  // Mare-Flecken
  ctx.fillStyle = 'rgba(148,142,118,0.24)';
  for (const [dx, dy, rx, ry, rot] of [
    [-0.3, -0.2, 0.3, 0.2, 0.5], [0.08, -0.38, 0.2, 0.13, -0.3], [0.3, 0.1, 0.22, 0.3, 0.25],
    [-0.1, 0.36, 0.24, 0.12, 0.1], [0.46, -0.22, 0.1, 0.13, 0], [-0.52, 0.12, 0.1, 0.16, 0.4],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * r, y + dy * r, rx * r, ry * r, rot, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(120,114,92,0.2)';
  for (const [dx, dy, rr] of [[-0.12, 0.62, 0.07], [0.55, 0.42, 0.05], [-0.6, -0.4, 0.05], [0.2, 0.58, 0.04]]) dot(ctx, x + dx * r, y + dy * r, rr * r, ctx.fillStyle);
  // Randabdunklung
  const rim = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.6, x, y, r * 1.05);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(90,80,60,0.28)');
  ctx.fillStyle = rim;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// --- Ferne Ebene: Manhattan jenseits der Bucht --------------------------------

// Grobe Höhenverteilung der Skyline (Lower Manhattan, Midtown, Long Island City)
function skyH(x) {
  const g = (c, s) => Math.exp(-(((x - c) / s) ** 2));
  return 10 + 118 * g(660, 95) + 58 * g(830, 70) + 70 * g(960, 70) + 138 * g(1180, 165) + 72 * g(1478, 55);
}

function farWindows(ctx, rng, x, y, w, h, lit, dim = 1, cw = 2.5, ch = 3.2) {
  const cols = Math.max(1, Math.floor(w / cw));
  const rows = Math.max(1, Math.floor(h / ch));
  const ox = x + (w - cols * cw) / 2;
  for (let r = 0; r < rows; r++) {
    const rowLit = lit * rng.range(0.25, 1.7);
    for (let c = 0; c < cols; c++) {
      if (!rng.chance(rowLit)) continue;
      ctx.globalAlpha = rng.range(0.45, 0.95) * dim;
      ctx.fillStyle = rng.chance(0.68) ? (rng.chance(0.7) ? '#ffd78f' : '#ffb466') : '#d4e3ff';
      ctx.fillRect(ox + c * cw + cw * 0.22, y + r * ch + ch * 0.28, cw * 0.56, ch * 0.46);
    }
  }
  ctx.globalAlpha = 1;
}

function farTower(ctx, rng, D, o) {
  const { x, w, h, col, lit, dim = 1, back = false } = o;
  const base = FAR_BASE;
  const top = base - h;
  const cx = x + w / 2;
  ctx.fillStyle = col;
  ctx.fillRect(x, top, w, h + 1);
  ctx.fillStyle = back ? 'rgba(255,175,130,0.05)' : 'rgba(255,175,130,0.08)';
  ctx.fillRect(x, top, Math.max(1, w * 0.3), h);
  ctx.fillStyle = 'rgba(2,4,18,0.24)';
  ctx.fillRect(x + w * 0.7, top, w * 0.3, h);
  farWindows(ctx, rng, x + 0.8, top + 3, w - 1.6, h - 5, lit, dim);
  switch (o.roof) {
    case 'antenna': {
      const ah = rng.range(8, 22);
      ctx.fillStyle = col;
      ctx.fillRect(cx - w * 0.2, top - 3, w * 0.4, 3);
      ctx.fillStyle = back ? '#3e4472' : '#56608a';
      ctx.fillRect(cx - 0.45, top - 3 - ah, 0.9, ah);
      if (!back) D.beacons.push({ x: cx, y: top - 3 - ah, r: 5, rgb: '255,50,40', p: rng.range(1.5, 2.4), ph: rng.next() });
      dot(ctx, cx, top - 3 - ah, 0.7, back ? 'rgba(255,80,70,0.5)' : '#b8322c');
      break;
    }
    case 'setback': {
      const h2 = rng.range(6, 14);
      const h3 = rng.range(4, 9);
      ctx.fillStyle = col;
      ctx.fillRect(cx - w * 0.35, top - h2, w * 0.7, h2 + 1);
      ctx.fillRect(cx - w * 0.2, top - h2 - h3, w * 0.4, h3 + 1);
      farWindows(ctx, rng, cx - w * 0.33, top - h2 + 1, w * 0.66, h2 - 2, lit, dim);
      break;
    }
    case 'crown': {
      const c = rng.pick(['232,240,255', '255,226,168', '184,212,255']);
      ctx.globalAlpha = back ? 0.45 : 0.9;
      ctx.fillStyle = `rgb(${c})`;
      ctx.fillRect(x + 0.8, top - 3, w - 1.6, 2.2);
      ctx.fillRect(x + 0.8, top + 1, w - 1.6, 0.8);
      ctx.globalAlpha = 1;
      if (!back) flare(ctx, cx, top - 2, w * 0.9, c, 0.3);
      break;
    }
    case 'pyramid': {
      // Vergoldete, von unten angestrahlte Pyramidenspitze
      const ph = w * 0.75;
      poly(ctx, [[x, top], [cx, top - ph], [x + w, top]]);
      ctx.fillStyle = vgrad(ctx, top - ph, top, back
        ? [[0, '#3a3858'], [1, '#6a5a5c']]
        : [[0, '#5a4630'], [0.55, '#b98a42'], [1, '#ffd88a']]);
      ctx.fill();
      ctx.strokeStyle = back ? 'rgba(255,214,140,0.3)' : 'rgba(255,226,160,0.75)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      poly(ctx, [[cx, top - ph], [x + w, top], [cx + w * 0.08, top]], 'rgba(10,8,30,0.35)');
      if (!back) {
        flare(ctx, cx, top - w * 0.4, w * 0.9, '255,200,120', 0.35);
        D.beacons.push({ x: cx, y: top - w * 0.75, r: 4.5, rgb: '255,50,40', p: rng.range(1.5, 2.4), ph: rng.next() });
      }
      break;
    }
    case 'slant': {
      poly(ctx, [[x, top], [x + w, top - w * 0.9], [x + w, top]], col);
      ctx.strokeStyle = back ? 'rgba(220,232,255,0.35)' : 'rgba(225,236,255,0.85)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + w, top - w * 0.9);
      ctx.stroke();
      break;
    }
    case 'water': {
      const tx = x + rng.range(0.15, 0.55) * w;
      ctx.fillStyle = back ? '#2a2f58' : '#0c1124';
      ctx.fillRect(tx, top - 2.2, 0.6, 2.2);
      ctx.fillRect(tx + 3.2, top - 2.2, 0.6, 2.2);
      ctx.fillRect(tx - 0.2, top - 6.4, 4.2, 4.3);
      poly(ctx, [[tx - 0.6, top - 6.3], [tx + 1.9, top - 8.8], [tx + 4.4, top - 6.3]], ctx.fillStyle);
      break;
    }
    case 'spire':
      poly(ctx, [[cx - 1.1, top], [cx, top - rng.range(10, 20)], [cx + 1.1, top]], col);
      break;
    default:
      ctx.fillStyle = col;
      ctx.fillRect(x + w * rng.range(0.1, 0.5), top - 2.5, w * 0.35, 2.6);
  }
}

function empireState(ctx, rng, D, refl, cx) {
  const base = FAR_BASE;
  const body = '#1a2245';
  for (const [tw, a, b] of [[46, 0, 22], [36, 22, 36], [28, 36, 150]]) {
    ctx.fillStyle = body;
    ctx.fillRect(cx - tw / 2, base - b, tw, b - a + 1);
    ctx.fillStyle = 'rgba(190,205,245,0.07)';
    for (let x = cx - tw / 2 + 1.5; x < cx + tw / 2 - 1; x += 3) ctx.fillRect(x, base - b, 0.6, b - a);
    farWindows(ctx, rng, cx - tw / 2 + 1, base - b + 2, tw - 2, b - a - 3, 0.42, 1, 3, 3.1);
    ctx.fillStyle = 'rgba(2,4,18,0.25)';
    ctx.fillRect(cx + tw * 0.2, base - b, tw * 0.3, b - a);
  }
  // Weihnachtskrone in Rot und Grün
  const crown = [
    [22, 150, 158, '#ff4040', '#8e1220'],
    [17, 158, 165, '#3ce47e', '#11703a'],
    [12, 165, 171, '#ff4a4a', '#94131e'],
  ];
  flare(ctx, cx, base - 160, 52, '255,60,60', 0.42);
  flare(ctx, cx, base - 176, 36, '60,255,130', 0.3);
  for (const [tw, a, b, c1, c2] of crown) {
    ctx.fillStyle = vgrad(ctx, base - b, base - a, [[0, c2], [1, c1]]);
    ctx.fillRect(cx - tw / 2, base - b, tw, b - a);
    ctx.fillStyle = 'rgba(40,0,10,0.3)';
    for (let x = cx - tw / 2 + 1.4; x < cx + tw / 2 - 1; x += 2.6) ctx.fillRect(x, base - b + 1, 0.9, b - a - 2);
  }
  // Ankermast: grün, darüber weiß, dann Antenne
  ctx.fillStyle = vgrad(ctx, base - 186, base - 171, [[0, '#a6ffc8'], [1, '#22b85e']]);
  ctx.fillRect(cx - 3.4, base - 186, 6.8, 15);
  ctx.beginPath();
  ctx.ellipse(cx, base - 186, 3.4, 2.4, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#ffe8e8';
  ctx.fillRect(cx - 1.2, base - 194, 2.4, 7);
  ctx.fillStyle = '#c0c6dc';
  ctx.fillRect(cx - 0.45, base - 222, 0.9, 29);
  D.beacons.push({ x: cx, y: base - 222, r: 5.5, rgb: '255,50,40', p: 2, ph: 0.3 });
  D.esb = { x: cx, y: base - 166 };
  refl.push({ x: cx - 3, rgb: '255,80,80', a: 0.9, w: 6 }, { x: cx + 3, rgb: '80,255,150', a: 0.65, w: 4 });
}

function oneWTC(ctx, rng, D, refl, cx) {
  const base = FAR_BASE;
  const pod = base - 30;
  const top = base - 188;
  const bw = 21;
  const tw = 12;
  ctx.fillStyle = '#172042';
  ctx.fillRect(cx - bw, pod, bw * 2, 31);
  farWindows(ctx, rng, cx - bw + 1, pod + 2, bw * 2 - 2, 26, 0.22);
  ctx.save();
  poly(ctx, [[cx - bw, pod], [cx + bw, pod], [cx + tw, top], [cx - tw, top]]);
  ctx.fillStyle = hgrad(ctx, cx - bw, cx + bw, [[0, '#2c3d6e'], [0.5, '#22305c'], [1, '#111a39']]);
  ctx.fill();
  ctx.clip();
  poly(ctx, [[cx - bw, pod], [cx + bw, pod], [cx, top]], 'rgba(140,180,240,0.17)');
  poly(ctx, [[cx - bw, pod], [cx - tw, top], [cx, top]], 'rgba(255,180,130,0.08)');
  ctx.fillStyle = 'rgba(180,200,255,0.07)';
  for (let y = top + 2; y < pod; y += 2.4) ctx.fillRect(cx - bw, y, bw * 2, 0.4);
  farWindows(ctx, rng, cx - bw, top + 2, bw * 2, pod - top - 2, 0.16, 0.85, 2.2, 2.4);
  ctx.strokeStyle = 'rgba(210,225,255,0.3)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - bw, pod);
  ctx.lineTo(cx, top);
  ctx.lineTo(cx + bw, pod);
  ctx.stroke();
  ctx.restore();
  // Brüstung und Antenne
  flare(ctx, cx, top - 2, 22, '200,220,255', 0.35);
  ctx.fillStyle = '#e2ebff';
  ctx.fillRect(cx - tw - 0.5, top - 3, tw * 2 + 1, 3);
  ctx.fillStyle = '#8f9bbd';
  ctx.fillRect(cx - 2.6, top - 7, 5.2, 4);
  ctx.fillRect(cx - 0.8, top - 56, 1.6, 50);
  for (let y = top - 14; y > top - 52; y -= 8) ctx.fillRect(cx - 1.7, y, 3.4, 0.7);
  D.beacons.push({ x: cx, y: top - 56, r: 7, rgb: '255,255,255', p: 1.6, ph: 0.1 });
  refl.push({ x: cx, rgb: '200,220,255', a: 0.55, w: 6 });
}

function chrysler(ctx, rng, D, refl, cx) {
  const base = FAR_BASE;
  ctx.fillStyle = '#19213f';
  for (const [hw, a, b] of [[17, 0, 40], [13, 40, 98], [10, 98, 118]]) {
    ctx.fillStyle = '#19213f';
    ctx.fillRect(cx - hw, base - b, hw * 2, b - a + 1);
    farWindows(ctx, rng, cx - hw + 1, base - b + 2, hw * 2 - 2, b - a - 3, 0.4);
    ctx.fillStyle = 'rgba(2,4,18,0.25)';
    ctx.fillRect(cx + hw * 0.4, base - b, hw * 0.6, b - a);
  }
  const c0 = base - 118;
  flare(ctx, cx, c0 - 10, 34, '210,225,255', 0.4);
  for (let i = 0; i < 6; i++) {
    const r = 10 - i * 1.45;
    const cy = c0 - i * 4.4;
    ctx.fillStyle = vgrad(ctx, cy - r, cy + 3, [[0, '#f4f7ff'], [1, '#8f9bc0']]);
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + 3);
    ctx.lineTo(cx - r, cy);
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.lineTo(cx + r, cy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,26,50,0.55)';
    ctx.lineWidth = 0.35;
    ctx.stroke();
    // Dreiecksfenster als Sonnenstrahlen
    ctx.fillStyle = '#fff2c4';
    const n = 7 - i;
    for (let k = 0; k < n; k++) {
      const a = Math.PI + ((k + 0.5) / n) * Math.PI;
      const r1 = r - 0.5;
      const r0 = r - 2.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.12) * r0, cy + Math.sin(a - 0.12) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a + 0.12) * r0, cy + Math.sin(a + 0.12) * r0);
      ctx.fill();
    }
  }
  const tipBase = c0 - 5 * 4.4 - 2.6;
  poly(ctx, [[cx - 1.4, tipBase + 1], [cx, base - 172], [cx + 1.4, tipBase + 1]], '#e6ecff');
  refl.push({ x: cx, rgb: '235,240,255', a: 0.6, w: 5 });
}

function suspensionBridge(ctx, D, refl, x1, x2, deckY, topY) {
  const span = x2 - x1;
  const L = x1 - span * 0.55;
  const R = x2 + span * 0.55;
  const mid = (x1 + x2) / 2;
  const sagY = deckY - 4;
  const mainY = (x) => topY + (sagY - topY) * (1 - ((x - mid) / (span / 2)) ** 2);
  const sideY = (x) => {
    const k = x < x1 ? (x1 - x) / (x1 - L) : (x - x2) / (R - x2);
    return topY + (deckY - topY) * (1 - (1 - k) ** 1.7);
  };
  const cableY = (x) => (x < x1 || x > x2 ? sideY(x) : mainY(x));
  // Hänger
  ctx.strokeStyle = 'rgba(150,170,225,0.3)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  for (let x = L + 4; x < R - 4; x += 4) {
    if (Math.abs(x - x1) < 3 || Math.abs(x - x2) < 3) continue;
    ctx.moveTo(x, cableY(x));
    ctx.lineTo(x, deckY);
  }
  ctx.stroke();
  // Tragseile
  ctx.strokeStyle = '#56628f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = L; x <= R; x += 2) {
    if (x === L) ctx.moveTo(x, cableY(x));
    else ctx.lineTo(x, cableY(x));
  }
  ctx.stroke();
  // Fahrbahn
  ctx.fillStyle = '#141a36';
  ctx.fillRect(L - 20, deckY, R - L + 40, 3.2);
  for (let x = L - 18; x < R + 18; x += 4.5) {
    ctx.fillStyle = 'rgba(255,190,120,0.9)';
    ctx.fillRect(x, deckY + 0.6, 0.9, 0.9);
  }
  // Pylone
  for (const px of [x1, x2]) {
    ctx.fillStyle = '#28325e';
    ctx.fillRect(px - 3.2, topY - 2, 1.8, deckY - topY + 10);
    ctx.fillRect(px + 1.4, topY - 2, 1.8, deckY - topY + 10);
    for (const yy of [topY - 2, topY + (deckY - topY) * 0.45, deckY - 3]) ctx.fillRect(px - 3.2, yy, 6.4, 1.6);
    ctx.fillStyle = 'rgba(255,200,150,0.18)';
    ctx.fillRect(px - 3.2, topY, 0.7, deckY - topY);
    D.beacons.push({ x: px, y: topY - 3, r: 5, rgb: '255,50,40', p: 1.8, ph: px * 0.01 });
    dot(ctx, px, topY - 3, 0.8, '#c03028');
  }
  // Perlenkette entlang der Seile
  for (let x = L + 3; x < R - 2; x += 6.5) {
    const y = cableY(x);
    flare(ctx, x, y, 3.2, '255,246,220', 0.55);
    dot(ctx, x, y, 0.55, '#fff8e6');
    if (x % 26 < 6.5) refl.push({ x, rgb: '255,240,210', a: 0.35, w: 2.5 });
  }
}

function cantileverBridge(ctx, D, refl, x0, deckY) {
  const pts = [[x0, deckY], [x0 + 80, deckY - 32], [x0 + 145, deckY - 11], [x0 + 210, deckY - 32], [x0 + 290, deckY - 4], [x0 + 340, deckY - 4]];
  ctx.strokeStyle = '#2c3664';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  // Fachwerk
  ctx.lineWidth = 0.45;
  ctx.strokeStyle = 'rgba(70,86,140,0.85)';
  ctx.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    for (let x = ax; x < bx; x += 7) {
      const t1 = (x - ax) / (bx - ax);
      const t2 = Math.min(1, (x + 3.5 - ax) / (bx - ax));
      ctx.moveTo(x, ay + (by - ay) * t1);
      ctx.lineTo(x + 3.5, deckY);
      ctx.lineTo(x + 7, ay + (by - ay) * Math.min(1, t2 + 3.5 / (bx - ax)));
    }
  }
  ctx.stroke();
  // Türmchen
  ctx.fillStyle = '#28325e';
  for (const i of [1, 3]) {
    const [px, py] = pts[i];
    ctx.fillRect(px - 2.5, py - 6, 1.4, deckY - py + 8);
    ctx.fillRect(px + 1.1, py - 6, 1.4, deckY - py + 8);
    D.beacons.push({ x: px, y: py - 7, r: 4.5, rgb: '255,50,40', p: 2.1, ph: i * 0.37 });
  }
  ctx.fillStyle = '#131936';
  ctx.fillRect(x0 - 30, deckY, 400, 3);
  // Lichter entlang Obergurt und Fahrbahn
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    for (let x = ax; x < bx; x += 7) {
      const y = ay + ((by - ay) * (x - ax)) / (bx - ax);
      flare(ctx, x, y, 2.6, '255,214,150', 0.5);
      dot(ctx, x, y, 0.45, '#ffe7b8');
    }
  }
  for (let x = x0 - 28; x < x0 + 370; x += 4) {
    ctx.fillStyle = 'rgba(255,190,120,0.85)';
    ctx.fillRect(x, deckY + 0.7, 0.8, 0.8);
    if (x % 40 < 4) refl.push({ x, rgb: '255,200,140', a: 0.3, w: 2 });
  }
}

function paintFar(ctx, w, rng) {
  const D = (DYN.far = { beacons: [], glints: [], esb: null });
  const refl = [];

  // Lichtglocke hinter der Skyline
  ctx.save();
  ctx.translate(1000, FAR_BASE);
  ctx.scale(1, 0.24);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 980);
  g.addColorStop(0, 'rgba(255,150,85,0.42)');
  g.addColorStop(0.45, 'rgba(255,125,90,0.15)');
  g.addColorStop(1, 'rgba(255,120,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-1000, -980, 2000, 980);
  ctx.restore();

  // Ferne Dunst-Silhouetten (New Jersey, Brooklyn)
  for (let x = -10; x < w + 10;) {
    const bw = rng.range(8, 26);
    const bh = rng.range(5, 20) + skyH(x) * 0.22 * rng.next();
    ctx.fillStyle = '#383b69';
    ctx.fillRect(x, FAR_BASE - bh, bw, bh + 2);
    farWindows(ctx, rng, x, FAR_BASE - bh + 2, bw, bh - 2, 0.07, 0.4);
    x += bw + rng.range(-3, 2);
  }

  const marks = [[660, 26], [1088, 26], [1250, 20]];
  const nearMark = (x, bw) => marks.some(([mx, mw]) => x + bw > mx - mw && x < mx + mw);

  // Hintere Türme (dunstig)
  for (let x = 450; x < 1580;) {
    const bw = rng.range(9, 19);
    const bh = skyH(x + bw / 2) * rng.range(0.55, 1.08);
    if (bh > 22) {
      farTower(ctx, rng, D, {
        x, w: bw, h: bh, col: '#282d5a', lit: 0.16, dim: 0.55, back: true,
        roof: rng.pick(['flat', 'flat', 'antenna', 'setback', 'crown', 'spire']),
      });
    }
    x += bw * rng.range(0.55, 0.95);
  }
  // Mittlere Reihe
  for (let x = 470; x < 1560;) {
    const bw = rng.range(11, 22);
    let bh = skyH(x + bw / 2) * rng.range(0.4, 0.92);
    if (nearMark(x, bw)) bh *= 0.55;
    if (bh > 16) {
      farTower(ctx, rng, D, {
        x, w: bw, h: bh, col: rng.pick(['#161d3c', '#19203f', '#141a37']), lit: 0.34,
        roof: rng.pick(['flat', 'antenna', 'setback', 'crown', 'pyramid', 'water', 'flat', 'antenna']),
      });
    }
    x += bw * rng.range(0.9, 1.5);
  }
  // Markante Einzeltürme in Midtown
  farTower(ctx, rng, D, { x: 1168, w: 15, h: 136, col: '#182040', lit: 0.36, roof: 'slant' });
  farTower(ctx, rng, D, { x: 1318, w: 9, h: 178, col: '#151c3a', lit: 0.3, roof: 'crown' });
  farTower(ctx, rng, D, { x: 968, w: 17, h: 128, col: '#18203f', lit: 0.34, roof: 'antenna' });
  farTower(ctx, rng, D, { x: 1478, w: 16, h: 104, col: '#123a3a', lit: 0.3, roof: 'pyramid' });

  oneWTC(ctx, rng, D, refl, 660);
  empireState(ctx, rng, D, refl, 1088);
  chrysler(ctx, rng, D, refl, 1250);

  // Vordere, niedrigere Türme
  for (let x = 480; x < 1540;) {
    const bw = rng.range(10, 20);
    let bh = skyH(x + bw / 2) * rng.range(0.18, 0.45);
    if (nearMark(x, bw)) bh = Math.min(bh, 46);
    if (bh > 14) {
      farTower(ctx, rng, D, {
        x, w: bw, h: bh, col: rng.pick(['#10162f', '#121831']), lit: 0.4,
        roof: rng.pick(['flat', 'water', 'flat', 'setback', 'water']),
      });
    }
    x += bw * rng.range(1.2, 2.4);
  }

  // Niedrige Bebauung von Brooklyn und Queens
  for (let x = -10; x < w + 10;) {
    const bw = rng.range(5, 17);
    const bh = rng.range(4, 12) * (1 + 0.8 * Math.exp(-(((x - 1480) / 140) ** 2)));
    const top = FAR_BASE + 1 - bh;
    ctx.fillStyle = rng.pick(['#121832', '#151b38', '#10152d', '#171d3a']);
    ctx.fillRect(x, top, bw, bh + 2);
    for (let i = 0, k = Math.round(bw * bh * 0.05); i < k; i++) {
      ctx.fillStyle = rng.chance(0.8) ? 'rgba(255,205,130,0.8)' : 'rgba(210,225,255,0.7)';
      ctx.fillRect(x + rng.range(0.5, bw - 1.2), top + rng.range(1, bh - 1), 0.8, 0.8);
    }
    if (rng.chance(0.08)) {
      // Wassertank
      const tx = x + bw * 0.3;
      ctx.fillStyle = '#0d1226';
      ctx.fillRect(tx, top - 1.8, 0.5, 1.8);
      ctx.fillRect(tx + 2.6, top - 1.8, 0.5, 1.8);
      ctx.fillRect(tx - 0.2, top - 5, 3.5, 3.3);
      poly(ctx, [[tx - 0.5, top - 5], [tx + 1.55, top - 7], [tx + 3.6, top - 5]], '#0d1226');
    } else if (rng.chance(0.04)) {
      // Kirchturm
      poly(ctx, [[x + bw * 0.4, top], [x + bw * 0.5, top - 12], [x + bw * 0.6, top]], '#121832');
    }
    x += bw;
  }
  for (let x = 0; x < w; x += rng.range(2.5, 8)) {
    ctx.fillStyle = 'rgba(255,170,90,0.75)';
    ctx.fillRect(x, FAR_BASE - 0.5 + rng.range(-1, 0.5), 0.8, 0.8);
  }

  suspensionBridge(ctx, D, refl, 120, 400, FAR_BASE - 13, 362);
  cantileverBridge(ctx, D, refl, 1520, FAR_BASE - 12);

  // Wasser der Bucht
  ctx.fillStyle = vgrad(ctx, WATER[0], WATER[1], [[0, '#3c3358'], [0.2, '#262649'], [1, '#121834']]);
  ctx.fillRect(-5, WATER[0], w + 10, WATER[1] - WATER[0] + 1);
  for (let i = 0; i < 520; i++) {
    const x = rng.range(0, w);
    const y = rng.range(WATER[0] + 1, WATER[1] - 1);
    const k = (y - WATER[0]) / (WATER[1] - WATER[0]);
    ctx.globalAlpha = (1 - k) * rng.range(0.15, 0.55) * Math.min(1, skyH(x) / 60 + 0.3);
    ctx.fillStyle = rng.chance(0.75) ? '#ffc98a' : '#c8d6ff';
    ctx.fillRect(x, y, rng.range(1, 6), 0.45);
  }
  for (const r of refl) {
    for (let y = WATER[0] + 1; y < WATER[1] - 1; y += 1.3) {
      const k = (y - WATER[0]) / (WATER[1] - WATER[0]);
      ctx.globalAlpha = r.a * (1 - k) * rng.range(0.3, 1);
      ctx.fillStyle = `rgb(${r.rgb})`;
      const ww = r.w * rng.range(0.5, 1.3) * (1 + k * 0.8);
      ctx.fillRect(r.x - ww / 2 + rng.range(-1.2, 1.2), y, ww, 0.6);
    }
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 160; i++) {
    const x = rng.range(0, w);
    D.glints.push({
      x, y: rng.range(WATER[0] + 1.5, WATER[1] - 2), l: rng.range(1.5, 5), s: rng.range(1.2, 3.4), ph: rng.range(0, TAU),
      c: rng.chance(0.7) ? '#ffd9a0' : '#eef3ff', a: rng.range(0.4, 0.9),
    });
  }

  // Gegenüberliegende Flughafenseite mit ferner Piste
  ctx.fillStyle = vgrad(ctx, WATER[1], MID_TOP + 10, [[0, '#6f7ea8'], [1, '#8a9ac2']]);
  ctx.fillRect(-5, WATER[1], w + 10, MID_TOP + 10 - WATER[1]);
  ctx.fillStyle = '#c4d0ea';
  ctx.fillRect(-5, WATER[1] - 0.4, w + 10, 1.3);
  ctx.strokeStyle = 'rgba(40,46,70,0.6)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  for (let x = 0; x < w; x += rng.range(1.5, 5)) {
    ctx.moveTo(x, WATER[1] + 1.2);
    ctx.lineTo(x + rng.range(-0.8, 0.8), WATER[1] - rng.range(0.5, 2.5));
  }
  ctx.stroke();
  // Niedrige Frachthallen
  for (const [x, bw, bh] of [[240, 40, 6], [300, 22, 4], [1180, 46, 7], [1240, 30, 5], [1600, 36, 6]]) {
    const hb = FAR_TAXI.y - 2.4;
    ctx.fillStyle = '#3a4568';
    ctx.fillRect(x, hb - bh, bw, bh);
    ctx.fillStyle = '#c4d0ea';
    ctx.fillRect(x - 0.5, hb - bh - 0.6, bw + 1, 0.9);
    ctx.fillStyle = 'rgba(255,220,160,0.75)';
    for (let k = x + 2; k < x + bw - 2; k += 4) ctx.fillRect(k, hb - bh + 1.8, 1.2, 0.8);
  }
  const ry = FAR_RWY.y;
  // Paralleler Rollweg mit Abrollwegen – hier rollt der ferne Verkehr
  const ty = FAR_TAXI.y;
  ctx.fillStyle = '#353c57';
  ctx.fillRect(-5, ty - 2.5, w + 10, 5);
  for (const x of [FAR_RWY.x1 + 14, 520, 900, 1290, FAR_RWY.x2 - 14]) {
    poly(ctx, [[x - 9, ty + 2.4], [x + 9, ty + 2.4], [x + 5, ry - 2.4], [x - 5, ry - 2.4]], '#353c57');
  }
  ctx.fillStyle = 'rgba(255,205,60,0.7)';
  ctx.fillRect(-5, ty - 0.18, w + 10, 0.36);
  for (let x = 4; x < w; x += 9) {
    ctx.fillStyle = '#7dffa6';
    ctx.fillRect(x - 0.3, ty - 0.3, 0.6, 0.6);
  }
  for (let x = 10; x < w; x += 24) {
    for (const yy of [ty - 2.7, ty + 2.7]) {
      flare(ctx, x, yy, 2.4, '80,140,255', 0.6);
      dot(ctx, x, yy, 0.4, '#a8c8ff');
    }
  }
  ctx.fillStyle = '#2b3146';
  ctx.fillRect(FAR_RWY.x1, ry - 2.6, FAR_RWY.x2 - FAR_RWY.x1, 5.2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let x = FAR_RWY.x1 + 20; x < FAR_RWY.x2 - 20; x += 16) ctx.fillRect(x, ry - 0.2, 7, 0.4);
  for (let x = FAR_RWY.x1; x <= FAR_RWY.x2; x += 13) {
    for (const yy of [ry - 2.8, ry + 2.8]) {
      flare(ctx, x, yy, 2.4, '255,240,210', 0.5);
      ctx.fillStyle = '#fff6e2';
      ctx.fillRect(x - 0.35, yy - 0.35, 0.7, 0.7);
    }
  }
  for (let y = ry - 2.4; y <= ry + 2.4; y += 1.2) {
    dot(ctx, FAR_RWY.x1 - 1.5, y, 0.4, '#5cff8a');
    dot(ctx, FAR_RWY.x2 + 1.5, y, 0.4, '#ff4a4a');
  }
  flare(ctx, FAR_RWY.x1 - 1.5, ry, 5, '90,255,140', 0.5);
  flare(ctx, FAR_RWY.x2 + 1.5, ry, 5, '255,70,70', 0.5);
}

// --- Mittlere Ebene: der Flughafen --------------------------------------------

function glassFacade(ctx, rng, x, y, w, h, { floors = 2, mull = 11, people = true, tint = 0 } = {}) {
  ctx.fillStyle = vgrad(ctx, y, y + h, tint
    ? [[0, '#2c4a6a'], [1, '#5c7896']]
    : [[0, '#c7864b'], [0.45, '#f2b468'], [1, '#ffe2a2']]);
  ctx.fillRect(x, y, w, h);
  const fh = h / floors;
  // Deckenleuchten je Etage
  for (let f = 0; f < floors; f++) {
    const fy = y + f * fh;
    ctx.fillStyle = 'rgba(255,250,230,0.55)';
    for (let lx = x + 4; lx < x + w - 2; lx += 9) ctx.fillRect(lx, fy + 1.6, 3, 0.7);
    if (people && !tint) {
      for (let px = x + rng.range(2, 12); px < x + w - 3; px += rng.range(5, 26)) {
        const ph = rng.range(3.6, 5);
        ctx.fillStyle = `rgba(40,30,30,${rng.range(0.35, 0.6)})`;
        ctx.fillRect(px, fy + fh - ph - 0.4, 1.5, ph);
        dot(ctx, px + 0.75, fy + fh - ph - 0.9, 0.85, ctx.fillStyle);
      }
    }
    if (f > 0) {
      ctx.fillStyle = 'rgba(40,40,60,0.75)';
      ctx.fillRect(x, fy - 1, w, 2);
    }
  }
  // Reflex oben
  ctx.fillStyle = 'rgba(120,150,210,0.18)';
  ctx.fillRect(x, y, w, h * 0.18);
  // Pfosten
  ctx.fillStyle = 'rgba(30,34,52,0.75)';
  for (let mx = x; mx <= x + w; mx += mull) ctx.fillRect(mx - 0.5, y, 1, h);
}

function paintGround(ctx, w, rng, D) {
  // Landseite hinter den Terminals
  ctx.fillStyle = vgrad(ctx, MID_TOP, BASE, [[0, '#5a6993'], [1, '#6c7ca6']]);
  ctx.fillRect(-10, MID_TOP, w + 20, BASE - MID_TOP + 2);
  ctx.fillStyle = '#aab9da';
  ctx.beginPath();
  ctx.moveTo(-10, MID_TOP + 2);
  for (let x = -10; x <= w + 10; x += 20) ctx.lineTo(x, MID_TOP - 0.6 + Math.sin(x * 0.05) * 0.8 + rng.range(-0.4, 0.4));
  ctx.lineTo(w + 10, MID_TOP + 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a4566';
  ctx.fillRect(-10, MID_TOP + 6, w + 20, 5);
  for (let x = 0; x < w; x += rng.range(6, 20)) {
    const c = rng.chance(0.5) ? '#ffe9c0' : '#ff5a4a';
    ctx.fillStyle = c;
    ctx.fillRect(x, MID_TOP + 7.5 + rng.range(-1, 1.5), 1.4, 0.8);
  }
  for (let x = 30; x < w; x += rng.range(55, 90)) {
    ctx.fillStyle = '#2a3150';
    ctx.fillRect(x, MID_TOP - 10, 0.9, 16);
    flare(ctx, x + 0.4, MID_TOP - 10, 7, '255,190,110', 0.6);
    dot(ctx, x + 0.4, MID_TOP - 10, 0.8, '#ffd9a0');
  }

  // Vorfeld
  ctx.fillStyle = vgrad(ctx, BASE, 547, [[0, '#636e88'], [1, '#535d77']]);
  ctx.fillRect(-10, BASE, w + 20, 41);
  ctx.fillStyle = 'rgba(190,205,235,0.16)';
  for (let i = 0; i < 70; i++) {
    ctx.beginPath();
    ctx.ellipse(rng.range(0, w), rng.range(510, 545), rng.range(10, 50), rng.range(0.8, 2.4), 0, 0, TAU);
    ctx.fill();
  }
  // Fahrspuren im Schnee
  ctx.fillStyle = 'rgba(40,46,66,0.25)';
  for (let i = 0; i < 18; i++) ctx.fillRect(rng.range(0, w), rng.range(512, 544), rng.range(40, 160), 0.6);

  // Rollweg
  ctx.fillStyle = '#c4d0ea';
  ctx.fillRect(-10, 546.5, w + 20, 2.5);
  ctx.fillStyle = '#2d3346';
  ctx.fillRect(-10, 549, w + 20, 14);
  ctx.fillStyle = 'rgba(255,205,60,0.85)';
  ctx.fillRect(-10, TAXI_Y - 0.4, w + 20, 0.8);
  ctx.fillStyle = 'rgba(255,205,60,0.45)';
  ctx.fillRect(-10, 550.2, w + 20, 0.5);
  ctx.fillRect(-10, 561.3, w + 20, 0.5);
  for (let x = 20; x < w; x += 12) {
    flare(ctx, x, TAXI_Y, 3.2, '90,255,140', 0.45);
    ctx.fillStyle = '#9dffb8';
    ctx.fillRect(x - 0.5, TAXI_Y - 0.5, 1, 1);
  }
  for (let x = 6; x < w; x += 26) {
    for (const yy of [548.6, 563.4]) {
      flare(ctx, x, yy, 4.5, '80,140,255', 0.65);
      dot(ctx, x, yy, 0.7, '#a8c8ff');
    }
  }

  // Grünstreifen (verschneit) zwischen Rollweg und Piste
  ctx.fillStyle = vgrad(ctx, 563, RWY.y - RWY.depth / 2, [[0, '#9eaed2'], [1, '#8b9cc4']]);
  ctx.fillRect(-10, 563, w + 20, RWY.y - RWY.depth / 2 - 563);
  ctx.fillStyle = 'rgba(235,242,255,0.35)';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.ellipse(rng.range(0, w), rng.range(568, 586), rng.range(20, 70), rng.range(1, 2.5), 0, 0, TAU);
    ctx.fill();
  }

  // Piste
  const top = RWY.y - RWY.depth / 2;
  const bot = RWY.y + RWY.depth / 2;
  ctx.fillStyle = '#8b9cc4';
  ctx.fillRect(-10, top - 3, w + 20, RWY.depth + 8);
  ctx.fillStyle = '#3d4459';
  ctx.fillRect(RWY.x1 - 8, top - 2, RWY.x2 - RWY.x1 + 16, RWY.depth + 4);
  ctx.fillStyle = vgrad(ctx, top, bot, [[0, '#2a3040'], [1, '#232837']]);
  ctx.fillRect(RWY.x1, top, RWY.x2 - RWY.x1, RWY.depth);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let x = RWY.x1 + 70; x < RWY.x2 - 70; x += 46) ctx.fillRect(x, RWY.y - 0.6, 24, 1.2);
  ctx.globalAlpha = 0.65;
  ctx.fillRect(RWY.x1, top + 1, RWY.x2 - RWY.x1, 0.8);
  ctx.fillRect(RWY.x1, bot - 1.8, RWY.x2 - RWY.x1, 0.8);
  ctx.globalAlpha = 0.85;
  for (const [sx, dir] of [[RWY.x1 + 6, 1], [RWY.x2 - 6, -1]]) {
    for (let i = 0; i < 6; i++) ctx.fillRect(sx + dir * i * 6 - (dir < 0 ? 3.5 : 0), top + 2.5, 3.5, RWY.depth - 5);
    ctx.fillRect(sx + dir * 120 - 18, top + 3, 36, 2);
    ctx.fillRect(sx + dir * 120 - 18, bot - 5, 36, 2);
    for (const k of [200, 260]) {
      ctx.fillRect(sx + dir * k - 8, top + 3.5, 16, 1.2);
      ctx.fillRect(sx + dir * k - 8, bot - 4.7, 16, 1.2);
    }
  }
  ctx.globalAlpha = 1;
  // Pistenrandfeuer & Mittellinienfeuer
  for (let x = RWY.x1; x <= RWY.x2; x += 30) {
    for (const yy of [top - 1, bot + 1]) {
      flare(ctx, x, yy, 5, '255,244,220', 0.6);
      dot(ctx, x, yy, 0.8, '#fffaf0');
    }
  }
  for (let x = RWY.x1 + 15; x < RWY.x2; x += 15) {
    const red = x < RWY.x1 + 300;
    ctx.fillStyle = red ? 'rgba(255,90,90,0.7)' : 'rgba(255,255,240,0.5)';
    ctx.fillRect(x - 0.4, RWY.y - 0.4, 0.8, 0.8);
  }
  // Schwellenfeuer (grün, Anflugseite rechts) und Pistenendfeuer (rot)
  for (let y = top; y <= bot; y += 2.2) {
    dot(ctx, RWY.x2 + 4, y, 0.75, '#6dff9a');
    dot(ctx, RWY.x1 - 4, y, 0.75, '#ff5050');
  }
  flare(ctx, RWY.x2 + 4, RWY.y, 14, '90,255,140', 0.5);
  flare(ctx, RWY.x1 - 4, RWY.y, 12, '255,70,70', 0.45);
  // Anflugbefeuerung jenseits der Schwelle (mit Lauflicht)
  D.rabbit = [];
  for (let x = RWY.x2 + 18; x < w + 10; x += 22) {
    ctx.fillStyle = '#4a536c';
    ctx.fillRect(x - 0.4, RWY.y - 2, 0.8, 4);
    for (let k = -2; k <= 2; k++) {
      flare(ctx, x, RWY.y + k * 2, 2.5, '255,240,200', 0.5);
      dot(ctx, x, RWY.y + k * 2, 0.45, '#fff6dd');
    }
    D.rabbit.push({ x, y: RWY.y });
  }

  // Schnee unterhalb der Piste
  ctx.fillStyle = vgrad(ctx, bot + 2, 720, [[0, '#94a5cb'], [0.4, '#a4b4d7'], [1, '#b4c2e0']]);
  ctx.fillRect(-10, bot + 2, w + 20, 720 - bot - 2);
  ctx.fillStyle = 'rgba(240,246,255,0.5)';
  for (let x = -10; x < w; x += rng.range(20, 60)) {
    const ww = rng.range(30, 90);
    snowMound(ctx, x, bot + 7, ww, rng.range(1.5, 3.5), '#dfe8f8', '#a6b6d8');
  }
  ctx.fillStyle = 'rgba(235,242,255,0.3)';
  for (let i = 0; i < 50; i++) {
    ctx.beginPath();
    ctx.ellipse(rng.range(0, w), rng.range(625, 715), rng.range(30, 100), rng.range(1.5, 4), 0, 0, TAU);
    ctx.fill();
  }
  // Restlängen-Schilder
  ctx.font = 'bold 5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let x = RWY.x1 + 300, n = 13; x < RWY.x2 - 100; x += 300, n -= 2) {
    ctx.fillStyle = '#3b4156';
    ctx.fillRect(x - 0.4, 619, 0.8, 3);
    ctx.fillStyle = '#161a24';
    ctx.fillRect(x - 4, 614, 8, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(Math.max(1, n)), x, 617.2);
  }
}

function infieldSigns(ctx) {
  ctx.font = 'bold 4px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const signs = [
    [260, 'B', 'loc'], [282, 'K→', 'dir'], [640, '31L-13R', 'mand'], [1010, 'A', 'loc'], [1032, '←KA', 'dir'],
    [1420, 'ILS', 'mand'], [1760, 'B', 'loc'], [1782, 'Z→', 'dir'], [2120, '13R-31L', 'mand'],
  ];
  for (const [x, text, kind] of signs) {
    const sw = 5 + text.length * 2.5;
    const y = 572;
    ctx.fillStyle = '#3a4054';
    ctx.fillRect(x - sw / 2 + 1, y + 2.5, 0.8, 3);
    ctx.fillRect(x + sw / 2 - 1.8, y + 2.5, 0.8, 3);
    const bg = kind === 'loc' ? '#14161c' : kind === 'dir' ? '#f2c230' : '#c8202c';
    const fg = kind === 'loc' ? '#f2c230' : kind === 'dir' ? '#14161c' : '#ffffff';
    flare(ctx, x, y, sw * 0.7, kind === 'mand' ? '255,80,80' : '255,220,120', 0.25);
    ctx.fillStyle = bg;
    ctx.fillRect(x - sw / 2, y - 2.6, sw, 5.2);
    if (kind === 'loc') {
      ctx.strokeStyle = '#f2c230';
      ctx.lineWidth = 0.4;
      ctx.strokeRect(x - sw / 2 + 0.5, y - 2.1, sw - 1, 4.2);
    }
    ctx.fillStyle = fg;
    ctx.fillText(text, x, y + 0.2);
    ctx.fillStyle = 'rgba(240,246,255,0.9)';
    ctx.fillRect(x - sw / 2, y - 3.2, sw, 0.8);
  }
}

function hangar(ctx, rng, D) {
  const x1 = 22;
  const x2 = 312;
  const wallY = 426;
  const peak = 398;
  const mid = (x1 + x2) / 2;
  ctx.fillStyle = vgrad(ctx, wallY, BASE, [[0, '#3d4868'], [1, '#2e3752']]);
  ctx.fillRect(x1, wallY, x2 - x1, BASE - wallY + 1);
  // Tonnendach
  ctx.fillStyle = vgrad(ctx, peak, wallY, [[0, '#3a4466'], [1, '#262e4a']]);
  ctx.beginPath();
  ctx.moveTo(x1 - 5, wallY + 2);
  ctx.quadraticCurveTo(mid, 2 * peak - wallY, x2 + 5, wallY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,180,230,0.25)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let k = 1; k < 4; k++) {
    const yy = wallY + 2 - k * 6;
    ctx.moveTo(x1 + k * 22, yy + 3);
    ctx.quadraticCurveTo(mid, 2 * peak - wallY + k * 7, x2 - k * 22, yy + 3);
  }
  ctx.stroke();
  // Schnee auf dem Dach
  ctx.fillStyle = '#eef3fc';
  ctx.beginPath();
  ctx.moveTo(x1 + 4, wallY - 4);
  ctx.quadraticCurveTo(mid, 2 * peak - wallY - 5, x2 - 4, wallY - 4);
  ctx.quadraticCurveTo(mid, 2 * peak - wallY + 5, x1 + 4, wallY - 4);
  ctx.fill();
  // Lichterkette entlang des Dachbogens
  const arcPt = (t) => {
    const a = [x1 - 3, wallY + 1];
    const c = [mid, 2 * peak - wallY];
    const b = [x2 + 3, wallY + 1];
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1] + 2];
  };
  for (let i = 0; i <= 44; i++) {
    const [px, py] = arcPt(i / 44);
    const c = BULBS[i % BULBS.length];
    flare(ctx, px, py, 4, c, 0.55);
    dot(ctx, px, py, 0.85, `rgb(${c})`);
    D.bulbs.push({ x: px, y: py, c, r: 6, ph: hash(px) * TAU, s: 1.4 + hash(px + 3) * 2 });
  }
  // Tor mit beleuchtetem Inneren
  const dx1 = x1 + 14;
  const dx2 = x2 - 14;
  const dy = 438;
  ctx.fillStyle = vgrad(ctx, dy, BASE, [[0, '#f3d8a6'], [0.6, '#ffe9c2'], [1, '#e9c58a']]);
  ctx.fillRect(dx1, dy, dx2 - dx1, BASE - dy);
  ctx.fillStyle = 'rgba(255,255,240,0.95)';
  for (let x = dx1 + 8; x < dx2 - 4; x += 18) ctx.fillRect(x, dy + 3, 8, 1.3);
  // Arbeitsbühnen und Werkbänke
  ctx.fillStyle = 'rgba(70,64,70,0.55)';
  for (const [bx, bw, bh] of [[dx1 + 20, 26, 22], [dx1 + 150, 34, 30], [dx2 - 40, 22, 16]]) {
    ctx.fillRect(bx, BASE - bh, bw, 1.6);
    ctx.fillRect(bx + 1, BASE - bh, 1.2, bh);
    ctx.fillRect(bx + bw - 2.2, BASE - bh, 1.2, bh);
    for (let yy = BASE - bh + 5; yy < BASE; yy += 5) ctx.fillRect(bx + 1, yy, bw - 2, 0.6);
  }
  // Kleiner Baum in der Halle
  poly(ctx, [[dx2 - 64, BASE - 1], [dx2 - 56, BASE - 24], [dx2 - 48, BASE - 1]], '#2e5a3c');
  for (let i = 0; i < 9; i++) dot(ctx, dx2 - 60 + hash(i) * 8, BASE - 4 - hash(i + 9) * 16, 0.7, `rgb(${BULBS[i % 5]})`);
  dot(ctx, dx2 - 56, BASE - 25, 1.2, '#ffe080');
  ctx.fillStyle = 'rgba(255,240,200,0.35)';
  ctx.fillRect(dx1, BASE - 3, dx2 - dx1, 3);
  // Geschlossene Torflügel links
  const closedW = (dx2 - dx1) * 0.36;
  ctx.fillStyle = vgrad(ctx, dy, BASE, [[0, '#56648a'], [1, '#414d6e']]);
  ctx.fillRect(dx1, dy, closedW, BASE - dy);
  ctx.fillStyle = 'rgba(20,26,44,0.45)';
  for (let x = dx1 + 3; x < dx1 + closedW; x += 3) ctx.fillRect(x, dy, 0.5, BASE - dy);
  ctx.fillStyle = 'rgba(15,20,36,0.7)';
  for (let x = dx1 + 26; x < dx1 + closedW; x += 26) ctx.fillRect(x - 0.6, dy, 1.2, BASE - dy);
  // Torträger
  ctx.fillStyle = '#20283f';
  ctx.fillRect(dx1 - 4, dy - 8, dx2 - dx1 + 8, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(dx1 - 4, dy - 8, dx2 - dx1 + 8, 1);
  ctx.fillStyle = '#f0f3fa';
  ctx.font = 'bold 6px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('HANGAR 17', dx1 + 4, dy - 3.8);
  // Hindernisfeuer
  for (const bx of [x1 + 2, x2 - 2]) {
    D.beacons.push({ x: bx, y: wallY - 2, r: 7, rgb: '255,50,40', p: 1.7, ph: bx * 0.002 });
    dot(ctx, bx, wallY - 2, 0.9, '#a02a24');
  }
  // Lichtschein vor dem Tor
  pool(ctx, (dx1 + dx2) / 2 + 30, BASE + 8, 140, 10, 'rgba(255,225,170,0.4)');
}

function terminal4(ctx, rng, D) {
  const { x1, x2, roof, hall1, hall2 } = T4;
  // Sockel mit Gepäcktoren
  ctx.fillStyle = vgrad(ctx, 490, BASE, [[0, '#2e354d'], [1, '#262c40']]);
  ctx.fillRect(x1, 490, x2 - x1, BASE - 490 + 1);
  for (let x = x1 + 12; x < x2 - 20; x += rng.range(24, 40)) {
    if (rng.chance(0.55)) {
      ctx.fillStyle = vgrad(ctx, 495, BASE, [[0, '#d9a660'], [1, '#ffdca0']]);
      ctx.fillRect(x, 495, 12, BASE - 495);
      ctx.fillStyle = 'rgba(60,50,40,0.35)';
      for (let y = 497; y < BASE; y += 2) ctx.fillRect(x, y, 12, 0.5);
    } else {
      ctx.fillStyle = 'rgba(255,220,160,0.7)';
      ctx.fillRect(x, 496, 3, 2);
      ctx.fillRect(x + 5, 496, 3, 2);
    }
  }
  // Glasfassaden
  glassFacade(ctx, rng, x1, 448, hall1 - x1, 42);
  glassFacade(ctx, rng, hall2, 448, x2 - hall2, 42);
  glassFacade(ctx, rng, hall1, 432, hall2 - hall1, 58, { floors: 3, mull: 9 });
  // Rhythmus: Stützen, unterschiedlich helle Felder, Anzeigetafeln
  for (const [a, b] of [[x1, hall1], [hall2, x2]]) {
    for (let x = a; x < b - 4; x += 62) {
      const bw = Math.min(62, b - x);
      ctx.fillStyle = `rgba(28,34,70,${rng.range(0, 0.3).toFixed(2)})`;
      ctx.fillRect(x, 448, bw, rng.chance(0.5) ? 21 : 42);
      if (rng.chance(0.5)) {
        const bx = x + rng.range(10, 40);
        ctx.fillStyle = 'rgba(130,190,255,0.85)';
        ctx.fillRect(bx, 452, 9, 3.5);
        ctx.fillStyle = 'rgba(20,30,60,0.6)';
        ctx.fillRect(bx + 0.8, 453.2, 7.4, 0.35);
        ctx.fillRect(bx + 0.8, 454.4, 7.4, 0.35);
      }
      if (x > a) {
        ctx.fillStyle = '#2a3048';
        ctx.fillRect(x - 1.6, 446, 3.2, 44);
      }
    }
  }
  for (const xx of [hall1, hall2]) {
    ctx.fillStyle = '#262c42';
    ctx.fillRect(xx - 2.5, 430, 5, 60);
  }
  // Weihnachtsbaum hinter dem Glas
  const tx = (hall1 + hall2) / 2;
  poly(ctx, [[tx - 9, 489], [tx, 456], [tx + 9, 489]], '#2a5a3a');
  for (let i = 0; i < 14; i++) dot(ctx, tx - 7 + hash(i + 40) * 14 * (0.3 + hash(i + 50) * 0.7), 486 - hash(i + 60) * 26, 0.6, `rgb(${BULBS[i % 5]})`);
  dot(ctx, tx, 455.5, 1.2, '#ffe27a');
  flare(ctx, tx, 470, 22, '255,210,120', 0.35);
  // Dachkante der Flügel
  for (const [a, b] of [[x1, hall1], [hall2, x2]]) {
    ctx.fillStyle = '#252c42';
    ctx.fillRect(a - 4, roof, b - a + 8, 8);
    ctx.fillStyle = 'rgba(190,205,240,0.25)';
    ctx.fillRect(a - 4, roof, b - a + 8, 0.8);
    snowCap(ctx, a - 4, roof, b - a + 8, 2.6, '#eef3fc');
  }
  // Hallendach als flacher Bogen
  ctx.fillStyle = '#252c42';
  ctx.beginPath();
  ctx.moveTo(hall1 - 6, 434);
  ctx.quadraticCurveTo(tx, 404, hall2 + 6, 434);
  ctx.lineTo(hall2 + 6, 438);
  ctx.quadraticCurveTo(tx, 410, hall1 - 6, 438);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#eef3fc';
  ctx.beginPath();
  ctx.moveTo(hall1 - 4, 433.6);
  ctx.quadraticCurveTo(tx, 401.5, hall2 + 4, 433.6);
  ctx.quadraticCurveTo(tx, 405.5, hall1 - 4, 433.6);
  ctx.fill();
  // Dachaufbauten
  ctx.fillStyle = '#20263a';
  for (const [x, bw, bh] of [[x1 + 60, 22, 5], [x1 + 200, 14, 4], [hall2 + 46, 26, 5], [hall2 + 200, 12, 4]]) {
    ctx.fillRect(x, roof - bh, bw, bh);
    snowCap(ctx, x, roof - bh, bw, 1.6, '#e8eefa');
  }
  // Lichterketten an der Attika
  bulbString(ctx, D.bulbs, x1 - 2, hall1 - 6, roof + 8, { sag: 2.5, hook: 36 });
  bulbString(ctx, D.bulbs, hall2 + 6, x2 + 2, roof + 8, { sag: 2.5, hook: 36 });
  // Gate-Nummern über den Brücken
  ctx.font = 'bold 4.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  GATES.filter((g) => g.bridge && g.x < x2).forEach((g, i) => {
    const sx = g.x + g.dir * 128;
    ctx.fillStyle = '#12151f';
    ctx.fillRect(sx - 5, 478, 10, 6);
    ctx.fillStyle = '#ffd23a';
    ctx.fillText(`B${21 + i * 2}`, sx, 481.2);
  });
}

function terminal5(ctx, rng) {
  const x1 = 1290;
  const x2 = 1744;
  const top = 452;
  ctx.fillStyle = vgrad(ctx, top, BASE, [[0, '#2a3654'], [1, '#202a44']]);
  ctx.fillRect(x1, top, x2 - x1, BASE - top + 1);
  for (const [y, hh] of [[458, 9], [474, 10], [490, 8]]) {
    ctx.fillStyle = vgrad(ctx, y, y + hh, [[0, 'rgba(255,200,130,0.45)'], [1, 'rgba(255,225,170,0.75)']]);
    ctx.fillRect(x1 + 3, y, x2 - x1 - 6, hh);
    ctx.fillStyle = 'rgba(25,30,48,0.7)';
    for (let x = x1 + 3; x < x2 - 3; x += 8) ctx.fillRect(x, y, 0.8, hh);
  }
  ctx.fillStyle = '#1c2338';
  ctx.fillRect(x1 - 3, top - 3, x2 - x1 + 6, 4);
  snowCap(ctx, x1 - 3, top - 3, x2 - x1 + 6, 2.4, '#e9eff9');
}

function twaCenter(ctx, rng) {
  const cx = TWA_X;
  const b = 508;
  const wing = (s) => {
    ctx.beginPath();
    ctx.moveTo(cx, 458);
    ctx.bezierCurveTo(cx + s * 52, 456, cx + s * 120, 446, cx + s * 172, 427);
    ctx.lineTo(cx + s * 181, 428.5);
    ctx.bezierCurveTo(cx + s * 130, 452, cx + s * 62, 469, cx, 477);
    ctx.closePath();
  };
  // Hintere Schalen
  ctx.fillStyle = vgrad(ctx, 436, 470, [[0, '#cfcbc0'], [1, '#9c998f']]);
  ctx.beginPath();
  ctx.moveTo(cx - 100, 462);
  ctx.bezierCurveTo(cx - 80, 446, cx - 55, 437, cx - 30, 438);
  ctx.quadraticCurveTo(cx - 8, 440, cx, 446);
  ctx.quadraticCurveTo(cx + 8, 440, cx + 30, 438);
  ctx.bezierCurveTo(cx + 55, 437, cx + 80, 446, cx + 100, 462);
  ctx.closePath();
  ctx.fill();
  snowCap(ctx, cx - 60, 440, 30, 1.6, '#eef3fc');
  snowCap(ctx, cx + 30, 440, 30, 1.6, '#eef3fc');
  // Verglasung unter den Schalen
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 181, 428.5);
  ctx.bezierCurveTo(cx - 130, 452, cx - 62, 469, cx, 477);
  ctx.bezierCurveTo(cx + 62, 469, cx + 130, 452, cx + 181, 428.5);
  ctx.lineTo(cx + 160, 494);
  ctx.lineTo(cx - 160, 494);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, 430, 494, [[0, '#a85e3a'], [0.5, '#e9a35e'], [1, '#ffd796']]);
  ctx.fill();
  ctx.clip();
  // Rote Lounge, Menschen, Deckenleuchten
  ctx.fillStyle = 'rgba(200,40,50,0.55)';
  ctx.fillRect(cx - 120, 486, 240, 8);
  ctx.fillStyle = 'rgba(255,250,230,0.6)';
  for (let x = cx - 150; x < cx + 150; x += 10) ctx.fillRect(x, 470 + Math.abs(x - cx) * -0.12 + 6, 3, 0.7);
  for (let px = cx - 150; px < cx + 150; px += rng.range(6, 20)) {
    ctx.fillStyle = `rgba(40,25,25,${rng.range(0.35, 0.6)})`;
    ctx.fillRect(px, 489.5, 1.5, 4.5);
    dot(ctx, px + 0.75, 489, 0.85, ctx.fillStyle);
  }
  // schräge Pfosten
  ctx.strokeStyle = 'rgba(35,30,40,0.7)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let x = cx - 176; x <= cx + 176; x += 8) {
    ctx.moveTo(x * 0.92 + cx * 0.08, 494);
    ctx.lineTo(x, 426);
  }
  ctx.moveTo(cx - 180, 482);
  ctx.lineTo(cx + 180, 482);
  ctx.stroke();
  ctx.restore();
  // Sockel mit Eingang
  ctx.fillStyle = '#2a3046';
  ctx.fillRect(cx - 164, 494, 328, b - 494 + 1);
  ctx.fillStyle = vgrad(ctx, 497, b, [[0, '#ffd28c'], [1, '#ffe8bd']]);
  ctx.fillRect(cx - 18, 497, 36, b - 497);
  ctx.fillStyle = 'rgba(40,40,60,0.6)';
  for (let x = cx - 18; x <= cx + 18; x += 6) ctx.fillRect(x - 0.4, 497, 0.8, b - 497);
  pool(ctx, cx, b + 6, 90, 8, 'rgba(255,215,150,0.45)');
  // Pfeiler
  for (const s of [-1, 1]) {
    ctx.fillStyle = hgrad(ctx, cx + s * 182, cx + s * 140, [[0, '#d9d4c6'], [1, '#a29d90']]);
    ctx.beginPath();
    ctx.moveTo(cx + s * 182, 428.5);
    ctx.quadraticCurveTo(cx + s * 168, 470, cx + s * 167, b);
    ctx.lineTo(cx + s * 158, b);
    ctx.quadraticCurveTo(cx + s * 157, 468, cx + s * 134, 450);
    ctx.closePath();
    ctx.fill();
  }
  // Flügel-Schalen
  for (const s of [-1, 1]) {
    wing(s);
    ctx.fillStyle = vgrad(ctx, 426, 478, [[0, '#f7f4ec'], [0.6, '#e2ddd0'], [1, '#c7c0ae']]);
    ctx.fill();
    // Unterkante warm angestrahlt
    ctx.strokeStyle = 'rgba(255,200,140,0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + s * 181, 428.5);
    ctx.bezierCurveTo(cx + s * 130, 452, cx + s * 62, 469, cx, 477);
    ctx.stroke();
    // Schnee auf der Oberkante
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx + s * 4, 457.6);
    ctx.bezierCurveTo(cx + s * 52, 455.4, cx + s * 120, 445.4, cx + s * 170, 427);
    ctx.stroke();
  }
  // Schnabel in der Mitte
  poly(ctx, [[cx - 10, 471], [cx, 486], [cx + 10, 471]], '#d4cdbd');
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  poly(ctx, [[cx, 471], [cx, 486], [cx + 10, 471]]);
  ctx.fill();
  // Kranz mit Schleife
  ctx.strokeStyle = '#1f5a36';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(cx, 466, 5.5, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    dot(ctx, cx + Math.cos(a) * 5.5, 466 + Math.sin(a) * 5.5, 0.55, i % 2 ? '#ffe08a' : '#ff5a5a');
  }
  poly(ctx, [[cx, 471], [cx - 3.5, 469], [cx - 3.5, 473.5]], '#d8232f');
  poly(ctx, [[cx, 471], [cx + 3.5, 469], [cx + 3.5, 473.5]], '#d8232f');
  flare(ctx, cx, 466, 14, '255,200,120', 0.3);
}

function tower(ctx, rng, D) {
  const cx = TOWER_X;
  // Flachbau am Fuß
  ctx.fillStyle = vgrad(ctx, 482, BASE, [[0, '#3c4764'], [1, '#2f3852']]);
  ctx.fillRect(cx - 52, 482, 108, BASE - 482 + 1);
  ctx.fillStyle = 'rgba(210,228,255,0.75)';
  for (let x = cx - 48; x < cx + 52; x += 5) ctx.fillRect(x, 489, 3, 4);
  snowCap(ctx, cx - 52, 482, 108, 2.4, '#eef3fc');
  // Schaft
  ctx.fillStyle = hgrad(ctx, cx - 12, cx + 12, [[0, '#e2e7f1'], [0.55, '#b9c1d3'], [1, '#7f8aa3']]);
  poly(ctx, [[cx - 12.5, BASE], [cx + 12.5, BASE], [cx + 8, 300], [cx - 8, 300]]);
  ctx.fill();
  poly(ctx, [[cx - 12.5, BASE], [cx - 24, BASE], [cx - 12, 466]], '#c9d0de');
  poly(ctx, [[cx + 12.5, BASE], [cx + 24, BASE], [cx + 12, 466]], '#8590a8');
  ctx.fillStyle = 'rgba(70,80,105,0.7)';
  ctx.fillRect(cx - 0.8, 302, 1.6, BASE - 302);
  for (let y = 312; y < 470; y += 14) {
    ctx.fillStyle = 'rgba(255,230,180,0.85)';
    ctx.fillRect(cx - 0.6, y, 1.2, 3);
  }
  // Betriebsgeschosse
  ctx.fillStyle = '#c9d0de';
  ctx.fillRect(cx - 13, 284, 26, 16);
  ctx.fillStyle = 'rgba(255,225,170,0.85)';
  ctx.fillRect(cx - 12, 289, 24, 3.5);
  ctx.fillStyle = 'rgba(40,46,66,0.6)';
  for (let x = cx - 12; x < cx + 12; x += 3) ctx.fillRect(x, 289, 0.5, 3.5);
  // Kanzel: auskragender Unterbau, schräg verglaste Kabine
  poly(ctx, [[cx - 13, 284], [cx + 13, 284], [cx + 29, 274], [cx - 29, 274]], '#aab3c7');
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  poly(ctx, [[cx + 4, 284], [cx + 13, 284], [cx + 29, 274], [cx + 14, 274]]);
  ctx.fill();
  poly(ctx, [[cx - 29, 274], [cx + 29, 274], [cx + 32, 257], [cx - 32, 257]]);
  ctx.fillStyle = vgrad(ctx, 257, 274, [[0, '#2a5868'], [1, '#3f8c98']]);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,255,210,0.35)';
  for (let x = cx - 24; x < cx + 22; x += 7) ctx.fillRect(x, 268, 3.5, 2.2);
  ctx.strokeStyle = 'rgba(20,30,40,0.8)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let k = -4; k <= 4; k++) {
    ctx.moveTo(cx + k * 7.2, 274);
    ctx.lineTo(cx + k * 7.9, 257);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(220,245,255,0.3)';
  poly(ctx, [[cx - 24, 274], [cx - 18, 274], [cx - 10, 257], [cx - 16, 257]]);
  ctx.fill();
  // Dach, Aufbau, Antenne
  ctx.fillStyle = '#e2e7f0';
  ctx.fillRect(cx - 34, 252, 68, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(cx + 10, 252, 24, 5);
  ctx.fillStyle = '#c0c8d8';
  ctx.fillRect(cx - 12, 244, 24, 8);
  snowCap(ctx, cx - 34, 252, 68, 2.4, '#f4f8ff');
  snowCap(ctx, cx - 12, 244, 24, 1.6, '#f4f8ff');
  ctx.fillStyle = '#9aa4ba';
  ctx.fillRect(cx - 1, 220, 2, 24);
  ctx.fillRect(cx - 5, 232, 10, 0.8);
  ctx.fillRect(cx + 6, 238, 1, 6);
  ctx.fillRect(cx - 9, 236, 1, 8);
  // Lichterkette an der Dachkante
  bulbString(ctx, D.bulbs, cx - 33, cx + 33, 256.5, { sag: 1.6, hook: 16.5, step: 4.2, r: 0.7, glowR: 3.4 });
  D.tower = { x: cx, beacon: [cx + 6.5, 237], tip: [cx, 220] };
  D.beacons.push({ x: cx, y: 220, r: 8, rgb: '255,50,40', p: 1.5, ph: 0 });
  dot(ctx, cx, 220, 1, '#a02a24');
}

function terminal8(ctx, rng, D) {
  const { x1, x2, roof } = T8;
  ctx.fillStyle = vgrad(ctx, 490, BASE, [[0, '#2e354d'], [1, '#262c40']]);
  ctx.fillRect(x1, 490, x2 - x1, BASE - 490 + 1);
  for (let x = x1 + 16; x < x2 - 20; x += rng.range(28, 44)) {
    ctx.fillStyle = vgrad(ctx, 495, BASE, [[0, '#d9a660'], [1, '#ffdca0']]);
    ctx.fillRect(x, 495, 11, BASE - 495);
  }
  glassFacade(ctx, rng, x1, 454, x2 - x1, 36, { floors: 2, mull: 14 });
  // Mittlerer Glaskubus, höher
  const gx1 = 2060;
  const gx2 = 2170;
  glassFacade(ctx, rng, gx1, 430, gx2 - gx1, 60, { floors: 3, mull: 10 });
  ctx.fillStyle = '#252c42';
  ctx.fillRect(gx1 - 3, 425, gx2 - gx1 + 6, 6);
  snowCap(ctx, gx1 - 3, 425, gx2 - gx1 + 6, 2.4, '#eef3fc');
  // Geschwungenes Vordach
  ctx.fillStyle = '#2a3248';
  ctx.beginPath();
  ctx.moveTo(x1 - 14, roof + 2);
  ctx.quadraticCurveTo(x1 + 20, roof - 8, x1 + 70, roof - 1);
  ctx.lineTo(gx1 - 3, roof - 1);
  ctx.lineTo(gx1 - 3, roof + 8);
  ctx.lineTo(x1 + 70, roof + 8);
  ctx.quadraticCurveTo(x1 + 20, roof + 3, x1 - 14, roof + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(gx2 + 3, roof - 1, x2 + 6 - gx2 - 3, 9);
  ctx.fillStyle = 'rgba(190,205,240,0.25)';
  ctx.fillRect(gx2 + 3, roof - 1, x2 + 6 - gx2 - 3, 0.8);
  snowCap(ctx, x1 + 70, roof - 1, gx1 - 3 - x1 - 70, 2.4, '#eef3fc');
  snowCap(ctx, gx2 + 3, roof - 1, x2 + 3 - gx2, 2.4, '#eef3fc');
  // Dachtechnik
  ctx.fillStyle = '#20263a';
  for (const [x, bw, bh] of [[x1 + 110, 18, 5], [gx2 + 40, 26, 6], [gx2 + 120, 14, 4]]) {
    ctx.fillRect(x, roof - 1 - bh, bw, bh);
    snowCap(ctx, x, roof - 1 - bh, bw, 1.6, '#e8eefa');
  }
  bulbString(ctx, D.bulbs, x1 + 70, gx1 - 4, roof + 8, { sag: 2.5, hook: 34 });
  bulbString(ctx, D.bulbs, gx2 + 4, x2 + 4, roof + 8, { sag: 2.5, hook: 34 });
  // Großer Leuchtstern am Glaskubus
  const sx = (gx1 + gx2) / 2;
  flare(ctx, sx, 445, 26, '255,220,140', 0.5);
  star(ctx, sx, 445, 7, 2.8, '#fff1b8');
  ctx.font = 'bold 4.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  GATES.filter((g) => g.bridge && g.x > x1).forEach((g, i) => {
    const gx = g.x + g.dir * 128;
    ctx.fillStyle = '#12151f';
    ctx.fillRect(gx - 5, 478, 10, 6);
    ctx.fillStyle = '#ffd23a';
    ctx.fillText(`C${62 + i * 2}`, gx, 481.2);
  });
}

function star(ctx, x, y, r, ri, fill, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? ri : r;
    if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function jetBridge(ctx, g) {
  const d = g.dir;
  const cabX = g.x + d * 58;
  const rotX = g.x + d * 128;
  const yR = 497;
  const yC = 501;
  const hT = 10;
  // Rotunde
  ctx.fillStyle = hgrad(ctx, rotX - 7, rotX + 7, [[0, '#8d98b0'], [1, '#5c6782']]);
  ctx.fillRect(rotX - 7, yR - 4, 14, BASE - yR + 6);
  ctx.fillStyle = 'rgba(255,220,160,0.75)';
  ctx.fillRect(rotX - 5, yR - 1, 10, 3);
  snowCap(ctx, rotX - 7, yR - 4, 14, 1.4, '#eef3fc');
  // Tunnel in zwei Teleskop-Segmenten
  const xs = [rotX - d * 7, rotX - d * 40, cabX + d * 8];
  for (let i = 0; i < 2; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    const ya = yR + ((yC - yR) * (a - xs[0])) / (xs[2] - xs[0]);
    const yb = yR + ((yC - yR) * (b - xs[0])) / (xs[2] - xs[0]);
    const hh = hT - i * 0.8;
    const top = (t) => ya + (yb - ya) * t - i * 0.4;
    ctx.fillStyle = vgrad(ctx, Math.min(ya, yb) - 1, Math.max(ya, yb) + hh, [[0, '#c3cbdb'], [0.5, '#9ca6bc'], [1, '#6d7792']]);
    poly(ctx, [[a, top(0)], [b, top(1)], [b, top(1) + hh], [a, top(0) + hh]]);
    ctx.fill();
    // Fensterband
    ctx.fillStyle = 'rgba(255,214,150,0.8)';
    const n = Math.floor(Math.abs(b - a) / 5);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      ctx.fillRect(a + (b - a) * t - 1.2, top(t) + 3, 2.4, 2.4);
    }
    ctx.strokeStyle = '#eef3fc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a, top(0) - 0.3);
    ctx.lineTo(b, top(1) - 0.3);
    ctx.stroke();
  }
  // Kabine mit Faltenbalg
  ctx.fillStyle = '#7d879f';
  ctx.fillRect(cabX - 8, yC - 2, 16, 15);
  ctx.fillStyle = '#3a4258';
  ctx.fillRect(cabX - d * 8 - (d > 0 ? 0 : 3), yC - 1, 3, 13);
  ctx.fillStyle = 'rgba(255,220,160,0.85)';
  ctx.fillRect(cabX - 5, yC + 1, 10, 4);
  snowCap(ctx, cabX - 8, yC - 2, 16, 1.4, '#eef3fc');
  // Fahrwerk
  const legX = xs[1] + d * 6;
  ctx.fillStyle = '#4c556e';
  ctx.fillRect(legX - 1.2, yC + 8, 2.4, GATE_Y - yC - 10);
  ctx.fillRect(legX - 5, GATE_Y - 4, 10, 2.5);
  dot(ctx, legX - 3.2, GATE_Y - 1.2, 1.6, '#1b1f2a');
  dot(ctx, legX + 3.2, GATE_Y - 1.2, 1.6, '#1b1f2a');
  // Andockampel
  ctx.fillStyle = '#12151f';
  ctx.fillRect(rotX - d * 22 - 3, 470, 6, 5);
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(rotX - d * 22 - 2, 471.2, 4, 1);
  ctx.fillStyle = '#44ff88';
  ctx.fillRect(rotX - d * 22 - 2, 473, 4, 0.9);
}

function standMarkings(ctx, g) {
  const d = g.dir;
  ctx.strokeStyle = 'rgba(255,205,60,0.85)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(g.x - d * 220, 547);
  ctx.bezierCurveTo(g.x - d * 150, 546, g.x - d * 140, 524, g.x - d * 90, 524);
  ctx.lineTo(g.x + d * 70, 524);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,205,60,0.9)';
  ctx.fillRect(g.x + d * 70 - 0.6, 520, 1.2, 8);
  // Sicherheitslinien rot gestrichelt
  ctx.fillStyle = 'rgba(230,60,60,0.7)';
  for (let x = g.x - 95; x < g.x + 95; x += 7) ctx.fillRect(x, 540, 4, 0.7);
}

function bigTree(ctx, rng, D) {
  const { x: cx, y: base, h } = TREE;
  const top = base - h;
  pool(ctx, cx, base + 4, 150, 16, 'rgba(255,200,130,0.42)');
  flare(ctx, cx, base - h * 0.45, h * 0.75, '255,190,110', 0.22);
  ctx.fillStyle = '#3a2a1e';
  ctx.fillRect(cx - 4, base - 12, 8, 12);
  const halfW = (y) => Math.max(0, ((y - top) / h) * h * 0.42);
  const tiers = 10;
  for (let i = 0; i < tiers; i++) {
    const yb = base - 8 - i * ((h - 18) / tiers);
    const th = (h / tiers) * 1.9;
    const hw = halfW(yb) * (1 + 0.06 * Math.sin(i * 2.3));
    const yt = yb - th;
    ctx.fillStyle = hgrad(ctx, cx - hw, cx + hw, [[0, '#2a6a46'], [0.45, '#1a4c33'], [1, '#0c2a1d']]);
    ctx.beginPath();
    ctx.moveTo(cx, yt);
    ctx.lineTo(cx + hw * 0.6, yb - th * 0.45);
    const n = Math.max(6, Math.round(hw / 5));
    for (let k = 0; k <= n; k++) {
      const x = cx + hw - (2 * hw * k) / n;
      ctx.lineTo(x, yb + (k % 2 ? -2.5 : 1.8) + Math.abs(x - cx) * 0.04);
    }
    ctx.lineTo(cx - hw * 0.6, yb - th * 0.45);
    ctx.closePath();
    ctx.fill();
    // Hauch Schnee auf den Zweigen
    ctx.strokeStyle = 'rgba(235,242,255,0.45)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.55, yb - th * 0.42);
    ctx.lineTo(cx - hw * 0.15, yb - th * 0.58);
    ctx.stroke();
  }
  // Lichterketten als Girlanden
  const lights = [];
  for (let j = 0; j < 9; j++) {
    const y0 = top + 18 + j * ((h - 30) / 9);
    const hw = halfW(y0 + 6) * 0.95;
    for (let k = 0; k <= 1; k += 1 / Math.max(5, Math.round(hw / 3.2))) {
      const x = cx - hw + 2 * hw * k;
      const y = y0 + Math.sin(k * Math.PI) * 7 + (x - cx) * 0.08 + rng.range(-0.8, 0.8);
      lights.push([x, y]);
    }
  }
  for (let i = 0; i < 90; i++) {
    const y = rng.range(top + 14, base - 10);
    const hw = halfW(y) * 0.85;
    lights.push([cx + rng.range(-hw, hw), y]);
  }
  for (const [x, y] of lights) {
    const c = TREE_BULBS[Math.floor(rng.next() * TREE_BULBS.length)];
    flare(ctx, x, y, 3.4, c, 0.6);
    dot(ctx, x, y, 0.75, `rgb(${c})`);
    if (rng.chance(0.4)) D.tree.push({ x, y, c, ph: rng.range(0, TAU), s: rng.range(1.5, 4) });
  }
  // Stern an der Spitze
  flare(ctx, cx, top - 2, 38, '255,226,140', 0.6);
  ctx.strokeStyle = 'rgba(255,240,190,0.5)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const r = i % 2 ? 9 : 16;
    ctx.moveTo(cx, top - 2);
    ctx.lineTo(cx + Math.cos(a) * r, top - 2 + Math.sin(a) * r);
  }
  ctx.stroke();
  star(ctx, cx, top - 2, 9, 3.8, vgrad(ctx, top - 11, top + 7, [[0, '#fffbe0'], [1, '#ffc93a']]));
  star(ctx, cx, top - 2, 4.5, 1.9, '#ffffff');
  D.star = { x: cx, y: top - 2 };
  // Geschenke und Absperrung am Fuß
  for (const [dx, bw, bh, c, rib] of [
    [-34, 9, 7, '#c8202c', '#ffd23a'], [-24, 7, 9, '#2a6ad8', '#f4f4f4'], [-15, 10, 6, '#ffd23a', '#c8202c'],
    [12, 8, 8, '#1f8a4c', '#ffd23a'], [21, 11, 6, '#f4f4f4', '#c8202c'], [33, 7, 7, '#9a3ad8', '#ffd23a'],
  ]) {
    ctx.fillStyle = c;
    ctx.fillRect(cx + dx, base - bh, bw, bh);
    ctx.fillStyle = rib;
    ctx.fillRect(cx + dx + bw / 2 - 0.6, base - bh, 1.2, bh);
    ctx.fillRect(cx + dx, base - bh * 0.55, bw, 1.1);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(cx + dx + bw * 0.6, base - bh, bw * 0.4, bh);
  }
  ctx.fillStyle = '#c9a24a';
  ctx.fillRect(cx - 58, base - 4, 116, 1);
  for (let x = cx - 58; x <= cx + 58; x += 11.6) ctx.fillRect(x - 0.6, base - 5, 1.2, 5);
}

function floodMast(ctx, D, x, topY) {
  const baseY = 542;
  // Lichtkegel
  ctx.fillStyle = vgrad(ctx, topY, baseY, [[0, 'rgba(255,240,205,0.16)'], [1, 'rgba(255,240,205,0)']]);
  poly(ctx, [[x - 8, topY + 2], [x + 8, topY + 2], [x + 70, baseY], [x - 70, baseY]]);
  ctx.fill();
  pool(ctx, x, 528, 120, 12, 'rgba(255,236,190,0.35)');
  // Gittermast
  ctx.strokeStyle = '#4a5370';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x - 3, baseY);
  ctx.lineTo(x - 1, topY);
  ctx.moveTo(x + 3, baseY);
  ctx.lineTo(x + 1, topY);
  for (let y = baseY; y > topY + 4; y -= 6) {
    const k = (baseY - y) / (baseY - topY);
    const hw = 3 - 2 * k;
    const hw2 = 3 - 2 * ((baseY - y + 6) / (baseY - topY));
    ctx.moveTo(x - hw, y);
    ctx.lineTo(x + hw2, y - 6);
  }
  ctx.stroke();
  // Scheinwerferkopf
  ctx.fillStyle = '#2a3046';
  ctx.fillRect(x - 10, topY - 5, 20, 7);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const lx = x - 7.5 + i * 5;
      const ly = topY - 3 + j * 3.2;
      flare(ctx, lx, ly, 7, '255,244,214', 0.45);
      ctx.fillStyle = '#fffbea';
      ctx.fillRect(lx - 1.6, ly - 1.1, 3.2, 2.2);
    }
  }
  snowCap(ctx, x - 10, topY - 5, 20, 1.4, '#eef3fc');
  D.beacons.push({ x, y: topY - 8, r: 6, rgb: '255,50,40', p: 1.9, ph: x * 0.003 });
  dot(ctx, x, topY - 8, 0.8, '#a02a24');
}

function vehicle(ctx, kind, x, y, d = 1, D = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(d, 1);
  const wheel = (wx) => {
    dot(ctx, wx, -1.6, 1.6, '#151820');
    dot(ctx, wx, -1.6, 0.6, '#7a8296');
  };
  if (kind === 'tug') {
    ctx.fillStyle = '#e8c12a';
    ctx.fillRect(-6, -6, 12, 4.5);
    ctx.fillRect(-1, -9.5, 5, 3.6);
    ctx.fillStyle = 'rgba(200,230,255,0.6)';
    ctx.fillRect(0, -9, 3.4, 2.4);
    wheel(-3.5);
    wheel(3.5);
    if (D) D.plows.push({ x: x + d * 1.5, y: y - 10.5 });
  } else if (kind === 'cart') {
    ctx.fillStyle = '#58647f';
    ctx.fillRect(-5, -9, 10, 7);
    ctx.fillStyle = '#e2e8f4';
    ctx.fillRect(-5, -9.6, 10, 1);
    ctx.fillStyle = 'rgba(40,46,66,0.6)';
    ctx.fillRect(-4, -7.5, 8, 4);
    ctx.fillStyle = '#3a4258';
    ctx.fillRect(5, -3.5, 2.5, 0.6);
    wheel(-3);
    wheel(3);
  } else if (kind === 'plow') {
    ctx.fillStyle = '#f08a1c';
    ctx.fillRect(-12, -9, 17, 6.5);
    ctx.fillRect(4, -13, 7, 10.5);
    ctx.fillStyle = 'rgba(200,230,255,0.65)';
    ctx.fillRect(6, -12, 4, 3.6);
    ctx.fillStyle = '#d8dde8';
    poly(ctx, [[12, -1], [17, -1], [19, -9], [14, -8]], '#d8dde8');
    ctx.fillStyle = '#f4f8ff';
    ctx.fillRect(-12, -10, 17, 1.2);
    wheel(-8);
    wheel(-2);
    wheel(7);
    if (D) D.plows.push({ x: x + d * 7.5, y: y - 14.5 });
  } else if (kind === 'deicer') {
    ctx.fillStyle = '#d9dde6';
    ctx.fillRect(-14, -10, 20, 8);
    ctx.fillStyle = '#2f8a52';
    ctx.fillRect(-13, -9, 18, 4.5);
    ctx.fillStyle = '#d9dde6';
    ctx.fillRect(6, -12, 7, 10);
    ctx.fillStyle = 'rgba(200,230,255,0.6)';
    ctx.fillRect(8, -11, 4, 3.5);
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(-2, -30);
    ctx.lineTo(10, -36);
    ctx.stroke();
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(8, -40, 6, 4.5);
    wheel(-9);
    wheel(-3);
    wheel(9);
    if (D) D.plows.push({ x: x + d * 9.5, y: y - 13 });
  } else if (kind === 'fuel') {
    ctx.fillStyle = '#e8ecf3';
    ctx.beginPath();
    ctx.ellipse(-3, -7, 11, 4.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c8202c';
    ctx.fillRect(-14, -6.5, 22, 1);
    ctx.fillStyle = '#d9dde6';
    ctx.fillRect(8, -11, 7, 9);
    ctx.fillStyle = 'rgba(200,230,255,0.6)';
    ctx.fillRect(10, -10, 4, 3.2);
    wheel(-10);
    wheel(-4);
    wheel(11);
  }
  ctx.restore();
}

function paintMid(ctx, w, rng) {
  const D = (DYN.mid = { beacons: [], bulbs: [], tree: [], plows: [], rabbit: [], star: null, tower: null });
  paintGround(ctx, w, rng, D);
  // Lichtschein der Glasfassaden auf dem Vorfeld
  for (const [a, b] of [[T4.x1, T4.x2], [1330, 1670], [T8.x1, T8.x2]]) {
    ctx.fillStyle = vgrad(ctx, BASE, BASE + 18, [[0, 'rgba(255,210,140,0.32)'], [1, 'rgba(255,210,140,0)']]);
    ctx.fillRect(a, BASE, b - a, 18);
  }
  for (const g of GATES) standMarkings(ctx, g);

  terminal5(ctx, rng);
  hangar(ctx, rng, D);
  terminal4(ctx, rng, D);
  twaCenter(ctx, rng);
  tower(ctx, rng, D);
  terminal8(ctx, rng, D);
  for (const g of GATES) if (g.bridge) jetBridge(ctx, g);
  bigTree(ctx, rng, D);
  floodMast(ctx, D, 342, 392);
  floodMast(ctx, D, 1712, 398);
  floodMast(ctx, D, 2378, 394);

  // Fahrzeuge und Schneehaufen
  snowMound(ctx, 318, 512, 46, 8);
  snowMound(ctx, 1186, 546, 30, 5);
  snowMound(ctx, 1690, 512, 40, 7);
  snowMound(ctx, 2362, 514, 34, 6);
  vehicle(ctx, 'tug', 604, 543, 1, D);
  vehicle(ctx, 'cart', 618, 543);
  vehicle(ctx, 'cart', 631, 543);
  vehicle(ctx, 'cart', 819, 542);
  vehicle(ctx, 'cart', 832, 542);
  vehicle(ctx, 'tug', 1012, 543, -1);
  vehicle(ctx, 'deicer', 1362, 540, 1, D);
  vehicle(ctx, 'plow', 1588, 541, -1, D);
  vehicle(ctx, 'plow', 1624, 541, -1, D);
  vehicle(ctx, 'fuel', 2086, 543, 1);
  vehicle(ctx, 'tug', 2296, 543, 1, D);
  vehicle(ctx, 'cart', 2282, 543);
  infieldSigns(ctx);
}

// --- Nahe Ebene: Dünen, Straße, Zaun, Anflugbefeuerung -------------------------

function ridgeY(x) {
  const dune = Math.exp(-(((x - 320) / 290) ** 2)) * 34 + Math.exp(-(((x - 1250) / 170) ** 2)) * 12;
  const marsh = smooth(2150, 2360, x) * 10;
  return 637 - dune + marsh + 4 * Math.sin(x / 97) + 2.5 * Math.sin(x / 31 + 1.3);
}

// Oberkante des Schneewalls vorne; zwischen 1770 und 1880 flach (Versteck)
function frontY(x) {
  const wall = smooth(1696, 1770, x) * (1 - smooth(1880, 1954, x));
  const drift = Math.exp(-(((x - 120) / 120) ** 2)) * 14 + Math.exp(-(((x - 2900) / 140) ** 2)) * 12;
  const y = 682 + 3.5 * Math.sin(x / 61) + 2.5 * Math.sin(x / 23 + 2) - drift;
  return y * (1 - wall) + (641 + 0.8 * Math.sin(x / 9)) * wall;
}

// Verschneite Düne mit Mondlicht von rechts
function duneHump(ctx, x, base, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.bezierCurveTo(x + w * 0.25, base - h * 0.2, x + w * 0.35, base - h, x + w * 0.58, base - h);
  ctx.bezierCurveTo(x + w * 0.78, base - h, x + w * 0.85, base - h * 0.35, x + w, base);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, base - h, base, [[0, '#e9eff9'], [1, '#b2c1e0']]);
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = hgrad(ctx, x, x + w * 0.6, [[0, 'rgba(70,90,145,0.28)'], [1, 'rgba(70,90,145,0)']]);
  ctx.fillRect(x, base - h, w * 0.6, h);
  ctx.restore();
}

// Strandhafer-Büschel: Halme fächern aus schmaler Basis auf
function grassClump(ctx, rng, x, y, h) {
  const n = rng.int(10, 18);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const k = rng.range(-1, 1);
    const bx = x + k * h * 0.12;
    const hh = h * rng.range(0.5, 1) * (1 - Math.abs(k) * 0.3);
    const lean = k * h * rng.range(0.35, 0.8) + rng.range(-0.12, 0.12) * h;
    ctx.strokeStyle = rng.chance(0.45)
      ? rng.pick(['#4a4434', '#3d3a2e', '#55503c'])
      : rng.pick(['#9a8a62', '#b09d70', '#857857', '#c2b088']);
    ctx.lineWidth = rng.range(0.6, 1.1);
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx + lean * 0.15, y - hh * 0.65, bx + lean, y - hh);
    ctx.stroke();
  }
  ctx.fillStyle = '#eaf0fb';
  ctx.beginPath();
  ctx.ellipse(x, y + 0.8, h * 0.3, h * 0.08 + 1, 0, Math.PI, 0);
  ctx.fill();
  ctx.lineCap = 'butt';
}

function smallPine(ctx, x, base, h, D = null, rng = null) {
  ctx.fillStyle = '#2a1e16';
  ctx.fillRect(x - 1.5, base - h * 0.12, 3, h * 0.12);
  for (let i = 0; i < 4; i++) {
    const yb = base - h * 0.1 - i * h * 0.21;
    const hw = h * (0.36 - i * 0.07);
    poly(ctx, [[x - hw, yb], [x, yb - h * 0.36], [x + hw, yb]], i % 2 ? '#183d2a' : '#1c4630');
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    poly(ctx, [[x, yb - h * 0.36], [x + hw, yb], [x + hw * 0.2, yb]]);
    ctx.fill();
    ctx.fillStyle = '#edf3fd';
    ctx.beginPath();
    ctx.moveTo(x - hw * 0.62, yb - h * 0.14);
    ctx.lineTo(x, yb - h * 0.36);
    ctx.lineTo(x + hw * 0.62, yb - h * 0.14);
    ctx.quadraticCurveTo(x, yb - h * 0.2, x - hw * 0.62, yb - h * 0.14);
    ctx.fill();
  }
  if (D && rng) {
    for (let i = 0; i < 22; i++) {
      const k = rng.range(0.08, 0.9);
      const y = base - h * 0.1 - k * h * 0.8;
      const hw = h * 0.36 * (1 - k) * 0.85;
      const lx = x + rng.range(-hw, hw);
      const c = TREE_BULBS[i % TREE_BULBS.length];
      flare(ctx, lx, y, 4, c, 0.6);
      dot(ctx, lx, y, 0.9, `rgb(${c})`);
      D.bulbs.push({ x: lx, y, c, r: 6, ph: rng.range(0, TAU), s: rng.range(1.5, 3.5) });
    }
    star(ctx, x, base - h * 0.95, 3.4, 1.4, '#ffe27a');
    flare(ctx, x, base - h * 0.95, 12, '255,220,120', 0.55);
  }
}

function streetLamp(ctx, x, base) {
  const top = 528;
  const hx = x + 26;
  // Lichtkegel und Pfütze
  ctx.fillStyle = vgrad(ctx, top + 4, NEAR_ROAD[1], [[0, 'rgba(255,214,150,0.24)'], [1, 'rgba(255,214,150,0.02)']]);
  poly(ctx, [[hx - 4, top + 4], [hx + 4, top + 4], [hx + 46, NEAR_ROAD[1]], [hx - 46, NEAR_ROAD[1]]]);
  ctx.fill();
  pool(ctx, hx, NEAR_ROAD[1] - 6, 70, 12, 'rgba(255,210,140,0.45)');
  // Mast mit Ausleger
  ctx.fillStyle = hgrad(ctx, x - 2, x + 2, [[0, '#4a5268'], [1, '#232838']]);
  poly(ctx, [[x - 2.2, base], [x + 2.2, base], [x + 1.3, top + 4], [x - 1.3, top + 4]]);
  ctx.fill();
  ctx.fillRect(x - 3.5, base - 6, 7, 6);
  ctx.strokeStyle = '#2e3446';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top + 6);
  ctx.quadraticCurveTo(x + 2, top - 3, hx - 4, top);
  ctx.stroke();
  // Leuchtenkopf
  ctx.fillStyle = '#2b3142';
  ctx.beginPath();
  ctx.ellipse(hx, top + 1, 8, 3, 0, 0, TAU);
  ctx.fill();
  flare(ctx, hx, top + 4, 46, '255,210,140', 0.5);
  flare(ctx, hx, top + 4, 12, '255,240,200', 0.9);
  ctx.fillStyle = '#fff3d0';
  ctx.beginPath();
  ctx.ellipse(hx, top + 3, 6, 1.6, 0, 0, Math.PI);
  ctx.fill();
  snowCap(ctx, hx - 7, top - 1.5, 14, 1.6, '#f4f8ff');
  // Kranz mit Schleife
  const wy = 590;
  ctx.strokeStyle = '#1d5233';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, wy, 7, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,150,90,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, wy, 7.5, Math.PI * 1.1, Math.PI * 1.7);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3;
    dot(ctx, x + Math.cos(a) * 7, wy + Math.sin(a) * 7, 0.9, i % 2 ? '#d8232f' : '#ffd23a');
  }
  poly(ctx, [[x, wy + 6], [x - 5, wy + 3.5], [x - 5, wy + 9]], '#d8232f');
  poly(ctx, [[x, wy + 6], [x + 5, wy + 3.5], [x + 5, wy + 9]], '#d8232f');
  poly(ctx, [[x - 1, wy + 7], [x - 4, wy + 15], [x - 1.5, wy + 14]], '#b81c28');
  poly(ctx, [[x + 1, wy + 7], [x + 4, wy + 15], [x + 1.5, wy + 14]], '#b81c28');
}

function taxi(ctx, x, y, d) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(d, 1);
  // Scheinwerferkegel auf der Straße
  ctx.fillStyle = hgrad(ctx, 34, 110, [[0, 'rgba(255,246,220,0.32)'], [1, 'rgba(255,246,220,0)']]);
  poly(ctx, [[34, -10], [110, -16], [120, 2], [34, -6]]);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 38, 2.4, 0, 0, TAU);
  ctx.fill();
  // Karosserie
  ctx.fillStyle = vgrad(ctx, -24, -2, [[0, '#ffd64a'], [0.55, '#f6b418'], [1, '#b8800c']]);
  ctx.beginPath();
  ctx.moveTo(-36, -5);
  ctx.lineTo(-36, -12);
  ctx.quadraticCurveTo(-35, -15, -30, -15.5);
  ctx.lineTo(-18, -16);
  ctx.lineTo(-11, -24);
  ctx.lineTo(10, -24);
  ctx.lineTo(18, -16);
  ctx.lineTo(32, -15);
  ctx.quadraticCurveTo(37, -14, 37, -9);
  ctx.lineTo(37, -5);
  ctx.closePath();
  ctx.fill();
  // Fenster mit warmem Innenlicht
  ctx.fillStyle = 'rgba(40,40,52,0.9)';
  poly(ctx, [[-16.5, -16.5], [-10.3, -22.6], [-1.5, -22.6], [-1.5, -16.5]]);
  ctx.fill();
  poly(ctx, [[0.5, -16.5], [0.5, -22.6], [9.3, -22.6], [15.8, -16.5]]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,200,130,0.25)';
  ctx.fillRect(-14, -21, 26, 4);
  // Karomuster und Linien
  ctx.fillStyle = '#1b1b20';
  for (let i = 0; i < 12; i++) ctx.fillRect(-20 + i * 3.2, -12 + (i % 2) * 1.4, 1.6, 1.4);
  ctx.fillStyle = 'rgba(60,40,0,0.45)';
  ctx.fillRect(-0.3, -16, 0.6, 11);
  ctx.fillRect(-18, -16, 0.6, 11);
  // Dachschild
  flare(ctx, 0, -27, 14, '255,240,190', 0.6);
  ctx.fillStyle = '#fff4cf';
  ctx.fillRect(-6, -28.5, 12, 4.5);
  ctx.fillStyle = '#1b1b20';
  ctx.font = 'bold 3.6px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.scale(d, 1);
  ctx.fillText('TAXI', 0, -26.1);
  ctx.restore();
  // Schnee auf dem Dach
  ctx.fillStyle = '#f4f8ff';
  ctx.beginPath();
  ctx.moveTo(-11.5, -24);
  ctx.quadraticCurveTo(-3, -26.5, 6, -24.6);
  ctx.lineTo(10, -24);
  ctx.closePath();
  ctx.fill();
  // Lichter
  flare(ctx, 36, -10, 12, '255,250,225', 0.9);
  dot(ctx, 36, -10, 1.6, '#ffffff');
  flare(ctx, -36, -10, 9, '255,40,40', 0.8);
  ctx.fillStyle = '#ff3a3a';
  ctx.fillRect(-36.5, -12, 1.6, 3.5);
  // Räder
  for (const wx of [-22, 23]) {
    dot(ctx, wx, -4.5, 5, '#121318');
    dot(ctx, wx, -4.5, 2.2, '#9aa1b1');
  }
  ctx.restore();
}

function chainFence(ctx, x1, x2, base, h) {
  const top = base - h;
  ctx.strokeStyle = 'rgba(175,190,220,0.32)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = x1 - h; x < x2; x += 4) {
    const a = Math.max(x, x1);
    const b = Math.min(x + h, x2);
    ctx.moveTo(a, top + (a - x));
    ctx.lineTo(b, top + (b - x));
    ctx.moveTo(a, base - (a - x));
    ctx.lineTo(b, base - (b - x));
  }
  ctx.stroke();
  ctx.fillStyle = '#4c556e';
  ctx.fillRect(x1, top - 1, x2 - x1, 1.6);
  ctx.fillRect(x1, base - 3, x2 - x1, 1);
  ctx.strokeStyle = 'rgba(150,160,185,0.7)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    ctx.moveTo(x1, top - 3 - k * 2.4);
    for (let x = x1; x <= x2; x += 6) ctx.lineTo(x, top - 3 - k * 2.4 + Math.sin(x * 0.3 + k) * 0.6);
  }
  ctx.stroke();
  for (let x = x1; x <= x2; x += 68) {
    ctx.fillStyle = hgrad(ctx, x - 1.5, x + 1.5, [[0, '#707a94'], [1, '#3a4258']]);
    ctx.fillRect(x - 1.4, top - 1, 2.8, h + 1);
    ctx.fillStyle = '#4c556e';
    poly(ctx, [[x - 0.8, top], [x + 7, top - 8], [x + 8, top - 7], [x + 0.8, top + 1.5]]);
    ctx.fill();
    snowCap(ctx, x - 2, top - 1, 4, 1.2, '#f4f8ff');
  }
}

function snowFence(ctx, x1, x2) {
  for (let x = x1; x < x2; x += 3.4) {
    const g = ridgeY(x) + 10;
    ctx.fillStyle = (Math.floor(x) % 2) ? '#4e3f33' : '#5a4a3b';
    ctx.fillRect(x, g - 17, 1.8, 17);
    ctx.fillStyle = '#eef3fc';
    ctx.fillRect(x - 0.1, g - 17.6, 2, 1);
  }
  ctx.strokeStyle = '#2e2620';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (const k of [5, 13]) {
    for (let x = x1; x < x2; x += 4) {
      const y = ridgeY(x) + 10 - k;
      if (x === x1) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function roadSign(ctx, x, base) {
  ctx.fillStyle = '#5a6278';
  ctx.fillRect(x - 20, 566, 2, base - 566);
  ctx.fillRect(x + 18, 566, 2, base - 566);
  ctx.fillStyle = '#1b6a44';
  ctx.fillRect(x - 30, 548, 60, 24);
  ctx.strokeStyle = '#eef3fc';
  ctx.lineWidth = 0.9;
  ctx.strokeRect(x - 28.5, 549.5, 57, 21);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('JFK', x - 25, 557);
  ctx.font = 'bold 5px system-ui, sans-serif';
  ctx.fillText('Airport', x - 25, 565);
  // Pfeil nach oben
  ctx.beginPath();
  ctx.moveTo(x + 18, 552);
  ctx.lineTo(x + 24, 559);
  ctx.lineTo(x + 20.2, 559);
  ctx.lineTo(x + 20.2, 568);
  ctx.lineTo(x + 15.8, 568);
  ctx.lineTo(x + 15.8, 559);
  ctx.lineTo(x + 12, 559);
  ctx.closePath();
  ctx.fill();
  snowCap(ctx, x - 30, 548, 60, 2.6, '#f4f8ff');
}

function hydrant(ctx, x, base) {
  ctx.fillStyle = '#b81f28';
  ctx.fillRect(x - 3, base - 10, 6, 10);
  ctx.fillRect(x - 4.5, base - 7, 9, 2.4);
  ctx.fillRect(x - 4, base - 1.5, 8, 1.5);
  ctx.beginPath();
  ctx.ellipse(x, base - 10, 3, 2.4, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x - 2.6, base - 10, 1.2, 10);
  ctx.fillStyle = '#f4f8ff';
  ctx.beginPath();
  ctx.ellipse(x, base - 12, 3.4, 1.6, 0, Math.PI, 0);
  ctx.fill();
}

// Schneestange mit Reflexbändern, leicht schief im Wall
function snowStake(ctx, x, base, h, tilt) {
  ctx.save();
  ctx.translate(x, base);
  ctx.rotate(tilt);
  ctx.fillStyle = '#e8641c';
  ctx.fillRect(-0.9, -h, 1.8, h);
  ctx.fillStyle = '#1b1d26';
  for (let y = -h + 3; y < -6; y += 7) ctx.fillRect(-0.9, y, 1.8, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-0.9, -h, 0.6, h);
  ctx.fillStyle = '#f4f8ff';
  ctx.beginPath();
  ctx.ellipse(0, -h, 1.4, 0.8, 0, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

// Kleiner Schneemann mit Weihnachtsmütze
function snowman(ctx, x, base, h) {
  const r1 = h * 0.24;
  const r2 = h * 0.18;
  const r3 = h * 0.13;
  const y1 = base - r1;
  const y2 = y1 - r1 - r2 * 0.75;
  const y3 = y2 - r2 - r3 * 0.75;
  ctx.fillStyle = 'rgba(70,90,150,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 2, base, r1 * 1.5, 2.2, 0, 0, TAU);
  ctx.fill();
  for (const [yy, r] of [[y1, r1], [y2, r2], [y3, r3]]) {
    const g = ctx.createRadialGradient(x - r * 0.35, yy - r * 0.4, r * 0.1, x, yy, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.7, '#e3eaf7');
    g.addColorStop(1, '#a8b8da');
    dot(ctx, x, yy, r, g);
  }
  // Zweigarme
  ctx.strokeStyle = '#4a3626';
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r2 * 0.8, y2);
  ctx.lineTo(x - r2 * 2.1, y2 - r2 * 0.9);
  ctx.moveTo(x - r2 * 1.7, y2 - r2 * 0.6);
  ctx.lineTo(x - r2 * 1.9, y2 - r2 * 1.2);
  ctx.moveTo(x + r2 * 0.8, y2);
  ctx.lineTo(x + r2 * 2.2, y2 - r2 * 0.4);
  ctx.moveTo(x + r2 * 1.8, y2 - r2 * 0.3);
  ctx.lineTo(x + r2 * 2.1, y2 - r2 * 0.9);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // Knöpfe, Augen, Karottennase
  for (const k of [-0.45, 0, 0.45]) dot(ctx, x, y2 + k * r2, 0.75, '#1b1d26');
  dot(ctx, x - r3 * 0.35, y3 - r3 * 0.15, 0.6, '#1b1d26');
  dot(ctx, x + r3 * 0.35, y3 - r3 * 0.15, 0.6, '#1b1d26');
  poly(ctx, [[x, y3 + 0.2], [x + r3 * 1.3, y3 + 0.9], [x, y3 + 1.4]], '#f08a24');
  // Schal
  ctx.fillStyle = '#c8202c';
  ctx.fillRect(x - r3 * 1.05, y3 + r3 * 0.7, r3 * 2.1, 2);
  poly(ctx, [[x + r3 * 0.3, y3 + r3 * 0.9], [x + r3 * 1.0, y3 + r3 * 0.9], [x + r3 * 1.3, y3 + r3 * 2.6], [x + r3 * 0.6, y3 + r3 * 2.7]], '#b01a26');
  // Weihnachtsmütze mit Bommel
  const hy = y3 - r3 * 0.55;
  poly(ctx, [[x - r3 * 1.05, hy], [x + r3 * 1.0, hy], [x + r3 * 1.9, hy - r3 * 1.3], [x + r3 * 0.2, hy - r3 * 1.7]], '#d8232f');
  ctx.fillStyle = '#f4f6fb';
  ctx.fillRect(x - r3 * 1.15, hy - 0.6, r3 * 2.3, 2);
  dot(ctx, x + r3 * 2.0, hy - r3 * 1.3, 1.5, '#f4f6fb');
}

function paintNear(ctx, w, rng) {
  const D = (DYN.near = { als: [], bulbs: [], glints: [] });

  // Dünen und Marsch hinter der Straße
  ctx.fillStyle = vgrad(ctx, 590, NEAR_ROAD[0], [[0, '#d4dff2'], [0.5, '#b4c3e1'], [1, '#93a5cc']]);
  ctx.beginPath();
  ctx.moveTo(-10, 720);
  for (let x = -10; x <= w + 10; x += 6) ctx.lineTo(x, ridgeY(x));
  ctx.lineTo(w + 10, 720);
  ctx.closePath();
  ctx.fill();
  // Leeseiten-Schatten
  ctx.fillStyle = 'rgba(90,110,160,0.18)';
  ctx.beginPath();
  ctx.moveTo(-10, 720);
  for (let x = -10; x <= w + 10; x += 6) ctx.lineTo(x, ridgeY(x) + 6 + 4 * Math.sin(x / 45));
  ctx.lineTo(w + 10, 720);
  ctx.closePath();
  ctx.fill();
  // Gefrorene Marsch unter der Anflugbefeuerung
  const m1 = 2200;
  ctx.fillStyle = vgrad(ctx, 640, NEAR_ROAD[0], [[0, '#7487b2'], [1, '#90a2c8']]);
  ctx.fillRect(m1, ridgeY(m1 + 300) + 3, w - m1 + 10, NEAR_ROAD[0] - ridgeY(m1 + 300));
  ctx.fillStyle = 'rgba(220,232,255,0.35)';
  for (let i = 0; i < 40; i++) ctx.fillRect(rng.range(m1, w), rng.range(650, 653), rng.range(8, 40), 0.5);

  // Einzelne Dünenkuppen mit Strandhafer
  const humps = [[-60, 260, 30], [150, 320, 44], [430, 250, 30], [640, 190, 18], [1080, 160, 12], [1290, 200, 15], [1700, 140, 10], [2010, 170, 14]];
  for (const [x, hw, hh] of humps) {
    const base = ridgeY(x + hw / 2) + 12;
    duneHump(ctx, x, base, hw, hh);
  }
  // Strandhafer: in Gruppen, auf Kuppen dichter
  for (let x = 0; x < 2200;) {
    const dense = 0.5 + 0.5 * Math.sin(x / 140) * Math.sin(x / 53 + 1);
    const fenced = x > 600;
    if (dense > (fenced ? 0.55 : 0.3)) {
      let y = ridgeY(x) + rng.range(2, 6);
      for (const [hx, hw, hh] of humps) {
        if (x > hx + hw * 0.12 && x < hx + hw * 0.88) {
          const k = (x - hx) / hw;
          y = Math.min(y, ridgeY(hx + hw / 2) + 12 - hh * Math.sin(k * Math.PI) * 0.9 + 2);
        }
      }
      grassClump(ctx, rng, x, y, rng.range(fenced ? 9 : 13, fenced ? 16 : 26));
    }
    x += rng.range(7, 18);
  }
  for (let x = 2200; x < w; x += rng.range(20, 50)) {
    ctx.strokeStyle = 'rgba(40,44,60,0.7)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      ctx.moveTo(x + k * 1.2, 652);
      ctx.lineTo(x + k * 1.2 + rng.range(-2, 2), 652 - rng.range(4, 10));
    }
    ctx.stroke();
  }
  snowFence(ctx, 40, 560);

  // Kiefern auf den Dünen
  smallPine(ctx, 150, ridgeY(150) + 6, 52);
  smallPine(ctx, 196, ridgeY(196) + 8, 38);
  smallPine(ctx, 640, ridgeY(640) + 6, 64, D, rng);
  smallPine(ctx, 1236, ridgeY(1236) + 6, 46);
  smallPine(ctx, 1984, ridgeY(1984) + 7, 62, D, rng);
  smallPine(ctx, 2036, ridgeY(2036) + 8, 40);

  // Anflugbefeuerung auf einem Steg über der Marsch (Lichtbalken, Lauflicht zur Schwelle)
  ctx.fillStyle = '#2c3346';
  ctx.fillRect(2320, 640, 660, 2);
  ctx.strokeStyle = 'rgba(44,51,70,0.85)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = 2320; x < 2980; x += 12) {
    ctx.moveTo(x, 642);
    ctx.lineTo(x + 6, 652);
    ctx.lineTo(x + 12, 642);
  }
  for (let x = 2320; x < 2980; x += 37) {
    ctx.moveTo(x, 636);
    ctx.lineTo(x, 652);
  }
  ctx.moveTo(2320, 636);
  ctx.lineTo(2980, 636);
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const x = 2350 + i * 74;
    const top = 614 - i * 0.5;
    const g = 640;
    ctx.fillStyle = '#3a4258';
    ctx.fillRect(x - 1.2, top, 2.4, g - top);
    ctx.fillStyle = '#2a3042';
    ctx.fillRect(x - 10, top - 1, 20, 2.4);
    for (let k = -2; k <= 2; k++) {
      flare(ctx, x + k * 4, top - 1.5, 6, '255,240,200', 0.55);
      dot(ctx, x + k * 4, top - 1.5, 0.9, '#fff6dd');
    }
    // Spiegelung im Eis
    ctx.fillStyle = 'rgba(255,240,200,0.18)';
    ctx.fillRect(x - 2, 654, 4, 1);
    D.als.push({ x, y: top - 4 });
    dot(ctx, x, top - 4, 0.8, 'rgba(255,255,255,0.5)');
  }

  chainFence(ctx, 600, 2240, 652, 34);
  roadSign(ctx, 1810, 654);
  for (const lx of [300, 900, 1500, 2140]) streetLamp(ctx, lx, 657);
  hydrant(ctx, 1188, 656);

  // Straße mit festgefahrenem Schnee und dunklen Fahrspuren
  ctx.fillStyle = '#e6edf9';
  ctx.fillRect(-10, NEAR_ROAD[0] - 2, w + 20, 3);
  ctx.fillStyle = vgrad(ctx, NEAR_ROAD[0], NEAR_ROAD[1], [[0, '#8592b4'], [1, '#76839f']]);
  ctx.fillRect(-10, NEAR_ROAD[0], w + 20, NEAR_ROAD[1] - NEAR_ROAD[0]);
  for (const [y, hh] of [[657.2, 2.2], [662.4, 2.2], [667.4, 2.5], [672.2, 2.5]]) {
    for (let x = -10; x < w + 10;) {
      const len = rng.range(120, 520);
      ctx.fillStyle = vgrad(ctx, y, y + hh, [[0, 'rgba(36,42,62,0.75)'], [1, 'rgba(50,58,82,0.55)']]);
      ctx.fillRect(x, y + rng.range(-0.3, 0.3), len, hh);
      x += len + rng.range(4, 30);
    }
  }
  ctx.fillStyle = 'rgba(240,246,255,0.35)';
  for (let i = 0; i < 90; i++) ctx.fillRect(rng.range(0, w), rng.range(655, 675), rng.range(10, 60), 0.5);
  for (const lx of [300, 900, 1500, 2140]) pool(ctx, lx + 26, 666, 64, 9, 'rgba(255,200,130,0.38)');

  taxi(ctx, 1060, 673, 1);
  taxi(ctx, 2580, 673, -1);

  // Schneewall vorne
  ctx.fillStyle = vgrad(ctx, 640, 720, [[0, '#eef3fc'], [0.35, '#d0dbef'], [1, '#aebde0']]);
  ctx.beginPath();
  ctx.moveTo(-10, 721);
  for (let x = -10; x <= w + 10; x += 4) ctx.lineTo(x, frontY(x));
  ctx.lineTo(w + 10, 721);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -10; x <= w + 10; x += 4) {
    if (x === -10) ctx.moveTo(x, frontY(x) + 0.5);
    else ctx.lineTo(x, frontY(x) + 0.5);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(100,120,170,0.22)';
  ctx.beginPath();
  ctx.moveTo(-10, 721);
  for (let x = -10; x <= w + 10; x += 4) ctx.lineTo(x, frontY(x) + 8 + 3 * Math.sin(x / 37));
  ctx.lineTo(w + 10, 721);
  ctx.closePath();
  ctx.fill();
  // Räumspuren im Schneewall, Schattenflanke links
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(1690, 721);
  for (let x = 1690; x <= 1960; x += 3) ctx.lineTo(x, frontY(x));
  ctx.lineTo(1960, 721);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = hgrad(ctx, 1700, 1800, [[0, 'rgba(80,100,155,0)'], [0.35, 'rgba(80,100,155,0.28)'], [1, 'rgba(80,100,155,0)']]);
  ctx.fillRect(1690, 630, 110, 90);
  for (let k = 0; k < 5; k++) {
    ctx.strokeStyle = k % 2 ? 'rgba(255,255,255,0.45)' : 'rgba(110,130,185,0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 1700; x <= 1950; x += 6) {
      const y = 650 + k * 6.5 + Math.sin(x / 17 + k) * 1.4;
      if (x === 1700) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Schatten unter der überhängenden Wechte
  ctx.fillStyle = 'rgba(96,118,175,0.3)';
  ctx.beginPath();
  ctx.moveTo(1740, frontY(1740) + 1);
  for (let x = 1740; x <= 1910; x += 5) ctx.lineTo(x, frontY(x) + 1.2);
  for (let x = 1910; x >= 1740; x -= 5) ctx.lineTo(x, frontY(x) + 3.5 + 1.6 * Math.sin(x / 7) + 1.2 * Math.sin(x / 3.1));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Abgebrochene Schneebrocken am Fuß des Walls
  for (const [x, r] of [[1712, 4], [1724, 2.6], [1748, 3.2], [1902, 3.6], [1922, 2.4], [1946, 4.4], [1960, 2.2]]) {
    const y = frontY(x) + r * 0.6;
    ctx.fillStyle = vgrad(ctx, y - r, y + r * 0.6, [[0, '#f6f9ff'], [1, '#a9b9dc']]);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.3, r, 0, 0, TAU);
    ctx.fill();
  }
  snowStake(ctx, 1722, frontY(1722) + 6, 34, -0.06);
  snowStake(ctx, 1930, frontY(1930) + 6, 30, 0.05);
  snowman(ctx, 1996, frontY(1996) + 4, 36);
  // Halme im Vordergrund links und rechts
  for (let x = 0; x < w; x += rng.range(24, 70)) {
    if (x > 1680 && x < 2030) continue;
    if (x > 560 && x < 2200 && rng.chance(0.65)) continue;
    grassClump(ctx, rng, x, frontY(x) + rng.range(3, 7), rng.range(14, 30));
  }
  // Glitzerpunkte im Schnee
  for (let i = 0; i < 260; i++) {
    const x = rng.range(0, w);
    const back = rng.chance(0.4);
    const y = back ? ridgeY(x) + rng.range(2, 10) : frontY(x) + rng.range(2, 30);
    if (rng.chance(0.5)) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x, y, 0.8, 0.8);
    } else {
      D.glints.push({ x, y, s: rng.range(0.8, 2.4), ph: rng.range(0, TAU) });
    }
  }
}

// --- Animationen -------------------------------------------------------------

function blinkOn(t, p, ph, duty = 0.45) {
  return ((t / p + ph) % 1) < duty;
}

function drawBeacons(ctx, list, t, view, id) {
  for (const b of list) {
    if (!view.isVisible(id, b.x, 20)) continue;
    if (!blinkOn(t, b.p, b.ph)) continue;
    flare(ctx, b.x, b.y, b.r * 2, b.rgb, 0.9);
    dot(ctx, b.x, b.y, b.r * 0.16, '#ffffff');
  }
}

function twinkle(ctx, list, t, view, id, q, boost = 1) {
  const step = q < 0.7 ? 2 : 1;
  for (let i = 0; i < list.length; i += step) {
    const b = list[i];
    if (!view.isVisible(id, b.x, 10)) continue;
    const a = Math.sin(t * b.s + b.ph);
    if (a < 0.2) continue;
    flare(ctx, b.x, b.y, (b.r || 5) * boost, b.c, (a - 0.2) * 0.9);
  }
}

function dynSky(ctx, t, view) {
  const w = view.viewW;
  const m = moonPos(w);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 16; i++) {
    const x = hash(i * 3.7 + 1) * w;
    const y = 16 + hash(i * 5.3 + 2) ** 1.3 * 300;
    if (Math.hypot(x - m.x, y - m.y) < m.r * 2.5) continue;
    const a = Math.max(0, Math.sin(t * (0.7 + hash(i) * 1.8) + i * 2.1));
    if (a < 0.05) continue;
    flare(ctx, x, y, 4.5, '215,230,255', a * 0.7);
    ctx.globalAlpha = a * 0.9;
    const s = 1.5 + a * 2.5;
    ctx.fillRect(x - s, y - 0.25, s * 2, 0.5);
    ctx.fillRect(x - 0.25, y - s, 0.5, s * 2);
    ctx.globalAlpha = 1;
  }
  // Sternschnuppe alle ~14 s
  const P = 14;
  const n = Math.floor(t / P);
  const k = (t - n * P) / 0.9;
  if (k < 1) {
    const x0 = (0.15 + hash(n * 9.1) * 0.7) * w;
    const y0 = 30 + hash(n * 4.3) * 110;
    const dx = hash(n * 2.2) < 0.5 ? -1 : 1;
    const len = 90;
    const hx = x0 + dx * k * 160;
    const hy = y0 + k * 60;
    const fade = Math.sin(k * Math.PI);
    ctx.strokeStyle = 'rgba(230,240,255,0.85)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = fade * (1 - i / 4);
      ctx.lineWidth = 1.4 - i * 0.3;
      ctx.beginPath();
      ctx.moveTo(hx - dx * (len * i) / 4 * 0.94, hy - (len * i) / 4 * 0.35);
      ctx.lineTo(hx - dx * (len * (i + 1)) / 4 * 0.94, hy - (len * (i + 1)) / 4 * 0.35);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    flare(ctx, hx, hy, 6, '230,240,255', fade);
  }
}

function dynFar(ctx, t, view, q) {
  const D = DYN.far;
  if (!D) return;
  drawBeacons(ctx, D.beacons, t, view, 'far');
  if (D.esb && view.isVisible('far', D.esb.x, 60)) {
    const p = 0.5 + 0.5 * Math.sin(t * 0.9);
    flare(ctx, D.esb.x, D.esb.y + 4, 40, '255,60,60', 0.12 + 0.12 * p);
    flare(ctx, D.esb.x, D.esb.y - 12, 30, '60,255,130', 0.1 + 0.1 * (1 - p));
  }
  const step = q < 0.6 ? 2 : 1;
  for (let i = 0; i < D.glints.length; i += step) {
    const g = D.glints[i];
    if (!view.isVisible('far', g.x, 6)) continue;
    const a = Math.sin(t * g.s + g.ph);
    if (a < 0.35) continue;
    ctx.globalAlpha = (a - 0.35) * 1.5 * g.a;
    ctx.fillStyle = g.c;
    ctx.fillRect(g.x, g.y, g.l, 0.6);
  }
  ctx.globalAlpha = 1;
}

function dynMid(ctx, t, view, q) {
  const D = DYN.mid;
  if (!D) return;
  drawBeacons(ctx, D.beacons, t, view, 'mid');
  // Flughafen-Drehfeuer: abwechselnd grün und weiß
  if (D.tower && view.isVisible('mid', D.tower.x, 60)) {
    const ph = (t * 0.75) % 1;
    const [bx, by] = D.tower.beacon;
    if (ph < 0.12) flare(ctx, bx, by, 26, '80,255,140', 1 - ph / 0.12);
    else if (ph > 0.5 && ph < 0.62) flare(ctx, bx, by, 26, '255,255,240', 1 - (ph - 0.5) / 0.12);
  }
  twinkle(ctx, D.bulbs, t, view, 'mid', q);
  if (D.star && view.isVisible('mid', D.star.x, 160)) {
    twinkle(ctx, D.tree, t, view, 'mid', q, 1.1);
    const s = D.star;
    const p = 0.5 + 0.5 * Math.sin(t * 2.2);
    flare(ctx, s.x, s.y, 22 + p * 8, '255,236,170', 0.35 + p * 0.3);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(t * 0.25);
    ctx.fillStyle = 'rgba(255,248,215,0.55)';
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-15 - p * 4, -0.35, 30 + p * 8, 0.7);
    }
    ctx.restore();
  }
  // Rundumleuchten der Bodenfahrzeuge
  for (let i = 0; i < D.plows.length; i++) {
    const b = D.plows[i];
    if (!view.isVisible('mid', b.x, 20)) continue;
    const a = Math.sin(t * 7 + i * 1.7);
    dot(ctx, b.x, b.y, 0.9, '#ffb020');
    if (a > 0.3) flare(ctx, b.x, b.y, 7, '255,170,40', a);
  }
  // Lauflicht der Anflugbefeuerung (zur Schwelle hin)
  const n = D.rabbit.length;
  if (n && view.isVisible('mid', D.rabbit[0].x, 140)) {
    const k = n - 1 - Math.floor(((t * 2) % 1) * n);
    const r = D.rabbit[k];
    if (r) flare(ctx, r.x, r.y, 14, '235,245,255', 1);
  }
}

function dynNear(ctx, t, view, q) {
  const D = DYN.near;
  if (!D) return;
  const n = D.als.length;
  if (n && view.isVisible('near', D.als[0].x, 700)) {
    const pos = ((t * 2) % 1) * (n + 1);
    const k = n - 1 - Math.floor(pos);
    for (let i = 0; i < n; i++) {
      const a = D.als[i];
      if (i === k) {
        flare(ctx, a.x, a.y, 40, '200,225,255', 1);
        flare(ctx, a.x, a.y, 12, '255,255,255', 1);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(a.x - 22, a.y - 0.6, 44, 1.2);
        dot(ctx, a.x, a.y, 2.4, '#ffffff');
      } else if (i === k + 1) {
        flare(ctx, a.x, a.y, 18, '235,245,255', 0.35);
      }
    }
  }
  twinkle(ctx, D.bulbs, t, view, 'near', q, 1.2);
  ctx.fillStyle = '#ffffff';
  const step = q < 0.6 ? 2 : 1;
  for (let i = 0; i < D.glints.length; i += step) {
    const g = D.glints[i];
    if (!view.isVisible('near', g.x, 4)) continue;
    const a = Math.sin(t * g.s + g.ph);
    if (a < 0.86) continue;
    const k = (a - 0.86) / 0.14;
    ctx.globalAlpha = k;
    ctx.fillRect(g.x - 1.6 * k, g.y - 0.3, 3.2 * k, 0.6);
    ctx.fillRect(g.x - 0.3, g.y - 1.6 * k, 0.6, 3.2 * k);
  }
  ctx.globalAlpha = 1;
}

// --- Szene -------------------------------------------------------------------

export default {
  id: 'JFK',
  iata: 'JFK',
  icao: 'KJFK',
  name: 'New York JFK',
  city: 'New York',
  country: 'USA',
  subtitle: 'Sternklare Winternacht vor Manhattan',
  theme: { accent: '#ff4f5e', skyTop: '#081636', skyBottom: '#d47e4c' },
  weather: { snow: 0.35 },
  layerTop: { far: 190, mid: 208, near: 476 },

  paintSky,

  paintLayer(ctx, layerId, { w, rng }) {
    if (layerId === 'far') paintFar(ctx, w, rng);
    else if (layerId === 'mid') paintMid(ctx, w, rng);
    else if (layerId === 'near') paintNear(ctx, w, rng);
  },

  drawDynamic(ctx, layerId, { t, view }) {
    const q = view.quality ?? 1;
    ctx.save();
    if (layerId === 'sky') dynSky(ctx, t, view);
    else if (layerId === 'far') dynFar(ctx, t, view, q);
    else if (layerId === 'mid') dynMid(ctx, t, view, q);
    else if (layerId === 'near') dynNear(ctx, t, view, q);
    ctx.restore();
  },

  traffic: {
    planeScale: { far: 0.38, mid: 1.0, near: 2.2 },
    runways: [
      {
        id: '31L', layer: 'mid', y: RWY.y, x1: RWY.x1, x2: RWY.x2, dir: -1,
        use: 'mixed', arrivalsPerMin: 3.4, departuresPerMin: 3,
        approach: { startY: 120, lowFlyLayer: null },
      },
      {
        id: '04L', layer: 'far', y: FAR_RWY.y, x1: FAR_RWY.x1, x2: FAR_RWY.x2, dir: 1,
        use: 'mixed', arrivalsPerMin: 2.2, departuresPerMin: 2,
        approach: { startY: 150, lowFlyLayer: null },
      },
    ],
    taxiways: [
      { layer: 'mid', y: TAXI_Y, x1: 60, x2: 2340 },
      // Ohne eigenen Rollweg würde der ferne Verkehr in der Bucht rollen
      ...FAR_TAXI.lanes.map((y) => ({ layer: 'far', y, x1: 0, x2: 1800 })),
    ],
    gates: GATES.map((g) => ({ layer: 'mid', x: g.x, y: GATE_Y, dir: g.dir })),
    overflights: [
      { layer: 'far', yMin: 40, yMax: 210, perMin: 4.5, contrails: true },
      { layer: 'mid', yMin: 110, yMax: 250, perMin: 1.2, contrails: false },
    ],
    helicopters: 0.7,
    fleet: { narrow: 4, wide: 4.5, jumbo: 2, a380: 0.8, regional: 2.5, prop: 0.3 },
    liveries: null,
  },

  eagleZones: { far: [50, 330], mid: [60, 400], near: [40, 470] },

  // Flache Oberkanten (y = sichtbare Schneekante): Terminaldächer, Tower-Kanzel, Schneewall
  hideSpots: [
    { layer: 'mid', x: 540, y: T4.roof - 1.6, w: 60 },
    { layer: 'mid', x: 990, y: T4.roof - 1.6, w: 60 },
    { layer: 'mid', x: 1792, y: 250.5, w: 28 },
    { layer: 'mid', x: 2250, y: T8.roof - 2.4, w: 56 },
    { layer: 'near', x: 1800, y: 641.4, w: 60 },
  ],
};
