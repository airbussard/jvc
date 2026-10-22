import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getWeihadPool, ensureWeihadSchema } from '@/lib/weihad-db'

// Bestenliste für das Browser-Spiel unter /weihad (öffentlich, ohne Login)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AIRPORTS = ['FRA', 'JFK', 'DXB', 'SXM', 'HND'] as const
type Airport = typeof AIRPORTS[number]

// Fehlerfreies Spiel (jeder der ca. 100 Adler ×4 samt Nachschüssen) ergibt simuliert höchstens ~56k
const MAX_SCORE = 60_000
const MAX_SHOTS = 600 // 90 s Runde, 8er-Magazin mit Nachladezeit
// Obergrenzen je Runde laut public/weihad/js/game/round.js (goldTimes, peekT ≥ 7 s bzw. 4,2 s im Endspurt)
const MAX_GOLD = 2
const MAX_PEEK = 15
const NAME_PATTERN = /^[\p{L}\p{N} ._\-!?'&+#]+$/u

// Einfaches Rate-Limit pro IP (eine Instanz → In-Memory reicht)
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 5
const submissions = new Map<string, number[]>()

const NO_STORE = { 'Cache-Control': 'no-store' }

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unbekannt'
  )
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (submissions.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX) {
    submissions.set(ip, recent)
    return true
  }
  recent.push(now)
  submissions.set(ip, recent)
  // Map nicht unbegrenzt wachsen lassen
  if (submissions.size > 5_000) {
    for (const [key, times] of submissions) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) submissions.delete(key)
    }
  }
  return false
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  const length = [...name].length
  if (length < 1 || length > 16 || !NAME_PATTERN.test(name)) return null
  return name
}

// Wie comboMultiplier() im Spiel: ab Combo 3/6/10 → ×2/×3/×4
function comboMultiplier(combo: number): number {
  return combo >= 10 ? 4 : combo >= 6 ? 3 : combo >= 3 ? 2 : 1
}

// Höchstmögliche Punktzahl für diese Trefferzahl: jeder Treffer höchstens Weißkopf fern (150) × Multiplikator,
// dazu der Aufschlag für die wenigen Gold- (500) und Versteck-Adler (250); Geschenke/Nachschüsse liegen darunter
function maxScore(hits: number, bestCombo: number): number {
  const m = comboMultiplier(bestCombo)
  const gold = Math.min(hits, MAX_GOLD)
  return m * (150 * hits + 350 * gold + 100 * Math.min(hits - gold, MAX_PEEK))
}

// Moderation nur mit WEIHAD_ADMIN_TOKEN (mind. 24 Zeichen); ohne Token ist DELETE abgeschaltet
function isAdmin(request: NextRequest): boolean {
  const token = process.env.WEIHAD_ADMIN_TOKEN || ''
  if (token.length < 24) return false
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  // Hashes gleicher Länge → zeitkonstanter Vergleich
  const digest = (v: string) => createHash('sha256').update(v).digest()
  return timingSafeEqual(digest(given), digest(token))
}

function unavailable(err?: unknown) {
  if (err) console.error('[weihad] DB-Fehler:', err instanceof Error ? err.message : err)
  return NextResponse.json(
    { error: 'Bestenliste vorübergehend nicht erreichbar' },
    { status: 503, headers: NO_STORE }
  )
}

export async function GET(request: NextRequest) {
  const pool = getWeihadPool()
  if (!pool) return unavailable()

  const { searchParams } = new URL(request.url)
  const airportParam = (searchParams.get('airport') || 'ALL').toUpperCase()
  const airport = AIRPORTS.includes(airportParam as Airport) ? (airportParam as Airport) : null
  const limitParam = Number(searchParams.get('limit') || 20)
  const limit = Number.isFinite(limitParam) ? Math.min(50, Math.max(1, Math.floor(limitParam))) : 20

  try {
    await ensureWeihadSchema(pool)
    const { rows } = await pool.query(
      `SELECT id, name, score, airport, hits, shots, best_combo, created_at
         FROM scores
        WHERE ($1::char(3) IS NULL OR airport = $1)
        ORDER BY score DESC, id ASC
        LIMIT $2`,
      [airport, limit]
    )
    const scores = rows.map((r) => ({ ...r, id: Number(r.id) }))
    return NextResponse.json({ scores }, { headers: NO_STORE })
  } catch (err) {
    return unavailable(err)
  }
}

export async function POST(request: NextRequest) {
  const pool = getWeihadPool()
  if (!pool) return unavailable()

  if (Number(request.headers.get('content-length') || 0) > 2_048) {
    return NextResponse.json({ error: 'Anfrage zu groß' }, { status: 413, headers: NO_STORE })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    raw = null
  }
  // Auch null, Arrays und einfache Werte sind gültiges JSON, aber kein Eintrag
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Ungültiges JSON-Format' }, { status: 400, headers: NO_STORE })
  }
  const body = raw as Record<string, unknown>

  const name = cleanName(body.name)
  if (!name) {
    return NextResponse.json(
      { error: 'Name muss 1–16 Zeichen haben (Buchstaben, Ziffern, Leerzeichen, . _ - ! ? \' & + #)' },
      { status: 400, headers: NO_STORE }
    )
  }

  const airport = typeof body.airport === 'string' ? body.airport.toUpperCase() : ''
  if (!AIRPORTS.includes(airport as Airport)) {
    return NextResponse.json({ error: 'Unbekannter Flughafen' }, { status: 400, headers: NO_STORE })
  }

  const { score, hits, shots, bestCombo } = body
  if (
    !isInt(score, 0, MAX_SCORE) ||
    !isInt(shots, 0, MAX_SHOTS) ||
    !isInt(hits, 0, shots as number) ||
    !isInt(bestCombo, 0, hits as number)
  ) {
    return NextResponse.json({ error: 'Ungültige Spielwerte' }, { status: 400, headers: NO_STORE })
  }

  // Plausibilität: Punktzahl muss mit Treffern und bester Combo erreichbar sein
  if (score > maxScore(hits as number, bestCombo as number)) {
    return NextResponse.json({ error: 'Punktzahl nicht plausibel' }, { status: 400, headers: NO_STORE })
  }

  if (isRateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: 'Zu viele Einträge – bitte kurz warten' },
      { status: 429, headers: NO_STORE }
    )
  }

  try {
    await ensureWeihadSchema(pool)
    const inserted = await pool.query(
      `INSERT INTO scores (name, score, airport, hits, shots, best_combo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [name, score, airport, hits, shots, bestCombo]
    )
    const id = inserted.rows[0].id
    // Rang: alle besseren Einträge + gleich gute, die früher eingetragen wurden (id ist monoton)
    const ranks = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE score > $1 OR (score = $1 AND id < $3)) + 1 AS rank,
         COUNT(*) FILTER (WHERE airport = $2 AND (score > $1 OR (score = $1 AND id < $3))) + 1 AS airport_rank
       FROM scores`,
      [score, airport, id]
    )
    return NextResponse.json(
      {
        id: Number(id),
        rank: Number(ranks.rows[0].rank),
        airportRank: Number(ranks.rows[0].airport_rank),
      },
      { status: 201, headers: NO_STORE }
    )
  } catch (err) {
    return unavailable(err)
  }
}

// Eintrag entfernen (Spam/Cheater): DELETE /api/weihad/scores?id=123 mit „Authorization: Bearer <WEIHAD_ADMIN_TOKEN>“
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 401, headers: NO_STORE })
  }
  const pool = getWeihadPool()
  if (!pool) return unavailable()

  const id = new URL(request.url).searchParams.get('id') || ''
  if (!/^[1-9]\d{0,17}$/.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400, headers: NO_STORE })
  }

  try {
    await ensureWeihadSchema(pool)
    const result = await pool.query('DELETE FROM scores WHERE id = $1', [id])
    if (!result.rowCount) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404, headers: NO_STORE })
    }
    return NextResponse.json({ deleted: Number(id) }, { headers: NO_STORE })
  } catch (err) {
    return unavailable(err)
  }
}
