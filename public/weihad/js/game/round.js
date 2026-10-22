// PLATZHALTER – wird vom Gameplay-Agent ersetzt
import { ROUND_TIME, MAX_AMMO, RELOAD_TIME } from '../config.js';

export class Round {
  constructor({ airport, view, traffic, rng, mode = 'play', onEvent = () => {}, isTouch = false }) {
    Object.assign(this, { airport, view, traffic, rng, mode, onEvent, isTouch });
    this.timeLeft = ROUND_TIME;
    this.score = 0;
    this.ammo = MAX_AMMO;
    this.reloadT = 0;
    this.shots = 0;
    this.hits = 0;
    this._over = false;
  }
  get over() { return this._over; }
  update(dt) {
    if (this.mode !== 'play' || this._over) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.ammo = MAX_AMMO; this.onEvent('reload-done'); }
    }
    if (this.timeLeft <= 0) { this._over = true; this.onEvent('over', { stats: this.getStats() }); }
  }
  drawLayer() {}
  drawOverlay() {}
  shoot(sx, sy) {
    if (this.mode !== 'play' || this._over || this.reloadT > 0) return;
    if (this.ammo <= 0) { this.onEvent('empty'); this.reload(); return; }
    this.ammo--; this.shots++;
    this.onEvent('throw', { sx, sy });
    this.onEvent('miss', { sx, sy });
  }
  reload() {
    if (this.reloadT > 0 || this.ammo === MAX_AMMO) return;
    this.reloadT = RELOAD_TIME;
    this.onEvent('reload-start');
  }
  getHud() {
    return { score: this.score, timeLeft: this.timeLeft, ammo: this.ammo, maxAmmo: MAX_AMMO, reloading: this.reloadT > 0 ? 1 - this.reloadT / RELOAD_TIME : false, combo: 0, multiplier: 1 };
  }
  getStats() {
    return { score: this.score, hits: this.hits, shots: this.shots, accuracy: this.shots ? this.hits / this.shots : 0, bestCombo: 0, airport: this.airport.id, eagles: 0, bonuses: 0, penalties: 0 };
  }
  getTargets() { return []; }
}
