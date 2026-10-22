// Sint Maarten – Princess Juliana (TNCM): Karibik-Sonnentag, Weihnachten am Maho Beach.
// Anflüge donnern tief über den Strand (Vordergrund) und setzen direkt dahinter auf der kurzen Piste auf.
import { linearSky } from './paint.js';

const TAU = Math.PI * 2;
const FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';

// --- Layout (Ebenen-Koordinaten) ----------------------------------------------
const HORIZON = 452;   // far: Meereshorizont
const MID_BACK = 497;  // mid: Hinterkante des Flughafengeländes
const BASE = 508;      // mid: Gebäude-Grundlinie, Vorfeldbeginn
const GATE_Y = 522;
const TWY_Y = 556;
const RWY_Y = 600;
const RWY_X1 = 150;
const RWY_X2 = 2290;
const ROAD_Y = 618;    // near: Straße hinter dem Zaun
const WALL_Y = 632;    // near: Mäuerchen mit Maschendrahtzaun
const SAND_Y = 639;

const TERM = { x1: 780, x2: 1460, pav1: 1060, pav2: 1180 };
const TOWER_X = 1592;
const TOWER_ROOF = 314;
const BRIDGE_GATES = [850, 1010, 1170, 1330];
const SHIP = { x: 268, w: 200, y: 482 }; // Kreuzfahrtschiff im far-Layer, y = Wasserlinie
const LIFEGUARD = { x: 230, base: 668 };

const BULBS = ['#ff4b55', '#ffd23f', '#38d97a', '#47c6ff', '#ff8ad8'];
const SKIN = ['#f6d3b3', '#eab68c', '#d39a6a', '#a8714a', '#7a4d30', '#5a3824'];
const HAIR = ['#2b1d14', '#4a3020', '#7a4a24', '#c99a4b', '#e8cf8a', '#1a1a1a', '#8a3b1e'];
const SUITS = ['#ff4f6d', '#2b7de9', '#ffcc33', '#22b8a6', '#ff8a3d', '#8e5cf0', '#1f3a68', '#e83f8a'];
const HOUSE_WALLS = ['#ffd6a0', '#ffaaa5', '#9de3e0', '#fff3c4', '#ffc2da', '#c8f0a8', '#ffffff', '#b8d8ff', '#ffe08a'];
const HOUSE_ROOFS = ['#c8553d', '#d9694c', '#2a9d8f', '#eef1f2', '#b5523b', '#3a86c8'];

// --- Kleine Helfer -------------------------------------------------------------
function q(a, b, c, s) { const u = 1 - s; return u * u * a + 2 * u * s * b + s * s * c; }
function dq(a, b, c, s) { return 2 * (1 - s) * (b - a) + 2 * s * (c - b); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
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

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function polyline(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

function text(ctx, str, x, y, size, color, { weight = 'bold', align = 'center', base = 'middle' } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Deterministischer Zufall für Modul-Daten (dynamische Lichter, Boote …)
function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Glanzpunkt-Sprites für drawDynamic (einmal erzeugt, dann nur drawImage)
const spriteCache = new Map();
function lightSprite(color) {
  let c = spriteCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.14, rgba(color, 1));
  gr.addColorStop(0.38, rgba(color, 0.42));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 48, 48);
  spriteCache.set(color, c);
  return c;
}

function flare(ctx, color, x, y, r, a) {
  if (a <= 0.02) return;
  ctx.globalAlpha = a;
  ctx.drawImage(lightSprite(color), x - r, y - r, r * 2, r * 2);
}

// --- Geländelinien -------------------------------------------------------------
// Glatte Kammlinie durch Stützpunkte → dichte Polylinie (für Zeichnen und Höhenabfrage)
function ridge(pts, steps = 8) {
  const out = [pts[0]];
  let a = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const b = pts[i];
    const c = i === pts.length - 2 ? pts[i + 1] : [(b[0] + pts[i + 1][0]) / 2, (b[1] + pts[i + 1][1]) / 2];
    for (let k = 1; k <= steps; k++) {
      const s = k / steps;
      out.push([q(a[0], b[0], c[0], s), q(a[1], b[1], c[1], s)]);
    }
    a = c;
  }
  return out;
}

function ridgeY(line, x) {
  if (x <= line[0][0]) return line[0][1];
  for (let i = 1; i < line.length; i++) {
    if (x <= line[i][0]) {
      const [ax, ay] = line[i - 1];
      const [bx, by] = line[i];
      return ay + ((by - ay) * (x - ax)) / ((bx - ax) || 1);
    }
  }
  return line[line.length - 1][1];
}

function ridgePath(ctx, line, bottom) {
  ctx.beginPath();
  ctx.moveTo(line[0][0], bottom);
  for (const [x, y] of line) ctx.lineTo(x, y);
  ctx.lineTo(line[line.length - 1][0], bottom);
  ctx.closePath();
}

// Üppiger Bewuchs: Baumkronen-Saum auf dem Grat und Tupfen auf dem Hang
function lushSlope(ctx, rng, line, bottom, { edge, dots, count, rMin, rMax, rimR = 0 }) {
  const x0 = line[0][0];
  const x1 = line[line.length - 1][0];
  if (rimR > 0) {
    ctx.fillStyle = edge;
    for (let x = x0 + rimR; x < x1 - rimR; x += rimR * rng.range(0.9, 1.5)) {
      circle(ctx, x, ridgeY(line, x) + rimR * 0.55, rimR * rng.range(0.7, 1.15));
      ctx.fill();
    }
  }
  ctx.save();
  ridgePath(ctx, line, bottom);
  ctx.clip();
  // Baumkronen: dunkle Schattenseite unten links, sonnige Kappe oben rechts
  for (let i = 0; i < count; i++) {
    const x = rng.range(x0, x1);
    const top = ridgeY(line, x);
    const y = top + rng.next() ** 1.4 * (bottom - top);
    const r = rng.range(rMin, rMax);
    const [dark, light] = rng.pick(dots);
    circle(ctx, x - r * 0.12, y + r * 0.12, r, dark);
    circle(ctx, x + r * 0.18, y - r * 0.2, r * 0.62, light);
  }
  ctx.restore();
}

function house(ctx, x, y, w, h, wall, roof, flat) {
  ctx.fillStyle = wall;
  ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = 'rgba(30,60,70,0.16)'; // Schattenseite (Sonne oben rechts)
  ctx.fillRect(x, y - h, w * 0.3, h);
  ctx.fillStyle = roof;
  if (flat) {
    ctx.fillRect(x - 0.6, y - h - 1.3, w + 1.2, 1.6);
  } else {
    poly(ctx, [[x - 0.9, y - h + 0.3], [x + w / 2, y - h - Math.min(h * 0.6, w * 0.45)], [x + w + 0.9, y - h + 0.3]], roof);
  }
  if (w > 5) {
    ctx.fillStyle = 'rgba(25,55,70,0.5)';
    ctx.fillRect(x + w * 0.52, y - h * 0.72, Math.max(0.8, w * 0.17), h * 0.32);
    if (w > 9) ctx.fillRect(x + w * 0.2 + 1, y - h * 0.72, Math.max(0.8, w * 0.14), h * 0.32);
  }
}

// --- Palmen --------------------------------------------------------------------
function palmGeom(x, baseY, h, lean) {
  return { x0: x, y0: baseY, cx: x + h * lean * 0.08, cy: baseY - h * 0.5, tx: x + h * lean, ty: baseY - h, w0: h * 0.062, w1: h * 0.034 };
}
function palmPoint(g, s) { return [q(g.x0, g.cx, g.tx, s), q(g.y0, g.cy, g.ty, s)]; }
function palmNormal(g, s) {
  const dx = dq(g.x0, g.cx, g.tx, s);
  const dy = dq(g.y0, g.cy, g.ty, s);
  const l = Math.hypot(dx, dy) || 1;
  return [-dy / l, dx / l];
}
function palmHalfW(g, s) { return (g.w0 + (g.w1 - g.w0) * s) / 2; }

// [Winkel°, Länge, Hängen, vorne]
const FRONDS = [
  [-160, 0.95, 0.36, 0], [-20, 0.95, 0.36, 0], [-122, 0.74, 0.1, 0], [-58, 0.76, 0.1, 0], [-90, 0.55, 0.0, 0],
  [-179, 0.9, 0.62, 1], [-1, 0.9, 0.62, 1], [-140, 0.86, 0.26, 1], [-40, 0.86, 0.26, 1],
  [160, 0.6, 0.58, 1], [20, 0.6, 0.58, 1], [-102, 0.62, 0.06, 1],
];

function frondGeom(x0, y0, deg, L, droop) {
  const a = (deg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return { x0, y0, cx: x0 + ca * L * 0.55, cy: y0 + sa * L * 0.55 - L * 0.2, ex: x0 + ca * L, ey: y0 + sa * L + L * droop };
}

function frond(ctx, f, L, color, rib) {
  const M = Math.max(10, Math.round(L / 6) * 2);
  const up = [];
  const lo = [];
  for (let i = 0; i <= M; i++) {
    const s = i / M;
    const px = q(f.x0, f.cx, f.ex, s);
    const py = q(f.y0, f.cy, f.ey, s);
    let dx = dq(f.x0, f.cx, f.ex, s);
    let dy = dq(f.y0, f.cy, f.ey, s);
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const wv = L * 0.15 * Math.sin(Math.PI * s) ** 0.7 * (s < 0.12 ? s / 0.12 : 1);
    const k = i % 2 ? 1 : 0.45;
    const k2 = 1.45 - k;
    // Fiederblättchen zeigen leicht zur Spitze und hängen etwas durch
    const g = wv * 0.3;
    up.push([px - dy * wv * k + dx * wv * 0.35 * k, py + dx * wv * k + dy * wv * 0.35 * k + g * k]);
    lo.push([px + dy * wv * k2 + dx * wv * 0.35 * k2, py - dx * wv * k2 + dy * wv * 0.35 * k2 + g * k2]);
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(f.x0, f.y0);
  for (const p of up) ctx.lineTo(p[0], p[1]);
  for (let i = lo.length - 1; i >= 0; i--) ctx.lineTo(lo[i][0], lo[i][1]);
  ctx.closePath();
  ctx.fill();
  if (rib) {
    ctx.strokeStyle = rib;
    ctx.lineWidth = Math.max(0.5, L * 0.012);
    ctx.beginPath();
    ctx.moveTo(f.x0, f.y0);
    ctx.quadraticCurveTo(f.cx, f.cy, f.ex, f.ey);
    ctx.stroke();
  }
}

function palm(ctx, x, baseY, h, {
  lean = 0.1, trunk = '#b0824c', trunkDark = '#86603a', leaf = '#2f9e4f', leafDark = '#1d7339',
  rib = 'rgba(214,245,170,0.55)', coconuts = true, shadow = null,
} = {}) {
  const g = palmGeom(x, baseY, h, lean);
  ctx.save();
  if (shadow) ellipse(ctx, x + h * 0.08, baseY + 1, h * 0.16, h * 0.018, shadow);
  // Stamm: dunkle Grundform, sonnige rechte Hälfte heller
  const N = 18;
  const A = [];
  const B = [];
  const C = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const [px, py] = palmPoint(g, s);
    const [nx, ny] = palmNormal(g, s);
    const hw = palmHalfW(g, s);
    A.push([px + nx * hw, py + ny * hw]);
    B.push([px - nx * hw, py - ny * hw]);
    C.push([px + nx * hw * 0.15, py + ny * hw * 0.15]);
  }
  poly(ctx, [...A, ...B.reverse()], trunkDark);
  B.reverse();
  // A liegt rechts (Normale zeigt nach rechts, solange der Stamm nach oben läuft)
  poly(ctx, [...A, ...C.reverse()], trunk);
  // Ringe
  ctx.strokeStyle = 'rgba(70,42,18,0.42)';
  ctx.lineWidth = Math.max(0.5, h * 0.0055);
  for (let s = 0.035; s < 0.97; s += 0.034) {
    const [px, py] = palmPoint(g, s);
    const [nx, ny] = palmNormal(g, s);
    const hw = palmHalfW(g, s);
    ctx.beginPath();
    ctx.moveTo(px - nx * hw, py - ny * hw);
    ctx.quadraticCurveTo(px + ny * hw * 0.5, py - nx * hw * 0.5 + hw * 0.35, px + nx * hw, py + ny * hw);
    ctx.stroke();
  }
  const L = h * 0.42;
  for (const [deg, len, droop, front] of FRONDS) {
    if (!front) frond(ctx, frondGeom(g.tx, g.ty, deg, L * len, droop), L * len, leafDark, null);
  }
  if (coconuts) {
    const r = h * 0.02;
    for (const [dx, dy] of [[-1, 1.1], [1.1, 1.3], [0.1, 2]]) {
      circle(ctx, g.tx + dx * r, g.ty + dy * r, r, '#6b4824');
      circle(ctx, g.tx + dx * r + r * 0.3, g.ty + dy * r - r * 0.3, r * 0.35, 'rgba(255,220,160,0.35)');
    }
  }
  for (const [deg, len, droop, front] of FRONDS) {
    if (front) frond(ctx, frondGeom(g.tx, g.ty, deg, L * len, droop), L * len, leaf, rib);
  }
  ctx.restore();
  return g;
}

// Spiral-Lichterkette um den Stamm: Draht (nur Vorderseite) + Birnen
function spiralPt(g, s, ph) {
  const [px, py] = palmPoint(g, s);
  const [nx, ny] = palmNormal(g, s);
  const hw = palmHalfW(g, s) * 1.06;
  const u = Math.sin(ph);
  return [px + nx * u * hw, py + ny * u * hw];
}

function palmLights(x, baseY, h, lean, turns, perTurn, s0 = 0.08, s1 = 0.92) {
  const g = palmGeom(x, baseY, h, lean);
  const wire = [];
  let seg = null;
  const N = Math.round(turns * 36);
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    const ph = f * turns * TAU - Math.PI / 2;
    if (Math.cos(ph) > -0.08) {
      if (!seg) wire.push((seg = []));
      seg.push(spiralPt(g, s0 + (s1 - s0) * f, ph));
    } else {
      seg = null;
    }
  }
  const bulbs = [];
  for (let j = 0; j <= turns; j++) {
    for (let k = 0; k < perTurn; k++) {
      const ph = j * TAU + (-0.38 + (0.76 * k) / Math.max(1, perTurn - 1)) * Math.PI;
      const f = (ph + Math.PI / 2) / (turns * TAU);
      if (f < 0 || f > 1) continue;
      bulbs.push(spiralPt(g, s0 + (s1 - s0) * f, ph));
    }
  }
  return { wire, bulbs };
}

// Durchhängende Girlande (Bögen zwischen Aufhängepunkten)
function garland(x1, x2, y, span, sag, step) {
  const wire = [];
  for (let x = x1; x <= x2 + 0.01; x += 2) {
    const f = ((x - x1) % span) / span;
    wire.push([x, y + Math.sin(f * Math.PI) * sag]);
  }
  const bulbs = [];
  for (let x = x1 + step / 2; x < x2; x += step) {
    const f = ((x - x1) % span) / span;
    bulbs.push([x, y + Math.sin(f * Math.PI) * sag + 1.1]);
  }
  return { wire: [wire], bulbs };
}

function straightLights(x1, y1, x2, y2, step) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const bulbs = [];
  for (let d = step / 2; d < len; d += step) bulbs.push([x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len + 0.8]);
  return { wire: [[[x1, y1], [x2, y2]]], bulbs };
}

// Lichter-Register (statisch gemalt, in drawDynamic funkelnd)
function makeLightSet(seed) {
  const rnd = mulberry(seed);
  const set = { wires: [], bulbs: [] };
  set.add = (data, r, colors = BULBS) => {
    set.wires.push(...data.wire);
    for (const [x, y] of data.bulbs) {
      set.bulbs.push({ x, y, r, c: colors[Math.floor(rnd() * colors.length)], p: rnd() * TAU, s: 1.2 + rnd() * 2.4 });
    }
  };
  return set;
}

// Palmen im Vordergrund: [x, Fuß-y, Höhe, Neigung]
const NEAR_PALMS = [[70, 656, 330, 0.13], [1040, 652, 300, -0.11], [1738, 654, 318, 0.09], [2962, 658, 334, -0.14]];
const XMAS_PALM = [2505, 664, 284, 0.05];
// Palmen auf dem Flughafengelände: [x, Höhe, Neigung, Lichterkette]
const MID_PALMS = [
  [118, 74, 0.1], [146, 58, -0.12], [548, 66, 0.12], [704, 84, 0.08, true], [742, 60, -0.1], [905, 90, -0.06],
  [1290, 94, 0.07], [1500, 80, -0.1, true], [1532, 62, 0.12], [1668, 76, 0.1], [1742, 66, -0.08], [2096, 84, 0.1],
  [2146, 64, -0.1], [2336, 78, 0.06],
];
const MID_PALM_Y = MID_BACK + 5;

// Lichter im Vordergrund je Objekt (statisch in Tiefenreihenfolge gemalt), gemeinsam für das Funkeln
const NEAR_PALM_LIGHTS = NEAR_PALMS.map(([x, y, h, lean], i) => {
  const set = makeLightSet(77 + i);
  set.add(palmLights(x, y, h, lean, 6, 3), 1.9);
  return set;
});
const XMAS_LIGHTS = makeLightSet(91);
XMAS_LIGHTS.add(palmLights(XMAS_PALM[0], XMAS_PALM[1], XMAS_PALM[2], XMAS_PALM[3], 10, 4, 0.05, 0.94), 2);
{
  // Lichter an den Wedeln der Weihnachtspalme
  const g = palmGeom(...XMAS_PALM);
  const L = XMAS_PALM[2] * 0.42;
  for (const [deg, len, droop, front] of FRONDS) {
    if (!front) continue;
    const f = frondGeom(g.tx, g.ty, deg, L * len, droop);
    const pts = [];
    for (let s = 0; s <= 1.001; s += 0.05) pts.push([q(f.x0, f.cx, f.ex, s), q(f.y0, f.cy, f.ey, s) + 2]);
    const bulbs = [];
    for (let s = 0.3; s <= 1.0; s += 0.17) bulbs.push([q(f.x0, f.cx, f.ex, s), q(f.y0, f.cy, f.ey, s) + 3]);
    XMAS_LIGHTS.add({ wire: [pts], bulbs }, 2, ['#ffd23f', '#fff1b8', '#ff4b55']);
  }
}
const BAR_LIGHTS = makeLightSet(57);
BAR_LIGHTS.add(garland(1352, 1648, 599, 37, 7, 9.25), 2.1);
const NEAR_LIGHTS = { bulbs: [...NEAR_PALM_LIGHTS, XMAS_LIGHTS, BAR_LIGHTS].flatMap((set) => set.bulbs) };

const MID_LIGHTS = makeLightSet(31);
MID_LIGHTS.add(garland(TERM.x1 - 10, TERM.x2 + 10, 465, 42, 4, 7), 1.15);
MID_LIGHTS.add(straightLights(TOWER_X, 292, TOWER_X - 32, TOWER_ROOF + 1, 4.2), 1.1);
MID_LIGHTS.add(straightLights(TOWER_X, 292, TOWER_X + 32, TOWER_ROOF + 1, 4.2), 1.1);
for (const [x, h, lean, lit] of MID_PALMS) if (lit) MID_LIGHTS.add(palmLights(x, MID_PALM_Y, h, lean, 4, 3), 0.95);

function paintLights(ctx, set, wire = 'rgba(40,50,40,0.55)', wireW = 0.6) {
  ctx.save();
  ctx.strokeStyle = wire;
  ctx.lineWidth = wireW;
  ctx.lineJoin = 'round';
  for (const w of set.wires) if (w.length > 1) polyline(ctx, w);
  for (const b of set.bulbs) {
    circle(ctx, b.x, b.y, b.r, b.c);
    circle(ctx, b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.4, 'rgba(255,255,255,0.75)');
  }
  ctx.restore();
}

// Funkeln: nur sichtbare Birnen, ein Sprite pro Birne
// Detailgrad der Animationen (view.quality), auf schwachen Geräten jede zweite Birne/Glitzerstelle
let quality = 1;

function twinkle(ctx, set, t, x0, x1, scale = 1) {
  const list = set.bulbs;
  const step = quality < 0.6 ? 2 : 1;
  for (let i = 0; i < list.length; i += step) {
    const b = list[i];
    if (b.x < x0 || b.x > x1) continue;
    const v = Math.sin(t * b.s + b.p);
    if (v < 0.1) continue;
    flare(ctx, b.c, b.x, b.y, b.r * 5 * scale, v * 0.9);
  }
}

// --- Himmel --------------------------------------------------------------------
function cumulus(ctx, rng, x, y, w, h, alpha = 1) {
  const n = Math.max(3, Math.round(w / (h * 0.8)));
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    const r = h * (0.36 + 0.55 * Math.sin(Math.PI * f) ** 1.3) * rng.range(0.82, 1.12);
    puffs.push([x + f * w + rng.range(-0.15, 0.15) * (w / n), y - r * 0.5, r]);
  }
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.rect(x - w, y - h * 4, w * 3, h * 4);
  ctx.clip();
  ctx.fillStyle = '#cfe6f4';
  for (const [px, py, r] of puffs) circle(ctx, px, py, r), ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (const [px, py, r] of puffs) circle(ctx, px + r * 0.1, py - r * 0.16, r * 0.88), ctx.fill();
  ctx.restore();
}

function softGlow(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.22, `rgba(${rgb},${a * 0.6})`);
  g.addColorStop(0.55, `rgba(${rgb},${a * 0.18})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function wisp(ctx, rng, x, y, w, alpha) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    ctx.globalAlpha = alpha * rng.range(0.4, 1);
    ellipse(ctx, x + rng.range(0, w), y + rng.range(-6, 6), rng.range(w * 0.15, w * 0.32), rng.range(1.2, 3));
    ctx.fill();
  }
  ctx.restore();
}

function paintSky(ctx, { w, h, rng }) {
  linearSky(ctx, w, h, [
    [0, '#1450bb'], [0.26, '#2479d2'], [0.45, '#43a5e2'], [0.56, '#74c9ec'],
    [0.625, '#ade9f1'], [0.68, '#cdf4f1'], [1, '#d9f6ef'],
  ]);
  const k = clamp(w / 1280, 0.45, 1.25);
  // Sonne oben rechts – relativ zur Breite
  const sx = w * (w < 700 ? 0.76 : 0.83);
  const sy = 86;
  // Strahlende Korona: Verlauf in derselben Farbe nach transparent (kein grauer Ring)
  softGlow(ctx, sx, sy, 330 * k, '255,250,226', 0.42);
  softGlow(ctx, sx, sy, 110 * k + 20, '255,253,240', 0.75);
  softGlow(ctx, sx, sy, 38, '255,255,250', 1);
  circle(ctx, sx, sy, 21, '#fffef6');
  // Feine Schleierwolken hoch oben
  wisp(ctx, rng, w * 0.06, 150, 260 * k, 0.32);
  wisp(ctx, rng, w * 0.42, 205, 200 * k, 0.22);
  // Schönwetter-Kumulus über dem Horizont (Adler fliegen darüber)
  const clouds = [[0.04, 420, 250, 46], [0.27, 386, 130, 30], [0.47, 432, 280, 50], [0.71, 392, 150, 34], [0.88, 424, 230, 44]];
  for (const [fx, y, cw, ch] of clouds) {
    const ww = cw * Math.max(0.6, k);
    cumulus(ctx, rng, w * fx - ww * 0.3, y, ww, ch * Math.max(0.75, k), 0.95);
  }
  // Leichter Dunst am Horizont
  ctx.fillStyle = vgrad(ctx, 400, 470, [[0, 'rgba(225,248,246,0)'], [1, 'rgba(225,248,246,0.6)']]);
  ctx.fillRect(0, 400, w, 70);
}

// --- far: Inseln, Meer, Kreuzfahrtschiff ------------------------------------
// Landmassen enden an der Uferlinie – Segelboote und Glitzern werden davon verdeckt
const WEST_SHORE = 479;
const EAST_SHORE = 484;
const WEST_LINE = ridge([[-30, 478], [-12, 420], [20, 402], [62, 404], [104, 420], [150, 446], [196, 468], [236, 479]]);
const BACK_LINE = ridge([[1098, 484], [1132, 465], [1190, 438], [1262, 404], [1330, 376], [1396, 360], [1458, 348], [1520, 356], [1580, 338], [1642, 330], [1700, 344], [1762, 336], [1830, 348]]);

// Umriss des Kreuzfahrtschiffs (passend zu cruiseShip)
function shipOutline() {
  const { x, w, y } = SHIP;
  return [
    [x + 6, y], [x, y - 16], [x + 10, y - 16], [x + 10, y - 24], [x + 18, y - 24], [x + 18, y - 31], [x + 28, y - 31],
    [x + 28, y - 38], [x + 44, y - 38], [x + 44, y - 44], [x + 66, y - 44], [x + 69, y - 57], [x + 83, y - 57], [x + 84, y - 44],
    [x + 144, y - 44], [x + 144, y - 38], [x + 158, y - 38], [x + 158, y - 31], [x + 172, y - 31], [x + 172, y - 24],
    [x + 176, y - 24], [x + 176, y - 16], [x + w - 16, y - 16], [x + w + 8, y - 18], [x + w - 6, y],
  ];
}

// Clip-Maske „offenes Wasser hinter den Ufern“ (Even-Odd: Gesamtfläche minus Land und Schiff), einmalig erzeugt
let farBackMask = null;
function getFarBackMask() {
  if (farBackMask || typeof Path2D === 'undefined') return farBackMask;
  const p = new Path2D();
  p.rect(-200, 0, 2200, 720);
  const addPoly = (pts) => {
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    p.closePath();
  };
  addPoly([[WEST_LINE[0][0], WEST_SHORE + 0.5], ...WEST_LINE, [WEST_LINE[WEST_LINE.length - 1][0], WEST_SHORE + 0.5]]);
  addPoly([[BACK_LINE[0][0], EAST_SHORE + 0.5], ...BACK_LINE, [1900, BACK_LINE[BACK_LINE.length - 1][1]], [1900, EAST_SHORE + 0.5]]);
  addPoly(shipOutline());
  farBackMask = p;
  return p;
}

function distantIsland(ctx, rng, pts, top, bottom) {
  const ln = ridge(pts);
  ridgePath(ctx, ln, bottom);
  ctx.fillStyle = vgrad(ctx, top, bottom, [[0, '#86b5c3'], [0.65, '#9cc8d1'], [1, '#b6dcdf']]);
  ctx.fill();
  ctx.save();
  ridgePath(ctx, ln, bottom);
  ctx.clip();
  let peak = ln[0];
  for (const p of ln) if (p[1] < peak[1]) peak = p;
  const x0 = pts[0][0];
  const x1 = pts[pts.length - 1][0];
  // Schattenseite links vom Gipfel: weiche, geschwungene Lichtkante statt harter Fläche
  ctx.fillStyle = hgrad(ctx, x0, peak[0] + 10, [[0, 'rgba(70,115,140,0.16)'], [1, 'rgba(70,115,140,0.04)']]);
  ctx.beginPath();
  ctx.moveTo(x0 - 5, bottom);
  ctx.lineTo(x0 - 5, top - 10);
  ctx.lineTo(peak[0] - 2, top - 10);
  ctx.quadraticCurveTo(peak[0] - (peak[0] - x0) * 0.1, (peak[1] + bottom) / 2, peak[0] - (peak[0] - x0) * 0.45, bottom);
  ctx.closePath();
  ctx.fill();
  // Sonnenseite: zarter Glanz entlang der Flanke
  ctx.fillStyle = hgrad(ctx, peak[0], x1, [[0, 'rgba(255,255,255,0.13)'], [1, 'rgba(255,255,255,0.02)']]);
  ctx.fillRect(peak[0], top - 10, x1 - peak[0], bottom - top + 10);
  // Angedeutete Täler: sehr flache, weiche Bänder hangabwärts
  for (let i = 0; i < 4; i++) {
    const x = rng.range(pts[2][0], pts[pts.length - 3][0]);
    const y = ridgeY(ln, x) + 4;
    const len = (bottom - y) * rng.range(0.4, 0.75);
    const lean = (x < peak[0] ? -1 : 1) * rng.range(0.15, 0.35) * len;
    ctx.fillStyle = vgrad(ctx, y, y + len, [[0, 'rgba(70,115,140,0)'], [0.4, 'rgba(70,115,140,0.07)'], [1, 'rgba(70,115,140,0)']]);
    poly(ctx, [[x - 1.5, y], [x + 1.5, y], [x + lean + 6, y + len], [x + lean - 6, y + len]]);
    ctx.fill();
  }
  // Dunst am Fuß (Luftperspektive)
  ctx.fillStyle = vgrad(ctx, bottom - 26, bottom, [[0, 'rgba(214,240,240,0)'], [1, 'rgba(214,240,240,0.55)']]);
  ctx.fillRect(x0 - 5, bottom - 26, x1 - x0 + 10, 26);
  ctx.restore();
  return ln;
}

function cruiseShip(ctx) {
  const { x, w, y } = SHIP;
  ctx.save();
  // Kielwasser
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  poly(ctx, [[x - 60, y + 1.5], [x + 4, y - 0.5], [x + 4, y + 2.2], [x - 60, y + 3]]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ellipse(ctx, x + w * 0.5, y + 1.2, w * 0.55, 1.6);
  ctx.fill();
  // Rumpf (Bug rechts)
  const hull = [[x, y - 16], [x + w - 16, y - 16], [x + w + 8, y - 18], [x + w - 6, y], [x + 6, y]];
  poly(ctx, hull, '#ffffff');
  ctx.fillStyle = '#1d3f6e';
  poly(ctx, [[x + 3, y - 3.5], [x + w - 4, y - 3.5], [x + w - 6, y], [x + 6, y]]);
  ctx.fill();
  ctx.fillStyle = '#21a5b8';
  ctx.fillRect(x + 2, y - 6, w - 6, 1.4);
  // Bullaugen
  ctx.fillStyle = 'rgba(30,60,90,0.6)';
  for (let px = x + 10; px < x + w - 14; px += 4) ctx.fillRect(px, y - 11, 2, 1.2);
  // Decksaufbauten
  const decks = [[x + 10, w - 34, 8], [x + 18, w - 52, 7], [x + 28, w - 70, 7], [x + 44, w - 100, 6]];
  let dy = y - 16;
  for (const [dx, dw, dh] of decks) {
    ctx.fillStyle = '#f7f9fb';
    ctx.fillRect(dx, dy - dh, dw, dh);
    ctx.fillStyle = 'rgba(40,80,120,0.55)';
    ctx.fillRect(dx + 2, dy - dh + 2, dw - 6, 2);
    ctx.fillStyle = 'rgba(150,170,190,0.5)';
    ctx.fillRect(dx, dy - 0.8, dw, 0.8);
    dy -= dh;
  }
  // Rettungsboote
  ctx.fillStyle = '#ff8c2b';
  for (let px = x + 16; px < x + w - 40; px += 13) ctx.fillRect(px, y - 21, 8, 2.4);
  // Schornstein
  poly(ctx, [[x + 66, dy], [x + 69, dy - 13], [x + 83, dy - 13], [x + 84, dy]], '#ffffff');
  ctx.fillStyle = '#1d3f6e';
  ctx.fillRect(x + 68.6, dy - 13, 14.6, 3.5);
  ctx.fillStyle = '#21a5b8';
  ctx.fillRect(x + 68, dy - 8, 15.5, 1.6);
  // Über die Toppen geflaggt
  const mastX = x + w - 60;
  const mastTop = dy - 9;
  const flagRun = (ax, ay, bx, by) => {
    const n = Math.floor(Math.hypot(bx - ax, by - ay) / 3);
    for (let i = 1; i < n; i++) {
      const f = i / n;
      ctx.fillStyle = BULBS[i % BULBS.length];
      ctx.fillRect(ax + (bx - ax) * f - 0.6, ay + (by - ay) * f + Math.sin(f * Math.PI) * 1.5, 1.2, 1.3);
    }
  };
  flagRun(x + w + 7, y - 18, mastX + 0.6, mastTop);
  flagRun(mastX + 0.6, mastTop, x + 40, dy - 2);
  // Brücke + Mast am Bug
  ctx.fillStyle = 'rgba(30,60,90,0.75)';
  ctx.fillRect(x + w - 48, y - 29, 20, 2);
  ctx.fillStyle = '#e8edf2';
  ctx.fillRect(x + w - 60, dy - 9, 1.2, 9);
  ctx.restore();
  return dy; // Oberkante oberstes Deck
}

function paintFar(ctx, rng) {
  // Ferne Nachbarinseln (Saba, Sint Eustatius) mit Dunst
  distantIsland(ctx, rng, [[350, 452], [400, 446], [442, 428], [478, 394], [506, 372], [530, 365], [552, 368], [575, 384], [610, 414], [652, 438], [708, 452]], 360, 452);
  cumulus(ctx, rng, 488, 372, 80, 16, 0.85);
  distantIsland(ctx, rng, [[870, 452], [915, 445], [958, 430], [994, 419], [1030, 425], [1060, 428], [1086, 410], [1110, 394], [1126, 390], [1138, 397], [1150, 391], [1176, 402], [1214, 428], [1255, 446], [1300, 452]], 388, 452);

  // Meer
  ctx.fillStyle = vgrad(ctx, HORIZON, 720, [[0, '#1c68a3'], [0.06, '#2385b6'], [0.2, '#2fa9c5'], [0.45, '#48c7cb'], [1, '#6fdacf']]);
  ctx.fillRect(-10, HORIZON, 1820, 720 - HORIZON);
  ctx.fillStyle = 'rgba(235,252,250,0.65)';
  ctx.fillRect(-10, HORIZON - 0.6, 1820, 1.4);
  // Wellenstreifen
  for (let i = 0; i < 260; i++) {
    const y = HORIZON + 3 + rng.next() ** 1.3 * 260;
    const len = 6 + (y - HORIZON) * 0.25 * rng.range(0.5, 1.4);
    ctx.fillStyle = rng.chance(0.6) ? 'rgba(255,255,255,0.22)' : 'rgba(10,70,110,0.16)';
    ctx.fillRect(rng.range(-20, 1800), y, len, 0.6 + (y - HORIZON) * 0.006);
  }

  // Sint-Maarten-Landzunge links (endet an der Uferlinie, davor wieder Wasser)
  const west = WEST_LINE;
  ridgePath(ctx, west, WEST_SHORE);
  ctx.fillStyle = vgrad(ctx, 400, 480, [[0, '#62ad7f'], [1, '#3f8a64']]);
  ctx.fill();
  lushSlope(ctx, rng, west, 480, { edge: '#5aa877', dots: [['#4a9468', '#62ad80'], ['#54a072', '#6cb78a']], count: 110, rMin: 1.6, rMax: 3.2, rimR: 3.2 });
  for (let i = 0; i < 14; i++) {
    const x = rng.range(0, 170);
    const y = ridgeY(west, x) + rng.range(8, 34);
    if (y < 474) house(ctx, x, y, rng.range(4, 7), rng.range(3, 5), rng.pick(HOUSE_WALLS), rng.pick(HOUSE_ROOFS), rng.chance(0.3));
  }
  shore(ctx, west, -10, 240, 478);

  // Sint-Maarten-Hügel rechts (zwei Kämme, vorne mit bunten Häusern)
  const back = BACK_LINE;
  ridgePath(ctx, back, EAST_SHORE);
  ctx.fillStyle = vgrad(ctx, 330, 480, [[0, '#79b39b'], [1, '#5e9d85']]);
  ctx.fill();
  lushSlope(ctx, rng, back, 480, { edge: '#72ad95', dots: [['#6aa38b', '#7db59c'], ['#70a990', '#84bba2']], count: 140, rMin: 2, rMax: 3.6, rimR: 3.6 });
  const front = ridge([[1150, 482], [1214, 464], [1282, 440], [1352, 420], [1424, 410], [1490, 398], [1552, 390], [1616, 382], [1676, 392], [1736, 378], [1800, 386], [1840, 392]]);
  ridgePath(ctx, front, EAST_SHORE);
  ctx.fillStyle = vgrad(ctx, 380, 484, [[0, '#6cb860'], [0.5, '#4f9f50'], [1, '#3c8847']]);
  ctx.fill();
  lushSlope(ctx, rng, front, 484, { edge: '#63b05a', dots: [['#46914a', '#62ae5b'], ['#4f9a4d', '#6cb862'], ['#3f8644', '#58a453']], count: 420, rMin: 1.8, rMax: 3.8, rimR: 3.8 });
  // Häuser am Hang, unten dichter
  for (let i = 0; i < 70; i++) {
    const x = rng.range(1190, 1810);
    const top = ridgeY(front, x);
    const y = top + 10 + rng.next() ** 0.8 * (480 - top - 14);
    house(ctx, x, y, rng.range(5, 10), rng.range(3.5, 6), rng.pick(HOUSE_WALLS), rng.pick(HOUSE_ROOFS), rng.chance(0.35));
  }
  // Kleine Kirche mit Turm
  house(ctx, 1470, 452, 12, 7, '#ffffff', '#c8553d', false);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(1480, 438, 4, 14);
  poly(ctx, [[1479.4, 438], [1482, 431], [1484.6, 438]], '#c8553d');
  shore(ctx, back, 1098, 1810, 483);

  // Ankernde Yacht und Katamaran (die Segelboote fahren in drawDynamic)
  yacht(ctx, 820, 474, 0.9);
  yacht(ctx, 1040, 468, 0.7);
  catamaran(ctx, 196, 486, 1);

  const deckY = cruiseShip(ctx);
  return deckY;
}

// Sandsaum + Brandungslinie entlang der Uferlinie y, nur wo Land ist (läuft an den Landspitzen aus)
function shore(ctx, line, x0, x1, y) {
  ctx.save();
  const top = [];
  for (let x = x0; x <= x1; x += 3) top.push([x, Math.max(y - 2.2, Math.min(y + 0.4, ridgeY(line, x)))]);
  ctx.fillStyle = '#f3e6c4';
  ctx.beginPath();
  ctx.moveTo(x0, y + 0.4);
  for (const [x, ty] of top) ctx.lineTo(x, ty);
  ctx.lineTo(top[top.length - 1][0], y + 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const [x, ty] of top) if (ty < y - 0.4) ctx.fillRect(x - 0.1, y + 0.3, 3.2, 1);
  ctx.restore();
}

function yacht(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  poly(ctx, [[-16, -5], [16, -5], [20, -7], [12, 0], [-14, 0]], '#ffffff');
  ctx.fillStyle = '#1d3f6e';
  ctx.fillRect(-14, -1.5, 26, 1.5);
  poly(ctx, [[-8, -5], [8, -5], [5, -9], [-6, -9]], '#f4f6f8');
  ctx.fillStyle = 'rgba(30,60,90,0.7)';
  ctx.fillRect(-5, -8, 9, 1.4);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-22, 0.4, 44, 0.8);
  ctx.restore();
}

function catamaran(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-12, -3, 24, 3);
  ctx.fillStyle = '#e8eef2';
  ctx.fillRect(-7, -5, 12, 2);
  ctx.fillStyle = '#dfe6ea';
  ctx.fillRect(-0.5, -30, 1, 25);
  poly(ctx, [[0.5, -29], [0.5, -6], [12, -6]], '#ffffff');
  poly(ctx, [[-0.5, -27], [-0.5, -7], [-10, -7]], '#fff1d6');
  ctx.restore();
}

function sailboat(ctx, x, y, s, sail, hull) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  poly(ctx, [[-9, -3], [10, -3], [7, 0], [-7, 0]], hull);
  ctx.fillStyle = '#d9dee2';
  ctx.fillRect(-0.4, -26, 0.8, 23);
  poly(ctx, [[0.6, -25], [0.6, -4], [11, -4]], sail);
  poly(ctx, [[-0.6, -21], [-0.6, -4.5], [-8, -4.5]], '#ffffff');
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-12, 0.3, 24, 0.7);
  ctx.restore();
}

// --- mid: Flughafen --------------------------------------------------------------
function paintMidHill(ctx, rng) {
  const ln = ridge([[1850, 500], [1920, 488], [1990, 456], [2060, 424], [2130, 394], [2198, 368], [2262, 352], [2322, 356], [2380, 372], [2440, 392]]);
  ridgePath(ctx, ln, 520);
  ctx.fillStyle = vgrad(ctx, 350, 500, [[0, '#62b04f'], [0.55, '#4d9d45'], [1, '#3d8a3e']]);
  ctx.fill();
  lushSlope(ctx, rng, ln, 505, { edge: '#5aab4b', dots: [['#3f8d3f', '#5eae50'], ['#48964a', '#6dbb5c'], ['#367f3a', '#55a64c'], ['#4d9b45', '#7cc565']], count: 460, rMin: 2.4, rMax: 5, rimR: 5 });
  // Bunte Villen am Hang
  for (let i = 0; i < 34; i++) {
    const x = rng.range(1950, 2400);
    const top = ridgeY(ln, x);
    const y = top + 12 + rng.next() * (500 - top - 20);
    house(ctx, x, y, rng.range(9, 16), rng.range(6, 10), rng.pick(HOUSE_WALLS), rng.pick(HOUSE_ROOFS), rng.chance(0.3));
  }
  // Funkmast auf der Kuppe
  ctx.strokeStyle = '#d24b3e';
  ctx.lineWidth = 1.4;
  line(ctx, 2262, 353, 2262, 300);
  ctx.strokeStyle = 'rgba(240,240,240,0.9)';
  for (let y = 306; y < 352; y += 10) line(ctx, 2261.3, y, 2262.7, y + 5);
  ctx.strokeStyle = 'rgba(80,80,80,0.5)';
  ctx.lineWidth = 0.5;
  line(ctx, 2262, 312, 2244, 360);
  line(ctx, 2262, 312, 2280, 358);
  return ln;
}

function bushRow(ctx, rng, x0, x1, y) {
  for (let x = x0; x < x1; x += rng.range(5, 11)) {
    const r = rng.range(3.5, 7.5);
    circle(ctx, x, y - r * 0.4, r, rng.pick(['#3f8f45', '#4fa552', '#5db85c', '#357d3c']));
    if (rng.chance(0.18)) {
      // Bougainvillea
      ctx.fillStyle = rng.pick(['#e83f8a', '#ff6fae', '#f2a541']);
      for (let k = 0; k < 4; k++) circle(ctx, x + rng.range(-r, r) * 0.7, y - r * 0.4 + rng.range(-r, r) * 0.6, rng.range(0.8, 1.6)), ctx.fill();
    }
  }
}

function hangars(ctx, rng) {
  // Halle 1: Tonnendach, Tore teils offen
  const x1 = 175;
  const x2 = 375;
  const wallTop = 468;
  ctx.save();
  ctx.fillStyle = '#e7ebee';
  ctx.beginPath();
  ctx.moveTo(x1, BASE);
  ctx.lineTo(x1, wallTop);
  ctx.quadraticCurveTo((x1 + x2) / 2, 424, x2, wallTop);
  ctx.lineTo(x2, BASE);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#a9b5be';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1 - 2, wallTop + 1);
  ctx.quadraticCurveTo((x1 + x2) / 2, 422, x2 + 2, wallTop + 1);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(x1, wallTop, 30, BASE - wallTop);
  // Tore
  const d1 = x1 + 14;
  const d2 = x2 - 14;
  ctx.fillStyle = '#2f363c';
  ctx.fillRect(d1, 474, d2 - d1, BASE - 474);
  ctx.fillStyle = 'rgba(255,240,200,0.25)';
  ctx.fillRect(d1 + 70, 476, 34, 3);
  ctx.fillStyle = '#d3dade';
  ctx.fillRect(d1, 474, 64, BASE - 474);
  ctx.fillRect(d2 - 56, 474, 56, BASE - 474);
  ctx.strokeStyle = 'rgba(120,135,145,0.6)';
  ctx.lineWidth = 0.7;
  for (let x = d1 + 8; x < d1 + 64; x += 8) line(ctx, x, 474, x, BASE);
  for (let x = d2 - 48; x < d2; x += 8) line(ctx, x, 474, x, BASE);
  ctx.fillStyle = '#c0c9cf';
  ctx.fillRect(d1 - 2, 471, d2 - d1 + 4, 3);
  text(ctx, 'HANGAR 1', (x1 + x2) / 2, 456, 8, '#3d5a73');
  ctx.restore();

  // Halle 2: Flachdach (Versteck), türkiser Streifen
  const h1 = 395;
  const h2 = 522;
  ctx.fillStyle = '#f5f1e8';
  ctx.fillRect(h1, 458, h2 - h1, BASE - 458);
  ctx.fillStyle = '#2ab3a6';
  ctx.fillRect(h1, 461, h2 - h1, 5);
  ctx.fillStyle = '#d9d4c8';
  ctx.fillRect(h1 - 2, 456, h2 - h1 + 4, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.fillRect(h1, 458, 16, BASE - 458);
  for (const dx of [12, 68]) {
    ctx.fillStyle = '#dfe3e6';
    ctx.fillRect(h1 + dx, 476, 46, BASE - 476);
    ctx.fillStyle = 'rgba(120,130,140,0.45)';
    for (let y = 479; y < BASE; y += 3) ctx.fillRect(h1 + dx, y, 46, 0.6);
  }
  ctx.fillStyle = '#5bb8c9';
  for (let x = h1 + 10; x < h2 - 10; x += 14) ctx.fillRect(x, 468, 9, 4);

  // Tanklager
  for (const [x, hh] of [[602, 22], [628, 27], [654, 20]]) {
    const top = BASE - hh;
    ctx.fillStyle = hgrad(ctx, x - 11, x + 11, [[0, '#c9cfd3'], [0.6, '#ffffff'], [1, '#e3e7ea']]);
    ctx.fillRect(x - 11, top, 22, hh);
    ellipse(ctx, x, top, 11, 2.6, '#f4f6f7');
    ctx.fillStyle = '#e64b3c';
    ctx.fillRect(x - 11, top + 4, 22, 1.5);
    ctx.strokeStyle = 'rgba(90,100,110,0.6)';
    ctx.lineWidth = 0.6;
    line(ctx, x + 7, top, x + 7, BASE);
  }
}

function terminal(ctx, rng) {
  const { x1, x2, pav1, pav2 } = TERM;
  const eave = 462;
  const ridgeY0 = 446;
  ctx.save();
  // Wand
  ctx.fillStyle = '#f7eedb';
  ctx.fillRect(x1, eave, x2 - x1, BASE - eave);
  // Obergeschoss: Glasfassade mit Himmelsspiegelung
  ctx.fillStyle = vgrad(ctx, 467, 484, [[0, '#9fe0ea'], [0.5, '#5cbfd0'], [1, '#3d9fb5']]);
  ctx.fillRect(x1 + 6, 467, x2 - x1 - 12, 17);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let x = x1 + 20; x < x2 - 30; x += 64) {
    poly(ctx, [[x, 484], [x + 10, 467], [x + 22, 467], [x + 12, 484]]);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(240,250,250,0.7)';
  for (let x = x1 + 6; x < x2 - 6; x += 10.5) ctx.fillRect(x, 467, 0.8, 17);
  // Decke
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x1, 484, x2 - x1, 3.5);
  // Erdgeschoss: Glas und Türen
  ctx.fillStyle = vgrad(ctx, 489, BASE, [[0, '#3f8e9e'], [1, '#2b6f80']]);
  ctx.fillRect(x1 + 6, 489, x2 - x1 - 12, BASE - 489);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  for (let x = x1 + 6; x < x2 - 6; x += 14) ctx.fillRect(x, 489, 0.8, BASE - 489);
  ctx.fillStyle = 'rgba(255,230,170,0.35)';
  for (let x = x1 + 30; x < x2 - 30; x += 52) ctx.fillRect(x, 491, 22, 2);
  // Karibische Farblamellen
  const fins = ['#ff7f6e', '#ffc94d', '#2ec4b6', '#ff9fb2', '#5aa9f0'];
  let k = 0;
  for (let x = x1 + 18; x < x2 - 10; x += 34) {
    ctx.fillStyle = fins[k++ % fins.length];
    ctx.fillRect(x, 465, 4, BASE - 465);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, 465, 1.3, BASE - 465);
  }
  // Seitenwände
  ctx.fillStyle = '#f2e5cc';
  ctx.fillRect(x1, eave, 8, BASE - eave);
  ctx.fillRect(x2 - 8, eave, 8, BASE - eave);
  // Walmdach mit Stehfalz
  const roof = [[x1 - 14, eave + 1], [x1 + 30, ridgeY0], [x2 - 30, ridgeY0], [x2 + 14, eave + 1]];
  poly(ctx, roof, vgrad(ctx, ridgeY0, eave, [[0, '#3dbdaa'], [1, '#23887c']]));
  ctx.save();
  poly(ctx, roof);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  for (let x = x1 - 14; x < x2 + 14; x += 7) ctx.fillRect(x, ridgeY0, 0.8, eave - ridgeY0);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  poly(ctx, [[x1 - 14, eave + 1], [x1 + 30, ridgeY0], [x1 + 36, ridgeY0], [x1 - 6, eave + 1]]);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#e9f7f4';
  ctx.fillRect(x1 + 30, ridgeY0 - 1, x2 - x1 - 60, 1.6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x1 - 14, eave, x2 - x1 + 28, 3);

  // Mittelpavillon mit Atrium und Pyramidendach
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pav1, 446, pav2 - pav1, BASE - 446);
  ctx.fillStyle = vgrad(ctx, 458, BASE, [[0, '#a8e6ee'], [0.55, '#55b8cb'], [1, '#2f8597']]);
  ctx.fillRect(pav1 + 10, 458, pav2 - pav1 - 20, BASE - 458);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.7;
  for (let x = pav1 + 10; x <= pav2 - 10; x += 12.5) line(ctx, x, 458, x, BASE);
  for (let y = 466; y < BASE; y += 9) line(ctx, pav1 + 10, y, pav2 - 10, y);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  poly(ctx, [[pav1 + 20, BASE], [pav1 + 50, 458], [pav1 + 62, 458], [pav1 + 32, BASE]]);
  ctx.fill();
  ctx.fillStyle = '#2a9d8f';
  ctx.fillRect(pav1 + 4, 448, pav2 - pav1 - 8, 9);
  text(ctx, 'PRINCESS JULIANA', (pav1 + pav2) / 2, 452.8, 6.6, '#ffffff');
  const mx = (pav1 + pav2) / 2;
  poly(ctx, [[pav1 - 8, 447], [mx, 411], [pav2 + 8, 447]], '#2b9e90');
  poly(ctx, [[mx, 411], [pav2 + 8, 447], [mx, 447]], '#3cbcab');
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 1; i < 6; i++) line(ctx, mx, 411, pav1 - 8 + ((pav2 - pav1 + 16) * i) / 6, 447);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(mx - 7, 404, 14, 8);
  ctx.fillStyle = '#5cbfd0';
  ctx.fillRect(mx - 5, 405.5, 10, 4.5);
  poly(ctx, [[mx - 9, 404], [mx, 398], [mx + 9, 404]], '#2b9e90');
  star(ctx, mx, 390, 7, '#ffd23f', '#ffb300');
  ctx.restore();
}

function star(ctx, x, y, r, fill, edge) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr2 = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = r * 0.12;
    ctx.stroke();
  }
}

function jetBridge(ctx, gx) {
  const rx = gx + 10;
  const ex = gx - 46;
  const ey = 492;
  ctx.save();
  // Rotunde am Terminal
  ctx.fillStyle = hgrad(ctx, rx - 7, rx + 7, [[0, '#b9c2c8'], [0.6, '#e9edef'], [1, '#c9d1d6']]);
  ctx.fillRect(rx - 7, 470, 14, BASE + 8 - 470);
  ctx.fillStyle = '#9aa6ae';
  ctx.fillRect(rx - 8, 468, 16, 3);
  // Tunnel mit Fensterband
  poly(ctx, [[rx - 6, 472], [ex + 7, ey - 7], [ex + 7, ey + 4], [rx - 6, 483]], '#e4e8ea');
  poly(ctx, [[rx - 6, 474.5], [ex + 7, ey - 4.6], [ex + 7, ey - 2.8], [rx - 6, 476.3]], 'rgba(40,90,110,0.55)');
  poly(ctx, [[rx - 6, 481], [ex + 7, ey + 2], [ex + 7, ey + 4], [rx - 6, 483]], 'rgba(0,0,0,0.12)');
  // Kabine mit Faltenbalg
  ctx.fillStyle = '#cfd6da';
  ctx.fillRect(ex - 7, ey - 9, 15, 15);
  ctx.fillStyle = '#3a4248';
  ctx.fillRect(ex - 9, ey - 8, 3, 13);
  // Stütze und Fahrwerk
  ctx.fillStyle = '#7d878e';
  ctx.fillRect(ex + 1, ey + 6, 3, GATE_Y - 4 - (ey + 6));
  ctx.fillStyle = '#5b646b';
  ctx.fillRect(ex - 4, GATE_Y - 6, 13, 3);
  circle(ctx, ex - 1, GATE_Y - 2.5, 2.3, '#2c3236');
  circle(ctx, ex + 6, GATE_Y - 2.5, 2.3, '#2c3236');
  ctx.restore();
}

function towerMid(ctx) {
  const x = TOWER_X;
  const shaftTop = 352;
  ctx.save();
  // Sockelgebäude
  ctx.fillStyle = '#f4f0e7';
  ctx.fillRect(x - 36, 478, 72, BASE - 478);
  ctx.fillStyle = '#2ab3a6';
  ctx.fillRect(x - 36, 478, 72, 3);
  ctx.fillStyle = '#4fa9bd';
  for (let wx = x - 30; wx < x + 30; wx += 12) ctx.fillRect(wx, 486, 8, 7);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.fillRect(x - 36, 478, 10, BASE - 478);
  // Schaft
  poly(ctx, [[x - 13, 479], [x - 10, shaftTop], [x + 10, shaftTop], [x + 13, 479]], hgrad(ctx, x - 13, x + 13, [[0, '#d8d4cc'], [0.55, '#faf8f3'], [1, '#e7e3da']]));
  poly(ctx, [[x - 3.4, 479], [x - 2.6, shaftTop], [x + 2.6, shaftTop], [x + 3.4, 479]], '#2ab3a6');
  ctx.fillStyle = 'rgba(40,90,110,0.55)';
  for (let y = 370; y < 470; y += 22) ctx.fillRect(x + 5.5, y, 2.2, 6);
  // Kragen
  poly(ctx, [[x - 11, shaftTop + 1], [x - 27, shaftTop - 9], [x + 27, shaftTop - 9], [x + 11, shaftTop + 1]], '#ebe7de');
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  poly(ctx, [[x - 11, shaftTop + 1], [x - 27, shaftTop - 9], [x - 18, shaftTop - 9], [x - 6, shaftTop + 1]]);
  ctx.fill();
  // Kanzel
  const g1 = shaftTop - 9;
  const g0 = TOWER_ROOF + 6;
  poly(ctx, [[x - 27, g1], [x - 32, g0], [x + 32, g0], [x + 27, g1]], vgrad(ctx, g0, g1, [[0, '#2f7f86'], [1, '#1d565d']]));
  ctx.fillStyle = 'rgba(200,250,250,0.3)';
  poly(ctx, [[x - 18, g1], [x - 10, g0], [x - 3, g0], [x - 11, g1]]);
  ctx.fill();
  poly(ctx, [[x + 8, g1], [x + 15, g0], [x + 19, g0], [x + 12, g1]]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235,240,240,0.85)';
  ctx.lineWidth = 0.8;
  for (const f of [-0.66, -0.33, 0, 0.33, 0.66]) line(ctx, x + f * 27, g1, x + f * 32, g0);
  // Dach (flach – Versteck)
  ctx.fillStyle = '#f7f5f0';
  ctx.fillRect(x - 36, TOWER_ROOF, 72, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 36, TOWER_ROOF + 5, 72, 1.2);
  // Leuchtfeuer-Gehäuse und Antenne
  ctx.fillStyle = '#d9dde0';
  ctx.fillRect(x + 16, TOWER_ROOF - 5, 7, 5);
  ctx.fillStyle = '#c6ccd0';
  ctx.fillRect(x - 0.8, 292, 1.6, TOWER_ROOF - 292);
  ctx.fillRect(x - 22, TOWER_ROOF - 8, 1, 8);
  ctx.fillRect(x - 26, TOWER_ROOF - 3, 8, 1);
  ctx.restore();
}

function fireStation(ctx) {
  const x1 = 1760;
  const x2 = 1880;
  ctx.save();
  ctx.fillStyle = '#f6f2ea';
  ctx.fillRect(x1, 470, x2 - x1, BASE - 470);
  ctx.fillStyle = '#d62839';
  ctx.fillRect(x1 - 2, 467, x2 - x1 + 4, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.fillRect(x1, 470, 12, BASE - 470);
  for (let i = 0; i < 3; i++) {
    const dx = x1 + 10 + i * 36;
    ctx.fillStyle = '#e63946';
    ctx.fillRect(dx, 482, 30, BASE - 482);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let wx = dx + 3; wx < dx + 27; wx += 6.6) ctx.fillRect(wx, 486, 4.6, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 492; y < BASE; y += 3.2) ctx.fillRect(dx, y, 30, 0.5);
  }
  text(ctx, 'FEUERWEHR', (x1 + x2) / 2, 476, 7, '#c81d2e');
  // Schlauchturm
  ctx.fillStyle = '#efe9de';
  ctx.fillRect(x2 - 16, 446, 14, 24);
  ctx.fillStyle = '#d62839';
  ctx.fillRect(x2 - 17, 444, 16, 3);
  ctx.restore();
}

function cargoShed(ctx) {
  const x1 = 1900;
  const x2 = 2082;
  ctx.save();
  ctx.fillStyle = '#c3d0da';
  ctx.fillRect(x1, 462, x2 - x1, BASE - 462);
  ctx.fillStyle = 'rgba(80,100,120,0.25)';
  for (let x = x1; x < x2; x += 3) ctx.fillRect(x, 462, 0.7, BASE - 462);
  ctx.fillStyle = '#8fa2b1';
  ctx.fillRect(x1 - 2, 459, x2 - x1 + 4, 4);
  for (let i = 0; i < 4; i++) {
    const dx = x1 + 12 + i * 43;
    ctx.fillStyle = '#e6eaed';
    ctx.fillRect(dx, 482, 32, BASE - 482);
    ctx.fillStyle = 'rgba(90,100,110,0.4)';
    for (let y = 484; y < BASE; y += 2.6) ctx.fillRect(dx, y, 32, 0.5);
  }
  ctx.fillStyle = '#1f3a68';
  ctx.fillRect(x1 + 60, 466, 62, 11);
  text(ctx, 'CARGO', x1 + 91, 471.8, 8, '#ffffff');
  ctx.restore();
}

function paintRunway(ctx, rng) {
  const y0 = RWY_Y - 10;
  const y1 = RWY_Y + 10;
  ctx.save();
  ctx.fillStyle = '#b3b0a4';
  ctx.fillRect(RWY_X1 - 22, y0 - 3, RWY_X2 - RWY_X1 + 44, y1 - y0 + 6);
  ctx.fillStyle = vgrad(ctx, y0, y1, [[0, '#62656b'], [1, '#4b4e54']]);
  ctx.fillRect(RWY_X1, y0, RWY_X2 - RWY_X1, y1 - y0);
  // Gummiabrieb in den Aufsetzzonen
  for (let i = 0; i < 70; i++) {
    const left = i < 45;
    const x = left ? rng.range(RWY_X1 + 120, RWY_X1 + 700) : rng.range(RWY_X2 - 520, RWY_X2 - 120);
    ellipse(ctx, x, RWY_Y + rng.range(-4, 4), rng.range(10, 40), rng.range(0.6, 1.8), 'rgba(28,28,32,0.22)');
  }
  // Fugen
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let x = RWY_X1 + 30; x < RWY_X2; x += 60) ctx.fillRect(x, y0, 0.6, y1 - y0);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  // Randlinien
  ctx.fillRect(RWY_X1, y0 + 1, RWY_X2 - RWY_X1, 0.9);
  ctx.fillRect(RWY_X1, y1 - 1.9, RWY_X2 - RWY_X1, 0.9);
  // Mittellinie
  for (let x = RWY_X1 + 70; x < RWY_X2 - 70; x += 46) ctx.fillRect(x, RWY_Y - 0.6, 24, 1.2);
  // Schwellen („Klaviertasten“) – in der Seitenansicht übereinander
  for (let i = 0; i < 6; i++) {
    const y = y0 + 2.6 + i * 2.7;
    ctx.fillRect(RWY_X1 + 6, y, 36, 1.3);
    ctx.fillRect(RWY_X2 - 42, y, 36, 1.3);
  }
  // Zielpunkt- und Aufsetzzonen-Markierungen
  for (const [x, w] of [[RWY_X1 + 300, 52], [RWY_X2 - 352, 52]]) {
    ctx.fillRect(x, y0 + 2.8, w, 2.2);
    ctx.fillRect(x, y1 - 5, w, 2.2);
  }
  for (const dx of [150, 210, 440, 520]) {
    ctx.fillRect(RWY_X1 + dx, y0 + 3.2, 22, 1.4);
    ctx.fillRect(RWY_X1 + dx, y1 - 4.6, 22, 1.4);
    ctx.fillRect(RWY_X2 - dx - 22, y0 + 3.2, 22, 1.4);
    ctx.fillRect(RWY_X2 - dx - 22, y1 - 4.6, 22, 1.4);
  }
  // Randfeuer (tagsüber nur als Leuchten-Köpfe)
  for (let x = RWY_X1 + 20; x < RWY_X2; x += 60) {
    circle(ctx, x, y0 - 1.6, 0.9, '#fff8de');
    circle(ctx, x, y1 + 1.6, 0.9, '#fff8de');
  }
  for (let y = y0 + 1; y <= y1 - 1; y += 3) {
    circle(ctx, RWY_X1 - 3, y, 0.9, '#5dff8a');
    circle(ctx, RWY_X2 + 3, y, 0.9, '#ff5a5a');
  }
  // Anflugbefeuerung vor der Schwelle (Masten)
  ctx.fillStyle = '#9aa1a7';
  for (const x of APPROACH_X) {
    ctx.fillRect(x - 0.6, RWY_Y - 2, 1.2, 9);
    ctx.fillRect(x - 3, RWY_Y - 2.6, 6, 1.2);
    circle(ctx, x, RWY_Y - 3, 1, '#fff6d0');
  }
  // PAPI
  for (let i = 0; i < 4; i++) {
    const x = RWY_X1 + 272 + i * 7;
    ctx.fillStyle = '#e9e6dc';
    ctx.fillRect(x - 2.6, y0 - 9, 5.2, 3.6);
    circle(ctx, x, y0 - 7.2, 1.1, i < 2 ? '#ffffff' : '#ff4646');
  }
  // Windsack-Mast
  ctx.fillStyle = '#c3c8cc';
  ctx.fillRect(WINDSOCK.x - 0.7, WINDSOCK.y, 1.4, y0 - 6 - WINDSOCK.y);
  ctx.restore();
}

const APPROACH_X = [24, 46, 68, 90, 112, 134];
const PAPI = { x: RWY_X1 + 272, y: RWY_Y - 17.2 };
const WINDSOCK = { x: 238, y: 560 };

function paintMid(ctx, rng) {
  paintMidHill(ctx, rng);
  // Hinterer Geländestreifen mit Buschwerk
  ctx.fillStyle = vgrad(ctx, MID_BACK, BASE + 4, [[0, '#71b955'], [1, '#5ea544']]);
  ctx.fillRect(-10, MID_BACK, 2420, BASE + 4 - MID_BACK);
  bushRow(ctx, rng, -10, 2410, MID_BACK + 3);
  // Palmen hinter den Gebäuden
  for (const [x, h, lean] of MID_PALMS) palm(ctx, x, MID_PALM_Y, h, { lean, leaf: '#33a052', leafDark: '#21773b' });
  // Vorfeld
  ctx.fillStyle = vgrad(ctx, BASE, 574, [[0, '#d7d2c4'], [1, '#c8c2b3']]);
  ctx.fillRect(-10, BASE, 2420, 574 - BASE);
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let x = 0; x < 2400; x += 38) ctx.fillRect(x, BASE, 0.7, 574 - BASE);
  for (let i = 0; i < 90; i++) {
    ellipse(ctx, rng.range(0, 2400), rng.range(BASE + 4, 570), rng.range(4, 14), rng.range(0.6, 1.6), 'rgba(80,70,50,0.07)');
  }
  // Rollweg als etwas dunkleres Band, Vorfeldstraße davor
  ctx.fillStyle = vgrad(ctx, 545, 569, [[0, '#bdb8aa'], [1, '#b0ab9c']]);
  ctx.fillRect(-10, 545, 2420, 24);
  ctx.fillStyle = 'rgba(242,194,48,0.85)';
  ctx.fillRect(-10, 545.4, 2420, 0.8);
  ctx.fillRect(-10, 567.6, 2420, 0.8);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(-10, 536.2, 2420, 0.7);
  for (let x = 0; x < 2400; x += 22) ctx.fillRect(x, 540.6, 11, 0.7);

  // Gebäude
  hangars(ctx, rng);
  terminal(ctx, rng);
  towerMid(ctx);
  fireStation(ctx);
  cargoShed(ctx);
  for (const gx of BRIDGE_GATES) jetBridge(ctx, gx);
  paintLights(ctx, MID_LIGHTS, 'rgba(40,50,40,0.45)', 0.45);

  // Abstellpositionen
  ctx.save();
  GATES.forEach((g, i) => {
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(g.x - 92, GATE_Y + 1.6, 184, 1.1);
    ctx.fillRect(g.x + g.dir * 64 - 0.8, GATE_Y - 3, 1.6, 8);
    ctx.fillStyle = '#e04646';
    ctx.fillRect(g.x - 96, GATE_Y - 8, 1, 16);
    ctx.fillRect(g.x + 95, GATE_Y - 8, 1, 16);
    text(ctx, String(i + 1), g.x + g.dir * 78, GATE_Y + 9, 6, 'rgba(255,255,255,0.9)');
  });
  // Gerätefahrzeuge zwischen den Positionen
  for (const x of [930, 1250, 1590]) {
    ctx.fillStyle = '#f2b705';
    ctx.fillRect(x, 527, 9, 4);
    ctx.fillStyle = '#3a4248';
    ctx.fillRect(x + 6, 524.5, 3, 2.5);
    circle(ctx, x + 2, 531.5, 1.3, '#222');
    circle(ctx, x + 7.5, 531.5, 1.3, '#222');
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = '#9aa6ae';
      ctx.fillRect(x - 12 - c * 11, 526, 9, 5);
      circle(ctx, x - 10 - c * 11, 531.5, 1.1, '#222');
      circle(ctx, x - 5 - c * 11, 531.5, 1.1, '#222');
    }
  }
  // Rollweg-Mittellinie und Randfeuer
  ctx.fillStyle = '#f2c230';
  ctx.fillRect(190, TWY_Y - 0.6, 2060, 1.2);
  for (let x = 200; x < 2250; x += 46) circle(ctx, x, 573, 0.9, '#3b82f6');
  ctx.restore();

  // Grünstreifen mit Rollbahn-Verbindungen (reicht bis unter die Piste, damit an den Pistenenden keine Lücke bleibt)
  ctx.fillStyle = vgrad(ctx, 574, RWY_Y + 14, [[0, '#7cc35c'], [0.5, '#6db14f'], [1, '#74b955']]);
  ctx.fillRect(-10, 574, 2420, RWY_Y + 14 - 574);
  // Freifläche hinter dem Pistenende (Blast Pad)
  ctx.fillStyle = '#a9a69a';
  ctx.fillRect(RWY_X2 + 22, RWY_Y - 8, 70, 16);
  ctx.fillStyle = 'rgba(242,194,48,0.85)';
  for (let x = RWY_X2 + 28; x < RWY_X2 + 88; x += 12) poly(ctx, [[x + 6, RWY_Y - 6], [x, RWY_Y], [x + 6, RWY_Y + 6], [x + 3.6, RWY_Y]]), ctx.fill();
  for (const x of [430, 980, 1560, 2140]) {
    poly(ctx, [[x - 28, 574], [x + 28, 574], [x + 40, 590], [x - 16, 590]], '#cbc5b6');
    ctx.fillStyle = '#f2c230';
    poly(ctx, [[x - 1, 574], [x + 1, 574], [x + 13, 590], [x + 11, 590]]);
    ctx.fill();
  }
  paintRunway(ctx, rng);
  // Gras vorne (größtenteils vom Strand verdeckt)
  ctx.fillStyle = vgrad(ctx, RWY_Y + 13, 720, [[0, '#79c05a'], [1, '#5ea544']]);
  ctx.fillRect(-10, RWY_Y + 13, 2420, 720 - RWY_Y - 13);
}

// --- near: Maho Beach --------------------------------------------------------
function bump(x, c, r) {
  const d = (x - c) / r;
  return d * d < 1 ? (1 - d * d) ** 2 : 0;
}

function shoreY(x) {
  return 701 + 5 * Math.sin(x * 0.0021 + 1.3) + 3 * Math.sin(x * 0.0057 + 0.2) - 17 * bump(x, 270, 300) - 15 * bump(x, 2790, 320);
}

function santaHat(ctx, x, y, r, tilt = 1) {
  // x,y = Mitte Hutkrempe, r = Kopfradius
  poly(ctx, [[x - r * 1.05, y], [x + r * 1.05, y], [x + r * 0.5 * tilt + r * 0.9 * tilt, y - r * 1.25], [x + r * 1.7 * tilt, y - r * 0.5]], '#d62839');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  rr(ctx, x - r * 1.15, y - r * 0.28, r * 2.3, r * 0.56, r * 0.28);
  ctx.fill();
  circle(ctx, x + r * 1.75 * tilt, y - r * 0.45, r * 0.38, '#ffffff');
}

// Badegast in Rückenansicht (alle schauen zur Piste)
function figure(ctx, x, baseY, s, o = {}) {
  const skin = o.skin || SKIN[1];
  const suit = o.suit || SUITS[0];
  const hair = o.hair || HAIR[0];
  const pose = o.pose || 'stand';
  const headR = s * 0.105;
  const neckY = baseY - s * 0.8;
  const hipY = baseY - s * 0.46;
  const shW = s * (o.female ? 0.22 : 0.26);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ellipse(ctx, x + s * 0.12, baseY + 0.5, s * 0.24, s * 0.04, 'rgba(150,110,50,0.22)');
  // Beine
  ctx.strokeStyle = skin;
  ctx.lineWidth = s * 0.095;
  line(ctx, x - s * 0.055, hipY, x - s * 0.075, baseY - s * 0.04);
  line(ctx, x + s * 0.055, hipY, x + s * 0.085, baseY - s * 0.04);
  // Arme
  ctx.lineWidth = s * 0.072;
  const sy = neckY + s * 0.06;
  const L = x - shW * 0.45;
  const R = x + shW * 0.45;
  const down = (sx, side) => polyline(ctx, [[sx, sy], [sx + side * s * 0.05, sy + s * 0.17], [sx + side * s * 0.06, hipY + s * 0.02]]);
  const up = (sx, side, spread = 1) => polyline(ctx, [[sx, sy], [sx + side * s * 0.13 * spread, sy - s * 0.12], [sx + side * s * 0.1 * spread, sy - s * 0.3]]);
  if (pose === 'cheer') { up(L, -1, 1.2); up(R, 1, 1.2); }
  else if (pose === 'phone') { down(L, -1); up(R, 1, 0.5); }
  else if (pose === 'wave') { down(L, -1); up(R, 1, 1.4); }
  else if (pose === 'point') { down(L, -1); polyline(ctx, [[R, sy], [R + s * 0.16, sy - s * 0.1], [R + s * 0.3, sy - s * 0.22]]); }
  else { down(L, -1); down(R, 1); }
  if (pose === 'phone') {
    ctx.fillStyle = '#1d232b';
    ctx.beginPath();
    rr(ctx, R + s * 0.02, sy - s * 0.42, s * 0.085, s * 0.12, s * 0.015);
    ctx.fill();
  }
  // Rumpf
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(x - shW / 2, neckY + s * 0.02);
  ctx.quadraticCurveTo(x - shW / 2 - s * 0.01, hipY - s * 0.1, x - shW * 0.38, hipY + s * 0.04);
  ctx.lineTo(x + shW * 0.38, hipY + s * 0.04);
  ctx.quadraticCurveTo(x + shW / 2 + s * 0.01, hipY - s * 0.1, x + shW / 2, neckY + s * 0.02);
  ctx.quadraticCurveTo(x, neckY - s * 0.03, x - shW / 2, neckY + s * 0.02);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(x - shW / 2, neckY + s * 0.02, shW * 0.22, hipY - neckY);
  // Badekleidung
  ctx.fillStyle = suit;
  if (o.female) {
    ctx.fillRect(x - shW / 2 + s * 0.005, neckY + s * 0.12, shW - s * 0.01, s * 0.045);
    ctx.beginPath();
    rr(ctx, x - shW * 0.4, hipY - s * 0.035, shW * 0.8, s * 0.1, s * 0.03);
    ctx.fill();
  } else if (o.shirt) {
    ctx.fillStyle = o.shirt;
    ctx.beginPath();
    rr(ctx, x - shW / 2 - s * 0.01, neckY + s * 0.01, shW + s * 0.02, hipY - neckY + s * 0.02, s * 0.04);
    ctx.fill();
    ctx.fillStyle = suit;
    ctx.fillRect(x - shW * 0.4, hipY + s * 0.02, shW * 0.8, s * 0.12);
  } else {
    ctx.beginPath();
    rr(ctx, x - shW * 0.42, hipY - s * 0.04, shW * 0.84, s * 0.16, s * 0.03);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x - shW * 0.42, hipY + s * 0.02, shW * 0.84, s * 0.018);
  }
  // Kopf von hinten, Haare
  const hy = neckY - headR * 0.85;
  circle(ctx, x, hy, headR, skin);
  ctx.fillStyle = hair;
  if (o.female) {
    ctx.beginPath();
    ctx.arc(x, hy, headR * 1.08, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineTo(x + headR * 1.05, hy + headR * 1.7);
    ctx.quadraticCurveTo(x, hy + headR * 2.1, x - headR * 1.05, hy + headR * 1.7);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, hy, headR * 1.04, Math.PI * 0.85, Math.PI * 2.15);
    ctx.quadraticCurveTo(x, hy + headR * 0.75, x - headR * 1.0, hy + headR * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  if (o.hat === 'santa') santaHat(ctx, x, hy - headR * 0.55, headR, o.tilt || 1);
  else if (o.hat === 'straw') {
    ellipse(ctx, x, hy - headR * 0.45, headR * 1.8, headR * 0.35, '#e9cf8a');
    ctx.beginPath();
    rr(ctx, x - headR * 0.85, hy - headR * 1.25, headR * 1.7, headR * 0.85, headR * 0.4);
    ctx.fill();
    ctx.fillStyle = '#d62839';
    ctx.fillRect(x - headR * 0.85, hy - headR * 0.7, headR * 1.7, headR * 0.22);
  } else if (o.hat === 'cap') {
    ctx.beginPath();
    ctx.arc(x, hy - headR * 0.15, headR * 1.02, Math.PI, TAU);
    ctx.fillStyle = o.capColor || '#2b7de9';
    ctx.fill();
  }
  ctx.restore();
}

// Sitzender Badegast (Rückenansicht) – auf Handtuch oder Barhocker
function sitter(ctx, x, seatY, s, o = {}) {
  const skin = o.skin || SKIN[2];
  const headR = s * 0.105;
  const neckY = seatY - s * 0.36;
  const shW = s * (o.female ? 0.22 : 0.26);
  ctx.save();
  if (o.legs) {
    ctx.strokeStyle = skin;
    ctx.lineWidth = s * 0.085;
    ctx.lineCap = 'round';
    line(ctx, x - s * 0.07, seatY - s * 0.02, x - s * 0.09, seatY + s * 0.32);
    line(ctx, x + s * 0.07, seatY - s * 0.02, x + s * 0.1, seatY + s * 0.32);
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(x - shW / 2, neckY);
  ctx.quadraticCurveTo(x - shW / 2 - s * 0.03, seatY - s * 0.08, x - shW * 0.55, seatY);
  ctx.lineTo(x + shW * 0.55, seatY);
  ctx.quadraticCurveTo(x + shW / 2 + s * 0.03, seatY - s * 0.08, x + shW / 2, neckY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = skin;
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  line(ctx, x - shW * 0.48, neckY + s * 0.04, x - shW * 0.62, seatY - s * 0.04);
  line(ctx, x + shW * 0.48, neckY + s * 0.04, x + shW * 0.62, seatY - s * 0.04);
  ctx.fillStyle = o.suit || SUITS[1];
  if (o.female) ctx.fillRect(x - shW / 2, neckY + s * 0.1, shW, s * 0.045);
  if (o.shirt) {
    ctx.fillStyle = o.shirt;
    ctx.beginPath();
    rr(ctx, x - shW / 2 - s * 0.01, neckY, shW + s * 0.02, seatY - neckY - s * 0.02, s * 0.04);
    ctx.fill();
  }
  ctx.fillStyle = o.suit || SUITS[1];
  ctx.fillRect(x - shW * 0.55, seatY - s * 0.06, shW * 1.1, s * 0.06);
  const hy = neckY - headR * 0.85;
  circle(ctx, x, hy, headR, skin);
  ctx.fillStyle = o.hair || HAIR[0];
  ctx.beginPath();
  ctx.arc(x, hy, headR * 1.05, Math.PI * 0.9, Math.PI * 2.1);
  if (o.female) {
    ctx.lineTo(x + headR, hy + headR * 1.6);
    ctx.lineTo(x - headR, hy + headR * 1.6);
  }
  ctx.closePath();
  ctx.fill();
  if (o.hat === 'santa') santaHat(ctx, x, hy - headR * 0.55, headR, o.tilt || 1);
  ctx.restore();
}

function lying(ctx, x, y, s, o = {}) {
  const skin = o.skin || SKIN[1];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = skin;
  ctx.lineWidth = s * 0.16;
  line(ctx, x + s * 0.12, y - s * 0.09, x + s * 0.55, y - s * 0.08);
  ctx.lineWidth = s * 0.11;
  line(ctx, x + s * 0.55, y - s * 0.07, x + s * 0.92, y - s * 0.06);
  ctx.fillStyle = o.suit || SUITS[3];
  ctx.fillRect(x + s * 0.44, y - s * 0.17, s * 0.16, s * 0.16);
  circle(ctx, x + s * 0.02, y - s * 0.1, s * 0.09, skin);
  ctx.fillStyle = o.hair || HAIR[2];
  ctx.beginPath();
  ctx.arc(x + s * 0.0, y - s * 0.1, s * 0.095, Math.PI * 0.6, Math.PI * 1.5);
  ctx.fill();
  if (o.book) {
    ctx.fillStyle = o.book;
    poly(ctx, [[x + s * 0.12, y - s * 0.2], [x + s * 0.26, y - s * 0.25], [x + s * 0.27, y - s * 0.16], [x + s * 0.14, y - s * 0.12]]);
    ctx.fill();
  }
  ctx.restore();
}

function towel(ctx, x, y, w, c1, c2) {
  poly(ctx, [[x, y], [x + w, y], [x + w - 7, y - 6], [x - 3, y - 6]], c1);
  ctx.fillStyle = c2;
  for (let i = 1; i < 4; i++) {
    const f = i / 4;
    poly(ctx, [[x + w * f - 3, y], [x + w * f + 2, y], [x + w * f - 3, y - 6], [x + w * f - 8, y - 6]]);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x, y - 0.8, w, 0.8);
}

function parasol(ctx, x, baseY, h, kind, tilt = 0) {
  const tx = x + tilt;
  const ty = baseY - h;
  const W = 78;
  const H = 22;
  ctx.save();
  ellipse(ctx, tx + 10, baseY + 2, W * 0.46, 4, 'rgba(150,110,50,0.2)');
  ctx.strokeStyle = '#efe9dc';
  ctx.lineWidth = 2.4;
  line(ctx, x, baseY, tx, ty);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.8;
  line(ctx, x + 0.8, baseY, tx + 0.8, ty);
  const dome = () => {
    ctx.beginPath();
    ctx.moveTo(tx - W / 2, ty + 6);
    ctx.quadraticCurveTo(tx - W * 0.22, ty - H * 0.85, tx, ty - H);
    ctx.quadraticCurveTo(tx + W * 0.22, ty - H * 0.85, tx + W / 2, ty + 6);
    for (let i = 6; i >= 0; i--) {
      const px = tx - W / 2 + (W * i) / 6;
      ctx.quadraticCurveTo(px + W / 12, ty + 9, px, ty + 6);
    }
    ctx.closePath();
  };
  if (kind === 'santa') {
    dome();
    ctx.fillStyle = vgrad(ctx, ty - H, ty + 8, [[0, '#ef3b4f'], [1, '#b81d30']]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(tx + W * 0.16, ty - H * 0.45, W * 0.14, H * 0.18, -0.45, 0, TAU);
    ctx.fill();
    // Spitze kippt zur Seite wie bei einer Mütze
    poly(ctx, [[tx - 6, ty - H + 3], [tx + 6, ty - H + 2], [tx + 18, ty - H + 11], [tx + 15, ty - H + 13]], '#d62839');
    circle(ctx, tx + 18, ty - H + 13, 4.6, '#ffffff');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx - W / 2 + 2, ty + 6);
    ctx.quadraticCurveTo(tx, ty + 10, tx + W / 2 - 2, ty + 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,215,230,0.6)';
    for (let i = 0; i < 9; i++) circle(ctx, tx - W / 2 + 6 + i * 8.3, ty + 8.6, 1.1), ctx.fill();
  } else {
    const [c1, c2] = kind;
    ctx.save();
    dome();
    ctx.fillStyle = c1;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = c2;
    for (let i = 0; i < 6; i += 2) {
      const a = tx - W / 2 + (W * i) / 6;
      const b = tx - W / 2 + (W * (i + 1)) / 6;
      poly(ctx, [[tx, ty - H - 2], [a, ty + 12], [b, ty + 12]]);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(tx - W / 2, ty + 2, W, 10);
    ctx.restore();
    circle(ctx, tx, ty - H - 1, 2, '#efe9dc');
  }
  ctx.restore();
}

function lifeguardTower(ctx, x, baseY) {
  const hutB = baseY - 62;
  const hutT = hutB - 38;
  ctx.save();
  ellipse(ctx, x + 14, baseY + 2, 52, 5, 'rgba(150,110,50,0.22)');
  // Stelzen
  ctx.fillStyle = '#d9d2c4';
  ctx.fillRect(x - 20, hutB, 4, baseY - hutB);
  ctx.fillRect(x + 16, hutB, 4, baseY - hutB);
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(x - 28, hutB, 5, baseY - hutB);
  ctx.fillRect(x + 23, hutB, 5, baseY - hutB);
  ctx.strokeStyle = '#e8e2d6';
  ctx.lineWidth = 2;
  line(ctx, x - 26, hutB + 6, x + 25, baseY - 8);
  line(ctx, x + 25, hutB + 6, x - 26, baseY - 8);
  // Rampe
  poly(ctx, [[x + 28, hutB + 1], [x + 34, hutB + 1], [x + 84, baseY], [x + 74, baseY]], '#efe7d8');
  ctx.strokeStyle = 'rgba(120,100,70,0.35)';
  ctx.lineWidth = 0.8;
  for (let f = 0.1; f < 1; f += 0.12) line(ctx, x + 28 + 46 * f, hutB + 1 + 61 * f, x + 34 + 50 * f, hutB + 1 + 61 * f);
  // Plattform und Hütte
  ctx.fillStyle = '#cfc6b4';
  ctx.fillRect(x - 38, hutB, 76, 5);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(x - 32, hutT, 64, hutB - hutT);
  ctx.fillStyle = '#ff9f1c';
  for (let i = 0; i < 64; i += 8) ctx.fillRect(x - 32 + i, hutT, 4, hutB - hutT);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(x - 32, hutT, 10, hutB - hutT);
  // Fenster
  ctx.fillStyle = '#1d4e6b';
  ctx.fillRect(x - 24, hutT + 7, 32, 15);
  ctx.fillStyle = 'rgba(160,230,240,0.45)';
  poly(ctx, [[x - 20, hutT + 22], [x - 12, hutT + 7], [x - 7, hutT + 7], [x - 15, hutT + 22]]);
  ctx.fill();
  // Tür mit Kranz
  ctx.fillStyle = '#2ec4b6';
  ctx.fillRect(x + 13, hutT + 6, 14, hutB - hutT - 6);
  ctx.strokeStyle = '#1f7a3a';
  ctx.lineWidth = 2.6;
  circle(ctx, x + 20, hutT + 15, 4.2);
  ctx.stroke();
  ctx.fillStyle = '#d62839';
  poly(ctx, [[x + 18, hutT + 19], [x + 22, hutT + 19], [x + 23.5, hutT + 23], [x + 16.5, hutT + 23]]);
  ctx.fill();
  // Rettungsring
  ctx.strokeStyle = '#ff5a4e';
  ctx.lineWidth = 3.4;
  circle(ctx, x - 35, hutT + 22, 6);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.setLineDash([3, 3.2]);
  circle(ctx, x - 35, hutT + 22, 6);
  ctx.stroke();
  ctx.setLineDash([]);
  // Flachdach (Versteck)
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(x - 38, hutT - 6, 76, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 38, hutT - 1.4, 76, 1.4);
  // Fahnenmast
  ctx.fillStyle = '#e6e1d6';
  ctx.fillRect(x + 32, hutT - 40, 1.8, 34);
  ctx.restore();
}

function warningSign(ctx, x, baseY) {
  const bw = 104;
  const bh = 60;
  const top = baseY - 100;
  ctx.save();
  ellipse(ctx, x + 12, baseY + 1, 44, 3, 'rgba(150,110,50,0.2)');
  ctx.fillStyle = '#7d858c';
  ctx.fillRect(x - 34, top + bh - 4, 4, baseY - top - bh + 4);
  ctx.fillRect(x + 30, top + bh - 4, 4, baseY - top - bh + 4);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  rr(ctx, x - bw / 2 + 2, top + 2, bw, bh, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  rr(ctx, x - bw / 2, top, bw, bh, 4);
  ctx.fill();
  ctx.strokeStyle = '#d62839';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  rr(ctx, x - bw / 2 + 2.5, top + 2.5, bw - 5, bh - 5, 3);
  ctx.stroke();
  ctx.fillStyle = '#d62839';
  ctx.fillRect(x - bw / 2 + 2.5, top + 2.5, bw - 5, 16);
  text(ctx, 'GEFAHR', x, top + 11, 12, '#ffffff');
  // Piktogramm: Jet (Bug links) bläst Person um
  const px = x - 36;
  const py = top + 30;
  ctx.fillStyle = '#1c1c1c';
  poly(ctx, [[px - 12, py], [px - 8, py - 2.2], [px + 9, py - 2.2], [px + 12, py - 7], [px + 14.5, py - 7], [px + 13, py + 2], [px - 8, py + 2.2]]);
  ctx.fill();
  poly(ctx, [[px - 1, py], [px + 4, py + 8], [px + 7, py + 8], [px + 5, py]]);
  ctx.fill();
  ctx.fillRect(px + 2, py + 2, 5, 2.4);
  ctx.strokeStyle = '#d62839';
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  for (const [dy, l] of [[1, 7], [4.5, 9], [8, 6]]) line(ctx, px + 9, py + dy + 1, px + 9 + l, py + dy + 3);
  // umgewehte Person
  const qx = px + 19;
  const qy = py + 15;
  circle(ctx, qx + 4, qy - 4, 2, '#1c1c1c');
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 1.7;
  polyline(ctx, [[qx + 2.5, qy - 1.8], [qx - 3, qy + 1.5]]);
  polyline(ctx, [[qx - 3, qy + 1.5], [qx - 6, qy - 2]]);
  polyline(ctx, [[qx - 3, qy + 1.5], [qx - 6.5, qy + 4.5]]);
  polyline(ctx, [[qx + 1, qy - 1], [qx + 3, qy + 3]]);
  polyline(ctx, [[qx + 1, qy - 1], [qx - 1, qy - 5]]);
  text(ctx, 'Jetblast!', x + 17, top + 31, 14, '#1c1c1c');
  text(ctx, 'Abstand halten', x + 17, top + 46, 7.5, '#3a3a3a', { weight: '600' });
  ctx.restore();
}

function surfboard(ctx, cx, cy, len, wid, angle, colors) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.bezierCurveTo(-len / 2, -wid * 0.62, len * 0.2, -wid * 0.58, len / 2, 0);
  ctx.bezierCurveTo(len * 0.2, wid * 0.58, -len / 2, wid * 0.62, -len / 2, 0);
  ctx.closePath();
  ctx.fillStyle = colors[0];
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = colors[1];
  ctx.fillRect(-len / 2, -wid * 0.09, len, wid * 0.18);
  if (colors[2]) {
    ctx.fillStyle = colors[2];
    ctx.fillRect(-len / 2, -wid, len * 0.12, wid * 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(-len / 2, -wid * 0.5, len, wid * 0.12);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function beachBar(ctx, rng) {
  const x1 = 1380;
  const x2 = 1620;
  const base = 646;
  ctx.save();
  ellipse(ctx, (x1 + x2) / 2 + 20, base + 2, 170, 6, 'rgba(150,110,50,0.22)');
  // Deck
  ctx.fillStyle = '#a8764a';
  ctx.fillRect(x1 - 34, base - 9, x2 - x1 + 68, 9);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let x = x1 - 34; x < x2 + 34; x += 11) ctx.fillRect(x, base - 9, 0.8, 9);
  ctx.fillStyle = '#c99566';
  ctx.fillRect(x1 - 34, base - 10, x2 - x1 + 68, 2);
  // Pfosten
  ctx.fillStyle = '#7a5532';
  for (const x of [x1 - 20, x2 + 16]) ctx.fillRect(x, 596, 5, base - 10 - 596);
  // Hütte aus Brettern
  for (let x = x1; x < x2; x += 8) {
    ctx.fillStyle = (x / 8) % 2 ? '#c48a55' : '#d39b63';
    ctx.fillRect(x, 592, 8, base - 10 - 592);
  }
  // Ausschank mit Flaschen
  ctx.fillStyle = '#3b2a20';
  ctx.fillRect(x1 + 14, 598, x2 - x1 - 28, 20);
  ctx.fillStyle = '#5a3f2c';
  ctx.fillRect(x1 + 14, 606, x2 - x1 - 28, 1.2);
  for (let x = x1 + 20; x < x2 - 20; x += 5.5) {
    ctx.fillStyle = rng.pick(['#2e8b57', '#c0392b', '#f1c40f', '#ecf0f1', '#8e44ad', '#16a085']);
    ctx.fillRect(x, 600.5 + rng.range(0, 1.5), 2.6, 5.5);
  }
  // Barkeeper mit Mütze
  sitter(ctx, x1 + 150, 626, 40, { skin: SKIN[4], shirt: '#ffffff', suit: '#ffffff', hair: HAIR[5], hat: 'santa', tilt: -1 });
  // Theke
  ctx.fillStyle = '#efdcb5';
  ctx.fillRect(x1 + 4, 616, x2 - x1 - 8, 4);
  ctx.fillStyle = '#2ec4b6';
  ctx.fillRect(x1 + 8, 620, x2 - x1 - 16, base - 10 - 620);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(x1 + 8, 624, x2 - x1 - 16, 2.4);
  ctx.fillStyle = '#ff7f6e';
  ctx.fillRect(x1 + 8, 629, x2 - x1 - 16, 2.4);
  // Strohdach
  const r0 = 602;
  const r1 = 552;
  poly(ctx, [[x1 - 30, r0], [x1 + 30, r1], [x2 - 30, r1], [x2 + 30, r0]], vgrad(ctx, r1, r0, [[0, '#e3c27c'], [1, '#c79a52']]));
  ctx.strokeStyle = 'rgba(120,80,30,0.35)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 220; i++) {
    const f = rng.next();
    const y = r1 + f * (r0 - r1);
    const xa = x1 + 30 - 60 * f;
    const xb = x2 - 30 + 60 * f;
    const x = rng.range(xa, xb);
    line(ctx, x, y, x + rng.range(-1.5, 1.5), y + rng.range(5, 9));
  }
  ctx.fillStyle = '#b8863f';
  ctx.beginPath();
  ctx.moveTo(x1 - 32, r0 - 2);
  for (let x = x1 - 32; x <= x2 + 32; x += 6) ctx.lineTo(x + 3, r0 + 4 + ((x * 7) % 5));
  ctx.lineTo(x2 + 32, r0 - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a87532';
  ctx.fillRect(x1 + 28, r1 - 2, x2 - x1 - 56, 4);
  // Surfbrett-Schild auf dem Dach
  ctx.fillStyle = '#7a5532';
  ctx.fillRect(x1 + 76, 532, 3, 22);
  ctx.fillRect(x2 - 79, 532, 3, 22);
  surfboard(ctx, (x1 + x2) / 2, 531, 176, 30, 0, ['#fdfaf2', '#2ec4b6', '#ff7f6e']);
  text(ctx, 'BEACH BAR', (x1 + x2) / 2 + 6, 532, 15.5, '#16425b');
  // Kranz an der Theke
  ctx.strokeStyle = '#1f7a3a';
  ctx.lineWidth = 3.4;
  circle(ctx, x1 + 40, 628, 5.5);
  ctx.stroke();
  ctx.fillStyle = '#d62839';
  for (const a of [0.4, 1.9, 3.4, 4.9]) circle(ctx, x1 + 40 + Math.cos(a) * 5.5, 628 + Math.sin(a) * 5.5, 1.1), ctx.fill();
  // Barhocker
  for (const x of [x1 + 28, x1 + 92, x2 - 92, x2 - 28]) {
    ctx.fillStyle = '#5a3f2c';
    ctx.fillRect(x - 1, 626, 2, base - 10 - 626);
    ellipse(ctx, x, 626, 6.5, 2, '#d62839');
  }
  ctx.restore();
}

function arrivalsBoard(ctx, x, base) {
  ctx.save();
  ellipse(ctx, x + 8, base + 1, 16, 2.5, 'rgba(150,110,50,0.22)');
  surfboard(ctx, x, base - 64, 128, 42, -Math.PI / 2, ['#ffd166', '#ff7f6e', null]);
  text(ctx, 'ANKÜNFTE', x, base - 104, 6.2, '#16425b');
  const times = ['11:40', '12:15', '13:05', '14:30', '15:10', '16:25'];
  times.forEach((tm, i) => {
    const y = base - 93 + i * 10.3;
    plane(ctx, x - 11, y, 0.22, '#16425b');
    text(ctx, tm, x + 4, y + 0.3, 7, '#16425b');
  });
  ctx.restore();
}

// Winziges Flugzeug-Piktogramm
function plane(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  poly(ctx, [[-14, -2], [12, -2], [16, 0], [12, 2], [-14, 2]]);
  ctx.fill();
  poly(ctx, [[-2, -2], [4, -12], [8, -12], [6, -2]]);
  ctx.fill();
  poly(ctx, [[-2, 2], [4, 12], [8, 12], [6, 2]]);
  ctx.fill();
  poly(ctx, [[-14, -2], [-16, -8], [-12, -8], [-9, -2]]);
  ctx.fill();
  ctx.restore();
}

function inflatableSnowman(ctx, x, baseY, h) {
  const r1 = h * 0.27;
  const r2 = h * 0.2;
  const r3 = h * 0.15;
  const y1 = baseY - r1 * 0.96;
  const y2 = y1 - r1 * 0.78 - r2 * 0.72;
  const y3 = y2 - r2 * 0.78 - r3 * 0.72;
  ctx.save();
  ellipse(ctx, x + 12, baseY + 1, r1 * 1.3, 4.5, 'rgba(150,110,50,0.25)');
  // Halteleinen
  ctx.strokeStyle = 'rgba(90,90,90,0.55)';
  ctx.lineWidth = 0.7;
  line(ctx, x - r2 * 0.8, y2, x - r1 * 1.7, baseY + 1);
  line(ctx, x + r2 * 0.8, y2, x + r1 * 1.7, baseY + 1);
  ctx.fillStyle = '#7a5532';
  ctx.fillRect(x - r1 * 1.7 - 1, baseY - 2, 2, 4);
  ctx.fillRect(x + r1 * 1.7 - 1, baseY - 2, 2, 4);
  const ball = (cy, r) => {
    const g = ctx.createRadialGradient(x + r * 0.35, cy - r * 0.4, r * 0.1, x, cy, r * 1.05);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, '#f1f5fb');
    g.addColorStop(1, '#c6d6ea');
    circle(ctx, x, cy, r, g);
    ctx.strokeStyle = 'rgba(150,175,205,0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(x, cy, r * 0.45, r * 0.98, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, cy, r * 0.45, r * 0.98, 0, Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    ellipse(ctx, x + r * 0.42, cy - r * 0.45, r * 0.2, r * 0.12, 'rgba(255,255,255,0.9)');
  };
  ball(y1, r1);
  // Ärmchen
  ctx.strokeStyle = '#eef3fa';
  ctx.lineCap = 'round';
  ctx.lineWidth = r2 * 0.42;
  line(ctx, x - r2 * 0.8, y2 - r2 * 0.1, x - r2 * 1.55, y2 - r2 * 0.75);
  line(ctx, x + r2 * 0.8, y2 - r2 * 0.1, x + r2 * 1.6, y2 - r2 * 0.65);
  circle(ctx, x - r2 * 1.6, y2 - r2 * 0.82, r2 * 0.26, '#d62839');
  circle(ctx, x + r2 * 1.65, y2 - r2 * 0.72, r2 * 0.26, '#d62839');
  ball(y2, r2);
  for (const dy of [-0.35, 0.1, 0.55]) circle(ctx, x, y2 + dy * r2, r2 * 0.11, '#1f2a33');
  circle(ctx, x, y1 - r1 * 0.2, r1 * 0.09, '#1f2a33');
  ball(y3, r3);
  // Schal
  ctx.fillStyle = '#d62839';
  ctx.beginPath();
  rr(ctx, x - r3 * 0.95, y3 + r3 * 0.68, r3 * 1.9, r3 * 0.42, r3 * 0.2);
  ctx.fill();
  poly(ctx, [[x + r3 * 0.25, y3 + r3 * 0.9], [x + r3 * 0.75, y3 + r3 * 0.9], [x + r3 * 0.95, y3 + r3 * 2.2], [x + r3 * 0.45, y3 + r3 * 2.25]], '#e5384b');
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) ctx.fillRect(x - r3 * 0.85 + i * r3 * 0.65, y3 + r3 * 0.78, r3 * 0.25, r3 * 0.22);
  // Sonnenbrille, Karottennase, Lächeln
  ctx.fillStyle = '#16212b';
  ctx.beginPath();
  rr(ctx, x - r3 * 0.78, y3 - r3 * 0.3, r3 * 0.68, r3 * 0.4, r3 * 0.16);
  rr(ctx, x + r3 * 0.1, y3 - r3 * 0.3, r3 * 0.68, r3 * 0.4, r3 * 0.16);
  ctx.fill();
  ctx.fillRect(x - r3 * 0.12, y3 - r3 * 0.24, r3 * 0.24, r3 * 0.07);
  ctx.fillStyle = 'rgba(120,200,255,0.55)';
  ctx.fillRect(x - r3 * 0.68, y3 - r3 * 0.25, r3 * 0.2, r3 * 0.08);
  ctx.fillRect(x + r3 * 0.2, y3 - r3 * 0.25, r3 * 0.2, r3 * 0.08);
  poly(ctx, [[x - r3 * 0.05, y3 + r3 * 0.05], [x + r3 * 0.85, y3 + r3 * 0.22], [x - r3 * 0.05, y3 + r3 * 0.3]], '#ff8c2b');
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.25 + i * 0.125);
    circle(ctx, x + Math.cos(a) * r3 * 0.5, y3 + r3 * 0.2 + Math.sin(a) * r3 * 0.32, r3 * 0.05, '#1f2a33');
  }
  santaHat(ctx, x, y3 - r3 * 0.72, r3 * 1.05, 1);
  ctx.restore();
}

function sandSnowman(ctx, x, baseY, h) {
  const r1 = h * 0.28;
  const r2 = h * 0.21;
  const r3 = h * 0.16;
  const y1 = baseY - r1 * 0.85;
  const y2 = y1 - r1 * 0.85 - r2 * 0.6;
  const y3 = y2 - r2 * 0.85 - r3 * 0.6;
  ctx.save();
  ellipse(ctx, x + 6, baseY + 1, r1 * 1.4, 3, 'rgba(150,110,50,0.25)');
  for (const [cy, r] of [[y1, r1], [y2, r2], [y3, r3]]) {
    const g = ctx.createRadialGradient(x + r * 0.3, cy - r * 0.35, r * 0.1, x, cy, r);
    g.addColorStop(0, '#f6e4bd');
    g.addColorStop(1, '#d6b57a');
    circle(ctx, x, cy, r, g);
  }
  ctx.strokeStyle = '#6b4824';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  polyline(ctx, [[x - r2 * 0.9, y2], [x - r2 * 2, y2 - r2 * 0.7], [x - r2 * 2.3, y2 - r2 * 1.1]]);
  polyline(ctx, [[x + r2 * 0.9, y2], [x + r2 * 2, y2 - r2 * 0.4]]);
  circle(ctx, x, y2 - r2 * 0.2, 1.6, '#fbe3ef');
  circle(ctx, x, y2 + r2 * 0.35, 1.6, '#fbe3ef');
  circle(ctx, x - r3 * 0.35, y3 - r3 * 0.1, 1.2, '#2a2a2a');
  circle(ctx, x + r3 * 0.35, y3 - r3 * 0.1, 1.2, '#2a2a2a');
  poly(ctx, [[x, y3 + r3 * 0.05], [x + r3 * 0.8, y3 + r3 * 0.22], [x, y3 + r3 * 0.35]], '#ff8c2b');
  santaHat(ctx, x, y3 - r3 * 0.7, r3 * 1.05, -1);
  // Eimer und Schaufel
  poly(ctx, [[x + 18, baseY], [x + 28, baseY], [x + 30, baseY - 10], [x + 16, baseY - 10]], '#2b7de9');
  ctx.strokeStyle = '#ffcc33';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + 23, baseY - 10, 6, Math.PI, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#ff4f6d';
  ctx.lineWidth = 1.4;
  line(ctx, x - 22, baseY, x - 30, baseY - 16);
  poly(ctx, [[x - 24, baseY + 1], [x - 18, baseY - 2], [x - 20, baseY - 6], [x - 26, baseY - 3]], '#ff4f6d');
  ctx.restore();
}

function presents(ctx, x, baseY) {
  const boxes = [[-26, 18, 14, '#d62839', '#ffd23f'], [-6, 14, 20, '#2b7de9', '#ffffff'], [12, 20, 12, '#22b8a6', '#ff4f6d'], [-14, 10, 9, '#ffd23f', '#d62839']];
  ctx.save();
  for (const [dx, w, h, c, rib] of boxes) {
    const y = dx === -14 ? baseY - 14 : baseY;
    ctx.fillStyle = c;
    ctx.fillRect(x + dx, y - h, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + dx, y - h, w * 0.25, h);
    ctx.fillStyle = rib;
    ctx.fillRect(x + dx + w / 2 - 1, y - h, 2, h);
    ctx.fillRect(x + dx, y - h * 0.55, w, 2);
    ctx.strokeStyle = rib;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(x + dx + w / 2 - 3, y - h - 2, 3, 2, -0.5, 0, TAU);
    ctx.ellipse(x + dx + w / 2 + 3, y - h - 2, 3, 2, 0.5, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function swimmer(ctx, x, y, s, skin, hair) {
  ellipse(ctx, x, y + 1, s * 0.5, s * 0.1, 'rgba(255,255,255,0.65)');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.32, s * 0.12, 0, Math.PI, TAU);
  ctx.fill();
  circle(ctx, x, y - s * 0.24, s * 0.16, skin);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(x, y - s * 0.24, s * 0.17, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
}

function paintNear(ctx, rng) {
  const W = 3000;
  // Straße hinter dem Zaun
  ctx.fillStyle = vgrad(ctx, ROAD_Y, WALL_Y, [[0, '#85888b'], [1, '#626569']]);
  ctx.fillRect(-10, ROAD_Y, W + 20, WALL_Y - ROAD_Y);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-10, ROAD_Y, W + 20, 1.2);
  ctx.fillStyle = '#f2c230';
  for (let x = 0; x < W; x += 34) ctx.fillRect(x, (ROAD_Y + WALL_Y) / 2 - 0.7, 18, 1.4);
  // Mäuerchen
  ctx.fillStyle = vgrad(ctx, WALL_Y - 2, SAND_Y + 1, [[0, '#fbf7ee'], [1, '#d9d1c0']]);
  ctx.fillRect(-10, WALL_Y - 2, W + 20, SAND_Y + 1 - WALL_Y + 2);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let x = 0; x < W; x += 42) ctx.fillRect(x, WALL_Y - 1, 0.8, SAND_Y - WALL_Y + 1);
  // Maschendrahtzaun
  const fTop = WALL_Y - 26;
  ctx.strokeStyle = 'rgba(150,160,168,0.32)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = -40; x < W + 40; x += 6) {
    ctx.moveTo(x, WALL_Y - 2);
    ctx.lineTo(x + 24, fTop);
    ctx.moveTo(x + 24, WALL_Y - 2);
    ctx.lineTo(x, fTop);
  }
  ctx.stroke();
  ctx.fillStyle = '#8a9198';
  for (let x = 10; x < W; x += 74) ctx.fillRect(x - 1.3, fTop - 2, 2.6, WALL_Y - fTop);
  ctx.fillRect(-10, fTop - 1, W + 20, 1.6);

  // Sand
  ctx.fillStyle = vgrad(ctx, SAND_Y, 712, [[0, '#fbf2dd'], [0.6, '#f6e7c6'], [1, '#eedaae']]);
  ctx.fillRect(-10, SAND_Y, W + 20, 720 - SAND_Y);
  ctx.fillStyle = 'rgba(160,120,60,0.18)';
  ctx.fillRect(-10, SAND_Y, W + 20, 1.5);
  // Meer und nasser Sand
  ctx.beginPath();
  ctx.moveTo(-10, 721);
  for (let x = -10; x <= W + 10; x += 10) ctx.lineTo(x, shoreY(x) - 6);
  ctx.lineTo(W + 10, 721);
  ctx.closePath();
  ctx.fillStyle = '#e4cc98';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-10, 721);
  for (let x = -10; x <= W + 10; x += 10) ctx.lineTo(x, shoreY(x));
  ctx.lineTo(W + 10, 721);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, 678, 720, [[0, '#8fe7dc'], [0.35, '#4fcfd0'], [1, '#1fa6bd']]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 160; i++) {
    const x = rng.range(0, W);
    const y = shoreY(x) + rng.range(5, 22);
    if (y < 719) ctx.fillRect(x, y, rng.range(4, 14), 0.8);
  }
  // Sand-Textur: Fußspuren, Muscheln, Körnung
  for (let i = 0; i < 900; i++) {
    const x = rng.range(0, W);
    const y = rng.range(SAND_Y + 3, shoreY(x) - 7);
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(190,150,90,0.22)' : 'rgba(255,255,255,0.55)';
    ctx.fillRect(x, y, rng.range(0.8, 2.2), rng.range(0.6, 1.2));
  }
  for (let i = 0; i < 60; i++) {
    const x = rng.range(0, W);
    const y = rng.range(SAND_Y + 8, shoreY(x) - 10);
    ellipse(ctx, x, y, 2.2, 0.9, 'rgba(180,140,80,0.25)');
    ellipse(ctx, x + 5, y + 1.6, 2.2, 0.9, 'rgba(180,140,80,0.25)');
  }
  for (let i = 0; i < 30; i++) {
    const x = rng.range(0, W);
    ellipse(ctx, x, shoreY(x) - rng.range(8, 16), 1.5, 1, rng.pick(['#fbe3ef', '#ffffff', '#f6c9a8']));
  }

  // Requisiten nach Tiefe sortiert (größeres y = weiter vorne)
  const props = [];
  const add = (y, fn) => props.push({ y, fn });
  NEAR_PALMS.forEach(([x, y, h, lean], i) => add(y, () => {
    palm(ctx, x, y, h, { lean, shadow: 'rgba(150,110,50,0.22)' });
    paintLights(ctx, NEAR_PALM_LIGHTS[i], 'rgba(30,50,30,0.6)', 0.8);
  }));
  add(XMAS_PALM[1], () => {
    const [x, y, h, lean] = XMAS_PALM;
    const g = palm(ctx, x, y, h, { lean, shadow: 'rgba(150,110,50,0.22)', leaf: '#2a9a4a', leafDark: '#1b6e35' });
    paintLights(ctx, XMAS_LIGHTS, 'rgba(30,50,30,0.6)', 0.8);
    star(ctx, g.tx, g.ty - 16, 15, '#ffd23f', '#f2a900');
    presents(ctx, x + 10, y + 2);
  });
  add(LIFEGUARD.base, () => lifeguardTower(ctx, LIFEGUARD.x, LIFEGUARD.base));
  add(642, () => warningSign(ctx, 612, 642));
  add(643, () => warningSign(ctx, 2162, 643));
  add(646, () => {
    beachBar(ctx, rng);
    paintLights(ctx, BAR_LIGHTS, 'rgba(30,50,30,0.6)', 0.8);
  });
  add(652, () => arrivalsBoard(ctx, 1332, 652));
  add(668, () => inflatableSnowman(ctx, 906, 668, 116));
  add(681, () => sandSnowman(ctx, 1992, 681, 46));
  // Sonnenschirme mit Weihnachtsmützen (und ein paar gestreifte)
  const umbrellas = [
    [392, 668, 56, ['#2ec4b6', '#ffffff'], -4], [478, 678, 60, 'santa', 3], [1182, 680, 58, 'santa', -3],
    [1868, 674, 58, 'santa', 4], [2296, 680, 60, 'santa', -2], [2384, 668, 54, ['#ffd166', '#ff7f6e'], 3], [2632, 674, 58, 'santa', -4],
  ];
  for (const [x, y, h, kind, tilt] of umbrellas) add(y, () => parasol(ctx, x, y, h, kind, tilt));
  // Handtücher mit Sonnenanbetern
  const towels = [
    [440, 690, 64, '#ff4f6d', '#ffffff', 1], [1140, 692, 58, '#ffcc33', '#2b7de9', 2], [1820, 688, 62, '#22b8a6', '#ffffff', 3],
    [2250, 694, 60, '#8e5cf0', '#ffcc33', 4], [2590, 690, 60, '#ff8a3d', '#ffffff', 0], [700, 694, 56, '#2b7de9', '#ffcc33', 5],
  ];
  for (const [x, y, w, c1, c2, si] of towels) {
    add(y, () => {
      towel(ctx, x, y, w, c1, c2);
      lying(ctx, x + 4, y - 3, w * 0.86, { skin: SKIN[si], suit: SUITS[(si + 3) % SUITS.length], hair: HAIR[si % HAIR.length], book: si % 2 ? '#ffffff' : null });
    });
  }
  // Stehende Zuschauer – Handys gezückt, Blick zur Piste
  const people = [
    [548, 674, 44, 'phone', 0, 1, 0, null], [586, 678, 42, 'point', 1, 3, 1, 'cap'],
    [692, 648, 41, 'phone', 2, 0, 0, null], [724, 650, 43, 'cheer', 3, 6, 1, 'santa'], [758, 647, 39, 'stand', 4, 2, 0, 'straw'], [792, 653, 30, 'cheer', 1, 4, 1, 'santa'],
    [1220, 670, 44, 'cheer', 0, 5, 1, null], [1258, 674, 41, 'phone', 5, 1, 0, 'santa'],
    [1672, 664, 43, 'phone', 2, 7, 0, 'cap'], [1704, 668, 40, 'stand', 4, 2, 1, 'straw'],
    [1958, 684, 26, 'wave', 1, 4, 1, null], [2028, 686, 24, 'cheer', 3, 3, 0, 'santa'],
    [2052, 649, 42, 'phone', 0, 0, 0, null], [2088, 651, 40, 'cheer', 2, 5, 1, null],
    [2238, 652, 43, 'stand', 5, 6, 0, 'santa'], [2712, 650, 41, 'phone', 1, 1, 1, null], [2746, 653, 37, 'cheer', 3, 2, 0, 'cap'],
    [2860, 676, 44, 'wave', 2, 4, 0, null],
  ];
  people.forEach(([x, y, s, pose, sk, su, fem, hat], i) => {
    add(y, () => figure(ctx, x, y, s, {
      pose, skin: SKIN[sk], suit: SUITS[su], hair: HAIR[(i * 3 + sk) % HAIR.length], female: !!fem, hat,
      shirt: i % 5 === 2 ? '#ffffff' : i % 7 === 3 ? '#7fd1c8' : null, tilt: i % 2 ? 1 : -1,
    }));
  });
  // Gäste an der Bar
  for (const [x, sk, fem, hat] of [[1408, 1, 1, null], [1472, 3, 0, 'santa'], [1528, 0, 1, null], [1592, 5, 0, null]]) {
    add(647, () => sitter(ctx, x, 625, 40, { skin: SKIN[sk], female: !!fem, hat, legs: true, suit: SUITS[(sk + 2) % SUITS.length], hair: HAIR[sk], shirt: sk === 3 ? '#ffd166' : null }));
  }
  // Surfbretter und Kajak
  add(662, () => {
    surfboard(ctx, 2826, 626, 84, 20, -1.38, ['#ff7f6e', '#ffffff', null]);
    surfboard(ctx, 2842, 628, 80, 20, -1.45, ['#2ec4b6', '#ffd166', null]);
    surfboard(ctx, 2858, 630, 76, 19, -1.52, ['#ffd166', '#2b7de9', null]);
    // Kajak mit Sitzluke und Paddel
    ellipse(ctx, 2794, 670, 50, 3.2, 'rgba(150,110,50,0.22)');
    ctx.beginPath();
    ctx.moveTo(2744, 666);
    ctx.quadraticCurveTo(2790, 659, 2840, 665);
    ctx.quadraticCurveTo(2792, 673, 2744, 666);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 659, 671, [[0, '#ffd84d'], [1, '#e8a400']]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(2760, 663, 62, 0.8);
    ellipse(ctx, 2788, 663.6, 9, 1.8, '#3a2f22');
    ellipse(ctx, 2788, 663.2, 7, 1.1, '#1d1712');
    ctx.strokeStyle = '#4a5560';
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    line(ctx, 2762, 671, 2814, 659.5);
    ellipse(ctx, 2759, 671.6, 4.2, 1.6, '#d62839');
    ellipse(ctx, 2817, 658.9, 4.2, 1.6, '#d62839');
  });
  // Kühlbox, Wasserball, Flip-Flops
  add(686, () => {
    ctx.fillStyle = '#2b7de9';
    ctx.fillRect(1104, 678, 18, 11);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1102, 676, 22, 3);
    circle(ctx, 2180, 682, 7, '#ffffff');
    ctx.fillStyle = '#ff4f6d';
    ctx.beginPath();
    ctx.moveTo(2180, 682);
    ctx.arc(2180, 682, 7, -0.6, 0.6);
    ctx.moveTo(2180, 682);
    ctx.arc(2180, 682, 7, 1.5, 2.6);
    ctx.fill();
    ctx.fillStyle = '#2b7de9';
    ctx.beginPath();
    ctx.moveTo(2180, 682);
    ctx.arc(2180, 682, 7, 3.6, 4.6);
    ctx.fill();
    ellipse(ctx, 1520, 684, 4, 1.4, '#ff4f6d');
    ellipse(ctx, 1528, 685, 4, 1.4, '#ff4f6d');
  });
  props.sort((a, b) => a.y - b.y);
  for (const p of props) p.fn();

  // Schwimmer in den Badebuchten
  for (const [x, s, sk] of [[176, 30, 1], [222, 28, 3], [300, 30, 0], [348, 26, 4], [2716, 30, 2], [2770, 28, 5], [2838, 30, 1]]) {
    swimmer(ctx, x, shoreY(x) + 13 + (x % 3), s, SKIN[sk], HAIR[sk]);
  }
}

// --- Dynamik --------------------------------------------------------------------
const FAR_GLITTER = [];
{
  const r = mulberry(9);
  for (let i = 0; i < 70; i++) FAR_GLITTER.push({ x: r() * 1800, y: HORIZON + 4 + r() * 44, p: r() * TAU, s: 1.5 + r() * 2.5 });
}
// Segelboote: hintere Bahnen (hinter Landzungen und Schiff, maskiert) und vordere Bahnen (vor allem im far-Layer)
const SAILBOATS = [];
{
  const r = mulberry(5);
  const sails = ['#ffffff', '#fff3d6', '#ffe0e0', '#ffffff', '#d8f3ff', '#ffffff', '#ffe9c2'];
  const lanes = [460, 464, 468, 472, 476, 485.5, 488];
  lanes.forEach((y, i) => {
    SAILBOATS.push({
      x0: r() * 2000, v: (r() < 0.5 ? -1 : 1) * (2 + r() * 4), y, back: y < WEST_SHORE,
      s: 0.42 + ((y - HORIZON) / 46) * 0.45, sail: sails[i % sails.length], hull: r() < 0.5 ? '#ffffff' : '#1d3f6e', p: r() * TAU,
    });
  });
}
const XMAS_STAR = (() => { const g = palmGeom(...XMAS_PALM); return { x: g.tx, y: g.ty - 16 }; })();
const NEAR_GLITTER = [];
{
  const r = mulberry(13);
  for (let i = 0; i < 110; i++) {
    const x = r() * 3000;
    NEAR_GLITTER.push({ x, y: shoreY(x) + 6 + r() * 14, p: r() * TAU, s: 1.2 + r() * 2 });
  }
}

function glints(ctx, list, t, x0, x1, size) {
  ctx.fillStyle = '#ffffff';
  const step = quality < 0.6 ? 2 : 1;
  for (let i = 0; i < list.length; i += step) {
    const g = list[i];
    if (g.x < x0 || g.x > x1) continue;
    const v = Math.sin(t * g.s + g.p);
    if (v < 0.55) continue;
    const a = (v - 0.55) / 0.45;
    const k = size * (0.5 + a * 0.5);
    ctx.globalAlpha = a * 0.9;
    ctx.fillRect(g.x - k * 2.2, g.y - 0.3, k * 4.4, 0.6);
    ctx.fillRect(g.x - 0.3, g.y - k * 1.3, 0.6, k * 2.6);
  }
  ctx.globalAlpha = 1;
}

function drawBoat(ctx, b, t, x0, x1) {
  const span = 2000;
  const x = ((((b.x0 + b.v * t) % span) + span) % span) - 100;
  if (x < x0 - 20 || x > x1 + 20) return;
  const y = b.y + Math.sin(t * 1.4 + b.p) * 0.4;
  ctx.save();
  ctx.translate(x, 0);
  if (b.v < 0) ctx.scale(-1, 1);
  sailboat(ctx, 0, y, b.s, b.sail, b.hull);
  ctx.restore();
}

function dynFar(ctx, t, x0, x1) {
  // Glitzern und hintere Boote nur über offenem Wasser (nicht auf Land oder Schiff)
  const mask = getFarBackMask();
  ctx.save();
  if (mask) ctx.clip(mask, 'evenodd');
  glints(ctx, FAR_GLITTER, t, x0, x1, 1);
  for (const b of SAILBOATS) if (b.back) drawBoat(ctx, b, t, x0, x1);
  ctx.restore();
  for (const b of SAILBOATS) if (!b.back) drawBoat(ctx, b, t, x0, x1);
}

function dynMid(ctx, t, x0, x1) {
  // Anflugbefeuerung: Lauflicht („Rabbit“) Richtung Schwelle
  if (x0 < 200) {
    const n = APPROACH_X.length;
    const ph = (t % 1.1) / 1.1;
    const idx = Math.floor(ph * (n + 2));
    for (let i = 0; i < n; i++) flare(ctx, '#fff4c8', APPROACH_X[i], RWY_Y - 3, 3.2, 0.35);
    if (idx < n) flare(ctx, '#ffffff', APPROACH_X[idx], RWY_Y - 3, 11, 1);
    for (let y = RWY_Y - 9; y <= RWY_Y + 9; y += 3) flare(ctx, '#5dff8a', RWY_X1 - 3, y, 3, 0.55);
  }
  if (PAPI.x > x0 && PAPI.x < x1) {
    for (let i = 0; i < 4; i++) flare(ctx, i < 2 ? '#ffffff' : '#ff4646', PAPI.x + i * 7, PAPI.y, 4.2, 0.75 + 0.15 * Math.sin(t * 3 + i));
  }
  if (RWY_X2 > x0 && RWY_X2 < x1) {
    for (let y = RWY_Y - 9; y <= RWY_Y + 9; y += 3) flare(ctx, '#ff5a5a', RWY_X2 + 3, y, 3, 0.5);
  }
  // Windsack
  if (WINDSOCK.x > x0 && WINDSOCK.x < x1) {
    const { x, y } = WINDSOCK;
    const w = Math.sin(t * 2.3) * 1.2 + Math.sin(t * 5.1) * 0.5;
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const a = 3.2 * i;
      const b = 3.2 * (i + 1);
      const ha = 2.6 - i * 0.3;
      const hb = 2.6 - (i + 1) * 0.3;
      const da = (w * i) / 5 + i * 0.4;
      const db = (w * (i + 1)) / 5 + (i + 1) * 0.4;
      poly(ctx, [[x + a, y + 0.8 - ha + da], [x + b, y + 0.8 - hb + db], [x + b, y + 0.8 + hb + db], [x + a, y + 0.8 + ha + da]], i % 2 ? '#ffffff' : '#ff6a1a');
    }
    ctx.restore();
  }
  // Tower: Rundumfeuer (grün/weiß) und Hindernisfeuer
  if (TOWER_X > x0 - 40 && TOWER_X < x1 + 40) {
    const ph = (t % 2) / 2;
    if (ph < 0.08) flare(ctx, '#ffffff', TOWER_X + 19.5, TOWER_ROOF - 6, 16, 1 - ph / 0.08);
    else if (ph > 0.5 && ph < 0.58) flare(ctx, '#3dff7a', TOWER_X + 19.5, TOWER_ROOF - 6, 16, 1 - (ph - 0.5) / 0.08);
    const on = (t % 1.4) < 0.7 ? 1 : 0.25;
    flare(ctx, '#ff3030', TOWER_X, 292, 9, on);
  }
  // Stern auf dem Terminal-Pavillon
  const starX = (TERM.pav1 + TERM.pav2) / 2;
  if (starX > x0 - 20 && starX < x1 + 20) flare(ctx, '#ffd23f', starX, 390, 22, 0.35 + 0.15 * Math.sin(t * 2.2));
  if (2262 > x0 && 2262 < x1) flare(ctx, '#ff3030', 2262, 300, 8, ((t + 0.6) % 1.6) < 0.8 ? 1 : 0.2);
  twinkle(ctx, MID_LIGHTS, t, x0, x1, 0.9);
  ctx.globalAlpha = 1;
}

// Uferlinie des Strands vorab tabelliert (Raster SURF_STEP), damit pro Frame nichts allokiert wird
const SURF_STEP = 14;
const SHORE_TAB = new Float32Array(Math.ceil(3100 / SURF_STEP) + 2);
for (let i = 0; i < SHORE_TAB.length; i++) SHORE_TAB[i] = shoreY(i * SURF_STEP - 28);
const SURF_TOP = new Float32Array(SHORE_TAB.length);

function dynNear(ctx, t, x0, x1) {
  // Brandung: Schwall läuft den Strand hoch, Schaumkante
  const step = SURF_STEP;
  const i0 = clamp(Math.floor((x0 + 28) / step), 0, SHORE_TAB.length - 1);
  const i1 = clamp(Math.ceil((x1 + 28) / step) + 1, i0, SHORE_TAB.length - 1);
  for (let i = i0; i <= i1; i++) {
    const x = i * step - 28;
    const sw = 4 + 4.5 * Math.sin(t * 0.9 + x * 0.0032) + 1.5 * Math.sin(t * 1.7 + x * 0.011);
    SURF_TOP[i] = SHORE_TAB[i] - sw;
  }
  ctx.beginPath();
  ctx.moveTo(i0 * step - 28, SHORE_TAB[i0] + 5);
  for (let i = i0; i <= i1; i++) ctx.lineTo(i * step - 28, SURF_TOP[i]);
  for (let i = i1; i >= i0; i--) ctx.lineTo(i * step - 28, SHORE_TAB[i] + 5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(200,250,244,0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) ctx.lineTo(i * step - 28, SURF_TOP[i]);
  ctx.stroke();
  const xa = i0 * step - 28;
  // Zweite, brechende Welle weiter draußen
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const x = xa + (i - i0) * step;
    const y = SHORE_TAB[i] + 11 + 2.5 * Math.sin(t * 0.9 + x * 0.0032 + 2.2);
    if (Math.sin(x * 0.013 + t * 0.4) > -0.2) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  glints(ctx, NEAR_GLITTER, t, x0, x1, 1.6);
  // Flagge am Rettungsturm
  const fx = LIFEGUARD.x + 33.8;
  if (fx > x0 - 40 && fx < x1 + 40) {
    const fy = LIFEGUARD.base - 62 - 38 - 40;
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const d = i * 5;
      pts.push([fx + d, fy + Math.sin(t * 6 - i * 0.9) * i * 0.45]);
    }
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + 14);
    ctx.closePath();
    ctx.fillStyle = '#ffcc33';
    ctx.fill();
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + 7);
    ctx.closePath();
    ctx.fillStyle = '#e63946';
    ctx.fill();
  }
  twinkle(ctx, NEAR_LIGHTS, t, x0, x1, 1);
  // Stern der Weihnachtspalme
  if (XMAS_STAR.x > x0 - 60 && XMAS_STAR.x < x1 + 60) flare(ctx, '#ffd23f', XMAS_STAR.x, XMAS_STAR.y, 34, 0.45 + 0.25 * Math.sin(t * 2.6));
  ctx.globalAlpha = 1;
}

// --- Gates (vor den Fluggastbrücken + Außenpositionen) ---------------------------
const GATES = [
  { layer: 'mid', x: 300, y: GATE_Y, dir: 1 },
  { layer: 'mid', x: 640, y: GATE_Y, dir: -1 },
  ...BRIDGE_GATES.map((x) => ({ layer: 'mid', x, y: GATE_Y, dir: -1 })),
  { layer: 'mid', x: 1505, y: GATE_Y, dir: -1 },
  { layer: 'mid', x: 1690, y: GATE_Y, dir: 1 },
  { layer: 'mid', x: 1990, y: GATE_Y, dir: 1 },
];

export default {
  id: 'SXM',
  iata: 'SXM',
  icao: 'TNCM',
  name: 'Princess Juliana',
  city: 'Sint Maarten',
  country: 'Karibik',
  subtitle: 'Tiefflug über Maho Beach',
  theme: { accent: '#2fd6c8', skyTop: '#1450bb', skyBottom: '#b2ecf1' },
  weather: { snow: 0 },
  layerTop: { far: 318, mid: 282, near: 222 },

  paintSky,

  paintLayer(ctx, layerId, { rng }) {
    ctx.save();
    if (layerId === 'far') paintFar(ctx, rng);
    else if (layerId === 'mid') paintMid(ctx, rng);
    else if (layerId === 'near') paintNear(ctx, rng);
    ctx.restore();
  },

  drawDynamic(ctx, layerId, { t, view }) {
    if (layerId === 'sky') return;
    quality = view.quality ?? 1;
    const off = view.layerOffset(layerId);
    const x0 = off - 30;
    const x1 = off + view.viewW + 30;
    ctx.save();
    if (layerId === 'far') dynFar(ctx, t, x0, x1);
    else if (layerId === 'mid') dynMid(ctx, t, x0, x1);
    else if (layerId === 'near') dynNear(ctx, t, x0, x1);
    ctx.restore();
  },

  traffic: {
    planeScale: { far: 0.38, mid: 1.0, near: 2.2 },
    runways: [{
      id: '10', layer: 'mid', y: RWY_Y, x1: RWY_X1, x2: RWY_X2, dir: 1, use: 'mixed',
      arrivalsPerMin: 3.4, departuresPerMin: 2.6,
      // Tiefflieger im near-Layer, doppelt so groß wie der Pistenverkehr; Sinkflug lowFlyY−160 → lowFlyY+10.
      // Fahrwerk bleibt in Bildmitte über der Terminal-Dachkante (≈ y 450): So donnert der Jet vor Himmel und
      // Hügeln über den Strand, statt wie ein Riesenflugzeug auf Vorfeld/Rollweg (y 508–560) zu stehen.
      approach: { startY: 120, lowFlyLayer: 'near', lowFlyY: 470, lowFlyPerMin: 2.2 },
    }],
    taxiways: [{ layer: 'mid', y: TWY_Y, x1: 190, x2: 2250 }],
    gates: GATES,
    overflights: [
      { layer: 'far', yMin: 40, yMax: 190, perMin: 3.5, contrails: true },
      { layer: 'mid', yMin: 150, yMax: 270, perMin: 1.2, contrails: false },
    ],
    helicopters: 0.5,
    fleet: { narrow: 5, wide: 2.5, jumbo: 1, a380: 0, regional: 2.5, prop: 2 },
    liveries: null,
  },

  eagleZones: { far: [50, 320], mid: [60, 400], near: [40, 380] },

  hideSpots: [
    { layer: 'mid', x: TOWER_X - 14, y: TOWER_ROOF, w: 28 },
    { layer: 'mid', x: 440, y: 456, w: 50 },
    { layer: 'mid', x: 962, y: 446, w: 60 }, // freie Firststrecke zwischen Palmenkrone und Pavillon
    { layer: 'near', x: LIFEGUARD.x - 14, y: LIFEGUARD.base - 62 - 38 - 6, w: 40 },
    { layer: 'far', x: SHIP.x + 104, y: SHIP.y - 44, w: 30 },
  ],
};
