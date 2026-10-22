// Frankfurt am Main (EDDF) – Winterabend zur blauen Stunde, kräftiger Schneefall, Mainhattan am Horizont
import { linearSky, glow, stars, snowCap } from './paint.js';
import { createRng } from '../core/rng.js';

const TAU = Math.PI * 2;
const SNOW = '#eef2ff';
const SNOW_SHADE = '#aab4de';
const WARM = '255,196,120';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

// --- Geometrie (Ebenen-Koordinaten) – Malen, Verkehr und Animationen nutzen dieselben Werte ---
const FAR_BASE = 478;
const RWY = { y: 600, x1: 140, x2: 2260, half: 11 };
const TWY_Y = 556;
const GATE_Y = 522;
const GATES_X = [340, 535, 730, 925, 1120, 1315];
const REMOTE_X = [1805, 2025];
const HALL = { x1: 230, x2: 1420, top: 418, base: 506 };
const HALL_HEAD = { x1: 700, x2: 1000, top: 398 };
const PIER = { x1: 236, x2: 1414, top: 470, base: 512 };
const TOWER = { x: 1594, base: 508, neck: 314, cabBot: 296, cabTop: 272, roof: 264, ant: 224 };
const XTREE = { x: 1470, base: 514, h: 128 };
const HANGAR = { x1: 1680, x2: 2140, wallTop: 434, apex: 384, base: 512 };
const ANNEX = { x1: 2140, x2: 2256, top: 452, base: 512 };
const DEPOT = { x1: 16, x2: 214, top: 468, base: 508 };
const RADAR = { x: 2340, base: 512, top: 406 };
const MASTS = [140, 632, 1022, 1662, 2272];
const WHEEL = { x: 1712, y: 438, r: 24, n: 16 };
const NEAR_GROUND = 664;
const NEAR_TREES = [[-6, 340], [92, 196], [770, 206], [1962, 250], [2048, 168], [2700, 296], [2772, 196]];
const LAMPS = [430, 1112, 1792, 2292];
const NEAR_APPROACH = [2846, 2896, 2946, 2996];
const HILL = { x1: 1300, x2: 1850, top: 606 };
const HUT = { x: 1186, base: 654 };

// --- kleine Helfer ---

function grad(ctx, x0, y0, x1, y1, colors) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  const n = colors.length - 1;
  colors.forEach((c, i) => (Array.isArray(c) ? g.addColorStop(c[0], c[1]) : g.addColorStop(n ? i / n : 0, c)));
  return g;
}

function poly(ctx, p) {
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.closePath();
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function ellipseGlow(ctx, x, y, rx, ry, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx / ry, 1);
  glow(ctx, 0, 0, ry, color);
  ctx.restore();
}

// Vorgerenderte Licht-Sprites: drawImage statt Verlauf pro Frame
const sprites = new Map();
function sprite(rgb) {
  let c = sprites.get(rgb);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.1, `rgba(${rgb},0.95)`);
  r.addColorStop(0.3, `rgba(${rgb},0.4)`);
  r.addColorStop(0.6, `rgba(${rgb},0.1)`);
  r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  sprites.set(rgb, c);
  return c;
}

function flare(ctx, rgb, x, y, r, a = 1) {
  if (a <= 0.02) return;
  const old = ctx.globalAlpha;
  ctx.globalAlpha = old * Math.min(1, a);
  ctx.drawImage(sprite(rgb), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = old;
}

// Statische Lampe: Hof + harter Kern
function bulb(ctx, rgb, x, y, r, a = 0.8, core = 0.7) {
  flare(ctx, rgb, x, y, r, a);
  ctx.fillStyle = `rgba(${rgb},1)`;
  ctx.beginPath();
  ctx.arc(x, y, core, 0, TAU);
  ctx.fill();
}

// Gleichmäßig weiche Kammlinie aus Stützpunkten mit leichtem Rauschen
function ridgePts(rng, ctrl, amp, step = 24) {
  const pts = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const [ax, ay] = ctrl[i];
    const [bx, by] = ctrl[i + 1];
    const n = Math.max(1, Math.round((bx - ax) / step));
    for (let j = 0; j < n; j++) {
      const k = j / n;
      const s = (1 - Math.cos(k * Math.PI)) / 2;
      pts.push([ax + (bx - ax) * k, ay + (by - ay) * s + (j ? rng.range(-amp, amp) : 0)]);
    }
  }
  pts.push(ctrl[ctrl.length - 1]);
  return pts;
}

function ridge(ctx, pts, fill, bottom = 720) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], bottom);
  ctx.lineTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  const [lx, ly] = pts[pts.length - 1];
  ctx.lineTo(lx, ly);
  ctx.lineTo(lx, bottom);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// Bürofenster: ganze Etagen sind entweder hell oder dunkel – wirkt natürlicher als reines Zufallsraster
function towerWindows(ctx, rng, x, y0, w, y1, { rowH = 4.2, colW = 3.2, lit = 0.45, cool = 0.2, alpha = 0.85, warm = '#ffd38a' } = {}) {
  const cols = Math.max(1, Math.floor(w / colW));
  const cw = w / cols;
  ctx.save();
  for (let y = y0; y < y1 - rowH * 0.6; y += rowH) {
    const f = rng.next();
    const p = f < lit ? 0.82 : f < lit + 0.2 ? 0.25 : 0.04;
    ctx.fillStyle = rng.next() < cool ? '#d6e3ff' : warm;
    for (let c = 0; c < cols; c++) {
      if (rng.next() >= p) continue;
      ctx.globalAlpha = alpha * rng.range(0.45, 1);
      ctx.fillRect(x + c * cw + cw * 0.2, y, cw * 0.6, rowH * 0.5);
    }
  }
  ctx.restore();
}

// Lumpige Schneekante entlang einer Linie (für Wälle, Haufen)
function snowMound(ctx, x, y, w, h, color = SNOW, shade = SNOW_SHADE) {
  ctx.save();
  ctx.fillStyle = grad(ctx, 0, y - h, 0, y, [color, shade]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + w * 0.15, y - h * 0.9, x + w * 0.35, y - h * 1.05, x + w * 0.55, y - h * 0.9);
  ctx.bezierCurveTo(x + w * 0.75, y - h * 0.8, x + w * 0.9, y - h * 0.5, x + w, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// --- Positionen der animierten Lichter (einmalig, deterministisch) ---

const FX = buildFx();

function buildFx() {
  const r = createRng(0xf2a);
  // Hindernisfeuer der Skyline [x, y, Phase]
  const obstacle = [
    [255, 228, 0], [255, 270, 0], [255, 306, 0], [380, 350, 0.3],
    [662, 254, 0], [1012.6, 210, 0], [984, 252, 0], [1015, 248, 0],
    [912, 270, 0], [842, 334, 0], [585, 336, 0], [1078, 304, 0],
    [1495, 324, 0.5], [1604, 336, 0.5], [1122, 326, 0],
  ];
  // Weihnachtsbaum: spiralige Lichterkette
  const tree = [];
  const { x: tx, base: tb, h: th } = XTREE;
  for (let i = 0; i < 70; i++) {
    const s = i / 70;
    const y = tb - 14 - s * (th - 26);
    const half = (th * 0.38) * (1 - s * 0.86);
    const a = s * TAU * 4.2;
    if (Math.cos(a) < -0.35) continue;
    tree.push([tx + Math.sin(a) * half * 0.92, y + Math.cos(a) * 1.5, r.range(0, TAU), r.pick(['255,220,150', '255,220,150', '255,90,80', '120,190,255', '255,200,80'])]);
  }
  // Lichterkette unter der Dachkante des Terminals
  const garland = [];
  const span = 48;
  for (let x0 = HALL.x1 + 4; x0 < HALL.x2 - span; x0 += span) {
    for (let d = 3; d < span; d += 8) {
      const k = d / span;
      const x = x0 + d;
      const inHead = x > HALL_HEAD.x1 && x < HALL_HEAD.x2;
      garland.push([x, (inHead ? 416 : 434) + Math.sin(k * Math.PI) * 5, r.range(0, TAU), r.pick(['255,214,140', '255,214,140', '255,80,80', '255,214,140', '120,220,140'])]);
    }
  }
  // Glühweinstand + Zaun-Lichterkette (near)
  const hut = [];
  for (let i = 0; i <= 16; i++) {
    const k = i / 16;
    const x = HUT.x - 6 + k * 102;
    const y = HUT.base - 48 - (1 - Math.abs(k - 0.5) * 2) * 20 + 3;
    hut.push([x, y, r.range(0, TAU), r.pick(['255,90,80', '255,214,120', '120,210,130', '120,180,255'])]);
  }
  const fenceLights = [];
  for (let x0 = 960; x0 < 1290; x0 += 64) {
    for (let d = 4; d < 64; d += 9) {
      const k = d / 64;
      fenceLights.push([x0 + d, 622 + Math.sin(k * Math.PI) * 6, r.range(0, TAU), r.pick(['255,90,80', '255,214,120', '120,210,130', '120,180,255'])]);
    }
  }
  return { obstacle, tree, garland, hut, fenceLights };
}

// --- Himmel ---

function paintSky(ctx, { w, h, rng }) {
  linearSky(ctx, w, h, [
    [0, '#0b1134'], [0.13, '#151f55'], [0.28, '#283777'], [0.42, '#465394'],
    [0.51, '#6a5f9f'], [0.57, '#946b9f'], [0.615, '#c77a8f'], [0.65, '#ec9469'], [0.7, '#f7b26f'], [1, '#f4a468'],
  ]);
  // Lichtglocke der Stadt über dem Horizont
  ellipseGlow(ctx, w * 0.55, 476, Math.max(220, w * 0.7), 120, 'rgba(255,176,112,0.45)');
  stars(ctx, rng, w, 240, Math.round(w * 0.05), { alpha: 0.65, maxR: 1.1 });

  // Mondsichel, relativ zur Breite platziert
  const mx = Math.max(60, Math.min(w - 44, w * 0.8));
  const my = 104;
  const mr = 13;
  glow(ctx, mx, my, mr * 7, 'rgba(210,215,255,0.2)');
  ctx.fillStyle = 'rgba(190,200,255,0.12)';
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f7f2dc';
  ctx.beginPath();
  ctx.arc(mx, my, mr, -Math.PI / 2, Math.PI / 2);
  ctx.ellipse(mx, my, mr * 0.42, mr, 0, Math.PI / 2, -Math.PI / 2, true);
  ctx.fill();

  // Schneewolken-Decke oben, weich auslaufend
  for (let x = -60; x < w + 60; x += rng.range(36, 64)) {
    ellipseGlow(ctx, x, rng.range(-10, 22), rng.range(90, 150), rng.range(46, 70), 'rgba(10,13,44,0.6)');
  }
  for (let x = -40; x < w + 40; x += rng.range(60, 110)) {
    ellipseGlow(ctx, x, rng.range(40, 62), rng.range(60, 110), rng.range(10, 16), 'rgba(110,115,190,0.16)');
  }

  // Dünne, weich auslaufende Wolkenschleier, unten von der Stadt rosa angestrahlt
  const n = Math.max(2, Math.round(w / 300));
  for (let i = 0; i < n; i++) {
    const cx = (i + rng.range(0.15, 0.85)) * (w / n);
    const cy = rng.range(250, 400);
    const cw = rng.range(160, 300);
    const low = cy > 330;
    const body = low ? 'rgba(236,150,160,0.34)' : 'rgba(150,152,218,0.26)';
    const lit = low ? 'rgba(255,196,170,0.3)' : 'rgba(205,190,235,0.2)';
    for (let j = 0; j < 7; j++) {
      const ex = cx + rng.range(-cw / 2, cw / 2);
      const ey = cy + rng.range(-5, 5);
      const erx = rng.range(cw * 0.22, cw * 0.48);
      ellipseGlow(ctx, ex, ey, erx, rng.range(5, 10), body);
      // hellere Unterkante
      ellipseGlow(ctx, ex + rng.range(-10, 10), ey + 3, erx * 0.6, 2.5, lit);
    }
  }
}

// --- Ebene far: Taunus + Mainhattan ---

function farTower(ctx, rng, { x, w, top, roof = 'flat', c1 = '#232850', c2 = '#3a3f72', lit = 0.45, cool = 0.25 }) {
  const x0 = x - w / 2;
  ctx.fillStyle = grad(ctx, x0, 0, x0 + w, 0, [c1, c2]);
  ctx.fillRect(x0, top, w, FAR_BASE - top);
  if (roof === 'round') {
    ctx.beginPath();
    ctx.ellipse(x, top, w / 2, w * 0.3, 0, Math.PI, 0);
    ctx.fill();
  } else if (roof === 'slant') {
    poly(ctx, [x0, top, x0 + w, top - w * 0.45, x0 + w, top]);
    ctx.fill();
  } else if (roof === 'step') {
    ctx.fillRect(x0 + w * 0.15, top - 6, w * 0.7, 6);
    ctx.fillRect(x0 + w * 0.38, top - 10, w * 0.24, 4);
  } else {
    ctx.fillRect(x0 + w * 0.2, top - 3, w * 0.35, 3);
  }
  ctx.fillStyle = 'rgba(255,180,140,0.14)';
  ctx.fillRect(x0 + w - 1, top, 1, FAR_BASE - top);
  towerWindows(ctx, rng, x0 + 1.5, top + 3, w - 3, FAR_BASE, { lit, cool });
}

function cityBand(ctx, rng, w, { hMin, hMax, colors, lights, center = 950, boost = 22 }) {
  for (let x = -10; x < w + 10;) {
    const bw = rng.range(6, 22);
    const c = 1 - Math.min(1, Math.abs(x - center) / 900);
    const bh = rng.range(hMin, hMax) + c * rng.range(0, boost);
    ctx.fillStyle = rng.pick(colors);
    ctx.fillRect(x, FAR_BASE - bh, bw, bh + 4);
    if (rng.chance(0.25)) {
      ctx.beginPath();
      ctx.moveTo(x, FAR_BASE - bh);
      ctx.lineTo(x + bw / 2, FAR_BASE - bh - bw * 0.35);
      ctx.lineTo(x + bw, FAR_BASE - bh);
      ctx.fill();
    }
    const n = Math.floor((bw * bh) / 26);
    for (let i = 0; i < n; i++) {
      if (!rng.chance(lights)) continue;
      ctx.fillStyle = rng.chance(0.8) ? 'rgba(255,205,130,0.85)' : 'rgba(210,225,255,0.75)';
      ctx.fillRect(x + rng.range(1, bw - 2), FAR_BASE - bh + rng.range(1.5, bh - 1), 1.1, 1.1);
    }
    x += bw + rng.range(-2, 1.5);
  }
}

function europaturm(ctx, x) {
  const b = FAR_BASE;
  const c = grad(ctx, x - 17, 0, x + 17, 0, ['#3c3a66', '#5f5c8a', '#46446f']);
  ctx.fillStyle = c;
  poly(ctx, [x - 8, b, x - 4.5, 330, x + 4.5, 330, x + 8, b]);
  ctx.fill();
  rrect(ctx, x - 17, 322, 34, 8, 3);
  ctx.fill();
  rrect(ctx, x - 14, 311, 28, 11, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,150,0.85)';
  ctx.fillRect(x - 13, 315, 26, 2.2);
  ctx.fillStyle = 'rgba(255,214,150,0.4)';
  ctx.fillRect(x - 15, 325, 30, 1.2);
  ctx.fillStyle = c;
  rrect(ctx, x - 9, 305, 18, 6, 2);
  ctx.fill();
  ctx.fillStyle = '#4b4976';
  ctx.fillRect(x - 2.5, 270, 5, 36);
  ctx.fillRect(x - 1, 240, 2, 31);
  ctx.fillRect(x - 0.4, 228, 0.8, 12);
  ctx.fillStyle = 'rgba(255,190,150,0.2)';
  ctx.fillRect(x + 3, 332, 1, b - 332);
}

function westendGate(ctx, rng, x) {
  const b = FAR_BASE;
  ctx.fillStyle = grad(ctx, x - 12, 0, x + 12, 0, ['#1f2a4e', '#324274']);
  ctx.fillRect(x - 12, 348, 24, b - 348);
  ctx.fillRect(x - 12, 338, 15, 10);
  ctx.fillRect(x - 6, 334, 6, 4);
  towerWindows(ctx, rng, x - 10.5, 352, 21, b, { rowH: 3.8, colW: 3, lit: 0.45, cool: 0.5 });
  ctx.fillStyle = 'rgba(160,200,255,0.25)';
  ctx.fillRect(x + 3, 348, 1, b - 348);
}

function messeturm(ctx, rng, x) {
  const b = FAR_BASE;
  ctx.fillStyle = grad(ctx, x - 13, 0, x + 13, 0, ['#3c2440', '#5c3852', '#714963']);
  ctx.fillRect(x - 13, 424, 26, b - 424);
  ctx.fillRect(x - 12, 300, 24, 124);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 8, 300, 1, b - 300);
  ctx.fillRect(x + 7, 300, 1, b - 300);
  towerWindows(ctx, rng, x - 11, 305, 22, b, { rowH: 4, colW: 2.75, lit: 0.55, cool: 0.08 });
  // Zylinder-Aufsatz mit Schlitzfenstern
  ctx.fillStyle = grad(ctx, x - 10, 0, x + 10, 0, ['#4a2d48', '#86587a', '#5a3852']);
  ctx.fillRect(x - 10, 287, 20, 13);
  ctx.fillStyle = 'rgba(255,214,150,0.6)';
  for (let i = -8; i <= 8; i += 3) ctx.fillRect(x + i - 0.4, 289, 0.9, 9);
  // Pyramidenspitze
  ctx.fillStyle = grad(ctx, x - 11, 0, x + 11, 0, ['#5a3550', '#956682', '#6a4060']);
  poly(ctx, [x - 11.5, 288, x, 259, x + 11.5, 288]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,210,0.22)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x, 259);
  ctx.lineTo(x + 3, 288);
  ctx.moveTo(x, 259);
  ctx.lineTo(x - 4, 288);
  ctx.stroke();
  ctx.fillStyle = '#3a2238';
  ctx.fillRect(x - 0.5, 253, 1, 7);
}

function tower185(ctx, rng, x) {
  const b = FAR_BASE;
  ctx.fillStyle = grad(ctx, x - 13, 0, x + 13, 0, ['#283058', '#3d4a7c']);
  ctx.fillRect(x - 13, 318, 26, b - 318);
  ctx.beginPath();
  ctx.moveTo(x, 318);
  ctx.lineTo(x, 312);
  ctx.quadraticCurveTo(x + 12, 309, x + 13, 318);
  ctx.fill();
  towerWindows(ctx, rng, x - 11.5, 322, 23, b, { rowH: 4, colW: 2.9, lit: 0.4, cool: 0.35 });
}

function opernturm(ctx, rng, x) {
  const b = FAR_BASE;
  ctx.fillStyle = grad(ctx, x - 14, 0, x + 14, 0, ['#433d62', '#615a80', '#544d73']);
  ctx.fillRect(x - 14, 340, 28, b - 340);
  ctx.fillStyle = '#3b3558';
  ctx.fillRect(x - 12, 336, 24, 4);
  towerWindows(ctx, rng, x - 12.5, 344, 25, b, { rowH: 4.4, colW: 3.1, lit: 0.6, cool: 0.05 });
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = -12; i <= 12; i += 6.2) ctx.fillRect(x + i, 340, 0.8, b - 340);
}

function mainTower(ctx, rng, x) {
  const b = FAR_BASE;
  const top = 308;
  ctx.fillStyle = grad(ctx, x - 24, 0, x - 9, 0, ['#2a2848', '#3f3c64']);
  ctx.fillRect(x - 24, 352, 15, b - 352);
  towerWindows(ctx, rng, x - 23, 356, 13, b, { rowH: 4.4, colW: 3, lit: 0.4, cool: 0.1 });
  const g = grad(ctx, x - 11, 0, x + 11, 0, ['#1d2b55', '#3a5694', '#7590c8', '#2c3f74']);
  ctx.fillStyle = g;
  ctx.fillRect(x - 11, top, 22, b - top);
  ctx.beginPath();
  ctx.ellipse(x, top, 11, 2.4, 0, Math.PI, 0);
  ctx.fill();
  for (let y = top + 4; y < b; y += 3.6) {
    if (!rng.chance(0.55)) continue;
    ctx.fillStyle = rng.chance(0.6) ? 'rgba(214,230,255,0.55)' : 'rgba(255,214,150,0.6)';
    ctx.fillRect(x - 10, y, 20, 1.3);
  }
  ctx.fillStyle = '#2b355e';
  ctx.fillRect(x - 12, top - 3, 24, 3);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? '#d8d8e6' : '#b8364a';
    ctx.fillRect(x - 0.9, top - 4 - (i + 1) * 5.6, 1.8, 5.6);
  }
}

function commerzbank(ctx, rng, x) {
  const b = FAR_BASE;
  const top = 262;
  ctx.fillStyle = grad(ctx, x - 16, 0, x + 16, 0, ['#1f2a50', '#2f3f70', '#43538c']);
  ctx.fillRect(x - 16, top, 32, b - top);
  // Eckkerne ragen über das Dach
  ctx.fillStyle = grad(ctx, x - 16, 0, x + 16, 0, ['#28305a', '#3c4878']);
  ctx.fillRect(x - 16, top - 10, 7, b - top + 10);
  ctx.fillRect(x + 9, top - 14, 7, b - top + 14);
  poly(ctx, [x - 9, top, x - 9, top - 4, x + 9, top - 9, x + 9, top]);
  ctx.fill();
  ctx.fillStyle = '#2a3358';
  ctx.fillRect(x + 11.6, top - 40, 1.8, 27);
  ctx.fillRect(x + 12.1, top - 52, 0.9, 12);
  towerWindows(ctx, rng, x - 8.5, top + 3, 17, b, { rowH: 3.8, colW: 2.6, lit: 0.6, cool: 0.45 });
  towerWindows(ctx, rng, x - 15, top - 6, 5, b, { rowH: 3.8, colW: 2.5, lit: 0.3, cool: 0.2 });
  towerWindows(ctx, rng, x + 10, top - 10, 5, b, { rowH: 3.8, colW: 2.5, lit: 0.3, cool: 0.2 });
  // Himmelsgärten: grünlich schimmernde Glasfelder, spiralförmig versetzt
  for (let y = top + 18, i = 0; y < b - 30; y += 34, i++) {
    const gx = [x - 9, x - 4.5, x][i % 3];
    ctx.fillStyle = 'rgba(120,200,160,0.16)';
    ctx.fillRect(gx, y, 9, 11);
    ctx.fillStyle = 'rgba(70,140,100,0.35)';
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(gx + 1.5 + k * 2.1, y + 10.2, 1.1 + ((i + k) % 2) * 0.5, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(190,240,200,0.3)';
    ctx.fillRect(gx, y, 9, 0.6);
  }
  ctx.fillStyle = 'rgba(255,190,150,0.18)';
  ctx.fillRect(x + 15, top - 14, 1, b - top + 14);
}

function trianon(ctx, rng, x) {
  const b = FAR_BASE;
  const top = 322;
  ctx.fillStyle = grad(ctx, x - 11, 0, x + 11, 0, ['#2b2f58', '#444a7c']);
  ctx.fillRect(x - 11, top, 22, b - top);
  // Krone: auskragender Dachrahmen mit Einschnitt
  poly(ctx, [x - 14, top - 16, x + 14, top - 16, x + 11, top, x - 11, top]);
  ctx.fill();
  ctx.fillStyle = 'rgba(12,14,40,0.7)';
  poly(ctx, [x - 8, top - 13, x + 8, top - 13, x, top - 2]);
  ctx.fill();
  ctx.fillStyle = '#3a3f6c';
  ctx.fillRect(x - 0.5, top - 22, 1, 6);
  towerWindows(ctx, rng, x - 9.5, top + 3, 19, b, { rowH: 3.9, colW: 2.8, lit: 0.5, cool: 0.3 });
}

function kaiserdom(ctx, x) {
  const b = FAR_BASE;
  glow(ctx, x, 420, 46, 'rgba(255,170,110,0.32)');
  ellipseGlow(ctx, x - 26, 472, 60, 16, 'rgba(255,180,100,0.5)');
  for (let sx = x - 62; sx < x + 14; sx += 3) {
    bulb(ctx, ['255,90,80', '255,214,120', '120,210,130'][Math.floor(sx) % 3], sx, 469 + Math.sin(sx * 0.5) * 1.2, 2, 0.45, 0.4);
  }
  ctx.fillStyle = '#4c3044';
  poly(ctx, [x - 36, b, x - 36, 456, x - 22, 446, x - 8, 456, x - 8, b]);
  ctx.fill();
  const c = grad(ctx, x - 9, 0, x + 9, 0, ['#7c4640', '#c27c60', '#94564a']);
  ctx.fillStyle = c;
  ctx.fillRect(x - 9, 434, 18, b - 434);
  ctx.fillRect(x - 7, 410, 14, 24);
  ctx.beginPath();
  ctx.moveTo(x - 7.5, 411);
  ctx.quadraticCurveTo(x - 7.5, 393, x, 386);
  ctx.quadraticCurveTo(x + 7.5, 393, x + 7.5, 411);
  ctx.fill();
  ctx.fillRect(x - 1.6, 380, 3.2, 7);
  ctx.fillRect(x - 0.4, 371, 0.8, 10);
  ctx.fillStyle = 'rgba(40,20,30,0.6)';
  for (const [wx, wy, ww, wh] of [[-5, 440, 3, 12], [2, 440, 3, 12], [-4, 415, 2, 10], [2, 415, 2, 10]]) {
    ctx.fillRect(x + wx, wy, ww, wh);
  }
  ctx.fillStyle = 'rgba(255,214,170,0.35)';
  ctx.fillRect(x - 9, 432, 18, 1.4);
  ctx.fillRect(x - 7.5, 409, 15, 1.2);
}

function marketAndWheel(ctx, rng) {
  const { x, y, r } = WHEEL;
  ellipseGlow(ctx, x, 470, 90, 26, 'rgba(255,170,90,0.55)');
  // Stände mit Lichtern
  for (let sx = x - 54; sx < x + 64; sx += rng.range(9, 14)) {
    ctx.fillStyle = '#3a2840';
    poly(ctx, [sx, 474, sx + 5, 466, sx + 10, 474]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,200,120,0.9)';
    ctx.fillRect(sx + 1.5, 474, 7, 3);
  }
  for (let sx = x - 56; sx < x + 66; sx += 3) {
    const c = ['255,90,80', '255,214,120', '120,210,130', '120,180,255'][Math.floor(sx) % 4];
    bulb(ctx, c, sx, 466 + Math.sin(sx * 0.4) * 1.2, 2.2, 0.5, 0.45);
  }
  // Riesenrad-Gestell (Speichen und Lichter laufen in drawDynamic)
  ctx.strokeStyle = 'rgba(70,60,100,0.95)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 11, 476);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 11, 476);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,180,0.25)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}

function ezb(ctx, rng, x) {
  const b = FAR_BASE;
  ctx.fillStyle = grad(ctx, x - 20, 0, x + 18, 0, ['#2c3762', '#5a68a0', '#34406e']);
  poly(ctx, [x - 20, b, x - 20, 332, x - 4, 324, x - 4, b]);
  ctx.fill();
  poly(ctx, [x - 1, b, x - 1, 336, x + 18, 344, x + 16, b]);
  ctx.fill();
  ctx.fillStyle = 'rgba(200,220,255,0.3)';
  ctx.fillRect(x - 4, 362, 3, b - 362);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let y = 340; y < b; y += 14) {
    ctx.moveTo(x - 20, y + 6);
    ctx.lineTo(x - 4, y);
    ctx.moveTo(x - 1, y);
    ctx.lineTo(x + 17, y + 6);
  }
  ctx.stroke();
  towerWindows(ctx, rng, x - 19, 334, 14, b, { rowH: 4, colW: 2.8, lit: 0.3, cool: 0.8 });
  towerWindows(ctx, rng, x, 346, 15, b, { rowH: 4, colW: 2.8, lit: 0.3, cool: 0.8 });
}

function henninger(ctx, rng, x) {
  const b = FAR_BASE;
  ctx.fillStyle = grad(ctx, x - 11, 0, x + 11, 0, ['#2e2e58', '#4a4a7e']);
  ctx.fillRect(x - 6, 372, 12, b - 372);
  rrect(ctx, x - 11, 350, 22, 22, 5);
  ctx.fill();
  ctx.fillRect(x - 0.6, 336, 1.2, 15);
  ctx.fillStyle = 'rgba(255,214,140,0.85)';
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(x - 9.5 + i * 3, 356, 1.6, 2.2);
    ctx.fillRect(x - 9.5 + i * 3, 363, 1.6, 2.2);
  }
  towerWindows(ctx, rng, x - 5, 376, 10, b, { rowH: 4, colW: 2.5, lit: 0.4, cool: 0.2 });
}

function paintFar(ctx, w, rng) {
  // Taunus: hintere, dunstige Kette mit Großem Feldberg
  ridge(ctx, ridgePts(rng, [[-20, 436], [110, 410], [250, 394], [380, 378], [470, 392], [600, 404], [760, 422], [940, 436], [1150, 446], [1400, 446], [1600, 440], [1820, 446]], 3),
    grad(ctx, 0, 378, 0, 472, ['#6c5a8e', '#97769a']));
  ctx.fillStyle = '#5c4b7e';
  ctx.fillRect(379.4, 350, 1.2, 30);
  ctx.fillRect(376.5, 364, 6, 3);
  ridge(ctx, ridgePts(rng, [[-20, 448], [90, 432], [210, 424], [330, 432], [450, 422], [560, 434], [700, 442], [900, 450], [1200, 458], [1500, 454], [1700, 448], [1820, 452]], 2.5),
    grad(ctx, 0, 420, 0, 478, ['#463c6e', '#5d4c7c']));
  ctx.fillStyle = grad(ctx, 0, 396, 0, 478, ['rgba(255,170,120,0)', 'rgba(255,165,110,0.34)']);
  ctx.fillRect(-10, 396, w + 20, 82);
  ctx.fillStyle = '#28264e';
  ctx.fillRect(-10, FAR_BASE - 1, w + 20, 720 - FAR_BASE + 1);

  cityBand(ctx, rng, w, { hMin: 4, hMax: 14, colors: ['#3a3462', '#3e3866', '#352f5c'], lights: 0.35, boost: 30 });

  // Hintere Hochhausreihe, etwas dunstiger
  for (const [x, bw, top, roof] of [
    [140, 14, 432, 'flat'], [330, 16, 426, 'step'], [470, 16, 410, 'flat'], [540, 20, 382, 'slant'],
    [622, 18, 374, 'flat'], [706, 16, 392, 'round'], [800, 20, 364, 'flat'], [878, 18, 376, 'step'],
    [958, 16, 370, 'flat'], [1042, 20, 360, 'flat'], [1104, 16, 384, 'slant'], [1214, 20, 380, 'flat'],
    [1262, 14, 404, 'step'], [1426, 16, 410, 'flat'], [1562, 18, 398, 'round'], [1722, 16, 420, 'flat'],
  ]) {
    farTower(ctx, rng, { x, w: bw, top, roof, c1: '#343568', c2: '#4a4a80', lit: 0.3, cool: 0.3 });
  }

  europaturm(ctx, 255);
  westendGate(ctx, rng, 585);
  messeturm(ctx, rng, 662);
  tower185(ctx, rng, 752);
  opernturm(ctx, rng, 842);
  mainTower(ctx, rng, 912);
  commerzbank(ctx, rng, 1000);
  trianon(ctx, rng, 1078);
  farTower(ctx, rng, { x: 1122, w: 18, top: 338, roof: 'step', c1: '#252c55', c2: '#3c4678', lit: 0.5 });
  farTower(ctx, rng, { x: 1168, w: 22, top: 352, roof: 'round', c1: '#4a5078', c2: '#737ba4', lit: 0.45, cool: 0.6 });
  farTower(ctx, rng, { x: 800 - 30, w: 14, top: 400, c1: '#262a50', c2: '#3a3f70' });
  kaiserdom(ctx, 1302);
  marketAndWheel(ctx, rng);
  ezb(ctx, rng, 1495);
  henninger(ctx, rng, 1604);

  // Vordere Dächer (Niederrad, Sachsenhausen)
  cityBand(ctx, rng, w, { hMin: 3, hMax: 9, colors: ['#2a2750', '#2e2b56', '#26244a'], lights: 0.5, boost: 6 });
  ctx.fillStyle = grad(ctx, 0, 440, 0, 480, ['rgba(255,170,110,0)', 'rgba(255,170,110,0.16)']);
  ctx.fillRect(-10, 440, w + 20, 40);
  // Schneedunst legt die Ferne zurück (weich auslaufend, keine Kante)
  ctx.fillStyle = grad(ctx, 0, 300, 0, 480, ['rgba(185,190,235,0)', 'rgba(185,190,235,0.1)']);
  ctx.fillRect(-10, 300, w + 20, 180);
}

// --- Ebene mid: Flughafen ---

function forestStrip(ctx, rng, w, y) {
  ctx.fillStyle = '#20264a';
  ctx.fillRect(-10, y, w + 20, 14);
  for (let x = -10; x < w + 10; x += rng.range(3.5, 7)) {
    const h = rng.range(8, 22);
    ctx.fillStyle = rng.chance(0.5) ? '#1c2244' : '#252b52';
    ctx.beginPath();
    ctx.moveTo(x - h * 0.32, y + 4);
    ctx.lineTo(x, y + 4 - h);
    ctx.lineTo(x + h * 0.32, y + 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(205,212,245,0.55)';
    ctx.beginPath();
    ctx.moveTo(x - h * 0.13, y + 4 - h * 0.58);
    ctx.lineTo(x, y + 4 - h);
    ctx.lineTo(x + h * 0.13, y + 4 - h * 0.58);
    ctx.fill();
  }
  ctx.fillStyle = grad(ctx, 0, y + 8, 0, y + 18, ['rgba(32,38,74,1)', 'rgba(32,38,74,0)']);
  ctx.fillRect(-10, y + 8, w + 20, 10);
}

function midGround(ctx, rng, w) {
  ctx.fillStyle = grad(ctx, 0, 470, 0, 508, ['#7c84b6', '#a8b0d8']);
  ctx.fillRect(-10, 470, w + 20, 40);
  forestStrip(ctx, rng, w, 474);
  // Befeuerung der fernen Parallelbahn
  for (let x = 8; x < w; x += 18) bulb(ctx, '255,236,200', x, 497, 2.6, 0.45, 0.5);

  // Vorfeld (nass glänzender Beton)
  ctx.fillStyle = grad(ctx, 0, 506, 0, 548, ['#474d70', '#596084', '#646b90']);
  ctx.fillRect(-10, 506, w + 20, 42);
  ctx.strokeStyle = 'rgba(20,24,44,0.35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = 0; x < w; x += 46) {
    ctx.moveTo(x, 512);
    ctx.lineTo(x - 8, 548);
  }
  ctx.moveTo(-10, 528);
  ctx.lineTo(w + 10, 528);
  ctx.stroke();
  // Rollgassen-Mittellinie
  ctx.fillStyle = 'rgba(255,205,60,0.55)';
  ctx.fillRect(-10, 538, w + 20, 0.9);
  // Pfützen-/Nässe-Spiegelungen
  ctx.fillStyle = 'rgba(200,210,255,0.06)';
  for (let i = 0; i < 40; i++) ctx.fillRect(rng.range(0, w), rng.range(530, 546), rng.range(20, 80), 0.8);

  // Schneestreifen + Rollweg
  ctx.fillStyle = SNOW;
  ctx.fillRect(-10, 547, w + 20, 3);
  ctx.fillStyle = grad(ctx, 0, 549, 0, 563, ['#2e334e', '#3a405e']);
  ctx.fillRect(-10, 549, w + 20, 14);
  ctx.fillStyle = 'rgba(255,205,60,0.75)';
  ctx.fillRect(-10, TWY_Y - 0.4, w + 20, 0.8);
  for (let x = 4; x < w; x += 14) bulb(ctx, '110,230,140', x, TWY_Y, 1.8, 0.35, 0.4);
  ctx.fillStyle = 'rgba(230,236,255,0.25)';
  for (let i = 0; i < 60; i++) ctx.fillRect(rng.range(0, w), rng.range(550, 562), rng.range(6, 30), 0.6);

  // Schneefeld zwischen Rollweg und Piste
  ctx.fillStyle = grad(ctx, 0, 563, 0, 588, ['#aeb6dc', '#c4cae8']);
  ctx.fillRect(-10, 563, w + 20, 25);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 70; i++) ctx.fillRect(rng.range(0, w), rng.range(566, 586), rng.range(10, 50), 0.7);
  // Blaue Rollweg-Randfeuer
  for (let x = 10; x < w; x += 30) {
    bulb(ctx, '80,140,255', x, 549, 5, 0.65, 0.8);
    bulb(ctx, '80,140,255', x + 15, 564, 5.5, 0.7, 0.9);
  }

  // Piste 25C
  const { x1, x2, y, half } = RWY;
  ctx.fillStyle = '#3e435e';
  ctx.fillRect(x1 - 8, y - half - 3, x2 - x1 + 16, half * 2 + 6);
  ctx.fillStyle = grad(ctx, 0, y - half, 0, y + half, ['#24283e', '#2e334b']);
  ctx.fillRect(x1, y - half, x2 - x1, half * 2);
  ctx.fillStyle = 'rgba(10,10,20,0.3)';
  for (let i = 0; i < 26; i++) ctx.fillRect(rng.range(x2 - 520, x2 - 120), y - rng.range(-4, 5), rng.range(20, 60), rng.range(1.5, 3));
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  // Mittellinie erst hinter den Pistenkennungen beginnen lassen
  for (let x = x1 + 104; x < x2 - 128; x += 46) ctx.fillRect(x, y - 0.6, 24, 1.2);
  ctx.globalAlpha = 0.65;
  ctx.fillRect(x1, y - half + 1, x2 - x1, 0.8);
  ctx.fillRect(x1, y + half - 1.8, x2 - x1, 0.8);
  ctx.globalAlpha = 1;
  // Schwellen, Aufsetzzonen, Zielpunkte
  for (const sx of [x1 + 6, x2 - 34]) for (let i = 0; i < 6; i++) ctx.fillRect(sx + i * 5, y - half + 2, 3, half * 2 - 4);
  for (const [tx, n] of [[x2 - 150, 3], [x2 - 230, 2], [x2 - 310, 2], [x1 + 150, 3], [x1 + 230, 2]]) {
    for (let i = 0; i < n; i++) {
      ctx.fillRect(tx + i * 7, y - half + 2.5, 4, 3);
      ctx.fillRect(tx + i * 7, y + half - 5.5, 4, 3);
    }
  }
  ctx.fillRect(x2 - 420, y - half + 2, 34, 4);
  ctx.fillRect(x2 - 420, y + half - 6, 34, 4);
  ctx.fillRect(x1 + 330, y - half + 2, 34, 4);
  ctx.fillRect(x1 + 330, y + half - 6, 34, 4);
  // Pistenkennung, flach perspektivisch
  for (const [tx, txt] of [[x2 - 74, '25C'], [x1 + 70, '07C']]) {
    ctx.save();
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.translate(tx, y + 0.5);
    ctx.scale(1.25, 0.6);
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  }
  // Verwehter Schnee über der Piste
  ctx.fillStyle = 'rgba(235,240,255,0.22)';
  for (let i = 0; i < 90; i++) {
    ctx.beginPath();
    ctx.ellipse(rng.range(x1, x2), y + rng.range(-half + 2, half - 2), rng.range(10, 40), rng.range(0.5, 1.4), 0, 0, TAU);
    ctx.fill();
  }

  // Schneewälle entlang der Pistenränder
  for (let x = x1 - 20; x < x2 + 20; x += rng.range(18, 34)) {
    snowMound(ctx, x, y - half - 2, rng.range(26, 50), rng.range(3, 6));
  }

  // Schneefeld vorne
  ctx.fillStyle = grad(ctx, 0, y + half + 3, 0, 720, ['#b7bfe2', '#c9cfec', '#d6dbf1']);
  ctx.fillRect(-10, y + half + 3, w + 20, 720 - y - half - 3);
  for (let x = x1 - 20; x < x2 + 20; x += rng.range(20, 40)) {
    snowMound(ctx, x, y + half + 8, rng.range(30, 56), rng.range(3, 6), '#e6ebfb', '#bcc4e6');
  }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 120; i++) ctx.fillRect(rng.range(0, w), rng.range(622, 720), rng.range(10, 60), 0.8);
  ctx.strokeStyle = 'rgba(120,130,180,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, 646);
  ctx.bezierCurveTo(600, 640, 1200, 652, 2410, 644);
  ctx.moveTo(-10, 650);
  ctx.bezierCurveTo(600, 644, 1200, 656, 2410, 648);
  ctx.stroke();

  // Pistenrand- und Schwellenfeuer
  for (let x = x1; x <= x2; x += 32) {
    bulb(ctx, '255,244,220', x, y - half - 1, 4, 0.55, 0.7);
    bulb(ctx, '255,244,220', x + 16, y + half + 1, 4.5, 0.6, 0.8);
  }
  for (let k = 0; k <= 5; k++) {
    bulb(ctx, '90,255,140', x2 + 2, y - half + k * 4.4, 4, 0.7, 0.8);
    bulb(ctx, '255,70,60', x1 - 2, y - half + k * 4.4, 4, 0.7, 0.8);
  }
  // PAPI links der Aufsetzzone
  for (let i = 0; i < 4; i++) {
    const px = x2 - 196 + i * 9;
    ctx.fillStyle = '#20243a';
    ctx.fillRect(px - 3, y + half + 6, 6, 4);
    bulb(ctx, i < 2 ? '255,250,240' : '255,60,60', px, y + half + 7, 4.5, 0.85, 1);
  }
  // Landekurssender am Westende
  ctx.fillStyle = '#4a4f6c';
  for (let i = 0; i < 12; i++) ctx.fillRect(30 + i * 7, y - 9, 1.3, 9);
  ctx.fillRect(28, y - 10, 82, 1.4);
  for (let i = 0; i < 12; i += 3) bulb(ctx, '255,60,50', 30.6 + i * 7, y - 11, 3, 0.7, 0.6);
  // Anflugbefeuerung (statische Lampen, Lauflicht in drawDynamic)
  for (let x = x2 + 14; x < 2400; x += 14) {
    const k = (x - x2) / 140;
    ctx.fillStyle = '#3a3f5a';
    ctx.fillRect(x - 0.6, y - 1, 1.2, 8 + k * 8);
    ctx.fillRect(x - 3, y - 1.5, 6, 1.2);
    bulb(ctx, '255,250,235', x, y - 1.5, 3.5, 0.45, 0.6);
  }

  // Schilder an den Haltepunkten
  ctx.font = `700 6px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [sx, txt, red] of [[260, '25C-07C', true], [292, 'N2', false], [820, 'B', false], [1360, '25C-07C', true], [1392, 'N7', false], [1960, 'S', false], [2200, '25C-07C', true]]) {
    const sw = red ? 30 : 13;
    ctx.fillStyle = '#2a2d3e';
    ctx.fillRect(sx - sw / 2 + 2, 578, 1, 5);
    ctx.fillRect(sx + sw / 2 - 3, 578, 1, 5);
    ctx.fillStyle = red ? '#c8202a' : '#f2c400';
    ctx.fillRect(sx - sw / 2, 570, sw, 8);
    flare(ctx, red ? '255,80,80' : '255,220,90', sx, 574, sw * 0.8, 0.25);
    ctx.fillStyle = red ? '#ffffff' : '#111111';
    ctx.fillText(txt, sx, 574.4);
    ctx.fillStyle = SNOW;
    ctx.fillRect(sx - sw / 2 - 0.5, 569, sw + 1, 1.3);
  }
}

function lightMast(ctx, x, base = 512, top = 398) {
  ctx.fillStyle = grad(ctx, 0, top, 0, 548, ['rgba(255,214,150,0.15)', 'rgba(255,214,150,0.02)']);
  poly(ctx, [x - 8, top + 4, x + 8, top + 4, x + 52, 548, x - 52, 548]);
  ctx.fill();
  ellipseGlow(ctx, x, 536, 70, 14, 'rgba(255,205,140,0.45)');
  ctx.fillStyle = grad(ctx, x - 2.4, 0, x + 2.4, 0, ['#3a4060', '#7a81a6']);
  poly(ctx, [x - 2.4, base, x - 1.2, top, x + 1.2, top, x + 2.4, base]);
  ctx.fill();
  ctx.fillStyle = '#272c46';
  ctx.fillRect(x - 10, top - 3, 20, 6);
  snowCap(ctx, x - 10, top - 3, 20, 2.2, SNOW);
  for (let i = 0; i < 4; i++) bulb(ctx, WARM, x - 7 + i * 4.7, top + 3.2, 7, 0.75, 1.1);
}

function depot(ctx, rng) {
  const { x1, x2, top, base } = DEPOT;
  ctx.fillStyle = grad(ctx, 0, top, 0, base, ['#4b5276', '#3a4062']);
  ctx.fillRect(x1, top, x2 - x1, base - top);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x1 + 4; x < x2; x += 5) {
    ctx.moveTo(x, top + 4);
    ctx.lineTo(x, base);
  }
  ctx.stroke();
  // Tore: zwei offen, eins zu
  for (let i = 0; i < 3; i++) {
    const dx = x1 + 14 + i * 62;
    if (i < 2) {
      ctx.fillStyle = grad(ctx, 0, 482, 0, base, ['#ffe2a8', '#f0b36a']);
      ctx.fillRect(dx, 482, 46, base - 482);
      ctx.fillStyle = 'rgba(60,40,40,0.75)';
      ctx.fillRect(dx + 6, 494, 30, 10);
      ctx.fillRect(dx + 26, 489, 10, 6);
      ctx.fillStyle = '#ff9a2a';
      ctx.fillRect(dx + 8, 492, 16, 3);
    } else {
      ctx.fillStyle = '#5d6488';
      ctx.fillRect(dx, 482, 46, base - 482);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let y = 484; y < base; y += 3) ctx.fillRect(dx, y, 46, 0.6);
    }
    ctx.fillStyle = '#2a2f4a';
    ctx.fillRect(dx - 2, 480, 50, 2);
    bulb(ctx, WARM, dx + 23, 478, 7, 0.7, 1);
  }
  ctx.fillStyle = '#1e5aa8';
  ctx.fillRect(x1 + 60, top + 3, 78, 8);
  ctx.font = `700 6px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('WINTERDIENST', x1 + 99, top + 7.4);
  snowCap(ctx, x1 - 3, top, x2 - x1 + 6, 4.5, SNOW);
  for (let x = x1 + 2; x < x2; x += rng.range(12, 22)) {
    ctx.fillStyle = 'rgba(230,240,255,0.85)';
    ctx.fillRect(x, top, 1.2, rng.range(2, 6));
  }
}

function terminal(ctx, rng) {
  const { x1, x2, top, base } = HALL;
  const H = HALL_HEAD;
  // Glasfassade mit warm erleuchteter Halle
  ctx.fillStyle = grad(ctx, 0, top + 10, 0, base, ['#f8cd84', '#f1ac62', '#e39452']);
  ctx.fillRect(x1, top + 10, x2 - x1, base - top - 10);
  ctx.fillStyle = grad(ctx, 0, H.top + 12, 0, top + 12, ['#fbd796', '#f8cd84']);
  ctx.fillRect(H.x1, H.top + 12, H.x2 - H.x1, top - H.top);
  // Deckenleuchten und Galerie
  ctx.fillStyle = 'rgba(120,70,40,0.35)';
  ctx.fillRect(x1, top + 10, x2 - x1, 4);
  ctx.fillRect(x1, 452, x2 - x1, 2.4);
  for (let x = x1 + 6; x < x2; x += 11) {
    bulb(ctx, '255,248,225', x, top + 16, 3, 0.5, 0.7);
  }
  for (let x = H.x1 + 8; x < H.x2; x += 14) bulb(ctx, '255,248,225', x, H.top + 18, 3.5, 0.55, 0.8);
  // Menschen auf der Galerie
  for (let x = x1 + 10; x < x2 - 10; x += rng.range(8, 30)) {
    const ph = rng.range(5.5, 7.5);
    ctx.fillStyle = rng.pick(['rgba(70,40,40,0.75)', 'rgba(40,40,70,0.7)', 'rgba(90,50,30,0.7)']);
    ctx.fillRect(x - 1, 452 - ph, 2.2, ph - 1.6);
    ctx.beginPath();
    ctx.arc(x + 0.1, 452 - ph - 1, 1.2, 0, TAU);
    ctx.fill();
  }
  // Ladenschilder auf der Galerie
  for (let x = x1 + 30; x < x2 - 30; x += rng.range(50, 110)) {
    ctx.fillStyle = rng.pick(['#c8283a', '#2f8a55', '#2a6ab8', '#7a3a9a', '#e8742a']);
    ctx.fillRect(x, 455, rng.range(10, 18), 3);
  }
  // Abflugtafel
  ctx.fillStyle = '#14161f';
  ctx.fillRect(812, 441, 76, 10);
  ctx.fillStyle = 'rgba(255,205,60,0.9)';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) if (rng.chance(0.8)) ctx.fillRect(815 + c * 8, 443 + r * 2.8, rng.range(3, 6.5), 1.2);
  // Herrnhuter Sterne in der Halle
  for (let x = x1 + 60; x < x2; x += 120) {
    const big = x > H.x1 && x < H.x2;
    const sy = big ? 424 : 438;
    ctx.fillStyle = 'rgba(80,50,40,0.5)';
    ctx.fillRect(x - 0.3, big ? H.top + 14 : top + 10, 0.6, sy - (big ? H.top + 14 : top + 10));
    starShape(ctx, x, sy + 4, big ? 6 : 4.4, rng.pick(['#fff6e0', '#ff5a4a', '#ffd65a']));
  }
  // Pfosten, Riegel, Stützen
  ctx.fillStyle = 'rgba(38,44,78,0.85)';
  for (let x = x1; x <= x2; x += 20) ctx.fillRect(x - 0.6, H.top, 1.2, base - H.top);
  for (let x = x1; x <= x2; x += 120) ctx.fillRect(x - 2, top, 4, base - top);
  ctx.fillRect(x1, 440, x2 - x1, 1);
  ctx.fillRect(x1, 462, x2 - x1, 1);
  ctx.fillRect(H.x1, 412, H.x2 - H.x1, 1);
  // Spiegelungen des Abendhimmels auf dem Glas
  ctx.save();
  ctx.beginPath();
  ctx.rect(x1, H.top, x2 - x1, base - H.top);
  ctx.clip();
  ctx.fillStyle = 'rgba(110,120,210,0.16)';
  for (let x = x1 - 60; x < x2; x += rng.range(70, 140)) {
    poly(ctx, [x, base, x + 40, H.top, x + 62, H.top, x + 22, base]);
    ctx.fill();
  }
  ctx.restore();
  // Dachblenden
  ctx.fillStyle = grad(ctx, 0, top, 0, top + 10, ['#2c3254', '#22283f']);
  ctx.fillRect(x1 - 6, top, x2 - x1 + 12, 10);
  ctx.fillStyle = grad(ctx, 0, H.top, 0, H.top + 14, ['#30375c', '#22283f']);
  ctx.fillRect(H.x1 - 6, H.top, H.x2 - H.x1 + 12, 14);
  ctx.fillStyle = 'rgba(150,160,220,0.35)';
  ctx.fillRect(x1 - 6, top + 9.4, x2 - x1 + 12, 0.6);
  ctx.fillRect(H.x1 - 6, H.top + 13.4, H.x2 - H.x1 + 12, 0.6);
  // Schriftzug
  ctx.font = `700 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = (H.x1 + H.x2) / 2;
  ellipseGlow(ctx, cx, H.top + 7, 90, 10, 'rgba(255,230,170,0.35)');
  ctx.fillStyle = '#fff1cc';
  ctx.fillText('F L U G H A F E N   F R A N K F U R T', cx, H.top + 7.5);
  ctx.font = `600 6.5px ${FONT}`;
  ctx.fillStyle = '#e8ecff';
  ctx.fillText('TERMINAL 1', x1 + 46, top + 5.3);
  ctx.fillText('TERMINAL 1', x2 - 46, top + 5.3);
  // Dachaufbauten mit Schnee
  for (const [bx, bw, bh] of [[300, 26, 7], [470, 14, 5], [1180, 30, 8], [1340, 18, 6]]) {
    ctx.fillStyle = '#353b5e';
    ctx.fillRect(bx, top - bh, bw, bh);
    snowCap(ctx, bx - 1, top - bh, bw + 2, 2.5, SNOW);
  }
  snowCap(ctx, x1 - 7, top, H.x1 - x1 + 2, 4.5, SNOW);
  snowCap(ctx, H.x2 + 5, top, x2 - H.x2 + 2, 4.5, SNOW);
  snowCap(ctx, H.x1 - 7, H.top, H.x2 - H.x1 + 14, 5, SNOW);
  // Eiszapfen an der Blende
  ctx.fillStyle = 'rgba(225,235,255,0.75)';
  for (let x = x1 - 4; x < x2 + 4; x += rng.range(5, 14)) {
    const l = rng.range(1, 4);
    const yy = x > H.x1 - 6 && x < H.x2 + 6 ? H.top + 14 : top + 10;
    poly(ctx, [x - 0.6, yy, x + 0.6, yy, x, yy + l]);
    ctx.fill();
  }
}

// Herrnhuter Stern (2D-Andeutung) mit Hof
function starShape(ctx, x, y, r, color) {
  glow(ctx, x, y, r * 3, 'rgba(255,240,200,0.45)');
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const rr = i % 2 ? r * 0.38 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, TAU);
  ctx.fill();
}

function pier(ctx, rng) {
  const { x1, x2, top, base } = PIER;
  ctx.fillStyle = grad(ctx, 0, top + 4, 0, base, ['#f6efdc', '#e6d6b2', '#d2b98c']);
  ctx.fillRect(x1, top + 4, x2 - x1, base - top - 4);
  // Wartende Passagiere
  for (let x = x1 + 6; x < x2 - 6; x += rng.range(4, 12)) {
    const ph = rng.range(6, 9);
    ctx.fillStyle = rng.pick(['rgba(70,40,40,0.65)', 'rgba(40,40,70,0.6)', 'rgba(110,50,40,0.55)']);
    ctx.fillRect(x - 1, 506 - ph, 2.2, ph);
    ctx.beginPath();
    ctx.arc(x + 0.1, 506 - ph - 1, 1.25, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(38,44,78,0.8)';
  for (let x = x1; x <= x2; x += 14) ctx.fillRect(x - 0.5, top, 1, base - top);
  ctx.fillRect(x1, 490, x2 - x1, 0.8);
  ctx.fillStyle = '#222740';
  ctx.fillRect(x1, base - 5, x2 - x1, 5);
  ctx.fillStyle = grad(ctx, 0, top, 0, top + 5, ['#2c3254', '#20253c']);
  ctx.fillRect(x1 - 3, top, x2 - x1 + 6, 5);
  snowCap(ctx, x1 - 4, top, x2 - x1 + 8, 3.5, SNOW);
  // Spiegelungen auf dem nassen Vorfeld
  ctx.fillStyle = grad(ctx, 0, base, 0, base + 30, ['rgba(255,200,130,0.22)', 'rgba(255,200,130,0)']);
  ctx.fillRect(x1, base, x2 - x1, 30);
}

function jetBridge(ctx, gx) {
  const rx = gx - 102;
  const ex = gx - 44;
  // Rotunde
  ctx.fillStyle = grad(ctx, rx - 7, 0, rx + 7, 0, ['#6c7392', '#a9aec4', '#7d839f']);
  ctx.fillRect(rx - 6, 479, 12, 33);
  ctx.fillStyle = '#4b5170';
  ctx.fillRect(rx - 8, 476, 16, 4);
  snowCap(ctx, rx - 8, 476, 16, 2.2, SNOW);
  // Tunnel, zum Flugzeug hin abfallend
  const drop = 17;
  const x0 = rx + 4;
  const len = ex - x0;
  const yAt = (x) => drop * ((x - x0) / len);
  ctx.fillStyle = grad(ctx, 0, 482, 0, 510, ['#c9cddc', '#9aa0b8']);
  poly(ctx, [x0, 482, ex, 482 + drop, ex, 493 + drop, x0, 493]);
  ctx.fill();
  // Unterkante im Schatten für Volumen
  ctx.fillStyle = 'rgba(40,46,78,0.45)';
  poly(ctx, [x0, 490.5, ex, 490.5 + drop, ex, 493 + drop, x0, 493]);
  ctx.fill();
  // Fensterband mit warm erleuchteten Scheiben
  ctx.fillStyle = 'rgba(28,34,62,0.9)';
  poly(ctx, [x0 + 2, 484.4, ex - 8, 484.4 + yAt(ex - 8), ex - 8, 488.6 + yAt(ex - 8), x0 + 2, 488.6]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,150,0.9)';
  for (let x = x0 + 3.5; x < ex - 10; x += 4.2) ctx.fillRect(x, 485 + yAt(x + 1), 2.4, 2.8);
  // Segmentfugen des Teleskoptunnels
  ctx.strokeStyle = 'rgba(60,66,96,0.55)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (const k of [0.36, 0.68]) {
    const x = x0 + len * k;
    ctx.moveTo(x, 482 + drop * k);
    ctx.lineTo(x, 493 + drop * k);
  }
  ctx.stroke();
  ctx.strokeStyle = SNOW;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x0, 481.6);
  ctx.lineTo(ex, 481.6 + drop);
  ctx.stroke();
  // Kabine mit Faltenbalg am Flugzeugende
  const cy = 482 + drop;
  ctx.fillStyle = grad(ctx, 0, cy - 2, 0, cy + 13, ['#8d93ad', '#6a7090']);
  ctx.fillRect(ex - 8, cy - 2, 9, 14);
  ctx.fillStyle = 'rgba(255,214,150,0.85)';
  ctx.fillRect(ex - 6.5, cy + 1.5, 3.2, 3);
  ctx.fillStyle = '#1d2133';
  for (let i = 0; i < 3; i++) ctx.fillRect(ex + 1 + i * 1.6, cy - 1.2 + i * 0.3, 1, 12.4 - i * 0.6);
  snowCap(ctx, ex - 8.5, cy - 2, 10, 1.6, SNOW);
  // Fahrwerksstütze
  const sx = gx - 72;
  ctx.fillStyle = '#4a5070';
  ctx.fillRect(sx - 1.2, 504, 2.4, 14);
  ctx.fillRect(sx - 5, 516, 10, 2);
  ctx.fillStyle = '#161a2a';
  ctx.beginPath();
  ctx.arc(sx - 3, 519.5, 2.2, 0, TAU);
  ctx.arc(sx + 3, 519.5, 2.2, 0, TAU);
  ctx.fill();
}

function xmasTree(ctx, rng) {
  const { x, base, h } = XTREE;
  ellipseGlow(ctx, x, base + 6, 70, 14, 'rgba(255,200,130,0.5)');
  glow(ctx, x, base - h * 0.5, h * 0.75, 'rgba(255,200,120,0.18)');
  ctx.fillStyle = '#4a2f22';
  ctx.fillRect(x - 3, base - 12, 6, 12);
  const tiers = 7;
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1);
    const ty = base - 8 - k * (h - 24);
    const tw = h * 0.4 * (1 - k * 0.82);
    const th = h * 0.26;
    ctx.fillStyle = grad(ctx, x - tw, 0, x + tw, 0, ['#0c2e24', '#16503a', '#1f6446']);
    ctx.beginPath();
    ctx.moveTo(x, ty - th);
    ctx.quadraticCurveTo(x - tw * 0.4, ty - th * 0.45, x - tw, ty);
    const n = Math.max(3, Math.round(tw / 5));
    for (let j = 1; j <= n; j++) {
      const px = x - tw + (2 * tw * j) / n;
      ctx.quadraticCurveTo(px - tw / n, ty + 3, px, ty);
    }
    ctx.quadraticCurveTo(x + tw * 0.4, ty - th * 0.45, x, ty - th);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,246,255,0.85)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x - tw * 0.82, ty - 1.5);
    ctx.quadraticCurveTo(x - tw * 0.35, ty - th * 0.5, x - 1, ty - th + 1.5);
    ctx.stroke();
  }
  // Kugeln
  for (let i = 0; i < 26; i++) {
    const s = rng.range(0.05, 0.85);
    const y = base - 12 - s * (h - 26);
    const half = h * 0.36 * (1 - s * 0.85);
    const bx = x + rng.range(-half, half) * 0.85;
    const col = rng.pick(['#d8283b', '#f2c14e', '#d8283b', '#c0c8e0']);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(bx, y, 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(bx - 1, y - 1.1, 0.8, 0.8);
  }
  for (const [lx, ly, , c] of FX.tree) bulb(ctx, c, lx, ly, 3, 0.55, 0.65);
  // Stern
  const sy = base - h - 2;
  glow(ctx, x, sy, 26, 'rgba(255,220,120,0.45)');
  ctx.fillStyle = '#ffd65a';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 2.6 : 6.4;
    ctx.lineTo(x + Math.cos(a) * r, sy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  // Geschenke
  for (const [gx, gw, gh, c, rb] of [[-22, 9, 7, '#c8283a', '#ffd65a'], [-13, 7, 9, '#2a6ab8', '#f4f4f4'], [12, 10, 6, '#f2c14e', '#c8283a'], [21, 7, 8, '#2f8a55', '#ffd65a']]) {
    ctx.fillStyle = c;
    ctx.fillRect(x + gx, base - gh, gw, gh);
    ctx.fillStyle = rb;
    ctx.fillRect(x + gx + gw / 2 - 0.7, base - gh, 1.4, gh);
    ctx.fillRect(x + gx, base - gh * 0.55, gw, 1.2);
    ctx.fillStyle = SNOW;
    ctx.fillRect(x + gx, base - gh - 0.8, gw, 1);
  }
}

function controlTower(ctx) {
  const { x, base, neck, cabBot, cabTop, roof, ant } = TOWER;
  // Betriebsgebäude am Fuß
  ctx.fillStyle = grad(ctx, 0, 482, 0, base, ['#454c72', '#353b5e']);
  ctx.fillRect(x - 46, 482, 92, base - 482);
  ctx.fillStyle = 'rgba(255,214,150,0.85)';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 10; c++) if ((r * 7 + c * 3) % 5) ctx.fillRect(x - 42 + c * 8.6, 487 + r * 9, 5, 4);
  snowCap(ctx, x - 48, 482, 96, 3.5, SNOW);
  // Schaft
  ctx.fillStyle = grad(ctx, x - 12, 0, x + 12, 0, ['#8a91b6', '#cdd2e8', '#9aa1c4', '#6f769c']);
  poly(ctx, [x - 12, base - 26, x - 8, neck, x + 8, neck, x + 12, base - 26]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,220,160,0.75)';
  for (let y = neck + 12; y < base - 34; y += 14) ctx.fillRect(x - 1, y, 2, 6);
  ctx.fillStyle = 'rgba(40,46,80,0.25)';
  ctx.fillRect(x + 4, neck, 1, base - 26 - neck);
  // Kragen unter der Kanzel
  ctx.fillStyle = grad(ctx, x - 24, 0, x + 24, 0, ['#7a81a6', '#c5cae2', '#7d84a8']);
  poly(ctx, [x - 8, neck, x - 24, cabBot + 2, x + 24, cabBot + 2, x + 8, neck]);
  ctx.fill();
  ctx.fillStyle = '#2a2f4c';
  ctx.fillRect(x - 25, cabBot, 50, 3);
  // Kanzel mit schräger Verglasung
  ctx.fillStyle = grad(ctx, 0, cabTop, 0, cabBot, ['#a6f0e2', '#5fc7c0', '#3d8f9a']);
  poly(ctx, [x - 25, cabBot, x - 31, cabTop, x + 31, cabTop, x + 25, cabBot]);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,40,60,0.55)';
  ctx.fillRect(x - 12, cabBot - 9, 4, 9);
  ctx.beginPath();
  ctx.arc(x - 10, cabBot - 11, 2.2, 0, TAU);
  ctx.arc(x + 9, cabBot - 10, 2.2, 0, TAU);
  ctx.fill();
  ctx.fillRect(x + 7, cabBot - 8, 4, 8);
  ctx.strokeStyle = 'rgba(30,40,70,0.8)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(x + i * 10, cabBot);
    ctx.lineTo(x + i * 12.4, cabTop);
  }
  ctx.stroke();
  glow(ctx, x, (cabTop + cabBot) / 2, 46, 'rgba(120,240,220,0.18)');
  // Dach + Schnee
  ctx.fillStyle = '#2a2f4c';
  ctx.fillRect(x - 34, roof, 68, cabTop - roof);
  snowCap(ctx, x - 35, roof, 70, 3.5, SNOW);
  ctx.fillStyle = '#383e62';
  ctx.fillRect(x - 8, roof - 7, 16, 7);
  snowCap(ctx, x - 9, roof - 7, 18, 2, SNOW);
  // Antennenmast
  ctx.strokeStyle = '#4a5072';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - 2.5, roof - 7);
  ctx.lineTo(x - 0.5, ant);
  ctx.moveTo(x + 2.5, roof - 7);
  ctx.lineTo(x + 0.5, ant);
  for (let y = roof - 12; y > ant + 4; y -= 5) {
    const k = (roof - 7 - y) / (roof - 7 - ant);
    const hw = 2.5 - 2 * k;
    ctx.moveTo(x - hw, y);
    ctx.lineTo(x + hw, y - 5);
  }
  ctx.stroke();
  ctx.fillStyle = '#2a2f4c';
  ctx.fillRect(x + 14, roof - 12, 1.2, 12);
  ctx.fillRect(x - 22, roof - 9, 1, 9);
}

function hangar(ctx, rng) {
  const { x1, x2, wallTop, apex, base } = HANGAR;
  const cx = (x1 + x2) / 2;
  const half = (x2 - x1) / 2;
  const rise = wallTop - apex;
  ctx.fillStyle = grad(ctx, 0, apex, 0, base, ['#5a628c', '#474e76', '#3c4268']);
  ctx.beginPath();
  ctx.moveTo(x1, base);
  ctx.lineTo(x1, wallTop);
  ctx.ellipse(cx, wallTop, half, rise, 0, Math.PI, 0);
  ctx.lineTo(x2, base);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let k = 0.25; k < 1; k += 0.25) {
    ctx.beginPath();
    ctx.ellipse(cx, wallTop, half * k, rise * k, 0, Math.PI, 0);
    ctx.stroke();
  }
  // Tor-Riegel
  ctx.fillStyle = grad(ctx, 0, wallTop, 0, wallTop + 12, ['#3a4066', '#2c3152']);
  ctx.fillRect(x1, wallTop, x2 - x1, 12);
  // Tore (Mitte offen, warmes Licht)
  const dTop = wallTop + 12;
  const panels = 10;
  const pw = (x2 - x1 - 24) / panels;
  ctx.fillStyle = grad(ctx, 0, dTop, 0, base, ['#fff2d8', '#f6dcaa', '#e8bf80']);
  ctx.fillRect(x1 + 12 + pw * 3, dTop, pw * 4, base - dTop);
  // Innenleben: Arbeitsbühnen, Leitern, Deckenstrahler
  const ix = x1 + 12 + pw * 3;
  const iw = pw * 4;
  for (let x = ix + 6; x < ix + iw; x += 14) bulb(ctx, '255,252,240', x, dTop + 4, 4, 0.6, 0.9);
  ctx.fillStyle = 'rgba(70,74,96,0.85)';
  ctx.fillRect(ix + 10, 478, 40, 3);
  ctx.fillRect(ix + 12, 481, 2, 31);
  ctx.fillRect(ix + 46, 481, 2, 31);
  ctx.fillRect(ix + iw - 54, 466, 44, 3);
  ctx.fillRect(ix + iw - 50, 469, 2, 43);
  ctx.fillRect(ix + iw - 14, 469, 2, 43);
  ctx.strokeStyle = 'rgba(70,74,96,0.85)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let y = 470; y < 512; y += 4) {
    ctx.moveTo(ix + iw - 50, y);
    ctx.lineTo(ix + iw - 14, y + 2);
  }
  ctx.stroke();
  ctx.fillStyle = '#d8283b';
  ctx.fillRect(ix + 70, 498, 10, 14);
  ctx.fillStyle = '#f2c400';
  ctx.fillRect(ix + 90, 505, 16, 7);
  ctx.fillStyle = 'rgba(255,240,200,0.4)';
  ctx.fillRect(ix, 508, iw, 4);
  // geschlossene Torflügel
  for (let i = 0; i < panels; i++) {
    if (i >= 3 && i < 7) continue;
    const px = x1 + 12 + i * pw;
    ctx.fillStyle = grad(ctx, px, 0, px + pw, 0, ['#636b93', '#727aa2', '#5f668e']);
    ctx.fillRect(px, dTop, pw - 0.8, base - dTop);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = px + 3; x < px + pw - 2; x += 4) ctx.fillRect(x, dTop, 0.6, base - dTop);
    ctx.fillStyle = 'rgba(255,220,160,0.5)';
    ctx.fillRect(px + 4, dTop + 8, pw - 8, 3);
  }
  ctx.fillStyle = '#353b60';
  ctx.fillRect(x1, dTop, 12, base - dTop);
  ctx.fillRect(x2 - 12, dTop, 12, base - dTop);
  // Hallennummer
  ctx.font = `800 8px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(235,240,255,0.9)';
  ctx.fillText('HALLE 7', cx, wallTop + 6.4);
  // Flutlichter am Riegel
  for (let i = 0; i < 5; i++) {
    const fx = x1 + 40 + i * ((x2 - x1 - 80) / 4);
    bulb(ctx, '255,240,210', fx, wallTop + 13, 7, 0.7, 1.1);
  }
  // Schneehaube auf dem Bogen (oben dicker)
  ctx.fillStyle = SNOW;
  ctx.beginPath();
  ctx.ellipse(cx, wallTop + 1, half + 2, rise + 6, 0, Math.PI, 0);
  ctx.ellipse(cx, wallTop + 1, half - 1, rise - 1, 0, 0, Math.PI, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(170,180,220,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, wallTop + 1, half - 1, rise - 1, 0, Math.PI, 0);
  ctx.ellipse(cx, wallTop + 1, half - 2, rise - 3, 0, 0, Math.PI, true);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 18; i++) {
    const a = Math.PI + rng.range(0.15, 0.85) * Math.PI;
    const px = cx + Math.cos(a) * (half - 1);
    const py = wallTop + 1 + Math.sin(a) * (rise - 1);
    ctx.fillStyle = 'rgba(225,235,255,0.7)';
    poly(ctx, [px - 0.6, py, px + 0.6, py, px, py + rng.range(1.5, 4)]);
    ctx.fill();
  }
  // Licht auf dem Vorfeld vor dem offenen Tor
  ctx.fillStyle = grad(ctx, 0, base, 0, base + 34, ['rgba(255,226,170,0.35)', 'rgba(255,226,170,0)']);
  poly(ctx, [ix, base, ix + iw, base, ix + iw + 30, base + 34, ix - 30, base + 34]);
  ctx.fill();
}

function annex(ctx, rng) {
  const { x1, x2, top, base } = ANNEX;
  ctx.fillStyle = grad(ctx, x1, 0, x2, 0, ['#3d4468', '#4c5479']);
  ctx.fillRect(x1, top, x2 - x1, base - top);
  windowsGrid(ctx, rng, x1 + 6, top + 6, x2 - x1 - 12, base - top - 14, 9, 4);
  ctx.fillStyle = '#2a2f4c';
  ctx.fillRect(x1 + 40, base - 12, 12, 12);
  bulb(ctx, WARM, x1 + 46, base - 14, 6, 0.6, 0.9);
  snowCap(ctx, x1 - 2, top, x2 - x1 + 4, 4.5, SNOW);
  ctx.fillStyle = '#2a2f4c';
  ctx.fillRect(x2 - 20, top - 16, 1.2, 16);
}

function windowsGrid(ctx, rng, x, y, w, h, cols, rows) {
  const cw = w / cols;
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = rng.chance(0.6);
      ctx.fillStyle = on ? (rng.chance(0.75) ? '#ffd994' : '#d8e6ff') : 'rgba(25,30,60,0.7)';
      ctx.fillRect(x + c * cw + cw * 0.15, y + r * rh + rh * 0.2, cw * 0.7, rh * 0.6);
    }
  }
}

function radar(ctx) {
  const { x, base, top } = RADAR;
  ctx.fillStyle = '#3b4164';
  ctx.fillRect(x - 18, 494, 36, base - 494);
  snowCap(ctx, x - 19, 494, 38, 3, SNOW);
  bulb(ctx, WARM, x - 8, 500, 4, 0.5, 0.7);
  ctx.strokeStyle = '#5a6188';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 7, 494);
  ctx.lineTo(x - 3, top);
  ctx.moveTo(x + 7, 494);
  ctx.lineTo(x + 3, top);
  for (let y = 494; y > top + 6; y -= 8) {
    const k = (494 - y) / (494 - top);
    const a = 7 - 4 * k;
    const b = 7 - 4 * ((494 - y + 8) / (494 - top));
    ctx.moveTo(x - a, y);
    ctx.lineTo(x + b, y - 8);
    ctx.moveTo(x + a, y);
    ctx.lineTo(x - b, y - 8);
  }
  ctx.stroke();
  ctx.fillStyle = '#2a2f4c';
  ctx.fillRect(x - 8, top - 3, 16, 4);
  snowCap(ctx, x - 8, top - 3, 16, 1.6, SNOW);
}

function snowplow(ctx, x, base, facing = 1) {
  ctx.save();
  ctx.translate(x, base);
  ctx.scale(facing, 1);
  ctx.fillStyle = '#1a1d2c';
  ctx.fillRect(0, -10, 44, 4);
  ctx.fillStyle = grad(ctx, 0, -24, 0, -10, ['#ff9a48', '#d8621e']);
  ctx.fillRect(1, -22, 29, 12);
  ctx.fillStyle = SNOW;
  rrect(ctx, 0.5, -24.5, 30, 3.2, 1.5);
  ctx.fill();
  ctx.fillStyle = grad(ctx, 0, -26, 0, -8, ['#ff9a48', '#d8621e']);
  rrect(ctx, 31, -26, 13, 18, 2);
  ctx.fill();
  ctx.fillStyle = '#8fb4e8';
  ctx.fillRect(35, -23, 7.5, 6);
  ctx.fillStyle = '#f2c230';
  poly(ctx, [45, -16, 54, -19, 56, -2, 46, -3]);
  ctx.fill();
  ctx.fillStyle = '#1a1d2c';
  for (let i = 0; i < 3; i++) poly(ctx, [47 + i * 3, -16 - i, 49 + i * 3, -17 - i, 51 + i * 3, -2, 49 + i * 3, -2]), ctx.fill();
  snowMound(ctx, 50, 0, 14, 5);
  ctx.fillStyle = '#121522';
  for (const wx of [9, 21, 38]) {
    ctx.beginPath();
    ctx.arc(wx, -4, 4.2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#6a6f88';
  for (const wx of [9, 21, 38]) ctx.fillRect(wx - 1.2, -5.2, 2.4, 2.4);
  ctx.fillStyle = '#ffb000';
  ctx.fillRect(36, -28.5, 4, 2.5);
  bulb(ctx, '255,250,230', 44, -12, 5, 0.6, 0.9);
  ctx.restore();
}

function deicer(ctx, x, base, facing = 1, boom = 1) {
  ctx.save();
  ctx.translate(x, base);
  ctx.scale(facing, 1);
  ctx.fillStyle = '#1a1d2c';
  ctx.fillRect(0, -10, 50, 4);
  ctx.fillStyle = grad(ctx, 0, -26, 0, -10, ['#f4f1e6', '#c9c4b4']);
  rrect(ctx, 2, -25, 32, 15, 4);
  ctx.fill();
  ctx.fillStyle = '#f2c230';
  ctx.fillRect(2, -16, 32, 2.5);
  ctx.fillStyle = grad(ctx, 0, -24, 0, -8, ['#f2c230', '#c99a10']);
  rrect(ctx, 36, -24, 14, 16, 2);
  ctx.fill();
  ctx.fillStyle = '#8fb4e8';
  ctx.fillRect(40, -21, 8, 5.5);
  // Ausleger mit Korb
  const bx = 18 + 10 * boom;
  const by = -26 - 34 * boom;
  ctx.strokeStyle = '#d8d4c6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(8, -26);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.strokeStyle = '#8a8676';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#f2c230';
  rrect(ctx, bx - 5, by - 9, 11, 9, 1.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,200,240,0.9)';
  ctx.fillRect(bx - 3, by - 7, 7, 4);
  ctx.fillStyle = '#ffb000';
  ctx.fillRect(43, -26.5, 3.5, 2.5);
  ctx.fillStyle = '#121522';
  for (const wx of [10, 26, 43]) {
    ctx.beginPath();
    ctx.arc(wx, -4, 4.2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#6a6f88';
  for (const wx of [10, 26, 43]) ctx.fillRect(wx - 1.2, -5.2, 2.4, 2.4);
  ctx.restore();
}

function followMe(ctx, x, base) {
  ctx.fillStyle = '#f5c400';
  rrect(ctx, x, base - 10, 24, 7, 2);
  ctx.fill();
  rrect(ctx, x + 5, base - 15, 13, 6, 2);
  ctx.fill();
  ctx.fillStyle = '#8fb4e8';
  ctx.fillRect(x + 7, base - 14, 9, 4);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? '#111' : '#f5c400';
    ctx.fillRect(x + 6 + i * 2, base - 19, 2, 3);
  }
  ctx.fillStyle = '#121522';
  ctx.beginPath();
  ctx.arc(x + 5, base - 3, 3, 0, TAU);
  ctx.arc(x + 19, base - 3, 3, 0, TAU);
  ctx.fill();
  bulb(ctx, '255,250,230', x + 24, base - 8, 4, 0.5, 0.8);
}

function tugTrain(ctx, x, base) {
  ctx.fillStyle = '#c64a1e';
  rrect(ctx, x, base - 11, 16, 8, 2);
  ctx.fill();
  ctx.fillStyle = '#2a2f4c';
  ctx.fillRect(x + 3, base - 17, 9, 6);
  ctx.fillStyle = '#121522';
  ctx.beginPath();
  ctx.arc(x + 4, base - 2.5, 2.5, 0, TAU);
  ctx.arc(x + 13, base - 2.5, 2.5, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const cx = x + 20 + i * 19;
    ctx.fillStyle = '#5d6488';
    ctx.fillRect(cx, base - 6, 16, 2);
    ctx.fillStyle = i === 1 ? '#3f6aa8' : '#7a8196';
    rrect(ctx, cx + 1, base - 15, 14, 9, 1.5);
    ctx.fill();
    snowCap(ctx, cx + 1, base - 15, 14, 1.6, SNOW);
    ctx.fillStyle = '#121522';
    ctx.beginPath();
    ctx.arc(cx + 3, base - 2, 2, 0, TAU);
    ctx.arc(cx + 13, base - 2, 2, 0, TAU);
    ctx.fill();
  }
}

function paintMid(ctx, w, rng) {
  midGround(ctx, rng, w);
  depot(ctx, rng);
  radar(ctx);
  terminal(ctx, rng);
  controlTower(ctx);
  hangar(ctx, rng);
  annex(ctx, rng);
  pier(ctx, rng);
  for (const gx of GATES_X) jetBridge(ctx, gx);
  // Haltepositionen: Stopp-Markierungen und Standnummern
  ctx.font = `700 5px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [...GATES_X, ...REMOTE_X].forEach((gx, i) => {
    // Stoppmarke am Bugrad (vordere Tür liegt bei gx − 48, siehe traffic.gates)
    ctx.fillStyle = 'rgba(255,205,60,0.8)';
    ctx.fillRect(gx - 48.6, 524, 1.2, 12);
    ctx.fillRect(gx - 52.5, 524, 9, 1.2);
    ctx.fillStyle = 'rgba(255,205,60,0.9)';
    ctx.fillText(i < GATES_X.length ? `A${12 + i * 2}` : `V${i - GATES_X.length + 1}`, gx + 4, 543);
  });
  for (const x of MASTS) lightMast(ctx, x);
  xmasTree(ctx, rng);
  // Fahrzeuge (nur dort, wo keine Flugzeuge parken)
  snowplow(ctx, 24, 544, 1);
  deicer(ctx, 150, 544, -1, 1);
  snowplow(ctx, 1424, 546, -1);
  followMe(ctx, 1530, 545);
  tugTrain(ctx, 1572, 545);
  deicer(ctx, 2150, 544, 1, 0.35);
  // Schneehaufen am Vorfeldrand
  for (let x = -20; x < w + 20; x += rng.range(30, 70)) snowMound(ctx, x, 549, rng.range(20, 46), rng.range(2.5, 6));
  snowMound(ctx, 200, 548, 50, 13);
  snowMound(ctx, 1640, 548, 44, 11);
  snowMound(ctx, 2290, 548, 70, 16);
}

// --- Ebene near: Zaun, Spotterhügel, Tannen ---

function snowPine(ctx, rng, x, baseY, h) {
  const trunkH = h * 0.07;
  ctx.fillStyle = '#2a1e1c';
  ctx.fillRect(x - h * 0.025, baseY - trunkH - 4, h * 0.05, trunkH + 4);
  const tiers = Math.max(4, Math.round(h / 42));
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1);
    const ty = baseY - trunkH - k * (h - trunkH) * 0.74;
    const tw = h * 0.27 * (1 - k * 0.8) * rng.range(0.92, 1.08);
    const th = (h - trunkH) * 0.36;
    const apex = ty - th;
    const n = Math.max(3, Math.round(tw / 9));
    const tier = () => {
      ctx.beginPath();
      ctx.moveTo(x, apex);
      ctx.quadraticCurveTo(x - tw * 0.4, ty - th * 0.42, x - tw, ty + 3);
      for (let j = 1; j <= n; j++) {
        const px = x - tw + (2 * tw * j) / n;
        ctx.quadraticCurveTo(px - tw / n, ty - 3, px, ty + 3 * ((j % 2) * 0.5 + 0.6));
      }
      ctx.quadraticCurveTo(x + tw * 0.4, ty - th * 0.42, x, apex);
      ctx.closePath();
    };
    ctx.save();
    tier();
    ctx.fillStyle = grad(ctx, x - tw, 0, x + tw, 0, ['#0e1d28', '#16303a', '#1f3f48']);
    ctx.fill();
    ctx.clip();
    // Schneelast: Kontur nach oben versetzt, dann dunkle Unterseite darüber
    const d = th * 0.27;
    ctx.fillStyle = SNOW;
    ctx.fillRect(x - tw - 4, apex - 4, tw * 2 + 8, th + 10);
    ctx.translate(0, d * 0.55);
    ctx.fillStyle = '#b6c0e4';
    tier();
    ctx.fill();
    ctx.translate(0, d * 0.45);
    ctx.fillStyle = grad(ctx, x - tw, 0, x + tw, 0, ['#0e1d28', '#16303a', '#1f3f48']);
    tier();
    ctx.fill();
    ctx.restore();
  }
}

function meshFence(ctx, x1, x2, base, h) {
  const top = base - h;
  ctx.save();
  ctx.strokeStyle = 'rgba(160,170,210,0.32)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let x = x1 - h; x < x2; x += 7) {
    ctx.moveTo(x, base);
    ctx.lineTo(x + h * 0.55, top);
    ctx.moveTo(x + h * 0.55, base);
    ctx.lineTo(x, top);
  }
  ctx.stroke();
  // Pfosten mit schrägen Auslegern für den Stacheldraht
  ctx.fillStyle = '#3a3f5c';
  for (let x = x1; x <= x2; x += 64) {
    ctx.fillRect(x - 1.6, top - 2, 3.2, h + 2);
    poly(ctx, [x - 1, top - 1, x + 0.6, top - 1, x - 8.4, top - 13, x - 10, top - 12]);
    ctx.fill();
  }
  ctx.fillRect(x1, top - 1, x2 - x1, 2);
  ctx.strokeStyle = 'rgba(70,76,104,0.9)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (const k of [0.3, 0.62, 0.95]) {
    ctx.moveTo(x1, top - 1 - 12 * k);
    ctx.lineTo(x2, top - 1 - 12 * k);
    for (let x = x1 + 4; x < x2; x += 6) {
      const xx = x - 9 * k;
      const yy = top - 1 - 12 * k;
      ctx.moveTo(xx - 1.2, yy - 1.2);
      ctx.lineTo(xx + 1.2, yy + 1.2);
      ctx.moveTo(xx - 1.2, yy + 1.2);
      ctx.lineTo(xx + 1.2, yy - 1.2);
    }
  }
  ctx.stroke();
  ctx.fillStyle = SNOW;
  ctx.fillRect(x1, top - 2.6, x2 - x1, 1.6);
  for (let x = x1; x <= x2; x += 64) {
    ctx.beginPath();
    ctx.ellipse(x - 0.5, top - 3, 3, 1.6, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function lamp(ctx, x, base) {
  const top = base - 172;
  ctx.fillStyle = grad(ctx, 0, top, 0, base, ['rgba(255,200,130,0.16)', 'rgba(255,200,130,0.02)']);
  poly(ctx, [x + 14, top + 6, x + 26, top + 6, x + 76, base, x - 34, base]);
  ctx.fill();
  ellipseGlow(ctx, x + 20, base - 18, 90, 22, 'rgba(255,196,120,0.4)');
  ctx.fillStyle = grad(ctx, x - 3, 0, x + 3, 0, ['#2a2f48', '#4c5374']);
  ctx.fillRect(x - 2.5, top, 5, base - top);
  ctx.fillRect(x - 5, base - 30, 10, 30);
  ctx.strokeStyle = '#3a4060';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, top + 2);
  ctx.quadraticCurveTo(x + 4, top - 8, x + 20, top - 2);
  ctx.stroke();
  ctx.fillStyle = '#2a2f48';
  rrect(ctx, x + 10, top - 4, 22, 7, 3);
  ctx.fill();
  snowCap(ctx, x + 10, top - 4, 22, 3, SNOW);
  glow(ctx, x + 21, top + 6, 70, 'rgba(255,190,110,0.32)');
  bulb(ctx, '255,214,150', x + 21, top + 4, 12, 0.9, 2.2);
}

function approachMast(ctx, x, top, base) {
  ctx.strokeStyle = '#363c5c';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 4, base);
  ctx.lineTo(x - 2, top);
  ctx.moveTo(x + 4, base);
  ctx.lineTo(x + 2, top);
  for (let y = base; y > top + 6; y -= 9) {
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y - 9);
  }
  ctx.stroke();
  ctx.fillStyle = '#2a2f48';
  ctx.fillRect(x - 18, top - 2, 36, 3);
  snowCap(ctx, x - 18, top - 2, 36, 2, SNOW);
  for (let i = 0; i < 5; i++) bulb(ctx, '255,250,235', x - 14 + i * 7, top + 3, 6, 0.4, 1.1);
}

function person(ctx, x, base, h, { coat, pants = '#22263a', hat = 'beanie', hatColor = '#c8283a', scarf = '#f2c14e', pose = 'stand', facing = 1 }) {
  ctx.save();
  ctx.translate(x, base);
  ctx.scale((facing * h) / 40, h / 40);
  ctx.fillStyle = '#15161f';
  ctx.fillRect(-6, -3, 5, 3);
  ctx.fillRect(1, -3, 5.5, 3);
  ctx.fillStyle = pants;
  ctx.fillRect(-5, -17, 4, 15);
  ctx.fillRect(1, -17, 4, 15);
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(-8, -14);
  ctx.lineTo(-7, -29);
  ctx.quadraticCurveTo(-6.5, -33, -3, -33.5);
  ctx.lineTo(3, -33.5);
  ctx.quadraticCurveTo(6.5, -33, 7, -29);
  ctx.lineTo(8, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,200,140,0.25)';
  ctx.fillRect(5.6, -30, 1.6, 15);
  ctx.fillStyle = scarf;
  ctx.fillRect(-4.5, -35, 9, 3);
  ctx.fillRect(2, -33, 2.6, 8);
  ctx.fillStyle = '#e9b994';
  ctx.beginPath();
  ctx.arc(0, -38.5, 4.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,60,40,0.35)';
  ctx.beginPath();
  ctx.arc(-1.4, -38.5, 4.2, Math.PI * 0.55, Math.PI * 1.45);
  ctx.fill();
  if (hat === 'santa') {
    ctx.fillStyle = '#d42a36';
    ctx.beginPath();
    ctx.moveTo(-4.6, -40.5);
    ctx.quadraticCurveTo(0, -47, 7, -45);
    ctx.lineTo(4.6, -40.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5, -41.5, 10, 2.2);
    ctx.beginPath();
    ctx.arc(7.2, -45, 1.6, 0, TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = hatColor;
    ctx.beginPath();
    ctx.arc(0, -39.5, 4.5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-4.8, -40.5, 9.6, 1.8);
    ctx.fillStyle = '#f4f4f4';
    ctx.beginPath();
    ctx.arc(0, -44.4, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = coat;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (pose === 'camera') {
    ctx.moveTo(3, -31);
    ctx.lineTo(8, -35);
  } else if (pose === 'point') {
    ctx.moveTo(4, -31);
    ctx.lineTo(9, -46);
    ctx.moveTo(-5, -30);
    ctx.lineTo(-7, -20);
  } else if (pose === 'cup') {
    ctx.moveTo(4, -30);
    ctx.lineTo(7, -24);
    ctx.lineTo(9, -29);
  } else if (pose === 'binocs') {
    ctx.moveTo(4, -31);
    ctx.lineTo(5, -37);
    ctx.moveTo(-4, -31);
    ctx.lineTo(1, -38);
  } else {
    ctx.moveTo(-5, -30);
    ctx.lineTo(-7, -19);
    ctx.moveTo(5, -30);
    ctx.lineTo(7, -19);
  }
  ctx.stroke();
  if (pose === 'camera') {
    ctx.fillStyle = '#1b1c24';
    ctx.fillRect(5.5, -40, 6, 5);
    ctx.save();
    ctx.translate(11, -38);
    ctx.rotate(-0.45);
    ctx.fillStyle = '#d6d4cc';
    ctx.fillRect(0, -1.8, 11, 3.6);
    ctx.fillStyle = '#1b1c24';
    ctx.fillRect(9, -2.2, 2.5, 4.4);
    ctx.restore();
    ctx.strokeStyle = '#2a2b34';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(14, -33);
    ctx.lineTo(9, 0);
    ctx.moveTo(14, -33);
    ctx.lineTo(15, 0);
    ctx.moveTo(14, -33);
    ctx.lineTo(20, 0);
    ctx.stroke();
  } else if (pose === 'cup') {
    ctx.fillStyle = '#c8283a';
    ctx.fillRect(7.5, -33, 3.4, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(9, -34);
    ctx.quadraticCurveTo(7, -37, 9.5, -39);
    ctx.quadraticCurveTo(11.5, -41, 9.5, -43);
    ctx.stroke();
  } else if (pose === 'binocs') {
    ctx.fillStyle = '#1b1c24';
    ctx.fillRect(3, -41, 5, 4);
  }
  ctx.restore();
}

function sled(ctx, x, base) {
  ctx.fillStyle = '#9a5a2e';
  ctx.fillRect(x, base - 6, 20, 2.5);
  ctx.fillRect(x + 2, base - 10, 2, 4);
  ctx.fillRect(x + 16, base - 10, 2, 4);
  ctx.strokeStyle = '#7a4520';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 2, base - 1);
  ctx.lineTo(x + 20, base - 1);
  ctx.quadraticCurveTo(x + 25, base - 1, x + 24, base - 6);
  ctx.stroke();
}

function spotterHill(ctx, rng) {
  const { x1, x2, top } = HILL;
  ctx.save();
  ctx.fillStyle = grad(ctx, 0, top, 0, 700, ['#f2f5ff', '#cfd6f2', '#a8b2dc']);
  ctx.beginPath();
  ctx.moveTo(x1, 690);
  ctx.bezierCurveTo(x1 + 60, 690, x1 + 80, top + 2, x1 + 150, top);
  ctx.lineTo(x2 - 200, top - 3);
  ctx.bezierCurveTo(x2 - 120, top - 2, x2 - 70, 680, x2, 690);
  ctx.lineTo(x2, 720);
  ctx.lineTo(x1, 720);
  ctx.closePath();
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = grad(ctx, x1, 0, x2, 0, [[0, 'rgba(255,214,160,0.18)'], [0.3, 'rgba(255,214,160,0)'], [0.62, 'rgba(110,120,185,0)'], [1, 'rgba(110,120,185,0.35)']]);
  ctx.fillRect(x1, top - 6, x2 - x1, 720 - top);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x1 + 40, 676);
  ctx.bezierCurveTo(x1 + 80, 660, x1 + 90, top + 2, x1 + 150, top + 0.6);
  ctx.lineTo(x2 - 200, top - 2.4);
  ctx.bezierCurveTo(x2 - 140, top - 2, x2 - 110, top + 20, x2 - 90, 640);
  ctx.stroke();
  // Halme an den Hügelkanten
  for (const gx of [x1 + 128, x1 + 146, x2 - 196, x2 - 178]) grassTuft(ctx, rng, gx, top + (gx < x1 + 140 ? 4 : 1), 7);
  // Fußspuren und Schlittenspur
  ctx.fillStyle = 'rgba(120,130,190,0.35)';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.ellipse(rng.range(x1 + 160, x2 - 210), top + rng.range(3, 14), 1.6, 0.7, 0, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(120,130,190,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x2 - 260, top + 6);
  ctx.bezierCurveTo(x2 - 140, top + 8, x2 - 90, 660, x2 - 30, 688);
  ctx.moveTo(x2 - 260, top + 9);
  ctx.bezierCurveTo(x2 - 140, top + 11, x2 - 92, 663, x2 - 32, 691);
  ctx.stroke();
  // Schild
  const sx = x2 - 92;
  const sy = 652;
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(sx - 1.5, sy - 30, 3, 32);
  ctx.fillStyle = '#6b4428';
  rrect(ctx, sx - 34, sy - 44, 68, 15, 2);
  ctx.fill();
  ctx.fillStyle = SNOW;
  rrect(ctx, sx - 35, sy - 46.5, 70, 3.5, 1.5);
  ctx.fill();
  ctx.font = `700 8px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe6b8';
  ctx.fillText('Besucherhügel', sx, sy - 36);
  // Zuschauer
  const g = top - 1;
  person(ctx, x1 + 170, g, 42, { coat: '#2d4a6e', hat: 'beanie', hatColor: '#2f8a55', scarf: '#d8283b', pose: 'camera' });
  person(ctx, x1 + 228, g - 1, 44, { coat: '#7a2430', hat: 'santa', scarf: '#f4f4f4', pose: 'point' });
  person(ctx, x1 + 282, g - 1, 28, { coat: '#d8742a', hat: 'beanie', hatColor: '#2a6ab8', scarf: '#f2c14e', pose: 'point', facing: -1 });
  sled(ctx, x1 + 292, g);
  person(ctx, x1 + 330, g - 2, 41, { coat: '#3b5a3a', hat: 'beanie', hatColor: '#c8283a', scarf: '#f4f4f4', pose: 'cup', facing: -1 });
  person(ctx, x1 + 368, g - 2, 43, { coat: '#5a4a6a', hat: 'beanie', hatColor: '#f2c14e', scarf: '#2a6ab8', pose: 'binocs' });
  // Kleiner geschmückter Baum auf dem Hügel
  snowPine(ctx, rng, x2 - 146, top + 2, 70);
  for (const [dx, dy, c] of [[-8, -20, '#d8283b'], [6, -26, '#f2c14e'], [-3, -36, '#d8283b'], [4, -46, '#f2c14e'], [-6, -12, '#2a6ab8'], [9, -14, '#d8283b']]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x2 - 146 + dx * 0.8, top + 2 + dy, 2.2, 0, TAU);
    ctx.fill();
  }
}

function hut(ctx, rng) {
  const { x, base } = HUT;
  const w = 90;
  const top = base - 46;
  ellipseGlow(ctx, x + w / 2, base - 4, 100, 18, 'rgba(255,190,110,0.5)');
  ctx.fillStyle = grad(ctx, x, 0, x + w, 0, ['#4a2c1e', '#6b4028', '#5a3522']);
  ctx.fillRect(x, top, w, 46);
  ctx.strokeStyle = 'rgba(30,15,10,0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let px = x + 5; px < x + w; px += 5) {
    ctx.moveTo(px, top);
    ctx.lineTo(px, base);
  }
  ctx.stroke();
  // Verkaufsluke
  ctx.fillStyle = grad(ctx, 0, top + 10, 0, top + 30, ['#ffe0a0', '#f2a656']);
  ctx.fillRect(x + 10, top + 10, w - 20, 20);
  ctx.fillStyle = 'rgba(80,40,30,0.85)';
  ctx.beginPath();
  ctx.arc(x + 40, top + 18, 3.4, 0, TAU);
  ctx.fill();
  ctx.fillRect(x + 35.5, top + 21, 9, 9);
  ctx.fillStyle = '#c8283a';
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 54 + i * 4.5, top + 25, 3, 3.6);
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(x + 6, top + 29, w - 12, 4);
  snowCap(ctx, x + 6, top + 29, w - 12, 1.6, SNOW);
  // Tannengirlande
  ctx.fillStyle = '#1f4a34';
  for (let px = x + 10; px < x + w - 10; px += 4) {
    ctx.beginPath();
    ctx.arc(px, top + 10 + Math.sin(((px - x - 10) / (w - 20)) * Math.PI) * 3, 2.4, 0, TAU);
    ctx.fill();
  }
  // Dach mit dicker Schneelast
  ctx.fillStyle = '#3a2420';
  poly(ctx, [x - 8, top + 1, x + w / 2, top - 21, x + w + 8, top + 1]);
  ctx.fill();
  ctx.fillStyle = SNOW;
  ctx.beginPath();
  ctx.moveTo(x - 10, top);
  ctx.lineTo(x + w / 2, top - 25);
  ctx.lineTo(x + w + 10, top);
  for (let px = x + w + 10; px > x - 10; px -= 7) ctx.quadraticCurveTo(px - 3.5, top + 5, px - 7, top + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(225,235,255,0.8)';
  for (let px = x - 6; px < x + w + 6; px += rng.range(4, 9)) {
    poly(ctx, [px - 0.8, top + 2, px + 0.8, top + 2, px, top + 2 + rng.range(2, 6)]);
    ctx.fill();
  }
  // Schild
  ctx.fillStyle = '#1e3a2a';
  rrect(ctx, x + 18, top - 38, 54, 13, 2);
  ctx.fill();
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(x + 25, top - 25, 2, 6);
  ctx.fillRect(x + 63, top - 25, 2, 6);
  ctx.font = `700 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd98a';
  ctx.fillText('Glühwein', x + 45, top - 31.2);
  snowCap(ctx, x + 18, top - 38, 54, 2.2, SNOW);
  for (const [lx, ly, , c] of FX.hut) bulb(ctx, c, lx, ly, 3.4, 0.55, 0.9);
}

function snowman(ctx, x, base) {
  ellipseGlow(ctx, x, base, 30, 6, 'rgba(60,70,120,0.4)');
  for (const [dy, r] of [[-13, 14], [-34, 10], [-49, 7]]) {
    ctx.fillStyle = grad(ctx, x - r, base + dy - r, x + r, base + dy + r, ['#ffffff', '#dfe5fa', '#aab3dc']);
    ctx.beginPath();
    ctx.arc(x, base + dy, r, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#20222c';
  for (const [dx, dy] of [[-2.5, -51], [2.5, -51], [0, -30], [0, -36], [0, -24]]) {
    ctx.beginPath();
    ctx.arc(x + dx, base + dy, 1.1, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ff7a1a';
  poly(ctx, [x, base - 49.5, x + 9, base - 48, x, base - 47]);
  ctx.fill();
  ctx.fillStyle = '#c8283a';
  ctx.fillRect(x - 8, base - 43, 16, 3.4);
  ctx.fillRect(x + 3, base - 41, 3.4, 9);
  ctx.strokeStyle = '#4a3020';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 9, base - 36);
  ctx.lineTo(x - 22, base - 46);
  ctx.moveTo(x - 18, base - 43);
  ctx.lineTo(x - 21, base - 49);
  ctx.moveTo(x + 9, base - 36);
  ctx.lineTo(x + 21, base - 42);
  ctx.stroke();
  ctx.fillStyle = '#d42a36';
  ctx.beginPath();
  ctx.moveTo(x - 7.5, base - 54);
  ctx.quadraticCurveTo(x, base - 68, x + 10, base - 64);
  ctx.lineTo(x + 7.5, base - 54);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 8, base - 56, 16, 3);
  ctx.beginPath();
  ctx.arc(x + 10.5, base - 64, 2.2, 0, TAU);
  ctx.fill();
}

// Eingeschneites Spotter-Auto mit Dachbox
function car(ctx, x, base) {
  ctx.fillStyle = grad(ctx, 0, base - 40, 0, base, ['#3a5a8a', '#24395e']);
  ctx.beginPath();
  ctx.moveTo(x, base - 6);
  ctx.lineTo(x + 2, base - 22);
  ctx.quadraticCurveTo(x + 4, base - 25, x + 14, base - 26);
  ctx.lineTo(x + 30, base - 40);
  ctx.lineTo(x + 92, base - 41);
  ctx.quadraticCurveTo(x + 100, base - 40, x + 102, base - 30);
  ctx.lineTo(x + 104, base - 8);
  ctx.lineTo(x + 102, base - 4);
  ctx.lineTo(x + 2, base - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(150,180,230,0.55)';
  poly(ctx, [x + 32, base - 37, x + 58, base - 37.5, x + 58, base - 27, x + 22, base - 27]);
  ctx.fill();
  poly(ctx, [x + 62, base - 37.5, x + 90, base - 38, x + 96, base - 27, x + 62, base - 27]);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.5)';
  ctx.fillRect(x + 59, base - 38, 3, 30);
  ctx.fillStyle = '#1a1d2c';
  rrect(ctx, x + 36, base - 50, 50, 8, 4);
  ctx.fill();
  snowCap(ctx, x + 34, base - 50, 54, 4, SNOW);
  snowCap(ctx, x + 26, base - 41, 70, 3, SNOW);
  ctx.fillStyle = SNOW;
  ctx.beginPath();
  ctx.moveTo(x + 2, base - 22);
  ctx.quadraticCurveTo(x + 6, base - 27.5, x + 22, base - 28);
  ctx.lineTo(x + 26, base - 25);
  ctx.lineTo(x + 3, base - 21);
  ctx.closePath();
  ctx.fill();
  bulb(ctx, '255,60,50', x + 102, base - 24, 6, 0.6, 1.4);
  ctx.fillStyle = '#121522';
  for (const wx of [20, 84]) {
    ctx.beginPath();
    ctx.arc(x + wx, base - 4, 8, 0, TAU);
    ctx.fill();
  }
}

// Büschel aus dürren Halmen
function grassTuft(ctx, rng, x, base, h) {
  ctx.save();
  ctx.lineCap = 'round';
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const dx = rng.range(-4, 4);
    const lean = rng.range(-0.45, 0.45);
    const hh = h * rng.range(0.55, 1);
    ctx.strokeStyle = rng.chance(0.5) ? 'rgba(122,98,78,0.85)' : 'rgba(62,56,76,0.8)';
    ctx.lineWidth = rng.range(0.6, 1);
    ctx.beginPath();
    ctx.moveTo(x + dx, base);
    ctx.quadraticCurveTo(x + dx + lean * hh * 0.3, base - hh * 0.6, x + dx + lean * hh, base - hh);
    ctx.stroke();
  }
  ctx.restore();
}

// Oberkante des vorderen Schneewalls
function wallY(x) {
  const flat = x > 920 && x < 1100 ? 1 : x > 880 && x < 920 ? (x - 880) / 40 : x >= 1100 && x < 1140 ? 1 - (x - 1100) / 40 : 0;
  const hill = x > HILL.x1 + 40 && x < HILL.x2 - 40 ? 8 : 0;
  const wave = 640 + 5 * Math.sin(x * 0.012) + 3 * Math.sin(x * 0.037 + 1.3) + 2 * Math.sin(x * 0.11);
  return wave * (1 - flat) + 633 * flat + hill;
}

function snowWall(ctx, rng, w) {
  ctx.fillStyle = grad(ctx, 0, 626, 0, 720, [[0, '#f4f6ff'], [0.35, '#d6dcf4'], [0.75, '#b3bce2'], [1, '#98a2d2']]);
  ctx.beginPath();
  ctx.moveTo(-10, 720);
  for (let x = -10; x <= w + 10; x += 6) ctx.lineTo(x, wallY(x));
  ctx.lineTo(w + 10, 720);
  ctx.closePath();
  ctx.fill();
  // Vom Wind geformte Verwehungen: weicher Schatten unter einer hellen Kante
  for (let x = rng.range(0, 40); x < w; x += rng.range(55, 125)) {
    if (x > 900 && x < 1120) continue;
    const y = wallY(x) + rng.range(8, 30) + rng.next() ** 2 * 30;
    const dw = rng.range(50, 130);
    const lean = rng.range(-0.25, 0.25);
    ellipseGlow(ctx, x + dw * 0.1, y + 5, dw * 0.5, rng.range(4, 8), 'rgba(112,122,190,0.26)');
    if (rng.chance(0.4)) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - dw * 0.45, y + 3);
    ctx.quadraticCurveTo(x + dw * lean, y - rng.range(1.5, 4), x + dw * 0.4, y + 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = -10; x <= w + 10; x += 6) (x === -10 ? ctx.moveTo(x, wallY(x) + 0.6) : ctx.lineTo(x, wallY(x) + 0.6));
  ctx.stroke();
  // Trockene Grashalme ragen aus der Schneekante (Versteck-Abschnitt frei lassen)
  for (let x = rng.range(10, 60); x < w; x += rng.range(70, 170)) {
    if (x > 870 && x < 1150) continue;
    grassTuft(ctx, rng, x, wallY(x) + 3, rng.range(8, 14));
  }
  // Glitzer
  for (let i = 0; i < 260; i++) {
    const x = rng.range(0, w);
    ctx.fillStyle = rng.chance(0.3) ? 'rgba(255,240,210,0.9)' : 'rgba(255,255,255,0.8)';
    ctx.fillRect(x, wallY(x) + rng.range(2, 70), 0.9, 0.9);
  }
  // Lichtpfützen der Laternen und des Glühweinstands
  for (const lx of LAMPS) ellipseGlow(ctx, lx + 20, 654, 110, 20, 'rgba(255,200,130,0.28)');
  ellipseGlow(ctx, HUT.x + 45, 662, 120, 18, 'rgba(255,180,110,0.22)');
}

function paintNear(ctx, w, rng) {
  for (let i = 0; i < NEAR_APPROACH.length; i++) approachMast(ctx, NEAR_APPROACH[i], 588 - i * 16, 668);
  meshFence(ctx, -10, w + 10, 668, 50);
  // Warnschild auf eigenem Pfosten vor dem Zaun (neben dem Versteck im Schneewall)
  const sgx = 858;
  ctx.fillStyle = '#3a3f5c';
  ctx.fillRect(sgx - 1.5, 612, 3, 44);
  ctx.fillStyle = '#f4f4f4';
  rrect(ctx, sgx - 27, 592, 54, 26, 1.5);
  ctx.fill();
  ctx.strokeStyle = '#c8202a';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(sgx - 25, 594, 50, 22);
  ctx.font = `800 6.5px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c8202a';
  ctx.fillText('FLUGHAFEN', sgx, 599.5);
  ctx.font = `700 5.6px ${FONT}`;
  ctx.fillStyle = '#222';
  ctx.fillText('Betreten', sgx, 606.5);
  ctx.fillText('verboten', sgx, 612.5);
  snowCap(ctx, sgx - 28, 592, 56, 2.4, SNOW);
  for (const [lx, ly, , c] of FX.fenceLights) bulb(ctx, c, lx, ly, 3.2, 0.5, 0.85);
  for (const x of LAMPS) lamp(ctx, x, NEAR_GROUND);
  for (const [x, h] of NEAR_TREES) snowPine(ctx, rng, x, NEAR_GROUND, h);
  hut(ctx, rng);
  snowman(ctx, 640, 652);
  spotterHill(ctx, rng);
  car(ctx, 2430, 650);
  snowWall(ctx, rng, w);
}

// --- Animationen pro Frame ---

function obstacleLevel(t) {
  const p = (t / 1.6) % 1;
  return p < 0.55 ? Math.min(1, p * 12) : Math.max(0, 1 - (p - 0.55) * 10);
}

function dynFar(ctx, t, view, q) {
  const a = obstacleLevel(t);
  for (const [x, y, ph] of FX.obstacle) {
    if (!view.isVisible('far', x, 8)) continue;
    flare(ctx, '255,50,40', x, y, 9, ph ? obstacleLevel(t + ph) : a);
  }
  // Riesenrad dreht sich langsam
  const { x, y, r, n } = WHEEL;
  if (!view.isVisible('far', x, r + 4)) return;
  const rot = t * 0.18;
  ctx.strokeStyle = 'rgba(255,225,190,0.35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = rot + (i / 8) * TAU;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
  }
  ctx.stroke();
  const step = q < 0.6 ? 2 : 1;
  for (let i = 0; i < n; i += step) {
    const ang = rot + (i / n) * TAU;
    const hue = (i + Math.floor(t * 4)) % 4;
    const c = hue === 0 ? '255,90,80' : hue === 1 ? '255,214,120' : hue === 2 ? '120,210,130' : '120,180,255';
    flare(ctx, c, x + Math.cos(ang) * r, y + Math.sin(ang) * r, 3.2, 0.95);
  }
  flare(ctx, '255,214,150', x, y, 4, 0.8);
}

function dynMid(ctx, t, view, q) {
  // Tower: Hindernisfeuer + rotierendes Flughafen-Leuchtfeuer (weiß/grün)
  const T = TOWER;
  if (view.isVisible('mid', T.x, 60)) {
    flare(ctx, '255,50,40', T.x, T.ant, 8, obstacleLevel(t));
    const ph = (t * 0.75) % 1;
    const c = ph < 0.5 ? '255,255,240' : '90,255,140';
    const k = Math.max(0, 1 - (Math.abs((ph % 0.5) - 0.25) * 12));
    flare(ctx, c, T.x, T.roof - 10, 6 + k * 22, 0.25 + k * 0.75);
  }
  // Hangar-Hindernisfeuer
  const hx = (HANGAR.x1 + HANGAR.x2) / 2;
  if (view.isVisible('mid', hx, 240)) {
    const a = obstacleLevel(t + 0.2);
    flare(ctx, '255,50,40', hx, HANGAR.apex - 7, 6, a);
    flare(ctx, '255,50,40', HANGAR.x1 + 4, HANGAR.wallTop - 2, 5, a);
    flare(ctx, '255,50,40', HANGAR.x2 - 4, HANGAR.wallTop - 2, 5, a);
  }
  // Radar dreht sich
  const R = RADAR;
  if (view.isVisible('mid', R.x, 40)) {
    const c = Math.cos(t * 2.4);
    const hw = 3 + 19 * Math.abs(c);
    ctx.fillStyle = c > 0 ? '#c9cee6' : '#7f86ac';
    ctx.fillRect(R.x - 1, R.top - 9, 2, 6);
    poly(ctx, [R.x - hw, R.top - 13, R.x + hw, R.top - 13, R.x + hw * 0.9, R.top - 7, R.x - hw * 0.9, R.top - 7]);
    ctx.fill();
    flare(ctx, '255,50,40', R.x, R.top - 15, 5, obstacleLevel(t + 0.4));
  }
  // Weihnachtsbaum funkelt
  if (view.isVisible('mid', XTREE.x, 60)) {
    for (const [x, y, ph, c] of FX.tree) {
      const s = Math.sin(t * 2.3 + ph * 3);
      if (s > 0.45) flare(ctx, c, x, y, 5, (s - 0.45) * 1.6);
    }
    flare(ctx, '255,220,120', XTREE.x, XTREE.base - XTREE.h - 2, 14 + Math.sin(t * 1.7) * 3, 0.55);
  }
  // Lichterkette am Terminal
  const every = q < 0.6 ? 2 : 1;
  for (let i = 0; i < FX.garland.length; i += every) {
    const [x, y, ph, c] = FX.garland[i];
    if (!view.isVisible('mid', x, 6)) continue;
    const s = Math.sin(t * 1.8 + ph * 2);
    if (s > 0.3) flare(ctx, c, x, y, 4, (s - 0.3) * 1.2);
  }
  // Rundumleuchten der Räumfahrzeuge
  for (const [bx, by, ph] of [[62, 517, 0], [1384, 518, 1.4], [192, 517, 2.1], [2193, 517, 0.7]]) {
    if (!view.isVisible('mid', bx, 20)) continue;
    const s = Math.sin(t * 7 + ph);
    flare(ctx, '255,170,30', bx, by, 4 + Math.max(0, s) * 10, 0.35 + Math.max(0, s) * 0.65);
  }
  // Anflug-Lauflicht („Rabbit“) zur Schwelle der 25C
  if (view.isVisible('mid', 2330, 90)) {
    const n = Math.floor((2400 - RWY.x2 - 14) / 14) + 1;
    const p = (t * 2) % 1;
    const i = Math.floor(p * n);
    const x = RWY.x2 + 14 + (n - 1 - i) * 14;
    flare(ctx, '255,255,255', x, RWY.y - 1.5, 16, 1);
  }
}

function dynNear(ctx, t, view, q) {
  // Lauflicht auf den Anflugmasten
  if (view.isVisible('near', 2540, 220)) {
    const p = (t * 2) % 1;
    const idx = NEAR_APPROACH.length - 1 - Math.floor(p * NEAR_APPROACH.length * 1.25);
    if (idx >= 0) {
      const x = NEAR_APPROACH[idx];
      const top = 588 - idx * 16;
      for (let i = 0; i < 5; i += 2) flare(ctx, '255,255,255', x - 14 + i * 7, top + 3, 18, 1);
      flare(ctx, '220,230,255', x, top + 3, 50, 0.35);
    }
  }
  // Lichterketten am Stand und am Zaun
  const lists = [FX.hut, FX.fenceLights];
  for (const list of lists) {
    for (let i = 0; i < list.length; i += q < 0.6 ? 2 : 1) {
      const [x, y, ph, c] = list[i];
      if (!view.isVisible('near', x, 6)) continue;
      const s = Math.sin(t * 2.6 + ph * 3);
      if (s > 0.35) flare(ctx, c, x, y, 7, (s - 0.35) * 1.3);
    }
  }
  // Fotoblitz am Spotterhügel
  const fx = HILL.x1 + 170 + 11;
  if (view.isVisible('near', fx, 40)) {
    const p = t % 5.3;
    if (p < 0.12) flare(ctx, '255,255,255', fx + 10, HILL.top - 41, 60, 1 - p / 0.12);
  }
}

export default {
  id: 'FRA', iata: 'FRA', icao: 'EDDF',
  name: 'Frankfurt am Main', city: 'Frankfurt', country: 'Deutschland',
  subtitle: 'Blaue Stunde über Mainhattan',
  theme: { accent: '#ffc94d', skyTop: '#121b4a', skyBottom: '#ee9568' },
  weather: { snow: 0.8 },
  layerTop: { far: 204, mid: 212, near: 288 }, // near: Spitze der hohen Tanne bei x≈-6 liegt bei y≈292

  paintSky,

  paintLayer(ctx, layerId, { w, rng }) {
    ctx.save();
    if (layerId === 'far') paintFar(ctx, w, rng);
    else if (layerId === 'mid') paintMid(ctx, w, rng);
    else if (layerId === 'near') paintNear(ctx, w, rng);
    ctx.restore();
  },

  drawDynamic(ctx, layerId, { t, view }) {
    if (layerId === 'sky') return;
    const q = view.quality ?? 1;
    ctx.save();
    if (layerId === 'far') dynFar(ctx, t, view, q);
    else if (layerId === 'mid') dynMid(ctx, t, view, q);
    else if (layerId === 'near') dynNear(ctx, t, view, q);
    ctx.restore();
  },

  traffic: {
    planeScale: { far: 0.38, mid: 1.0, near: 2.2 },
    runways: [
      {
        id: '25C', layer: 'mid', y: RWY.y, x1: RWY.x1, x2: RWY.x2, dir: -1,
        use: 'mixed', arrivalsPerMin: 3.6, departuresPerMin: 3.2,
        approach: { startY: 120, lowFlyLayer: null },
      },
    ],
    taxiways: [{ layer: 'mid', y: TWY_Y, x1: 160, x2: 2240 }],
    gates: [
      // door: Abstand der vorderen Tür zu x – trifft die Kabine der Fluggastbrücke (gx − 52 … gx − 39)
      ...GATES_X.map((x) => ({ layer: 'mid', x, y: GATE_Y, dir: -1, door: 48 })),
      ...REMOTE_X.map((x) => ({ layer: 'mid', x, y: GATE_Y, dir: -1 })),
    ],
    overflights: [
      { layer: 'far', yMin: 40, yMax: 180, perMin: 5, contrails: true },
      { layer: 'mid', yMin: 50, yMax: 150, perMin: 1.2, contrails: false },
    ],
    helicopters: 0.4,
    fleet: { narrow: 6, wide: 4, jumbo: 1.6, a380: 0.8, regional: 2, prop: 0.4 },
    liveries: [
      { body: '#f3f4f6', belly: '#dfe3ea', tail: '#0d2150', accent: '#f2b705', cheatline: null, engine: '#0d2150' },
      { body: '#f3f4f6', belly: '#0d2150', tail: '#0d2150', accent: '#f2b705', cheatline: null, engine: '#c9ced6' },
      { body: '#f3f4f6', belly: '#dfe3ea', tail: '#0d2150', accent: '#f2b705', cheatline: '#0d2150', engine: '#0d2150' },
      { body: '#f5f5f2', belly: '#d9dbe0', tail: '#c8202a', accent: '#ffffff', cheatline: '#c8202a', engine: '#c9ced6' },
      { body: '#f4f6f9', belly: '#cfd5df', tail: '#0f6e78', accent: '#7cc8c4', cheatline: null, engine: '#0f6e78' },
      { body: '#eef0f3', belly: '#9aa3b2', tail: '#2c3e64', accent: '#d9a441', cheatline: '#2c3e64', engine: '#c9ced6' },
      { body: '#f4f6f9', belly: '#d9dde3', tail: '#e8742a', accent: '#ffffff', cheatline: null, engine: '#e8742a' },
      { body: '#f4f6f9', belly: '#d9dde3', tail: '#5b2a86', accent: '#e0b0ff', cheatline: '#5b2a86', engine: '#c9ced6' },
      { body: '#f8f6f0', belly: '#e2ddd0', tail: '#1f5e3a', accent: '#d4a83a', cheatline: '#d4a83a', engine: '#1f5e3a' },
    ],
  },

  eagleZones: { far: [50, 330], mid: [60, 400], near: [40, 500] },

  // Flache Oberkanten (x = Mitte, Breite w), y = Oberkante inkl. Schneehaube
  hideSpots: [
    { layer: 'mid', x: 850, y: HALL_HEAD.top - 4, w: 110 },
    { layer: 'mid', x: 560, y: HALL.top - 4, w: 80 },
    { layer: 'mid', x: TOWER.x - 21, y: TOWER.roof - 3, w: 22 },
    { layer: 'mid', x: 2196, y: ANNEX.top - 4, w: 64 },
    { layer: 'mid', x: 118, y: DEPOT.top - 4, w: 80 },
    { layer: 'near', x: 1010, y: 632, w: 120 },
  ],
};
