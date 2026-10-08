import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "./db";

const SESSION_LENGTH_DAYS = 30;

// The raw token goes to the device, once, and is never seen again by the server --
// only its hash is stored (user_sessions.token_hash), so a database leak doesn't hand
// out usable session tokens the way storing the raw value would.
export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_LENGTH_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, tokenHash, expiresAt]
  );

  return { token, expiresAt };
}

// Everything past this point is for verifying a session on later requests -- nothing used
// it until now (every route so far only ever created or consumed one-time email tokens).
// Change Password is the app's first endpoint that requires an already-logged-in device.

export interface AuthedRequest extends Request {
  userId?: number;
  sessionId?: number;
}

interface SessionRow extends RowDataPacket {
  user_session_id: number;
  user_id: number;
  expires_at: Date;
  revoked_at: Date | null;
}

// Express middleware: reads the bearer token from the Authorization header, hashes it the
// same way createSession does, and looks it up -- rejecting a missing, unknown, expired, or
// revoked session with a 401. On success it attaches userId/sessionId to the request so the
// route handler doesn't need to look the session up a second time.
export async function requireSession(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Not logged in." });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const [rows] = await pool.query<SessionRow[]>(
    "SELECT user_session_id, user_id, expires_at, revoked_at FROM user_sessions WHERE token_hash = ?",
    [tokenHash]
  );
  const session = rows[0];
  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
    res.status(401).json({ error: "Session expired or invalid. Log in again." });
    return;
  }

  // Best-effort activity tracking (user_sessions.last_used_at) -- not awaited for
  // correctness, just so a slow write never adds latency to the actual request.
  pool
    .query("UPDATE user_sessions SET last_used_at = NOW() WHERE user_session_id = ?", [session.user_session_id])
    .catch((err) => console.error("Failed to update session last_used_at:", err));

  req.userId = session.user_id;
  req.sessionId = session.user_session_id;
  next();
}

// Used by logout -- revokes exactly the session making the request.
export async function revokeSession(sessionId: number): Promise<void> {
  await pool.query("UPDATE user_sessions SET revoked_at = NOW() WHERE user_session_id = ?", [sessionId]);
}

// Used by change-password -- revokes every *other* active session on the account, but
// deliberately leaves the one making this request alone, so changing your password doesn't
// also log out the device you're changing it from. Contrast with revokeAllSessions below,
// used by the forgot-password reset flow, which has no "current session" to spare.
export async function revokeOtherSessions(userId: number, exceptSessionId: number): Promise<void> {
  await pool.query(
    "UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND user_session_id != ? AND revoked_at IS NULL",
    [userId, exceptSessionId]
  );
}

// Used by the forgot-password reset flow -- there's no active session to spare there (the
// person proved ownership via email, not an existing login), so every session is revoked.
export async function revokeAllSessions(userId: number): Promise<void> {
  await pool.query("UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", [userId]);
}
