import crypto from "crypto";
import type { RowDataPacket } from "mysql2";
import { pool } from "./db";

// Matches the `purpose` ENUM on auth_tokens in schema.sql. One shared mechanism for all
// three emailed-link flows -- only verify_email is wired up to a route today, but
// reset_password and unlock_account reuse this same helper when they're built.
export type TokenPurpose = "verify_email" | "reset_password" | "unlock_account";

interface AuthTokenRow extends RowDataPacket {
  auth_token_id: number;
  user_id: number;
  expires_at: Date;
  used_at: Date | null;
}

// Only the token's hash is ever stored (schema.sql, auth_tokens.token_hash) -- same reasoning
// as session tokens: a database leak shouldn't hand out usable links.
export async function createAuthToken(userId: number, purpose: TokenPurpose, ttlMs: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + ttlMs);

  await pool.query("INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?)", [
    userId,
    purpose,
    tokenHash,
    expiresAt,
  ]);

  return token;
}

async function findValidToken(rawToken: string, purpose: TokenPurpose): Promise<AuthTokenRow | null> {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const [rows] = await pool.query<AuthTokenRow[]>(
    "SELECT auth_token_id, user_id, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND purpose = ?",
    [tokenHash, purpose]
  );
  const row = rows[0];
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    return null;
  }
  return row;
}

// Checks a token without spending it -- used by the password-reset form, which needs to
// know the token is good (to decide whether to show the form at all, and whose account
// it's for, for the username/email password-strength check) before it knows the submitted
// password is acceptable. Burning a one-time link on a password that just failed a
// strength check would be a bad experience.
export async function peekAuthToken(rawToken: string, purpose: TokenPurpose): Promise<{ userId: number } | null> {
  const row = await findValidToken(rawToken, purpose);
  return row ? { userId: row.user_id } : null;
}

// Validates a token (right purpose, not expired, not already used) and marks it used in the
// same call. Returns null for any failure reason -- callers shouldn't distinguish "expired"
// from "already used" from "never existed" to whoever's holding the link.
export async function consumeAuthToken(rawToken: string, purpose: TokenPurpose): Promise<{ userId: number } | null> {
  const row = await findValidToken(rawToken, purpose);
  if (!row) {
    return null;
  }

  await pool.query("UPDATE auth_tokens SET used_at = NOW() WHERE auth_token_id = ?", [row.auth_token_id]);
  return { userId: row.user_id };
}
