import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
}

export async function listEvents(): Promise<EventRow[]> {
  const result = await pool.query<EventRow>(
    `SELECT id, title, location, food, host, starts_at, ends_at, created_at
       FROM events
      WHERE ends_at > now()
      ORDER BY starts_at`
  );
  return result.rows;
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
