# Berkeley Free Food Finder

A tiny web app for UC Berkeley students to find free food on campus **right now**.
Someone posts when and where there's free food, and everyone else sees what's happening.

- **No accounts.** Anyone can view, and posting doesn't need a login.
- **Posts disappear by themselves.** Once an event's end time passes, it drops off the list. Nothing gets deleted: the list query only returns events where `ends_at > now()`.
- **Berkeley time everywhere.** Times are stored in UTC and always shown in `America/Los_Angeles`, whatever time zone your device is set to.

> **Status: early skeleton.** You can list events in the browser and add them through the API.
> There's no posting form in the UI yet, and **no input validation or rate limiting yet**, so don't share the live URL widely until those are in.

## Stack

| Part | Tech |
|---|---|
| Frontend (`client/`) | Vite + React + TypeScript, plain CSS (mobile-first) |
| Backend (`server/`) | Node + Express 4 + TypeScript, run with `tsx` |
| Database | Postgres on [Neon](https://neon.tech), via the `pg` library (no ORM) |
| Hosting | One service on [Render](https://render.com): Express serves both the API and the built React app |

## Project layout

```
berkeley-free-food-finder/
├── client/            React app (Vite)
│   └── src/App.tsx    fetches /api/events and renders the list
├── server/            Express API
│   └── src/
│       ├── server.ts  entry point: creates the table, then starts listening
│       ├── app.ts     createApp(): routes, and serves client/dist in production
│       ├── db.ts      all database access (pg Pool, SQL queries)
│       └── env.ts     loads DATABASE_URL from ../.env.local
├── neon.ts            Neon CLI config (not used by the app itself)
└── package.json       root build/start scripts for production
```

## Data model

One table, `events`, created automatically when the server starts:

| Column | Type | Notes |
|---|---|---|
| `id` | integer | auto-generated |
| `title` | text | required |
| `location` | text | required |
| `food` | text | required |
| `host` | text | optional |
| `starts_at` | timestamptz | required, stored in UTC |
| `ends_at` | timestamptz | required, stored in UTC |
| `created_at` | timestamptz | set by the database |

## API

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/events` | Events that haven't ended yet, sorted by start time |
| `POST` | `/api/events` | Creates an event from a JSON body and returns `201` with the new row |
| `GET` | `/api/health` | Returns `{ "ok": true }`. Doesn't touch the database, so hosts can use it as a liveness check |

Example:

```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"title":"Pizza social","location":"Soda Hall 510","food":"Pizza","host":"CSUA","starts_at":"2026-09-21T19:00:00Z","ends_at":"2026-09-21T21:00:00Z"}'
```

## Running it locally

You need Node.js (24 is what production uses; newer works too) and a Neon Postgres database.

1. **Get a database URL.** Create a free project at [neon.tech](https://neon.tech), then put its connection string in a file called `.env.local` at the project root:

   ```
   DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
   ```

   (If you use the Neon CLI, `neon link` writes this file for you.) `.env.local` is gitignored, so never commit it.

2. **Start the API** (port 3001):

   ```bash
   cd server && npm install && npm run dev
   ```

3. **Start the frontend** in a second terminal (port 5173):

   ```bash
   cd client && npm install && npm run dev
   ```

4. Open http://localhost:5173. In dev, Vite forwards `/api/*` requests to the API on port 3001.

## Production

In production it all runs as **one** Node process. Express serves the API *and* the built React files.

```bash
npm run build   # installs server + client deps, builds client/dist
npm start       # starts Express with NODE_ENV=production
```

### Deploying on Render

Create a **Web Service** from this repo with:

| Setting | Value |
|---|---|
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Region | Oregon (same region as the Neon database) |
| Environment variable | `DATABASE_URL` = your Neon connection string |

Render sets `PORT` automatically, and the Node version comes from `engines` in `package.json` (24.x).

**Heads-up on the free tier:** Render puts free services to sleep after 15 minutes without traffic. The next visit then takes about a minute to wake it up.
