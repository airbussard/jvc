// Dubai International (OMDB): Wüsten-Sonnenuntergang, Burj Khalifa, Terminal 3 mit Bögen, viele A380
import { linearSky, glow, stars } from './paint.js';

const TAU = Math.PI * 2;
const FAR_BASE = 470;   // Grundlinie der Skyline
const GROUND_Y = 466;   // Oberkante Flughafengelände (mid)
const TERM_BASE = 494;  // Fußlinie Terminal/Tower/Hangars
const GATE_Y = 522;
const TAXI_Y = 556;
const RWY_Y = 600;
const RWY_X1 = 150;
const RWY_X2 = 2230;
const TERM_X1 = 270;
const TERM_X2 = 1530;
const GATES_X = [400, 605, 810, 1015, 1220, 1425];
const TOWER_X = 1722;
const FIRE_TOWER_Y = 426; // Dach des Feuerwehr-Wachturms (Versteck)

// Lichtfarben als "r,g,b" (für Glow-Sprites)
const C = {
  red: '255,58,48', warm: '255,214,150', gold: '255,186,72', white: '255,248,232',
  green: '80,255,150', blue: '90,150,255', amber: '255,150,60',
};
const MULTI = ['255,70,70', '255,214,70', '90,235,120', '90,180,255', '255,120,220'];

// Beim Vorrendern gesammelte Positionen für die Animationen in drawDynamic
const dyn = { far: null, mid: null, near: null };
function resetDyn(id) {
  dyn[id] = { obst: [], bulbs: [], lanterns: [], rabbit: [], beacon: null, star: null };
  return dyn[id];
}

// --- Allgemeine Helfer -------------------------------------------------------

function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function rad(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// Glow-Sprites: einmal erzeugt, danach nur drawImage (billig pro Frame)
const spriteCache = new Map();
function sprite(rgb) {
  let c = spriteCache.get(rgb);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 48;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.1, `rgba(${rgb},1)`);
    gr.addColorStop(0.3, `rgba(${rgb},0.42)`);
    gr.addColorStop(0.62, `rgba(${rgb},0.1)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 48, 48);
    spriteCache.set(rgb, c);
  }
  return c;
}

function spot(ctx, rgb, x, y, r, a = 1) {
  ctx.globalAlpha = a;
  ctx.drawImage(sprite(rgb), x - r, y - r, r * 2, r * 2);
}

// Statische Glühbirne + Eintrag für das Funkeln
function bulb(ctx, list, rng, x, y, rgb, r = 1) {
  ctx.save();
  spot(ctx, rgb, x, y, r * 4.5, 0.55);
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgb(${rgb})`;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.75, 0, TAU);
  ctx.fill();
  ctx.restore();
  list?.push({ x, y, c: rgb, r, p: rng.range(0, TAU), s: rng.range(1.2, 3.6) });
}

function obstLight(ctx, list, x, y, r = 1, phase = 0) {
  ctx.save();
  spot(ctx, C.red, x, y, r * 4, 0.5);
  ctx.restore();
  list.push({ x, y, r, p: phase });
}

// Punkt auf quadratischer Bezierkurve
function qpt(a, c, b, t) {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

// --- Himmel ------------------------------------------------------------------

const SKY_STOPS = [
  [0, '#241d58'], [0.1, '#302668'], [0.2, '#4b307f'], [0.3, '#76398f'], [0.4, '#a94690'],
  [0.48, '#d65888'], [0.55, '#ef7a74'], [0.6, '#fb9a66'], [0.635, '#ffb466'], [0.67, '#ffcb7c'], [0.75, '#ffdb9c'], [1, '#ffe2ae'],
];

function streak(ctx, rng, x, y, len, th, col, hi) {
  ctx.save();
  ctx.fillStyle = col;
  ctx.beginPath();
  const n = Math.max(3, Math.round(len / 34));
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const px = x + k * len + rng.range(-8, 8);
    const taper = Math.sin(Math.PI * (0.1 + k * 0.8));
    const py = y + rng.range(-0.5, 0.5) * th;
    const rx = (len / n) * rng.range(0.9, 1.4);
    const ry = Math.max(0.6, th * taper * rng.range(0.55, 1));
    ctx.moveTo(px + rx, py);
    ctx.ellipse(px, py, rx, ry, 0, 0, TAU);
  }
  ctx.fill();
  // Unterseite von der tiefen Sonne beleuchtet
  ctx.fillStyle = hi;
  ctx.beginPath();
  ctx.ellipse(x + len * 0.5, y + th * 0.45, len * 0.4, Math.max(0.5, th * 0.28), 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function sparkleStar(ctx, x, y, s) {
  glow(ctx, x, y, s * 7, 'rgba(255,236,200,0.4)');
  glow(ctx, x, y, s * 2.4, 'rgba(255,250,230,0.8)');
  ctx.save();
  ctx.fillStyle = '#fffbec';
  const ray = (ang, len, wid) => {
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.lineTo(x + Math.cos(ang + Math.PI / 2) * wid, y + Math.sin(ang + Math.PI / 2) * wid);
    ctx.lineTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
    ctx.lineTo(x - Math.cos(ang + Math.PI / 2) * wid, y - Math.sin(ang + Math.PI / 2) * wid);
    ctx.closePath();
    ctx.fill();
  };
  ray(-Math.PI / 2, s * 3.4, s * 0.32);
  ray(0, s * 2.4, s * 0.3);
  ctx.globalAlpha = 0.7;
  ray(Math.PI / 4, s * 1.2, s * 0.22);
  ray(-Math.PI / 4, s * 1.2, s * 0.22);
  ctx.restore();
}

function skyStar(w) {
  return { x: Math.max(40, w * 0.3), y: 92 };
}

function paintSky(ctx, { w, h, rng }) {
  linearSky(ctx, w, h, SKY_STOPS);
  // Dunst über dem Horizont
  ctx.fillStyle = lin(ctx, 0, 340, 0, 480, [[0, 'rgba(255,190,140,0)'], [1, 'rgba(255,214,160,0.4)']]);
  ctx.fillRect(0, 340, w, 380);
  stars(ctx, rng, w, 190, Math.round(w / 38), { minR: 0.35, maxR: 1.05, alpha: 0.7 });

  // Tiefe Wüstensonne, relativ zur Breite platziert
  const sx = Math.max(150, w * 0.7);
  const sy = 338;
  const r = 33;
  glow(ctx, sx, sy, Math.min(560, 260 + w * 0.2), 'rgba(255,128,92,0.32)');
  glow(ctx, sx, sy, 190, 'rgba(255,176,100,0.5)');
  glow(ctx, sx, sy, 78, 'rgba(255,232,180,0.85)');
  ctx.save();
  ctx.fillStyle = rad(ctx, sx - 4, sy - 8, r * 1.15, [[0, '#fffdf0'], [0.45, '#fff0bf'], [0.85, '#ffc76e'], [1, '#ffa64f']]);
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, TAU);
  ctx.fill();
  // Hitzeflimmern: waagrechte Dunststreifen über der unteren Sonnenhälfte
  ctx.fillStyle = 'rgba(255,150,110,0.38)';
  for (let i = 0; i < 6; i++) {
    const y = sy + 4 + i * 5;
    const hw = r * (1.25 + i * 0.12);
    ctx.fillRect(sx - hw, y, hw * 2, 0.8 + i * 0.4);
  }
  ctx.restore();
  // breiter Lichtschleier am Horizont
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = rad(ctx, 0, 0, 1, [[0, 'rgba(255,236,190,1)'], [1, 'rgba(255,236,190,0)']]);
  ctx.translate(sx, sy + 10);
  ctx.scale(Math.min(520, w * 0.45), 16);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Zarte Wolkenschleier, oben lila, nahe der Sonne golden
  const n = Math.round(3 + w / 230);
  for (let i = 0; i < n; i++) {
    const y = rng.range(175, 405);
    const x = rng.range(-160, w - 40);
    const len = rng.range(160, 420);
    const th = rng.range(3.5, 8);
    const k = (y - 175) / 230;
    const col = k < 0.45 ? 'rgba(236,150,196,0.2)' : k < 0.75 ? 'rgba(255,160,160,0.24)' : 'rgba(255,200,150,0.28)';
    const hi = k < 0.45 ? 'rgba(255,196,214,0.36)' : 'rgba(255,230,180,0.45)';
    streak(ctx, rng, x, y, len, th, col, hi);
  }
  const st = skyStar(w);
  sparkleStar(ctx, st.x, st.y, 3.4);
}

// --- Ferne Ebene: Skyline ----------------------------------------------------

const TONES = {
  back: { dark: '#b06d90', mid: '#bd7b95', lit: '#e9a59c', win: 'rgba(255,222,170,0.5)', lit2: 0.1, rim: 'rgba(255,190,150,0.35)' },
  mid: { dark: '#6b4677', mid: '#835689', lit: '#e8968d', win: 'rgba(255,214,150,0.75)', lit2: 0.2, rim: 'rgba(255,170,130,0.55)' },
  front: { dark: '#3f2b5a', mid: '#563b70', lit: '#e08c86', win: 'rgba(255,212,140,0.9)', lit2: 0.26, rim: 'rgba(255,165,120,0.75)' },
};

function towerPath(ctx, s, x, top, w, h, base) {
  ctx.beginPath();
  switch (s) {
    case 'spire':
      ctx.rect(x, top, w, h);
      ctx.rect(x + w * 0.3, top - h * 0.1, w * 0.4, h * 0.1);
      ctx.moveTo(x + w * 0.44, top - h * 0.1);
      ctx.lineTo(x + w * 0.5, top - h * 0.3);
      ctx.lineTo(x + w * 0.56, top - h * 0.1);
      break;
    case 'slope':
      ctx.moveTo(x, base);
      ctx.lineTo(x, top + w * 0.7);
      ctx.lineTo(x + w, top);
      ctx.lineTo(x + w, base);
      break;
    case 'round':
      ctx.moveTo(x, base);
      ctx.lineTo(x, top + w / 2);
      ctx.arc(x + w / 2, top + w / 2, w / 2, Math.PI, TAU);
      ctx.lineTo(x + w, base);
      break;
    case 'point':
      ctx.moveTo(x, base);
      ctx.lineTo(x, top + w * 0.9);
      ctx.lineTo(x + w / 2, top - w * 0.5);
      ctx.lineTo(x + w, top + w * 0.9);
      ctx.lineTo(x + w, base);
      break;
    case 'stepped':
      ctx.rect(x, top + h * 0.3, w, h * 0.7);
      ctx.rect(x + w * 0.15, top + h * 0.12, w * 0.7, h * 0.88);
      ctx.rect(x + w * 0.3, top, w * 0.4, h);
      break;
    case 'twist':
      ctx.moveTo(x, base);
      for (let k = 0; k <= 1.001; k += 0.1) ctx.lineTo(x + Math.sin(k * 7) * w * 0.08, base - h * k);
      ctx.quadraticCurveTo(x + w / 2, top - w * 0.25, x + w + Math.sin(7) * w * 0.08, top);
      for (let k = 1; k >= -0.001; k -= 0.1) ctx.lineTo(x + w + Math.sin(k * 7 + 1.5) * w * 0.08, base - h * k);
      break;
    case 'sail':
      ctx.moveTo(x, base);
      ctx.lineTo(x, top);
      ctx.quadraticCurveTo(x + w * 1.05, top + h * 0.25, x + w, base);
      ctx.moveTo(x + w * 0.05, top);
      ctx.lineTo(x + w * 0.12, top - h * 0.16);
      ctx.lineTo(x + w * 0.2, top + h * 0.05);
      break;
    case 'crown':
      ctx.rect(x, top, w, h);
      ctx.rect(x + w * 0.1, top - w * 0.6, w * 0.8, w * 0.6);
      break;
    default:
      ctx.rect(x, top, w, h);
      ctx.rect(x + w * 0.2, top - 3, w * 0.35, 3);
  }
}

// Hochhaus in Gegenlicht-Silhouette mit Fensterpunkten und Sonnenkante rechts
function tower(ctx, rng, { x, w, h, style = 'box', tone, base = FAR_BASE }) {
  const top = base - h;
  ctx.save();
  towerPath(ctx, style, x, top, w, h, base);
  ctx.fillStyle = lin(ctx, x, 0, x + w, 0, [[0, tone.dark], [0.7, tone.mid], [1, tone.lit]]);
  ctx.fill();
  ctx.clip();
  // Etagenbänder
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = top + 3; y < base; y += 6) ctx.fillRect(x, y, w, 0.6);
  // Fenster
  ctx.fillStyle = tone.win;
  const cw = w > 18 ? 3.2 : 2.8;
  for (let y = top + 4; y < base - 3; y += 4.2) {
    for (let px = x + 1.6; px < x + w - 1.6; px += cw) {
      if (rng.chance(tone.lit2)) ctx.fillRect(px, y, 1.3, 1.7);
    }
  }
  // Glasschimmer der Abendsonne
  ctx.fillStyle = lin(ctx, 0, top - h * 0.3, 0, top + h * 0.6, [[0, 'rgba(255,180,140,0.38)'], [1, 'rgba(255,180,140,0)']]);
  ctx.fillRect(x - 2, top - h * 0.3, w + 4, h);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = tone.rim;
  if (style === 'box' || style === 'crown' || style === 'spire' || style === 'stepped') ctx.fillRect(x + w - 1.1, top, 1.1, h);
  ctx.restore();
  const tip = style === 'spire' ? top - h * 0.3 : style === 'point' ? top - w * 0.5 : style === 'crown' ? top - w * 0.6 : top;
  return { x: style === 'slope' ? x + w - 1 : x + w / 2, y: tip };
}

function buildRow(ctx, rng, zones, tone, styles, gapMin, gapMax, obst) {
  for (const z of zones) {
    let x = z.x0 + rng.range(0, gapMax);
    while (x < z.x1) {
      const w = rng.range(z.wMin ?? 11, z.wMax ?? 22);
      const h = rng.range(z.hMin, z.hMax);
      const style = rng.pick(styles);
      const t = tower(ctx, rng, { x, w, h, style, tone });
      if (obst && h > 125) obstLight(ctx, obst, t.x, t.y - 1, 0.9, rng.range(0, 1));
      x += w + rng.range(gapMin, gapMax);
    }
  }
}

function burjKhalifa(ctx, rng, cx, base, tip, D) {
  const H = base - tip;
  const left = [[0.13, 34], [0.235, 29], [0.335, 24.5], [0.43, 20.5], [0.51, 16.5], [0.585, 13], [0.64, 10], [0.685, 7.4]];
  const right = [[0.095, 33], [0.195, 28], [0.29, 23.5], [0.385, 19.5], [0.47, 15.5], [0.548, 12], [0.615, 9], [0.668, 6.8]];
  const coreTop = base - H * 0.735;
  const spireBase = base - H * 0.715;
  ctx.save();
  // Silhouette als Clip-Pfad
  const path = () => {
    ctx.beginPath();
    for (const [k, wl] of left) ctx.rect(cx - wl, base - H * k, wl + 0.5, H * k);
    for (const [k, wr] of right) ctx.rect(cx - 0.5, base - H * k, wr + 0.5, H * k);
    ctx.rect(cx - 5.2, coreTop, 10.4, base - coreTop);
    ctx.moveTo(cx - 3.4, spireBase);
    ctx.lineTo(cx - 0.55, tip + 4);
    ctx.lineTo(cx, tip);
    ctx.lineTo(cx + 0.55, tip + 4);
    ctx.lineTo(cx + 3.4, spireBase);
  };
  // Schattenseite links, Stufen einzeln schattiert
  for (const [k, wl] of left) {
    ctx.fillStyle = lin(ctx, cx - wl, 0, cx, 0, [[0, '#2e2146'], [0.35, '#45335f'], [1, '#5d4677']]);
    ctx.fillRect(cx - wl, base - H * k, wl + 0.5, H * k);
  }
  // Sonnenseite rechts mit leuchtenden Kanten
  for (const [k, wr] of right) {
    ctx.fillStyle = lin(ctx, cx, 0, cx + wr, 0, [[0, '#5d4677'], [0.72, '#8d6690'], [0.93, '#e7a08f'], [1, '#ffc9a6']]);
    ctx.fillRect(cx - 0.5, base - H * k, wr + 0.5, H * k);
  }
  ctx.fillStyle = lin(ctx, cx - 5.2, 0, cx + 5.2, 0, [[0, '#4a3866'], [0.6, '#8a6893'], [1, '#ffd0ae']]);
  ctx.fillRect(cx - 5.2, coreTop, 10.4, base - coreTop - H * 0.6);
  ctx.beginPath();
  ctx.moveTo(cx - 3.4, spireBase);
  ctx.lineTo(cx - 0.55, tip + 4);
  ctx.lineTo(cx, tip);
  ctx.lineTo(cx + 0.55, tip + 4);
  ctx.lineTo(cx + 3.4, spireBase);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, cx - 3.4, 0, cx + 3.4, 0, [[0, '#5a4672'], [0.55, '#b98aa0'], [1, '#ffe1c4']]);
  ctx.fill();

  path();
  ctx.clip();
  // Letztes Sonnenlicht auf der oberen Hälfte
  ctx.fillStyle = lin(ctx, 0, tip, 0, base - H * 0.35, [[0, 'rgba(255,200,150,0.55)'], [0.6, 'rgba(255,170,130,0.22)'], [1, 'rgba(255,170,130,0)']]);
  ctx.fillRect(cx - 40, tip, 80, H);
  // Vertikale Lamellen
  ctx.fillStyle = 'rgba(255,230,220,0.12)';
  for (let x = cx - 33; x < cx + 33; x += 2.6) ctx.fillRect(x, tip, 0.45, H);
  // Etagenbänder
  ctx.fillStyle = 'rgba(30,15,45,0.12)';
  for (let y = coreTop; y < base; y += 5) ctx.fillRect(cx - 40, y, 80, 0.5);
  // Beleuchtete Fenster (unten dichter)
  ctx.fillStyle = 'rgba(255,214,150,0.85)';
  for (let i = 0; i < 260; i++) {
    const k = rng.next() ** 0.7;
    const y = base - 4 - k * H * 0.66;
    const x = cx + rng.range(-33, 33);
    ctx.fillRect(x, y, 1.1, 1.5);
  }
  ctx.restore();
  // Hindernisfeuer: Spitze und Absätze
  obstLight(ctx, D.obst, cx, tip + 1, 1.3, 0);
  obstLight(ctx, D.obst, cx, coreTop + 2, 1, 0.5);
  obstLight(ctx, D.obst, cx - 7, base - H * 0.685 + 2, 0.9, 0.25);
  obstLight(ctx, D.obst, cx + 6.5, base - H * 0.668 + 2, 0.9, 0.75);
  obstLight(ctx, D.obst, cx - 16, base - H * 0.51 + 2, 0.8, 0.4);
  obstLight(ctx, D.obst, cx + 15, base - H * 0.47 + 2, 0.8, 0.9);
}

function burjAlArab(ctx, x, base, h) {
  const top = base - h;
  ctx.save();
  // Insel + Brücke
  ctx.fillStyle = '#6d4a6a';
  ctx.beginPath();
  ctx.ellipse(x + h * 0.15, base + 1, h * 0.3, 4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#5a3c5c';
  ctx.fillRect(x - 70, base - 1, 70, 1.4);
  // Segel
  const sail = () => {
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x + 3, top + 10);
    ctx.bezierCurveTo(x + h * 0.25, top + h * 0.05, x + h * 0.46, top + h * 0.42, x + h * 0.33, base);
    ctx.closePath();
  };
  sail();
  ctx.fillStyle = lin(ctx, x, 0, x + h * 0.42, 0, [[0, '#d8a9bd'], [0.45, '#f4cfd0'], [0.85, '#ffe0cc'], [1, '#ffeedd']]);
  ctx.fill();
  ctx.save();
  sail();
  ctx.clip();
  ctx.strokeStyle = 'rgba(160,100,140,0.35)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 1; i < 18; i++) {
    const y = base - (i / 18) * h;
    ctx.moveTo(x, y);
    ctx.lineTo(x + h * 0.5, y - 2);
  }
  for (let i = 1; i < 4; i++) {
    const k = i / 4;
    ctx.moveTo(x + 2, top + 12);
    ctx.bezierCurveTo(x + h * 0.25 * k, top + h * 0.05, x + h * 0.46 * k, top + h * 0.42, x + h * 0.33 * k, base);
  }
  ctx.stroke();
  // Abendlicht und blaues Fußlicht
  ctx.fillStyle = lin(ctx, 0, top, 0, base, [[0, 'rgba(255,190,150,0.35)'], [0.7, 'rgba(255,190,150,0)'], [1, 'rgba(150,120,255,0.35)']]);
  ctx.fillRect(x - 5, top, h, h);
  ctx.restore();
  // Mast/Exoskelett
  ctx.strokeStyle = '#7a5577';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x - 1, base);
  ctx.lineTo(x + 2.5, top - h * 0.1);
  ctx.stroke();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = 'rgba(255,220,220,0.6)';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const y0 = base - (i / 10) * h * 0.95;
    const y1 = base - ((i + 1) / 10) * h * 0.95;
    ctx.moveTo(x - 3.5, y0);
    ctx.lineTo(x + 3, y1);
    ctx.moveTo(x + 3, y0);
    ctx.lineTo(x - 3.5, y1);
  }
  ctx.stroke();
  // Hubschrauberlandeplatz
  ctx.fillStyle = '#e9c4c8';
  ctx.beginPath();
  ctx.ellipse(x - 8, top + h * 0.2, 7, 1.6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7a5577';
  ctx.fillRect(x - 8, top + h * 0.2, 7, 1);
  ctx.restore();
  return { x: x + 2.5, y: top - h * 0.1 };
}

function emiratesTower(ctx, rng, x, w, h, tone) {
  const base = FAR_BASE;
  const top = base - h;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.lineTo(x, top + w * 1.25);
  ctx.lineTo(x + w * 0.8, top);
  ctx.lineTo(x + w, top + w * 0.25);
  ctx.lineTo(x + w, base);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, x, 0, x + w, 0, [[0, '#4d3a68'], [0.55, '#7f6491'], [0.85, '#c79aa8'], [1, '#ffd0b4']]);
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,240,230,0.14)';
  for (let px = x + 2; px < x + w; px += 2.4) ctx.fillRect(px, top, 0.4, h);
  ctx.fillStyle = tone.win;
  for (let y = top + w * 1.3; y < base - 3; y += 4) {
    for (let px = x + 1.5; px < x + w - 1.5; px += 2.6) if (rng.chance(0.24)) ctx.fillRect(px, y, 1.1, 1.6);
  }
  ctx.fillStyle = lin(ctx, 0, top, 0, top + h * 0.5, [[0, 'rgba(255,200,160,0.45)'], [1, 'rgba(255,200,160,0)']]);
  ctx.fillRect(x, top, w, h);
  ctx.restore();
  // Spitze
  ctx.save();
  ctx.strokeStyle = '#d9b2b2';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.8, top);
  ctx.lineTo(x + w * 0.8, top - h * 0.09);
  ctx.stroke();
  ctx.restore();
  return { x: x + w * 0.8, y: top - h * 0.09 };
}

function museumFuture(ctx, rng, cx, base, s) {
  ctx.save();
  // begrünter Hügel
  ctx.fillStyle = lin(ctx, 0, base - 10, 0, base, [[0, '#4f6a54'], [1, '#3b4a45']]);
  ctx.beginPath();
  ctx.ellipse(cx, base, s * 0.85, 9, 0, Math.PI, TAU);
  ctx.fill();
  const cy = base - s * 0.52;
  const ring = () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.6, s * 0.5, 0, 0, TAU);
    ctx.ellipse(cx + s * 0.05, cy - s * 0.04, s * 0.27, s * 0.22, 0, 0, TAU, true);
  };
  ring();
  ctx.fillStyle = lin(ctx, cx - s * 0.6, 0, cx + s * 0.6, 0, [[0, '#6d5a7e'], [0.5, '#b9a0b6'], [0.85, '#f2c9bd'], [1, '#ffe2cc']]);
  ctx.fill('evenodd');
  ctx.save();
  ring();
  ctx.clip('evenodd');
  // Kalligrafie-Fenster als leuchtende Schwünge
  ctx.strokeStyle = 'rgba(255,224,170,0.9)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 0; i < 46; i++) {
    const a = rng.range(0, TAU);
    const rr = rng.range(0.32, 0.56);
    const px = cx + Math.cos(a) * s * rr;
    const py = cy + Math.sin(a) * s * rr * 0.85;
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + rng.range(-3, 3), py - rng.range(1, 3), px + rng.range(-4, 4), py + rng.range(-1, 1));
  }
  ctx.stroke();
  ctx.fillStyle = lin(ctx, 0, cy - s * 0.5, 0, cy + s * 0.5, [[0, 'rgba(255,210,170,0.35)'], [1, 'rgba(60,30,80,0.25)']]);
  ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
  ctx.restore();
  ctx.restore();
}

function dubaiFrame(ctx, cx, base, h) {
  const w = 86;
  const col = 15;
  const x0 = cx - w / 2;
  const top = base - h;
  ctx.save();
  const gold = lin(ctx, 0, top, 0, base, [[0, '#ffe5a0'], [0.25, '#f0b85a'], [0.7, '#b9773c'], [1, '#7f4f3e']]);
  ctx.fillStyle = gold;
  ctx.fillRect(x0, top, col, h);
  ctx.fillRect(x0 + w - col, top, col, h);
  ctx.fillRect(x0, top, w, 13);
  ctx.fillRect(x0 + col - 1, base - 9, w - col * 2 + 2, 9);
  // Schatten-/Lichtkanten
  ctx.fillStyle = 'rgba(90,40,50,0.35)';
  ctx.fillRect(x0, top, 3, h);
  ctx.fillRect(x0 + w - col, top + 13, 3, h - 13);
  ctx.fillStyle = 'rgba(255,240,200,0.55)';
  ctx.fillRect(x0 + col - 1.2, top + 13, 1.2, h - 22);
  ctx.fillRect(x0 + w - 1.2, top, 1.2, h);
  ctx.fillRect(x0, top, w, 1);
  // Ornament-Raster
  ctx.strokeStyle = 'rgba(120,70,30,0.35)';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  for (const cxx of [x0 + 3, x0 + w - col + 3]) {
    for (let y = top + 16; y < base - 6; y += 6) {
      ctx.moveTo(cxx, y + 3);
      ctx.lineTo(cxx + 4.5, y);
      ctx.lineTo(cxx + 9, y + 3);
      ctx.lineTo(cxx + 4.5, y + 6);
      ctx.closePath();
    }
  }
  ctx.stroke();
  // Glasbrücke oben
  ctx.fillStyle = 'rgba(70,40,80,0.75)';
  ctx.fillRect(x0 + col, top + 4, w - col * 2, 5);
  ctx.fillStyle = 'rgba(255,220,160,0.9)';
  for (let x = x0 + col + 2; x < x0 + w - col - 2; x += 4) ctx.fillRect(x, top + 5.5, 2, 1.4);
  ctx.restore();
  return { top, x0, w };
}

function mosque(ctx, cx, base, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(cx - s * 0.5, base - s * 0.32, s, s * 0.32);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, base - s * 0.32);
  ctx.bezierCurveTo(cx - s * 0.33, base - s * 0.62, cx - s * 0.05, base - s * 0.66, cx, base - s * 0.76);
  ctx.bezierCurveTo(cx + s * 0.05, base - s * 0.66, cx + s * 0.33, base - s * 0.62, cx + s * 0.3, base - s * 0.32);
  ctx.fill();
  for (const dx of [-0.62, 0.54]) {
    const mx = cx + s * dx;
    ctx.fillRect(mx, base - s * 0.95, s * 0.08, s * 0.95);
    ctx.fillRect(mx - s * 0.02, base - s * 0.72, s * 0.12, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(mx - s * 0.01, base - s * 0.95);
    ctx.lineTo(mx + s * 0.04, base - s * 1.12);
    ctx.lineTo(mx + s * 0.09, base - s * 0.95);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,214,150,0.85)';
  for (let i = -3; i <= 3; i++) ctx.fillRect(cx + i * s * 0.12 - 0.6, base - s * 0.2, 1.2, 2.2);
  ctx.restore();
}

// Düne mit scharfem Kamm: links Schattenseite, rechts von der Abendsonne beleuchtet
function dune(ctx, rng, { cx, cy, wl, wr, base, lit, litLow, shade, ripple = true }) {
  const a = [cx - wl, base];
  const ca = [cx - wl * 0.45, cy + (base - cy) * 0.18];
  const b = [cx + wr, base];
  const cb = [cx + wr * 0.4, cy + (base - cy) * 0.08];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.quadraticCurveTo(ca[0], ca[1], cx, cy);
  ctx.quadraticCurveTo(cb[0], cb[1], b[0], b[1]);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, cy, 0, base, [[0, lit], [1, litLow]]);
  ctx.fill();
  // Schattenhang
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.quadraticCurveTo(ca[0], ca[1], cx, cy);
  ctx.quadraticCurveTo(cx - wl * 0.12, cy + (base - cy) * 0.55, cx - wl * 0.05, base);
  ctx.closePath();
  ctx.fillStyle = shade;
  ctx.fill();
  // Windrippel
  if (ripple) {
    ctx.strokeStyle = 'rgba(255,236,200,0.22)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const n = Math.round((base - cy) / 9);
    for (let i = 1; i <= n; i++) {
      const k = i / (n + 1);
      const y = cy + (base - cy) * k;
      const x0 = cx + wr * 0.05 + rng.range(0, 10) * k;
      const x1 = cx + wr * (0.3 + 0.6 * k) + rng.range(-10, 0);
      ctx.moveTo(x0, y);
      ctx.quadraticCurveTo((x0 + x1) / 2, y - 2.5, x1, y + 1.5);
    }
    ctx.stroke();
  }
  // Kammlinie
  ctx.strokeStyle = 'rgba(255,230,190,0.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  const p = qpt([cx, cy], cb, b, 0.35);
  ctx.moveTo(cx, cy);
  ctx.quadraticCurveTo((cx + p[0]) / 2, cy + 0.5, p[0], p[1]);
  ctx.stroke();
  ctx.restore();
  return { a, ca, b, cb, cx, cy };
}

// y-Wert der Dünenkontur an Stelle x (für Kamele/Laternen)
function duneY(d, x) {
  const seg = x <= d.cx ? [d.a, d.ca, [d.cx, d.cy]] : [[d.cx, d.cy], d.cb, d.b];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (qpt(seg[0], seg[1], seg[2], m)[0] < x) lo = m;
    else hi = m;
  }
  return qpt(seg[0], seg[1], seg[2], (lo + hi) / 2)[1];
}

function lowrise(ctx, rng, x0, x1, base, color, winA) {
  ctx.save();
  let x = x0;
  while (x < x1) {
    const w = rng.range(9, 30);
    const h = rng.range(5, 20);
    ctx.fillStyle = color;
    ctx.fillRect(x, base - h, w, h);
    if (rng.chance(0.15)) {
      ctx.beginPath();
      ctx.arc(x + w / 2, base - h, Math.min(w, 10) * 0.35, Math.PI, TAU);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255,212,140,${winA})`;
    for (let y = base - h + 2; y < base - 2; y += 3.5) {
      for (let px = x + 1.5; px < x + w - 1.5; px += 3) if (rng.chance(0.25)) ctx.fillRect(px, y, 1.2, 1.4);
    }
    x += w + rng.range(-2, 6);
  }
  ctx.restore();
}

function farPalm(ctx, x, base, h, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(0.8, h * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.quadraticCurveTo(x + h * 0.05, base - h * 0.5, x + h * 0.12, base - h);
  ctx.stroke();
  const tx = x + h * 0.12;
  const ty = base - h;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * h * 0.3, ty + Math.sin(a) * h * 0.3 - h * 0.05, tx + Math.cos(a) * h * 0.45, ty + Math.sin(a) * h * 0.18 + h * 0.18);
    ctx.quadraticCurveTo(tx + Math.cos(a) * h * 0.25, ty + Math.sin(a) * h * 0.15, tx, ty + 1);
    ctx.fill();
  }
  ctx.restore();
}

function paintFar(ctx, w, rng) {
  const D = resetDyn('far');
  // Ferne Dünen hinter der Stadt
  ctx.save();
  ctx.fillStyle = '#d98b85';
  ctx.beginPath();
  ctx.moveTo(560, 720);
  let y = 452;
  ctx.lineTo(560, y);
  for (let x = 560; x <= w + 40; x += 60) {
    const ny = 446 + rng.range(-6, 6) - (x > 1600 ? (x - 1600) * 0.12 : 0);
    ctx.quadraticCurveTo(x + 30, Math.min(y, ny) - 6, x + 60, ny);
    y = ny;
  }
  ctx.lineTo(w + 40, 720);
  ctx.fill();
  ctx.restore();
  // Rechts: Wüste mit großen Dünen
  for (const d of [
    { cx: 1560, cy: 436, wl: 120, wr: 110, base: 472 },
    { cx: 1712, cy: 386, wl: 130, wr: 160, base: 472 },
    { cx: 1640, cy: 418, wl: 90, wr: 70, base: 472 },
    { cx: 1800, cy: 404, wl: 90, wr: 120, base: 472 },
  ]) dune(ctx, rng, { ...d, lit: '#f5ae86', litLow: '#e09380', shade: '#b8707e', ripple: false });

  // Meer links (Jumeirah), spiegelt den Himmel
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, 444, 0, 474, [[0, '#ffd59a'], [0.3, '#f8a984'], [0.75, '#c86c80'], [1, '#9f5880']]);
  ctx.beginPath();
  ctx.moveTo(-10, 444);
  ctx.lineTo(700, 444);
  ctx.quadraticCurveTo(760, 446, 780, 474);
  ctx.lineTo(-10, 474);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,236,200,0.55)';
  for (let i = 0; i < 70; i++) {
    const yy = rng.range(446, 470);
    ctx.fillRect(rng.range(-10, 720), yy, rng.range(4, 26) * (1 - (yy - 446) / 40), 0.6);
  }
  ctx.restore();
  for (let i = 0; i < 36; i++) {
    D.bulbs.push({ x: rng.range(0, 700), y: rng.range(447, 466), c: C.white, r: 0.5, p: rng.range(0, TAU), s: rng.range(2, 5) });
  }

  // Hintere Skyline (dunstig)
  buildRow(ctx, rng, [
    { x0: -10, x1: 210, hMin: 70, hMax: 170 },
    { x0: 560, x1: 900, hMin: 50, hMax: 130 },
    { x0: 900, x1: 1180, hMin: 60, hMax: 150 },
    { x0: 1180, x1: 1490, hMin: 40, hMax: 115 },
  ], TONES.back, ['box', 'box', 'spire', 'slope', 'round', 'crown', 'point'], 2, 12, null);

  // Mittlere Reihe
  buildRow(ctx, rng, [
    { x0: -10, x1: 190, hMin: 60, hMax: 150, wMin: 13, wMax: 22 },
    { x0: 700, x1: 880, hMin: 40, hMax: 110 },
    { x0: 880, x1: 1170, hMin: 40, hMax: 120 },
    { x0: 1170, x1: 1480, hMin: 35, hMax: 105 },
  ], TONES.mid, ['box', 'stepped', 'spire', 'slope', 'crown', 'round', 'box'], 6, 26, D.obst);

  // Dubai Marina: Princess-Tower-artige Nadel und verdrehter Turm
  let t = tower(ctx, rng, { x: 38, w: 20, h: 206, style: 'spire', tone: TONES.front });
  obstLight(ctx, D.obst, t.x, t.y, 1, 0.3);
  t = tower(ctx, rng, { x: 112, w: 18, h: 178, style: 'twist', tone: TONES.front });
  obstLight(ctx, D.obst, t.x, t.y, 0.9, 0.7);
  tower(ctx, rng, { x: 4, w: 17, h: 120, style: 'round', tone: TONES.front });
  tower(ctx, rng, { x: 78, w: 16, h: 128, style: 'slope', tone: TONES.front });
  tower(ctx, rng, { x: 150, w: 22, h: 96, style: 'box', tone: TONES.front });

  // Burj Al Arab im Meer
  const ba = burjAlArab(ctx, 318, 462, 150);
  obstLight(ctx, D.obst, ba.x, ba.y, 0.9, 0.15);
  // Küste: Moschee, Villen, Palmen
  mosque(ctx, 548, 468, 30, '#5d3f66');
  lowrise(ctx, rng, 180, 300, FAR_BASE, '#5c3f66', 0.6);
  lowrise(ctx, rng, 470, 760, FAR_BASE, '#553a63', 0.75);
  for (let x = 196; x < 300; x += rng.range(12, 26)) farPalm(ctx, x, 468, rng.range(10, 15), '#4a3158');
  for (let x = 610; x < 760; x += rng.range(14, 30)) farPalm(ctx, x, 466, rng.range(10, 16), '#47305a');

  // Sheikh Zayed Road: Emirates-Towers-artiges Zwillingspaar und Museum der Zukunft
  tower(ctx, rng, { x: 590, w: 18, h: 128, style: 'sail', tone: TONES.front });
  let e = emiratesTower(ctx, rng, 636, 22, 212, TONES.front);
  obstLight(ctx, D.obst, e.x, e.y, 1, 0.55);
  e = emiratesTower(ctx, rng, 668, 19, 176, TONES.front);
  obstLight(ctx, D.obst, e.x, e.y, 0.9, 0.05);
  museumFuture(ctx, rng, 735, FAR_BASE - 1, 46);
  tower(ctx, rng, { x: 784, w: 20, h: 150, style: 'crown', tone: TONES.front });
  tower(ctx, rng, { x: 822, w: 16, h: 118, style: 'point', tone: TONES.front });
  tower(ctx, rng, { x: 852, w: 22, h: 98, style: 'box', tone: TONES.front });

  // Downtown mit Burj Khalifa
  t = tower(ctx, rng, { x: 918, w: 20, h: 172, style: 'stepped', tone: TONES.front });
  obstLight(ctx, D.obst, t.x, t.y, 0.9, 0.2);
  tower(ctx, rng, { x: 946, w: 15, h: 112, style: 'round', tone: TONES.front });
  burjKhalifa(ctx, rng, 1010, FAR_BASE, 40, D);
  t = tower(ctx, rng, { x: 1060, w: 19, h: 160, style: 'point', tone: TONES.front });
  obstLight(ctx, D.obst, t.x, t.y, 0.9, 0.6);
  tower(ctx, rng, { x: 1088, w: 24, h: 104, style: 'slope', tone: TONES.front });
  tower(ctx, rng, { x: 1128, w: 17, h: 132, style: 'spire', tone: TONES.front });
  // Business Bay
  tower(ctx, rng, { x: 1196, w: 22, h: 118, style: 'crown', tone: TONES.front });
  tower(ctx, rng, { x: 1236, w: 16, h: 92, style: 'round', tone: TONES.front });
  t = tower(ctx, rng, { x: 1290, w: 20, h: 140, style: 'sail', tone: TONES.front });
  obstLight(ctx, D.obst, t.x, t.y, 0.9, 0.35);
  tower(ctx, rng, { x: 1332, w: 26, h: 84, style: 'box', tone: TONES.front });
  tower(ctx, rng, { x: 1384, w: 15, h: 110, style: 'point', tone: TONES.front });
  tower(ctx, rng, { x: 1418, w: 22, h: 72, style: 'stepped', tone: TONES.front });

  // Dubai Frame im Zabeel-Park
  dubaiFrame(ctx, 1556, FAR_BASE, 148);
  for (let x = 1480; x < 1640; x += rng.range(9, 18)) farPalm(ctx, x, 470, rng.range(9, 16), '#4c3459');

  // Flache Stadt im Vordergrund
  lowrise(ctx, rng, 760, 1500, FAR_BASE + 2, '#4b3360', 0.8);
  lowrise(ctx, rng, -10, 200, FAR_BASE + 2, '#4b3360', 0.8);
  for (let x = 770; x < 1480; x += rng.range(30, 70)) farPalm(ctx, x, 471, rng.range(9, 14), '#3f2b52');

  // Dunst über den Fußpunkten
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = lin(ctx, 0, 300, 0, 474, [[0, 'rgba(255,170,140,0)'], [0.7, 'rgba(255,170,140,0.12)'], [1, 'rgba(255,186,150,0.42)']]);
  ctx.fillRect(-10, 300, w + 20, 180);
  ctx.restore();
}

// --- Mittlere Ebene: Flughafen ----------------------------------------------

function palm(ctx, rng, x, baseY, h, o = {}) {
  const lean = o.lean ?? 0.1;
  const tw = o.trunkW ?? h * 0.05;
  const A = [x, baseY];
  const B = [x + h * lean, baseY - h];
  const Cc = [x + h * lean * 0.1, baseY - h * 0.5];
  const N = 16;
  const L = [];
  const R = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [px, py] = qpt(A, Cc, B, t);
    const half = tw * 0.5 * (1 - 0.38 * t) + (t < 0.1 ? tw * 0.35 * (0.1 - t) / 0.1 : 0);
    L.push([px - half, py]);
    R.push([px + half, py]);
  }
  ctx.save();
  // Stamm
  ctx.beginPath();
  L.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
  for (let i = N; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
  ctx.fillStyle = o.trunk ?? '#4a3236';
  ctx.fill();
  ctx.strokeStyle = o.rim ?? 'rgba(255,160,110,0.6)';
  ctx.lineWidth = tw * 0.22;
  ctx.beginPath();
  R.forEach(([a, b], i) => (i ? ctx.lineTo(a - tw * 0.1, b) : ctx.moveTo(a - tw * 0.1, b)));
  ctx.stroke();
  // Ringe
  ctx.strokeStyle = 'rgba(25,12,20,0.4)';
  ctx.lineWidth = Math.max(0.4, tw * 0.1);
  ctx.beginPath();
  const rings = Math.round(h / (tw * 0.7));
  for (let i = 1; i < rings; i++) {
    const t = i / rings;
    const [px, py] = qpt(A, Cc, B, t);
    const half = tw * 0.5 * (1 - 0.38 * t);
    ctx.moveTo(px - half, py);
    ctx.quadraticCurveTo(px, py + tw * 0.3, px + half, py - tw * 0.05);
  }
  ctx.stroke();

  // Lichterkette als Spirale um den Stamm
  const bulbs = o.bulbs;
  const colors = o.colors ?? [C.warm];
  if (bulbs) {
    const turns = h / (tw * 2.6);
    const count = Math.round(turns * 7);
    for (let i = 0; i < count; i++) {
      const t = 0.05 + (i / count) * 0.86;
      const th = t * turns * TAU;
      const front = Math.cos(th);
      if (front < -0.15) continue;
      const [px, py] = qpt(A, Cc, B, t);
      const half = tw * 0.5 * (1 - 0.38 * t);
      bulb(ctx, bulbs, rng, px + Math.sin(th) * half * 1.05, py + front * tw * 0.12, colors[i % colors.length], o.bulbR ?? 1);
    }
  }

  // Wedel
  const [tx, ty] = B;
  const nf = o.fronds ?? 13;
  const fronds = [];
  for (let i = 0; i < nf; i++) {
    const a = -Math.PI - 0.55 + (i / (nf - 1)) * (Math.PI + 1.1) + rng.range(-0.1, 0.1);
    // steil aufragende Wedel kürzer, damit die Krone rund statt stachelig wirkt
    const up = Math.max(0, -Math.sin(a) - 0.5) * 2;
    fronds.push({ a, len: h * rng.range(0.34, 0.46) * (o.frondScale ?? 1) * (1 - 0.3 * up), back: Math.sin(a) < -0.6, up });
  }
  fronds.sort((f1, f2) => (f1.back === f2.back ? 0 : f1.back ? -1 : 1));
  const leafA = o.leaf ?? '#2c4034';
  const leafB = o.leafDark ?? '#1f2c27';
  const lightFronds = [];
  for (const f of fronds) {
    const ca = Math.cos(f.a);
    const sa = Math.sin(f.a);
    const S = [tx, ty];
    // aufragende Wedel nach außen überbiegen
    const bend = (ca < 0 ? -1 : 1) * f.up * f.len;
    const E = [tx + ca * f.len + bend * 0.42, ty + sa * f.len * 0.5 + f.len * 0.45 * Math.abs(ca) + f.len * 0.12 + f.up * f.len * 0.3];
    const Cf = [tx + ca * f.len * 0.6 + bend * 0.2, ty + sa * f.len * 0.72 - f.len * 0.18];
    const col = f.back ? leafB : leafA;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.5, tw * 0.17);
    ctx.beginPath();
    ctx.moveTo(S[0], S[1]);
    ctx.quadraticCurveTo(Cf[0], Cf[1], E[0], E[1]);
    ctx.stroke();
    // Fiederblätter als hängende Striche
    ctx.lineWidth = Math.max(0.45, tw * 0.12);
    ctx.beginPath();
    const M = Math.max(10, Math.round(f.len / (tw * 0.32)));
    for (let i = 1; i <= M; i++) {
      const t = 0.06 + (i / M) * 0.92;
      const p = qpt(S, Cf, E, t);
      const p2 = qpt(S, Cf, E, Math.min(1, t + 0.02));
      let dx = p2[0] - p[0];
      let dy = p2[1] - p[1];
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const ll = f.len * (0.04 + 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.08)) ** 0.7);
      for (const side of [-1, 1]) {
        let lx = -dy * side * 0.85 + dx * 0.5;
        let ly = dx * side * 0.85 + dy * 0.5 + 0.55;
        const n = Math.hypot(lx, ly) || 1;
        lx /= n;
        ly /= n;
        ctx.moveTo(p[0], p[1]);
        ctx.quadraticCurveTo(p[0] + lx * ll * 0.6, p[1] + ly * ll * 0.35, p[0] + lx * ll, p[1] + ly * ll + ll * 0.3);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = o.leafRim ?? 'rgba(255,170,120,0.45)';
    ctx.lineWidth = Math.max(0.35, tw * 0.07);
    ctx.beginPath();
    ctx.moveTo(S[0], S[1] - tw * 0.05);
    ctx.quadraticCurveTo(Cf[0], Cf[1] - tw * 0.08, E[0], E[1]);
    ctx.stroke();
    if (!f.back && Math.abs(ca) > 0.45) lightFronds.push([S, Cf, E]);
  }
  // Kronenansatz
  ctx.fillStyle = leafB;
  ctx.beginPath();
  ctx.ellipse(tx, ty + tw * 0.2, tw * 0.75, tw * 0.55, 0, 0, TAU);
  ctx.fill();
  // Datteln
  ctx.fillStyle = '#7a3f28';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(tx + rng.range(-tw * 0.7, tw * 0.7), ty + tw * 0.4 + rng.range(0, tw * 0.6), tw * 0.22, 0, TAU);
    ctx.fill();
  }
  // Lichter in einigen Wedeln
  if (bulbs && o.frondLights !== false) {
    for (const [S, Cf, E] of lightFronds.slice(0, 4)) {
      for (let t = 0.2; t <= 0.95; t += 0.12) {
        const p = qpt(S, Cf, E, t);
        bulb(ctx, bulbs, rng, p[0], p[1] + 1, colors[Math.floor(t * 20) % colors.length], (o.bulbR ?? 1) * 0.9);
      }
    }
  }
  ctx.restore();
}

function goldTree(ctx, rng, x, base, h, M) {
  ctx.save();
  // Sockel
  ctx.fillStyle = lin(ctx, x - 20, 0, x + 20, 0, [[0, '#8a6a70'], [0.6, '#e8d2c8'], [1, '#fff0e2']]);
  ctx.beginPath();
  ctx.moveTo(x - h * 0.16, base);
  ctx.lineTo(x - h * 0.13, base - h * 0.08);
  ctx.lineTo(x + h * 0.13, base - h * 0.08);
  ctx.lineTo(x + h * 0.16, base);
  ctx.fill();
  ctx.fillStyle = '#d9a640';
  ctx.fillRect(x - h * 0.135, base - h * 0.065, h * 0.27, 1.2);
  // Etagen
  const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const k = i / tiers;
    const ty = base - h * 0.07 - k * h * 0.74;
    const tw = h * 0.33 * (1 - k * 0.8);
    const th = h * 0.27;
    ctx.beginPath();
    ctx.moveTo(x - tw, ty);
    ctx.quadraticCurveTo(x - tw * 0.35, ty - th * 0.45, x, ty - th);
    ctx.quadraticCurveTo(x + tw * 0.35, ty - th * 0.45, x + tw, ty);
    ctx.quadraticCurveTo(x, ty + h * 0.035, x - tw, ty);
    ctx.fillStyle = lin(ctx, x - tw, 0, x + tw, 0, [[0, '#8a5a22'], [0.45, '#d9a23c'], [0.8, '#ffd877'], [1, '#fff0b8']]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,190,0.5)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x - tw, ty);
    ctx.quadraticCurveTo(x, ty + h * 0.035, x + tw, ty);
    ctx.stroke();
  }
  // Kugeln
  const cols = ['#c81e34', '#fff4e0', '#8b1c4c', '#c81e34'];
  for (let i = 0; i < 26; i++) {
    const k = rng.range(0.05, 0.8);
    const y = base - h * 0.08 - k * h * 0.78;
    const half = h * 0.3 * (1 - k * 0.92);
    const bx = x + rng.range(-half, half);
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.arc(bx, y, h * 0.022, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(bx + h * 0.004, y - h * 0.014, h * 0.008, h * 0.008);
  }
  // Lichterspirale
  const turns = 4.5;
  for (let i = 0; i < 70; i++) {
    const s = i / 70;
    const th = s * turns * TAU;
    const front = Math.cos(th);
    if (front < 0) continue;
    const y = base - h * 0.09 - s * h * 0.76 + front * h * 0.02;
    const half = h * 0.31 * (1 - s * 0.88);
    bulb(ctx, M.bulbs, rng, x + Math.sin(th) * half, y, C.warm, 0.8);
  }
  // Stern
  const sy = base - h * 0.9;
  glow(ctx, x, sy, h * 0.25, 'rgba(255,220,140,0.6)');
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? h * 0.025 : h * 0.06;
    ctx.lineTo(x + Math.cos(a) * r, sy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  M.star = { x, y: sy, r: h * 0.13 };
}

function dxbTower(ctx, x, base, M) {
  ctx.save();
  // Sockelbau
  ctx.fillStyle = lin(ctx, 0, 470, 0, base, [[0, '#9b7d8e'], [1, '#7a5f72']]);
  ctx.fillRect(x - 44, 472, 92, base - 472);
  ctx.fillStyle = '#f6dccf';
  ctx.fillRect(x - 46, 470, 96, 3);
  ctx.fillStyle = lin(ctx, 0, 476, 0, 490, [[0, '#ffdca0'], [1, '#e8a87a']]);
  ctx.fillRect(x - 40, 477, 84, 12);
  ctx.fillStyle = 'rgba(70,40,60,0.6)';
  for (let px = x - 40; px < x + 44; px += 6) ctx.fillRect(px, 477, 0.8, 12);

  // Segelartige Finne entlang des Schafts
  ctx.beginPath();
  ctx.moveTo(x + 6, 472);
  ctx.bezierCurveTo(x + 30, 420, x + 30, 330, x + 7, 272);
  ctx.lineTo(x + 5, 272);
  ctx.lineTo(x + 5, 472);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, x + 5, 0, x + 26, 0, [[0, '#d7b3b8'], [0.6, '#f9dccf'], [1, '#ffe9d8']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,100,120,0.35)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 1; i < 6; i++) {
    const k = i / 6;
    ctx.moveTo(x + 6, 472);
    ctx.bezierCurveTo(x + 6 + 24 * k, 420, x + 6 + 24 * k, 330, x + 7, 272);
  }
  ctx.stroke();
  // Schaft
  ctx.beginPath();
  ctx.moveTo(x - 9, 472);
  ctx.lineTo(x - 7, 268);
  ctx.lineTo(x + 7, 268);
  ctx.lineTo(x + 9, 472);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, x - 9, 0, x + 9, 0, [[0, '#a98d9e'], [0.5, '#e6cfcb'], [1, '#fff1e6']]);
  ctx.fill();
  // Aufzugs-Glasband
  ctx.fillStyle = lin(ctx, 0, 270, 0, 470, [[0, '#4a3858'], [1, '#6e5470']]);
  ctx.fillRect(x - 4.5, 280, 3, 186);
  ctx.fillStyle = 'rgba(255,220,160,0.85)';
  for (let y = 286; y < 466; y += 11) ctx.fillRect(x - 4, y, 2, 1.5);
  // Kragen
  poly(ctx, [[x - 8, 270], [x + 8, 270], [x + 25, 255], [x - 25, 255]]);
  ctx.fillStyle = lin(ctx, x - 25, 0, x + 25, 0, [[0, '#b297a4'], [0.6, '#ecd7d0'], [1, '#fff3e8']]);
  ctx.fill();
  // Kanzel (nach außen geneigtes Glas)
  poly(ctx, [[x - 25, 255], [x + 25, 255], [x + 29, 233], [x - 29, 233]]);
  ctx.fillStyle = lin(ctx, 0, 233, 0, 255, [[0, '#8e5d86'], [0.5, '#4b3a62'], [1, '#2f2944']]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,190,150,0.35)';
  poly(ctx, [[x + 8, 255], [x + 18, 255], [x + 24, 233], [x + 14, 233]]);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,20,40,0.7)';
  for (let i = -4; i <= 4; i++) ctx.fillRect(x + i * 6.2 - 0.4, 234, 0.8, 21);
  ctx.fillStyle = 'rgba(120,255,170,0.35)';
  ctx.fillRect(x - 24, 251, 48, 1);
  // Dach + Segelfinne
  ctx.fillStyle = lin(ctx, x - 31, 0, x + 31, 0, [[0, '#c4a8b2'], [0.6, '#f6e2da'], [1, '#fff6ee']]);
  ctx.fillRect(x - 31, 229, 62, 4.5);
  ctx.beginPath();
  ctx.moveTo(x + 15, 229);
  ctx.quadraticCurveTo(x + 22, 218, x + 32, 204);
  ctx.quadraticCurveTo(x + 31, 218, x + 30, 229);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, x + 15, 0, x + 32, 0, [[0, '#d9bcc4'], [1, '#fff3ea']]);
  ctx.fill();
  // Antenne
  ctx.fillStyle = '#6e5468';
  ctx.fillRect(x - 21, 200, 1.4, 29);
  ctx.fillRect(x - 24, 214, 7, 0.8);
  ctx.restore();
  M.beacon = { x: x - 20.3, y: 199 };
  obstLight(ctx, M.obst, x + 32, 205, 0.9, 0.2);
}

function hangar(ctx, rng, x, w, h, open, M, label) {
  const base = TERM_BASE;
  const top = base - h;
  ctx.save();
  // Seitenanbau mit Büros
  ctx.fillStyle = lin(ctx, 0, base - h * 0.48, 0, base, [[0, '#9a7a88'], [1, '#7c6070']]);
  ctx.fillRect(x + w - 6, base - h * 0.46, 28, h * 0.46);
  ctx.fillStyle = '#f2d6c8';
  ctx.fillRect(x + w - 7, base - h * 0.46 - 1.5, 30, 2);
  ctx.fillStyle = 'rgba(255,214,150,0.85)';
  for (let y = base - h * 0.4; y < base - 5; y += 7) for (let px = x + w; px < x + w + 18; px += 5) if (rng.chance(0.65)) ctx.fillRect(px, y, 3, 3);
  // Korpus mit Wellblech
  ctx.fillStyle = lin(ctx, 0, top, 0, base, [[0, '#c29ea4'], [1, '#937483']]);
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = 'rgba(80,50,70,0.18)';
  for (let px = x + 2; px < x + w; px += 3) ctx.fillRect(px, top, 0.5, h);
  ctx.fillStyle = '#fbe2d4';
  ctx.fillRect(x - 2, top - 2, w + 4, 3);
  ctx.fillStyle = 'rgba(255,200,170,0.5)';
  ctx.fillRect(x, top + 1, w, 1.5);
  // Oberlichtband
  ctx.fillStyle = lin(ctx, 0, top + 4, 0, top + 10, [[0, '#ffe3b0'], [1, '#f2b07c']]);
  ctx.fillRect(x + 4, top + 4, w - 8, 6);
  ctx.fillStyle = 'rgba(70,40,60,0.6)';
  for (let px = x + 4; px < x + w - 4; px += 7) ctx.fillRect(px, top + 4, 0.7, 6);
  // Fachwerk-Blende mit Schild
  ctx.fillStyle = '#5f4a5d';
  ctx.fillRect(x + 4, top + 12, w - 8, 13);
  ctx.strokeStyle = 'rgba(255,220,200,0.22)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let px = x + 4; px < x + w - 12; px += 12) {
    ctx.moveTo(px, top + 25);
    ctx.lineTo(px + 6, top + 12);
    ctx.lineTo(px + 12, top + 25);
  }
  ctx.stroke();
  ctx.fillStyle = '#efe2da';
  ctx.fillRect(x + w / 2 - 26, top + 14, 52, 9);
  ctx.fillStyle = '#4a3446';
  ctx.font = 'bold 6.6px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, top + 18.8);
  // Tore
  const dx0 = x + 8;
  const dw = w - 16;
  const panels = 8;
  const pw = dw / panels;
  const doorTop = top + 27;
  if (open) {
    const ox = dx0 + pw * 3;
    const ow = pw * 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, doorTop, ow, base - doorTop);
    ctx.clip();
    ctx.fillStyle = lin(ctx, 0, doorTop, 0, base, [[0, '#fff0cc'], [0.55, '#f9d29a'], [1, '#e7a97c']]);
    ctx.fillRect(ox, doorTop, ow, base - doorTop);
    // Hallenrückwand mit Fachwerk
    ctx.strokeStyle = 'rgba(150,100,90,0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let px = ox - 6; px < ox + ow; px += 12) {
      ctx.moveTo(px, doorTop + 2);
      ctx.lineTo(px + 6, doorTop + 12);
      ctx.lineTo(px + 12, doorTop + 2);
    }
    ctx.moveTo(ox, doorTop + 12);
    ctx.lineTo(ox + ow, doorTop + 12);
    ctx.stroke();
    // Großraumflugzeug in der Wartung: Heck mit Seitenleitwerk, Rumpf ragt nach rechts aus dem Bild
    const fy = base - 23;
    ctx.fillStyle = lin(ctx, 0, fy - 9, 0, fy + 9, [[0, '#fbf3ea'], [0.6, '#e6d8cf'], [1, '#bfa9a8']]);
    ctx.beginPath();
    ctx.moveTo(ox + ow + 4, fy - 8);
    ctx.lineTo(ox + ow * 0.3, fy - 8);
    ctx.quadraticCurveTo(ox + ow * 0.08, fy - 7, ox + 2, fy - 2);
    ctx.lineTo(ox + ow * 0.32, fy + 7);
    ctx.lineTo(ox + ow + 4, fy + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(80,60,80,0.75)';
    for (let px = ox + ow * 0.42; px < ox + ow; px += 3) ctx.fillRect(px, fy - 4.2, 1.2, 1.6);
    ctx.fillStyle = lin(ctx, ox + 4, 0, ox + ow * 0.4, 0, [[0, '#155f68'], [1, '#2a8f97']]);
    poly(ctx, [[ox + 3, fy - 3], [ox + ow * 0.1, doorTop + 6], [ox + ow * 0.28, doorTop + 6], [ox + ow * 0.42, fy - 8]]);
    ctx.fill();
    ctx.fillStyle = '#f2c445';
    poly(ctx, [[ox + ow * 0.16, fy - 18], [ox + ow * 0.2, doorTop + 12], [ox + ow * 0.25, doorTop + 12], [ox + ow * 0.24, fy - 18]]);
    ctx.fill();
    // Arbeitsbühne mit Geländer
    ctx.fillStyle = '#d9a640';
    ctx.fillRect(ox, fy - 11, ow * 0.55, 1.6);
    ctx.fillRect(ox + ow * 0.5, fy + 10, ow * 0.5, 1.6);
    ctx.strokeStyle = '#b8862e';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const [x0, y0, len] of [[ox, fy - 11, ow * 0.55], [ox + ow * 0.5, fy + 10, ow * 0.5]]) {
      ctx.moveTo(x0, y0 - 4);
      ctx.lineTo(x0 + len, y0 - 4);
      for (let px = x0 + 2; px < x0 + len; px += 5) {
        ctx.moveTo(px, y0);
        ctx.lineTo(px, y0 - 4);
      }
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(90,60,80,0.55)';
    ctx.fillRect(ox + 4, fy - 9.4, 1.2, base - fy + 9);
    ctx.fillRect(ox + ow - 6, fy + 11.6, 1.2, base - fy - 11.6);
    // Hallenstrahler und Glanz auf dem Boden
    ctx.fillStyle = 'rgba(255,255,240,0.95)';
    for (let i = 0; i < 4; i++) ctx.fillRect(ox + 4 + (i * (ow - 8)) / 3, doorTop + 1.5, 3, 1);
    ctx.fillStyle = 'rgba(255,244,220,0.45)';
    ctx.fillRect(ox, base - 3, ow, 3);
    ctx.restore();
  }
  for (let i = 0; i < panels; i++) {
    if (open && (i === 3 || i === 4)) continue;
    let px = dx0 + i * pw;
    if (open && i === 2) px -= pw * 0.7;
    if (open && i === 5) px += pw * 0.7;
    ctx.fillStyle = lin(ctx, px, 0, px + pw, 0, [[0, i % 2 ? '#dbc5c1' : '#d2bab8'], [1, '#b89ea3']]);
    ctx.fillRect(px + 0.4, doorTop, pw - 0.8, base - doorTop);
    ctx.fillStyle = 'rgba(90,60,80,0.22)';
    for (let k = 1; k < 5; k++) ctx.fillRect(px + (k * pw) / 5, doorTop, 0.5, base - doorTop);
    ctx.fillStyle = 'rgba(255,230,190,0.55)';
    ctx.fillRect(px + 2, doorTop + 3, pw - 4, 2);
    ctx.fillStyle = 'rgba(70,40,60,0.3)';
    ctx.fillRect(px + 0.4, base - 7, pw - 0.8, 7);
  }
  ctx.fillStyle = '#4f3a4a';
  ctx.fillRect(dx0 - 1, doorTop - 1, dw + 2, 1.4);
  if (!open) {
    // Personaltür
    ctx.fillStyle = lin(ctx, 0, base - 13, 0, base, [[0, '#ffe2a8'], [1, '#e9a273']]);
    ctx.fillRect(dx0 + dw - 16, base - 13, 7, 13);
  }
  ctx.fillStyle = 'rgba(60,35,55,0.35)';
  ctx.fillRect(x, base - 3, w, 3);
  // Lichterkette an der Dachkante
  for (let px = x + 4; px < x + w - 2; px += 8) bulb(ctx, M.bulbs, rng, px, top + 2.5 + Math.sin(((px - x) / 32) * Math.PI) ** 2 * 1.5, ((px - x) / 8) % 3 < 1 ? C.gold : C.warm, 0.65);
  ctx.restore();
  obstLight(ctx, M.obst, x + 2, top - 2, 0.9, rng.next());
  obstLight(ctx, M.obst, x + w - 2, top - 2, 0.9, rng.next());
}

// Flughafenfeuerwache mit Wachturm rechts (flaches Turmdach = Versteck)
function fireStation(ctx, rng, x, w, M) {
  const base = TERM_BASE;
  const top = base - 42;
  const tw = 40;
  const tx = x + w - tw;
  const tTop = FIRE_TOWER_Y;
  ctx.save();
  // Wachturm
  ctx.fillStyle = lin(ctx, tx, 0, tx + tw, 0, [[0, '#b58f88'], [0.7, '#dcb6a2'], [1, '#f2cdb2']]);
  ctx.fillRect(tx, tTop, tw, base - tTop);
  ctx.fillStyle = '#fbe4d6';
  ctx.fillRect(tx - 2, tTop - 2, tw + 4, 3);
  ctx.fillStyle = 'rgba(70,35,45,0.3)';
  ctx.fillRect(tx - 2, tTop + 1, tw + 4, 1.2);
  // Rundum verglaste Wachstube
  ctx.fillStyle = lin(ctx, 0, tTop + 4, 0, tTop + 14, [[0, '#ffe6b4'], [1, '#f0a676']]);
  ctx.fillRect(tx + 3, tTop + 4, tw - 6, 10);
  ctx.fillStyle = 'rgba(70,40,60,0.6)';
  for (let px = tx + 3; px <= tx + tw - 3; px += 6.8) ctx.fillRect(px - 0.4, tTop + 4, 0.8, 10);
  ctx.fillStyle = 'rgba(80,45,65,0.55)';
  ctx.fillRect(tx + 9, tTop + 8, 1.4, 6);
  ctx.beginPath();
  ctx.arc(tx + 9.7, tTop + 7, 1.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,150,0.85)';
  for (const fy of [top + 14, top + 26]) ctx.fillRect(tx + 8, fy, 4, 5);
  // Rotes Band mit Schriftzug, Lichterkette an der Hallenkante
  ctx.fillStyle = lin(ctx, 0, top, 0, base, [[0, '#d7b09e'], [1, '#b08a85']]);
  ctx.fillRect(x, top, w - tw, base - top);
  ctx.fillStyle = '#fbe4d6';
  ctx.fillRect(x - 2, top - 2, w - tw + 2, 3);
  ctx.fillStyle = '#c8323b';
  ctx.fillRect(x, top + 3.5, w, 6);
  ctx.fillStyle = 'rgba(255,220,200,0.45)';
  ctx.fillRect(x, top + 3.5, w, 0.7);
  ctx.fillStyle = '#fff6ee';
  ctx.font = 'bold 4.6px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FEUERWACHE', x + (w - tw) / 2, top + 6.7);
  for (let px = x + 3; px < x + w - tw - 2; px += 7) {
    bulb(ctx, M.bulbs, rng, px, top + 0.8 + Math.sin(((px - x) / 21) * Math.PI) ** 2 * 1.2, ((px - x) / 7) % 2 < 1 ? C.red : C.warm, 0.6);
  }
  // Tore
  const n = 4;
  const gw = (w - tw - 14) / n;
  for (let i = 0; i < n; i++) {
    const gx = x + 8 + i * gw + 2;
    if (i === 1) {
      ctx.fillStyle = lin(ctx, 0, top + 12, 0, base, [[0, '#ffe5b8'], [1, '#e3a97f']]);
      ctx.fillRect(gx, top + 12, gw - 4, base - top - 12);
      // Flugfeldlöschfahrzeug mit Kabine, Werfer und Blaulichtbalken
      const fx0 = gx + 2;
      const fl = gw - 8;
      ctx.fillStyle = lin(ctx, 0, base - 17, 0, base - 3, [[0, '#ee3a42'], [1, '#a81c26']]);
      ctx.fillRect(fx0, base - 15, fl - 7, 12);
      poly(ctx, [[fx0 + fl - 8, base - 15], [fx0 + fl - 3, base - 15], [fx0 + fl, base - 9], [fx0 + fl, base - 3], [fx0 + fl - 8, base - 3]]);
      ctx.fill();
      ctx.fillStyle = '#ffe2b0';
      poly(ctx, [[fx0 + fl - 6.5, base - 13.8], [fx0 + fl - 3.4, base - 13.8], [fx0 + fl - 1.2, base - 9.6], [fx0 + fl - 6.5, base - 9.6]]);
      ctx.fill();
      ctx.fillStyle = '#f4ece4';
      ctx.fillRect(fx0, base - 8.5, fl - 1, 1.3);
      ctx.fillStyle = '#5a3f4b';
      ctx.fillRect(fx0 + 4, base - 17.5, 9, 2.5);
      ctx.fillRect(fx0 + 12, base - 18.5, 5, 1.2);
      ctx.fillStyle = '#4a7dff';
      ctx.fillRect(fx0 + fl - 7, base - 16.6, 4, 1.6);
      ctx.fillStyle = '#2b1f27';
      ctx.beginPath();
      for (const wx of [fx0 + 5, fx0 + 11, fx0 + fl - 6]) ctx.arc(wx, base - 2.4, 2.3, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = '#b8323c';
      ctx.fillRect(gx, top + 12, gw - 4, base - top - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      for (let y = top + 15; y < base; y += 4) ctx.fillRect(gx, y, gw - 4, 0.6);
    }
  }
  // Funkmast am Turm
  ctx.fillStyle = '#5c4656';
  ctx.fillRect(tx + tw - 4, tTop - 16, 1.3, 14);
  ctx.fillRect(tx + tw - 6.5, tTop - 11, 6.3, 0.8);
  ctx.restore();
  obstLight(ctx, M.obst, tx + tw - 3.35, tTop - 17, 0.8, 0.1);
}

function terminal(ctx, rng, x1, x2, M) {
  const base = TERM_BASE;
  const eave = 428;
  const crest = 402;
  const W = x2 - x1;
  ctx.save();
  // Dachfläche dahinter
  ctx.fillStyle = lin(ctx, 0, 412, 0, eave, [[0, '#b58ea5'], [1, '#8d6b88']]);
  ctx.fillRect(x1 + 8, 413, W - 16, eave - 412);

  // Bögen mit verglasten Lünetten
  const bays = Math.round(W / 105);
  const bw = W / bays;
  for (let i = 0; i < bays; i++) {
    const bx = x1 + i * bw;
    const arch = (off) => {
      ctx.moveTo(bx, eave);
      ctx.quadraticCurveTo(bx + bw / 2, crest - (eave - crest) - off * 2, bx + bw, eave);
    };
    // Lünette
    ctx.beginPath();
    arch(0);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, crest, 0, eave, [[0, '#a56f97'], [0.55, '#e8a989'], [1, '#ffd79c']]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(70,40,70,0.5)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let k = 1; k < 10; k++) {
      ctx.moveTo(bx + (k * bw) / 10, eave);
      ctx.lineTo(bx + bw / 2 + ((k - 5) * bw) / 14, crest);
    }
    ctx.moveTo(bx, eave - 9);
    ctx.lineTo(bx + bw, eave - 9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,220,0.18)';
    ctx.fillRect(bx + bw * 0.55, crest, bw * 0.12, eave - crest);
    ctx.restore();
    // Dachschale (Bogenband)
    ctx.beginPath();
    arch(3.2);
    ctx.lineTo(bx + bw - 2, eave);
    ctx.quadraticCurveTo(bx + bw / 2, crest - (eave - crest) + 1.5, bx + 2, eave);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, bx, 0, bx + bw, 0, [[0, '#c9a7b6'], [0.5, '#f4dcd2'], [0.8, '#fff1e6'], [1, '#e6c3c2']]);
    ctx.fill();
  }
  // Traufband
  ctx.fillStyle = lin(ctx, 0, eave, 0, eave + 7, [[0, '#fff0e4'], [1, '#d6b4b6']]);
  ctx.fillRect(x1 - 6, eave, W + 12, 7);
  ctx.fillStyle = 'rgba(60,30,50,0.35)';
  ctx.fillRect(x1, eave + 7, W, 2);

  // Glasfassade, zwei Ebenen
  const gTop = eave + 7;
  const gBot = base - 6;
  ctx.fillStyle = lin(ctx, 0, gTop, 0, gBot, [[0, '#ffe2aa'], [0.45, '#f6bb86'], [0.5, '#7d5a6e'], [0.54, '#f8c58e'], [1, '#d99070']]);
  ctx.fillRect(x1, gTop, W, gBot - gTop);
  const slab = gTop + (gBot - gTop) * 0.47;
  ctx.fillStyle = '#e9d0c8';
  ctx.fillRect(x1, slab, W, 3.2);
  // Deckenleuchten
  ctx.fillStyle = 'rgba(255,250,232,0.95)';
  for (let x = x1 + 4; x < x2 - 2; x += 11) {
    ctx.fillRect(x, gTop + 2, 3, 0.9);
    ctx.fillRect(x + 5, slab + 5, 3, 0.9);
  }
  // Passagiere
  ctx.fillStyle = 'rgba(80,45,65,0.55)';
  for (let i = 0; i < 150; i++) {
    const px = rng.range(x1 + 4, x2 - 4);
    const lower = rng.chance(0.45);
    const fy = lower ? gBot : slab;
    const ph = rng.range(6, 8);
    ctx.fillRect(px, fy - ph, 1.6, ph);
    ctx.beginPath();
    ctx.arc(px + 0.8, fy - ph - 1.1, 1.1, 0, TAU);
    ctx.fill();
  }
  // Himmelsspiegelung und Pfosten
  ctx.fillStyle = lin(ctx, 0, gTop, 0, slab, [[0, 'rgba(120,70,130,0.45)'], [1, 'rgba(120,70,130,0)']]);
  ctx.fillRect(x1, gTop, W, slab - gTop);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let x = x1 + 30; x < x2; x += rng.range(80, 160)) {
    poly(ctx, [[x, gTop], [x + 22, gTop], [x + 8, gBot], [x - 14, gBot]]);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(60,35,55,0.55)';
  for (let x = x1; x <= x2; x += 8.5) ctx.fillRect(x, gTop, 0.8, gBot - gTop);
  ctx.fillRect(x1, gTop + (slab - gTop) * 0.5, W, 0.6);
  ctx.fillRect(x1, slab + (gBot - slab) * 0.5, W, 0.6);
  // Große goldene Sterne hängen in jeder zweiten Halle
  for (let i = 1; i < bays; i += 2) {
    const sx = x1 + (i + 0.5) * bw;
    const sy = gTop + 12;
    ctx.strokeStyle = 'rgba(90,60,70,0.6)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(sx, gTop);
    ctx.lineTo(sx, sy - 5);
    ctx.stroke();
    glow(ctx, sx, sy, 13, 'rgba(255,214,120,0.55)');
    ctx.fillStyle = lin(ctx, sx - 5, sy - 5, sx + 5, sy + 5, [[0, '#fff6c8'], [0.5, '#ffd36a'], [1, '#d99a32']]);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? 2.1 : 5.2;
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    M.bulbs.push({ x: sx, y: sy, c: C.gold, r: 2.2, p: rng.range(0, TAU), s: rng.range(0.8, 1.6) });
  }
  // Sockel
  ctx.fillStyle = lin(ctx, 0, gBot, 0, base, [[0, '#6e5060'], [1, '#4f3848']]);
  ctx.fillRect(x1 - 3, gBot, W + 6, base - gBot);
  // Abgerundete Stirnseiten
  for (const [ex, s] of [[x1, -1], [x2, 1]]) {
    ctx.beginPath();
    ctx.moveTo(ex, gTop - 7);
    ctx.quadraticCurveTo(ex + s * 16, gTop + 10, ex + s * 12, base);
    ctx.lineTo(ex, base);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, ex, 0, ex + s * 16, 0, [[0, '#f0b88a'], [1, '#a56f86']]);
    ctx.fill();
  }

  // Lichterkette unter der Traufe (warmweiß, leicht durchhängend)
  for (let i = 0; i < bays; i++) {
    const bx = x1 + i * bw;
    for (let k = 0; k < 9; k++) {
      const s = (k + 0.5) / 9;
      bulb(ctx, M.bulbs, rng, bx + s * bw, eave + 9 + Math.sin(s * Math.PI) * 4, k % 3 === 1 ? C.gold : C.warm, 0.7);
    }
  }
  ctx.restore();
}

// Abstand Gate-x → vordere Hauptdeck-Tür (traffic legt die Tür des geparkten Flugzeugs genau dorthin)
const GATE_DOOR = 48;

// Doppelstöckige Fluggastbrücke (A380): zweistöckige Rotunde, zwei Teleskop-Tunnel, Kabine mit Faltenbalg
function jetBridge(ctx, rng, gx, label) {
  const rx = gx - 58;
  const rw = 8;
  const rTop = 461;
  ctx.save();
  // Rotunde
  ctx.fillStyle = lin(ctx, rx - rw, 0, rx + rw, 0, [[0, '#7a6575'], [0.45, '#c9b6b6'], [0.85, '#f4e4da'], [1, '#dcc2bb']]);
  ctx.fillRect(rx - rw, rTop, rw * 2, TERM_BASE - rTop);
  for (const gy of [rTop + 4, rTop + 16]) {
    ctx.fillStyle = lin(ctx, 0, gy, 0, gy + 5, [[0, '#ffe3ae'], [1, '#e9a57c']]);
    ctx.fillRect(rx - rw + 1.5, gy, rw * 2 - 3, 5);
    ctx.fillStyle = 'rgba(70,45,65,0.55)';
    for (let k = -1; k <= 1; k++) ctx.fillRect(rx + k * 4.2 - 0.3, gy, 0.6, 5);
  }
  ctx.fillStyle = '#5c4757';
  ctx.fillRect(rx - rw - 1.5, rTop - 2.5, rw * 2 + 3, 3);
  ctx.fillStyle = 'rgba(255,236,215,0.7)';
  ctx.fillRect(rx - rw - 1.5, rTop - 2.5, rw * 2 + 3, 0.7);
  ctx.fillStyle = 'rgba(60,35,55,0.4)';
  ctx.fillRect(rx - rw, TERM_BASE - 4, rw * 2, 4);
  // Gate-Schild auf der Rotunde
  ctx.fillStyle = '#4c3b48';
  ctx.fillRect(rx - 0.6, rTop - 6, 1.2, 4);
  ctx.fillStyle = '#2b2333';
  ctx.fillRect(rx - 8, rTop - 14, 16, 8.5);
  ctx.fillStyle = '#ffd84d';
  ctx.font = 'bold 6.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rx, rTop - 9.5);

  // Teleskop-Tunnel aus drei ineinandergeschobenen Segmenten
  const tube = (x0, y0, th0, ex, ey, th1, legK) => {
    const at = (k, grow) => {
      const x = lerpN(x0, ex, k);
      const top = lerpN(y0, ey, k) - grow * 0.4;
      return [x, top, lerpN(th0, th1, k) + grow * 0.8];
    };
    // Stütze mit Fahrwerk (hinter dem Tunnel)
    const [lx, ly, lt] = at(legK, 2);
    const gy = 496 + 22 * legK;
    ctx.fillStyle = '#4c3b48';
    ctx.fillRect(lx - 1.1, ly + lt - 1, 2.2, gy - ly - lt - 1);
    ctx.fillRect(lx - 5.5, gy - 3.5, 11, 2.4);
    ctx.fillStyle = '#231a22';
    ctx.beginPath();
    ctx.arc(lx - 3.3, gy - 0.6, 1.9, 0, TAU);
    ctx.arc(lx + 3.3, gy - 0.6, 1.9, 0, TAU);
    ctx.fill();
    const segs = [[0, 0.4], [0.37, 0.72], [0.69, 1]];
    segs.forEach(([ka, kb], i) => {
      const [ax, at0, ath] = at(ka, i);
      const [bx, bt0, bth] = at(kb, i);
      poly(ctx, [[ax, at0], [bx, bt0], [bx, bt0 + bth], [ax, at0 + ath]]);
      ctx.fillStyle = lin(ctx, 0, Math.min(at0, bt0), 0, Math.max(at0 + ath, bt0 + bth),
        [[0, '#f5e9e1'], [0.3, '#e2d2cd'], [0.75, '#b29ca3'], [1, '#8a7380']]);
      ctx.fill();
      // Dachkante hell, Unterkante dunkel
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = 'rgba(255,244,232,0.95)';
      ctx.beginPath();
      ctx.moveTo(ax, at0 + 0.35);
      ctx.lineTo(bx, bt0 + 0.35);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(60,35,55,0.7)';
      ctx.beginPath();
      ctx.moveTo(ax, at0 + ath - 0.35);
      ctx.lineTo(bx, bt0 + bth - 0.35);
      ctx.stroke();
      // Einzelne Fenster
      const len = bx - ax;
      for (let d = 2.5; d < len - 2.5; d += 4.4) {
        const k = d / len;
        const wx = ax + d;
        const wt = lerpN(at0, bt0, k);
        const wh = lerpN(ath, bth, k);
        ctx.fillStyle = rng.chance(0.7) ? 'rgba(255,216,156,0.95)' : 'rgba(80,52,74,0.85)';
        ctx.fillRect(wx - 0.8, wt + wh * 0.28, 1.6, wh * 0.34);
      }
      // Manschette am Segmentanfang
      if (i > 0) {
        ctx.fillStyle = '#6a5562';
        ctx.fillRect(ax - 0.7, at0 - 0.5, 1.4, ath + 1);
      }
    });
    // Kabine mit Faltenbalg
    const [cx, ct, cth] = at(1, 2);
    ctx.fillStyle = lin(ctx, 0, ct - 2, 0, ct + cth + 2, [[0, '#8b7482'], [1, '#5a4553']]);
    ctx.fillRect(cx - 8, ct - 1.8, 8.5, cth + 3.6);
    ctx.fillStyle = 'rgba(255,224,170,0.95)';
    ctx.fillRect(cx - 6.5, ct + 1, 3.2, 2.6);
    ctx.fillStyle = '#2a1f28';
    ctx.fillRect(cx + 0.5, ct - 1, 2.8, cth + 2);
    ctx.fillStyle = 'rgba(255,230,210,0.25)';
    for (let k = 1; k < 4; k++) ctx.fillRect(cx + 0.5 + k * 0.7, ct - 1, 0.3, cth + 2);
  };
  // Oberdeck (A380-Tür U1 liegt ≈ 11 Einheiten hinter der vorderen Hauptdeck-Tür) und Hauptdeck
  tube(rx + rw - 1, rTop + 3, 8, gx + GATE_DOOR - 8, 493, 8.6, 0.58);
  tube(rx + rw - 1, rTop + 15, 8.6, gx + GATE_DOOR + 2, 502.5, 9.4, 0.76);
  ctx.restore();
}

function lerpN(a, b, k) {
  return a + (b - a) * k;
}

function serviceTruck(ctx, x, y, kind, dir = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  if (kind === 'tug') {
    ctx.fillStyle = '#e8b13a';
    ctx.fillRect(0, -6, 10, 5);
    ctx.fillStyle = '#5a4552';
    ctx.fillRect(2, -9, 5, 3);
    ctx.fillStyle = '#c9b7b2';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-13 - i * 13, -7, 11, 5);
      ctx.fillStyle = i % 2 ? '#d9cbc6' : '#b9a6a6';
    }
    ctx.fillStyle = '#ffeaa8';
    ctx.fillRect(9.5, -5, 1.5, 1.5);
  } else if (kind === 'catering') {
    ctx.fillStyle = '#efe4dc';
    ctx.fillRect(0, -16, 20, 11);
    ctx.fillStyle = '#7a5f72';
    ctx.fillRect(0, -5, 26, 3);
    ctx.fillStyle = '#d2c2bc';
    ctx.fillRect(20, -10, 6, 6);
    ctx.fillStyle = '#ffeaa8';
    ctx.fillRect(25, -6, 1.5, 1.5);
  } else {
    ctx.fillStyle = '#d9d0c8';
    ctx.beginPath();
    ctx.ellipse(10, -8, 11, 4.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c8323b';
    ctx.fillRect(20, -11, 6, 8);
    ctx.fillStyle = '#ffeaa8';
    ctx.fillRect(25, -6, 1.5, 1.5);
  }
  ctx.fillStyle = '#231a22';
  ctx.beginPath();
  ctx.arc(4, -1.5, 1.6, 0, TAU);
  ctx.arc(20, -1.5, 1.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function floodMast(ctx, x, base, top) {
  ctx.save();
  // Lichtkegel
  ctx.fillStyle = lin(ctx, 0, top, 0, base + 30, [[0, 'rgba(255,224,170,0.16)'], [1, 'rgba(255,224,170,0)']]);
  poly(ctx, [[x - 5, top + 3], [x + 5, top + 3], [x + 46, base + 32], [x - 46, base + 32]]);
  ctx.fill();
  ctx.fillStyle = '#5c4656';
  ctx.fillRect(x - 1, top, 2, base - top);
  ctx.fillRect(x - 7, top - 1, 14, 3);
  ctx.restore();
  ctx.save();
  for (const dx of [-5, -1.7, 1.7, 5]) {
    spot(ctx, C.warm, x + dx, top + 2.5, 5, 0.7);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff6dc';
  ctx.fillRect(x - 6.5, top + 1.6, 13, 1.6);
  ctx.restore();
}

function paintMid(ctx, w, rng) {
  const M = resetDyn('mid');
  // Gelände
  ctx.fillStyle = lin(ctx, 0, GROUND_Y, 0, 720, [[0, '#e7a888'], [0.08, '#d9977b'], [0.4, '#cc8c70'], [1, '#b67864']]);
  ctx.fillRect(-10, GROUND_Y, w + 20, 720 - GROUND_Y);
  ctx.fillStyle = 'rgba(255,214,170,0.55)';
  ctx.fillRect(-10, GROUND_Y, w + 20, 1.2);
  // Ferne Parallelpiste 12R/30L als Lichterreihe
  ctx.save();
  ctx.fillStyle = 'rgba(110,70,90,0.35)';
  ctx.fillRect(-10, 474, w + 20, 3);
  for (let x = 0; x < w; x += 13) spot(ctx, x % 39 === 0 ? C.amber : C.white, x, 475.5, 2.4, 0.55);
  ctx.restore();
  // Ferne Cargo-Hallen
  ctx.save();
  for (let x = -10; x < w; x += rng.range(50, 120)) {
    const bw = rng.range(26, 70);
    const bh = rng.range(5, 12);
    ctx.fillStyle = '#a77983';
    ctx.fillRect(x, GROUND_Y + 6 - bh, bw, bh);
    ctx.fillStyle = 'rgba(255,214,150,0.7)';
    for (let px = x + 2; px < x + bw - 2; px += 5) if (rng.chance(0.3)) ctx.fillRect(px, GROUND_Y + 2 - bh * 0.5, 2, 1.2);
  }
  ctx.restore();

  // Hangars, Tower, Baum, Feuerwache
  hangar(ctx, rng, 1850, 250, 94, true, M, 'HANGAR 1');
  hangar(ctx, rng, 2135, 236, 82, false, M, 'HANGAR 2');
  fireStation(ctx, rng, 30, 214, M);
  dxbTower(ctx, TOWER_X, TERM_BASE, M);
  for (const [px, ph, lean, cols] of [[1560, 78, 0.08, [C.warm]], [1660, 70, -0.1, MULTI], [1796, 86, 0.1, [C.warm, C.gold]], [1585, 58, -0.06, [C.gold]]]) {
    palm(ctx, rng, px, TERM_BASE + 1, ph, { lean, bulbs: M.bulbs, colors: cols, bulbR: 0.55, trunkW: ph * 0.055 });
  }
  goldTree(ctx, rng, 1617, TERM_BASE, 112, M);
  for (const [px, ph, lean, cols] of [[14, 74, 0.1, [C.warm]], [266, 66, 0.06, MULTI]]) {
    palm(ctx, rng, px, TERM_BASE + 1, ph, { lean, bulbs: M.bulbs, colors: cols, bulbR: 0.55, trunkW: ph * 0.055 });
  }

  // Terminal 3 / Concourse A
  terminal(ctx, rng, TERM_X1, TERM_X2, M);

  // Vorfeld
  ctx.fillStyle = lin(ctx, 0, TERM_BASE, 0, 546, [[0, '#bd968a'], [1, '#ab887f']]);
  ctx.fillRect(-10, TERM_BASE, w + 20, 546 - TERM_BASE);
  // Schatten der Gebäude (Gegenlicht → zum Betrachter)
  ctx.fillStyle = lin(ctx, 0, TERM_BASE, 0, TERM_BASE + 14, [[0, 'rgba(70,35,60,0.35)'], [1, 'rgba(70,35,60,0)']]);
  ctx.fillRect(TERM_X1 - 10, TERM_BASE, TERM_X2 - TERM_X1 + 20, 14);
  ctx.fillRect(1840, TERM_BASE, 560, 12);
  // Betonfugen
  ctx.fillStyle = 'rgba(90,60,70,0.12)';
  for (const y of [506, 518, 532]) ctx.fillRect(-10, y, w + 20, 0.6);
  for (let x = 0; x < w; x += 34) ctx.fillRect(x, TERM_BASE + 4, 0.5, 42);
  // Lichtinseln der Flutlichtmasten
  const masts = [...GATES_X.map((g) => g - 102), GATES_X[GATES_X.length - 1] + 103, 1830, 2110, 2395];
  for (const mx of masts) {
    ctx.save();
    ctx.translate(mx, 520);
    ctx.scale(1, 0.24);
    ctx.fillStyle = rad(ctx, 0, 0, 90, [[0, 'rgba(255,226,170,0.38)'], [1, 'rgba(255,226,170,0)']]);
    ctx.fillRect(-90, -90, 180, 180);
    ctx.restore();
  }
  // Lichtschein aus dem offenen Hangartor
  ctx.save();
  ctx.translate(1975, TERM_BASE + 6);
  ctx.scale(1, 0.2);
  ctx.fillStyle = rad(ctx, 0, 0, 85, [[0, 'rgba(255,232,185,0.6)'], [1, 'rgba(255,232,185,0)']]);
  ctx.fillRect(-85, -85, 170, 170);
  ctx.restore();
  // Betriebsstraße
  ctx.fillStyle = 'rgba(80,55,70,0.25)';
  ctx.fillRect(-10, 497, w + 20, 8);
  ctx.fillStyle = 'rgba(255,245,230,0.55)';
  for (let x = 0; x < w; x += 18) ctx.fillRect(x, 500.6, 8, 0.7);
  // Gate-Markierungen
  ctx.save();
  GATES_X.forEach((gx, i) => {
    ctx.strokeStyle = '#f2c445';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx - 175, TAXI_Y - 1);
    ctx.quadraticCurveTo(gx - 120, GATE_Y + 1, gx - 60, GATE_Y + 1);
    ctx.lineTo(gx + GATE_DOOR + 6, GATE_Y + 1);
    ctx.stroke();
    // Stoppmarke knapp vor dem Bugrad
    ctx.fillStyle = '#f2c445';
    ctx.fillRect(gx + GATE_DOOR + 6, GATE_Y - 2.5, 1.4, 7);
    ctx.fillRect(gx + GATE_DOOR + 3, GATE_Y - 2.5, 7.4, 1);
    ctx.fillStyle = 'rgba(220,50,60,0.65)';
    ctx.fillRect(gx - 95, 510, 190, 0.8);
    ctx.save();
    ctx.translate(gx + 84, 530);
    ctx.scale(1, 0.45);
    ctx.fillStyle = 'rgba(242,196,69,0.85)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`A${i + 1}`, 0, 0);
    ctx.restore();
  });
  ctx.restore();
  // Vorfeldkante
  ctx.fillStyle = '#e9c24e';
  ctx.fillRect(-10, 543.5, w + 20, 0.8);
  ctx.fillRect(-10, 545, w + 20, 0.8);

  // Fluggastbrücken
  GATES_X.forEach((gx, i) => jetBridge(ctx, rng, gx, `A${i + 1}`));
  // Vorfeldfahrzeuge zwischen den Gates
  serviceTruck(ctx, 495, 504, 'tug', 1);
  serviceTruck(ctx, 698, 506, 'catering', -1);
  serviceTruck(ctx, 1105, 505, 'fuel', 1);
  serviceTruck(ctx, 1312, 504, 'tug', -1);
  serviceTruck(ctx, 2000, 520, 'tug', 1);
  // Flutlichtmasten
  for (const mx of masts) floodMast(ctx, mx, 498, 376);

  // Rollweg
  ctx.fillStyle = '#7a5d64';
  ctx.fillRect(-10, 546.5, w + 20, 20);
  ctx.fillStyle = lin(ctx, 0, 548, 0, 565, [[0, '#5f4853'], [1, '#54404b']]);
  ctx.fillRect(-10, 548, w + 20, 17);
  ctx.fillStyle = '#f0c445';
  ctx.fillRect(-10, TAXI_Y - 0.5, w + 20, 1.1);
  // Sandstreifen mit Schnellabrollwegen zur Piste
  ctx.fillStyle = lin(ctx, 0, 566, 0, 588, [[0, '#e6aa7f'], [1, '#d8996f']]);
  ctx.fillRect(-10, 566, w + 20, 21);
  for (const ex of [430, 1080, 1720, 2210]) {
    poly(ctx, [[ex - 30, 566], [ex + 30, 566], [ex + 90, 588], [ex + 30, 588]]);
    ctx.fillStyle = '#665059';
    ctx.fill();
    ctx.strokeStyle = '#f0c445';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(ex, 566);
    ctx.lineTo(ex + 60, 588);
    ctx.stroke();
  }
  ctx.save();
  for (const ex of [430, 1080, 1720, 2210]) {
    for (let k = 0.15; k < 1; k += 0.22) spot(ctx, C.green, ex + 60 * k, 566 + 22 * k, 2, 0.6);
  }
  // Rollwegbefeuerung: grün mittig, blau am Rand
  for (let x = 4; x < w; x += 20) spot(ctx, C.green, x, TAXI_Y, 2.2, 0.55);
  for (let x = 12; x < w; x += 40) {
    spot(ctx, C.blue, x, 547, 3, 0.75);
    spot(ctx, C.blue, x + 20, 565.5, 3, 0.75);
  }
  ctx.restore();

  // Piste 12L/30R
  ctx.fillStyle = '#6d5560';
  ctx.fillRect(RWY_X1 - 8, 587, RWY_X2 - RWY_X1 + 16, 26);
  ctx.fillStyle = lin(ctx, 0, 589, 0, 611, [[0, '#56434f'], [1, '#4a3a46']]);
  ctx.fillRect(RWY_X1, 589, RWY_X2 - RWY_X1, 22);
  ctx.fillStyle = 'rgba(30,18,28,0.18)';
  for (let i = 0; i < 40; i++) ctx.fillRect(rng.range(RWY_X1 + 200, RWY_X2 - 200), rng.range(592, 607), rng.range(30, 120), rng.range(1, 3));
  ctx.fillStyle = 'rgba(255,242,228,0.85)';
  ctx.fillRect(RWY_X1, 590, RWY_X2 - RWY_X1, 0.8);
  ctx.fillRect(RWY_X1, 609.2, RWY_X2 - RWY_X1, 0.8);
  for (let x = RWY_X1 + 90; x < RWY_X2 - 90; x += 46) ctx.fillRect(x, RWY_Y - 0.6, 24, 1.2);
  for (const [tx, s] of [[RWY_X1 + 8, 1], [RWY_X2 - 40, -1]]) {
    for (let i = 0; i < 7; i++) ctx.fillRect(tx, 592 + i * 2.6, 32, 1.3);
    const ax = s > 0 ? tx + 260 : tx - 230;
    ctx.fillRect(ax, 593, 46, 2.2);
    ctx.fillRect(ax, 605, 46, 2.2);
    for (let k = 1; k <= 3; k++) {
      const zx = s > 0 ? tx + 60 + k * 50 : tx - 30 - k * 50;
      ctx.fillRect(zx, 594.5, 20, 1);
      ctx.fillRect(zx, 604.5, 20, 1);
    }
  }
  // Pistenrandbefeuerung
  ctx.save();
  for (let x = RWY_X1; x <= RWY_X2; x += 42) {
    spot(ctx, C.white, x, 588, 3.4, 0.85);
    spot(ctx, C.white, x + 21, 612, 3.4, 0.85);
  }
  for (let y = 590; y <= 610; y += 4) {
    spot(ctx, C.green, RWY_X2 + 3, y, 2.6, 0.9);
    spot(ctx, C.red, RWY_X1 - 3, y, 2.6, 0.9);
  }
  ctx.restore();
  // Anflugbefeuerung jenseits der Schwelle 30R
  ctx.save();
  for (let x = RWY_X2 + 16; x < w + 4; x += 15) {
    ctx.fillStyle = '#4c3b48';
    ctx.fillRect(x - 0.6, RWY_Y - 2, 1.2, 9);
    for (let k = -1; k <= 1; k++) spot(ctx, C.white, x, RWY_Y + k * 3, 2.6, 0.75);
    M.rabbit.push({ x, y: RWY_Y });
  }
  M.rabbit.reverse();
  ctx.restore();

  // Sand vor der Piste
  ctx.fillStyle = lin(ctx, 0, 613, 0, 720, [[0, '#e9ae80'], [0.4, '#d99a72'], [1, '#bd7f66']]);
  ctx.fillRect(-10, 613, w + 20, 107);
  ctx.strokeStyle = 'rgba(255,230,200,0.25)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const x = rng.range(-10, w);
    const y = rng.range(620, 700);
    const l = rng.range(20, 60);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + l / 2, y - 2.5, x + l, y);
  }
  ctx.stroke();
  // Wüstenbüsche
  for (let i = 0; i < 28; i++) {
    const x = rng.range(0, w);
    const y = rng.range(622, 690);
    const s = rng.range(2.5, 5.5);
    ctx.fillStyle = 'rgba(90,70,60,0.75)';
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.6, s, 0, Math.PI, TAU);
    ctx.fill();
  }
  // PAPI
  ctx.save();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#4c3b48';
    ctx.fillRect(1946 + i * 7, 620, 5, 3);
    spot(ctx, i < 2 ? C.white : C.red, 1948.5 + i * 7, 620, 3.2, 0.95);
  }
  ctx.restore();
  // Windsack
  ctx.save();
  ctx.fillStyle = '#5c4656';
  ctx.fillRect(2125, 616, 1.6, 32);
  const sock = [[2126.5, 617], [2148, 620], [2148, 624], [2126.5, 627]];
  poly(ctx, sock);
  ctx.fillStyle = '#ff7a3a';
  ctx.fill();
  ctx.fillStyle = '#fff1e6';
  for (const k of [0.25, 0.65]) {
    const x0 = 2126.5 + 21.5 * k;
    const x1 = x0 + 4.3;
    poly(ctx, [[x0, 617 + 3 * k], [x1, 617 + 3 * (k + 0.2)], [x1, 627 - 3 * (k + 0.2)], [x0, 627 - 3 * k]]);
    ctx.fill();
  }
  ctx.restore();
  // Pisten-Restlängen-Schilder
  ctx.save();
  ctx.font = 'bold 6px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [3, 2, 1].forEach((n, i) => {
    const sx = RWY_X1 + 300 + i * 300;
    ctx.fillStyle = '#211a22';
    ctx.fillRect(sx - 5, 621, 10, 8);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(n), sx, 625.3);
  });
  ctx.restore();
  // Landekurssender links
  ctx.save();
  ctx.fillStyle = '#5c4656';
  for (let i = 0; i < 9; i++) ctx.fillRect(40 + i * 9, 596, 1.4, 10);
  ctx.fillRect(38, 604, 76, 1.4);
  ctx.restore();
}

// --- Vordergrund -------------------------------------------------------------

function camel(ctx, x, y, s, dir, rider) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  ctx.fillStyle = '#3a2232';
  ctx.beginPath();
  ctx.moveTo(-24, -26);
  ctx.bezierCurveTo(-30, -33, -25, -40, -16, -42);
  ctx.bezierCurveTo(-10, -51, -1, -51, 3, -42);
  ctx.bezierCurveTo(7, -38, 12, -38, 15, -36);
  ctx.bezierCurveTo(20, -36, 24, -44, 28, -48);
  ctx.lineTo(32, -50);
  ctx.bezierCurveTo(37, -50, 40, -48, 41, -45);
  ctx.lineTo(39.5, -43);
  ctx.bezierCurveTo(35, -43, 31, -43, 29, -42);
  ctx.bezierCurveTo(26, -38, 22, -30, 16, -26);
  ctx.lineTo(14, -24);
  ctx.bezierCurveTo(6, -21, -14, -21, -24, -26);
  ctx.closePath();
  ctx.fill();
  // Ohr + Schwanz
  ctx.fillRect(31, -53, 1.5, 3.5);
  ctx.strokeStyle = '#3a2232';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-26, -33);
  ctx.quadraticCurveTo(-29, -29, -28, -24);
  ctx.stroke();
  // Beine
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (const [hx, kx, fx] of [[12, 14, 15], [8, 6, 3], [-18, -20, -21], [-12, -9, -7]]) {
    ctx.moveTo(hx, -24);
    ctx.lineTo(kx, -12);
    ctx.lineTo(fx, 0);
  }
  ctx.stroke();
  // Satteldecke
  ctx.fillStyle = '#9a2a36';
  ctx.beginPath();
  ctx.moveTo(-12, -42);
  ctx.quadraticCurveTo(-1, -49, 6, -40);
  ctx.lineTo(4, -32);
  ctx.lineTo(-10, -32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8b04a';
  ctx.fillRect(-10, -33, 14, 1.4);
  if (rider) {
    ctx.fillStyle = '#3a2232';
    ctx.beginPath();
    ctx.moveTo(-6, -44);
    ctx.lineTo(-4, -60);
    ctx.lineTo(2, -60);
    ctx.lineTo(3, -44);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-1, -63.5, 3.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e9e0d6';
    ctx.beginPath();
    ctx.moveTo(-4.8, -64);
    ctx.quadraticCurveTo(-1, -69.5, 2.8, -64);
    ctx.lineTo(-6.5, -56);
    ctx.closePath();
    ctx.fill();
  }
  // Abendlicht-Kante
  ctx.strokeStyle = 'rgba(255,170,120,0.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-16, -42);
  ctx.bezierCurveTo(-10, -51, -1, -51, 3, -42);
  ctx.bezierCurveTo(7, -38, 12, -38, 15, -36);
  ctx.bezierCurveTo(20, -36, 24, -44, 28, -48);
  ctx.stroke();
  ctx.restore();
}

// Arabische Laterne (Fanous); y = Standfläche
function lantern(ctx, list, x, y, s, rng) {
  ctx.save();
  glow(ctx, x, y - 18 * s, 46 * s, 'rgba(255,160,70,0.32)');
  ctx.fillStyle = '#3b2622';
  poly(ctx, [[x - 8 * s, y], [x + 8 * s, y], [x + 6 * s, y - 4 * s], [x - 6 * s, y - 4 * s]]);
  ctx.fill();
  // Glaskörper
  const body = [[x - 9 * s, y - 5 * s], [x - 11 * s, y - 17 * s], [x - 9 * s, y - 29 * s], [x + 9 * s, y - 29 * s], [x + 11 * s, y - 17 * s], [x + 9 * s, y - 5 * s]];
  poly(ctx, body);
  ctx.fillStyle = rad(ctx, x, y - 17 * s, 13 * s, [[0, '#fff3c0'], [0.5, '#ffc45a'], [1, '#e0782c']]);
  ctx.fill();
  // Ornament-Gitter
  ctx.strokeStyle = '#3b2622';
  ctx.lineWidth = 1.1 * s;
  ctx.beginPath();
  for (const dx of [-4, 4]) {
    ctx.moveTo(x + dx * s, y - 5 * s);
    ctx.lineTo(x + dx * 1.2 * s, y - 17 * s);
    ctx.lineTo(x + dx * s, y - 29 * s);
  }
  ctx.moveTo(x - 11 * s, y - 17 * s);
  ctx.lineTo(x + 11 * s, y - 17 * s);
  for (const dx of [-7, 0, 7]) {
    ctx.moveTo(x + (dx - 2.5) * s, y - 23 * s);
    ctx.quadraticCurveTo(x + dx * s, y - 28 * s, x + (dx + 2.5) * s, y - 23 * s);
    ctx.moveTo(x + (dx - 2.5) * s, y - 11 * s);
    ctx.quadraticCurveTo(x + dx * s, y - 16 * s, x + (dx + 2.5) * s, y - 11 * s);
  }
  ctx.stroke();
  poly(ctx, body);
  ctx.stroke();
  // Kuppel
  ctx.fillStyle = '#4a2f27';
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y - 29 * s);
  ctx.bezierCurveTo(x - 9 * s, y - 37 * s, x - 2 * s, y - 38 * s, x, y - 44 * s);
  ctx.bezierCurveTo(x + 2 * s, y - 38 * s, x + 9 * s, y - 37 * s, x + 10 * s, y - 29 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,200,120,0.5)';
  for (const dx of [-5, 0, 5]) ctx.fillRect(x + dx * s - 0.6 * s, y - 34 * s, 1.2 * s, 2.5 * s);
  ctx.strokeStyle = '#d9a640';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.arc(x, y - 47 * s, 2.6 * s, 0, TAU);
  ctx.stroke();
  ctx.restore();
  list.push({ x, y: y - 17 * s, r: 34 * s, p: rng.range(0, TAU) });
}

function lanternPost(ctx, list, x, base, h, rng) {
  ctx.save();
  ctx.fillStyle = lin(ctx, x - 3, 0, x + 3, 0, [[0, '#2e1f22'], [1, '#6b4a3f']]);
  ctx.fillRect(x - 2.2, base - h, 4.4, h);
  ctx.fillRect(x - 5, base - 8, 10, 8);
  ctx.fillRect(x - 3.5, base - h * 0.6, 7, 3);
  // Ausleger
  ctx.strokeStyle = '#3b2622';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, base - h + 6);
  ctx.quadraticCurveTo(x + 20, base - h - 10, x + 30, base - h + 2);
  ctx.stroke();
  ctx.restore();
  lantern(ctx, list, x + 30, base - h + 36, 0.75, rng);
  ctx.save();
  ctx.strokeStyle = '#3b2622';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 30, base - h + 2);
  ctx.lineTo(x + 30, base - h + 36 - 47 * 0.75 - 2);
  ctx.stroke();
  ctx.restore();
}

function guardHut(ctx, x, base, w, h, N) {
  const top = base - h;
  ctx.save();
  ctx.fillStyle = lin(ctx, x, 0, x + w, 0, [[0, '#a8726a'], [0.5, '#d29a7c'], [1, '#efba8e']]);
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = '#f6d4b2';
  ctx.fillRect(x - 4, top - 4, w + 8, 5);
  ctx.fillStyle = 'rgba(70,35,45,0.35)';
  ctx.fillRect(x - 4, top + 1, w + 8, 2);
  // Tür mit Kranz
  ctx.fillStyle = '#5a3a3c';
  ctx.fillRect(x + 12, top + 22, 20, h - 22);
  ctx.strokeStyle = '#2f6b3f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + 22, top + 34, 5.5, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#d02a36';
  ctx.beginPath();
  ctx.moveTo(x + 22, top + 39);
  ctx.lineTo(x + 18.5, top + 43);
  ctx.lineTo(x + 25.5, top + 43);
  ctx.closePath();
  ctx.fill();
  for (const a of [0.4, 1.3, 2.4, 3.6, 4.6, 5.6]) {
    ctx.beginPath();
    ctx.arc(x + 22 + Math.cos(a) * 5.5, top + 34 + Math.sin(a) * 5.5, 1, 0, TAU);
    ctx.fill();
  }
  // Fenster
  ctx.fillStyle = lin(ctx, 0, top + 18, 0, top + 40, [[0, '#ffe2a6'], [1, '#f2a467']]);
  ctx.fillRect(x + w - 40, top + 18, 28, 20);
  ctx.fillStyle = '#5a3a3c';
  ctx.fillRect(x + w - 26.6, top + 18, 1.2, 20);
  ctx.fillRect(x + w - 40, top + 27.4, 28, 1.2);
  // Antenne
  ctx.fillStyle = '#4a3338';
  ctx.fillRect(x + w - 8, top - 30, 1.5, 26);
  ctx.restore();
  obstLight(ctx, N.obst, x + w - 7.2, top - 31, 1.2, 0.3);
}

function paintNear(ctx, w, rng) {
  const N = resetDyn('near');
  const fenceBase = 664;
  const fenceH = 40;
  // Sandboden hinter dem Zaun
  ctx.fillStyle = lin(ctx, 0, fenceBase - 6, 0, 720, [[0, '#d4936e'], [1, '#b37466']]);
  ctx.fillRect(-10, fenceBase - 6, w + 20, 720 - fenceBase + 6);

  // Flughafenzaun mit Stacheldraht
  ctx.save();
  ctx.strokeStyle = 'rgba(72,44,66,0.42)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let x = -20; x < w + 10; x += 8) {
    ctx.moveTo(x, fenceBase);
    ctx.lineTo(x + fenceH * 0.55, fenceBase - fenceH);
    ctx.moveTo(x + fenceH * 0.55, fenceBase);
    ctx.lineTo(x, fenceBase - fenceH);
  }
  ctx.stroke();
  ctx.fillStyle = '#3d2a3c';
  ctx.fillRect(-10, fenceBase - fenceH - 1, w + 20, 2.2);
  ctx.fillRect(-10, fenceBase - 3, w + 20, 2);
  ctx.strokeStyle = 'rgba(61,42,60,0.5)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = -10; x < w + 10; x += 3.2) {
    ctx.moveTo(x + 2.4, fenceBase - fenceH - 5);
    ctx.ellipse(x, fenceBase - fenceH - 5, 2.4, 4, 0.25, 0, TAU);
  }
  ctx.stroke();
  for (let x = 20; x < w; x += 78) {
    ctx.fillStyle = '#3d2a3c';
    ctx.fillRect(x - 1.8, fenceBase - fenceH - 12, 3.6, fenceH + 12);
    ctx.fillStyle = 'rgba(255,170,120,0.55)';
    ctx.fillRect(x + 1, fenceBase - fenceH - 12, 0.8, fenceH + 12);
  }
  ctx.restore();
  // Lichterketten am Zaun (abschnittsweise)
  for (let x = 20; x < w - 78; x += 78) {
    if (((x / 78) | 0) % 3 === 2) continue;
    for (let k = 0; k < 9; k++) {
      const s = (k + 0.5) / 9;
      bulb(ctx, N.bulbs, rng, x + s * 78, fenceBase - fenceH + 1 + Math.sin(s * Math.PI) * 7, MULTI[(k + ((x / 78) | 0)) % MULTI.length], 1.1);
    }
  }

  // Hintere Dünenreihe
  const lit = '#eaa676';
  const litLow = '#d58c6c';
  const shade = '#b26a6c';
  for (let x = -60; x < w + 100; x += rng.range(220, 360)) {
    dune(ctx, rng, { cx: x, cy: rng.range(642, 662), wl: rng.range(120, 200), wr: rng.range(160, 260), base: 724, lit, litLow, shade });
  }
  // Große Kameldüne
  const big = dune(ctx, rng, { cx: 1130, cy: 604, wl: 300, wr: 380, base: 724, lit: '#f1b07c', litLow: '#d8906c', shade: '#b8706c' });
  dune(ctx, rng, { cx: 2480, cy: 628, wl: 260, wr: 300, base: 724, lit: '#f1b07c', litLow: '#d8906c', shade: '#b8706c' });

  // Palmen mit Lichterketten
  const palms = [
    [20, 262, 0.1, [C.warm], 692],
    [92, 180, -0.12, MULTI, 700],
    [1700, 258, -0.1, [C.warm, C.gold], 696],
    [2150, 188, 0.08, MULTI, 702],
    [2872, 280, 0.11, [C.warm], 692],
    [2946, 204, -0.06, [C.gold, C.warm], 700],
  ];
  for (const [px, ph, lean, cols, by] of palms) {
    palm(ctx, rng, px, by, ph, {
      lean, bulbs: N.bulbs, colors: cols, bulbR: 1.25, trunkW: ph * 0.05,
      trunk: '#3c2a30', leaf: '#263a30', leafDark: '#1a2622', fronds: 14,
    });
  }

  // Kamele auf dem Dünenkamm
  for (const [cx, s, rider] of [[1088, 1.05, true], [1158, 0.98, false], [1218, 0.7, false]]) {
    camel(ctx, cx, duneY(big, cx) + 1.5, s, -1, rider);
  }
  // Wachhäuschen (flaches Dach = Versteck)
  guardHut(ctx, 2310, 684, 92, 76, N);

  // Vordere Dünen
  for (let x = 40; x < w + 100; x += rng.range(300, 460)) {
    if (Math.abs(x - 2350) < 160) continue;
    dune(ctx, rng, { cx: x, cy: rng.range(682, 700), wl: rng.range(150, 230), wr: rng.range(180, 280), base: 726, lit: '#f6bc88', litLow: '#e0a07a', shade: '#c27c70' });
  }
  dune(ctx, rng, { cx: 2420, cy: 688, wl: 150, wr: 220, base: 726, lit: '#f6bc88', litLow: '#e0a07a', shade: '#c27c70' });

  // Laternen
  lanternPost(ctx, N.lanterns, 560, 704, 128, rng);
  lanternPost(ctx, N.lanterns, 1960, 704, 136, rng);
  lanternPost(ctx, N.lanterns, 2650, 706, 124, rng);
  for (const [lx, ly, s] of [[400, 700, 1.15], [432, 704, 0.8], [1290, 702, 1.05], [1320, 706, 0.75], [1262, 708, 0.62], [2214, 704, 1.1], [2248, 707, 0.72], [2560, 704, 1.25], [2780, 706, 0.9]]) {
    lantern(ctx, N.lanterns, lx, ly, s, rng);
  }
}

// --- Animationen pro Frame --------------------------------------------------

function drawObst(ctx, list, x0, x1, t, scale) {
  for (const o of list) {
    if (o.x < x0 || o.x > x1) continue;
    const ph = (t / 1.5 + o.p) % 1;
    const a = ph < 0.45 ? 1 : 0.12;
    spot(ctx, C.red, o.x, o.y, 7 * o.r * scale, a);
  }
}

function drawBulbs(ctx, list, x0, x1, t, q, scale) {
  const step = q < 0.75 ? 2 : 1;
  for (let i = 0; i < list.length; i += step) {
    const b = list[i];
    if (b.x < x0 || b.x > x1) continue;
    const v = Math.sin(t * b.s + b.p);
    if (v < 0.4) continue;
    spot(ctx, b.c, b.x, b.y, b.r * scale * (2.5 + v * 2.5), (v - 0.4) * 1.6);
  }
}

function drawDynamic(ctx, layerId, { t, view }) {
  const vw = view.viewW;
  const q = view.quality ?? 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (layerId === 'sky') {
    // Funkelnder Weihnachtsstern
    const st = skyStar(vw);
    const v = 0.5 + 0.5 * Math.sin(t * 2.1);
    spot(ctx, C.white, st.x, st.y, 14 + v * 8, 0.25 + v * 0.3);
    ctx.globalAlpha = 0.25 + v * 0.35;
    ctx.fillStyle = '#fff6dc';
    ctx.fillRect(st.x - 0.5, st.y - 16 - v * 6, 1, 32 + v * 12);
    ctx.fillRect(st.x - 11 - v * 4, st.y - 0.4, 22 + v * 8, 0.8);
    ctx.restore();
    return;
  }
  const d = dyn[layerId];
  if (!d) {
    ctx.restore();
    return;
  }
  const off = view.layerOffset(layerId);
  const x0 = off - 40;
  const x1 = off + vw + 40;
  if (layerId === 'far') {
    drawObst(ctx, d.obst, x0, x1, t, 1);
    drawBulbs(ctx, d.bulbs, x0, x1, t, q, 1);
    // Hitzeflimmern über dem Horizont
    ctx.fillStyle = 'rgba(255,220,170,1)';
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.05 + 0.04 * Math.sin(t * 2.3 + i * 1.7);
      ctx.fillRect(off, 452 + i * 3.4 + Math.sin(t * 1.6 + i) * 1.2, vw, 1);
    }
  } else if (layerId === 'mid') {
    drawObst(ctx, d.obst, x0, x1, t, 1);
    drawBulbs(ctx, d.bulbs, x0, x1, t, q, 1);
    // Rabbit: Lauflicht der Anflugbefeuerung Richtung Schwelle
    const r = d.rabbit;
    if (r.length && r[0].x > x0 && r[r.length - 1].x < x1) {
      const k = (t * 2) % 1;
      const idx = Math.floor(k * (r.length + 3));
      if (idx < r.length) {
        spot(ctx, C.white, r[idx].x, r[idx].y, 16, 1);
        if (idx > 0) spot(ctx, C.white, r[idx - 1].x, r[idx - 1].y, 9, 0.35);
      }
    }
    // Tower-Leuchtfeuer (grün/weiß rotierend)
    const b = d.beacon;
    if (b && b.x > x0 && b.x < x1) {
      const c = Math.cos(t * 2.6);
      spot(ctx, c > 0 ? C.green : C.white, b.x, b.y, 16, Math.abs(c) ** 5);
      spot(ctx, C.red, b.x, b.y + 2, 4, 0.7);
    }
    const s = d.star;
    if (s && s.x > x0 && s.x < x1) {
      const v = 0.5 + 0.5 * Math.sin(t * 1.7);
      spot(ctx, C.gold, s.x, s.y, s.r * (0.9 + v * 0.3), 0.35 + v * 0.35);
    }
  } else if (layerId === 'near') {
    drawObst(ctx, d.obst, x0, x1, t, 1);
    drawBulbs(ctx, d.bulbs, x0, x1, t, q, 1);
    for (const l of d.lanterns) {
      if (l.x < x0 - l.r || l.x > x1 + l.r) continue;
      const a = 0.22 + 0.08 * Math.sin(t * 6.3 + l.p) + 0.06 * Math.sin(t * 11.7 + l.p * 2);
      spot(ctx, C.amber, l.x, l.y, l.r, a);
    }
  }
  ctx.restore();
}

// --- Szene ---------------------------------------------------------------------

export default {
  id: 'DXB', iata: 'DXB', icao: 'OMDB',
  name: 'Dubai International', city: 'Dubai', country: 'VAE',
  subtitle: 'Goldener Abend über der Wüste',
  theme: { accent: '#ffb347', skyTop: '#2a2262', skyBottom: '#ff9a5c' },
  weather: { snow: 0 },
  layerTop: { far: 30, mid: 190, near: 300 },
  paintSky,
  paintLayer(ctx, layerId, { w, rng }) {
    if (layerId === 'far') paintFar(ctx, w, rng);
    else if (layerId === 'mid') paintMid(ctx, w, rng);
    else if (layerId === 'near') paintNear(ctx, w, rng);
  },
  drawDynamic,
  traffic: {
    planeScale: { far: 0.38, mid: 1.0, near: 2.2 },
    runways: [
      {
        id: '30R', layer: 'mid', y: RWY_Y, x1: RWY_X1, x2: RWY_X2, dir: -1,
        use: 'mixed', arrivalsPerMin: 3.6, departuresPerMin: 3.2,
        approach: { startY: 130, lowFlyLayer: null },
      },
    ],
    taxiways: [{ layer: 'mid', y: TAXI_Y, x1: 170, x2: 2260 }],
    gates: [
      ...GATES_X.map((x) => ({ layer: 'mid', x, y: GATE_Y, dir: 1, door: GATE_DOOR })),
      { layer: 'mid', x: 2250, y: GATE_Y, dir: -1 },
    ],
    overflights: [
      { layer: 'far', yMin: 45, yMax: 190, perMin: 5, contrails: true },
      { layer: 'mid', yMin: 110, yMax: 230, perMin: 1.5, contrails: false },
    ],
    helicopters: 0.6,
    fleet: { a380: 7, wide: 4.5, narrow: 2.5, jumbo: 0.6, regional: 0.3, prop: 0.2 },
    // Erfundene Lackierungen (keine echten Airlines); title/motif nutzt aircraft.js optional
    liveries: [
      { name: 'Sandrose', title: 'SANDROSE', titleColor: '#8a6326', body: '#f6f2ea', belly: '#e2d8c8', tail: '#b8893a', accent: '#fff1c8', cheatline: '#c9a24a', engine: '#e6ded0', motif: 'sun' },
      { name: 'Lagune', title: 'LAGUNE', body: '#f4f7f8', belly: '#d6e0e4', tail: '#1e8c96', accent: '#f2b134', cheatline: '#1e8c96', engine: '#cfd8dc', motif: 'wave' },
      { name: 'Dünenwind', title: 'DÜNENWIND', body: '#f2f4f8', belly: '#25335a', tail: '#25335a', accent: '#e2b04a', cheatline: null, engine: '#c7ccd6', motif: 'chevron' },
      { name: 'Abendrot', title: 'ABENDROT', titleColor: '#b8433b', body: '#fbf7f2', belly: '#e8dfd5', tail: '#d9534a', accent: '#ffd27a', cheatline: '#d9534a', engine: '#ddd6cc', motif: 'stripes' },
      { name: 'Oasenstern', title: 'OASENSTERN', body: '#f3f6f2', belly: '#d6dfd7', tail: '#20684a', accent: '#e8c35a', cheatline: null, engine: '#ccd3cd', motif: 'star4' },
      { name: 'Morgenland', title: 'MORGENLAND', body: '#f6f7f9', belly: '#c9ced6', tail: '#2f3e5c', accent: '#d9b25f', cheatline: '#2f3e5c', engine: '#d5d9df', motif: 'ring' },
    ],
  },
  eagleZones: { far: [70, 330], mid: [80, 380], near: [60, 470] },
  hideSpots: [
    { layer: 'mid', x: 1945, y: 398, w: 80 },
    { layer: 'mid', x: TOWER_X - 8, y: 229, w: 20 },
    { layer: 'mid', x: 216, y: FIRE_TOWER_Y - 2, w: 20 },
    { layer: 'far', x: 1552, y: FAR_BASE - 148, w: 26 },
    { layer: 'near', x: 2345, y: 604, w: 40 },
  ],
};
