// Adler: prozedurale Cartoon-Sprites (vorgerendert je Art × Ebene × Flügelframe),
// Flugbahnen, Treffer-/Absturz-Logik und Versteck-Adler, die über Kanten lugen.
import { LAYER_W, LAYER_SCALE } from '../config.js';
import { drawHat } from './hats.js';

const TAU = Math.PI * 2;
// Schräg-Projektion für die Flügel (leichte Dreiviertelansicht)
const KX = -0.12, KY = 0.55;
const LA = 50, LH = 60;
const CH = 1.18; // Flügeltiefe // Länge Arm- und Handschwinge in Sprite-Einheiten
// Sprite-Box in Sprite-Einheiten (Ursprung = Körpermitte, Blick nach rechts)
const BOX = { x0: -128, y0: -132, x1: 104, y1: 122 };
BOX.w = BOX.x1 - BOX.x0;
BOX.h = BOX.y1 - BOX.y0;
const FLAP_FRAMES = 8;
const F_GLIDE = 8, F_TUCK = 9, F_FALL_A = 10, F_FALL_B = 11;

// Lage der Mütze auf dem Kopf (Sprite-Einheiten)
export const HAT_ON_HEAD = { x: 45, y: -31, w: 36, rot: -0.3 };
// Großzügige Treffer-Ellipse um Körper und Kopf
const HIT = { x: 12, y: -10, rx: 78, ry: 42 };
const FALL_R = 60;

export const SPECIES = {
  stein: {
    name: 'Steinadler', speed: 225, flap: 2.7,
    outline: '#24140a',
    body: ['#4a2e16', '#5e3b1d', '#76502b'],
    head: ['#ecbd68', '#b07a33'], brow: '#6e4519', iris: '#f2a531',
    wing: '#583619', covert: '#7d5531', primary: '#2f1d0e', line: '#2a180a', hi: '#9a7148',
    tail: ['#5d3d20', '#8f7457', '#2c1b0d'],
    beak: ['#ffe066', '#e9a11c'], cere: '#fff1a6',
    leg: '#ffcb38', thigh: '#4f3119',
    feathers: [['#6b4423', '#2a1608'], ['#8a5c30', '#3a2210'], ['#c99a52', '#5a3a12']],
  },
  weisskopf: {
    name: 'Weißkopfseeadler', speed: 300, flap: 3.1,
    outline: '#1c120b',
    body: ['#2c1c10', '#3b2716', '#4d3420'],
    head: ['#ffffff', '#d5d0c6'], brow: '#b9b2a4', iris: '#ffe24d',
    wing: '#3a2615', covert: '#523822', primary: '#1d130b', line: '#140c06', hi: '#6e5034',
    tail: ['#ffffff', '#dcd7cd', '#c7c1b5'],
    beak: ['#ffdc3d', '#f0a116'], cere: '#fff0a0',
    leg: '#ffcf33', thigh: '#3a2615',
    feathers: [['#3d2817', '#140c06'], ['#ffffff', '#8c8478'], ['#55391f', '#1c120b']],
  },
  gold: {
    name: 'Goldadler', speed: 420, flap: 3.6,
    outline: '#5a3300',
    body: ['#ffe98a', '#f7b526', '#a8600a'],
    head: ['#fff3b8', '#f3ad1c'], brow: '#a8680a', iris: '#7a2a00',
    wing: '#f2a915', covert: '#ffcf40', primary: '#a86206', line: '#6e4204', hi: '#fffbe2',
    tail: ['#f0aa1a', '#ffef9a', '#a05c06'],
    beak: ['#ffb347', '#d9581a'], cere: '#ffe0a0',
    leg: '#ff9d2a', thigh: '#d99a1c',
    shine: 0.6, glow: 'rgba(255,214,90,0.9)',
    feathers: [['#ffd34d', '#8a5a06'], ['#fff2a8', '#b07a10'], ['#f0b02a', '#7a4a00']],
  },
};

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(hex, k) {
  const [r, g, b] = hexRgb(hex);
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}
function darkPalette(p, k) {
  return {
    ...p,
    wing: shade(p.wing, k), covert: shade(p.covert, k), primary: shade(p.primary, k),
    line: shade(p.line, k), hi: shade(p.hi, k * 0.95),
  };
}

// --- Sprite-Malerei ------------------------------------------------------------

function proj(x, y, z, L) {
  const n = Math.hypot(x, y, z) || 1;
  return [((x + z * KX) / n) * L, ((y + z * KY) / n) * L];
}

function paintWing(g, pal, w, side) {
  const S = side > 0 ? [4, -12] : [-3, -19];
  const arm = proj(-w.sa, -Math.sin(w.th), side * Math.cos(w.th), LA);
  const th2 = w.th + w.bend;
  const hand = proj(-w.sh, -Math.sin(th2), side * Math.cos(th2), LH * (w.fold ?? 1));
  // fast genau von der Seite gesehener hinterer Flügel ist hinter dem Körper verborgen
  if (side < 0 && Math.hypot(arm[0] + hand[0], arm[1] + hand[1]) < 42) return;
  const W = [S[0] + arm[0], S[1] + arm[1]];
  const A = (u, v) => [S[0] + u * arm[0] - v * CH, S[1] + u * arm[1]];
  const H = (u, v) => [W[0] + u * hand[0] - v * CH, W[1] + u * hand[1]];
  const M = (p) => g.moveTo(p[0], p[1]);
  const L = (p) => g.lineTo(p[0], p[1]);
  const Q = (c, p) => g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  const spread = w.spread ?? 1;

  const fingers = (withLead) => {
    if (withLead) Q(H(0.4, -9), H(0.8, -3));
    for (let i = 0; i < 5; i++) {
      const tu = 1.1 - i * 0.085 * spread, tv = 1 + i * 8.2;
      const nu = 0.78 - i * 0.07, nv = 5.5 + i * 8.4;
      Q(H(tu - 0.02, tv - 4.5), H(tu, tv));
      Q(H(tu + 0.02, tv + 4.5), i < 4 ? H(nu, nv) : H(0.5, 40));
    }
  };
  const outline = () => {
    g.beginPath();
    M(A(0, -7));
    Q(A(0.55, -12.5), A(1, -6));
    fingers(true);
    L(H(0.15, 41));
    for (let j = 0; j < 5; j++) Q(A(1 - (j + 0.5) * 0.2, 47), A(1 - (j + 1) * 0.2, 38 - j * 0.4));
    g.closePath();
  };

  g.lineJoin = 'round';
  g.lineCap = 'round';
  outline();
  g.fillStyle = pal.wing;
  g.fill();
  g.save();
  g.clip();
  // Handschwingen dunkler
  g.beginPath();
  M(H(0.05, -10));
  fingers(true);
  L(H(0.05, 44));
  g.closePath();
  g.fillStyle = pal.primary;
  g.fill();
  // Deckfedern
  g.beginPath();
  M(A(0, -10));
  Q(A(0.55, -15), A(1, -9));
  Q(H(0.25, -10), H(0.42, -6));
  L(H(0.4, 12));
  for (let j = 0; j < 7; j++) {
    const u0 = 1.15 - j * 0.19, u1 = 1.15 - (j + 1) * 0.19;
    Q(A((u0 + u1) / 2, 22), A(Math.max(0, u1), 16));
  }
  L(A(0, 18));
  g.closePath();
  g.fillStyle = pal.covert;
  g.fill();
  // Federlinien Armschwingen
  g.strokeStyle = pal.line;
  g.globalAlpha = 0.6;
  g.lineWidth = 1.1;
  g.beginPath();
  for (let u = 0.1; u < 0.95; u += 0.17) {
    M(A(u, 21));
    L(A(u + 0.03, 42));
  }
  // Handschwingen-Kiele
  for (let i = 0; i < 5; i++) {
    M(H(0.45 - i * 0.04, 4 + i * 8.3));
    L(H(1.02 - i * 0.085 * spread, 1.5 + i * 8.2));
  }
  g.stroke();
  g.globalAlpha = 1;
  g.restore();
  // Glanzkante vorne
  g.strokeStyle = pal.hi;
  g.lineWidth = 2;
  g.beginPath();
  M(A(0.05, -5));
  Q(A(0.55, -10), A(1, -4.5));
  Q(H(0.35, -6), H(0.7, -2));
  g.stroke();
  outline();
  g.strokeStyle = pal.outline;
  g.lineWidth = 2.2;
  g.stroke();
}

function paintTail(g, pal, spread) {
  const order = [0, 4, 1, 3, 2];
  for (const i of order) {
    const a = Math.PI - 0.06 + (i - 2) * 0.14 * spread;
    g.save();
    g.translate(-40, -1);
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, -6.5);
    g.lineTo(42, -8);
    g.quadraticCurveTo(56, 0, 42, 8);
    g.lineTo(0, 6.5);
    g.closePath();
    g.fillStyle = pal.tail[0];
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = pal.tail[1];
    g.fillRect(30, -10, 7, 20);
    g.fillStyle = pal.tail[2];
    g.fillRect(45, -10, 14, 20);
    g.restore();
    g.strokeStyle = pal.outline;
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = pal.tail[2];
    g.globalAlpha = 0.5;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(4, 0);
    g.lineTo(44, 0);
    g.stroke();
    g.globalAlpha = 1;
    g.restore();
  }
}

function bodyPath(g) {
  g.beginPath();
  g.moveTo(36, -22);
  g.bezierCurveTo(18, -31, -18, -27, -44, -10);
  g.quadraticCurveTo(-53, -4, -48, 4);
  g.bezierCurveTo(-30, 23, 12, 29, 36, 12);
  g.bezierCurveTo(45, 6, 47, -12, 36, -22);
  g.closePath();
}

function paintBody(g, pal) {
  bodyPath(g);
  const grd = g.createLinearGradient(0, -28, 0, 26);
  grd.addColorStop(0, pal.body[0]);
  grd.addColorStop(0.5, pal.body[1]);
  grd.addColorStop(1, pal.body[2]);
  g.fillStyle = grd;
  g.fill();
  // Gefiederschuppen am Bauch
  g.save();
  g.clip();
  g.strokeStyle = pal.outline;
  g.globalAlpha = 0.28;
  g.lineWidth = 1.2;
  for (let row = 0; row < 3; row++) {
    const y = 2 + row * 7;
    g.beginPath();
    for (let x = -32 + row * 4; x < 30; x += 9) {
      g.moveTo(x - 4, y);
      g.quadraticCurveTo(x, y + 5, x + 4, y);
    }
    g.stroke();
  }
  // Rückenlicht (beim Goldadler als kräftiger Glanzstreifen)
  g.globalAlpha = pal.shine ?? 0.22;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(4, -18, 26, 5, -0.08, 0, TAU);
  g.fill();
  if (pal.shine) {
    g.globalAlpha = pal.shine * 0.5;
    g.beginPath();
    g.ellipse(-8, 14, 20, 3, -0.15, 0, TAU);
    g.fill();
  }
  g.restore();
  bodyPath(g);
  g.strokeStyle = pal.outline;
  g.lineWidth = 2.2;
  g.stroke();
}

function paintLegs(g, pal, dangle) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const thigh = dangle ? [-2, 16, 0.9] : [-8, 15, 0.3];
  // Fuß
  const fx = dangle ? -6 : -29, fy = dangle ? 44 : 27;
  g.strokeStyle = pal.outline;
  g.lineWidth = 8.5;
  g.beginPath();
  g.moveTo(dangle ? -3 : -14, dangle ? 22 : 19);
  g.lineTo(fx, fy);
  g.stroke();
  g.strokeStyle = pal.leg;
  g.lineWidth = 5.5;
  g.stroke();
  // Zehen mit Krallen
  const toes = dangle ? [[-12, 52], [-5, 54], [3, 50]] : [[-25, 34], [-31, 35], [-37, 31]];
  for (const [tx, ty] of toes) {
    g.strokeStyle = pal.outline;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(tx, ty);
    g.stroke();
    g.strokeStyle = pal.leg;
    g.lineWidth = 3.4;
    g.stroke();
    // Kralle
    const dx = tx - fx, dy = ty - fy, n = Math.hypot(dx, dy);
    g.fillStyle = '#1b120c';
    g.beginPath();
    g.moveTo(tx + (dy / n) * 1.8, ty - (dx / n) * 1.8);
    g.quadraticCurveTo(tx + (dx / n) * 6, ty + (dy / n) * 6, tx + (dx / n) * 3 + (dy / n) * -4, ty + (dy / n) * 3 + (dx / n) * 4);
    g.lineTo(tx - (dy / n) * 1.8, ty + (dx / n) * 1.8);
    g.closePath();
    g.fill();
  }
  // gefiederte „Hosen"
  g.fillStyle = pal.thigh;
  g.strokeStyle = pal.outline;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(thigh[0], thigh[1], 15, 9.5, thigh[2], 0, TAU);
  g.fill();
  g.stroke();
  g.strokeStyle = pal.outline;
  g.globalAlpha = 0.35;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(thigh[0] - 8, thigh[1] + 2);
  g.quadraticCurveTo(thigh[0] - 3, thigh[1] + 7, thigh[0] + 2, thigh[1] + 2);
  g.moveTo(thigh[0] - 1, thigh[1] + 4);
  g.quadraticCurveTo(thigh[0] + 4, thigh[1] + 9, thigh[0] + 9, thigh[1] + 3);
  g.stroke();
  g.globalAlpha = 1;
}

function headPath(g) {
  g.beginPath();
  g.moveTo(26, -20);
  g.bezierCurveTo(27, -34, 40, -39, 50, -37);
  g.bezierCurveTo(60, -35, 66, -27, 65, -18);
  g.bezierCurveTo(65, -10, 60, -4, 54, 0);
  g.bezierCurveTo(48, 6, 41, 10, 35, 11);
  // ausgefranster Übergang zum Körper
  g.lineTo(33, 5);
  g.lineTo(29, 7);
  g.lineTo(28, 0);
  g.lineTo(24, 1);
  g.lineTo(25, -7);
  g.lineTo(21, -9);
  g.lineTo(24, -15);
  g.closePath();
}

function paintHead(g, pal, scared) {
  headPath(g);
  const grd = g.createRadialGradient(44, -30, 2, 48, -20, 30);
  grd.addColorStop(0, pal.head[0]);
  grd.addColorStop(1, pal.head[1]);
  g.fillStyle = grd;
  g.fill();
  g.strokeStyle = pal.outline;
  g.lineWidth = 2.2;
  g.stroke();
  if (pal.shine) {
    g.fillStyle = `rgba(255,255,255,${pal.shine})`;
    g.beginPath();
    g.ellipse(42, -31, 6, 2.6, -0.5, 0, TAU);
    g.fill();
  }
  // Nackenfedern
  g.strokeStyle = pal.outline;
  g.globalAlpha = 0.25;
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(33, -26);
  g.quadraticCurveTo(36, -20, 33, -14);
  g.moveTo(39, -30);
  g.quadraticCurveTo(41, -24, 38, -18);
  g.stroke();
  g.globalAlpha = 1;

  // Schnabel
  g.lineJoin = 'round';
  g.fillStyle = pal.cere;
  g.strokeStyle = pal.outline;
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(60, -26);
  g.quadraticCurveTo(66, -28, 69, -23);
  g.lineTo(68, -13);
  g.quadraticCurveTo(63, -12, 60, -15);
  g.closePath();
  g.fill();
  g.stroke();
  // Unterschnabel (beim Schreck offen)
  g.fillStyle = pal.beak[1];
  g.beginPath();
  if (scared) {
    g.moveTo(66, -12);
    g.quadraticCurveTo(74, -4, 77, 3);
    g.quadraticCurveTo(70, 4, 63, -4);
  } else {
    g.moveTo(66, -12);
    g.quadraticCurveTo(73, -10, 77, -8);
    g.quadraticCurveTo(71, -3, 63, -5);
  }
  g.closePath();
  g.fill();
  g.stroke();
  if (scared) {
    g.fillStyle = '#7a1020';
    g.beginPath();
    g.moveTo(67, -11);
    g.lineTo(75, -6);
    g.lineTo(72, 0);
    g.closePath();
    g.fill();
  }
  // Oberschnabel mit Haken
  const bg = g.createLinearGradient(66, -28, 80, 2);
  bg.addColorStop(0, pal.beak[0]);
  bg.addColorStop(1, pal.beak[1]);
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(66, -26);
  g.bezierCurveTo(76, -28, 85, -21, 86, -11);
  g.quadraticCurveTo(87, -2, 80, 2);
  g.quadraticCurveTo(80, -6, 74, -8);
  g.lineTo(66, -12);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(74, -22, 5, 1.6, 0.25, 0, TAU);
  g.fill();
  g.fillStyle = pal.outline;
  g.beginPath();
  g.ellipse(70, -20, 1.8, 1.1, 0.3, 0, TAU);
  g.fill();
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(64, -12);
  g.lineTo(74, -9);
  g.stroke();

  // Auge
  if (scared) {
    g.fillStyle = '#ffffff';
    g.strokeStyle = pal.outline;
    g.lineWidth = 1.6;
    g.beginPath();
    g.ellipse(54, -22, 8, 9, 0, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(56, -22, 2, 0, TAU);
    g.fill();
    // hochgezogene Braue
    g.strokeStyle = pal.brow;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(46, -33);
    g.quadraticCurveTo(53, -39, 61, -34);
    g.stroke();
    // Schweißtropfen
    g.fillStyle = '#9fd8ff';
    g.strokeStyle = '#2a5a80';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(38, -40);
    g.quadraticCurveTo(34, -33, 37, -31);
    g.quadraticCurveTo(41, -31, 38, -40);
    g.fill();
    g.stroke();
  } else {
    g.fillStyle = '#fffdf3';
    g.strokeStyle = pal.outline;
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(55, -21, 6.2, 6.6, 0, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = pal.iris;
    g.beginPath();
    g.arc(57, -21, 4, 0, TAU);
    g.fill();
    g.fillStyle = '#120a05';
    g.beginPath();
    g.arc(57.6, -21, 2.4, 0, TAU);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(58.8, -22.6, 1.2, 0, TAU);
    g.fill();
    // Braue: entschlossen, aber freundlich
    g.fillStyle = pal.brow;
    g.strokeStyle = pal.outline;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(46, -27);
    g.quadraticCurveTo(54, -32.5, 64, -26);
    g.quadraticCurveTo(56, -26.5, 47, -23.5);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

// Flügelstellung je Frame
function poseFor(frame) {
  if (frame < FLAP_FRAMES) {
    const ph = (frame / FLAP_FRAMES) * TAU;
    const th = 0.26 + 0.95 * Math.cos(ph);
    const bend = 0.42 * Math.sin(ph);
    const fold = 1 - 0.3 * Math.max(0, -Math.sin(ph));
    const w = { th, bend, sa: 0.18, sh: 0.5, fold };
    return { near: w, far: { ...w, th: th + 0.08, sa: 0.55, sh: 0.95 }, tail: 1, legs: false, scared: false };
  }
  if (frame === F_GLIDE) {
    // Segeln: Flügel fast waagerecht ausgebreitet – vorderer zeigt (Blick leicht von oben) nach unten
    const w = { th: 0.02, bend: 0.12, sa: 0.3, sh: 0.6, fold: 1, spread: 1.15 };
    return { near: w, far: { ...w, th: 0.1, sa: 0.5, sh: 0.85 }, tail: 1.25, legs: false, scared: false };
  }
  if (frame === F_TUCK) {
    // Sturzflug: Flügel halb angelegt und nach hinten oben gezogen
    const w = { th: 0.75, bend: 0.5, sa: 0.9, sh: 1.2, fold: 0.7, spread: 0.6 };
    return { near: w, far: { ...w, th: 0.85 }, tail: 0.5, legs: false, scared: false };
  }
  if (frame === F_FALL_A) {
    return {
      near: { th: 1.4, bend: 0.45, sa: -0.15, sh: 0.05, fold: 1, spread: 1.6 },
      far: { th: 1.15, bend: 0.5, sa: 0.1, sh: 0.2, fold: 1, spread: 1.6 },
      tail: 1.9, legs: true, scared: true,
    };
  }
  return {
    near: { th: 0.2, bend: -0.55, sa: 0.05, sh: 0.3, fold: 0.95, spread: 1.6 },
    far: { th: 0.75, bend: 0.3, sa: 0.1, sh: 0.3, fold: 1, spread: 1.6 },
    tail: 1.9, legs: true, scared: true,
  };
}

function paintEagle(g, pal, frame) {
  const pose = poseFor(frame);
  paintWing(g, darkPalette(pal, 0.72), pose.far, -1);
  paintTail(g, pal, pose.tail);
  paintBody(g, pal);
  paintLegs(g, pal, pose.legs);
  paintWing(g, pal, pose.near, 1);
  paintHead(g, pal, pose.scared);
}

// --- Versteck-Adler (Frontansicht, Ursprung = Kante) -----------------------------
const PEEK_BOX = { x0: -46, y0: -66, x1: 46, y1: 8 };
PEEK_BOX.w = PEEK_BOX.x1 - PEEK_BOX.x0;
PEEK_BOX.h = PEEK_BOX.y1 - PEEK_BOX.y0;
export const PEEK_HEAD = { x: 0, y: -38, r: 21 };
export const PEEK_EYES = [{ x: -8.5, y: -41 }, { x: 8.5, y: -41 }];
export const HAT_ON_PEEK = { x: 0, y: -55, w: 36, rot: -0.12 };

function paintPeek(g, pal) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // Schultern
  g.beginPath();
  g.moveTo(-36, 8);
  g.quadraticCurveTo(-32, -18, -12, -22);
  g.lineTo(12, -22);
  g.quadraticCurveTo(32, -18, 36, 8);
  g.closePath();
  const bg = g.createLinearGradient(0, -22, 0, 8);
  bg.addColorStop(0, pal.body[1]);
  bg.addColorStop(1, pal.body[0]);
  g.fillStyle = bg;
  g.fill();
  g.strokeStyle = pal.outline;
  g.lineWidth = 2.2;
  g.stroke();
  // Flügel-„Hände" greifen über die Kante
  for (const sx of [-1, 1]) {
    g.fillStyle = pal.wing;
    g.beginPath();
    g.moveTo(sx * 44, 6);
    g.quadraticCurveTo(sx * 44, -10, sx * 30, -8);
    for (let i = 0; i < 3; i++) {
      const x = sx * (30 - i * 6);
      g.quadraticCurveTo(x - sx * 3, 2, x - sx * 5, -4 + i);
    }
    g.lineTo(sx * 14, 6);
    g.closePath();
    g.fill();
    g.stroke();
  }
  // Kopf
  g.beginPath();
  g.moveTo(-16, -22);
  g.bezierCurveTo(-26, -30, -24, -56, 0, -59);
  g.bezierCurveTo(24, -56, 26, -30, 16, -22);
  g.lineTo(10, -18);
  g.lineTo(5, -22);
  g.lineTo(0, -17);
  g.lineTo(-5, -22);
  g.lineTo(-10, -18);
  g.closePath();
  const hg = g.createRadialGradient(-6, -48, 2, 0, -38, 26);
  hg.addColorStop(0, pal.head[0]);
  hg.addColorStop(1, pal.head[1]);
  g.fillStyle = hg;
  g.fill();
  g.stroke();
  // Augen (Pupillen werden live gezeichnet)
  for (const e of PEEK_EYES) {
    g.fillStyle = '#fffdf3';
    g.strokeStyle = pal.outline;
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(e.x, e.y, 7, 8, 0, 0, TAU);
    g.fill();
    g.stroke();
  }
  // Brauen (verschmitzt)
  g.strokeStyle = pal.outline;
  g.lineWidth = 3.4;
  g.beginPath();
  g.moveTo(-15, -51);
  g.lineTo(-3, -47);
  g.moveTo(15, -51);
  g.lineTo(3, -47);
  g.stroke();
  // Schnabel von vorne
  g.fillStyle = pal.cere;
  g.strokeStyle = pal.outline;
  g.lineWidth = 1.6;
  g.beginPath();
  g.ellipse(0, -36, 7.5, 3.2, 0, 0, TAU);
  g.fill();
  g.stroke();
  const kb = g.createLinearGradient(0, -36, 0, -20);
  kb.addColorStop(0, pal.beak[0]);
  kb.addColorStop(1, pal.beak[1]);
  g.fillStyle = kb;
  g.beginPath();
  g.moveTo(-7, -35);
  g.quadraticCurveTo(0, -37, 7, -35);
  g.quadraticCurveTo(6, -26, 0, -20);
  g.quadraticCurveTo(-6, -26, -7, -35);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = pal.outline;
  g.beginPath();
  g.arc(-2.5, -34, 0.9, 0, TAU);
  g.arc(2.5, -34, 0.9, 0, TAU);
  g.fill();
}

// --- Sprite-Bank -------------------------------------------------------------------
const bank = new Map();
let bankRes = 0;
// Luftperspektive: entfernte Adler nehmen etwas Himmelsfarbe an (Anteil je Ebene)
const HAZE = { far: 0.17, mid: 0.06, near: 0 };
let hazeColor = '#7c8aa8';

function mixHex(a, b, k) {
  const A = hexRgb(a), B = hexRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * k));
  return `#${((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1)}`;
}

// Dunstfarbe aus dem Szenen-Thema; bei Wechsel werden die Sprites neu gemalt
export function setSceneTint(airport) {
  const th = airport?.theme;
  let c = '#7c8aa8';
  if (/^#[0-9a-f]{6}$/i.test(th?.skyTop || '') && /^#[0-9a-f]{6}$/i.test(th?.skyBottom || '')) c = mixHex(th.skyTop, th.skyBottom, 0.55);
  if (c !== hazeColor) {
    hazeColor = c;
    bank.clear();
  }
}

function makeCanvas(box, res, paint, { haze = 0, glow = null } = {}) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(box.w * res));
  c.height = Math.max(1, Math.ceil(box.h * res));
  const g = c.getContext('2d');
  g.setTransform(res, 0, 0, res, -box.x0 * res, -box.y0 * res);
  paint(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (haze > 0) {
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = haze;
    g.fillStyle = hazeColor;
    g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  if (glow) {
    // weicher Schein einmalig beim Vorrendern (nie pro Frame)
    const tmp = document.createElement('canvas');
    tmp.width = c.width;
    tmp.height = c.height;
    tmp.getContext('2d').drawImage(c, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.shadowColor = glow;
    g.shadowBlur = Math.max(4, 12 * res);
    g.drawImage(tmp, 0, 0);
    g.shadowBlur = 0;
    g.shadowColor = 'transparent';
  }
  return c;
}

export function spriteRes(view) {
  return Math.round(Math.max(0.6, Math.min(2, view.scale * view.dpr)) * 10) / 10;
}

function checkRes(view) {
  const r = spriteRes(view);
  if (r !== bankRes) {
    bank.clear();
    bankRes = r;
  }
  return r;
}

// Frames werden einzeln und erst bei Bedarf gemalt (verteilt die Kosten, keine Ruckler)
export function getEagleSprites(species, layer, view) {
  const R = checkRes(view);
  const key = species + '|' + layer;
  let set = bank.get(key);
  if (!set) {
    const res = R * LAYER_SCALE[layer];
    const pal = SPECIES[species];
    const haze = (HAZE[layer] || 0) * (pal.glow ? 0.4 : 1);
    set = { frames: new Array(F_FALL_B + 1).fill(null), res, pal, built: 0, opts: { haze, glow: pal.glow || null } };
    bank.set(key, set);
  }
  return set;
}

function frameCanvas(set, f) {
  let c = set.frames[f];
  if (!c) {
    c = set.frames[f] = makeCanvas(BOX, set.res, (g) => paintEagle(g, set.pal, f), set.opts);
    set.built++;
  }
  return c;
}

// Vorwärm-Aufgaben: je ein Adler-Frame bzw. Versteck-Sprite pro Aufruf
export function eagleWarmTasks(view, combos, peekLayers) {
  const tasks = [];
  for (const [species, layer] of combos) {
    for (let f = 0; f <= F_FALL_B; f++) tasks.push(() => frameCanvas(getEagleSprites(species, layer, view), f));
  }
  for (const layer of peekLayers) for (const sp of ['stein', 'weisskopf']) tasks.push(() => getPeekSprite(sp, layer, view));
  return tasks;
}

export function getPeekSprite(species, layer, view) {
  const R = checkRes(view);
  const key = 'peek|' + species + '|' + layer;
  let c = bank.get(key);
  if (!c) {
    c = makeCanvas(PEEK_BOX, R * LAYER_SCALE[layer], (g) => paintPeek(g, SPECIES[species]), { haze: HAZE[layer] || 0 });
    bank.set(key, c);
  }
  return c;
}

// --- Adler im Flug -------------------------------------------------------------------

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Eagle {
  constructor({ species, layer, x, y, dir, path, speed, zone, rng }) {
    this.species = species;
    this.pal = SPECIES[species];
    this.layer = layer;
    this.s = LAYER_SCALE[layer];
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.facing = dir;
    this.path = path;
    this.speed = speed;
    this.zone = zone;
    this.rng = rng;
    this.t = 0;
    this.vx = dir * speed;
    this.vy = 0;
    this.pitch = 0;
    this.rot = 0;
    this.state = 'fly'; // fly | hit | fall
    this.hat = false;
    this.flapPhase = rng.next();
    this.flapRate = this.pal.flap * rng.range(0.9, 1.1);
    this.wing = 'flap'; // flap | glide | tuck
    this.frame = 0;
    this.followups = 0;
    this.trailT = 0;
    this.dead = false;
    // Bahnparameter
    this.baseY = y;
    this.amp = rng.range(18, 46) * (0.5 + 0.5 * this.s);
    this.omega = rng.range(1.2, 2.1);
    this.ph = rng.range(0, TAU);
    this.timer = rng.range(1.2, 2.6);
    this.phase = 'cruise';
    this.vyTarget = 0;
    this.radius = rng.range(55, 95) * (0.5 + 0.5 * this.s);
    this.ang = rng.range(0, TAU);
    this.cx = x - Math.cos(this.ang) * this.radius;
    this.cy = clamp(y - Math.sin(this.ang) * this.radius * 0.45, zone[0] + this.radius * 0.45, Math.max(zone[0] + this.radius * 0.45, zone[1] - this.radius * 0.45));
    if (path === 'wave') this.y = this.baseY + this.amp * Math.sin(this.ph);
  }

  get alive() {
    return this.state === 'fly';
  }

  update(dt, fx) {
    this.t += dt;
    if (this.state === 'fly') this._fly(dt);
    else if (this.state === 'hit') this._hitPause(dt);
    else this._fall(dt, fx);

    // Flügelschlag
    if (this.wing === 'flap') {
      this.flapPhase = (this.flapPhase + dt * this.flapRate) % 1;
      this.frame = Math.floor(this.flapPhase * FLAP_FRAMES) % FLAP_FRAMES;
    } else if (this.wing === 'glide') this.frame = F_GLIDE;
    else if (this.wing === 'tuck') this.frame = F_TUCK;
    else if (this.wing === 'fall') this.frame = (this.t * 9) % 2 < 1 ? F_FALL_A : F_FALL_B;

    // Goldadler funkelt
    if (this.species === 'gold' && this.state !== 'fall') {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.05 / Math.max(0.35, fx.q);
        const s = this.s;
        fx.sparkle(this.layer, this.x + (Math.random() - 0.6) * 90 * s * this.facing, this.y + (Math.random() - 0.5) * 50 * s, s, {
          color: '#ffe066', size: 0.8, vx: -this.vx * 0.2, vy: 20 * s, life: 0.7,
        });
      }
    }
  }

  _fly(dt) {
    const sp = this.speed;
    const [z0, z1] = this.zone;
    switch (this.path) {
      case 'wave': {
        this.vx = this.dir * sp;
        const ny = this.baseY + this.amp * Math.sin(this.t * this.omega + this.ph);
        this.vy = (ny - this.y) / Math.max(dt, 1e-4);
        this.y = ny;
        this.x += this.vx * dt;
        // abwärts kurz gleiten
        this.wing = Math.cos(this.t * this.omega + this.ph) > 0.55 ? 'glide' : 'flap';
        break;
      }
      case 'glide': {
        this.vx = this.dir * sp * 0.85;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.wing = this.wing === 'glide' ? 'flap' : 'glide';
          this.timer = this.wing === 'glide' ? this.rng.range(1.6, 3) : this.rng.range(0.7, 1.2);
        }
        const target = this.wing === 'glide' ? 18 * this.s : -30 * this.s;
        this.vy += (target - this.vy) * Math.min(1, dt * 1.5);
        if (this.y < z0 + 20) this.vy += 60 * dt;
        if (this.y > z1 - 20) this.vy -= 90 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        break;
      }
      case 'dive': {
        this.timer -= dt;
        if (this.phase === 'cruise') {
          this.vx = this.dir * sp;
          this.vy += (Math.sin(this.t * 2) * 14 * this.s - this.vy) * Math.min(1, dt * 3);
          this.wing = 'flap';
          if (this.timer <= 0 && this.y < z1 - 120 * this.s) {
            this.phase = 'dive';
            this.diveBottom = Math.min(z1, this.y + this.rng.range(110, 200) * this.s);
          }
        } else if (this.phase === 'dive') {
          this.wing = 'tuck';
          this.vx = this.dir * sp * 1.25;
          this.vy = Math.min(this.vy + 900 * this.s * dt, sp * 1.3);
          if (this.y >= this.diveBottom) this.phase = 'pull';
        } else {
          this.wing = 'flap';
          this.flapRate = this.pal.flap * 1.5;
          this.vx = this.dir * sp;
          this.vy += (-sp * 0.55 - this.vy) * Math.min(1, dt * 3.5);
          if (this.y <= this.baseY) {
            this.phase = 'cruise';
            this.flapRate = this.pal.flap;
            this.timer = this.rng.range(1.2, 2.4);
          }
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        break;
      }
      case 'circle': {
        this.cx += this.dir * sp * 0.36 * dt;
        const w = (sp / this.radius) * 0.8;
        this.ang += this.dir * w * dt;
        const nx = this.cx + Math.cos(this.ang) * this.radius;
        const ny = this.cy + Math.sin(this.ang) * this.radius * 0.45;
        this.vx = (nx - this.x) / Math.max(dt, 1e-4);
        this.vy = (ny - this.y) / Math.max(dt, 1e-4);
        this.x = nx;
        this.y = ny;
        this.wing = this.vy < -10 * this.s ? 'flap' : 'glide';
        break;
      }
      case 'zigzag':
      default: {
        this.vx = this.dir * sp;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = this.rng.range(0.4, 0.8);
          const up = this.y > (z0 + z1) / 2 ? -1 : 1;
          const sign = this.rng.chance(0.7) ? up : -up;
          this.vyTarget = sign * sp * this.rng.range(0.35, 0.7);
        }
        if (this.y < z0) this.vyTarget = Math.abs(this.vyTarget) || sp * 0.4;
        if (this.y > z1) this.vyTarget = -Math.abs(this.vyTarget) || -sp * 0.4;
        this.vy += (this.vyTarget - this.vy) * Math.min(1, dt * 7);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.wing = 'flap';
        this.flapRate = this.pal.flap * (this.vy < 0 ? 1.35 : 1);
        break;
      }
    }
    if (Math.abs(this.vx) > 4) this.facing = this.vx > 0 ? 1 : -1;
    const target = clamp(Math.atan2(this.vy, Math.abs(this.vx)) * (this.wing === 'tuck' ? 0.9 : 0.55), -0.55, 0.95);
    this.pitch += (target - this.pitch) * Math.min(1, dt * 7);
    this.rot = this.pitch * this.facing;
  }

  // Getroffen: Schreck-Moment, bis die Mütze landet
  startHit() {
    this.state = 'hit';
    this.hitT = 0;
    this.landed = false;
    this.vx = 0;
    this.vy = 0;
    this.wing = 'flap';
    this.flapRate = this.pal.flap * 2.4;
  }

  hatLanded(fx) {
    this.hat = true;
    this.landed = true;
    this.hitT = 0;
    this.wing = 'fall';
    this.vy = -150 * this.s;
    const s = this.s;
    fx.feathers(this.layer, this.x, this.y - 6 * s, s, this.pal.feathers, 8);
    // kleiner Puff an der Krempe – die Mütze selbst soll sichtbar bleiben
    const [hx, hy] = this.hatAnchor();
    fx.puff(this.layer, hx, hy, s * 0.5, 4);
  }

  _hitPause(dt) {
    this.hitT += dt;
    if (!this.landed) return;
    this.y += this.vy * dt;
    this.vy += 600 * this.s * dt;
    this.rot += (this.facing * -0.25 - this.rot) * Math.min(1, dt * 10);
    if (this.hitT > 0.2) {
      this.state = 'fall';
      this.vx = this.dir * this.speed * 0.22;
      this.spin = (this.rng.chance(0.5) ? -1 : 1) * this.rng.range(5, 8);
      this.trailT = 0.1;
    }
  }

  _fall(dt, fx) {
    this.wing = 'fall';
    this.vy += 820 * (0.45 + 0.55 * this.s) * dt;
    this.vx *= Math.exp(-0.8 * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.spin * dt;
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.19 / Math.max(0.35, fx.q);
      const c = this.pal.feathers[(Math.random() * this.pal.feathers.length) | 0];
      fx.feather(this.layer, this.x, this.y, this.s, c, -this.vx * 0.2, -this.vy * 0.3);
    }
    if (this.y > 820) this.dead = true;
  }

  // Nachschuss: Adler hüpft noch einmal hoch
  bump(fx) {
    this.followups++;
    this.vy = -320 * (0.45 + 0.55 * this.s);
    this.spin *= -1.3;
    fx.feathers(this.layer, this.x, this.y, this.s, this.pal.feathers, 5);
  }

  // Kopf-/Mützenposition in Ebenen-Koordinaten (berücksichtigt Drehung)
  _local(lx, ly) {
    const s = this.s, c = Math.cos(this.rot), sn = Math.sin(this.rot);
    const x = lx * this.facing * s, y = ly * s;
    return [this.x + x * c - y * sn, this.y + x * sn + y * c];
  }
  headX() { return this._local(50, -20)[0]; }
  headY() { return this._local(50, -20)[1]; }
  hatAnchor() { return this._local(HAT_ON_HEAD.x, HAT_ON_HEAD.y); }
  hatRot() { return this.rot + this.facing * HAT_ON_HEAD.rot; }

  hitCenter() {
    if (this.state === 'fall') return [this.x, this.y];
    return this._local(HIT.x, HIT.y);
  }

  // Treffer-Radien; minR (Ebenen-Einheiten) hält kleine, ferne Adler auf dem Handy treffbar
  _hitR(k, minR) {
    const s = this.s * k;
    if (this.state === 'fall') return [Math.max(FALL_R * s, minR * 1.2), 0];
    return [Math.max(HIT.rx * s, minR * 1.7), Math.max(HIT.ry * s, minR)];
  }

  // Normierter Abstand (≤ 1 = Treffer)
  hitDist(px, py, k, minR = 0) {
    const [cx, cy] = this.hitCenter();
    const [rx, ry] = this._hitR(k, minR);
    if (this.state === 'fall') return Math.hypot(px - cx, py - cy) / rx;
    const dx = (px - cx) / rx, dy = (py - cy) / ry;
    return Math.sqrt(dx * dx + dy * dy);
  }

  draw(ctx, view) {
    const img = frameCanvas(getEagleSprites(this.species, this.layer, view), this.frame);
    const s = this.s;
    let bob = 0;
    if (this.wing === 'flap') bob = -2.5 * Math.sin(this.flapPhase * TAU);
    ctx.save();
    ctx.translate(this.x, this.y + bob * s);
    if (this.rot) ctx.rotate(this.rot);
    ctx.scale(this.facing * s, s);
    ctx.drawImage(img, BOX.x0, BOX.y0, BOX.w, BOX.h);
    if (this.hat) drawHat(ctx, HAT_ON_HEAD.x, HAT_ON_HEAD.y, HAT_ON_HEAD.w, HAT_ON_HEAD.rot);
    ctx.restore();
  }

  debugDraw(ctx, k, minR = 0) {
    const [cx, cy] = this.hitCenter();
    const [rx, ry] = this._hitR(k, minR);
    ctx.beginPath();
    if (this.state === 'fall') ctx.arc(cx, cy, rx, 0, TAU);
    else ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.stroke();
  }
}

// --- Versteck-Adler -------------------------------------------------------------------

export class Peeker {
  constructor({ spot, species, rng, x }) {
    this.spot = spot;
    this.layer = spot.layer;
    this.s = LAYER_SCALE[spot.layer] ?? 0.68;
    this.species = species;
    this.pal = SPECIES[species];
    this.x = x;
    this.y = spot.y;
    this.t = 0;
    this.rise = 0;
    this.stay = rng.range(1.35, 1.7);
    this.state = 'up'; // up | look | down | hit
    this.look = 0;
    this.lookT = 0.3;
    this.rng = rng;
    this.hat = false;
    this.dead = false;
    this.tilt = 0;
  }

  get alive() {
    return this.state !== 'hit' && this.rise > 0.45;
  }

  update(dt) {
    this.t += dt;
    if (this.state === 'up') {
      this.rise = Math.min(1, this.rise + dt / 0.3);
      if (this.rise >= 1) this.state = 'look';
    } else if (this.state === 'look') {
      this.stay -= dt;
      this.lookT -= dt;
      if (this.lookT <= 0) {
        this.lookT = this.rng.range(0.25, 0.55);
        this.look = this.rng.pick([-1, -0.6, 0, 0.6, 1]);
      }
      if (this.stay <= 0) this.state = 'down';
    } else if (this.state === 'down') {
      this.rise = Math.max(0, this.rise - dt / 0.28);
      if (this.rise <= 0) this.dead = true;
    } else if (this.state === 'hit') {
      this.hitT += dt;
      if (this.hitT > 0.75) {
        this.rise = Math.max(0, this.rise - dt / 0.22);
        if (this.rise <= 0) this.dead = true;
      }
    }
    this.tilt += (this.look * 0.12 - this.tilt) * Math.min(1, dt * 8);
  }

  _yoff() {
    // Hochkommen mit leichtem Überschwingen
    const r = this.rise;
    const e = r < 1 ? 1 - Math.pow(1 - r, 3) * (1 + 1.6 * r) : 1;
    let hop = 0;
    if (this.state === 'hit' && this.landed) hop = Math.max(0, Math.sin(Math.min(1, this.hitT / 0.35) * Math.PI)) * 10;
    return (1 - e) * 72 - hop;
  }

  headPos() {
    const s = this.s;
    return [this.x, this.y + (PEEK_HEAD.y + this._yoff()) * s];
  }
  hatAnchor() {
    const s = this.s;
    return [this.x + HAT_ON_PEEK.x * s, this.y + (HAT_ON_PEEK.y + this._yoff()) * s];
  }

  hitDist(px, py, k, minR = 0) {
    const [hx, hy] = this.headPos();
    return Math.hypot(px - hx, py - (hy + 4 * this.s)) / Math.max(30 * this.s * k, minR);
  }

  startHit() {
    this.state = 'hit';
    this.hitT = 0;
    this.landed = false;
  }

  hatLanded(fx) {
    this.hat = true;
    this.landed = true;
    this.hitT = 0;
    const [hx, hy] = this.headPos();
    fx.feathers(this.layer, hx, hy, this.s, this.pal.feathers, 6);
    fx.puff(this.layer, hx, hy - 12 * this.s, this.s * 0.5, 4);
  }

  draw(ctx, view) {
    if (this.rise <= 0) return;
    const s = this.s;
    const sp = this.spot;
    const img = getPeekSprite(this.species, this.layer, view);
    ctx.save();
    // nur oberhalb der Kante zeichnen
    ctx.beginPath();
    ctx.rect(this.x - 80 * s, sp.y - 140 * s, 160 * s, 140 * s);
    ctx.clip();
    ctx.translate(this.x, this.y + this._yoff() * s);
    ctx.scale(s, s);
    if (this.tilt) ctx.rotate(this.tilt);
    ctx.drawImage(img, PEEK_BOX.x0, PEEK_BOX.y0, PEEK_BOX.w, PEEK_BOX.h);
    // Pupillen bzw. Kringelaugen nach Treffer
    ctx.fillStyle = '#120a05';
    ctx.strokeStyle = '#120a05';
    if (this.state === 'hit' && this.landed) {
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (const e of PEEK_EYES) {
        ctx.moveTo(e.x - 4, e.y - 4);
        ctx.lineTo(e.x + 4, e.y + 4);
        ctx.moveTo(e.x + 4, e.y - 4);
        ctx.lineTo(e.x - 4, e.y + 4);
      }
      ctx.stroke();
    } else {
      const lx = this.look * 3.2;
      ctx.beginPath();
      for (const e of PEEK_EYES) {
        ctx.moveTo(e.x + lx + 3.6, e.y + 1);
        ctx.arc(e.x + lx, e.y + 1, 3.6, 0, TAU);
      }
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      for (const e of PEEK_EYES) {
        ctx.moveTo(e.x + lx + 2.4, e.y - 0.5);
        ctx.arc(e.x + lx + 1.2, e.y - 0.5, 1.2, 0, TAU);
      }
      ctx.fill();
    }
    if (this.hat) drawHat(ctx, HAT_ON_PEEK.x, HAT_ON_PEEK.y, HAT_ON_PEEK.w, HAT_ON_PEEK.rot);
    ctx.restore();
  }

  debugDraw(ctx, k, minR = 0) {
    const [hx, hy] = this.headPos();
    ctx.beginPath();
    ctx.arc(hx, hy + 4 * this.s, Math.max(30 * this.s * k, minR), 0, TAU);
    ctx.stroke();
  }
}

// --- Schwarm: Spawnen, Aktualisieren, Zeichnen ----------------------------------------

const DEFAULT_ZONES = { far: [60, 360], mid: [70, 420], near: [40, 520] };
const ZONE_TOP = 96;

export class Flock {
  constructor({ airport, view, rng, fx }) {
    this.airport = airport;
    this.view = view;
    this.rng = rng;
    this.fx = fx;
    this.eagles = [];
    this.peekers = [];
  }

  // Flugband der Ebene; oben nicht unter die HUD-Leiste (Punkte/Zeit) fliegen
  zone(layer) {
    const z = this.airport.eagleZones?.[layer] || DEFAULT_ZONES[layer] || [80, 380];
    const top = Math.max(ZONE_TOP, 60 / Math.max(0.3, this.view.scale || 1));
    const z0 = Math.max(top, Math.min(z[0], z[1]));
    return [z0, Math.max(z0 + 120, z[0], z[1])];
  }

  // inView: Start mitten im Sichtbereich (Rundenbeginn), fromEdge: am Ebenenrand statt am Bildrand
  spawn({ species, layer, path, speedMul = 1, fromEdge = false, inView = false }) {
    const v = this.view, rng = this.rng;
    const W = LAYER_W[layer];
    const s = LAYER_SCALE[layer];
    const margin = 115 * s;
    let dir = rng.sign();
    const off = v.layerOffset(layer);
    let x;
    if (inView) x = off + v.viewW * rng.range(0.15, 0.85);
    else if (fromEdge) x = dir > 0 ? -margin : W + margin;
    else x = dir > 0 ? off - margin : off + v.viewW + margin;
    x = clamp(x, -margin, W + margin);
    if (x <= -margin + 1) dir = 1;
    if (x >= W + margin - 1) dir = -1;
    const zone = this.zone(layer);
    const pad = Math.min(50 * s, (zone[1] - zone[0]) * 0.25);
    const y = rng.range(zone[0] + pad, zone[1] - pad);
    const base = SPECIES[species].speed;
    const speed = base * (0.3 + 0.7 * s) * speedMul * rng.range(0.88, 1.12);
    const e = new Eagle({ species, layer, x, y, dir, path, speed, zone, rng });
    this.eagles.push(e);
    return e;
  }

  spawnPeeker(species, spots) {
    if (!spots.length) return null;
    const spot = this.rng.pick(spots);
    // x ist im Vertrag mehrdeutig (Mitte oder linke Kante) – [x, x + w/2] liegt in beiden Fällen auf der Kante
    const w = spot.w || 40;
    const x = spot.x + w / 4 + this.rng.range(-0.2, 0.2) * w;
    const p = new Peeker({ spot, species, rng: this.rng, x });
    this.peekers.push(p);
    return p;
  }

  // Adler, die noch für den Spieler relevant sind (nicht weit weg auf dem Rückweg)
  countActive() {
    let n = 0;
    for (const e of this.eagles) if (e.state === 'fly') n++;
    return n;
  }

  update(dt) {
    const v = this.view;
    for (const e of this.eagles) {
      e.update(dt, this.fx);
      if (e.state === 'fly') {
        const W = LAYER_W[e.layer];
        const m = 130 * e.s;
        const off = v.layerOffset(e.layer);
        if ((e.x < -m * 1.4 && e.dir < 0) || (e.x > W + m * 1.4 && e.dir > 0)) e.dead = true;
        // weit außerhalb und auf dem Weg weg vom Bild → Platz für neue Adler
        else if ((e.x < off - 900 && e.dir < 0) || (e.x > off + v.viewW + 900 && e.dir > 0)) e.dead = true;
      }
    }
    for (const p of this.peekers) p.update(dt);
    if (this.eagles.some((e) => e.dead)) this.eagles = this.eagles.filter((e) => !e.dead);
    if (this.peekers.some((p) => p.dead)) this.peekers = this.peekers.filter((p) => !p.dead);
  }

  drawLayer(ctx, layer) {
    const v = this.view;
    for (const p of this.peekers) if (p.layer === layer) p.draw(ctx, v);
    // fallende zuerst, damit fliegende Adler vorne bleiben
    for (const e of this.eagles) {
      if (e.layer !== layer || e.state !== 'fall') continue;
      if (v.isVisible(layer, e.x, 130 * e.s)) e.draw(ctx, v);
    }
    for (const e of this.eagles) {
      if (e.layer !== layer || e.state === 'fall') continue;
      if (v.isVisible(layer, e.x, 130 * e.s)) e.draw(ctx, v);
    }
  }
}
