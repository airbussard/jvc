// PLATZHALTER – wird vom Verkehrs-Agent ersetzt
export const DEFAULT_LIVERIES = [
  { body: '#f4f6f9', belly: '#d9dde3', tail: '#1b3a6b', accent: '#f2b705', cheatline: '#1b3a6b', engine: '#c9ced6' },
];

export function drawAircraft(ctx, { x, y, scale = 1, dir = 1, livery = DEFAULT_LIVERIES[0] }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * scale, scale);
  ctx.fillStyle = livery.body;
  ctx.fillRect(-60, -18, 120, 12);
  ctx.fillStyle = livery.tail;
  ctx.fillRect(-60, -34, 14, 18);
  ctx.restore();
}
