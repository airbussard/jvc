import { LAYER_W, WORLD_H } from '../config.js';

// Kamera mit Parallaxe: jede Ebene hat eine eigene Breite, pan ∈ [0,1] verschiebt alle anteilig.
export class View {
  constructor(stage) {
    this.stage = stage;
    this.pan = 0.5;
    this.t = 0; // Laufzeit in Sekunden (wird von main.js gesetzt)
  }

  get scale() { return this.stage.scale; }
  get dpr() { return this.stage.dpr; }
  get viewW() { return this.stage.viewW; }
  get viewH() { return WORLD_H; }
  get cssW() { return this.stage.cssW; }
  get cssH() { return this.stage.cssH; }

  layerW(id) {
    return id === 'sky' ? this.viewW : LAYER_W[id];
  }

  // Welt-x der linken Bildschirmkante in der jeweiligen Ebene
  layerOffset(id) {
    if (id === 'sky') return 0;
    const extra = LAYER_W[id] - this.viewW;
    // Ebene schmaler als der Bildschirm → zentrieren
    return extra >= 0 ? this.pan * extra : extra / 2;
  }

  // Versatz der Ebene in ganzen Gerätepixeln – die Kulisse (scene-renderer) und alles,
  // was per apply() in die Ebene zeichnet, bleiben so pixelgenau deckungsgleich
  deviceOffset(id) {
    return Math.round(this.layerOffset(id) * this.scale * this.dpr);
  }

  // Setzt die Transformation so, dass in Ebenen-Weltkoordinaten gezeichnet werden kann
  apply(ctx, id) {
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, -this.deviceOffset(id), 0);
  }

  // Bildschirmkoordinaten in CSS-Pixeln
  applyScreen(ctx) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  toLayer(id, sx, sy) {
    return { x: sx / this.scale + this.layerOffset(id), y: sy / this.scale };
  }

  toScreen(id, x, y) {
    return { x: (x - this.layerOffset(id)) * this.scale, y: y * this.scale };
  }

  // Ist Ebenen-x (± margin) im sichtbaren Bereich?
  isVisible(id, x, margin = 0) {
    const off = this.layerOffset(id);
    return x >= off - margin && x <= off + this.viewW + margin;
  }

  // Horizontale Position auf dem Bildschirm als -1..1 (für Stereo-Panning von Sounds)
  stereo(id, x) {
    const sx = (x - this.layerOffset(id)) / this.viewW;
    return Math.max(-1, Math.min(1, sx * 2 - 1));
  }

  // Schwenken um dx Einheiten der near-Ebene
  panBy(dx) {
    const range = Math.max(1, LAYER_W.near - this.viewW);
    this.pan = Math.max(0, Math.min(1, this.pan + dx / range));
  }
}
