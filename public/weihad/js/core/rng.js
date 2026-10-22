// Seeded Zufallszahlen (mulberry32), damit vorgerenderte Szenen stabil aussehen
export function createRng(seed = 1) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    // Gleichverteilt in [a, b)
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    // Gewichtete Auswahl: { key: gewicht, … } → key
    weighted(weights) {
      const entries = Object.entries(weights).filter(([, w]) => w > 0);
      let total = 0;
      for (const [, w] of entries) total += w;
      let r = next() * total;
      for (const [k, w] of entries) {
        r -= w;
        if (r <= 0) return k;
      }
      return entries[entries.length - 1]?.[0];
    },
    // Unabhängiger Unter-Generator (z. B. pro Ebene)
    fork: (salt = 0) => createRng(Math.floor(next() * 4294967296) ^ salt),
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
