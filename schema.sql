-- Part of mobile-auth-template (MIT) — github.com/RodS1967/mobile-auth-template - Team RodZilla LLC
--
-- Mobile Auth Template — Database Schema
-- Dialect: MariaDB (also runs on MySQL 8+).
--
-- Naming convention: every primary key is qualified with its table's singular
-- name (e.g. user_id, not bare id), so the same column name anywhere else in
-- this schema unambiguously refers back to that table.
--
-- Just the four auth tables -- add your own application tables (and a
-- subscription/billing column or table on users, if needed) on top of this.

-- Username: letters and digits only, 3-30 characters, case-insensitive unique.
-- Login accepts either username or email: an input containing "@" is treated
-- as an email, anything else as a username.
-- Email: normalized to lowercase by the app before storing. Must be verified
-- (email_verified_at) before login succeeds.
-- Lockout: failed_login_count resets on successful login; locked_at is set
-- when the threshold is reached (api/src/auth.ts, LOCKOUT_THRESHOLD) and
-- cleared when the user follows the unlock link sent by email.
-- Consent: terms_accepted_at / terms_version record the Terms of
-- Service/Privacy Policy version the user accepted, if your app has one.
CREATE TABLE users (
    user_id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username             VARCHAR(30) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
    email                VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at    DATETIME NULL,
    password_hash        VARCHAR(255) NOT NULL,
    failed_login_count   INT UNSIGNED NOT NULL DEFAULT 0,
    locked_at            DATETIME NULL,
    terms_accepted_at    DATETIME NULL,
    terms_version        VARCHAR(20) NULL,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (username REGEXP '^[A-Za-z0-9]{3,30}$')
);

-- One-time links sent by email: verify the address, reset the password, or
-- unlock a locked account. Only a hash of the token is stored, never the
-- token itself, so a database leak doesn't expose usable links.
CREATE TABLE auth_tokens (
    auth_token_id  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        BIGINT UNSIGNED NOT NULL,
    purpose        ENUM('verify_email', 'reset_password', 'unlock_account') NOT NULL,
    token_hash     CHAR(64) NOT NULL UNIQUE, -- SHA-256 hex of the emailed token
    expires_at     DATETIME NOT NULL,
    used_at        DATETIME NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Hashes of passwords a user has previously set (not including the current
-- one, which lives on users.password_hash) -- checked on password reset and
-- change-password so neither can just put the same password straight back.
-- Trimmed to the last few rows per user; see api/src/passwordHistory.ts for
-- the exact count and the trimming logic.
CREATE TABLE password_history (
    password_history_id  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id               BIGINT UNSIGNED NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- A logged-in device. The app keeps the raw session token in secure device
-- storage (expo-secure-store); the server keeps only its hash. Revoking a
-- session (logout, change-password, or a password reset) sets revoked_at --
-- see api/src/sessions.ts for which flow revokes which sessions and why.
CREATE TABLE user_sessions (
    user_session_id  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id          BIGINT UNSIGNED NOT NULL,
    token_hash       CHAR(64) NOT NULL UNIQUE, -- SHA-256 hex of the session token
    device_name      VARCHAR(100) NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at     DATETIME NULL,
    expires_at       DATETIME NOT NULL,
    revoked_at       DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
