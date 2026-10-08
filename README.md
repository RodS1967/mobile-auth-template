# Mobile Auth Template

A complete, production-style account system for a mobile app — sign-up, email
verification, login, account lockout, forgot/reset password, password
complexity + reuse history, and authenticated session management (change
password, logout) — ready to drop your actual app's features on top of.

Extracted from a real app's auth system, not written as a toy example: every
piece here was built incrementally, tested end to end on a real device, and
hardened in response to real issues found along the way (see the comments
throughout the code for the reasoning behind each design choice).

## Stack

- **API** (`api/`): Node 22 + TypeScript + Express + MariaDB/MySQL (`mysql2`)
- **App** (`app/`): React Native + TypeScript via Expo (SDK 57)
- Sessions stored on-device via `expo-secure-store` (iOS Keychain / Android
  Keystore)
- Email via `nodemailer` — falls back to logging links to the console when no
  SMTP server is configured, so the whole flow is testable before you have one

## What's included

- **Sign-up** with username/email/password validation
- **Email verification** — login is blocked until verified, with a resend option
- **Login** accepting username or email, with per-IP rate limiting and
  per-account lockout (5 failed attempts) as two deliberately separate
  defenses — see the comments in `api/src/index.ts`
- **Account lockout** with an emailed unlock link (also resendable)
- **Forgot/reset password** — a masked-email confirmation step before sending
  the reset link, a hosted reset-password page (not a bare form) with a live
  password-strength checklist
- **Password policy** shared by every password-set flow: minimum length 10,
  at least 3 of 4 character classes, a common-password blocklist, can't
  contain the username or email (`api/src/auth.ts`, mirrored client-side in
  `app/src/passwordPolicy.ts` for live UX feedback)
- **Password reuse history** — the last 5 passwords (current + 4 prior) can't
  be reused, enforced on reset and change-password
- **Session verification middleware** (`requireSession`) and two authenticated
  endpoints: **Change Password** (revokes every *other* session, keeps the
  current device logged in) and **Logout** (revokes the session server-side,
  not just a local clear)
- Styled, mobile-friendly HTML for every page a user lands on after clicking
  an emailed link (verify, unlock, reset) — not bare text

## What's deliberately *not* included

This is an auth template, not a SaaS starter kit. No billing/subscription
fields, no admin dashboard, no push notifications. Add what your app needs on
top of `users` and the session/token infrastructure.

Also not included: sign-up rate limiting (login has it; sign-up doesn't yet).

## Setup

### 1. Database

Create a MariaDB/MySQL database and run `schema.sql` against it:

```bash
mysql -u root -p your_database < schema.sql
```

### 2. API (`api/`)

```bash
cd api
npm install
cp .env.example .env
# edit .env: DB_USER/DB_PASSWORD/DB_NAME at minimum. Leave SMTP_* blank to
# start -- emailed links will just print to the console instead of sending.
npm run dev
```

### 3. App (`app/`)

```bash
cd app
npm install
# edit app/src/api.ts -- API_BASE_URL needs to be your dev machine's LAN IP
# (not "localhost") if you're running on a physical device or emulator.
npm run start
```

Scan the QR code with Expo Go (iOS/Android), or press `a`/`i` to launch an
emulator/simulator if you have one set up.

## Renaming it for your app

Two places control the product name shown to users:

- `api/.env` → `APP_NAME` (email subjects, the hosted verify/unlock/reset pages)
- `app/src/config.ts` → `APP_NAME` (the login screen)

Everything else (package names, `app.json`) is already generic placeholder
text — change it as you would for any new Expo project.

## Security design notes

A few choices worth knowing about before you build on top of this:

- Tokens (session tokens, email-link tokens) are never stored raw — only a
  SHA-256 hash. A database leak doesn't hand out usable tokens.
- Login errors are deliberately generic ("username/email or password is
  incorrect") so a wrong guess can't be used to probe which accounts exist.
  Sign-up's duplicate-username/email error is *not* generic — that's a
  conscious tradeoff (users need to know a username is taken), not an
  oversight.
- The "forgot password" masked-email hint is a UX nudge, not a security
  boundary — a deterministic fake mask is shown for a non-existent account so
  the lookup step itself can't be used to test account existence.
- Password reset revokes *every* session on the account (no existing session
  to spare — identity was proven via email, not a login). Change-password
  (already logged in) revokes every *other* session but leaves the current
  device logged in.

## License

MIT — see [`LICENSE`](LICENSE). Use this for anything, including commercial
projects, no attribution required (though appreciated).
