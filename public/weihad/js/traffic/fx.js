// Einmalig vorgerenderte Effekt-Sprites (Leuchtpunkte, Rauch, Kondensstreifen, Lichtkegel, Schatten)
let cache = null;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function glowSprite(r, g, b) {
  const S = 64;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, `rgba(255,255,255,1)`);
  grd.addColorStop(0.12, `rgba(${r},${g},${b},0.95)`);
  grd.addColorStop(0.35, `rgba(${r},${g},${b},0.35)`);
  grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, S, S);
  return c;
}

function puffSprite(shade) {
  const S = 64;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  // mehrere weiche Kreise → unregelmäßige Wolke
  const blobs = [[32, 34, 22], [22, 30, 14], [42, 28, 15], [30, 22, 13], [38, 40, 14]];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${shade},${shade},${shade},0.55)`);
    g.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  return c;
}

// Kondensstreifen: rechts (am Flugzeug) zwei dünne Linien, nach links breiter, welliger und blasser
function contrailSprite() {
  const W = 512;
  const H = 64;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const steps = 160;
  for (let i = 0; i < steps; i++) {
    const u = i / (steps - 1); // 0 = altes Ende, 1 = am Flugzeug
    const old = 1 - u;
    const x = u * W;
    const fadeIn = Math.min(1, old / 0.04); // kurze Lücke hinter dem Triebwerk
    const spread = 1.8 + Math.pow(old, 1.25) * 20;
    // breitere Wolke → weniger Deckkraft pro Fläche
    const a = Math.pow(u, 0.7) * fadeIn * (0.55 - 0.3 * old);
    const wob = Math.sin(u * 8.5) * old * 3.5 + Math.sin(u * 21 + 1) * old * 1.4;
    const sep = 3 * Math.min(1, u * 1.5);
    for (const dy of sep > 0.6 ? [-sep, sep] : [0]) {
      const cy = H / 2 + dy + wob;
      const g = ctx.createRadialGradient(x, cy, 0, x, cy, spread);
      g.addColorStop(0, `rgba(255,255,255,${(a * 0.5).toFixed(3)})`);
      g.addColorStop(0.5, `rgba(255,255,255,${(a * 0.22).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - spread, cy - spread, spread * 2, spread * 2);
    }
  }
  return c;
}

// Landescheinwerfer-Kegel: Spitze links in der Mitte, öffnet sich nach rechts
function coneSprite() {
  const W = 256;
  const H = 96;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(255,248,225,0.3)');
  g.addColorStop(0.3, 'rgba(255,244,215,0.13)');
  g.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = g;
  // verschachtelte Keile → weiche Ränder ohne Filter
  for (let i = 0; i < 6; i++) {
    const spread = (H / 2 - 4) * (0.35 + i * 0.13);
    ctx.beginPath();
    ctx.moveTo(2, H / 2 - 1);
    ctx.lineTo(W, H / 2 - spread);
    ctx.lineTo(W, H / 2 + spread);
    ctx.lineTo(2, H / 2 + 1);
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

function ellipseSprite(color, inner) {
  const W = 128;
  const H = 32;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.save();
  ctx.scale(1, H / W);
  const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  g.addColorStop(0, `rgba(${color},${inner})`);
  g.addColorStop(0.55, `rgba(${color},${(inner * 0.55).toFixed(3)})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);
  ctx.restore();
  return c;
}

export function fx() {
  if (cache) return cache;
  cache = {
    glow: {
      white: glowSprite(235, 245, 255),
      warm: glowSprite(255, 236, 190),
      red: glowSprite(255, 50, 40),
      green: glowSprite(40, 255, 120),
      amber: glowSprite(255, 170, 40),
    },
    puff: puffSprite(255),
    smoke: puffSprite(205),
    contrail: contrailSprite(),
    cone: coneSprite(),
    shadow: ellipseSprite('0,0,0', 0.55),
    pool: ellipseSprite('255,238,200', 0.5),
  };
  return cache;
}
