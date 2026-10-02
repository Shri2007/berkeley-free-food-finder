import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import { eventInputSchema, fieldErrors } from "../../shared/events";
import { createEvent, listEvents } from "./db";
import { rateLimit } from "./rateLimit";

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

  // Events are a few short strings; anything bigger than this is not a real post.
  app.use(express.json({ limit: "10kb" }));

  // A soft ceiling on all API traffic per IP, mostly to blunt scraping and mistakes.
  app.use(
    "/api",
    rateLimit({ windowMs: 60_000, max: 120, message: "Too many requests. Slow down a little." }),
  );

  // Posting is the one thing worth spamming, so it gets its own tight budget.
  const postLimiter = rateLimit({
    windowMs: 60 * 60_000,
    max: 3,
    message: "You've posted 3 times in the last hour. Try again a bit later.",
  });

  // Liveness check for the host. Deliberately doesn't touch the database.
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get("/api/events", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await listEvents();
      res.json(events);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/events", postLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // The schema strips unknown keys and trims strings, so only clean,
      // size-limited values reach the database.
      const parsed = eventInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid event", fields: fieldErrors(parsed.error) });
        return;
      }
      const created = await createEvent(parsed.data);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // In production, Express serves the client too, so the whole app is one service.
  // In dev, Vite serves the client on :5173 instead.
  if (process.env.NODE_ENV === "production") {
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
