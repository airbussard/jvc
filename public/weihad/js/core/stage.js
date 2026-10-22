import { WORLD_H, MAX_ASPECT, MAX_DPR } from '../config.js';

// Verwaltet Canvas-Größe, DPR und Pillarbox für extrem breite Bildschirme
export class Stage {
  constructor(container, canvas) {
    this.container = container;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.cssW = 1;
    this.cssH = 1;
    this.dpr = 1;
    this.scale = 1;
    this.listeners = [];
    // Nur vormerken: main.js ruft sync() am Frame-Anfang vor dem Zeichnen auf. Ein eigener rAF
    // lief nach dem Render und hinterließ für ein Frame eine geleerte (schwarze) Canvas.
    this._dirty = false;
    const mark = () => { this._dirty = true; };
    window.addEventListener('resize', mark);
    window.addEventListener('orientationchange', () => setTimeout(mark, 120));
    window.visualViewport?.addEventListener('resize', mark);
    this.resize();
  }

  sync() {
    if (!this._dirty) return;
    this._dirty = false;
    this.resize();
  }

  onResize(cb) {
    this.listeners.push(cb);
  }

  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(vw, Math.round(vh * MAX_ASPECT));
    const h = vh;
    this.container.style.width = `${w}px`;
    this.container.style.height = `${h}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const changed = w !== this.cssW || h !== this.cssH || dpr !== this.dpr;
    this.cssW = w;
    this.cssH = h;
    this.dpr = dpr;
    this.scale = h / WORLD_H;
    // Zuweisen leert die Bitmap – nur bei echter Änderung
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (this.canvas.width !== pw) this.canvas.width = pw;
    if (this.canvas.height !== ph) this.canvas.height = ph;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (changed) for (const cb of this.listeners) cb(this);
  }

  get viewW() {
    return this.cssW / this.scale;
  }
}
