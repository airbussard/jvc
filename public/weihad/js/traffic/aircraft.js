// Flugzeuge in Seitenansicht. Der statische Teil wird je Typ/Lackierung/Größenstufe einmal
// in ein Offscreen-Canvas gerendert (Sprite-Cache), pro Frame nur drawImage + Fahrwerk + Lichter.
import { fx } from './fx.js';

const TAU = Math.PI * 2;

// Maße in Welteinheiten bei scale = 1. Bug zeigt nach +x, Ursprung = Aufstandspunkt Hauptfahrwerk,
// y nach oben negativ. gearH = Bodenfreiheit der Rumpfunterkante, d = Rumpfhöhe, h = Gesamthöhe.
export const AIRCRAFT_TYPES = {
  regional: {
    nose: 45, tail: -40, gearH: 3.6, d: 8.2, h: 24,
    noseLen: 9, noseTip: 0.36, coneLen: 22, tailLo: 0.56, tailHi: 0.84, tailTop: 18,
    fin: { rf: -18, rb: -35, tf: -32, tb: -41, top: 23.5 }, tTail: true,
    stab: { len: 11, sweep: 5, rise: 0.6, t: 1.1 },
    wing: { x: 9, y: 0.1, chord: 13, sweep: 12, rise: 2.2, t: 1.6, tip: 4, winglet: 3.4 },
    engines: [{ x: -10, y: 10.6, r: 2.6, len: 13, rear: true }],
    win: [{ from: 33, to: -9, step: 2.3, y: 0.58, w: 1.0, h: 1.5 }],
    doors: [{ x: 37, w: 2.3 }],
    cockpit: [0.8, 0.58],
    main: [0], wheelR: 1.9, noseGear: 37, noseR: 1.4,
    span: 74, stabSpan: 28,
  },
  prop: {
    nose: 36, tail: -39, gearH: 3.4, d: 8.4, h: 24,
    noseLen: 8.5, noseTip: 0.42, coneLen: 24, tailLo: 0.6, tailHi: 0.86, tailTop: 15,
    fin: { rf: -14, rb: -33, tf: -30, tb: -39, top: 24, fillet: 12 }, tTail: true,
    stab: { len: 10, sweep: 3, rise: 0.5, t: 1.1 },
    highWing: { x: 7, chord: 11, t: 1.7 },
    engines: [{ x: 17, y: 11.2, r: 1.95, len: 22, prop: true, R: 5.6 }],
    sponson: { x1: 6, x2: -9, h: 2.8 },
    win: [{ from: 24, to: -19, step: 2.6, y: 0.56, w: 1.3, h: 1.5 }], titleX: -7, wrapX: -17.5,
    doors: [{ x: -23, w: 2.4 }, { x: 28.5, w: 2.6 }],
    cockpit: [0.86, 0.62],
    main: [0], wheelR: 1.7, noseGear: 30, noseR: 1.35,
    span: 68, stabSpan: 24,
  },
  narrow: {
    nose: 63, tail: -57, gearH: 5.5, d: 12.5, h: 34,
    noseLen: 12, noseTip: 0.34, coneLen: 34, tailLo: 0.58, tailHi: 0.86, tailTop: 26,
    fin: { rf: -28, rb: -50, tf: -47, tb: -57, top: 34 },
    stab: { x: -42, y: 0.5, len: 15, sweep: 8, rise: 1.8, t: 1.4 },
    wing: { x: 15, y: 0.14, chord: 21, sweep: 20, rise: 3.4, t: 2.2, tip: 6, winglet: 5.5 },
    engines: [{ x: 27, y: 4.9, r: 3.7, len: 17 }],
    win: [{ from: 45, to: -37, step: 2.75, y: 0.6, w: 1.2, h: 1.9 }],
    doors: [{ x: 49, w: 2.7 }, { x: -39, w: 2.6 }, { x: 5, w: 1.6, small: true }, { x: 2.2, w: 1.6, small: true }],
    cockpit: [0.8, 0.6],
    main: [0], wheelR: 2.6, noseGear: 49, noseR: 1.8,
    span: 112, stabSpan: 40,
  },
  wide: {
    nose: 88, tail: -82, gearH: 7, d: 16.5, h: 46,
    noseLen: 16, noseTip: 0.34, coneLen: 48, tailLo: 0.56, tailHi: 0.84, tailTop: 36,
    fin: { rf: -41, rb: -72, tf: -66, tb: -81, top: 46 },
    stab: { x: -59, y: 0.5, len: 21, sweep: 11, rise: 2.4, t: 1.8 },
    wing: { x: 22, y: 0.13, chord: 31, sweep: 29, rise: 4.6, t: 2.9, tip: 8, winglet: 6 },
    engines: [{ x: 40, y: 6.4, r: 5.3, len: 24 }],
    win: [{ from: 70, to: -56, step: 3.0, y: 0.6, w: 1.35, h: 2.2 }],
    doors: [{ x: 74, w: 3.2 }, { x: 44, w: 3.2 }, { x: -9, w: 3.2 }, { x: -37, w: 3.2 }, { x: -58, w: 3.0 }],
    cockpit: [0.8, 0.6], mask: true,
    main: [-4.6, 0, 4.6], wheelR: 2.9, noseGear: 72, noseR: 2.1,
    span: 160, stabSpan: 56, heavy: true,
  },
  jumbo: {
    nose: 90, tail: -90, gearH: 7, d: 16.5, h: 52,
    noseLen: 24, noseTip: 0.3, noseK: 0.62, noseK2: 0.72, coneLen: 50, tailLo: 0.56, tailHi: 0.84, tailTop: 38,
    hump: { from: 16, h: 7.4 },
    fin: { rf: -44, rb: -78, tf: -73, tb: -89, top: 52 },
    stab: { x: -64, y: 0.5, len: 22, sweep: 12, rise: 2.4, t: 1.9 },
    wing: { x: 27, y: 0.13, chord: 34, sweep: 34, rise: 5, t: 3.1, tip: 8, winglet: 4.5 },
    engines: [{ x: 46, y: 6.6, r: 4.5, len: 20 }, { x: 25, y: 5.2, r: 4.4, len: 19, outer: true }],
    win: [{ from: 66, to: -62, step: 3.0, y: 0.6, w: 1.3, h: 2.1 }, { from: 61, to: 24, step: 3.0, y: 'hump', w: 1.25, h: 1.9 }],
    doors: [{ x: 72, w: 3.2 }, { x: 44, w: 3.2 }, { x: 8, w: 3.2 }, { x: -24, w: 3.2 }, { x: -56, w: 3.0 }],
    cockpit: [1.39, 1.22],
    main: [-9.5, -5, 3, 7.5], wheelR: 2.8, noseGear: 75, noseR: 2.1,
    span: 165, stabSpan: 60, heavy: true, four: true,
  },
  a380: {
    nose: 95, tail: -95, gearH: 7, d: 22, h: 58,
    noseLen: 21, noseTip: 0.36, noseK: 0.7, noseK2: 0.55, coneLen: 56, tailLo: 0.54, tailHi: 0.82, tailTop: 42,
    fin: { rf: -48, rb: -84, tf: -79, tb: -94, top: 58 },
    stab: { x: -67, y: 0.42, len: 25, sweep: 13, rise: 2.6, t: 2.1 },
    wing: { x: 31, y: 0.12, chord: 41, sweep: 37, rise: 5.2, t: 3.6, tip: 10, winglet: 3.5 },
    engines: [{ x: 49, y: 7.6, r: 5.1, len: 22 }, { x: 27, y: 6.2, r: 5.0, len: 21, outer: true }],
    win: [{ from: 78, to: -66, step: 3.0, y: 0.3, w: 1.3, h: 2.1 }, { from: 72, to: -60, step: 3.0, y: 0.73, w: 1.3, h: 2.0 }],
    doors: [
      { x: 81, w: 3.2, y: 0.3 }, { x: 52, w: 3.2, y: 0.3 }, { x: 9, w: 3.2, y: 0.3 }, { x: -28, w: 3.2, y: 0.3 },
      { x: -59, w: 3.0, y: 0.3 }, { x: 69, w: 3.0, y: 0.73 }, { x: 21, w: 3.0, y: 0.73 }, { x: -46, w: 3.0, y: 0.73 },
    ],
    cockpit: [0.66, 0.53],
    main: [-12, -7.5, -3, 4, 8.5], wheelR: 2.9, noseGear: 80, noseR: 2.2,
    span: 175, stabSpan: 68, heavy: true, four: true,
  },
};
export const AIRCRAFT_TYPE_IDS = Object.keys(AIRCRAFT_TYPES);

// Fiktive Lackierungen – keine echten Airlines. motif = Leitwerks-Symbol.
export const DEFAULT_LIVERIES = [
  { name: 'Nordlicht', title: 'NORDLICHT', body: '#f5f7fa', belly: '#dfe4ea', tail: '#14306b', accent: '#3fd0c9', cheatline: '#14306b', engine: '#14306b', motif: 'aurora' },
  { name: 'Alpenblick', title: 'ALPENBLICK', titleColor: '#c8202f', body: '#f7f7f5', belly: '#eceeef', tail: '#c8202f', accent: '#ffffff', cheatline: null, engine: '#dcdfe3', motif: 'peak', wrap: true },
  { name: 'Sonnenkurs', title: 'SONNENKURS', body: '#ffffff', belly: '#e9ecef', tail: '#ff8a1f', accent: '#ffd23f', cheatline: '#ff8a1f', engine: '#ff8a1f', motif: 'sun' },
  { name: 'Atlantika', title: 'ATLANTIKA', titleColor: '#1d2b4f', body: '#eef1f5', belly: '#1d2b4f', tail: '#1d2b4f', accent: '#e23d52', cheatline: '#e23d52', engine: '#1d2b4f', motif: 'stripes' },
  { name: 'Wüstenfalke', title: 'WÜSTENFALKE', titleColor: '#0f5a46', body: '#f4eee2', belly: '#e3d8c4', tail: '#0f5a46', accent: '#d4a83a', cheatline: '#d4a83a', engine: '#e8dfcf', motif: 'chevron' },
  { name: 'Kirschblüte', title: 'KIRSCHBLÜTE', titleColor: '#c2386a', body: '#ffffff', belly: '#eff0f3', tail: '#fbe3ec', accent: '#e0457b', cheatline: null, engine: '#e9ebef', motif: 'blossom' },
  { name: 'Polarstern', title: 'POLARSTERN', body: '#f4f8fb', belly: '#cdd7e1', tail: '#0a9fb3', accent: '#ffffff', cheatline: '#0a9fb3', engine: '#cdd7e1', motif: 'star4' },
  { name: 'Ozeanblau', title: 'OZEANBLAU', titleColor: '#ffffff', body: '#2a62b8', belly: '#eef2f7', tail: '#2a62b8', accent: '#9fd3ff', cheatline: '#ffffff', engine: '#2a62b8', motif: 'wave' },
  { name: 'Kastanie', title: 'KASTANIE', body: '#fbfaf8', belly: '#e6e1db', tail: '#7a1f34', accent: '#d9b25f', cheatline: '#7a1f34', engine: '#7a1f34', motif: 'ring' },
  { name: 'Grünschnabel', title: 'GRÜNSCHNABEL', titleColor: '#2f7d26', body: '#ffffff', belly: '#eef1ee', tail: '#4cae3c', accent: '#1f5f2a', cheatline: '#4cae3c', engine: '#4cae3c', motif: 'leaf' },
  { name: 'Silbermöwe', title: 'SILBERMÖWE', titleColor: '#23262c', body: '#cfd4db', belly: '#9aa2ad', tail: '#23262c', accent: '#e8423f', cheatline: '#23262c', engine: '#9aa2ad', motif: 'arrow' },
  // Seltenes Weihnachts-Sonderdesign
  { name: 'Weihnachtsflieger', title: 'FROHE FESTE', titleColor: '#ffffff', body: '#c3142d', belly: '#ffffff', tail: '#c3142d', accent: '#f2c14e', cheatline: '#f2c14e', engine: '#ffffff', motif: 'xmas', snowcap: true, rare: true },
];

export const HELI_LIVERIES = [
  { body: '#d7263d', belly: '#f4f4f4', accent: '#ffffff', tail: '#d7263d' },
  { body: '#1f3f73', belly: '#c8cfd8', accent: '#9fd3ff', tail: '#1f3f73' },
  { body: '#f08a24', belly: '#2b2d31', accent: '#2b2d31', tail: '#f08a24' },
];

// --- Farb-Helfer ---------------------------------------------------------------

function mix(color, amt) {
  // amt > 0 → aufhellen, < 0 → abdunkeln (nur #rrggbb, sonst unverändert)
  if (typeof color !== 'string' || color[0] !== '#' || color.length !== 7) return color;
  const n = parseInt(color.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const tgt = amt > 0 ? 255 : 0;
  const k = Math.abs(amt);
  r = Math.round(r + (tgt - r) * k);
  g = Math.round(g + (tgt - g) * k);
  b = Math.round(b + (tgt - b) * k);
  return `rgb(${r},${g},${b})`;
}

function luminance(color) {
  if (typeof color !== 'string' || color[0] !== '#' || color.length !== 7) return 0.8;
  const n = parseInt(color.slice(1), 16);
  return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255;
}

function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

const bez = (a, b, c, d, u) => {
  const v = 1 - u;
  return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d;
};

// --- Geometrie ---------------------------------------------------------------

// Kontrollpunkte der oberen Bugkurve (für Rumpfpfad und Cockpitfenster)
function noseCurve(S) {
  const bot = -S.gearH;
  const top = bot - S.d - (S.hump ? S.hump.h : 0);
  const tipY = bot - S.d * S.noseTip;
  const x0 = S.nose - S.noseLen;
  return [x0, top, x0 + S.noseLen * (S.noseK ?? 0.6), top, S.nose, tipY - S.d * (S.noseK2 ?? 0.42), S.nose, tipY];
}

// x-Position der Bugkontur auf Höhe y (über der Bugspitze)
function noseXAt(S, y) {
  const c = noseCurve(S);
  let px = c[0];
  let py = c[1];
  for (let i = 1; i <= 24; i++) {
    const u = i / 24;
    const x = bez(c[0], c[2], c[4], c[6], u);
    const yy = bez(c[1], c[3], c[5], c[7], u);
    if (yy >= y) {
      const k = (y - py) / ((yy - py) || 1);
      return px + (x - px) * k;
    }
    px = x;
    py = yy;
  }
  return S.nose;
}

function bodyPath(ctx, S) {
  const bot = -S.gearH;
  const d = S.d;
  const top = bot - d;
  const c = noseCurve(S);
  ctx.beginPath();
  ctx.moveTo(S.tail, bot - d * S.tailHi);
  ctx.quadraticCurveTo(S.tail + S.tailTop * 0.55, top, S.tail + S.tailTop, top);
  if (S.hump) {
    const hx = S.hump.from;
    ctx.lineTo(hx, top);
    ctx.bezierCurveTo(hx + 9, top, hx + 9, top - S.hump.h, hx + 22, top - S.hump.h);
  }
  ctx.lineTo(c[0], c[1]);
  ctx.bezierCurveTo(c[2], c[3], c[4], c[5], c[6], c[7]);
  ctx.bezierCurveTo(S.nose, bot - d * 0.1, S.nose - S.noseLen * 0.25, bot, S.nose - Math.min(S.noseLen, d * 1.1) * 0.9, bot);
  ctx.lineTo(S.tail + S.coneLen, bot);
  ctx.bezierCurveTo(S.tail + S.coneLen * 0.5, bot, S.tail + S.coneLen * 0.18, bot - d * S.tailLo * 0.75, S.tail, bot - d * S.tailLo);
  ctx.closePath();
}

function finPath(ctx, S) {
  const f = S.fin;
  const top = -(S.gearH + S.d);
  const fl = f.fillet ?? (f.rf - f.rb) * 0.42;
  const hh = -f.top - top;
  const px = f.rf + (f.tf - f.rf) * 0.24;
  const py = top + hh * 0.24;
  ctx.beginPath();
  ctx.moveTo(f.rf + fl, top + 0.4);
  ctx.quadraticCurveTo(f.rf + 0.5, top - 0.2, px, py);
  ctx.lineTo(f.tf, -f.top + 1);
  ctx.quadraticCurveTo(f.tf - 0.3, -f.top, f.tf - 2, -f.top);
  ctx.lineTo(f.tb, -f.top);
  ctx.lineTo(f.rb, top + S.d * 0.4);
  ctx.lineTo(f.rf + fl, top + S.d * 0.4);
  ctx.closePath();
}

// --- Leitwerks-Motive --------------------------------------------------------

function star(ctx, x, y, r, points, inner) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function paintMotif(ctx, S, L) {
  const f = S.fin;
  const top = -(S.gearH + S.d);
  const fh = f.top - S.gearH - S.d; // Höhe über Rumpf
  const cx = (f.rf + f.rb + f.tf + f.tb) / 4 - fh * 0.02;
  const cy = top - fh * 0.55;
  const m = fh * 0.5;
  const ac = L.accent || '#ffffff';
  ctx.save();
  switch (L.motif) {
    case 'aurora': {
      const cols = [ac, mix(ac, 0.45), 'rgba(255,255,255,0.75)'];
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = cols[i];
        ctx.lineWidth = m * 0.16;
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const u = k / 12;
          const x = cx - m * 1.4 + u * m * 2.6;
          const y = cy + m * 0.55 - i * m * 0.42 - u * m * 0.9 + Math.sin(u * 6 + i) * m * 0.12;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'peak': {
      ctx.fillStyle = ac;
      ctx.beginPath();
      ctx.moveTo(cx - m * 1.2, cy + m * 0.75);
      ctx.lineTo(cx - m * 0.3, cy - m * 0.65);
      ctx.lineTo(cx + 0.05 * m, cy - m * 0.1);
      ctx.lineTo(cx + m * 0.35, cy - m * 0.45);
      ctx.lineTo(cx + m * 1.2, cy + m * 0.75);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'sun': {
      ctx.fillStyle = ac;
      ctx.beginPath();
      ctx.arc(cx, cy, m * 0.42, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = ac;
      ctx.lineWidth = m * 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        ctx.moveTo(cx + Math.cos(a) * m * 0.58, cy + Math.sin(a) * m * 0.58);
        ctx.lineTo(cx + Math.cos(a) * m * 0.82, cy + Math.sin(a) * m * 0.82);
      }
      ctx.stroke();
      break;
    }
    case 'stripes': {
      ctx.fillStyle = ac;
      for (let i = 0; i < 3; i++) {
        const o = (i - 1) * m * 0.42;
        ctx.beginPath();
        ctx.moveTo(cx - m * 1.6 + o, cy + m * 1.2);
        ctx.lineTo(cx - m * 1.35 + o, cy + m * 1.2);
        ctx.lineTo(cx + m * 0.6 + o, cy - m * 1.3);
        ctx.lineTo(cx + m * 0.35 + o, cy - m * 1.3);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'chevron': {
      ctx.strokeStyle = ac;
      ctx.lineWidth = m * 0.2;
      ctx.lineJoin = 'miter';
      for (let i = 0; i < 2; i++) {
        const y = cy - m * 0.1 + i * m * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - m * 0.65, y + m * 0.35);
        ctx.lineTo(cx, y - m * 0.3);
        ctx.lineTo(cx + m * 0.65, y + m * 0.35);
        ctx.stroke();
      }
      break;
    }
    case 'blossom': {
      ctx.fillStyle = ac;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * TAU;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * m * 0.32, cy + Math.sin(a) * m * 0.32, m * 0.3, m * 0.22, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(cx, cy, m * 0.13, 0, TAU);
      ctx.fill();
      break;
    }
    case 'star4': {
      ctx.fillStyle = ac;
      star(ctx, cx, cy, m * 0.75, 4, 0.28);
      ctx.fill();
      break;
    }
    case 'wave': {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.moveTo(cx - m * 2, cy + m * 0.2);
      for (let k = 0; k <= 16; k++) {
        const u = k / 16;
        ctx.lineTo(cx - m * 2 + u * m * 4, cy + m * 0.1 - Math.sin(u * TAU * 1.2) * m * 0.32);
      }
      ctx.lineTo(cx + m * 2, cy + m * 2);
      ctx.lineTo(cx - m * 2, cy + m * 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = ac;
      ctx.fillRect(cx - m * 2, cy + m * 0.65, m * 4, m * 0.14);
      break;
    }
    case 'ring': {
      ctx.strokeStyle = ac;
      ctx.lineWidth = m * 0.14;
      ctx.beginPath();
      ctx.arc(cx, cy, m * 0.5, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = ac;
      ctx.beginPath();
      ctx.arc(cx, cy, m * 0.18, 0, TAU);
      ctx.fill();
      break;
    }
    case 'leaf': {
      ctx.fillStyle = ac;
      ctx.beginPath();
      ctx.moveTo(cx - m * 0.6, cy + m * 0.6);
      ctx.quadraticCurveTo(cx - m * 0.7, cy - m * 0.5, cx + m * 0.6, cy - m * 0.7);
      ctx.quadraticCurveTo(cx + m * 0.5, cy + m * 0.5, cx - m * 0.6, cy + m * 0.6);
      ctx.fill();
      ctx.strokeStyle = mix(L.tail, 0.5);
      ctx.lineWidth = m * 0.06;
      ctx.beginPath();
      ctx.moveTo(cx - m * 0.55, cy + m * 0.55);
      ctx.lineTo(cx + m * 0.45, cy - m * 0.55);
      ctx.stroke();
      break;
    }
    case 'arrow': {
      ctx.fillStyle = ac;
      ctx.beginPath();
      ctx.moveTo(cx - m * 0.9, cy + m * 0.5);
      ctx.lineTo(cx + m * 0.2, cy - m * 0.35);
      ctx.lineTo(cx + 0.05 * m, cy - m * 0.6);
      ctx.lineTo(cx + m * 0.75, cy - m * 0.7);
      ctx.lineTo(cx + m * 0.55, cy - m * 0.02);
      ctx.lineTo(cx + m * 0.42, cy - m * 0.24);
      ctx.lineTo(cx - m * 0.62, cy + m * 0.72);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'xmas': {
      // Weißer Pelzrand, Tannenzweig mit goldenen Kugeln und Stern
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(f.rf + 6, top + 1);
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        ctx.lineTo(f.rf + 6 + (f.rb - f.rf - 6) * u, top - fh * 0.2 + Math.sin(u * 14) * fh * 0.025);
      }
      ctx.lineTo(f.rb - 3, top + 1);
      ctx.closePath();
      ctx.fill();
      const bx0 = cx - m * 0.85;
      const by0 = cy + m * 0.55;
      const bx1 = cx + m * 0.5;
      const by1 = cy - m * 0.3;
      ctx.strokeStyle = '#5a3a22';
      ctx.lineCap = 'round';
      ctx.lineWidth = m * 0.06;
      ctx.beginPath();
      ctx.moveTo(bx0, by0);
      ctx.lineTo(bx1, by1);
      ctx.stroke();
      ctx.strokeStyle = '#2f8a4a';
      ctx.lineWidth = m * 0.06;
      ctx.beginPath();
      for (let i = 1; i < 14; i++) {
        const u = i / 14;
        const x = bx0 + (bx1 - bx0) * u;
        const y = by0 + (by1 - by0) * u;
        const n = m * 0.34 * (1 - u * 0.55);
        ctx.moveTo(x, y);
        ctx.lineTo(x - n * 0.15, y - n);
        ctx.moveTo(x, y);
        ctx.lineTo(x + n * 0.8, y + n * 0.5);
      }
      ctx.stroke();
      ctx.fillStyle = '#f2c14e';
      for (const [u, o] of [[0.3, 0.16], [0.52, -0.12], [0.7, 0.12]]) {
        ctx.beginPath();
        ctx.arc(bx0 + (bx1 - bx0) * u + o * m * 0.4, by0 + (by1 - by0) * u + m * 0.16, m * 0.085, 0, TAU);
        ctx.fill();
      }
      star(ctx, bx1 + m * 0.1, by1 - m * 0.36, m * 0.34, 5, 0.45);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [dx, dy] of [[-0.5, -0.9], [0.6, 0.35], [-0.95, -0.15], [0.15, 0.95]]) {
        ctx.beginPath();
        ctx.arc(cx + dx * m, cy + dy * m * 0.8, m * 0.05, 0, TAU);
        ctx.fill();
      }
      break;
    }
    default: break;
  }
  ctx.restore();
}

// --- Bauteile ----------------------------------------------------------------

function drawFin(ctx, S, L) {
  const f = S.fin;
  ctx.save();
  finPath(ctx, S);
  const g = ctx.createLinearGradient(f.rf, 0, f.tb, 0);
  g.addColorStop(0, mix(L.tail, 0.12));
  g.addColorStop(1, mix(L.tail, -0.12));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  paintMotif(ctx, S, L);
  // Seitenruder-Fuge
  const top = -(S.gearH + S.d);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(f.rb + (f.rf - f.rb) * 0.26, top);
  ctx.lineTo(f.tb + (f.tf - f.tb) * 0.3, -f.top);
  ctx.stroke();
  ctx.restore();
  finPath(ctx, S);
  ctx.strokeStyle = 'rgba(15,20,30,0.3)';
  ctx.lineWidth = 0.3;
  ctx.stroke();
}

function drawBody(ctx, S, L, side) {
  const bot = -S.gearH;
  const d = S.d;
  const top = bot - d;
  const hTop = top - (S.hump ? S.hump.h : 0);
  const x0 = S.tail - 2;
  const w = S.nose - S.tail + 4;
  ctx.save();
  bodyPath(ctx, S);
  ctx.fillStyle = L.body;
  ctx.fill();
  ctx.clip();
  if (L.snowcap) {
    // Schneehaube: Rumpf weiß, Lackierung um die Schneedicke nach unten versetzt
    const sh = d * 0.1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0, hTop - 3, w, d + 6);
    ctx.save();
    ctx.translate(0, sh);
    bodyPath(ctx, S);
    ctx.fillStyle = L.body;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let x = S.tail + S.tailTop + 3, i = 0; x < S.nose - S.noseLen - 2; x += 5.5, i++) {
      if (S.hump && x > S.hump.from - 2) break;
      const dh = sh * (0.5 + ((i * 37) % 7) / 9);
      ctx.moveTo(x + 0.75, top + sh);
      ctx.ellipse(x, top + sh, 0.75, dh, 0, 0, Math.PI);
    }
    ctx.fill();
  }
  const wrapX = S.wrapX ?? S.fin.rf + 4;
  if (L.wrap) {
    // Heckfarbe zieht sich auf den Rumpf
    ctx.fillStyle = L.tail;
    ctx.beginPath();
    ctx.moveTo(wrapX, hTop - 2);
    ctx.quadraticCurveTo(wrapX - 6, bot - d * 0.3, S.tail + S.coneLen * 0.7, bot + 1);
    ctx.lineTo(S.tail - 3, bot + 1);
    ctx.lineTo(S.tail - 3, hTop - 2);
    ctx.closePath();
    ctx.fill();
  }
  // Bauch
  const by = bot - d * 0.3;
  ctx.fillStyle = L.belly;
  ctx.beginPath();
  ctx.moveTo(x0, by + d * 0.06);
  ctx.quadraticCurveTo(S.nose - S.noseLen * 0.7, by, S.nose + 2, by - d * 0.06);
  ctx.lineTo(S.nose + 2, bot + 2);
  ctx.lineTo(x0, bot + 2);
  ctx.closePath();
  ctx.fill();
  if (L.cheatline) {
    ctx.fillStyle = L.cheatline;
    ctx.beginPath();
    ctx.moveTo(S.tail + S.coneLen * 0.25, bot - d * 0.52);
    ctx.quadraticCurveTo(S.tail + S.coneLen, bot - d * 0.42, S.tail + S.coneLen * 1.6, bot - d * 0.42);
    ctx.lineTo(S.nose - S.noseLen * 0.15, bot - d * 0.42);
    ctx.lineTo(S.nose - S.noseLen * 0.1, bot - d * 0.36);
    ctx.lineTo(S.tail + S.coneLen * 1.6, bot - d * 0.36);
    ctx.quadraticCurveTo(S.tail + S.coneLen, bot - d * 0.36, S.tail + S.coneLen * 0.25, bot - d * 0.46);
    ctx.closePath();
    ctx.fill();
  }
  // Rundung: oben Glanz, unten Schatten
  const g = ctx.createLinearGradient(0, hTop, 0, bot);
  g.addColorStop(0, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.16, 'rgba(255,255,255,0.12)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(0.78, 'rgba(0,0,0,0.06)');
  g.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, hTop - 2, w, bot - hTop + 3);
  // Bug und Heck leicht abdunkeln
  const gx = ctx.createLinearGradient(S.tail, 0, S.nose, 0);
  gx.addColorStop(0, 'rgba(0,0,0,0.16)');
  gx.addColorStop(0.12, 'rgba(0,0,0,0)');
  gx.addColorStop(0.92, 'rgba(0,0,0,0)');
  gx.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = gx;
  ctx.fillRect(x0, hTop - 2, w, bot - hTop + 3);
  // Schriftzug (für die linke Seite gespiegelt vorgerendert, damit er lesbar bleibt)
  if (L.title) {
    const fs = d * (S.hump ? 0.3 : S.d > 20 ? 0.2 : 0.3);
    let tx = S.titleX ?? (S.hump ? S.hump.from - 26 : S.nose * 0.38);
    // Schriftzug nie in die farbige Heckpartie laufen lassen (Breite grob geschätzt)
    if (L.wrap) tx = Math.max(tx, wrapX + 1.5 + L.title.length * fs * 0.33);
    const ty = S.d > 20 ? bot - d * 0.5 : bot - d * (L.snowcap ? 0.8 : 0.84);
    ctx.save();
    ctx.translate(tx, ty);
    if (side < 0) ctx.scale(-1, 1);
    ctx.font = `italic 700 ${fs.toFixed(2)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = L.titleColor || (luminance(L.body) > 0.6 ? L.tail : '#ffffff');
    ctx.fillText(L.title, 0, 0);
    ctx.restore();
  }
  // Türen
  ctx.strokeStyle = 'rgba(20,25,35,0.32)';
  ctx.lineWidth = Math.max(0.22, d * 0.022);
  for (const dr of S.doors) {
    const rowY = dr.y != null ? bot - d * dr.y : null;
    const h = dr.small ? d * 0.34 : rowY != null ? d * 0.34 : d * 0.5;
    const yTop = dr.small ? bot - d * 0.6 - h / 2 : rowY != null ? rowY - h * 0.55 : bot - d * 0.2 - h;
    ctx.beginPath();
    rrect(ctx, dr.x - dr.w / 2, yTop, dr.w, h, dr.w * 0.3);
    ctx.stroke();
  }
  ctx.restore();
  bodyPath(ctx, S);
  ctx.strokeStyle = 'rgba(15,20,30,0.35)';
  ctx.lineWidth = Math.max(0.25, d * 0.025);
  ctx.stroke();
}

function wingGrad(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#e1e5ea');
  g.addColorStop(0.5, '#b9bfc8');
  g.addColorStop(1, '#8d949e');
  return g;
}

function drawWing(ctx, S, L) {
  const w = S.wing;
  const bot = -S.gearH;
  const ry = bot - S.d * w.y;
  // Blick leicht von unten: der nahe Flügel hängt nach hinten unten
  const tx = w.x - w.sweep;
  const ty = ry + wingDrop(S);
  ctx.save();
  // Flügelwurzel-Verkleidung
  ctx.fillStyle = mix(L.belly, -0.1);
  ctx.beginPath();
  ctx.ellipse(w.x - w.chord * 0.42, bot - 0.1, w.chord * 0.72, S.d * 0.09, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w.x + 1.5, ry - w.t * 0.3);
  ctx.lineTo(tx, ty - w.t * 0.25);
  ctx.lineTo(tx - w.tip, ty + w.t * 0.1);
  ctx.lineTo(w.x - w.chord, ry + w.t * 0.1);
  ctx.closePath();
  ctx.fillStyle = wingGrad(ctx, ry - w.t, ty + w.t);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,35,45,0.4)';
  ctx.lineWidth = 0.25;
  ctx.stroke();
  // Vorderkante (Glanz) und Landeklappen-Fuge
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = w.t * 0.28;
  ctx.beginPath();
  ctx.moveTo(w.x + 1, ry - w.t * 0.15);
  ctx.lineTo(tx - 0.3, ty - w.t * 0.1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,45,55,0.4)';
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(w.x - w.chord * 0.72, ry + w.t * 0.1);
  ctx.lineTo(tx - w.tip * 0.62, ty + w.t * 0.05);
  ctx.moveTo(w.x - w.chord * 0.38, ry + w.t * 0.1);
  ctx.lineTo(w.x - w.chord * 0.52 - w.sweep * 0.45, ry + (ty - ry) * 0.5);
  ctx.stroke();
  // Winglet
  if (w.winglet) {
    ctx.fillStyle = L.tail;
    ctx.beginPath();
    ctx.moveTo(tx - w.tip * 0.1, ty - w.t * 0.2);
    ctx.quadraticCurveTo(tx - w.tip * 0.45, ty - w.winglet * 0.55, tx - w.tip * 0.75, ty - w.winglet);
    ctx.lineTo(tx - w.tip * 1.05, ty - w.winglet);
    ctx.lineTo(tx - w.tip, ty + w.t * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function wingDrop(S) {
  return S.wing.drop ?? S.d * 0.3;
}

function drawHighWing(ctx, S, L) {
  const w = S.highWing;
  const top = -(S.gearH + S.d);
  ctx.save();
  // Verkleidung auf dem Rumpfrücken
  ctx.beginPath();
  ctx.moveTo(w.x + 7, top + 0.6);
  ctx.bezierCurveTo(w.x + 3, top - 1.8, w.x - 2, top - 1.9, w.x - w.chord * 0.6, top - 1.8);
  ctx.bezierCurveTo(w.x - w.chord - 3, top - 1.7, w.x - w.chord - 6, top - 0.6, w.x - w.chord - 10, top + 0.5);
  ctx.closePath();
  const gf = ctx.createLinearGradient(0, top - 2, 0, top + 0.6);
  gf.addColorStop(0, mix(L.body, 0.35));
  gf.addColorStop(1, L.body);
  ctx.fillStyle = gf;
  ctx.fill();
  // Flügelprofil
  ctx.beginPath();
  ctx.moveTo(w.x + 0.8, top - 1.5 - w.t * 0.45);
  ctx.quadraticCurveTo(w.x + 0.6, top - 1.6 - w.t, w.x - 1.5, top - 1.6 - w.t);
  ctx.lineTo(w.x - w.chord, top - 1.5 - w.t * 0.4);
  ctx.lineTo(w.x - w.chord, top - 1.2);
  ctx.lineTo(w.x + 0.4, top - 1.2);
  ctx.closePath();
  ctx.fillStyle = wingGrad(ctx, top - 1.6 - w.t, top - 1.2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,35,45,0.4)';
  ctx.lineWidth = 0.2;
  ctx.stroke();
  ctx.restore();
}

function drawFan(ctx, e, S, L) {
  const cy = -e.y;
  const r = e.r;
  const x0 = e.x;
  const x1 = e.x - e.len;
  const w = S.wing;
  const wy = -(S.gearH + S.d * w.y) + wingDrop(S) * (e.outer ? 0.62 : 0.34) - w.t * 0.2;
  ctx.save();
  // Pylon zum Flügel
  ctx.fillStyle = mix(L.belly, -0.18);
  ctx.beginPath();
  ctx.moveTo(x0 - e.len * 0.3, cy - r * 0.8);
  ctx.lineTo(x0 - e.len * 0.42, wy);
  ctx.lineTo(x1 - r * 0.4, wy + w.t * 0.3);
  ctx.lineTo(x1 + r * 0.2, cy - r * 0.45);
  ctx.closePath();
  ctx.fill();
  // Kerntriebwerk + Düse
  ctx.fillStyle = '#7f8691';
  ctx.beginPath();
  ctx.moveTo(x0 - e.len * 0.6, cy - r * 0.62);
  ctx.lineTo(x1, cy - r * 0.42);
  ctx.lineTo(x1, cy + r * 0.42);
  ctx.lineTo(x0 - e.len * 0.6, cy + r * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a4f57';
  ctx.beginPath();
  ctx.moveTo(x1 + 0.2, cy - r * 0.3);
  ctx.lineTo(x1 - r * 0.75, cy + r * 0.02);
  ctx.lineTo(x1 + 0.2, cy + r * 0.3);
  ctx.closePath();
  ctx.fill();
  // Fan-Verkleidung
  const xb = x0 - e.len * 0.7;
  ctx.beginPath();
  ctx.moveTo(x0, cy - r * 0.9);
  ctx.quadraticCurveTo(x0 - r * 0.2, cy - r * 1.02, x0 - r * 0.9, cy - r);
  ctx.lineTo(xb, cy - r * 0.86);
  ctx.quadraticCurveTo(xb - r * 0.35, cy, xb, cy + r * 0.86);
  ctx.lineTo(x0 - r * 0.9, cy + r);
  ctx.quadraticCurveTo(x0 - r * 0.2, cy + r * 1.02, x0, cy + r * 0.9);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, mix(L.engine, 0.45));
  g.addColorStop(0.35, L.engine);
  g.addColorStop(1, mix(L.engine, -0.35));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,25,35,0.35)';
  ctx.lineWidth = 0.25;
  ctx.stroke();
  // Zierband
  if (L.accent && luminance(L.accent) < 0.95) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = L.accent;
    ctx.fillRect(x0 - e.len * 0.36, cy - r * 1.1, e.len * 0.07, r * 2.2);
    ctx.restore();
  }
  // Einlauf-Lippe
  ctx.fillStyle = '#e6e9ed';
  ctx.beginPath();
  ctx.ellipse(x0 - r * 0.05, cy, r * 0.2, r * 0.92, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#272b33';
  ctx.beginPath();
  ctx.ellipse(x0 + r * 0.02, cy, r * 0.1, r * 0.72, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawRearEngine(ctx, e, S, L) {
  const cy = -e.y;
  const r = e.r;
  const x0 = e.x;
  const x1 = e.x - e.len;
  ctx.save();
  ctx.fillStyle = mix(L.body, -0.12);
  ctx.beginPath();
  ctx.moveTo(x0 - e.len * 0.25, cy + r * 0.5);
  ctx.quadraticCurveTo(x0 - e.len * 0.45, cy + r * 1.6, x0 - e.len * 0.8, cy + r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x0, cy - r * 0.9);
  ctx.lineTo(x1 + r * 0.5, cy - r * 0.75);
  ctx.quadraticCurveTo(x1 - r * 0.2, cy, x1 + r * 0.5, cy + r * 0.75);
  ctx.lineTo(x0, cy + r * 0.9);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, mix(L.engine, 0.45));
  g.addColorStop(0.4, L.engine);
  g.addColorStop(1, mix(L.engine, -0.35));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,25,35,0.35)';
  ctx.lineWidth = 0.22;
  ctx.stroke();
  ctx.fillStyle = '#e6e9ed';
  ctx.beginPath();
  ctx.ellipse(x0, cy, r * 0.2, r * 0.88, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#272b33';
  ctx.beginPath();
  ctx.ellipse(x0 + r * 0.04, cy, r * 0.1, r * 0.66, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPropNacelle(ctx, e, S, L) {
  const cy = -e.y;
  const r = e.r;
  const x0 = e.x;
  const x1 = e.x - e.len;
  const col = mix(L.body, 0.12);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, cy - r * 0.8);
  ctx.quadraticCurveTo(x0 - 1, cy - r * 1.05, x0 - r * 1.2, cy - r * 1.05);
  ctx.lineTo(x1 + 2, cy - r * 1.05);
  ctx.quadraticCurveTo(x1, cy - r * 0.9, x1 + 0.5, cy - r * 0.5);
  ctx.quadraticCurveTo(x0 - e.len * 0.55, cy + r * 1.05, x0 - r * 1.6, cy + r * 1.0);
  ctx.quadraticCurveTo(x0 - 0.2, cy + r * 0.95, x0, cy + r * 0.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, mix(col, 0.4));
  g.addColorStop(0.45, col);
  g.addColorStop(1, mix(col, -0.3));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,25,35,0.35)';
  ctx.lineWidth = 0.2;
  ctx.stroke();
  // Lufteinlass + Abgasrohr
  ctx.fillStyle = '#30343b';
  ctx.beginPath();
  ctx.ellipse(x0 - r * 0.25, cy + r * 0.62, r * 0.35, r * 0.22, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(x0 - e.len * 0.5, cy + r * 0.25, 2, 0.8);
  // Spinner
  ctx.fillStyle = L.accent && luminance(L.accent) < 0.95 ? L.accent : mix(L.tail, 0.1);
  ctx.beginPath();
  ctx.moveTo(x0, cy - r * 0.62);
  ctx.quadraticCurveTo(x0 + r * 1.4, cy - r * 0.4, x0 + r * 1.55, cy);
  ctx.quadraticCurveTo(x0 + r * 1.4, cy + r * 0.4, x0, cy + r * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStab(ctx, S, L) {
  const st = S.stab;
  let x;
  let y;
  if (S.tTail) {
    x = S.fin.tf + 1;
    y = -S.fin.top + 0.9;
  } else {
    x = st.x;
    y = -(S.gearH + S.d * st.y);
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - st.t * 0.5);
  ctx.lineTo(x - st.sweep, y - st.rise - st.t * 0.3);
  ctx.lineTo(x - st.sweep - st.len * 0.32, y - st.rise + st.t * 0.1);
  ctx.lineTo(x - st.len, y + st.t * 0.25);
  ctx.quadraticCurveTo(x - st.len * 0.4, y + st.t * 0.7, x, y + st.t * 0.25);
  ctx.closePath();
  ctx.fillStyle = S.tTail ? L.tail : wingGrad(ctx, y - st.rise - st.t, y + st.t);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,35,45,0.35)';
  ctx.lineWidth = 0.22;
  ctx.stroke();
  ctx.restore();
}

function drawWindows(ctx, S, L, night, q) {
  const bot = -S.gearH;
  const d = S.d;
  ctx.save();
  let n = 0;
  for (const row of S.win) {
    const cy = row.y === 'hump' ? bot - d - S.hump.h * 0.42 : bot - d * row.y;
    const deckDoors = S.doors.filter((dr) => (dr.y == null && row.y !== 'hump') || dr.y === row.y);
    if (night) {
      // weicher Lichtschein hinter der Fensterreihe (Verlauf statt teurem shadowBlur)
      const gh = row.h * 1.6;
      const g = ctx.createLinearGradient(0, cy - gh, 0, cy + gh);
      g.addColorStop(0, 'rgba(255,196,110,0)');
      g.addColorStop(0.5, 'rgba(255,196,110,0.32)');
      g.addColorStop(1, 'rgba(255,196,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(row.to - row.w, cy - gh, row.from - row.to + row.w * 2, gh * 2);
    }
    ctx.fillStyle = night ? '#ffd98c' : '#1d2836';
    ctx.beginPath();
    for (let x = row.from; x >= row.to; x -= row.step) {
      if (deckDoors.some((dr) => Math.abs(dr.x - x) < dr.w / 2 + row.w * 0.7)) continue;
      n++;
      if (night && (n * 7919) % 23 === 0) continue; // vereinzelt dunkle Fenster
      rrect(ctx, x - row.w / 2, cy - row.h / 2, row.w, row.h, row.w * 0.45);
    }
    ctx.fill();
    if (!night) {
      // Spiegelung
      ctx.fillStyle = 'rgba(170,205,240,0.45)';
      ctx.beginPath();
      for (let x = row.from; x >= row.to; x -= row.step) {
        if (deckDoors.some((dr) => Math.abs(dr.x - x) < dr.w / 2 + row.w * 0.7)) continue;
        ctx.rect(x - row.w / 2 + row.w * 0.15, cy - row.h / 2 + row.h * 0.12, row.w * 0.35, row.h * 0.3);
      }
      ctx.fill();
    }
  }
  // Türfenster
  ctx.fillStyle = night ? '#ffd98c' : '#2a3442';
  for (const dr of S.doors) {
    if (dr.small) continue;
    const rowY = dr.y != null ? bot - d * dr.y : bot - d * 0.6;
    ctx.fillRect(dr.x - dr.w * 0.2, rowY - row0h(S) * 0.45, dr.w * 0.4, row0h(S) * 0.7);
  }
  // Cockpit: Fensterband folgt der Bugkontur
  const [fTop, fBot] = S.cockpit;
  const yT = bot - d * fTop;
  const yB = bot - d * fBot;
  const inset = d * 0.07;
  const xT = noseXAt(S, yT) - inset;
  const xB = noseXAt(S, yB) - inset * 0.6;
  const wT = d * (S.hump ? 0.52 : 0.5);
  const wB = d * (S.hump ? 0.62 : 0.66);
  ctx.beginPath();
  ctx.moveTo(xT, yT);
  ctx.lineTo(xB, yB);
  ctx.lineTo(xB - wB, yB);
  ctx.lineTo(xT - wT, yT);
  ctx.closePath();
  if (S.mask) {
    // dunkle „Maske“ um die Cockpitfenster
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1b1e24';
    ctx.lineWidth = d * 0.09;
    ctx.stroke();
    ctx.restore();
  }
  const g = ctx.createLinearGradient(0, yT, 0, yB);
  g.addColorStop(0, night ? '#1a2230' : '#3a5068');
  g.addColorStop(1, night ? '#0c1018' : '#141b26');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = L.body;
  ctx.lineWidth = d * 0.045;
  ctx.beginPath();
  for (const k of [0.38, 0.68]) {
    ctx.moveTo(xT - wT * k + d * 0.02, yT);
    ctx.lineTo(xB - wB * k, yB);
  }
  ctx.stroke();
  ctx.restore();
}

function row0h(S) {
  return S.win[0].h;
}

function drawSponson(ctx, S, L) {
  const sp = S.sponson;
  const bot = -S.gearH;
  ctx.save();
  ctx.fillStyle = mix(L.belly, -0.12);
  ctx.beginPath();
  ctx.moveTo(sp.x1 + 3, bot - sp.h);
  ctx.quadraticCurveTo(sp.x1 + 5, bot + 0.6, sp.x1, bot + 0.6);
  ctx.lineTo(sp.x2, bot + 0.6);
  ctx.quadraticCurveTo(sp.x2 - 4, bot + 0.4, sp.x2 - 6, bot - sp.h * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,25,35,0.3)';
  ctx.lineWidth = 0.2;
  ctx.stroke();
  ctx.restore();
}

function paintAircraft(ctx, S, L, side, night, tint, q, bounds) {
  const bot = -S.gearH;
  drawFin(ctx, S, L);
  drawBody(ctx, S, L, side);
  if (S.sponson) drawSponson(ctx, S, L);
  if (!S.highWing) drawWing(ctx, S, L);
  for (const e of S.engines) {
    if (e.rear) drawRearEngine(ctx, e, S, L);
    else if (e.prop) drawPropNacelle(ctx, e, S, L);
    else drawFan(ctx, e, S, L);
  }
  if (S.highWing) drawHighWing(ctx, S, L);
  drawStab(ctx, S, L);
  if (tint) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tint;
    ctx.fillRect(bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1]);
    ctx.restore();
  }
  drawWindows(ctx, S, L, night, q);
  if (night) {
    // Leitwerks-Beleuchtung von unten
    const f = S.fin;
    const top = bot - S.d;
    const cx = (f.rf + f.rb) / 2 + 2;
    const r = (f.top - S.gearH - S.d) * 0.9;
    ctx.save();
    finPath(ctx, S);
    ctx.clip();
    const g = ctx.createRadialGradient(cx, top, 0, cx, top, r);
    g.addColorStop(0, 'rgba(255,240,210,0.45)');
    g.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, top - r, r * 2, r);
    ctx.restore();
  }
}

// --- Sprite-Cache ------------------------------------------------------------

const STEP = 1.4;
const LOG_STEP = Math.log(STEP);
const MAX_SPRITES = 120;
const MAX_AREA = 8e6; // Pixel gesamt (~32 MB), Handys haben wenig Canvas-Speicher
const sprites = new Map();
export const spriteStats = { created: 0, ms: 0, evicted: 0, area: 0 }; // Diagnose (Anzahl/Zeit gerenderter Sprites)
let spriteArea = 0;
const ids = new WeakMap();
let nextId = 1;

function objKey(o) {
  let k = ids.get(o);
  if (!k) {
    k = nextId++;
    ids.set(o, k);
  }
  return k;
}

// Canvas-Befehle werden verzögert ausgeführt: einmal als Bildquelle benutzen, damit die Arbeit jetzt anfällt
let scratch = null;
function rasterize(c) {
  if (!scratch) scratch = document.createElement('canvas').getContext('2d');
  scratch.drawImage(c, 0, 0, 1, 1);
}

function spriteLevel(px) {
  return Math.max(-14, Math.min(8, Math.ceil(Math.log(Math.max(px, 0.02)) / LOG_STEP - 1e-6)));
}

function cached(key, px, x0, y0, x1, y1, paint, peek = false) {
  const lv = spriteLevel(px);
  const k = key + '|' + lv;
  let s = sprites.get(k);
  if (peek) {
    if (s) return null;
  } else if (s) {
    sprites.delete(k);
    sprites.set(k, s);
    return s;
  }
  let q = Math.pow(STEP, lv);
  q = Math.min(q, 2048 / (x1 - x0), 1024 / (y1 - y0));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((x1 - x0) * q));
  c.height = Math.max(1, Math.ceil((y1 - y0) * q));
  const ctx = c.getContext('2d');
  ctx.setTransform(q, 0, 0, q, -x0 * q, -y0 * q);
  const t0 = performance.now();
  paint(ctx, q);
  spriteStats.created++;
  spriteStats.ms += performance.now() - t0;
  s = { c, x0, y0, w: c.width / q, h: c.height / q };
  if (peek) rasterize(c);
  sprites.set(k, s);
  spriteArea += c.width * c.height;
  while ((sprites.size > MAX_SPRITES || spriteArea > MAX_AREA) && sprites.size > 1) {
    const [k0, s0] = sprites.entries().next().value;
    sprites.delete(k0);
    spriteArea -= s0.c.width * s0.c.height;
    spriteStats.evicted++;
  }
  spriteStats.area = spriteArea;
  return s;
}

export function clearAircraftCache() {
  sprites.clear();
  spriteArea = 0;
}

function aircraftSprite(typeId, S, L, side, night, tint, px, peek = false) {
  const x0 = S.tail - 12;
  const x1 = S.nose + 8;
  const y0 = -(S.h + 4);
  const y1 = 2;
  const key = `${typeId}|${objKey(L)}|${side}|${night ? 1 : 0}|${tint || ''}`;
  return cached(key, px, x0, y0, x1, y1, (ctx, q) => paintAircraft(ctx, S, L, side, night, tint, q, [x0, y0, x1, y1]), peek);
}

// Sprite vorab rendern (z. B. solange ein Flugzeug noch unsichtbar ist). true = es wurde gerendert.
export function prepareAircraft({ type, livery, scale = 1, res = 1, lights = false, tint = null, side = 1 }) {
  const typeId = AIRCRAFT_TYPES[type] ? type : 'narrow';
  const L = livery || DEFAULT_LIVERIES[0];
  return !!aircraftSprite(typeId, AIRCRAFT_TYPES[typeId], L, side < 0 ? -1 : 1, !!lights, tint || null, scale * res, true);
}

function ctxScale(ctx) {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

// --- Dynamische Teile --------------------------------------------------------

// Hauptfahrwerk in Gruppen (Drehgestelle) – einmal je Typ berechnet
function gearGroups(S) {
  if (S._groups) return S._groups;
  const groups = [];
  for (const x of S.main) {
    const last = groups[groups.length - 1];
    if (last && x - last[last.length - 1] < 5.5) last.push(x);
    else groups.push([x]);
  }
  S._groups = groups;
  return groups;
}

function drawGear(ctx, S, g) {
  const lift = (1 - g) * (S.gearH + S.wheelR);
  const r = S.wheelR;
  const groups = gearGroups(S);
  ctx.fillStyle = '#868d97';
  for (const gr of groups) {
    const cx = (gr[0] + gr[gr.length - 1]) / 2;
    const yTop = -S.gearH - 1;
    const yBot = -r + lift;
    if (yBot > yTop) ctx.fillRect(cx - r * 0.22, yTop, r * 0.44, yBot - yTop);
    if (gr.length > 1) ctx.fillRect(gr[0], yBot - r * 0.18, gr[gr.length - 1] - gr[0], r * 0.36);
  }
  const nr = S.noseR;
  const nyBot = -nr + lift * (S.gearH + nr) / (S.gearH + r);
  ctx.fillRect(S.noseGear - nr * 0.2, -S.gearH - 1, nr * 0.4, Math.max(0, nyBot + S.gearH + 1));
  ctx.fillStyle = '#1b1d22';
  ctx.beginPath();
  for (const x of S.main) {
    ctx.moveTo(x + r, -r + lift);
    ctx.arc(x, -r + lift, r, 0, TAU);
  }
  ctx.moveTo(S.noseGear + nr, nyBot);
  ctx.arc(S.noseGear, nyBot, nr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8f96a0';
  ctx.beginPath();
  for (const x of S.main) {
    ctx.moveTo(x + r * 0.42, -r + lift);
    ctx.arc(x, -r + lift, r * 0.42, 0, TAU);
  }
  ctx.moveTo(S.noseGear + nr * 0.42, nyBot);
  ctx.arc(S.noseGear, nyBot, nr * 0.42, 0, TAU);
  ctx.fill();
}

function drawProps(ctx, S, t, throttle) {
  for (const e of S.engines) {
    if (!e.prop) continue;
    const cx = e.x + e.r * 1.1;
    const cy = -e.y;
    const R = e.R;
    const spin = t * (1.5 + 46 * throttle);
    if (throttle > 0.35) {
      ctx.fillStyle = 'rgba(70,75,85,0.2)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * 0.16, R, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = throttle > 0.35 ? 'rgba(25,28,34,0.4)' : '#25282e';
    ctx.lineWidth = 0.65;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * TAU) / 6;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(a) * R * 0.16, cy + Math.cos(a) * R);
    }
    ctx.stroke();
  }
}

// Santa-Mütze auf der Leitwerksspitze (nach Treffer)
function drawHat(ctx, S) {
  const f = S.fin;
  const x = f.tf - 3;
  const y = -f.top + 0.4;
  const s = S.d * 0.045;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#d61f36';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.quadraticCurveTo(-6, -16, 4, -18);
  ctx.quadraticCurveTo(10, -16, 13, -9);
  ctx.quadraticCurveTo(7, -12, 7, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  rrect(ctx, -11, -3, 21, 6, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(13, -8, 3.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function flash(t, period, on) {
  const u = (((t % period) + period) % period) / period;
  return u < on ? 1 - u / on : 0;
}

// Leuchtpunkt in Weltkoordinaten
function light(ctx, spr, x, y, size, alpha) {
  if (alpha <= 0.01 || size <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(spr, x - size / 2, y - size / 2, size, size);
}

// Fläche füllen und bei Lichtstimmung (tint) dieselbe Form abtönen, passend zum vorgerenderten Sprite
function fillTinted(ctx, color, tint) {
  ctx.fillStyle = color;
  ctx.fill();
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fill();
  }
}

// Kurve am Boden: Tragfläche, Höhenleitwerk und Triebwerke in Schrägansicht.
// half = -1 → abgewandte Hälfte (vor dem Rumpf zeichnen), +1 → zugewandte Hälfte (danach).
function turnExtras(ctx, S, L, o, sc, dir, half) {
  const proj = Math.sqrt(Math.max(0, 1 - dir * dir));
  const side = dir < 0 ? -1 : 1;
  const ad = Math.abs(dir);
  // Bildschirmseite der abgewandten Hälfte: hängt davon ab, ob der Bug von uns weg oder zu uns zeigt
  const farSide = o.away === false ? side : -side;
  const hx = half < 0 ? farSide : -farSide;
  // Weiter entfernte Teile liegen etwas höher (Blick leicht von oben aufs Vorfeld)
  const depthY = half * (S.span / 2) * ad * 0.1 * sc;
  const tint = o.tint || null;
  const x = o.x;
  const y = o.y;
  const hs = (S.span / 2) * proj * sc;
  const wingX = S.highWing ? S.highWing.x - S.highWing.chord / 2 : S.wing.x - S.wing.chord * 0.4;
  const wy = S.highWing ? y - (S.gearH + S.d + 1.5) * sc : y - (S.gearH + S.d * 0.15) * sc;
  const wx = x + side * ad * wingX * sc;
  const rise = S.highWing ? 0 : S.span * 0.035 * sc;
  const t = (S.highWing ? S.highWing.t : S.wing.t) * sc;
  const tipX = wx + hx * hs;
  const tipY = wy - rise + depthY;
  // Höhenleitwerk
  const sy = S.tTail ? y - S.fin.top * sc : y - (S.gearH + S.d * (S.stab.y || 0.5)) * sc;
  const sx = x + side * ad * ((S.stab.x ?? S.fin.tf) - S.stab.len / 2) * sc;
  const ss = (S.stabSpan / 2) * proj * sc;
  const st = S.stab.t * sc;
  ctx.beginPath();
  ctx.moveTo(sx, sy - st / 2);
  ctx.lineTo(sx + hx * ss, sy - st * 0.3 + depthY * 0.35);
  ctx.lineTo(sx + hx * ss, sy + st * 0.3 + depthY * 0.35);
  ctx.lineTo(sx, sy + st / 2);
  ctx.closePath();
  fillTinted(ctx, S.tTail ? L.tail : '#aab1ba', tint);
  // Tragfläche (zur Spitze hin dünner)
  ctx.beginPath();
  ctx.moveTo(wx, wy - t / 2);
  ctx.lineTo(tipX, tipY - t * 0.3);
  ctx.lineTo(tipX, tipY + t * 0.3);
  ctx.lineTo(wx, wy + t / 2);
  ctx.closePath();
  fillTinted(ctx, half < 0 ? '#a3a9b2' : '#bfc5cd', tint);
  if (S.wing && S.wing.winglet) {
    ctx.beginPath();
    ctx.moveTo(tipX, tipY - t * 0.3);
    ctx.lineTo(tipX + hx * t * 0.4, tipY - S.wing.winglet * sc * 0.8);
    ctx.lineTo(tipX + hx * t * 0.9, tipY - S.wing.winglet * sc * 0.8);
    ctx.lineTo(tipX + hx * t * 0.3, tipY);
    ctx.closePath();
    fillTinted(ctx, L.tail, tint);
  }
  // Triebwerke: Gondel mit Einlauf (Bug zu uns) bzw. Düse (Bug von uns weg)
  const front = o.away === false;
  for (const e of S.engines) {
    let px;
    let ey = y - e.y * sc;
    if (e.rear) {
      px = x + side * ad * (e.x - e.len / 2) * sc + hx * S.d * 0.75 * sc * proj;
    } else {
      const f = e.prop ? 0.3 : e.outer ? 0.62 : 0.34;
      px = wx + hx * f * hs;
      ey += depthY * f;
    }
    const r = e.r * sc;
    ctx.beginPath();
    ctx.arc(px, ey, r, 0, TAU);
    fillTinted(ctx, L.engine, tint);
    ctx.fillStyle = front ? '#e3e6ea' : mix(L.engine, -0.3);
    ctx.beginPath();
    ctx.arc(px, ey, r * 0.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = front ? '#262a31' : '#4b5059';
    ctx.beginPath();
    ctx.arc(px, ey, r * (front ? 0.66 : 0.5), 0, TAU);
    ctx.fill();
    ctx.fillStyle = front ? '#9aa1ab' : '#30343b';
    ctx.beginPath();
    ctx.arc(px, ey, r * 0.2, 0, TAU);
    ctx.fill();
    if (e.prop) {
      // Propellerkreis von vorn/hinten
      ctx.strokeStyle = 'rgba(40,44,52,0.35)';
      ctx.lineWidth = Math.max(0.3, 0.5 * sc);
      ctx.beginPath();
      ctx.arc(px, ey, e.R * sc, 0, TAU);
      ctx.stroke();
    }
  }
}

/**
 * Zeichnet ein Flugzeug. x,y = Aufstandspunkt Hauptfahrwerk (bzw. Rumpfunterkante bei eingefahrenem Fahrwerk).
 * dir: +1 nach rechts, -1 nach links; Zwischenwerte = Flugzeug dreht sich gerade (Kurve am Boden).
 * Optionale Felder: landing (0..1 Landescheinwerfer), beacon, strobe, nav, throttle (Propeller), res (Pixel je
 * Welteinheit), spriteScale, tint (Lichtstimmung), glow (0..1 Stärke der Lichtkegel), hat (Mütze), flash (0..1),
 * away (bei Kurven: false = Bug zeigt zum Betrachter, sonst von ihm weg).
 */
export function drawAircraft(ctx, o) {
  const typeId = AIRCRAFT_TYPES[o.type] ? o.type : 'narrow';
  const S = AIRCRAFT_TYPES[typeId];
  const L = o.livery || DEFAULT_LIVERIES[0];
  const sc = o.scale ?? 1;
  const dir = o.dir ?? 1;
  const side = dir < 0 ? -1 : 1;
  const ad = Math.min(1, Math.abs(dir));
  const sx = side * Math.max(0.04, ad);
  const pitch = o.pitch || 0;
  const gear = o.gear ?? 1;
  const night = !!o.lights;
  const t = o.t || 0;
  const res = o.res || ctxScale(ctx);
  // spriteScale: Auflösung des Sprites (z. B. Basisgröße), damit Perspektiv-Zoom keine neuen Sprites erzeugt
  const spr = aircraftSprite(typeId, S, L, side, night, o.tint || null, Math.max(sc, o.spriteScale || 0) * res);
  const turning = ad < 0.985;

  ctx.save();
  if (turning) {
    turnExtras(ctx, S, L, o, sc, dir, -1);
    // Rumpfquerschnitt hinter dem gestauchten Sprite
    ctx.beginPath();
    ctx.ellipse(o.x + sx * ((S.nose + S.tail) / 2) * sc, o.y - (S.gearH + S.d / 2) * sc,
      (S.d / 2) * sc * Math.sqrt(1 - ad * ad) + 0.01, (S.d / 2) * sc, 0, 0, TAU);
    fillTinted(ctx, L.body, o.tint);
  }
  ctx.translate(o.x, o.y);
  ctx.scale(sx * sc, sc);
  if (pitch) ctx.rotate(-pitch);
  if (gear > 0.02) drawGear(ctx, S, gear);
  ctx.drawImage(spr.c, spr.x0, spr.y0, spr.w, spr.h);
  if (o.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, o.flash) * 0.6;
    ctx.drawImage(spr.c, spr.x0, spr.y0, spr.w, spr.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  if (typeId === 'prop') drawProps(ctx, S, t, o.throttle ?? 1);
  if (o.hat) drawHat(ctx, S);
  const landing = o.landing || 0;
  const glowAmt = o.glow ?? 1;
  if (night && landing > 0.55 && glowAmt > 0 && !turning) {
    const F = fx();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, (landing - 0.5) * 2) * 0.8 * glowAmt;
    const len = S.nose - S.tail;
    ctx.translate(S.noseGear + 1, -S.gearH + 0.5);
    ctx.rotate(0.11);
    ctx.drawImage(F.cone, 0, -len * 0.22, len * 1.5, len * 0.44);
  }
  ctx.restore();

  if (turning) turnExtras(ctx, S, L, o, sc, dir, 1);

  // Lichter (in Weltkoordinaten, damit die Leuchtpunkte rund bleiben)
  const F = fx();
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const wx = (lx, ly) => o.x + (lx * c + ly * s) * sx * sc;
  const wy = (lx, ly) => o.y + (-lx * s + ly * c) * sc;
  const k = night ? 1 : 0.45;
  const minG = o.glowMin || 0;
  const gsz = (u) => Math.max(minG, u * sc * k);
  ctx.save();
  ctx.globalCompositeOperation = night ? 'lighter' : 'source-over';
  const bot = -S.gearH;
  const top = bot - S.d - (S.hump ? S.hump.h * 0.3 : 0);
  let tipX;
  let tipY;
  if (S.highWing) {
    tipX = S.highWing.x - S.highWing.chord * 0.5;
    tipY = bot - S.d - 2.4;
  } else {
    tipX = S.wing.x - S.wing.sweep - S.wing.tip * 0.4;
    tipY = bot - S.d * S.wing.y + wingDrop(S) - (S.wing.winglet || 0) * 0.5;
  }
  const tailX = S.tail + 0.4;
  const tailY = bot - S.d * (S.tailLo + S.tailHi) / 2;
  if (o.nav !== false) {
    light(ctx, side > 0 ? F.glow.green : F.glow.red, wx(tipX, tipY), wy(tipX, tipY), gsz(9), night ? 0.9 : 0.75);
    light(ctx, F.glow.white, wx(tailX, tailY), wy(tailX, tailY), gsz(6), 0.6);
  }
  if (o.beacon !== false) {
    const b = flash(t, 1.15, 0.16);
    if (b > 0) {
      light(ctx, F.glow.red, wx(0, top - 0.3), wy(0, top - 0.3), gsz(16), b);
      light(ctx, F.glow.red, wx(S.nose * 0.15, bot + 0.3), wy(S.nose * 0.15, bot + 0.3), gsz(14), b * 0.9);
    }
  }
  if (o.strobe) {
    const st = Math.max(flash(t + 0.37, 1.3, 0.035), flash(t + 0.37 - 0.12, 1.3, 0.035));
    if (st > 0) {
      light(ctx, F.glow.white, wx(tipX, tipY), wy(tipX, tipY), gsz(30), st);
      light(ctx, F.glow.white, wx(tailX, tailY), wy(tailX, tailY), gsz(22), st);
    }
  }
  if (landing > 0.05) {
    const lx = S.noseGear - 0.5;
    const ly = bot + 1;
    const a = Math.min(1, landing);
    const size = (night ? 26 : 16) * a;
    light(ctx, F.glow.warm, wx(lx, ly), wy(lx, ly), Math.max(minG, size * sc), 1);
    if (!S.highWing) {
      const rx = S.wing.x - 2;
      const ry = bot - S.d * S.wing.y + 1;
      light(ctx, F.glow.warm, wx(rx, ry), wy(rx, ry), Math.max(minG, size * 0.8 * sc), 0.9);
    }
  }
  ctx.restore();
}

// Maße für Treffertest und Sichtbarkeit (lokale Einheiten bei scale=1)
export function aircraftBounds(type) {
  const S = AIRCRAFT_TYPES[type] || AIRCRAFT_TYPES.narrow;
  return { front: S.nose + (S.engines[0].prop ? 4 : 1), back: S.tail - 2, top: S.h, len: S.nose - S.tail };
}

// --- Hubschrauber ------------------------------------------------------------

function paintHeli(ctx, L) {
  // Heckausleger
  ctx.fillStyle = L.tail;
  ctx.beginPath();
  ctx.moveTo(-3, -9.5);
  ctx.lineTo(-23, -10.8);
  ctx.lineTo(-23, -8.4);
  ctx.lineTo(-3, -5.5);
  ctx.closePath();
  ctx.fill();
  // Seitenflosse + Fenestron
  ctx.beginPath();
  ctx.moveTo(-20, -10);
  ctx.lineTo(-23.5, -17);
  ctx.lineTo(-26, -17);
  ctx.lineTo(-25.5, -7.5);
  ctx.lineTo(-21, -7.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a2d33';
  ctx.beginPath();
  ctx.arc(-23.3, -9.6, 2.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = L.tail;
  ctx.fillRect(-19, -6.6, 6, 1);
  // Kufen
  ctx.strokeStyle = '#3a3e45';
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, -0.5);
  ctx.lineTo(10, -0.5);
  ctx.quadraticCurveTo(12.5, -0.6, 13, -2.2);
  ctx.moveTo(-5, -0.5);
  ctx.lineTo(-4, -3.2);
  ctx.moveTo(6, -0.5);
  ctx.lineTo(5, -3.2);
  ctx.stroke();
  // Kabine
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.quadraticCurveTo(-7, -10.5, -1, -11.5);
  ctx.lineTo(6, -11.8);
  ctx.quadraticCurveTo(13, -11, 14.5, -6.5);
  ctx.quadraticCurveTo(15, -3.2, 11, -3);
  ctx.lineTo(-3, -3);
  ctx.closePath();
  ctx.fillStyle = L.body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = L.belly;
  ctx.fillRect(-8, -5.6, 24, 3);
  const g = ctx.createLinearGradient(0, -12, 0, -3);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(-8, -12, 24, 9);
  ctx.restore();
  // Fenster
  ctx.fillStyle = '#26364a';
  ctx.beginPath();
  ctx.moveTo(8, -10.6);
  ctx.quadraticCurveTo(12.6, -10, 13.6, -6.6);
  ctx.lineTo(8.6, -6.4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  rrect(ctx, 1.5, -10.2, 5.2, 3.6, 0.8);
  ctx.fill();
  // Triebwerksverkleidung + Rotormast
  ctx.fillStyle = mix(L.body, -0.15);
  ctx.beginPath();
  ctx.moveTo(-4, -11.2);
  ctx.quadraticCurveTo(0, -14, 6, -13.2);
  ctx.lineTo(7, -11.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a4f57';
  ctx.fillRect(2, -15.5, 1.2, 2.6);
}

export function drawHelicopter(ctx, { x, y, scale = 1, dir = 1, pitch = 0, t = 0, lights = false, livery = HELI_LIVERIES[0], res, tint }) {
  const side = dir < 0 ? -1 : 1;
  const spr = cached(`heli|${objKey(livery)}|${tint || ''}`, scale * (res || ctxScale(ctx)), -28, -18, 17, 1, (c) => {
    paintHeli(c, livery);
    if (tint) {
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = tint;
      c.fillRect(-28, -18, 45, 19);
    }
  });
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side * scale, scale);
  if (pitch) ctx.rotate(-pitch);
  ctx.drawImage(spr.c, spr.x0, spr.y0, spr.w, spr.h);
  // Hauptrotor (von der Seite: flache Scheibe mit wandernden Blättern)
  const R = 17;
  const mx = 2.6;
  const my = -15.8;
  ctx.fillStyle = 'rgba(40,44,52,0.16)';
  ctx.beginPath();
  ctx.ellipse(mx, my, R, 0.9, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,32,38,0.75)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  const a0 = t * 31;
  for (let i = 0; i < 4; i++) {
    const a = a0 + (i * TAU) / 4;
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + Math.cos(a) * R, my + Math.sin(a) * 0.7);
  }
  ctx.stroke();
  // Heckrotor
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  const b0 = t * 47;
  for (let i = 0; i < 2; i++) {
    const a = b0 + i * Math.PI;
    ctx.moveTo(-23.3 + Math.cos(a) * 2, -9.6 + Math.sin(a) * 2);
    ctx.lineTo(-23.3 - Math.cos(a) * 2, -9.6 - Math.sin(a) * 2);
  }
  ctx.stroke();
  ctx.restore();
  // Lichter
  const F = fx();
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const P = (lx, ly) => [x + (lx * c + ly * s) * side * scale, y + (-lx * s + ly * c) * scale];
  ctx.save();
  ctx.globalCompositeOperation = lights ? 'lighter' : 'source-over';
  const k = lights ? 1 : 0.5;
  const b = flash(t, 1.0, 0.18);
  if (b > 0) {
    const [bx, by] = P(-2, -12);
    light(ctx, F.glow.red, bx, by, 14 * scale * k, b);
  }
  const st = flash(t + 0.5, 1.4, 0.04);
  if (st > 0) {
    const [sx2, sy2] = P(-25.5, -16.5);
    light(ctx, F.glow.white, sx2, sy2, 22 * scale * k, st);
  }
  const [nx, ny] = P(12, -3.5);
  light(ctx, side > 0 ? F.glow.green : F.glow.red, nx, ny, 7 * scale * k, 0.8);
  if (lights) {
    // Suchscheinwerfer schräg nach unten
    ctx.globalAlpha = 0.4;
    ctx.translate(nx, ny);
    ctx.scale(side, 1);
    ctx.rotate(1.05 - pitch);
    ctx.drawImage(F.cone, 0, -18 * scale, 110 * scale, 36 * scale);
  }
  ctx.restore();
}
