// Mirrors the server's policy (api/src/auth.ts) -- this is a live UX nudge only, duplicated
// here the same way the server's own hosted reset-password page duplicates it into inline
// JS (api/src/authPages.ts). The real enforcement is the server's validatePasswordStrength;
// this can never be more lenient than that without the API call simply failing with the
// server's own error message.
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

export interface PasswordChecks {
  length: boolean;
  variety: boolean;
  common: boolean;
  username: boolean;
}

function passwordClassCount(password: string): number {
  let count = 0;
  if (/[a-z]/.test(password)) count++;
  if (/[A-Z]/.test(password)) count++;
  if (/[0-9]/.test(password)) count++;
  if (/[^a-zA-Z0-9]/.test(password)) count++;
  return count;
}

function containsAny(lowerPassword: string, words: string[]): boolean {
  return words.some((word) => word && lowerPassword.includes(word));
}

// Shared by every screen with a "new password" field (sign-up, change-password) so the
// live checklist can't drift out of sync between them.
export function evaluatePassword(password: string, username: string, email: string): PasswordChecks {
  const lowerPassword = password.toLowerCase();
  const disallowedWords = [username.toLowerCase(), email.split("@")[0]?.toLowerCase() ?? ""];
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    variety: passwordClassCount(password) >= 3,
    common: !COMMON_WEAK_PASSWORDS.includes(lowerPassword),
    username: password.length === 0 || !containsAny(lowerPassword, disallowedWords),
  };
}
