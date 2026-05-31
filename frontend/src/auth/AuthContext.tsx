import { createContext, useContext } from 'react';

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  isHydrating: boolean;
};

export type AuthApi = {
  state: AuthState;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (payload: { username: string; password: string; fullName?: string; email?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  fetchWithAuth: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export { AuthContext };

