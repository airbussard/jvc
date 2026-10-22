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
    this._pending = 0;
    const schedule = () => {
      cancelAnimationFrame(this._pending);
      this._pending = requestAnimationFrame(() => this.resize());
    };
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', () => setTimeout(schedule, 120));
    window.visualViewport?.addEventListener('resize', schedule);
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
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (changed) for (const cb of this.listeners) cb(this);
  }

  get viewW() {
    return this.cssW / this.scale;
  }
}
