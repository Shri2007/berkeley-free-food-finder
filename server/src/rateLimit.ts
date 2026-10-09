import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { pruneRateLimits, recordHit } from "./db";

interface Options {
  /** Name for this limit, so different limits keep separate counts. */
  bucket: string;
  /** Length of the window in seconds. */
  windowSeconds: number;
  /** Requests allowed per client inside one window. */
  max: number;
  /** Message sent with the 429. */
  message: string;
}

/**
 * The visitor's IP. On Vercel we read the header Vercel itself sets, which it
 * overwrites on every request so a client can't spoof it. Everywhere else
 * Express's req.ip is right (with `trust proxy` set for Render-style hosts).
 */
function clientIp(req: Request): string {
  if (process.env.VERCEL) {
    const header = req.headers["x-vercel-forwarded-for"];
    const value = Array.isArray(header) ? header[0] : header;
    if (value) return value.split(",")[0].trim();
  }
  return req.ip ?? "unknown";
}

/** We only need to tell clients apart, not know who they are, so store a hash. */
function clientKey(req: Request): string {
  return createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 32);
}

/**
 * Fixed-window rate limiter backed by the rate_limits table.
 * Shared across every server instance, and survives restarts.
 */
export function rateLimit({ bucket, windowSeconds, max, message }: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hits, retryAfterSeconds } = await recordHit(bucket, clientKey(req), windowSeconds);

      // Housekeeping on roughly 1 in 50 requests keeps the table small
      // without needing a cron job.
      if (Math.random() < 0.02) {
        pruneRateLimits().catch((err) => console.error("rate limit prune failed:", err));
      }

      if (hits > max) {
        res.set("Retry-After", String(retryAfterSeconds));
        res.status(429).json({ error: message, retryAfterSeconds });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
