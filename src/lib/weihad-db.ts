import { Pool } from 'pg'

// PostgreSQL für die WeihAd-Bestenliste (eigener Service „weihad-postgres“ im CapRover-Overlay-Netz).
// Verbindung über WEIHAD_DATABASE_URL (CapRover → App jvc → Environmental Variables).

const SCHEMA = `
CREATE TABLE IF NOT EXISTS scores (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(16)  NOT NULL CHECK (char_length(name) BETWEEN 1 AND 16),
  score       INTEGER      NOT NULL CHECK (score BETWEEN 0 AND 200000),
  airport     CHAR(3)      NOT NULL CHECK (airport IN ('FRA', 'JFK', 'DXB', 'SXM', 'HND')),
  hits        INTEGER      NOT NULL DEFAULT 0 CHECK (hits >= 0),
  shots       INTEGER      NOT NULL DEFAULT 0 CHECK (shots >= 0),
  best_combo  INTEGER      NOT NULL DEFAULT 0 CHECK (best_combo >= 0),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scores_rank_idx         ON scores (score DESC, id ASC);
CREATE INDEX IF NOT EXISTS scores_airport_rank_idx ON scores (airport, score DESC, id ASC);
`

// Pool über Hot-Reloads hinweg wiederverwenden
const globalForWeihad = globalThis as unknown as {
  weihadPool?: Pool
  weihadSchema?: Promise<void>
}

export function getWeihadPool(): Pool | null {
  const connectionString = process.env.WEIHAD_DATABASE_URL
  if (!connectionString) return null
  if (!globalForWeihad.weihadPool) {
    const pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 5_000,
    })
    pool.on('error', (err) => console.error('[weihad] Postgres-Pool-Fehler:', err.message))
    globalForWeihad.weihadPool = pool
  }
  return globalForWeihad.weihadPool
}

// Legt die Tabelle beim ersten Zugriff an (idempotent); bei Fehler wird es beim nächsten Request erneut versucht
export function ensureWeihadSchema(pool: Pool): Promise<void> {
  if (!globalForWeihad.weihadSchema) {
    globalForWeihad.weihadSchema = pool
      .query(SCHEMA)
      .then(() => undefined)
      .catch((err) => {
        globalForWeihad.weihadSchema = undefined
        throw err
      })
  }
  return globalForWeihad.weihadSchema
}
