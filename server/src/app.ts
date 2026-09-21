import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import { createEvent, listEvents } from "./db";

// The built React app (from `npm run build` at the project root), resolved relative to this file.
const clientDist = fileURLToPath(new URL("../../client/dist", import.meta.url));

export function createApp() {
  const app = express();

  app.use(express.json());

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

  app.post("/api/events", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Pick only the fields we store. No validation yet (zod comes later).
      const { title, location, food, host, starts_at, ends_at } = req.body ?? {};
      const created = await createEvent({
        title,
        location,
        food,
        host: host ?? null,
        starts_at,
        ends_at,
      });
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
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
