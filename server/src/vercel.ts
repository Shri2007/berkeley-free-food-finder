// Entry point for Vercel. The whole Express app runs as one Vercel Function.
// Vercel calls the default export with plain Node request/response objects,
// which an Express app already knows how to handle.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./app";
import { initDb } from "./db";

const app = createApp();

// There's no "server start" on Vercel, so make sure the tables exist on the
// first request each instance handles. If it fails, try again next request.
let ready: Promise<void> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= initDb().catch((err) => {
    ready = null;
    throw err;
  });

  try {
    await ready;
  } catch (err) {
    console.error("Database setup failed:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Internal server error" }));
    return;
  }

  app(req, res);
}
