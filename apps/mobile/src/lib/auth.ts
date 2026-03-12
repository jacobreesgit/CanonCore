import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "canoncore_jwt";
const USER_KEY = "canoncore_user";

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
}

/**
 * Store JWT token in hardware-backed secure storage.
 * iOS: Keychain. Android: Keystore.
 */
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * Store user profile in secure storage (JSON serialised).
 */
export async function setUser(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function removeUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_KEY);
}

/**
 * Clear all auth data (sign out).
 */
export async function clearAuth(): Promise<void> {
  await Promise.all([removeToken(), removeUser()]);
}
