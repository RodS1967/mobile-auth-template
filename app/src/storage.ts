// Part of mobile-auth-template (MIT) — github.com/RodS1967/mobile-auth-template - Team RodZilla LLC
import * as SecureStore from "expo-secure-store";

// SecureStore uses the device's own encrypted storage (iOS Keychain, Android Keystore) --
// that's "secure device storage" from PROJECT_BRIEF.md's Authentication decisions, not
// something we're implementing ourselves.
const TOKEN_KEY = "sessionToken";
const USER_KEY = "sessionUser";

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
}

export async function saveSession(token: string, user: SessionUser): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function loadSession(): Promise<{ token: string; user: SessionUser } | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const userJson = await SecureStore.getItemAsync(USER_KEY);
  if (!token || !userJson) return null;
  return { token, user: JSON.parse(userJson) as SessionUser };
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
