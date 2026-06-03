import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getJson, patchJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { useIsAuthenticated } from '../auth/useIsAuthenticated';
import { useDataSync } from '../data/DataSyncContext';

type NotificationsContextValue = {
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const isAuthed = useIsAuthenticated();
  const { subscribe } = useDataSync();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const authRef = useRef(auth);
  authRef.current = auth;

  const refresh = useCallback(async () => {
    const a = authRef.current;
    if (!isAuthed || a.state.isHydrating) return;
    setLoading(true);
    try {
      const data = await getJson<{ unreadCount: number }>(a, '/notifications/unread-count');
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore polling errors
    } finally {
      setLoading(false);
    }
  }, [isAuthed, auth.state.isHydrating]);

  const markAllRead = useCallback(async () => {
    await patchJson(auth, '/notifications/read-all', {});
    setUnreadCount(0);
  }, [auth]);

  useEffect(() => {
    if (!isAuthed || auth.state.isHydrating) {
      setUnreadCount(0);
      return;
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(timer);
  }, [isAuthed, auth.state.isHydrating, refresh]);

  useEffect(() => {
    return subscribe(['notifications'], () => {
      void refresh();
    });
  }, [subscribe, refresh]);

  const value = useMemo(
    () => ({ unreadCount, loading, refresh, markAllRead }),
    [unreadCount, loading, refresh, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

export type { NotificationsResponse } from '../api/types';
