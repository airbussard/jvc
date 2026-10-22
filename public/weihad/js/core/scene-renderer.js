import { LAYER_W, WORLD_H, MAX_LAYER_PIXELS, PARALLAX_LAYERS } from '../config.js';
import { createRng, hashString } from './rng.js';

// Rendert die statischen Teile einer Flughafen-Szene einmalig in Offscreen-Canvas
// und zeichnet pro Frame nur den sichtbaren Ausschnitt.
export class SceneRenderer {
  constructor(stage, view) {
    this.stage = stage;
    this.view = view;
    this.airport = null;
    this.layers = {}; // id → { canvas, res, top }
    this.sky = null;
  }

  setAirport(airport) {
    this.airport = airport;
    this.rebuild();
  }

  // Auflösung (Pixel pro Welteinheit) – begrenzt, damit Handys nicht am Speicher scheitern
  _res(w, h) {
    const wanted = this.view.scale * this.view.dpr;
    return Math.max(0.25, Math.min(wanted, Math.sqrt(MAX_LAYER_PIXELS / (w * h))));
  }

  // onlyChanged (nach Resize): nur Ebenen neu malen, deren Auflösung sich geändert hat
  rebuild(onlyChanged = false) {
    const a = this.airport;
    if (!a) return;
    const seed = hashString(a.id);
    for (const id of PARALLAX_LAYERS) {
      const top = Math.max(0, Math.min(WORLD_H - 1, a.layerTop?.[id] ?? 0));
      const w = LAYER_W[id];
      const h = WORLD_H - top;
      const res = this._res(w, h);
      if (onlyChanged && this.layers[id]?.res === res) continue;
      const canvas = this.layers[id]?.canvas || document.createElement('canvas');
      canvas.width = Math.ceil(w * res);
      canvas.height = Math.ceil(h * res);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(res, 0, 0, res, 0, -top * res);
      try {
        a.paintLayer?.(ctx, id, { w, h: WORLD_H, rng: createRng(seed ^ hashString(id)) });
      } catch (err) {
        console.error(`[weihad] paintLayer ${a.id}/${id} fehlgeschlagen`, err);
      }
      this.layers[id] = { canvas, res, top };
    }
    this.rebuildSky(onlyChanged);
  }

  rebuildSky(onlyChanged = false) {
    const a = this.airport;
    if (!a) return;
    const w = Math.ceil(this.view.viewW);
    const res = this._res(w, WORLD_H);
    if (onlyChanged && this.sky?.w === w && this.sky.res === res) return;
    const canvas = this.sky?.canvas || document.createElement('canvas');
    canvas.width = Math.ceil(w * res);
    canvas.height = Math.ceil(WORLD_H * res);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(res, 0, 0, res, 0, 0);
    try {
      a.paintSky?.(ctx, { w, h: WORLD_H, rng: createRng(hashString(a.id) ^ 0x5eed) });
    } catch (err) {
      console.error(`[weihad] paintSky ${a.id} fehlgeschlagen`, err);
    }
    this.sky = { canvas, res, w };
  }

  // Blittet in Gerätepixeln auf ganzzahlige Positionen: bei res == k eine reine 1:1-Kopie ohne
  // Filterung (Software-Canvas ~4× schneller, Kulisse bleibt scharf). Hinterlässt ctx wie
  // view.apply(ctx, id), weil danach drawDynamic/Verkehr in Ebenen-Koordinaten zeichnen.
  drawStatic(ctx, id) {
    const v = this.view;
    const k = v.scale * v.dpr;
    const L = id === 'sky' ? this.sky : this.layers[id];
    if (!L) return;
    const s = k / L.res; // Gerätepixel je Quellpixel
    let sx = 0;
    let sw = L.canvas.width;
    let dx = 0;
    let dy = 0;
    if (id !== 'sky') {
      sx = Math.round(Math.max(0, v.layerOffset(id)) * L.res);
      sw = Math.min(L.canvas.width - sx, Math.ceil(v.viewW * L.res) + 2);
      if (sw <= 0) return;
      dx = Math.round(sx * s - v.deviceOffset(id));
      dy = Math.round(L.top * k);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(L.canvas, sx, 0, sw, L.canvas.height, dx, dy, Math.round(sw * s), Math.round(L.canvas.height * s));
    v.apply(ctx, id);
  }
}
