import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getJson, patchJson } from '../api/requests';
import type { AuthMeResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { formatMoneyAmount } from '../utils/formatMoney';
import type { AppPalette, UiThemeMode } from './palettes';
import { paletteForTheme } from './palettes';

export type AppPreferencesApi = {
  colors: AppPalette;
  theme: UiThemeMode;
  currency: string;
  profile: AuthMeResponse | null;
  isMeLoading: boolean;
  meError: string | null;
  refreshMe: () => Promise<void>;
  updatePreferences: (p: { theme?: UiThemeMode; currency?: string }) => Promise<boolean>;
  /** Сумма в USD из API; форматирование в валюте профиля с пересчётом по курсу. */
  formatMoney: (amountUsd: number) => string;
};

const AppPreferencesContext = createContext<AppPreferencesApi | null>(null);

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;

  const [theme, setTheme] = useState<UiThemeMode>('light');
  const [currency, setCurrency] = useState('BYN');
  const [profile, setProfile] = useState<AuthMeResponse | null>(null);
  const [isMeLoading, setIsMeLoading] = useState(false);
  const [meError, setMeError] = useState<string | null>(null);

  const colors = useMemo(() => paletteForTheme(theme), [theme]);

  const formatMoney = useCallback(
    (amountUsd: number) => formatMoneyAmount(amountUsd, currency),
    [currency],
  );

  const refreshMe = useCallback(async () => {
    const a = authRef.current;
    const hasSession = !!(a.state.accessToken || a.state.refreshToken);
    if (!hasSession) {
      setProfile(null);
      return;
    }
    setIsMeLoading(true);
    setMeError(null);
    try {
      const me = await getJson<AuthMeResponse>(a, '/auth/me');
      setProfile(me);
      if (me.theme === 'dark' || me.theme === 'light') setTheme(me.theme);
      if (me.currency) setCurrency(me.currency.toUpperCase());
    } catch (e) {
      setMeError(e instanceof Error ? e.message : 'Не удалось загрузить профиль');
    } finally {
      setIsMeLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(async (p: { theme?: UiThemeMode; currency?: string }) => {
    const a = authRef.current;
    setMeError(null);
    const body: { theme?: string; currency?: string } = {};
    if (p.theme !== undefined) body.theme = p.theme;
    if (p.currency !== undefined) body.currency = p.currency;
    try {
      const me = await patchJson<AuthMeResponse | null>(a, '/auth/me/preferences', body);
      if (me) {
        setProfile(me);
        if (me.theme === 'dark' || me.theme === 'light') setTheme(me.theme);
        if (me.currency) setCurrency(me.currency.toUpperCase());
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось сохранить настройки';
      setMeError(msg);
      return false;
    }
  }, []);

  useEffect(() => {
    if (auth.state.isHydrating) return;
    if (!auth.state.accessToken && !auth.state.refreshToken) {
      setTheme('light');
      setCurrency('BYN');
      setProfile(null);
      setMeError(null);
      return;
    }
    void refreshMe();
  }, [auth.state.isHydrating, auth.state.accessToken, auth.state.refreshToken, refreshMe]);

  const value = useMemo<AppPreferencesApi>(
    () => ({
      colors,
      theme,
      currency,
      profile,
      isMeLoading,
      meError,
      refreshMe,
      updatePreferences,
      formatMoney,
    }),
    [colors, currency, formatMoney, isMeLoading, meError, profile, refreshMe, theme, updatePreferences],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences(): AppPreferencesApi {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }
  return ctx;
}

export function useAppColors(): AppPalette {
  return useAppPreferences().colors;
}
