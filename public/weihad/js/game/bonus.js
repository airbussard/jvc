// Boni: Geschenke am Fallschirm und Rentierschlitten mit Rudolph (prozedural, vorgerendert)
import { LAYER_SCALE } from '../config.js';
import { spriteRes, freeCanvas } from './eagles.js';

const TAU = Math.PI * 2;
const GIFT_BOX = { x0: -44, y0: -92, x1: 44, y1: 22 };
GIFT_BOX.w = GIFT_BOX.x1 - GIFT_BOX.x0;
GIFT_BOX.h = GIFT_BOX.y1 - GIFT_BOX.y0;
const GIFT_PIVOT = -58; // Schirmmitte, um die das Paket pendelt
const GIFT_COLORS = [
  { box: ['#3fc173', '#1f7d45'], ribbon: '#ffd34d' },
  { box: ['#4a8cf0', '#2453a8'], ribbon: '#ff5266' },
  { box: ['#ffd65a', '#d79a1c'], ribbon: '#e3263b' },
  { box: ['#b06cf0', '#6b34b0'], ribbon: '#8ff0c8' },
];

const SLEIGH_BOX = { x0: -86, y0: -74, x1: 216, y1: 40 };
SLEIGH_BOX.w = SLEIGH_BOX.x1 - SLEIGH_BOX.x0;
SLEIGH_BOX.h = SLEIGH_BOX.y1 - SLEIGH_BOX.y0;
export const SLEIGH_SCALE = 0.5;
const NOSE = { x: 205, y: -21 };

const cache = new Map();
let cacheRes = 0;

function makeCanvas(box, res, paint) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(box.w * res));
  c.height = Math.max(1, Math.ceil(box.h * res));
  const g = c.getContext('2d');
  g.setTransform(res, 0, 0, res, -box.x0 * res, -box.y0 * res);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  paint(g);
  return c;
}

function cached(key, view, build) {
  const R = spriteRes(view);
  if (R !== cacheRes) {
    cache.forEach(freeCanvas);
    cache.clear();
    cacheRes = R;
  }
  let c = cache.get(key);
  if (!c) {
    c = build(R);
    cache.set(key, c);
  }
  return c;
}

// --- Geschenk am Fallschirm ---------------------------------------------------------

function paintCanopy(g, withBox) {
  const OUT = '#3a1a14';
  // Leinen
  g.strokeStyle = 'rgba(60,40,30,0.85)';
  g.lineWidth = 1.2;
  g.beginPath();
  const ends = withBox ? [[-12, -13], [-5, -13], [5, -13], [12, -13]] : [[-3, -20], [-1, -18], [1, -18], [3, -20]];
  [[-34, -52], [-13, -50], [13, -50], [34, -52]].forEach(([x, y], i) => {
    g.moveTo(x, y);
    g.lineTo(ends[i][0], ends[i][1]);
  });
  g.stroke();
  // Schirmkappe
  const dome = () => {
    g.beginPath();
    g.moveTo(-38, -52);
    g.bezierCurveTo(-40, -82, 40, -82, 38, -52);
    for (let i = 0; i < 4; i++) {
      const x0 = 38 - i * 19, x1 = 38 - (i + 1) * 19;
      g.quadraticCurveTo((x0 + x1) / 2, -60, x1, -52);
    }
    g.closePath();
  };
  dome();
  g.fillStyle = '#e3263b';
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = '#fff6ee';
  for (const [a, b] of [[-24, -9], [9, 24]]) {
    g.beginPath();
    g.moveTo(0, -86);
    g.lineTo(a * 1.25, -48);
    g.lineTo(b * 1.25, -48);
    g.closePath();
    g.fill();
  }
  const hl = g.createRadialGradient(-14, -76, 2, -6, -66, 34);
  hl.addColorStop(0, 'rgba(255,255,255,0.45)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl;
  g.fillRect(-40, -90, 80, 40);
  g.fillStyle = 'rgba(80,0,10,0.25)';
  g.fillRect(-40, -58, 80, 8);
  g.restore();
  dome();
  g.strokeStyle = OUT;
  g.lineWidth = 2;
  g.stroke();
}

function paintGift(g, col) {
  paintCanopy(g, true);
  const OUT = '#2a1a10';
  // Paket
  const bg = g.createLinearGradient(-14, -12, 14, 15);
  bg.addColorStop(0, col.box[0]);
  bg.addColorStop(1, col.box[1]);
  g.fillStyle = bg;
  g.strokeStyle = OUT;
  g.lineWidth = 2;
  g.beginPath();
  g.rect(-15, -12, 30, 27);
  g.fill();
  g.fillStyle = col.ribbon;
  g.fillRect(-3.5, -12, 7, 27);
  g.fillRect(-15, -1, 30, 6);
  g.beginPath();
  g.rect(-15, -12, 30, 27);
  g.stroke();
  // Schleife
  g.fillStyle = col.ribbon;
  g.lineWidth = 1.6;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 7, -17, 7, 4.5, sx * -0.5, 0, TAU);
    g.fill();
    g.stroke();
  }
  g.beginPath();
  g.arc(0, -14, 3.2, 0, TAU);
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.3)';
  g.fillRect(-13, -10, 4, 22);
}

// Vorwärm-Aufgaben (je eine Leinwand pro Aufruf)
export function bonusWarmTasks(view) {
  const tasks = [];
  for (const layer of ['mid', 'near']) {
    const s = LAYER_SCALE[layer];
    GIFT_COLORS.forEach((col, i) => tasks.push(() => cached('gift' + i + '|' + layer, view, (R) => makeCanvas(GIFT_BOX, R * s, (g) => paintGift(g, col)))));
    tasks.push(() => cached('canopy|' + layer, view, (R) => makeCanvas(GIFT_BOX, R * s, (g) => paintCanopy(g, false))));
  }
  for (let f = 0; f < 4; f++) tasks.push(() => cached('sleigh' + f, view, (R) => makeCanvas(SLEIGH_BOX, R * SLEIGH_SCALE, (g) => paintSleigh(g, f))));
  tasks.push(() => noseGlow());
  return tasks;
}

export class Gift {
  constructor({ layer, x, y, rng, vx = 0, vy = 0 }) {
    this.layer = layer;
    this.s = LAYER_SCALE[layer];
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.variant = rng.int(0, GIFT_COLORS.length - 1);
    this.ph = rng.range(0, TAU);
    this.t = 0;
    this.sway = 0;
    this.state = 'fall'; // fall | hit | pop
    this.dead = false;
  }

  get alive() {
    return this.state === 'fall';
  }

  update(dt) {
    this.t += dt;
    const s = this.s;
    if (this.state === 'pop') {
      // Schirm ohne Paket schwebt davon
      this.popT += dt;
      this.y -= 70 * s * dt;
      this.x += Math.sin(this.t * 3) * 30 * s * dt;
      this.sway = Math.sin(this.t * 5) * 0.4;
      if (this.popT > 1.1) this.dead = true;
      return;
    }
    const fall = 50 * (0.4 + 0.6 * s);
    this.vy += (fall - this.vy) * Math.min(1, dt * 1.8);
    this.vx *= Math.exp(-dt * 0.8);
    this.x += (this.vx + Math.sin(this.t * 0.9 + this.ph) * 16 * s) * dt;
    if (this.state === 'fall') this.y += this.vy * dt;
    this.sway = Math.sin(this.t * 1.7 + this.ph) * 0.2;
    if (this.y > 790) this.dead = true;
  }

  startHit() {
    this.state = 'hit';
  }

  pop(fx) {
    this.state = 'pop';
    this.popT = 0;
    const s = this.s;
    fx.confetti(this.layer, this.x, this.y, s, 26);
    fx.sparkles(this.layer, this.x, this.y, s, 8, { color: '#fff0a0' });
    fx.puff(this.layer, this.x, this.y, s * 0.8, 4);
  }

  hitDist(px, py, k, minR = 0) {
    const s = this.s * k;
    const dx = (px - this.x) / Math.max(42 * s, minR * 1.2), dy = (py - (this.y - 34 * this.s)) / Math.max(58 * s, minR * 1.5);
    return Math.sqrt(dx * dx + dy * dy);
  }

  draw(ctx, view) {
    const s = this.s;
    const key = (this.state === 'pop' ? 'canopy' : 'gift' + this.variant) + '|' + this.layer;
    const img = cached(key, view, (R) => makeCanvas(GIFT_BOX, R * s, (g) => {
      if (this.state === 'pop') paintCanopy(g, false);
      else paintGift(g, GIFT_COLORS[this.variant]);
    }));
    ctx.save();
    if (this.state === 'pop') ctx.globalAlpha = Math.max(0, 1 - this.popT / 1.1);
    ctx.translate(this.x, this.y + GIFT_PIVOT * s);
    ctx.rotate(this.sway);
    ctx.translate(0, -GIFT_PIVOT * s);
    ctx.scale(s, s);
    ctx.drawImage(img, GIFT_BOX.x0, GIFT_BOX.y0, GIFT_BOX.w, GIFT_BOX.h);
    ctx.restore();
  }

  debugDraw(ctx, k, minR = 0) {
    const s = this.s * k;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y - 34 * this.s, Math.max(42 * s, minR * 1.2), Math.max(58 * s, minR * 1.5), 0, 0, TAU);
    ctx.stroke();
  }
}

// --- Rentierschlitten ------------------------------------------------------------------

function paintReindeer(g, cx, frame, rudolph) {
  const OUT = '#2a160a';
  const ph = (frame / 4) * TAU;
  g.save();
  g.translate(cx, 0);
  const leg = (x, y, a, knee, near) => {
    const l1 = 13, l2 = 13;
    const kx = x + Math.cos(a) * l1, ky = y + Math.sin(a) * l1;
    const a2 = a + knee;
    const fx = kx + Math.cos(a2) * l2, fy = ky + Math.sin(a2) * l2;
    g.strokeStyle = OUT;
    g.lineWidth = 6.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(kx, ky);
    g.lineTo(fx, fy);
    g.stroke();
    g.strokeStyle = near ? '#9a6434' : '#7a4c24';
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#2a1a10';
    g.beginPath();
    g.arc(fx, fy, 2.6, 0, TAU);
    g.fill();
  };
  // hintere Beine (weit)
  leg(-15, 6, 2.3 + 0.35 * Math.sin(ph), -0.6, false);
  leg(15, 6, 0.9 + 0.35 * Math.sin(ph + 1), 0.9, false);
  // Körper
  g.fillStyle = '#93602f';
  g.strokeStyle = OUT;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(0, 0, 25, 11.5, -0.05, 0, TAU);
  g.fill();
  g.stroke();
  g.fillStyle = '#d6aa76';
  g.beginPath();
  g.ellipse(2, 6, 17, 4.5, 0, 0, TAU);
  g.fill();
  // Schwänzchen
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(-25, -6, 5, 3.4, -0.6, 0, TAU);
  g.fill();
  g.stroke();
  // Hals + Kopf
  g.fillStyle = '#93602f';
  g.beginPath();
  g.moveTo(12, -8);
  g.quadraticCurveTo(22, -16, 26, -26);
  g.lineTo(34, -22);
  g.quadraticCurveTo(28, -8, 22, 2);
  g.closePath();
  g.fill();
  g.stroke();
  // Geweih
  g.strokeStyle = '#5a4026';
  g.lineWidth = 4.2;
  const antler = (dx) => {
    g.beginPath();
    g.moveTo(28 + dx, -30);
    g.quadraticCurveTo(22 + dx, -42, 14 + dx, -50);
    g.moveTo(23 + dx, -40);
    g.lineTo(30 + dx, -48);
    g.moveTo(18 + dx, -46);
    g.lineTo(18 + dx, -55);
    g.moveTo(25 + dx, -36);
    g.lineTo(16 + dx, -38);
    g.stroke();
  };
  antler(-4);
  g.strokeStyle = '#e9d3a4';
  g.lineWidth = 2.4;
  antler(-4);
  g.strokeStyle = '#5a4026';
  g.lineWidth = 4.2;
  antler(0);
  g.strokeStyle = '#f3e2bb';
  g.lineWidth = 2.4;
  antler(0);
  // Kopf
  g.fillStyle = '#a06a36';
  g.strokeStyle = OUT;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(36, -27, 11, 7, 0.32, 0, TAU);
  g.fill();
  g.stroke();
  g.fillStyle = '#c8935a';
  g.beginPath();
  g.ellipse(42, -23, 5, 4, 0.3, 0, TAU);
  g.fill();
  // Ohr
  g.fillStyle = '#7a4c24';
  g.beginPath();
  g.ellipse(28, -33, 6, 2.6, -0.7, 0, TAU);
  g.fill();
  g.stroke();
  // Auge
  g.fillStyle = '#120a05';
  g.beginPath();
  g.arc(35, -30, 1.8, 0, TAU);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(35.6, -30.6, 0.7, 0, TAU);
  g.fill();
  // Nase
  if (rudolph) {
    const ng = g.createRadialGradient(46.5, -22.5, 0.5, 47, -21, 5);
    ng.addColorStop(0, '#ffd0d0');
    ng.addColorStop(0.35, '#ff3030');
    ng.addColorStop(1, '#a00010');
    g.fillStyle = ng;
    g.beginPath();
    g.arc(47, -21, 4.6, 0, TAU);
    g.fill();
    g.strokeStyle = '#5a0008';
    g.lineWidth = 1.2;
    g.stroke();
  } else {
    g.fillStyle = '#2a1a10';
    g.beginPath();
    g.arc(46.5, -21.5, 2.6, 0, TAU);
    g.fill();
  }
  // Geschirr mit Glöckchen
  g.strokeStyle = '#c4161c';
  g.lineWidth = 4.5;
  g.beginPath();
  g.moveTo(16, -12);
  g.quadraticCurveTo(22, -4, 26, -12);
  g.stroke();
  g.fillStyle = '#ffd34d';
  g.strokeStyle = '#7a5a00';
  g.lineWidth = 1;
  for (const [bx, by] of [[18, -7], [23, -6]]) {
    g.beginPath();
    g.arc(bx, by, 2.4, 0, TAU);
    g.fill();
    g.stroke();
  }
  g.strokeStyle = '#c4161c';
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(-6, -11);
  g.lineTo(-6, 11);
  g.stroke();
  // vordere Beine (nah)
  leg(-12, 7, 2.1 + 0.4 * Math.sin(ph + 0.6), -0.7, true);
  leg(17, 7, 0.75 + 0.4 * Math.sin(ph + 1.8), 1.0, true);
  g.restore();
}

function paintSleigh(g, frame) {
  const OUT = '#2a0a08';
  // Zügel
  g.strokeStyle = '#6b3a1a';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-14, -28);
  g.quadraticCurveTo(40, -6, 108, -12);
  g.moveTo(-14, -28);
  g.quadraticCurveTo(100, -10, 176, -12);
  g.stroke();
  paintReindeer(g, 90, frame, false);
  paintReindeer(g, 158, (frame + 2) % 4, true);
  // Geschenkesack
  g.fillStyle = '#8a5a2a';
  g.strokeStyle = OUT;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-70, -10);
  g.quadraticCurveTo(-82, -36, -62, -48);
  g.quadraticCurveTo(-52, -52, -46, -44);
  g.quadraticCurveTo(-38, -24, -46, -8);
  g.closePath();
  g.fill();
  g.stroke();
  for (const [x, y, c] of [[-66, -54, '#3fc173'], [-55, -58, '#4a8cf0'], [-49, -50, '#ffd65a']]) {
    g.fillStyle = c;
    g.beginPath();
    g.rect(x - 5, y - 5, 10, 10);
    g.fill();
    g.stroke();
  }
  // Weihnachtsmann
  g.fillStyle = '#d4161f';
  g.beginPath();
  g.ellipse(-27, -24, 14, 15, 0.1, 0, TAU);
  g.fill();
  g.stroke();
  g.fillStyle = '#1a1a1a';
  g.fillRect(-40, -22, 26, 5);
  g.fillStyle = '#ffd34d';
  g.fillRect(-23, -23, 6, 7);
  // Arm mit Zügel
  g.strokeStyle = OUT;
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(-26, -30);
  g.lineTo(-13, -28);
  g.stroke();
  g.strokeStyle = '#d4161f';
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = '#f5f5f5';
  g.beginPath();
  g.arc(-12, -28, 3.4, 0, TAU);
  g.fill();
  // Kopf, Bart, Mütze
  g.fillStyle = '#ffd2b0';
  g.strokeStyle = OUT;
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(-22, -44, 8, 0, TAU);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(-28, -43);
  g.quadraticCurveTo(-28, -28, -18, -30);
  g.quadraticCurveTo(-13, -36, -14, -43);
  g.quadraticCurveTo(-21, -39, -28, -43);
  g.fill();
  g.stroke();
  g.fillStyle = '#ff9a8a';
  g.beginPath();
  g.arc(-14.5, -45, 2.2, 0, TAU);
  g.fill();
  g.fillStyle = '#d4161f';
  g.beginPath();
  g.moveTo(-30, -48);
  g.quadraticCurveTo(-26, -60, -38, -64);
  g.quadraticCurveTo(-30, -56, -14, -50);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(-22, -50, 9, 3.2, 0.15, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(-39, -63, 3.4, 0, TAU);
  g.fill();
  // Schlitten
  const body = () => {
    g.beginPath();
    g.moveTo(-74, -28);
    g.quadraticCurveTo(-80, 6, -60, 14);
    g.lineTo(2, 14);
    g.quadraticCurveTo(22, 12, 20, -8);
    g.quadraticCurveTo(15, -16, 6, -10);
    g.lineTo(-38, -10);
    g.quadraticCurveTo(-46, -12, -50, -28);
    g.closePath();
  };
  body();
  const sg = g.createLinearGradient(0, -28, 0, 14);
  sg.addColorStop(0, '#ff3a3a');
  sg.addColorStop(1, '#a3121a');
  g.fillStyle = sg;
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 2.2;
  g.stroke();
  g.strokeStyle = '#ffd34d';
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(-70, -22);
  g.quadraticCurveTo(-74, 4, -58, 9);
  g.lineTo(0, 9);
  g.quadraticCurveTo(14, 8, 14, -4);
  g.stroke();
  // Kufen
  g.strokeStyle = '#ffcc33';
  g.lineWidth = 3.4;
  g.beginPath();
  g.moveTo(-66, 26);
  g.lineTo(18, 26);
  g.quadraticCurveTo(34, 26, 32, 12);
  g.quadraticCurveTo(30, 4, 23, 8);
  g.moveTo(-50, 14);
  g.lineTo(-52, 26);
  g.moveTo(0, 14);
  g.lineTo(2, 26);
  g.stroke();
}

let glowSprite = null;
function noseGlow() {
  if (glowSprite) return glowSprite;
  glowSprite = document.createElement('canvas');
  glowSprite.width = glowSprite.height = 96;
  const g = glowSprite.getContext('2d');
  const grd = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  grd.addColorStop(0, 'rgba(255,90,80,0.95)');
  grd.addColorStop(0.25, 'rgba(255,40,40,0.5)');
  grd.addColorStop(1, 'rgba(255,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 96, 96);
  return glowSprite;
}

export class Sleigh {
  constructor({ view, rng, hittable = true }) {
    this.layer = 'sky';
    this.s = SLEIGH_SCALE;
    this.dir = rng.sign();
    const S = this.s;
    this.x = this.dir > 0 ? -210 * S : view.viewW + 210 * S;
    // Höhe unterhalb der HUD-Leiste (wie Flock.zone), inkl. Schaukeln ±14 und Sprite-Oberkante
    const top = Math.max(96, 64 / Math.max(0.3, view.scale || 1));
    this.baseY = rng.range(top + 55, top + 130);
    this.y = this.baseY;
    this.speed = rng.range(200, 240);
    this.t = 0;
    this.rot = 0;
    this.state = 'fly'; // fly | hit
    this.hittable = hittable;
    this.dead = false;
    this.trailT = 0;
    this.view = view;
  }

  get alive() {
    return this.state === 'fly' && this.hittable;
  }

  update(dt, fx) {
    this.t += dt;
    const S = this.s;
    const sp = this.speed * (this.state === 'hit' ? 1.7 : 1);
    this.x += this.dir * sp * dt;
    this.y = this.baseY + Math.sin(this.t * 1.4) * 14 - (this.state === 'hit' ? this.hitT * 40 : 0);
    if (this.state === 'hit') {
      this.hitT += dt;
      this.rot = Math.sin(this.hitT * 16) * 0.28 * Math.exp(-this.hitT * 2.5);
    } else this.rot = Math.cos(this.t * 1.4) * 0.05;
    // Glitzerspur hinter den Kufen
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.045 / Math.max(0.35, fx.q);
      fx.sparkle('sky', this.x - this.dir * 40 * S, this.y + 24 * S, 0.5, {
        color: Math.random() < 0.5 ? '#fff3b0' : '#bfe6ff', vx: -this.dir * 40, vy: 30, life: 0.9,
      });
    }
    const W = this.view.viewW;
    if ((this.dir > 0 && this.x > W + 230 * S) || (this.dir < 0 && this.x < -230 * S)) this.dead = true;
  }

  startHit() {
    this.state = 'hit';
    this.hitT = 0;
  }

  center() {
    return [this.x + this.dir * 55 * this.s, this.y - 12 * this.s];
  }

  hitDist(px, py, k, minR = 0) {
    const S = this.s * k;
    const [cx, cy] = this.center();
    const dx = (px - cx) / (140 * S), dy = (py - cy) / Math.max(48 * S, minR);
    return Math.sqrt(dx * dx + dy * dy);
  }

  draw(ctx, view) {
    const S = this.s;
    const frame = Math.floor(this.t * 8) % 4;
    const img = cached('sleigh' + frame, view, (R) => makeCanvas(SLEIGH_BOX, R * S, (g) => paintSleigh(g, frame)));
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.rot) ctx.rotate(this.rot);
    ctx.scale(this.dir * S, S);
    ctx.drawImage(img, SLEIGH_BOX.x0, SLEIGH_BOX.y0, SLEIGH_BOX.w, SLEIGH_BOX.h);
    // Rudolphs leuchtende Nase
    const pulse = 0.65 + 0.35 * Math.sin(this.t * 7);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pulse;
    const r = 34 + pulse * 10;
    ctx.drawImage(noseGlow(), NOSE.x - r, NOSE.y - r, r * 2, r * 2);
    ctx.restore();
  }

  debugDraw(ctx, k, minR = 0) {
    const S = this.s * k;
    const [cx, cy] = this.center();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 140 * S, Math.max(48 * S, minR), 0, 0, TAU);
    ctx.stroke();
  }
}
