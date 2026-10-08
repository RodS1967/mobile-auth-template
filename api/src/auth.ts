import bcrypt from "bcryptjs";
import crypto from "crypto";

// Mirrors the CHECK constraint on users.username in schema.sql -- letters and digits only,
// 3-30 characters. Keeping this in sync with the database rule, not inventing a new one.
const USERNAME_PATTERN = /^[A-Za-z0-9]{3,30}$/;

// Deliberately simple -- good enough to catch typos, not a full RFC 5322 implementation.
// The real guarantee of a valid, reachable address comes from email verification, not this.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A "medium security" complexity baseline -- the kind most directories/sites default to
// (Active Directory's built-in policy is the classic example): a reasonable minimum
// length, at least 3 of the 4 character classes, not a known-common password, and
// doesn't contain the account's own username or email.
export const PASSWORD_MIN_LENGTH = 10;

export const COMMON_WEAK_PASSWORDS = [
  "123456", "123456789", "password", "12345678", "qwerty", "123123",
  "111111", "abc123", "password1", "admin", "admin123", "letmein",
  "letmein1", "welcome", "welcome1", "monkey", "dragon", "master",
  "iloveyou", "iloveyou1", "sunshine", "princess", "football", "baseball",
  "trustno1", "starwars", "shadow", "michael", "superman", "batman",
  "freedom", "whatever", "qwerty123", "1q2w3e4r", "zaq12wsx", "passw0rd",
  "p@ssw0rd", "changeme", "000000", "1234567890",
];

export function passwordClassCount(password: string): number {
  let count = 0;
  if (/[a-z]/.test(password)) count++;
  if (/[A-Z]/.test(password)) count++;
  if (/[0-9]/.test(password)) count++;
  if (/[^a-zA-Z0-9]/.test(password)) count++;
  return count;
}

// The words a password isn't allowed to contain (case-insensitive): the username, plus
// the local part of the email (the part before "@").
export function passwordDisallowedWords(username: string, email: string): string[] {
  const words = [username];
  const atIndex = email.indexOf("@");
  if (atIndex > 0) words.push(email.slice(0, atIndex));
  return words;
}

// No real Terms of Service / Privacy Policy text exists yet (blocked on lawyer review per
// PROJECT_BRIEF.md). This labels whatever placeholder consent the app currently shows, so a
// real version can replace it later without losing track of who agreed to what.
export const TERMS_VERSION = "placeholder-v0";

export interface ValidationError {
  field: string;
  message: string;
}

// Returns an empty array when valid, so callers can do `if (errors.length) { ... }`.
export function validateSignup(
  username: string,
  email: string,
  password: string,
  termsAccepted: boolean
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!termsAccepted) {
    errors.push({ field: "terms", message: "You must accept the terms to create an account." });
  }

  if (!USERNAME_PATTERN.test(username)) {
    errors.push({ field: "username", message: "Username must be 3-30 characters, letters and digits only." });
  }

  if (!EMAIL_PATTERN.test(email)) {
    errors.push({ field: "email", message: "Enter a valid email address." });
  }

  const passwordError = validatePasswordStrength(password, username, email);
  if (passwordError) {
    errors.push({ field: "password", message: passwordError });
  }

  return errors;
}

// Shared by signup and password-reset -- same rules apply whether the password is being
// set for the first time or replacing an old one. Returns null when the password is fine.
export function validatePasswordStrength(password: string, username: string, email: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (passwordClassCount(password) < 3) {
    return "Password must include at least 3 of: lowercase letters, uppercase letters, numbers, and symbols.";
  }
  if (COMMON_WEAK_PASSWORDS.includes(password.toLowerCase())) {
    return "That password is too common. Please choose something less predictable.";
  }
  const lower = password.toLowerCase();
  for (const word of passwordDisallowedWords(username, email)) {
    if (word && lower.includes(word.toLowerCase())) {
      return "Password can't contain your username or email.";
    }
  }
  return null;
}

// bcrypt's own salting makes two hashes of the same password look completely different --
// that's intentional, not a bug, and it's why we never compare hashes directly (see verifyPassword).
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Matches PROJECT_BRIEF.md's Authentication decisions: 5 failed logins locks the account.
export const LOCKOUT_THRESHOLD = 5;

// The login screen has one field; this is what decides which column to match it against.
export function isEmail(identifier: string): boolean {
  return identifier.includes("@");
}

// Hides most of a real email behind a fixed number of asterisks -- fixed rather than
// proportional to the real local-part/domain length, so the mask itself doesn't leak how
// long the address is. "jane@example.com" -> "j***@e***.com".
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const domainParts = domain.split(".");
  const tld = domainParts.pop() ?? "";
  const domainName = domainParts.join(".");
  return `${local[0]}***@${domainName[0]}***.${tld}`;
}

// Used when the identifier given to "forgot password" doesn't match any account, so the
// lookup step still returns *something* that looks like a real mask -- a request that
// doesn't match any account must be indistinguishable from one that does, or the lookup
// step itself becomes a way to test whether a username/email exists. Deterministic (hashed
// from the identifier) so retrying the same identifier shows the same fake mask each time,
// the way a real one would, rather than a new random mask that gives the game away.
export function fakeMaskedEmail(identifier: string): string {
  const letter = (salt: string) => {
    const hash = crypto.createHash("sha256").update(identifier.toLowerCase() + salt).digest();
    return String.fromCharCode(97 + (hash[0] % 26));
  };
  return `${letter("local")}***@${letter("domain")}***.com`;
}
