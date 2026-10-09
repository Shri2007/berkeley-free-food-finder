import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import { eventInputSchema, fieldErrors } from "../../shared/events";
import { createEvent, findLiveDuplicate, listEvents } from "./db";
import { rateLimit } from "./rateLimit";
import { securityHeaders } from "./securityHeaders";

// The built React app (from `npm run build` at the project root), resolved relative to this file.
const clientDist = fileURLToPath(new URL("../../client/dist", import.meta.url));

export function createApp() {
  const app = express();

  // Don't advertise the framework; it only helps people fingerprint the server.
  app.disable("x-powered-by");

  // On Render the app sits behind exactly one proxy. Trusting that hop makes
  // req.ip the real client address (needed for rate limiting) without trusting
  // arbitrary X-Forwarded-For headers from the open internet.
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(securityHeaders);

  // Events are a few short strings; anything bigger than this is not a real post.
  app.use(express.json({ limit: "10kb" }));

  // Per-IP budgets. Reads get a generous one (a phone polling every minute is
  // nowhere near it; a scraper hammering the list is). Posting gets a tight one.
  const readLimiter = rateLimit({
    bucket: "read",
    windowSeconds: 60,
    max: 60,
    message: "Too many requests. Slow down a little.",
  });
  const postLimiter = rateLimit({
    bucket: "post",
    windowSeconds: 60 * 60,
    max: 3,
    message: "You've posted 3 times in the last hour. Try again a bit later.",
  });

  // Liveness check for the host. Deliberately doesn't touch the database.
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get("/api/events", readLimiter, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await listEvents();
      res.json(events);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/events", postLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // The schema strips unknown keys, trims strings, and rejects markup,
      // links, control characters and gibberish, so only clean, size-limited
      // values reach the database.
      const parsed = eventInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid event", fields: fieldErrors(parsed.error) });
        return;
      }

      // Same title at the same place while the first one is still live is a
      // double post (or a bot replaying), not a new event.
      const existing = await findLiveDuplicate(parsed.data.title, parsed.data.location);
      if (existing) {
        res.status(409).json({
          error: "Looks like that's already posted. It's on the board until it ends.",
          existingId: existing.id,
        });
        return;
      }

      const created = await createEvent(parsed.data);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // When run as one Node server (`npm start`), Express serves the client too.
  // On Vercel the CDN serves it instead, and in dev Vite does.
  if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
    app.use(express.static(clientDist));
  }

  // Express recognizes an error handler by its 4 arguments, so keep all of them.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // Malformed JSON and oversized bodies arrive here from express.json with a
    // 4xx status attached. Those are the client's fault; say so, but say no more.
    const status = typeof err === "object" && err && "status" in err ? Number(err.status) : 500;
    if (status >= 400 && status < 500) {
      res.status(status).json({ error: "Invalid request body" });
      return;
    }
    // Everything else is logged in full here and never echoed to the client.
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
