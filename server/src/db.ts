import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Close our own idle connections before Neon does. Neon dropping them first is
  // what produced the occasional ECONNRESET and 500 on a page left open.
  idleTimeoutMillis: 10_000,
});

// Neon closes idle connections. Without this listener, that error would crash the process.
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client:", err);
});

export interface EventRow {
  id: number;
  title: string;
  location: string;
  food: string;
  host: string | null;
  starts_at: Date;
  ends_at: Date;
  created_at: Date;
}

export interface NewEvent {
  title: string;
  location: string;
  food: string;
  host: string | null;
  starts_at: string;
  ends_at: string;
}

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title      text NOT NULL,
      location   text NOT NULL,
      food       text NOT NULL,
      host       text,
      starts_at  timestamptz NOT NULL,
      ends_at    timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // Rate-limit counters live in the database so every server instance shares
  // them (Vercel runs several, and restarts them often). One row per
  // bucket + client + fixed time window.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket       text NOT NULL,
      client       text NOT NULL,
      window_start timestamptz NOT NULL,
      hits         integer NOT NULL DEFAULT 1,
      PRIMARY KEY (bucket, client, window_start)
    )
  `);
}

/**
 * Count one request for this client in the current window and return the new
 * total, plus how many seconds until the window resets.
 * `client` is a hash, never a raw IP.
 */
export async function recordHit(
  bucket: string,
  client: string,
  windowSeconds: number
): Promise<{ hits: number; retryAfterSeconds: number }> {
  const result = await pool.query<{ hits: number; retry_after: number }>(
    `INSERT INTO rate_limits (bucket, client, window_start)
     VALUES ($1, $2, to_timestamp(floor(extract(epoch FROM now()) / $3) * $3))
     ON CONFLICT (bucket, client, window_start)
       DO UPDATE SET hits = rate_limits.hits + 1
     RETURNING hits,
               ceil(extract(epoch FROM (window_start + make_interval(secs => $3) - now())))::int AS retry_after`,
    [bucket, client, windowSeconds]
  );
  const row = result.rows[0];
  return { hits: row.hits, retryAfterSeconds: Math.max(1, row.retry_after) };
}

/** Drop counters for windows that ended long ago. */
export async function pruneRateLimits(): Promise<void> {
  await pool.query(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
}

export async function listEvents(): Promise<EventRow[]> {
  const result = await pool.query<EventRow>(
    `SELECT id, title, location, food, host, starts_at, ends_at, created_at
       FROM events
      WHERE ends_at > now()
      ORDER BY starts_at
      LIMIT 200`
  );
  return result.rows;
}

/**
 * Is there already a live (not yet ended) event with this title at this place?
 * Case-insensitive, so "Pizza" and "pizza" count as the same post.
 */
export async function findLiveDuplicate(title: string, location: string): Promise<EventRow | null> {
  const result = await pool.query<EventRow>(
    `SELECT id, title, location, food, host, starts_at, ends_at, created_at
       FROM events
      WHERE lower(title) = lower($1)
        AND lower(location) = lower($2)
        AND ends_at > now()
      LIMIT 1`,
    [title, location]
  );
  return result.rows[0] ?? null;
}

export async function createEvent(event: NewEvent): Promise<EventRow> {
  const result = await pool.query<EventRow>(
    `INSERT INTO events (title, location, food, host, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, location, food, host, starts_at, ends_at, created_at`,
    [event.title, event.location, event.food, event.host, event.starts_at, event.ends_at]
  );
  return result.rows[0];
}
