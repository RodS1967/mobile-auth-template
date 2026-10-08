import type { RowDataPacket } from "mysql2";
import { pool } from "./db";
import { verifyPassword } from "./auth";

// How many distinct passwords (including the current one) a user must cycle through
// before a previous one becomes reusable again. 5 is a common default; NIST's current
// guidance doesn't mandate a specific number -- just that reuse of recent passwords is
// blocked outright, with no time-based way around it (unlike forced periodic rotation,
// which NIST now recommends against, since it just encourages predictable password1,
// password2... cycling). Change this constant if a stricter or looser count is wanted.
export const PASSWORD_HISTORY_LIMIT = 5;

interface PasswordHistoryRow extends RowDataPacket {
  password_history_id: number;
  password_hash: string;
}

// Checks a candidate new password against the account's current password and its last
// PASSWORD_HISTORY_LIMIT - 1 previous ones, so PASSWORD_HISTORY_LIMIT distinct passwords
// total (current + history) can't be reused. bcrypt.compare is slow by design, so this is
// a handful of deliberately-slow comparisons, not a cheap lookup -- fine at this app's scale.
export async function isPasswordReused(
  userId: number,
  candidatePassword: string,
  currentPasswordHash: string
): Promise<boolean> {
  if (await verifyPassword(candidatePassword, currentPasswordHash)) {
    return true;
  }

  const [rows] = await pool.query<PasswordHistoryRow[]>(
    "SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, PASSWORD_HISTORY_LIMIT - 1]
  );
  for (const row of rows) {
    if (await verifyPassword(candidatePassword, row.password_hash)) {
      return true;
    }
  }
  return false;
}

// Called right before a password is overwritten -- archives the hash being replaced, then
// trims the table back down to PASSWORD_HISTORY_LIMIT - 1 rows for that user. Older rows
// beyond that are never checked against again, so there's no reason to keep them.
export async function recordPasswordChange(userId: number, oldPasswordHash: string): Promise<void> {
  await pool.query("INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)", [userId, oldPasswordHash]);

  const [keepRows] = await pool.query<PasswordHistoryRow[]>(
    "SELECT password_history_id FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, PASSWORD_HISTORY_LIMIT - 1]
  );
  const keepIds = keepRows.map((row) => row.password_history_id);
  if (keepIds.length > 0) {
    await pool.query("DELETE FROM password_history WHERE user_id = ? AND password_history_id NOT IN (?)", [
      userId,
      keepIds,
    ]);
  }
}
