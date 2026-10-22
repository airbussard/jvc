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

  rebuild() {
    const a = this.airport;
    if (!a) return;
    const seed = hashString(a.id);
    for (const id of PARALLAX_LAYERS) {
      const top = Math.max(0, Math.min(WORLD_H - 1, a.layerTop?.[id] ?? 0));
      const w = LAYER_W[id];
      const h = WORLD_H - top;
      const res = this._res(w, h);
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
    this.rebuildSky();
  }

  rebuildSky() {
    const a = this.airport;
    if (!a) return;
    const w = Math.ceil(this.view.viewW);
    const res = this._res(w, WORLD_H);
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

  // ctx muss bereits per view.apply(ctx, id) transformiert sein
  drawStatic(ctx, id) {
    if (id === 'sky') {
      if (!this.sky) return;
      ctx.drawImage(this.sky.canvas, 0, 0, this.sky.w, WORLD_H);
      return;
    }
    const L = this.layers[id];
    if (!L) return;
    const off = Math.max(0, this.view.layerOffset(id));
    const vw = Math.min(this.view.viewW, LAYER_W[id] - off);
    const sx = off * L.res;
    const sw = Math.min(L.canvas.width - sx, vw * L.res);
    if (sw <= 0) return;
    ctx.drawImage(L.canvas, sx, 0, sw, L.canvas.height, off, L.top, sw / L.res, L.canvas.height / L.res);
  }
}
