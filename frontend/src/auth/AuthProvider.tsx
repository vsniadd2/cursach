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

  const signOut = useCallback(async () => {
    refreshInFlight.current = null;
    await clearTokens();
    setState({ accessToken: null, refreshToken: null, isHydrating: false });
  }, []);

  const refreshAccessTokenInternal = useCallback(
    async (refreshToken: string): Promise<string | null> => {
      try {
        const data = await postJson<LoginResponse>(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        await saveTokens(data);
        setState({ accessToken: data.accessToken, refreshToken: data.refreshToken, isHydrating: false });
        return data.accessToken;
      } catch {
        await signOut();
        return null;
      }
    },
    [signOut],
  );

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = state.refreshToken;
    if (!refreshToken) {
      await signOut();
      return null;
    }

    if (!refreshInFlight.current) {
      refreshInFlight.current = refreshAccessTokenInternal(refreshToken).finally(() => {
        refreshInFlight.current = null;
      });
    }

    return refreshInFlight.current;
  }, [refreshAccessTokenInternal, signOut, state.refreshToken]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const tokens = await loadTokens();
        if (!alive) return;

        if (!tokens.refreshToken) {
          if (tokens.accessToken) {
            setState({
              accessToken: tokens.accessToken,
              refreshToken: null,
              isHydrating: false,
            });
            return;
          }
          setState({ accessToken: null, refreshToken: null, isHydrating: false });
          return;
        }

        // Проверяем сессию при старте: недействительный refresh → экран входа.
        try {
          const data = await postJson<LoginResponse>(`${API_BASE_URL}/auth/refresh`, {
            refreshToken: tokens.refreshToken,
          });
          if (!alive) return;
          await saveTokens(data);
          setState({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isHydrating: false,
          });
        } catch {
          if (!alive) return;
          await clearTokens();
          setState({ accessToken: null, refreshToken: null, isHydrating: false });
        }
      } catch {
        if (!alive) return;
        setState({ accessToken: null, refreshToken: null, isHydrating: false });
      }
    })();

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
    [],
  );

  const getAccessToken = useCallback(async () => {
    if (state.accessToken) return state.accessToken;
    if (!state.refreshToken) return null;
    return await refreshAccessToken();
  }, [refreshAccessToken, state.accessToken, state.refreshToken]);

  const fetchWithAuth = useCallback<AuthApi['fetchWithAuth']>(
    async (input, init) => {
      const token = await getAccessToken();
      const headers = new Headers(init?.headers ?? {});
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const res = await fetch(input, { ...init, headers });
      if (res.status !== 401) return res;

      if (!state.refreshToken) {
        await signOut();
        return res;
      }

      const newAccess = await refreshAccessToken();
      if (!newAccess) return res;

      const headers2 = new Headers(init?.headers ?? {});
      headers2.set('Authorization', `Bearer ${newAccess}`);
      const retry = await fetch(input, { ...init, headers: headers2 });

      if (retry.status === 401) {
        await signOut();
      }

      return retry;
    },
    [getAccessToken, refreshAccessToken, signOut, state.refreshToken],
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
    [fetchWithAuth, getAccessToken, signIn, signOut, signUp, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
