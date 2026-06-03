import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export type DataTopic =
  | 'clients'
  | 'deals'
  | 'tasks'
  | 'dashboard'
  | 'notifications'
  | 'reports'
  | 'team'
  | 'billing'
  | 'integrations'
  | 'audit'
  | 'all';

const ALL_TOPICS: readonly DataTopic[] = [
  'clients',
  'deals',
  'tasks',
  'dashboard',
  'notifications',
  'reports',
  'team',
  'billing',
  'integrations',
  'audit',
];

type Listener = (topic: DataTopic) => void;

type DataSyncContextValue = {
  invalidate: (...topics: DataTopic[]) => void;
  subscribe: (topics: DataTopic[], listener: Listener) => () => void;
  getVersion: (topic: DataTopic) => number;
};

const DataSyncContext = createContext<DataSyncContextValue | null>(null);

export function DataSyncProvider({ children }: { children: ReactNode }) {
  const versionsRef = useRef<Record<DataTopic, number>>({
    clients: 0,
    deals: 0,
    tasks: 0,
    dashboard: 0,
    notifications: 0,
    reports: 0,
    team: 0,
    billing: 0,
    integrations: 0,
    audit: 0,
    all: 0,
  });
  const listenersRef = useRef<Set<{ topics: DataTopic[]; listener: Listener }>>(new Set());
  const [, bump] = useState(0);

  const notify = useCallback((topic: DataTopic) => {
    for (const entry of listenersRef.current) {
      if (entry.topics.includes('all') || entry.topics.includes(topic) || topic === 'all') {
        entry.listener(topic);
      }
    }
  }, []);

  const invalidate = useCallback(
    (...topics: DataTopic[]) => {
      const set = new Set<DataTopic>(topics.length ? topics : ['all']);
      if (set.has('all')) {
        for (const t of ALL_TOPICS) {
          versionsRef.current[t] += 1;
          notify(t);
        }
        versionsRef.current.all += 1;
        notify('all');
      } else {
        for (const t of set) {
          if (t === 'all') continue;
          versionsRef.current[t] += 1;
          notify(t);
        }
      }
      bump((n) => n + 1);
    },
    [notify],
  );

  const subscribe = useCallback((topics: DataTopic[], listener: Listener) => {
    const entry = { topics, listener };
    listenersRef.current.add(entry);
    return () => {
      listenersRef.current.delete(entry);
    };
  }, []);

  const getVersion = useCallback((topic: DataTopic) => versionsRef.current[topic], []);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        invalidate('all');
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [invalidate]);

  const value = useMemo(
    () => ({ invalidate, subscribe, getVersion }),
    [invalidate, subscribe, getVersion],
  );

  return <DataSyncContext.Provider value={value}>{children}</DataSyncContext.Provider>;
}

export function useDataSync(): DataSyncContextValue {
  const ctx = useContext(DataSyncContext);
  if (!ctx) {
    throw new Error('useDataSync must be used within DataSyncProvider');
  }
  return ctx;
}
