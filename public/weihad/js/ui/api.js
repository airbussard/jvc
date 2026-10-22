// PLATZHALTER – wird vom UI-Agent ersetzt
import { API_BASE } from '../config.js';

export async function fetchScores({ airport = 'ALL', limit = 20 } = {}) {
  const res = await fetch(`${API_BASE}?airport=${encodeURIComponent(airport)}&limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { ...(await res.json()), online: true };
}

export async function submitScore(entry) {
  const res = await fetch(API_BASE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { ...(await res.json()), online: true };
}
