// Part of mobile-auth-template (MIT) — github.com/RodS1967/mobile-auth-template - Team RodZilla LLC
// For local dev with a physical phone/emulator, this needs to be your dev machine's LAN
// IP (e.g. "http://192.168.1.x:3000"), not "localhost" -- the device is a separate machine
// on the network, not the one running the API. Swap this for the real deployed API domain
// in production -- it should always be a single setting like this, never hardcoded in
// multiple places.
export const API_BASE_URL = "http://localhost:3000";

export interface ApiFieldError {
  field: string;
  message: string;
}

// Carries the field-level errors the API sends back (e.g. "username" vs "password"),
// so a screen can show the right message next to the right field instead of one generic banner.
export class ApiError extends Error {
  errors: ApiFieldError[];
  code?: string;

  constructor(errors: ApiFieldError[], code?: string) {
    super(errors.map((e) => e.message).join(" "));
    this.errors = errors;
    this.code = code;
  }
}

export interface SignUpResult {
  id: number;
  username: string;
  email: string;
}

export interface LoginResult {
  token: string;
  user: { id: number; username: string; email: string; emailVerified: boolean };
}

export async function login(identifier: string, password: string): Promise<LoginResult> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const body = await response.json();
  if (!response.ok) {
    // The server sends one generic { error } string for login, not per-field errors --
    // unlike signup, there's nothing field-specific to say without leaking which part was wrong.
    // body.code (e.g. "EMAIL_NOT_VERIFIED") lets the screen react differently per reason
    // without parsing the human-readable message text.
    throw new ApiError([{ field: "form", message: body.error ?? "Could not log in." }], body.code);
  }
  return body as LoginResult;
}

export async function resendVerification(identifier: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });
  // Deliberately not checking response.ok or the body here -- the server always returns
  // the same generic message regardless of outcome (see index.ts), so there's nothing
  // more specific to surface to the caller.
}

export async function resendUnlock(identifier: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/resend-unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });
}

// Step 1 of "forgot password" -- shows a partially masked hint of the account's email
// (e.g. "r***@t***.com") without confirming anything. The server returns a look-alike fake
// mask for an identifier that doesn't match any account, so this response alone never
// reveals whether the account exists.
export async function lookupForgotPassword(identifier: string): Promise<{ maskedEmail: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError([{ field: "form", message: body.error ?? "Could not look up that account." }]);
  }
  return body as { maskedEmail: string };
}

// Step 2: the user has typed what they believe is the full email. The server never says
// whether it matched -- same generic response either way -- so there's nothing to return
// here but confirmation the request was sent.
export async function requestPasswordReset(identifier: string, email: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/forgot-password/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, email }),
  });
}

// The app's first authenticated calls -- `token` is the session token from login, sent as
// a bearer token, same as the server's requireSession middleware expects.

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body.errors ?? [{ field: "form", message: "Could not change password." }]);
  }
}

// Best-effort: the device clears its own stored session regardless of whether this call
// succeeds (see App.tsx's handleLogout) -- a network blip shouldn't be able to trap someone
// in a logged-in state they're trying to leave.
export async function logout(token: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
}

export async function signUp(
  username: string,
  email: string,
  password: string,
  termsAccepted: boolean
): Promise<SignUpResult> {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password, termsAccepted }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body.errors ?? [{ field: "form", message: "Something went wrong. Try again." }]);
  }
  return body as SignUpResult;
}
