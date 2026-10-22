// Schneefall-Overlay in Bildschirmkoordinaten: drei Tiefenschichten, schwenkt mit der Kamera mit, Wind
const BANDS = [
  // count: Flocken bei 1280×720, snow=1, quality=1 · size in CSS-px bei scale 1 · vy px/s
  { L: 'far', count: 120, size: [1.2, 2.1], vy: [26, 46], alpha: 0.55, wind: 0.5, par: 0.9 },
  { L: 'mid', count: 70, size: [2.2, 3.6], vy: [52, 84], alpha: 0.8, wind: 0.8, par: 1 },
  { L: 'near', count: 16, size: [5, 8.5], vy: [110, 170], alpha: 0.75, wind: 1.2, par: 1.15 },
];

let flakeCanvas = null;
function flakeSprite() {
  if (flakeCanvas) return flakeCanvas;
  flakeCanvas = document.createElement('canvas');
  flakeCanvas.width = flakeCanvas.height = 32;
  const g = flakeCanvas.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return flakeCanvas;
}

export class Snow {
  constructor(view, intensity = 0) {
    this.view = view;
    this.intensity = Math.max(0, Math.min(1, intensity || 0));
    this.bands = BANDS.map((b) => ({ ...b, flakes: [], lastOff: null }));
    this.t = Math.random() * 100;
  }

  _target(b) {
    const v = this.view;
    const area = Math.max(0.3, (v.cssW * v.cssH) / (1280 * 720));
    return Math.round(b.count * this.intensity * (v.quality ?? 1) * Math.sqrt(area));
  }

  _spawn(b, anywhere) {
    const v = this.view;
    const r = Math.random;
    return {
      x: r() * (v.cssW + 40) - 20,
      y: anywhere ? r() * v.cssH : -10 - r() * 30,
      size: b.size[0] + r() * (b.size[1] - b.size[0]),
      vy: b.vy[0] + r() * (b.vy[1] - b.vy[0]),
      ph: r() * Math.PI * 2,
      f: 0.6 + r() * 1.4,
      amp: 6 + r() * 16,
    };
  }

  update(dt) {
    if (this.intensity <= 0) return;
    const v = this.view;
    this.t += dt;
    const k = Math.max(0.5, v.scale);
    const wind = (16 + 22 * Math.sin(this.t * 0.21) + 10 * Math.sin(this.t * 0.73 + 1)) * k;
    for (const b of this.bands) {
      const target = this._target(b);
      while (b.flakes.length < target) b.flakes.push(this._spawn(b, b.lastOff === null));
      if (b.flakes.length > target) b.flakes.length = target;
      // Kameraschwenk: Flocken wandern mit ihrer Tiefenebene
      const off = v.layerOffset(b.L);
      const dx = b.lastOff === null ? 0 : (off - b.lastOff) * v.scale * b.par;
      b.lastOff = off;
      const W = v.cssW + 40, H = v.cssH;
      for (const f of b.flakes) {
        f.ph += dt * f.f;
        f.x += (wind * b.wind + Math.cos(f.ph) * f.amp) * dt - dx;
        f.y += f.vy * k * dt;
        if (f.y > H + 12) {
          f.y = -12;
          f.x = Math.random() * W - 20;
        }
        if (f.x < -20) f.x += W;
        else if (f.x > W - 20) f.x -= W;
      }
    }
  }

  draw(ctx) {
    if (this.intensity <= 0) return;
    const img = flakeSprite();
    const k = Math.max(0.55, this.view.scale);
    ctx.save();
    for (const b of this.bands) {
      ctx.globalAlpha = b.alpha;
      for (const f of b.flakes) {
        const r = f.size * k;
        ctx.drawImage(img, f.x - r, f.y - r, r * 2, r * 2);
      }
    }
    ctx.restore();
  }
}
