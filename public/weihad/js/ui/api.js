// Bestenlisten-Client: /api/weihad/scores, bei Netzwerkfehler/5xx Fallback auf eine lokale Liste
import { API_BASE } from '../config.js';

const TIMEOUT_MS = 6000;
const LOCAL_KEY = 'weihad.scores.local';
const LOCAL_MAX = 60;
export const AIRPORT_IDS = ['FRA', 'JFK', 'DXB', 'SXM', 'HND'];

// Fehler mit Meldung für die Oberfläche (4xx)
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const MESSAGES = {
  400: 'Ungültige Eingabe – bitte Namen prüfen.',
  413: 'Eintrag zu groß.',
  422: 'Ungültige Eingabe – bitte Namen prüfen.',
  429: 'Zu viele Einträge in kurzer Zeit – bitte kurz warten.',
};

function readLocal() {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    return Array.isArray(list) ? list.filter((s) => s && typeof s.name === 'string' && Number.isFinite(s.score)) : [];
  } catch {
    return [];
  }
}

function writeLocal(list) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, LOCAL_MAX)));
  } catch { /* Speicher voll oder gesperrt – egal */ }
}

function sortScores(list) {
  return list.sort((a, b) => b.score - a.score || String(a.created_at).localeCompare(String(b.created_at)));
}

function localScores(airport, limit) {
  const list = readLocal().filter((s) => airport === 'ALL' || s.airport === airport);
  return sortScores(list).slice(0, limit);
}

// Eintrag lokal merken (auch bei Online-Erfolg, damit offline die eigenen Ergebnisse sichtbar bleiben)
function storeLocal(entry, id) {
  const list = readLocal().filter((s) => s.id !== id);
  list.push({
    id,
    name: entry.name,
    score: entry.score,
    airport: entry.airport,
    hits: entry.hits,
    shots: entry.shots,
    best_combo: entry.bestCombo,
    created_at: new Date().toISOString(),
  });
  writeLocal(sortScores(list));
  return list;
}

async function request(url, init = {}) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : 0;
  try {
    const res = await fetch(url, { ...init, signal: ctrl?.signal, cache: 'no-store' });
    let body = null;
    try { body = await res.json(); } catch { /* kein JSON */ }
    return { res, body };
  } finally {
    clearTimeout(timer);
  }
}

function isClientError(status) {
  return status >= 400 && status < 500 && status !== 404 && status !== 408;
}

function sanitizeEntry(entry = {}) {
  // Nach Zeichen (Codepoints) kürzen, damit kein Emoji halbiert wird; Steuerzeichen entfernen
  const name = Array.from(String(entry.name ?? '').replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 16).join('').trim();
  const airport = String(entry.airport || '').toUpperCase();
  return {
    name,
    score: Math.round(Number(entry.score) || 0),
    airport: AIRPORT_IDS.includes(airport) ? airport : 'FRA',
    hits: Math.max(0, Math.round(Number(entry.hits) || 0)),
    shots: Math.max(0, Math.round(Number(entry.shots) || 0)),
    bestCombo: Math.max(0, Math.round(Number(entry.bestCombo) || 0)),
  };
}

// → { scores, online }
export async function fetchScores({ airport = 'ALL', limit = 20 } = {}) {
  const ap = String(airport || 'ALL').toUpperCase();
  const lim = Math.max(1, Math.min(50, limit | 0 || 20));
  try {
    const { res, body } = await request(`${API_BASE}?airport=${encodeURIComponent(ap)}&limit=${lim}`);
    if (res.ok && body && Array.isArray(body.scores)) {
      return { scores: body.scores.slice(0, lim), online: true };
    }
    if (isClientError(res.status)) throw new ApiError(body?.error || MESSAGES[res.status] || `Fehler ${res.status}`, res.status);
  } catch (err) {
    if (err instanceof ApiError) throw err;
  }
  return { scores: localScores(ap, lim), online: false };
}

// → { id, rank, airportRank, online }
export async function submitScore(entry) {
  const e = sanitizeEntry(entry);
  if (!e.name) throw new ApiError('Bitte gib einen Namen ein (1–16 Zeichen).', 400);
  try {
    const { res, body } = await request(API_BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(e),
    });
    if (res.ok && body && body.id != null) {
      storeLocal(e, `srv-${body.id}`);
      return { id: body.id, rank: body.rank ?? null, airportRank: body.airportRank ?? null, online: true };
    }
    if (isClientError(res.status)) throw new ApiError(body?.error || MESSAGES[res.status] || `Fehler ${res.status}`, res.status);
  } catch (err) {
    if (err instanceof ApiError) throw err;
  }
  // Offline: lokal speichern und Rang lokal bestimmen
  const id = `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  // Rang = Position in der sortierten Liste (Gleichstand: früherer Eintrag zuerst, wie auf dem Server)
  const list = sortScores(storeLocal(e, id));
  const rank = list.findIndex((s) => s.id === id) + 1;
  const airportRank = list.filter((s) => s.airport === e.airport).findIndex((s) => s.id === id) + 1;
  return { id, rank, airportRank, online: false };
}
