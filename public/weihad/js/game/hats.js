// Weihnachtsmützen: vorgerendertes Sprite + geworfene Mützen (Overlay, Bildschirmkoordinaten)

const HAT_RES = 5; // Pixel pro Mützen-Einheit im Sprite
const BOX = { x0: -25, y0: -54, x1: 33, y1: 7 }; // Mützen-Einheiten, Ursprung = Mitte Unterkante Krempe
let hatSprite = null;

function paintHat(g) {
  // Kegel (Schlappmütze, Spitze kippt nach hinten-rechts)
  const cone = g.createLinearGradient(-16, -40, 16, -6);
  cone.addColorStop(0, '#ff4a57');
  cone.addColorStop(0.55, '#d81e2f');
  cone.addColorStop(1, '#8f0d1a');
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.fillStyle = cone;
  g.strokeStyle = '#4a0610';
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(-17, -7);
  g.bezierCurveTo(-15, -26, -8, -44, 6, -47);
  g.bezierCurveTo(16, -49, 24, -44, 25, -36);
  g.bezierCurveTo(19, -38, 13, -36, 11, -30);
  g.bezierCurveTo(13, -22, 16, -14, 17, -7);
  g.closePath();
  g.fill();
  g.stroke();
  // Glanzlicht und Falte
  g.strokeStyle = 'rgba(255,190,190,0.55)';
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(-10, -12);
  g.bezierCurveTo(-9, -24, -4, -36, 4, -41);
  g.stroke();
  g.strokeStyle = 'rgba(80,0,10,0.45)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(9, -31);
  g.quadraticCurveTo(6, -20, 8, -9);
  g.stroke();

  // Bommel
  const pom = g.createRadialGradient(24, -40, 1, 26, -37, 9);
  pom.addColorStop(0, '#ffffff');
  pom.addColorStop(0.7, '#f1f4f8');
  pom.addColorStop(1, '#c9d2dc');
  g.fillStyle = pom;
  g.strokeStyle = '#6b7380';
  g.lineWidth = 1.4;
  g.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 2 ? 7.2 : 8.4;
    g.lineTo(26 + Math.cos(a) * r, -36 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.stroke();

  // Fellkrempe mit Knubbeln
  const fur = g.createLinearGradient(0, -12, 0, 5);
  fur.addColorStop(0, '#ffffff');
  fur.addColorStop(1, '#cfd8e2');
  g.fillStyle = fur;
  g.strokeStyle = '#6b7380';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(-21, -3);
  const bumps = 7;
  for (let i = 0; i <= bumps; i++) {
    const x = -21 + (42 * i) / bumps;
    g.quadraticCurveTo(x - 3, -14 + (i % 2) * 1.5, x, -10.5);
  }
  g.quadraticCurveTo(25, -4, 21, 3);
  for (let i = bumps; i >= 0; i--) {
    const x = -21 + (42 * i) / bumps;
    g.quadraticCurveTo(x + 3, 6 - (i % 2) * 1.2, x, 3.5);
  }
  g.quadraticCurveTo(-25, 1, -21, -3);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(150,165,185,0.35)';
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(-15 + i * 6.2, -2 + (i % 2) * 2, 1.6, 0, Math.PI * 2);
    g.fill();
  }
}

export function getHatSprite() {
  if (hatSprite) return hatSprite;
  const w = BOX.x1 - BOX.x0;
  const h = BOX.y1 - BOX.y0;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * HAT_RES);
  canvas.height = Math.ceil(h * HAT_RES);
  const g = canvas.getContext('2d');
  g.setTransform(HAT_RES, 0, 0, HAT_RES, -BOX.x0 * HAT_RES, -BOX.y0 * HAT_RES);
  paintHat(g);
  // ox/oy: Anker (Krempen-Unterkante) als Anteil der Spritegröße; Breite 42 = Krempe
  hatSprite = { canvas, w, h, ox: -BOX.x0 / w, oy: -BOX.y0 / h, aspect: h / w, brim: 42 / w };
  return hatSprite;
}

// Mütze im aktuellen Koordinatensystem zeichnen; width = Krempenbreite
export function drawHat(ctx, x, y, width, rot = 0) {
  const hs = getHatSprite();
  const w = width / hs.brim;
  const h = w * hs.aspect;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(hs.canvas, -w * hs.ox, -h * hs.oy, w, h);
  ctx.restore();
}

export const HAT_FLIGHT = 0.18;

// Geworfene Mützen fliegen vom unteren Bildschirmrand perspektivisch kleiner werdend zum Ziel
export class HatThrows {
  constructor(view) {
    this.view = view;
    this.list = [];
  }

  // Ziel in Ebenen-Koordinaten (schwenkt mit); track() liefert optional die aktuelle Zielposition.
  // endW = Krempenbreite am Ziel in CSS-px, flip = gespiegelt (Adler blickt nach links)
  throw({ sx, L, x, y, track = null, endW, endRot = -0.3, flip = false, onLand }) {
    const v = this.view;
    const startX = v.cssW * 0.5 + (sx - v.cssW * 0.5) * 0.45 + (Math.random() - 0.5) * v.cssW * 0.06;
    const startY = v.cssH * 1.08;
    const startW = Math.max(60, v.cssH * 0.2);
    this.list.push({
      t: 0, dur: HAT_FLIGHT, x0: startX, y0: startY, L, x, y, track, startW, endW: Math.max(5, endW),
      rot0: (Math.random() - 0.5) * 0.8, rot1: endRot + Math.PI * 2 * (sx < startX ? -1 : 1), flip, onLand,
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i];
      h.t += dt;
      if (h.t >= h.dur) {
        this.list.splice(i, 1);
        h.onLand?.();
      }
    }
  }

  // Alle Mützen sofort landen lassen (Rundenende)
  flush() {
    const list = this.list.splice(0);
    for (const h of list) h.onLand?.();
  }

  _pose(h, t) {
    const v = this.view;
    if (h.track) {
      const p = h.track();
      h.x = p[0];
      h.y = p[1];
    }
    const tx = (h.x - v.layerOffset(h.L)) * v.scale;
    const ty = h.y * v.scale;
    const k = Math.min(1, t / h.dur);
    const e = 1 - (1 - k) * (1 - k);
    // Wurfbogen: Kontrollpunkt über der Mitte
    const cx = (h.x0 + tx) * 0.5;
    const cy = Math.min(h.y0, ty) - v.cssH * 0.12;
    const u = 1 - e;
    return {
      x: u * u * h.x0 + 2 * u * e * cx + e * e * tx,
      y: u * u * h.y0 + 2 * u * e * cy + e * e * ty,
      w: h.startW * Math.pow(h.endW / h.startW, e),
      r: h.rot0 + (h.rot1 - h.rot0) * e,
    };
  }

  drawOverlay(ctx) {
    if (!this.list.length) return;
    const hs = getHatSprite();
    ctx.save();
    for (const h of this.list) {
      // zwei Nachbilder als Bewegungsspur
      for (let j = 2; j >= 0; j--) {
        if (h.t - j * 0.012 < 0) continue;
        const p = this._pose(h, h.t - j * 0.012);
        const w = p.w / hs.brim;
        const hh = w * hs.aspect;
        ctx.globalAlpha = j === 0 ? 1 : 0.22 / j;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        if (h.flip) ctx.scale(-1, 1);
        ctx.drawImage(hs.canvas, -w * hs.ox, -hh * hs.oy, w, hh);
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
