// PLATZHALTER – wird vom Verkehrs-Agent ersetzt
import { drawAircraft } from './aircraft.js';

export class TrafficSystem {
  constructor(config, { rng, onSound } = {}) {
    this.config = config;
    this.rng = rng;
    this.onSound = onSound;
    this.t = 0;
  }
  prewarm(seconds) { this.t += seconds; }
  update(dt) { this.t += dt; }
  draw(ctx, layerId) {
    if (layerId !== 'mid') return;
    const rw = this.config.runways?.[0];
    if (!rw) return;
    const x = rw.x1 + ((this.t * 120) % (rw.x2 - rw.x1));
    drawAircraft(ctx, { x, y: rw.y, dir: 1 });
  }
  hitTest() { return null; }
}
