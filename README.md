# Berkeley Free Food Finder

A tiny web app for UC Berkeley students to find free food on campus **right now**.
Someone posts when and where there's free food, and everyone else sees what's happening.

- **No accounts.** Anyone can view, and posting doesn't need a login.
- **Posts disappear by themselves.** Once an event's end time passes, it drops off the list. Nothing gets deleted: the list query only returns events where `ends_at > now()`.
- **Berkeley time everywhere.** Times are stored in UTC and always shown in `America/Los_Angeles`, whatever time zone your device is set to.

> **Status: working v1.** You can see what's happening now, what's coming up, and post an event from your phone or the side panel on a laptop.

## Abuse protection

There are no accounts, so the server has to assume every request could be a bot. What's in place:

| Layer | What it does |
|---|---|
| Rate limits (per IP, stored in Postgres) | `GET /api/events`: 60 per minute. `POST /api/events`: 3 per hour. Over the limit returns `429` with a `Retry-After` header. |
| Validation (`shared/events.ts`) | Required fields, length caps, ISO dates, end after start, max 12 hours long, max 7 days ahead. |
| Content filtering | Rejects `<` and `>` (no markup ever stored), control characters, anything that looks like a link, and keyboard-mash gibberish. |
| Duplicate check | Same title at the same location while the first post is still live returns `409`. |
| Body limit | JSON bodies over 10 kB are refused. |
| Security headers | Strict `Content-Security-Policy` (same-origin only, no inline scripts), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS when served over HTTPS. |
| Error responses | Clients only ever see `Invalid event`, `Invalid request body`, or `Internal server error`. Details stay in the server log. |

The rate limiter keeps its counts in a `rate_limits` table, so every server instance shares them and they survive restarts. That matters on Vercel, which runs several copies of the API at once and recycles them often; an in-memory counter there would let each copy count separately. Clients are stored as a SHA-256 hash of the IP, never the raw address, and old counter rows are pruned automatically. Windows are fixed (for example 1:00 to 2:00), so someone could squeeze in 3 posts just before the hour and 3 just after.

## Stack

| Part | Tech |
|---|---|
| Frontend (`client/`) | Vite + React + TypeScript, plain CSS (mobile-first) |
| Backend (`server/`) | Node + Express 4 + TypeScript, run with `tsx` |
| Database | Postgres on [Neon](https://neon.tech), via the `pg` library (no ORM) |
| Validation (`shared/`) | One zod schema, used by the server to reject bad posts and by the client for the same limits |
| Hosting | [Vercel](https://vercel.com): the React app on Vercel's CDN, the Express API as one Vercel Function |

## Project layout

```
berkeley-free-food-finder/
├── client/            React app (Vite)
│   └── src/
│       ├── App.tsx        loads events, tabs, states, two-column layout
│       ├── EventRow.tsx   one event in the feed
│       ├── PostForm.tsx   the posting form (side panel on laptops)
│       ├── PostSheet.tsx  the same form in a bottom sheet on phones
│       ├── api.ts         the two fetch calls to the server
│       ├── time.ts        Berkeley-time formatting and datetime-local conversion
│       └── index.css      all styling, plain CSS
├── server/            Express API
│   ├── scripts/
│   │   └── build-vercel.ts  writes .vercel/output for deployment
│   └── src/
│       ├── server.ts     entry point: creates the tables, then starts listening
│       ├── app.ts        createApp(): routes, validation, limits; serves client/dist in production
│       ├── db.ts         all database access (pg Pool, SQL queries)
│       ├── vercel.ts     entry point when running as a Vercel Function
│       ├── rateLimit.ts  per-IP limiter, counts stored in Postgres
│       ├── securityHeaders.ts  CSP and friends on every response
│       └── env.ts        loads DATABASE_URL from ../.env.local
├── shared/
│   ├── events.ts      the zod schema for a new event (server-side validation)
│   └── limits.ts      field length and time limits (imported by both sides)
├── neon.ts            Neon CLI config (not used by the app itself)
├── vercel.json        tells Vercel which build command to run
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
| `POST` | `/api/events` | Creates an event from a JSON body and returns `201` with the new row. `400` with a `fields` object if something's invalid, `429` after 3 posts in an hour from one IP |
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

2. **Install the shared schema's dependency** (once):

   ```bash
   cd shared && npm install
   ```

3. **Start the API** (port 3001):

   ```bash
   cd server && npm install && npm run dev
   ```

4. **Start the frontend** in a second terminal (port 5173):

   ```bash
   cd client && npm install && npm run dev
   ```

5. Open http://localhost:5173. In dev, Vite forwards `/api/*` requests to the API on port 3001.

## Deploying on Vercel

The repo is set up for Vercel's Hobby (free) plan. Connect the GitHub repo, add one environment variable, deploy.

| Setting | Value |
|---|---|
| Framework Preset | Other (`vercel.json` already sets this) |
| Build Command | `npm run build:vercel` (also set by `vercel.json`) |
| Root Directory | *(leave blank)* |
| Environment variable | `DATABASE_URL` = your Neon connection string |
| Function region (Settings, Functions) | Portland, USA (West), `pdx1`, so the API sits next to the Neon database in Oregon |

Node version comes from `engines` in `package.json` (24.x).

**How the build works.** `npm run build:vercel` builds the client, then `server/scripts/build-vercel.ts` writes Vercel's [Build Output API](https://vercel.com/docs/build-output-api) folder directly:

```
.vercel/output/
  config.json          routing, plus the same security headers Express sends
  static/              client/dist, served from Vercel's CDN
  functions/api.func/  the Express app bundled by esbuild into one file
```

Writing this folder ourselves (instead of letting Vercel guess) means the exact thing Vercel runs can be built and tested locally, and our `server/` + `client/` + `shared/` layout doesn't need to match Vercel's zero-config conventions.

### Running as a single Node server instead

`npm start` still works anywhere that runs a long-lived Node process (Render, Railway, a VPS): Express serves both the API and the built client.

```bash
npm run build   # installs shared + server + client deps, builds client/dist
npm start       # starts Express with NODE_ENV=production
```
