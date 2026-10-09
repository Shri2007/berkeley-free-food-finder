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

/**
 * The browser-hardening headers, as plain data. Express sends these on every
 * response it serves; the Vercel build copies the same set into the CDN
 * routing config so the static page gets them too. One list, two consumers.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff", // don't guess MIME types
  "X-Frame-Options": "DENY", // belt and braces with frame-ancestors
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export const HSTS = "max-age=15552000; includeSubDomains";

/** Standard browser-hardening headers on every response Express serves. */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.set(SECURITY_HEADERS);

  // Only promise HTTPS when we're actually behind TLS (the host terminates it for us).
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.set("Strict-Transport-Security", HSTS);
  }

  next();
}
