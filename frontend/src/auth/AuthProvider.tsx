import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { API_BASE_URL } from '../api/config';
import { AuthContext, type AuthApi, type AuthState } from './AuthContext';
import { clearTokens, loadTokens, saveTokens } from './tokens';

type LoginResponse = { accessToken: string; refreshToken: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as any;
      msg = data?.message ?? msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return (await res.json()) as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    refreshToken: null,
    isHydrating: true,
  });

  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    let alive = true;
    loadTokens()
      .then((t) => {
        if (!alive) return;
        setState({ accessToken: t.accessToken, refreshToken: t.refreshToken, isHydrating: false });
      })
      .catch(() => {
        if (!alive) return;
        setState({ accessToken: null, refreshToken: null, isHydrating: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const data = await postJson<LoginResponse>(`${API_BASE_URL}/auth/login`, { username, password });
    await saveTokens(data);
    setState({ accessToken: data.accessToken, refreshToken: data.refreshToken, isHydrating: false });
  }, []);

  const signUp = useCallback(
    async (payload: { username: string; password: string; fullName?: string; email?: string }) => {
      const data = await postJson<LoginResponse>(`${API_BASE_URL}/auth/register`, payload);
      await saveTokens(data);
      setState({ accessToken: data.accessToken, refreshToken: data.refreshToken, isHydrating: false });
    },
    []
  );

  const signOut = useCallback(async () => {
    refreshInFlight.current = null;
    await clearTokens();
    setState({ accessToken: null, refreshToken: null, isHydrating: false });
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (!state.refreshToken) return null;
    const data = await postJson<LoginResponse>(`${API_BASE_URL}/auth/refresh`, {
      refreshToken: state.refreshToken,
    });
    await saveTokens(data);
    setState({ accessToken: data.accessToken, refreshToken: data.refreshToken, isHydrating: false });
    return data.accessToken;
  }, [state.refreshToken]);

  const getAccessToken = useCallback(async () => {
    if (state.accessToken) return state.accessToken;
    if (!state.refreshToken) return null;

    if (!refreshInFlight.current) {
      refreshInFlight.current = refreshAccessToken().finally(() => {
        refreshInFlight.current = null;
      });
    }
    return await refreshInFlight.current;
  }, [refreshAccessToken, state.accessToken, state.refreshToken]);

  const fetchWithAuth = useCallback<AuthApi['fetchWithAuth']>(
    async (input, init) => {
      const token = await getAccessToken();
      const headers = new Headers(init?.headers ?? {});
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const res = await fetch(input, { ...init, headers });
      if (res.status !== 401) return res;

      // Access token мог истечь — пытаемся обновить и повторить один раз
      if (!state.refreshToken) return res;

      const newAccess = await refreshAccessToken();
      if (!newAccess) return res;

      const headers2 = new Headers(init?.headers ?? {});
      headers2.set('Authorization', `Bearer ${newAccess}`);
      return await fetch(input, { ...init, headers: headers2 });
    },
    [getAccessToken, refreshAccessToken, state.refreshToken]
  );

  const value = useMemo<AuthApi>(
    () => ({
      state,
      signIn,
      signUp,
      signOut,
      getAccessToken,
      fetchWithAuth,
    }),
    [fetchWithAuth, getAccessToken, signIn, signOut, signUp, state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

