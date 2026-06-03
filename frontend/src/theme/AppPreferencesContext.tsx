import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getJson, patchJson, SessionExpiredError } from '../api/requests';
import type { AuthMeResponse, DashboardQuickAction } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useDataSync } from '../data/DataSyncContext';
import { formatMoneyAmount } from '../utils/formatMoney';
import { loadFxRates } from '../utils/fxRates';
import type { DealStage } from '../api/types';
import { dealStageLabel, normalizeAppLanguage, type AppLanguage } from '../utils/locale';
import type { AppPalette, UiThemeMode } from './palettes';
import { paletteForTheme } from './palettes';

export type AppPreferencesApi = {
  colors: AppPalette;
  theme: UiThemeMode;
  currency: string;
  language: AppLanguage;
  profile: AuthMeResponse | null;
  tenantRole: string | null;
  isAdmin: boolean;
  isMeLoading: boolean;
  meError: string | null;
  refreshMe: () => Promise<void>;
  updatePreferences: (p: {
    theme?: UiThemeMode;
    currency?: string;
    language?: AppLanguage;
    dashboardQuickActions?: DashboardQuickAction[];
  }) => Promise<boolean>;
  /** Сумма в USD из API; форматирование в валюте профиля с пересчётом по курсу. */
  formatMoney: (amountUsd: number) => string;
};

const AppPreferencesContext = createContext<AppPreferencesApi | null>(null);

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { invalidate } = useDataSync();
  const authRef = useRef(auth);
  authRef.current = auth;

  const [theme, setTheme] = useState<UiThemeMode>('light');
  const [currency, setCurrency] = useState('BYN');
  const [language, setLanguage] = useState<AppLanguage>('ru');
  const [profile, setProfile] = useState<AuthMeResponse | null>(null);
  const [isMeLoading, setIsMeLoading] = useState(false);
  const [meError, setMeError] = useState<string | null>(null);
  const [fxReady, setFxReady] = useState(0);

  const colors = useMemo(() => paletteForTheme(theme), [theme]);

  const formatMoney = useCallback(
    (amountUsd: number) => formatMoneyAmount(amountUsd, currency),
    [currency, fxReady],
  );

  useEffect(() => {
    void loadFxRates().then(() => setFxReady((n) => n + 1));
  }, []);

  const refreshMe = useCallback(async () => {
    const a = authRef.current;
    const hasSession = !!a.state.accessToken;
    if (!hasSession) {
      setProfile(null);
      return;
    }
    setIsMeLoading(true);
    setMeError(null);
    try {
      const me = await getJson<AuthMeResponse>(a, '/auth/me');
      setProfile({
        ...me,
        dashboardQuickActions: me.dashboardQuickActions ?? [],
      });
      if (me.theme === 'dark' || me.theme === 'light') setTheme(me.theme);
      if (me.currency) setCurrency(me.currency.toUpperCase());
      setLanguage(normalizeAppLanguage(me.language));
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        setProfile(null);
        setMeError(null);
        await a.signOut();
        return;
      }
      setMeError(e instanceof Error ? e.message : 'Не удалось загрузить профиль');
    } finally {
      setIsMeLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(async (p: {
    theme?: UiThemeMode;
    currency?: string;
    language?: AppLanguage;
    dashboardQuickActions?: DashboardQuickAction[];
  }) => {
    const a = authRef.current;
    setMeError(null);
    const body: {
      theme?: string;
      currency?: string;
      language?: string;
      dashboardQuickActions?: DashboardQuickAction[];
    } = {};
    if (p.theme !== undefined) body.theme = p.theme;
    if (p.currency !== undefined) body.currency = p.currency;
    if (p.language !== undefined) body.language = p.language;
    if (p.dashboardQuickActions !== undefined) body.dashboardQuickActions = p.dashboardQuickActions;

    const prev = { theme, currency, language, profile };
    if (p.theme !== undefined) setTheme(p.theme);
    if (p.currency !== undefined) setCurrency(p.currency.toUpperCase());
    if (p.language !== undefined) setLanguage(p.language);
    if (p.dashboardQuickActions !== undefined && profile) {
      setProfile({ ...profile, dashboardQuickActions: p.dashboardQuickActions });
    }

    try {
      const me = await patchJson<AuthMeResponse | null>(a, '/auth/me/preferences', body);
      if (me) {
        setProfile({
          ...me,
          dashboardQuickActions: me.dashboardQuickActions ?? [],
        });
        if (me.theme === 'dark' || me.theme === 'light') setTheme(me.theme);
        if (me.currency) setCurrency(me.currency.toUpperCase());
        setLanguage(normalizeAppLanguage(me.language));
      }
      invalidate('audit');
      return true;
    } catch (e) {
      setTheme(prev.theme);
      setCurrency(prev.currency);
      setLanguage(prev.language);
      if (prev.profile) setProfile(prev.profile);
      const msg = e instanceof Error ? e.message : 'Не удалось сохранить настройки';
      setMeError(msg);
      return false;
    }
  }, [currency, invalidate, language, profile, theme]);

  useEffect(() => {
    if (auth.state.isHydrating) return;
    if (!auth.state.accessToken) {
      setTheme('light');
      setCurrency('BYN');
      setLanguage('ru');
      setProfile(null);
      setMeError(null);
      return;
    }
    void refreshMe();
  }, [auth.state.isHydrating, auth.state.accessToken, refreshMe]);

  const tenantRole = profile?.tenantRole ?? null;
  const isAdmin = tenantRole === 'Admin' || tenantRole === 'Owner';

  const value = useMemo<AppPreferencesApi>(
    () => ({
      colors,
      theme,
      currency,
      language,
      profile,
      tenantRole,
      isAdmin,
      isMeLoading,
      meError,
      refreshMe,
      updatePreferences,
      formatMoney,
    }),
    [colors, currency, formatMoney, isAdmin, isMeLoading, language, meError, profile, refreshMe, tenantRole, theme, updatePreferences],
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

export function useDealStageLabel(): (stage: DealStage) => string {
  const { language } = useAppPreferences();
  return useCallback((stage: DealStage) => dealStageLabel(stage, language), [language]);
}
