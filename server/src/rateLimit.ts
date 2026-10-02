import type { NextFunction, Request, Response } from "express";

interface Options {
  /** Length of the sliding window in milliseconds. */
  windowMs: number;
  /** Requests allowed per IP inside one window. */
  max: number;
  /** Message sent with the 429. */
  message: string;
}

/**
 * Small in-memory sliding-window limiter keyed by client IP.
 * Good for one server process (which is what we run). If the app ever runs on
 * several instances, the counts need to live somewhere shared instead.
 */
export function rateLimit({ windowMs, max, message }: Options) {
  const hits = new Map<string, number[]>();

  // Drop stale entries now and then so the map can't grow forever.
  const sweeper = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, times] of hits) {
      const fresh = times.filter((t) => t > cutoff);
      if (fresh.length === 0) hits.delete(ip);
      else hits.set(ip, fresh);
    }
  }, windowMs);
  sweeper.unref(); // don't keep the process alive just for this

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip ?? "unknown";
    const recent = (hits.get(ip) ?? []).filter((t) => t > now - windowMs);

    if (recent.length >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ error: message, retryAfterSeconds });
      return;
    }

    recent.push(now);
    hits.set(ip, recent);
    next();
  };
}
