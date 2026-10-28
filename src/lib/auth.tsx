import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '../../shared/types';
import { api, ApiError } from './api';

export type SignupInput = Record<string, unknown> & { role: 'player' | 'org'; name: string; email: string; password: string };

interface AuthState {
  /** undefined while the session is being checked. */
  user: User | null | undefined;
  login(email: string, password: string): Promise<User>;
  signup(input: SignupInput): Promise<User>;
  logout(): Promise<void>;
  setUser(user: User): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then((r) => setUserState(r.user))
      .catch((err) => {
        if (err instanceof ApiError && err.status !== 401) console.warn(err.message);
        setUserState(null);
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ user: User }>('/auth/login', { body: { email, password } });
    setUserState(r.user);
    return r.user;
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const r = await api<{ user: User }>('/auth/signup', { body: input });
    setUserState(r.user);
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { body: {} });
    } finally {
      setUserState(null);
    }
  }, []);

  const value = useMemo<AuthState>(() => ({ user, login, signup, logout, setUser: setUserState }), [user, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For screens that only render when signed in. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUser called without a signed-in user');
  return user;
}

export const homeFor = (u: User) => (u.role === 'org' ? '/org' : '/play');
