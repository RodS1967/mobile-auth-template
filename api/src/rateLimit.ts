import { Request, Response, NextFunction } from "express";

// A simple in-memory sliding-window-ish limiter: fine for a single dev-server process, but
// it resets if the process restarts and wouldn't be shared across multiple server instances.
// Good enough for now; revisit with a shared store (e.g. the database or Redis) before this
// runs as more than one process in production.
const attemptsByKey = new Map<string, number[]>();

export function rateLimit(maxAttempts: number, windowMs: number) {
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const attempts = (attemptsByKey.get(key) ?? []).filter((t) => now - t < windowMs);

    if (attempts.length >= maxAttempts) {
      return res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
    }

    attempts.push(now);
    attemptsByKey.set(key, attempts);
    next();
  };
}
