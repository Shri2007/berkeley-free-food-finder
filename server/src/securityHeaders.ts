import type { NextFunction, Request, Response } from "express";

// The app loads nothing from third parties (system fonts, no CDNs, no analytics),
// so the policy can be strict: everything must come from our own origin.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Standard browser-hardening headers on every response, API and static alike. */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.set({
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff", // don't guess MIME types
    "X-Frame-Options": "DENY", // belt and braces with frame-ancestors
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  });

  // Only promise HTTPS when we're actually behind TLS (Render terminates it for us).
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  next();
}
