// PLATZHALTER – wird von den Szenerie-Agents durch echte Szenen ersetzt
import { linearSky, runway, groundGradient, controlTower } from './paint.js';

export function makeStub(meta) {
  return {
    ...meta,
    theme: { accent: '#ffcc33', skyTop: '#0b1530', skyBottom: '#3a4a7a' },
    weather: { snow: 0.5 },
    layerTop: { far: 300, mid: 200, near: 560 },
    paintSky(ctx, { w, h }) {
      linearSky(ctx, w, h, [[0, '#0b1530'], [0.7, '#3a4a7a'], [1, '#6a5a7a']]);
    },
    paintLayer(ctx, id, { w }) {
      if (id === 'far') groundGradient(ctx, w, 440, 720, '#1a2238', '#111827');
      if (id === 'mid') {
        groundGradient(ctx, w, 480, 720, '#cfd8e3', '#9aa7b8');
        ctx.fillStyle = '#556';
        ctx.fillRect(500, 410, 700, 80);
        controlTower(ctx, 1400, 490, 240, { snow: true });
        runway(ctx, 150, 2250, 600);
      }
      if (id === 'near') groundGradient(ctx, w, 640, 720, '#e8eef6', '#c9d3df');
    },
    traffic: {
      planeScale: { far: 0.38, mid: 1.0, near: 2.2 },
      runways: [{ id: '25', layer: 'mid', y: 600, x1: 150, x2: 2250, dir: -1, use: 'mixed', arrivalsPerMin: 3, departuresPerMin: 2.5, approach: { startY: 140, lowFlyLayer: null } }],
      taxiways: [{ layer: 'mid', y: 556, x1: 200, x2: 2200 }],
      gates: [{ layer: 'mid', x: 600, y: 522, dir: 1 }, { layer: 'mid', x: 800, y: 522, dir: 1 }, { layer: 'mid', x: 1000, y: 522, dir: 1 }],
      overflights: [{ layer: 'far', yMin: 40, yMax: 200, perMin: 4, contrails: true }],
      helicopters: 0.3,
      fleet: { narrow: 5, wide: 3, jumbo: 1, a380: 0.5, regional: 2, prop: 1 },
      liveries: null,
    },
    eagleZones: { far: [60, 360], mid: [70, 420], near: [40, 520] },
    hideSpots: [{ layer: 'mid', x: 520, y: 410, w: 80 }],
  };
}
