import nodemailer, { Transporter } from "nodemailer";
import { config } from "./config";

let transporter: Transporter | null | undefined;

// Lazily built, and only once -- undefined means "not checked yet," null means "checked,
// no SMTP configured, use the dev-mode fallback instead."
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  if (!config.email.host || !config.email.user || !config.email.password) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.password },
  });
  return transporter;
}

// No real mailbox configured yet (see .env.example, SMTP_*) means there's nothing to
// actually send through -- print the link to the server's own console instead, so the
// whole verify-by-link flow is still fully testable before that mailbox exists.
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev-mode, no SMTP configured] Verification link for ${to}:\n  ${verifyUrl}`);
    return;
  }

  await t.sendMail({
    from: config.email.from,
    to,
    subject: `Verify your ${config.appName} email`,
    text: `Click the link below to verify your email address:\n\n${verifyUrl}`,
    html: `<p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

// Sent once, automatically, the moment an account locks (5 failed logins) -- not something
// a user requests, so there's no "resend" for this one the way there is for verification.
export async function sendUnlockEmail(to: string, unlockUrl: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev-mode, no SMTP configured] Unlock link for ${to}:\n  ${unlockUrl}`);
    return;
  }

  await t.sendMail({
    from: config.email.from,
    to,
    subject: `Your ${config.appName} account is locked`,
    text:
      `Your account was locked after too many failed login attempts. ` +
      `Click the link below to unlock it:\n\n${unlockUrl}\n\n` +
      `If this wasn't you, consider changing your password once you're back in.`,
    html:
      `<p>Your account was locked after too many failed login attempts. ` +
      `Click the link below to unlock it:</p><p><a href="${unlockUrl}">${unlockUrl}</a></p>` +
      `<p>If this wasn't you, consider changing your password once you're back in.</p>`,
  });
}

// Sent only when "forgot password" was given the exact right email for the matched
// account -- see POST /api/auth/forgot-password/request. The link leads to a hosted page
// with a form, not back into the app, same as verify-email and unlock-account.
export async function sendResetEmail(to: string, resetUrl: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev-mode, no SMTP configured] Password reset link for ${to}:\n  ${resetUrl}`);
    return;
  }

  await t.sendMail({
    from: config.email.from,
    to,
    subject: `Reset your ${config.appName} password`,
    text:
      `Click the link below to set a new password:\n\n${resetUrl}\n\n` +
      `If you didn't request this, you can ignore this email -- your password won't change.`,
    html:
      `<p>Click the link below to set a new password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>` +
      `<p>If you didn't request this, you can ignore this email -- your password won't change.</p>`,
  });
}
