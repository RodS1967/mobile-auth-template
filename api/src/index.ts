// Part of mobile-auth-template (MIT) — github.com/RodS1967/mobile-auth-template - Team RodZilla LLC
import express from "express";
import cors from "cors";
import type { RowDataPacket } from "mysql2";
import { config } from "./config";
import { pool } from "./db";
import {
  validateSignup,
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
  isEmail,
  maskEmail,
  fakeMaskedEmail,
  LOCKOUT_THRESHOLD,
  TERMS_VERSION,
} from "./auth";
import { rateLimit } from "./rateLimit";
import { createSession, requireSession, revokeSession, revokeOtherSessions, revokeAllSessions, AuthedRequest } from "./sessions";
import { createAuthToken, consumeAuthToken, peekAuthToken } from "./tokens";
import { sendVerificationEmail, sendUnlockEmail, sendResetEmail } from "./email";
import { renderAuthPage, renderPasswordResetForm } from "./authPages";
import { isPasswordReused, recordPasswordChange, PASSWORD_HISTORY_LIMIT } from "./passwordHistory";

const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Shorter than verification -- an account-unlock link is the more security-sensitive of the two.
const UNLOCK_ACCOUNT_TTL_MS = 60 * 60 * 1000; // 1 hour
// Same sensitivity as unlock -- a live reset link is effectively "log in as this user."
const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000; // 1 hour

interface UserRow extends RowDataPacket {
  user_id: number;
  username: string;
  email: string;
  password_hash: string;
  failed_login_count: number;
  locked_at: Date | null;
  email_verified_at: Date | null;
}

async function sendVerificationLink(userId: number, email: string): Promise<void> {
  const token = await createAuthToken(userId, "verify_email", VERIFY_EMAIL_TTL_MS);
  const verifyUrl = `${config.publicBaseUrl}/api/auth/verify-email?token=${token}`;
  await sendVerificationEmail(email, verifyUrl);
}

async function sendUnlockLink(userId: number, email: string): Promise<void> {
  const token = await createAuthToken(userId, "unlock_account", UNLOCK_ACCOUNT_TTL_MS);
  const unlockUrl = `${config.publicBaseUrl}/api/auth/unlock-account?token=${token}`;
  await sendUnlockEmail(email, unlockUrl);
}

async function sendResetLink(userId: number, email: string): Promise<void> {
  const token = await createAuthToken(userId, "reset_password", RESET_PASSWORD_TTL_MS);
  const resetUrl = `${config.publicBaseUrl}/api/auth/reset-password?token=${token}`;
  await sendResetEmail(email, resetUrl);
}

const app = express();
app.use(cors());
app.use(express.json());
// The password-reset form (authPages.ts) is a plain HTML <form>, not a fetch call, so it
// posts as application/x-www-form-urlencoded, not JSON -- this is the only route that needs it.
app.use(express.urlencoded({ extended: true }));

// Liveness check -- confirms the server is running, deliberately without touching the
// database, so it still reports usefully if the database itself is the thing that's down.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Creates a new account.
app.post("/api/auth/signup", async (req, res) => {
  const username = String(req.body.username ?? "").trim();
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const termsAccepted = req.body.termsAccepted === true;

  const errors = validateSignup(username, email, password, termsAccepted);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const passwordHash = await hashPassword(password);
    const [result] = await pool.query(
      "INSERT INTO users (username, email, password_hash, terms_accepted_at, terms_version) " +
        "VALUES (?, ?, ?, NOW(), ?)",
      [username, email, passwordHash, TERMS_VERSION]
    );
    const insertId = (result as { insertId: number }).insertId;

    // A failure here shouldn't turn a successful signup into a 500 -- the account exists
    // either way; log it and let the user hit "resend verification email" if needed.
    try {
      await sendVerificationLink(insertId, email);
    } catch (emailErr) {
      console.error("Failed to send verification email:", emailErr);
    }

    res.status(201).json({ id: insertId, username, email });
  } catch (err) {
    const mysqlErr = err as { code?: string; sqlMessage?: string };
    if (mysqlErr.code === "ER_DUP_ENTRY") {
      // sqlMessage names which column collided (e.g. "...for key 'users.username'") --
      // sniff it so the error points at the right field instead of a generic "try again."
      const field = mysqlErr.sqlMessage?.toLowerCase().includes("username") ? "username" : "email";
      return res.status(409).json({
        errors: [{ field, message: `That ${field} is already taken.` }],
      });
    }
    console.error("Signup failed:", err);
    res.status(500).json({ error: "Could not create account" });
  }
});

// Logs in with either a username or an email in the same field -- an "@" in the input
// means it's an email. Errors are deliberately generic ("username/email or password is
// incorrect") so a wrong guess can't be used to find out whether an account exists.
//
// Two separate protections, deliberately given different numbers: the per-account lockout
// below (5 failed attempts on ONE account, tracked in the database) is the real defense
// against guessing a specific password. This per-IP limit is just a coarser flood guard --
// if it shared the same number as the lockout, it would trip first and mask the "this
// account is now locked" response on the very attempt that should show it.
app.post("/api/auth/login", rateLimit(20, 60_000), async (req, res) => {
  const identifier = String(req.body.identifier ?? "").trim();
  const password = String(req.body.password ?? "");

  const invalidCredentials = () =>
    res.status(401).json({ error: "username/email or password is incorrect." });

  if (!identifier || !password) {
    return res.status(400).json({ error: "Enter your username or email, and your password." });
  }

  try {
    const [rows] = await pool.query<UserRow[]>(
      isEmail(identifier)
        ? "SELECT user_id, username, email, password_hash, failed_login_count, locked_at, email_verified_at " +
            "FROM users WHERE email = ?"
        : "SELECT user_id, username, email, password_hash, failed_login_count, locked_at, email_verified_at " +
            "FROM users WHERE username = ?",
      [isEmail(identifier) ? identifier.toLowerCase() : identifier]
    );
    const user = rows[0];
    if (!user) {
      return invalidCredentials();
    }

    if (user.locked_at) {
      // Doesn't resend here -- the unlock email already went out once, automatically, the
      // moment the account locked (below). Resending on every retry while locked would spam
      // the inbox; resend-unlock (below) covers "I lost the first one" instead.
      return res.status(403).json({
        error: "This account is locked. Check your email for an unlock link, or request a new one.",
        code: "ACCOUNT_LOCKED",
      });
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      const failedCount = user.failed_login_count + 1;
      if (failedCount >= LOCKOUT_THRESHOLD) {
        await pool.query("UPDATE users SET failed_login_count = ?, locked_at = NOW() WHERE user_id = ?", [
          failedCount,
          user.user_id,
        ]);
        try {
          await sendUnlockLink(user.user_id, user.email);
        } catch (emailErr) {
          console.error("Failed to send unlock email:", emailErr);
        }
        return res.status(403).json({
          error: "Too many failed attempts. This account is now locked. Check your email for an unlock link, or request a new one.",
          code: "ACCOUNT_LOCKED",
        });
      }
      await pool.query("UPDATE users SET failed_login_count = ? WHERE user_id = ?", [failedCount, user.user_id]);
      return invalidCredentials();
    }

    await pool.query("UPDATE users SET failed_login_count = 0 WHERE user_id = ?", [user.user_id]);

    // Checked only after the password is confirmed correct -- at that point they've already
    // proven the account exists and is theirs, so naming the real reason isn't a new leak the
    // way it would be before password verification (see invalidCredentials' generic wording).
    if (!user.email_verified_at) {
      return res.status(403).json({
        error: "Verify your email before logging in. Check your inbox for the link, or request a new one.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const session = await createSession(user.user_id);
    res.json({
      token: session.token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        emailVerified: user.email_verified_at !== null,
      },
    });
  } catch (err) {
    console.error("Login failed:", err);
    res.status(500).json({ error: "Could not log in" });
  }
});

// Reached by clicking the link in the verification email -- a human in a browser/mail
// client, not the app's fetch client -- so this returns a plain page, not JSON.
app.get("/api/auth/verify-email", async (req, res) => {
  const token = String(req.query.token ?? "");
  const consumed = token ? await consumeAuthToken(token, "verify_email") : null;

  if (!consumed) {
    return res
      .status(400)
      .type("html")
      .send(renderAuthPage("Link invalid or expired", "Request a new verification email from the app and try again."));
  }

  await pool.query("UPDATE users SET email_verified_at = NOW() WHERE user_id = ?", [consumed.userId]);
  res.type("html").send(renderAuthPage("Email verified", "You can close this tab and return to the app."));
});

// Reached by clicking the link in the unlock email -- clears both the lock and the failed
// count, so the account starts clean rather than one bad attempt away from re-locking.
app.get("/api/auth/unlock-account", async (req, res) => {
  const token = String(req.query.token ?? "");
  const consumed = token ? await consumeAuthToken(token, "unlock_account") : null;

  if (!consumed) {
    return res
      .status(400)
      .type("html")
      .send(renderAuthPage("Link invalid or expired", "If your account is still locked, request a new unlock link from the login screen."));
  }

  await pool.query("UPDATE users SET locked_at = NULL, failed_login_count = 0 WHERE user_id = ?", [consumed.userId]);
  res.type("html").send(renderAuthPage("Account unlocked", "You can close this tab and log back in."));
});

// Re-sends the verification link -- the response is the same regardless of whether the
// account exists or is already verified, same reasoning as login's generic error: a
// resend request shouldn't be usable to probe which emails have accounts.
app.post("/api/auth/resend-verification", async (req, res) => {
  const identifier = String(req.body.identifier ?? "").trim();
  const genericResponse = { message: "If that account exists and isn't verified yet, a new email was sent." };

  if (!identifier) {
    return res.status(400).json({ error: "Enter your username or email." });
  }

  try {
    const [rows] = await pool.query<UserRow[]>(
      isEmail(identifier)
        ? "SELECT user_id, email, email_verified_at FROM users WHERE email = ?"
        : "SELECT user_id, email, email_verified_at FROM users WHERE username = ?",
      [isEmail(identifier) ? identifier.toLowerCase() : identifier]
    );
    const user = rows[0];
    if (user && !user.email_verified_at) {
      await sendVerificationLink(user.user_id, user.email);
    }
    res.json(genericResponse);
  } catch (err) {
    console.error("Resend verification failed:", err);
    res.json(genericResponse);
  }
});

// Same generic-response reasoning as resend-verification above -- covers "I lost the first
// unlock email" or "it expired," without the response itself revealing whether the account
// exists or is actually locked.
app.post("/api/auth/resend-unlock", async (req, res) => {
  const identifier = String(req.body.identifier ?? "").trim();
  const genericResponse = { message: "If that account exists and is locked, a new unlock email was sent." };

  if (!identifier) {
    return res.status(400).json({ error: "Enter your username or email." });
  }

  try {
    const [rows] = await pool.query<UserRow[]>(
      isEmail(identifier)
        ? "SELECT user_id, email, locked_at FROM users WHERE email = ?"
        : "SELECT user_id, email, locked_at FROM users WHERE username = ?",
      [isEmail(identifier) ? identifier.toLowerCase() : identifier]
    );
    const user = rows[0];
    if (user && user.locked_at) {
      await sendUnlockLink(user.user_id, user.email);
    }
    res.json(genericResponse);
  } catch (err) {
    console.error("Resend unlock failed:", err);
    res.json(genericResponse);
  }
});

// Step 1 of "forgot password": given a username or email, show a partially masked version
// of the account's real email as a hint, without confirming it matches anything -- the
// response has the same shape whether or not the account exists (a real mask vs. a
// deterministic fake one), so this lookup itself can't be used to test account existence.
app.post("/api/auth/forgot-password/lookup", rateLimit(20, 60_000), async (req, res) => {
  const identifier = String(req.body.identifier ?? "").trim();
  if (!identifier) {
    return res.status(400).json({ error: "Enter your username or email." });
  }

  try {
    const [rows] = await pool.query<UserRow[]>(
      isEmail(identifier) ? "SELECT email FROM users WHERE email = ?" : "SELECT email FROM users WHERE username = ?",
      [isEmail(identifier) ? identifier.toLowerCase() : identifier]
    );
    const user = rows[0];
    res.json({ maskedEmail: user ? maskEmail(user.email) : fakeMaskedEmail(identifier) });
  } catch (err) {
    console.error("Forgot-password lookup failed:", err);
    res.json({ maskedEmail: fakeMaskedEmail(identifier) });
  }
});

// Step 2: the user has to type the real, full email -- not just confirm the hint -- and
// gets no indication of whether they got it right. A reset email only actually goes out
// if the identifier resolves to an account AND the typed email matches it exactly; either
// way the response is the same generic message, same reasoning as resend-verification.
app.post("/api/auth/forgot-password/request", rateLimit(20, 60_000), async (req, res) => {
  const identifier = String(req.body.identifier ?? "").trim();
  const typedEmail = String(req.body.email ?? "").trim().toLowerCase();
  const genericResponse = { message: "If that matches our records, a password reset email was sent." };

  if (!identifier || !typedEmail) {
    return res.status(400).json({ error: "Enter your username or email, and the full email address." });
  }

  try {
    const [rows] = await pool.query<UserRow[]>(
      isEmail(identifier)
        ? "SELECT user_id, email FROM users WHERE email = ?"
        : "SELECT user_id, email FROM users WHERE username = ?",
      [isEmail(identifier) ? identifier.toLowerCase() : identifier]
    );
    const user = rows[0];
    if (user && user.email.toLowerCase() === typedEmail) {
      await sendResetLink(user.user_id, user.email);
    }
    res.json(genericResponse);
  } catch (err) {
    console.error("Forgot-password request failed:", err);
    res.json(genericResponse);
  }
});

// Reached by clicking the link in the reset email -- renders the form (authPages.ts), not
// JSON. Uses peekAuthToken (doesn't spend the token) purely to decide whether to show the
// form or an error page; the token is only actually consumed on submit, below.
app.get("/api/auth/reset-password", async (req, res) => {
  const token = String(req.query.token ?? "");
  const valid = token ? await peekAuthToken(token, "reset_password") : null;

  if (!valid) {
    return res
      .status(400)
      .type("html")
      .send(renderAuthPage("Link invalid or expired", "Request a new password reset link from the app and try again."));
  }

  const [rows] = await pool.query<UserRow[]>("SELECT username, email FROM users WHERE user_id = ?", [valid.userId]);
  const user = rows[0];
  res.type("html").send(renderPasswordResetForm(token, user.username, user.email));
});

// The form's submit target. Order matters here: password strength is checked *before*
// the token is spent (consumeAuthToken), so a typo or weak password re-shows the form with
// an error instead of burning the one-time link on a submission that didn't take effect.
// A successful reset also clears any lockout and revokes every existing session -- proving
// ownership of the email is at least as strong as the password itself, and a reset is the
// obvious moment to kick out anyone else holding a session on this account.
app.post("/api/auth/reset-password", async (req, res) => {
  const token = String(req.body.token ?? "");
  const newPassword = String(req.body.newPassword ?? "");
  const confirmPassword = String(req.body.confirmPassword ?? "");

  const invalidLinkPage = () =>
    res
      .status(400)
      .type("html")
      .send(renderAuthPage("Link invalid or expired", "Request a new password reset link from the app and try again."));

  const valid = token ? await peekAuthToken(token, "reset_password") : null;
  if (!valid) {
    return invalidLinkPage();
  }

  try {
    const [rows] = await pool.query<UserRow[]>("SELECT username, email, password_hash FROM users WHERE user_id = ?", [
      valid.userId,
    ]);
    const user = rows[0];

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .type("html")
        .send(renderPasswordResetForm(token, user.username, user.email, "Those passwords don't match."));
    }

    const passwordError = validatePasswordStrength(newPassword, user.username, user.email);
    if (passwordError) {
      return res.status(400).type("html").send(renderPasswordResetForm(token, user.username, user.email, passwordError));
    }

    if (await isPasswordReused(valid.userId, newPassword, user.password_hash)) {
      return res
        .status(400)
        .type("html")
        .send(
          renderPasswordResetForm(
            token,
            user.username,
            user.email,
            `You can't reuse a recent password. Choose one you haven't used in your last ${PASSWORD_HISTORY_LIMIT} passwords.`
          )
        );
    }

    // Spent here, now that the password has passed every check -- the window between the
    // peek above and this consume is the only place a concurrent click on the same link
    // could win the race; losing that race just means re-requesting a reset link.
    const consumed = await consumeAuthToken(token, "reset_password");
    if (!consumed) {
      return res
        .status(400)
        .type("html")
        .send(renderAuthPage("Link already used", "That reset link was already used. Request a new one from the app."));
    }

    await recordPasswordChange(consumed.userId, user.password_hash);
    const passwordHash = await hashPassword(newPassword);
    await pool.query(
      "UPDATE users SET password_hash = ?, failed_login_count = 0, locked_at = NULL WHERE user_id = ?",
      [passwordHash, consumed.userId]
    );
    await revokeAllSessions(consumed.userId);

    res.type("html").send(renderAuthPage("Password changed", "You can close this tab and log in with your new password."));
  } catch (err) {
    console.error("Password reset failed:", err);
    res.status(500).type("html").send(renderAuthPage("Something went wrong", "Please try again from the app."));
  }
});

// The app's first authenticated endpoint -- requireSession rejects anything without a
// valid, unrevoked session before this handler ever runs. Unlike a password reset (which
// has no session to speak of, and so revokes everything), this already knows exactly which
// account and which session is asking, so it can verify the current password directly and
// leave the requesting device logged in while kicking out every other one.
app.post("/api/auth/change-password", requireSession, async (req: AuthedRequest, res) => {
  const currentPassword = String(req.body.currentPassword ?? "");
  const newPassword = String(req.body.newPassword ?? "");
  const confirmPassword = String(req.body.confirmPassword ?? "");
  const userId = req.userId!;
  const sessionId = req.sessionId!;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ errors: [{ field: "form", message: "Fill in all three fields." }] });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ errors: [{ field: "confirmPassword", message: "New passwords don't match." }] });
  }

  try {
    const [rows] = await pool.query<UserRow[]>("SELECT username, email, password_hash FROM users WHERE user_id = ?", [
      userId,
    ]);
    const user = rows[0];

    const currentValid = await verifyPassword(currentPassword, user.password_hash);
    if (!currentValid) {
      return res.status(401).json({ errors: [{ field: "currentPassword", message: "Current password is incorrect." }] });
    }

    const passwordError = validatePasswordStrength(newPassword, user.username, user.email);
    if (passwordError) {
      return res.status(400).json({ errors: [{ field: "newPassword", message: passwordError }] });
    }

    if (await isPasswordReused(userId, newPassword, user.password_hash)) {
      return res.status(400).json({
        errors: [
          {
            field: "newPassword",
            message: `You can't reuse a recent password. Choose one you haven't used in your last ${PASSWORD_HISTORY_LIMIT} passwords.`,
          },
        ],
      });
    }

    await recordPasswordChange(userId, user.password_hash);
    const newHash = await hashPassword(newPassword);
    await pool.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [newHash, userId]);
    await revokeOtherSessions(userId, sessionId);

    res.json({ message: "Password changed." });
  } catch (err) {
    console.error("Change password failed:", err);
    res.status(500).json({ errors: [{ field: "form", message: "Could not change password." }] });
  }
});

// Revokes only the session making the request -- the device just forgets its own token
// either way, but revoking it server-side too means a stolen/leaked token stops working
// the moment the legitimate owner logs out, instead of staying valid until it expires.
app.post("/api/auth/logout", requireSession, async (req: AuthedRequest, res) => {
  await revokeSession(req.sessionId!);
  res.json({ message: "Logged out." });
});

app.listen(config.port, () => {
  console.log(`${config.appName} API listening on http://localhost:${config.port}`);
});
