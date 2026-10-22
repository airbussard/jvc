// Partikel: Federn, Schneepuffs, Funkeln, Konfetti, herabfallende Mützen und Punkte-Popups.
// Partikel leben in Ebenen-Weltkoordinaten. Mit ov=true werden sie im Overlay (vor allen Ebenen)
// gezeichnet, bleiben aber an ihrer Ebene verankert und schwenken mit.
import { getHatSprite } from './hats.js';

const FEATHER = 0, PUFF = 1, SPARKLE = 2, CONFETTI = 3, HAT = 4, RING = 5;
const MAX_PARTICLES = 700;
const TAU = Math.PI * 2;

// Selbst gehostete Schriften des UI-Agents für die Popups (nur gleiche Herkunft, sonst Fallback)
const POP_FONT = '"WeihadPop", "Bungee", "Arial Black", "Segoe UI Black", system-ui, sans-serif';
const LABEL_FONT = '"WeihadLabel", "Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
let fontsRequested = false;
function requestFonts() {
  if (fontsRequested || typeof FontFace === 'undefined' || !document.fonts) return;
  fontsRequested = true;
  for (const [family, file, weight] of [['WeihadPop', 'bungee-400.woff2', '400'], ['WeihadLabel', 'barlow-condensed-800.woff2', '800']]) {
    try {
      const f = new FontFace(family, `url(/weihad/fonts/${file})`, { weight });
      f.load().then((ff) => document.fonts.add(ff)).catch(() => {});
    } catch { /* Fallback-Schrift */ }
  }
}

// --- Vorgerenderte Sprites ---------------------------------------------------

const featherCache = new Map();
function featherSprite(color, dark) {
  const key = color + dark;
  let c = featherCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 72;
  c.height = 32;
  const g = c.getContext('2d');
  g.translate(36, 16);
  g.lineJoin = 'round';
  // Fahne: vorne schmal, hinten breit und leicht zerzaust
  g.fillStyle = color;
  g.strokeStyle = dark;
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(-31, 1);
  g.bezierCurveTo(-24, -12, 8, -14, 30, -3);
  g.quadraticCurveTo(34, 0, 30, 3);
  g.bezierCurveTo(14, 12, -6, 14, -18, 8);
  g.lineTo(-20, 11);
  g.lineTo(-23, 6);
  g.quadraticCurveTo(-28, 6, -31, 1);
  g.closePath();
  g.fill();
  g.stroke();
  g.strokeStyle = dark;
  g.globalAlpha = 0.45;
  g.lineWidth = 1.1;
  g.beginPath();
  for (let i = -18; i < 24; i += 6) {
    g.moveTo(i, 0);
    g.lineTo(i + 6, -8);
    g.moveTo(i, 0.5);
    g.lineTo(i + 5, 8);
  }
  g.stroke();
  // heller Kiel
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(255,250,235,0.85)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-35, 1.5);
  g.quadraticCurveTo(0, -1, 29, 0);
  g.stroke();
  featherCache.set(key, c);
  return c;
}

let puffCanvas = null;
function puffSprite() {
  if (puffCanvas) return puffCanvas;
  puffCanvas = document.createElement('canvas');
  puffCanvas.width = puffCanvas.height = 64;
  const g = puffCanvas.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(250,252,255,0.85)');
  grd.addColorStop(1, 'rgba(230,240,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return puffCanvas;
}

const sparkleCache = new Map();
function sparkleSprite(color) {
  let c = sparkleCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalAlpha = 0.55;
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  g.globalAlpha = 1;
  g.fillStyle = '#fffbe8';
  g.translate(32, 32);
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 4 : 28;
    const a = (i / 8) * TAU;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  sparkleCache.set(color, c);
  return c;
}

let ringCanvas = null;
function ringSprite() {
  if (ringCanvas) return ringCanvas;
  ringCanvas = document.createElement('canvas');
  ringCanvas.width = ringCanvas.height = 96;
  const g = ringCanvas.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(48, 48, 40, 0, TAU);
  g.stroke();
  return ringCanvas;
}

const CONFETTI_COLORS = ['#e3263b', '#ffcc33', '#2fbf71', '#3aa0ff', '#ffffff', '#ff7ab8'];

// Layout-Rechtecke von UI-Elementen in CSS-Pixeln relativ zum Canvas (Transform-Animationen wie
// Wackeln/Pulsieren zählen nicht mit). Ausgeblendete Elemente fehlen; ohne DOM → [].
// Erzwingt ggf. ein Layout – nur selten bzw. gedrosselt aufrufen.
function offsetPos(el) {
  let x = 0, y = 0;
  for (let n = el; n; n = n.offsetParent) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return [x, y];
}
export function uiRects(view, selector) {
  const out = [];
  try {
    const canvas = view.stage?.canvas;
    if (!canvas || typeof document === 'undefined') return out;
    const [cx, cy] = offsetPos(canvas);
    for (const el of document.querySelectorAll(selector)) {
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) continue;
      const [x, y] = offsetPos(el);
      out.push({ left: x - cx, top: y - cy, right: x - cx + w, bottom: y - cy + h });
    }
  } catch { /* ohne DOM (Tests) */ }
  return out;
}
const HUD_BLOCKS = '.scr-hud .hud-top > *';

// Vorwärm-Aufgaben: Sprites und Popup-Schrift vorab, damit der erste Treffer nicht ruckelt
export function particleWarmTasks(featherPalettes) {
  const tasks = [() => getHatSprite(), () => puffSprite(), () => ringSprite()];
  for (const c of ['#ffd34d', '#ffe066', '#fff0a0', '#fff3b0', '#bfe6ff']) tasks.push(() => sparkleSprite(c));
  for (const [a, b] of featherPalettes) tasks.push(() => featherSprite(a, b || '#2a1608'));
  tasks.push(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const g = c.getContext('2d');
    g.font = `20px ${POP_FONT}`;
    g.fillText('+100', 0, 8);
    g.font = `800 14px ${LABEL_FONT}`;
    g.fillText('Nachschuss ×2', 0, 8);
  });
  return tasks;
}

// --- System -----------------------------------------------------------------

export class Particles {
  constructor(view) {
    this.view = view;
    this.list = [];
    this.pool = [];
    this.popups = [];
    this.layerCount = { sky: 0, far: 0, mid: 0, near: 0 };
    this.hud = { rects: [], at: -1e9, key: null };
    requestFonts();
  }

  get q() {
    return this.view.quality ?? 1;
  }

  _new(kind, L, x, y, ov) {
    if (this.list.length >= MAX_PARTICLES) return null;
    const p = this.pool.pop() || {};
    p.kind = kind;
    p.L = L;
    p.ov = !!ov;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.rot = 0;
    p.vr = 0;
    p.size = 10;
    p.grow = 0;
    p.age = 0;
    p.life = 1;
    p.g = 0;
    p.drag = 0;
    p.sway = 0;
    p.phase = 0;
    p.alpha = 1;
    p.sprite = null;
    p.color = null;
    p.aspect = 1;
    p.flake = false;
    this.list.push(p);
    return p;
  }

  // Eine Feder, die segelnd und pendelnd herabschwebt (s = Ebenen-Skalierung)
  feather(L, x, y, s, colors, vx = 0, vy = 0) {
    const p = this._new(FEATHER, L, x, y, false);
    if (!p) return;
    const r = Math.random;
    p.sprite = featherSprite(colors[0], colors[1] || '#2a1608');
    p.vx = vx + (r() - 0.5) * 160 * s;
    p.vy = vy + (r() - 0.8) * 160 * s;
    p.size = (24 + r() * 14) * s;
    p.aspect = 32 / 72;
    p.rot = r() * TAU;
    p.vr = (r() - 0.5) * 7;
    p.life = 2.2 + r() * 1.6;
    p.g = 260 * s;
    p.drag = 2.6;
    p.sway = (40 + r() * 50) * s;
    p.phase = r() * TAU;
    p.s = s;
  }

  feathers(L, x, y, s, palette, n, vx = 0, vy = 0) {
    const count = Math.max(2, Math.round(n * (0.4 + 0.6 * this.q)));
    for (let i = 0; i < count; i++) {
      const colors = palette[i % palette.length];
      this.feather(L, x + (Math.random() - 0.5) * 40 * s, y + (Math.random() - 0.5) * 24 * s, s, colors, vx, vy);
    }
  }

  // Schneepuff: weiche Wolke, die sich ausdehnt und verblasst, dazu fliegende Schneeflocken
  puff(L, x, y, s, n = 7, { ov = false, color = null, spread = 1 } = {}) {
    const count = Math.max(3, Math.round(n * (0.5 + 0.5 * this.q)));
    for (let i = 0; i < count; i++) {
      const p = this._new(PUFF, L, x, y, ov);
      if (!p) return;
      const a = Math.random() * TAU;
      const sp = (50 + Math.random() * 120) * s * spread;
      p.sprite = puffSprite();
      p.x += Math.cos(a) * 6 * s;
      p.y += Math.sin(a) * 6 * s;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp * 0.7 - 25 * s;
      p.size = (20 + Math.random() * 22) * s * spread;
      p.grow = 1.8;
      p.life = 0.5 + Math.random() * 0.4;
      p.drag = 4.5;
      p.g = 40 * s;
      p.color = color;
      p.alpha = 1;
    }
    for (let i = 0; i < count; i++) {
      const p = this._new(PUFF, L, x, y, ov);
      if (!p) return;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const sp = (160 + Math.random() * 200) * s * spread;
      p.sprite = puffSprite();
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.size = (5 + Math.random() * 5) * s;
      p.life = 0.55 + Math.random() * 0.3;
      p.drag = 1.2;
      p.g = 700 * s;
      p.alpha = 1;
      p.flake = true;
    }
    const ring = this._new(RING, L, x, y, ov);
    if (ring) {
      ring.sprite = ringSprite();
      ring.size = 22 * s * spread;
      ring.grow = 5;
      ring.life = 0.32;
      ring.alpha = 0.75;
    }
  }

  sparkle(L, x, y, s, { ov = false, color = '#ffd34d', size = 1, vx = 0, vy = 0, life = 0.6 } = {}) {
    const p = this._new(SPARKLE, L, x, y, ov);
    if (!p) return;
    p.sprite = sparkleSprite(color);
    p.size = (12 + Math.random() * 12) * s * size;
    p.vx = vx;
    p.vy = vy;
    p.rot = Math.random() * TAU;
    p.vr = (Math.random() - 0.5) * 4;
    p.life = life * (0.7 + Math.random() * 0.6);
    p.drag = 1.5;
  }

  sparkles(L, x, y, s, n, opts = {}) {
    const count = Math.max(2, Math.round(n * (0.4 + 0.6 * this.q)));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = (60 + Math.random() * 160) * s;
      this.sparkle(L, x, y, s, { ...opts, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
    }
  }

  confetti(L, x, y, s, n = 24, ov = false) {
    const count = Math.max(6, Math.round(n * (0.4 + 0.6 * this.q)));
    for (let i = 0; i < count; i++) {
      const p = this._new(CONFETTI, L, x, y, ov);
      if (!p) return;
      const a = Math.random() * TAU;
      const sp = (90 + Math.random() * 260) * s;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - 140 * s;
      p.size = (6 + Math.random() * 6) * s;
      p.rot = Math.random() * TAU;
      p.vr = (Math.random() - 0.5) * 14;
      p.life = 1.1 + Math.random() * 0.8;
      p.g = 420 * s;
      p.drag = 1.8;
      p.color = CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0];
      p.phase = Math.random() * TAU;
    }
  }

  // Danebengegangene Mütze: kippt und fällt mit Drall herunter (Overlay)
  fallingHat(L, x, y, size, rot, vx = 0, vy = -60) {
    const p = this._new(HAT, L, x, y, true);
    if (!p) return;
    p.sprite = getHatSprite();
    p.size = size;
    p.rot = rot;
    p.vr = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4);
    p.vx = vx + (Math.random() - 0.5) * 60;
    p.vy = vy;
    p.g = 900;
    p.life = 0.95;
    p.drag = 0.4;
  }

  popup(L, x, y, text, { color = '#ffffff', sub = null, subColor = '#ffe27a', big = false, life = 1.15 } = {}) {
    if (this.popups.length > 14) this.popups.shift();
    // nicht übereinander: frische Popups in der Nähe nach oben ausweichen
    const v = this.view;
    const step = (22 + 20 * v.scale) / v.scale;
    for (let tries = 0; tries < 4; tries++) {
      const near = this.popups.some((pp) => pp.age < 0.6 && pp.L === L && Math.abs(pp.x - x) < 90 / v.scale && Math.abs(pp.y - y) < step);
      if (!near) break;
      y -= step;
    }
    this.popups.push({ L, x, y, text, sub, color, subColor, big, age: 0, life });
  }

  clear() {
    for (const p of this.list) this.pool.push(p);
    this.list.length = 0;
    this.popups.length = 0;
  }

  update(dt) {
    const list = this.list;
    const lc = this.layerCount;
    lc.sky = lc.far = lc.mid = lc.near = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        list[i] = list[list.length - 1];
        list.pop();
        this.pool.push(p);
        continue;
      }
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === FEATHER) {
        // Pendeln wie ein fallendes Blatt
        p.phase += dt * 3.2;
        p.x += Math.cos(p.phase) * p.sway * dt;
        p.rot += Math.cos(p.phase) * 1.4 * dt;
        if (p.vy > 55 * p.s) p.vy = 55 * p.s;
      } else if (p.kind === CONFETTI) {
        p.phase += dt * 9;
        if (p.vy > 120) p.vy = 120;
      }
      if (p.grow) p.size *= 1 + p.grow * dt;
      if (!p.ov) lc[p.L]++;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pp = this.popups[i];
      pp.age += dt;
      if (pp.age >= pp.life) this.popups.splice(i, 1);
    }
  }

  _alpha(p) {
    const k = p.age / p.life;
    if (p.kind === RING) return p.alpha * (1 - k) * (1 - k);
    if (p.kind === PUFF) return p.flake ? (k > 0.6 ? (1 - k) / 0.4 : 1) : p.alpha * Math.pow(1 - k, 1.5);
    if (p.kind === SPARKLE) return Math.sin(Math.min(1, k) * Math.PI);
    return k > 0.7 ? (1 - k) / 0.3 : 1;
  }

  // Zeichnet Partikel mit Basis-Matrix (A = Skalierung, E/F = Versatz), ohne save/restore pro Partikel
  _drawSet(ctx, A, E, F, filterL, ov) {
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (p.ov !== ov || (filterL && p.L !== filterL)) continue;
      let a = A, e = E;
      if (!filterL) {
        // Overlay: Ebenenversatz je Partikel
        a = A * this.view.scale;
        e = E - this.view.layerOffset(p.L) * a;
      }
      const alpha = this._alpha(p);
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      const c = Math.cos(p.rot), s = Math.sin(p.rot);
      if (p.kind === CONFETTI) {
        const flip = Math.cos(p.phase);
        ctx.setTransform(a * c * flip, a * s * flip, -a * s, a * c, a * p.x + e, a * p.y + F);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
        continue;
      }
      ctx.setTransform(a * c, a * s, -a * s, a * c, a * p.x + e, a * p.y + F);
      const w = p.size;
      const h = p.kind === HAT ? p.size * p.sprite.aspect : p.size * p.aspect;
      if (p.kind === HAT) {
        const hs = p.sprite;
        ctx.drawImage(hs.canvas, -w * hs.ox, -h * hs.oy, w, h);
      } else {
        ctx.drawImage(p.sprite, -w / 2, -h / 2, w, h);
      }
    }
  }

  // Basis-Matrix aus der Kamera statt ctx.getTransform() (keine DOMMatrix-Allokation pro Frame)
  drawLayer(ctx, L) {
    if (!this.layerCount[L]) return;
    const v = this.view;
    const a = v.scale * v.dpr;
    ctx.save();
    this._drawSet(ctx, a, -v.layerOffset(L) * a, 0, L, false);
    ctx.restore();
  }

  drawOverlay(ctx) {
    ctx.save();
    this._drawSet(ctx, this.view.dpr, 0, 0, null, true);
    ctx.restore();
  }

  // HUD-Blöcke oben (Punkte inkl. Combo-Badge, Uhr, Knöpfe); neu abgefragt bei Größen-/Combo-Wechsel, sonst gedrosselt
  _hudRects(hudKey) {
    const v = this.view, h = this.hud;
    const now = globalThis.performance?.now?.() ?? Date.now();
    const key = `${v.cssW}x${v.cssH}|${hudKey > 1}`;
    if (key !== h.key || now - h.at > 400) {
      h.key = key;
      h.at = now;
      h.rects = uiRects(v, HUD_BLOCKS);
    }
    return h.rects;
  }

  // Punkte-Popups in Bildschirmkoordinaten, gut lesbar mit Kontur; hudKey = aktueller Combo-Multiplikator
  drawPopups(ctx, hudKey = 0) {
    if (!this.popups.length) return;
    const v = this.view;
    const base = Math.round(15 + 14 * v.scale);
    const hud = this._hudRects(hudKey);
    // nicht unter der HUD-Leiste oben bzw. der Mützenleiste unten verschwinden
    const top0 = Math.min(90, Math.max(52, v.cssH * 0.12));
    const placed = [];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const pp of this.popups) {
      const k = pp.age / pp.life;
      let sx = (pp.x - v.layerOffset(pp.L)) * v.scale;
      let sy = pp.y * v.scale - (1 - (1 - k) * (1 - k)) * 46 * Math.max(0.7, v.scale);
      // Aufploppen: kurz größer, dann normal
      const pop = k < 0.12 ? 0.55 + (k / 0.12) * 0.65 : k < 0.22 ? 1.2 - ((k - 0.12) / 0.1) * 0.2 : 1;
      const fs = Math.round(base * (pp.big ? 1.35 : 1) * pop);
      // am Bildrand vollständig lesbar halten (Breite grob geschätzt, ohne measureText)
      const half = Math.max(fs * 0.4 * pp.text.length, pp.sub ? base * 0.2 * pp.sub.length : 0) + 6;
      sx = Math.min(Math.max(sx, half), v.cssW - half);
      // unter dem HUD-Block bleiben, mit dem sich das Popup waagerecht überschneidet (z. B. Combo-Badge)
      let top = top0;
      for (const r of hud) if (sx + half > r.left && sx - half < r.right) top = Math.max(top, r.bottom + 6);
      const below = pp.sub ? fs * 0.62 + base * 0.7 : fs * 0.5;
      if (sy < top + fs * 0.55) {
        sy = top + fs * 0.55;
        // oben festgehaltene Popups nicht übereinanderlegen, sondern darunter staffeln
        for (let i = 0; i < placed.length; i++) {
          const q = placed[i];
          if (Math.abs(sx - q.x) < half + q.half && sy - fs * 0.5 < q.bottom && sy + below > q.top) {
            sy = q.bottom + fs * 0.55 + 2;
            i = -1;
          }
        }
      }
      sy = Math.min(sy, v.cssH - 64 - (pp.sub ? base * 0.9 : 0) - fs * 0.5);
      placed.push({ x: sx, half, top: sy - fs * 0.5, bottom: sy + below });
      ctx.globalAlpha = k > 0.72 ? (1 - k) / 0.28 : 1;
      ctx.font = `${fs}px ${POP_FONT}`;
      ctx.lineWidth = Math.max(3, fs * 0.2);
      ctx.strokeStyle = 'rgba(20,10,8,0.9)';
      ctx.strokeText(pp.text, sx, sy);
      ctx.fillStyle = pp.color;
      ctx.fillText(pp.text, sx, sy);
      if (pp.sub) {
        const fs2 = Math.round(base * 0.7 * Math.min(1.1, pop));
        ctx.font = `800 ${fs2}px ${LABEL_FONT}`;
        ctx.lineWidth = Math.max(3, fs2 * 0.24);
        const y2 = sy + fs * 0.62 + fs2 * 0.45;
        ctx.strokeText(pp.sub, sx, y2);
        ctx.fillStyle = pp.subColor;
        ctx.fillText(pp.sub, sx, y2);
      }
    }
    ctx.restore();
  }
}
