// Einheitliche Eingabe für Maus, Touch, Stift und Tastatur.
// Events: 'shoot'(sx, sy, pointerType) · 'reload' · 'pause' · 'mute' · 'gesture' · 'touchmode'(bool)
export class Input {
  constructor(canvas, { forceTouch = false } = {}) {
    this.canvas = canvas;
    this.handlers = {};
    this.pointer = { x: 0, y: 0, inside: false, type: 'mouse' };
    this.keys = new Set();
    this.holdPan = 0; // von Touch-Halteleisten gesetzt (-1 | 0 | 1)
    this.enabled = true;
    this.isTouch = forceTouch || window.matchMedia?.('(pointer: coarse)').matches || false;
    this._gestured = false;

    canvas.addEventListener('pointerdown', (e) => this._down(e));
    canvas.addEventListener('pointermove', (e) => this._move(e));
    canvas.addEventListener('pointerleave', () => { this.pointer.inside = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => this.keys.clear());
    // Doppeltipp-Zoom / Scrollen auf iOS verhindern
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  on(name, cb) {
    (this.handlers[name] ||= []).push(cb);
  }

  emit(name, ...args) {
    for (const cb of this.handlers[name] || []) cb(...args);
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _gesture() {
    if (!this._gestured) {
      this._gestured = true;
      this.emit('gesture');
    }
  }

  _setTouch(isTouch) {
    if (isTouch !== this.isTouch) {
      this.isTouch = isTouch;
      this.emit('touchmode', isTouch);
    }
  }

  _down(e) {
    this._gesture();
    const p = this._pos(e);
    this.pointer = { ...p, inside: true, type: e.pointerType || 'mouse' };
    if (e.pointerType === 'touch') this._setTouch(true);
    else if (e.pointerType === 'mouse') this._setTouch(false);
    if (!this.enabled) return;
    if (e.button === 2) {
      e.preventDefault();
      this.emit('reload');
      return;
    }
    if (e.button === 0) this.emit('shoot', p.x, p.y, this.pointer.type);
  }

  _move(e) {
    const p = this._pos(e);
    this.pointer = { ...p, inside: true, type: e.pointerType || 'mouse' };
    if (e.pointerType === 'mouse' && this.isTouch && Math.abs(e.movementX) + Math.abs(e.movementY) > 0) {
      this._setTouch(false);
    }
  }

  _key(e, down) {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (down) {
      this._gesture();
      if (!e.repeat) {
        // Nur im Spiel abfangen – in Menüs soll die Leertaste fokussierte Buttons auslösen
        if ((k === ' ' || k === 'r') && this.enabled) { e.preventDefault(); this.emit('reload'); }
        else if (k === 'escape' || k === 'p') this.emit('pause');
        else if (k === 'm') this.emit('mute');
      }
      this.keys.add(k);
    } else {
      this.keys.delete(k);
    }
  }

  // -1 / 0 / 1 aus Tastatur + Halteleisten
  get panDir() {
    let d = this.holdPan;
    if (this.keys.has('arrowleft') || this.keys.has('a')) d -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) d += 1;
    return Math.max(-1, Math.min(1, d));
  }
}
