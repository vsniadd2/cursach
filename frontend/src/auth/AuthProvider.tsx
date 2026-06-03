import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { API_BASE_URL } from '../api/config';
import { AuthContext, type AuthApi, type AuthState } from './AuthContext';
import { isAccessTokenStale } from './jwt';
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
      const data = (await res.json()) as { message?: string };
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
  /** Увеличивается при login/logout — отменяет устаревший hydrate/refresh. */
  const authEpoch = useRef(0);

  const applySession = useCallback((accessToken: string, refreshToken: string) => {
    setState({ accessToken, refreshToken, isHydrating: false });
  }, []);

  const signOut = useCallback(async () => {
    authEpoch.current += 1;
    refreshInFlight.current = null;
    const { refreshToken } = await loadTokens();
    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // выход локально даже при недоступном API
      }
    }
    await clearTokens();
    setState({ accessToken: null, refreshToken: null, isHydrating: false });
  }, []);

  const refreshAccessTokenInternal = useCallback(
    async (refreshToken: string, epoch: number): Promise<string | null> => {
      try {
        const data = await postJson<LoginResponse>(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        if (epoch !== authEpoch.current) return data.accessToken;
        await saveTokens(data);
        applySession(data.accessToken, data.refreshToken);
        return data.accessToken;
      } catch {
        if (epoch === authEpoch.current) {
          await signOut();
        }
        return null;
      }
    },
    [applySession, signOut],
  );

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = state.refreshToken;
    if (!refreshToken) {
      await signOut();
      return null;
    }

    const epoch = authEpoch.current;
    if (!refreshInFlight.current) {
      refreshInFlight.current = refreshAccessTokenInternal(refreshToken, epoch).finally(() => {
        refreshInFlight.current = null;
      });
    }

    return refreshInFlight.current;
  }, [refreshAccessTokenInternal, signOut, state.refreshToken]);

  useEffect(() => {
    const epoch = authEpoch.current;
    let alive = true;

    (async () => {
      try {
        const tokens = await loadTokens();
        if (!alive || epoch !== authEpoch.current) return;

        if (!tokens.refreshToken) {
          await clearTokens();
          if (epoch !== authEpoch.current) return;
          setState({ accessToken: null, refreshToken: null, isHydrating: false });
          return;
        }

        if (tokens.accessToken && !isAccessTokenStale(tokens.accessToken)) {
          if (epoch !== authEpoch.current) return;
          applySession(tokens.accessToken, tokens.refreshToken);
          return;
        }

        try {
          const data = await postJson<LoginResponse>(`${API_BASE_URL}/auth/refresh`, {
            refreshToken: tokens.refreshToken,
          });
          if (!alive || epoch !== authEpoch.current) return;
          await saveTokens(data);
          applySession(data.accessToken, data.refreshToken);
        } catch {
          if (!alive || epoch !== authEpoch.current) return;
          await clearTokens();
          setState({ accessToken: null, refreshToken: null, isHydrating: false });
        }
      } catch {
        if (!alive || epoch !== authEpoch.current) return;
        setState({ accessToken: null, refreshToken: null, isHydrating: false });
      }
    })();

    return () => {
      alive = false;
    };
  }, [applySession]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      authEpoch.current += 1;
      const data = await postJson<LoginResponse>(`${API_BASE_URL}/auth/login`, { username, password });
      await saveTokens(data);
      applySession(data.accessToken, data.refreshToken);
    },
    [applySession],
  );

  const signUp = useCallback(
    async (payload: { username: string; password: string; fullName?: string; email?: string }) => {
      authEpoch.current += 1;
      const data = await postJson<LoginResponse>(`${API_BASE_URL}/auth/register`, payload);
      await saveTokens(data);
      applySession(data.accessToken, data.refreshToken);
    },
    [applySession],
  );

  const getAccessToken = useCallback(async () => {
    if (state.accessToken && !isAccessTokenStale(state.accessToken)) {
      return state.accessToken;
    }
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

      const latest = await loadTokens();
      if (!latest.refreshToken) {
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
    [getAccessToken, refreshAccessToken, signOut],
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
