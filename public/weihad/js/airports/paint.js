// Gemeinsame Mal-Helfer für alle Flughafen-Szenen.
// Alle Koordinaten in Welteinheiten (Ebenen-Koordinaten). Für Szenerie-Agents nur lesen –
// eigene Helfer bitte in die eigene Szenen-Datei.

export function linearSky(ctx, w, h, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function glow(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

export function stars(ctx, rng, w, yMax, count, { minR = 0.4, maxR = 1.4, alpha = 0.9 } = {}) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const y = rng.next() ** 1.6 * yMax; // oben dichter
    ctx.globalAlpha = alpha * (1 - y / yMax) * rng.range(0.4, 1);
    ctx.fillStyle = rng.chance(0.15) ? '#cfe0ff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(rng.range(0, w), y, rng.range(minR, maxR), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function moon(ctx, x, y, r, { color = '#f4f1e1', glowColor = 'rgba(255,250,220,0.35)', phase = 0.35 } = {}) {
  glow(ctx, x, y, r * 5, glowColor);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Krater
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#7b7766';
  for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.16], [0.1, -0.45, 0.1], [-0.15, 0.4, 0.12]]) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (phase > 0) {
    // Sichel-Schatten
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.restore();
  }
}

export function sun(ctx, x, y, r, { core = '#fff6d8', color = 'rgba(255,190,90,0.55)' } = {}) {
  glow(ctx, x, y, r * 7, color);
  glow(ctx, x, y, r * 2.2, 'rgba(255,240,200,0.8)');
  ctx.save();
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Weiche Wolke aus überlappenden Ellipsen
export function cloud(ctx, rng, x, y, w, h, { color = '#ffffff', alpha = 0.8, shade = 'rgba(0,0,0,0.08)' } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const n = Math.max(4, Math.round(w / (h * 0.9)));
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const px = x + (i + 0.5) * (w / n) + rng.range(-w / n / 3, w / n / 3);
    const rr = h * rng.range(0.45, 0.8) * (1 - Math.abs(i / (n - 1 || 1) - 0.5) * 0.7);
    puffs.push([px, y - rr * 0.35, rr]);
  }
  ctx.fillStyle = color;
  for (const [px, py, rr] of puffs) {
    ctx.beginPath();
    ctx.ellipse(px, py, rr * 1.3, rr, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(x + w * 0.08, y - h * 0.15, w * 0.84, h * 0.3);
  // Schattierung unten
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = shade;
  ctx.fillRect(x - w * 0.2, y, w * 1.4, h);
  ctx.restore();
}

// Hügel-/Bergsilhouette als gefüllte Polylinie bis zum Boden
export function hills(ctx, rng, { w, baseY, amp, step = 40, color, rough = 0.5, h = 720 }) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10, h);
  let y = baseY - rng.range(0, amp);
  for (let x = -10; x <= w + step; x += step) {
    y += rng.range(-amp, amp) * rough;
    y = Math.max(baseY - amp, Math.min(baseY, y));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w + 10, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Fensterraster; lit = Anteil beleuchteter Fenster
export function windows(ctx, rng, x, y, w, h, {
  cols, rows, lit = 0.6, on = '#ffd98a', off = 'rgba(20,30,50,0.6)', padX = 0.18, padY = 0.25,
} = {}) {
  cols ||= Math.max(1, Math.floor(w / 6));
  rows ||= Math.max(1, Math.floor(h / 8));
  const cw = w / cols;
  const rh = h / rows;
  ctx.save();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = rng.chance(lit) ? on : off;
      ctx.globalAlpha = rng.range(0.75, 1);
      ctx.fillRect(x + c * cw + cw * padX, y + r * rh + rh * padY, cw * (1 - padX * 2), rh * (1 - padY * 2));
    }
  }
  ctx.restore();
}

// Hochhaus; y = Grundlinie (unten)
export function building(ctx, rng, {
  x, y, w, h, color = '#1c2538', light = null, lit = 0.5, roof = 'flat', edge = 'rgba(255,255,255,0.06)',
}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x, y - h, w, h);
  // Dach
  ctx.beginPath();
  if (roof === 'spire') {
    ctx.moveTo(x + w * 0.5 - 1.2, y - h);
    ctx.lineTo(x + w * 0.5, y - h - h * 0.25);
    ctx.lineTo(x + w * 0.5 + 1.2, y - h);
  } else if (roof === 'pyramid') {
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w / 2, y - h - w * 0.6);
    ctx.lineTo(x + w, y - h);
  } else if (roof === 'slant') {
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w, y - h - w * 0.4);
    ctx.lineTo(x + w, y - h);
  } else if (roof === 'antenna') {
    ctx.rect(x + w * 0.48, y - h - h * 0.15, Math.max(1, w * 0.04), h * 0.15);
  }
  ctx.fill();
  // Kante für Tiefe
  ctx.fillStyle = edge;
  ctx.fillRect(x, y - h, Math.max(1, w * 0.08), h);
  if (light) windows(ctx, rng, x + w * 0.08, y - h + 4, w * 0.84, h - 6, { lit, on: light });
  ctx.restore();
}

// Schneehaube auf einer Oberkante
export function snowCap(ctx, x, y, w, thick = 3, color = '#f4f8ff') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 1, y + 0.5);
  const n = Math.max(2, Math.round(w / 8));
  for (let i = 0; i <= n; i++) {
    const px = x + (i / n) * w;
    ctx.quadraticCurveTo(px - w / n / 2, y - thick * (0.8 + ((i * 7) % 3) * 0.2), px, y - thick * 0.6);
  }
  ctx.lineTo(x + w + 1, y + 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function pineTree(ctx, x, baseY, h, { color = '#173a2a', snow = true, trunk = '#3b2a1e' } = {}) {
  ctx.save();
  ctx.fillStyle = trunk;
  ctx.fillRect(x - h * 0.04, baseY - h * 0.15, h * 0.08, h * 0.15);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const ty = baseY - h * 0.12 - i * h * 0.22;
    const tw = h * (0.42 - i * 0.08);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - tw, ty);
    ctx.lineTo(x, ty - h * 0.38);
    ctx.lineTo(x + tw, ty);
    ctx.closePath();
    ctx.fill();
    if (snow) {
      ctx.fillStyle = 'rgba(240,246,255,0.92)';
      ctx.beginPath();
      ctx.moveTo(x - tw * 0.55, ty - h * 0.17);
      ctx.lineTo(x, ty - h * 0.38);
      ctx.lineTo(x + tw * 0.55, ty - h * 0.17);
      ctx.quadraticCurveTo(x, ty - h * 0.12, x - tw * 0.55, ty - h * 0.17);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function palmTree(ctx, x, baseY, h, { lean = 0.15, trunk = '#6b4a2b', leaf = '#1f6b3a' } = {}) {
  ctx.save();
  const topX = x + h * lean;
  const topY = baseY - h;
  ctx.strokeStyle = trunk;
  ctx.lineWidth = h * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + h * lean * 0.2, baseY - h * 0.6, topX, topY);
  ctx.stroke();
  ctx.fillStyle = leaf;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.48;
    const len = h * 0.42;
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.6 + len * 0.35;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.9 - len * 0.1, ex, ey);
    ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.5, topY + Math.sin(a) * len * 0.5, topX, topY + 2);
    ctx.fill();
  }
  ctx.restore();
}

// Piste in Seitenansicht: flaches Band mit Markierungen. y = Mittellinie, depth = sichtbare Tiefe
export function runway(ctx, x1, x2, y, { depth = 18, color = '#2c2f36', marking = 'rgba(255,255,255,0.85)', shoulder = '#3b3f47' } = {}) {
  ctx.save();
  ctx.fillStyle = shoulder;
  ctx.fillRect(x1 - 6, y - depth / 2 - 2, x2 - x1 + 12, depth + 4);
  ctx.fillStyle = color;
  ctx.fillRect(x1, y - depth / 2, x2 - x1, depth);
  ctx.fillStyle = marking;
  // Mittellinie
  for (let x = x1 + 60; x < x2 - 60; x += 46) ctx.fillRect(x, y - 0.6, 24, 1.2);
  // Schwellen-Streifen an beiden Enden
  for (const sx of [x1 + 6, x2 - 30]) {
    for (let i = 0; i < 5; i++) ctx.fillRect(sx + i * 5, y - depth / 2 + 2, 3, depth - 4);
  }
  // Randlinien
  ctx.globalAlpha = 0.6;
  ctx.fillRect(x1, y - depth / 2 + 1, x2 - x1, 0.8);
  ctx.fillRect(x1, y + depth / 2 - 1.8, x2 - x1, 0.8);
  ctx.restore();
}

// Maschendrahtzaun (y = Unterkante)
export function fence(ctx, x1, x2, y, h, { color = 'rgba(160,170,180,0.55)', post = '#5d646d' } = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let x = x1; x < x2; x += 7) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + h * 0.5, y - h);
    ctx.moveTo(x + h * 0.5, y);
    ctx.lineTo(x, y - h);
  }
  ctx.stroke();
  ctx.fillStyle = post;
  for (let x = x1; x <= x2; x += 60) ctx.fillRect(x - 1.5, y - h - 4, 3, h + 4);
  ctx.fillRect(x1, y - h - 1, x2 - x1, 2);
  ctx.restore();
}

// Generischer Kontrollturm, y = Grundlinie
export function controlTower(ctx, x, baseY, h, {
  color = '#c9ced6', shade = '#9aa1ab', glass = '#7fb2d9', cabW = 46, snow = false,
} = {}) {
  ctx.save();
  const shaftW = cabW * 0.32;
  // Schaft
  const g = ctx.createLinearGradient(x - shaftW / 2, 0, x + shaftW / 2, 0);
  g.addColorStop(0, color);
  g.addColorStop(1, shade);
  ctx.fillStyle = g;
  ctx.fillRect(x - shaftW / 2, baseY - h, shaftW, h);
  // Kanzel
  const cabY = baseY - h;
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(x - cabW * 0.35, cabY + 10);
  ctx.lineTo(x - cabW / 2, cabY - 4);
  ctx.lineTo(x + cabW / 2, cabY - 4);
  ctx.lineTo(x + cabW * 0.35, cabY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(x - cabW / 2, cabY - 4);
  ctx.lineTo(x - cabW * 0.56, cabY - 20);
  ctx.lineTo(x + cabW * 0.56, cabY - 20);
  ctx.lineTo(x + cabW / 2, cabY - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(x - cabW * 0.58, cabY - 26, cabW * 1.16, 6);
  ctx.fillRect(x - 1, cabY - 44, 2, 18); // Antenne
  if (snow) snowCap(ctx, x - cabW * 0.58, cabY - 26, cabW * 1.16, 3);
  ctx.restore();
  return { cabTopY: cabY - 26, antennaY: cabY - 44 };
}

// Lichterkette entlang von Punkten (statisch – Funkeln in drawDynamic)
export function lightString(ctx, pts, { colors = ['#ff4b4b', '#ffd34b', '#4bff7a', '#4bc3ff'], r = 1.4, wire = 'rgba(30,30,30,0.6)', spacing = 8 } = {}) {
  ctx.save();
  ctx.strokeStyle = wire;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
  let k = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    for (let d = 0; d < len; d += spacing) {
      const px = ax + ((bx - ax) * d) / len;
      const py = ay + ((by - ay) * d) / len + Math.sin((d / len) * Math.PI) * 3;
      const c = colors[k++ % colors.length];
      glow(ctx, px, py, r * 4, c, 0.5);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function groundGradient(ctx, w, y0, y1, top, bottom) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(-10, y0, w + 20, y1 - y0);
}

// Hilfsfunktion für blinkende Lichter in drawDynamic: 0..1
export function blink(t, period = 1, duty = 0.15, phase = 0) {
  return ((t / period + phase) % 1) < duty ? 1 : 0;
}
