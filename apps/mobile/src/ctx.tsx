import React, { use, useCallback, useEffect, useState } from "react";
import {
  getToken,
  getUser,
  setToken,
  setUser,
  clearAuth,
  type AuthUser,
} from "@/lib/auth";

interface AuthContextValue {
  /** The JWT token, null when signed out */
  token: string | null;
  /** The current user, null when signed out */
  user: AuthUser | null;
  /** Whether auth state is loading from secure storage */
  isLoading: boolean;
  /** Sign in — stores token and user */
  signIn: (token: string, user: AuthUser) => Promise<void>;
  /** Sign out — clears token and user */
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/**
 * Access auth context. Must be used inside <SessionProvider>.
 * Uses React 19's `use()` hook (not useContext).
 */
export function useSession(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error("useSession must be wrapped in a <SessionProvider />");
  }
  return value;
}

/**
 * Provides auth state to the entire app.
 * Loads JWT + user from expo-secure-store on mount.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted auth on mount
  useEffect(() => {
    async function loadAuth() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          getToken(),
          getUser(),
        ]);
        if (storedToken && storedUser) {
          setTokenState(storedToken);
          setUserState(storedUser);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadAuth();
  }, []);

  const signIn = useCallback(async (newToken: string, newUser: AuthUser) => {
    await Promise.all([setToken(newToken), setUser(newUser)]);
    setTokenState(newToken);
    setUserState(newUser);
  }, []);

  const signOut = useCallback(async () => {
    await clearAuth();
    setTokenState(null);
    setUserState(null);
  }, []);

  return (
    <AuthContext value={{ token, user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext>
  );
}
