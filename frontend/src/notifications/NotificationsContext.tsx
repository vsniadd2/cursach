import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getJson, patchJson } from '../api/requests';
import type { NotificationItem, NotificationsResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useIsAuthenticated } from '../auth/useIsAuthenticated';
import { useDataSync } from '../data/DataSyncContext';

type NotificationsContextValue = {
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  pendingToast: NotificationItem | null;
  dismissToast: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const TOAST_TYPES = new Set(['TaskAssignedByManager']);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const isAuthed = useIsAuthenticated();
  const { subscribe } = useDataSync();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pendingToast, setPendingToast] = useState<NotificationItem | null>(null);
  const authRef = useRef(auth);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);
  const toastQueueRef = useRef<NotificationItem[]>([]);
  const showingToastRef = useRef(false);
  authRef.current = auth;

  const enqueueToast = useCallback((item: NotificationItem) => {
    if (!TOAST_TYPES.has(item.type)) return;
    toastQueueRef.current.push(item);
    if (!showingToastRef.current) {
      const next = toastQueueRef.current.shift();
      if (next) {
        showingToastRef.current = true;
        setPendingToast(next);
      }
    }
  }, []);

  const dismissToast = useCallback(() => {
    showingToastRef.current = false;
    setPendingToast(null);
    const next = toastQueueRef.current.shift();
    if (next) {
      showingToastRef.current = true;
      setPendingToast(next);
    }
  }, []);

  const refresh = useCallback(async () => {
    const a = authRef.current;
    if (!isAuthed || a.state.isHydrating) return;
    setLoading(true);
    try {
      const data = await getJson<NotificationsResponse>(a, '/notifications?unreadOnly=true&take=10');
      setUnreadCount(data.unreadCount);

      for (const item of data.items) {
        if (seenIdsRef.current.has(item.id)) continue;
        seenIdsRef.current.add(item.id);
        if (initializedRef.current && !item.isRead && TOAST_TYPES.has(item.type)) {
          enqueueToast(item);
        }
      }
      initializedRef.current = true;
    } catch {
      // ignore polling errors
    } finally {
      setLoading(false);
    }
  }, [isAuthed, auth.state.isHydrating, enqueueToast]);

  const markAllRead = useCallback(async () => {
    await patchJson(auth, '/notifications/read-all', {});
    setUnreadCount(0);
  }, [auth]);

  useEffect(() => {
    if (!isAuthed || auth.state.isHydrating) {
      setUnreadCount(0);
      seenIdsRef.current = new Set();
      initializedRef.current = false;
      toastQueueRef.current = [];
      showingToastRef.current = false;
      setPendingToast(null);
      return;
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(timer);
  }, [isAuthed, auth.state.isHydrating, refresh]);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    return subscribe(['notifications'], () => {
      void refresh();
    });
  }, [subscribe, refresh]);

  const value = useMemo(
    () => ({ unreadCount, loading, refresh, markAllRead, pendingToast, dismissToast }),
    [unreadCount, loading, refresh, markAllRead, pendingToast, dismissToast],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

export type { NotificationsResponse } from '../api/types';
