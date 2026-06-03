import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { useIsAuthenticated } from '../auth/useIsAuthenticated';
import { useDataSync } from './DataSyncContext';

export type BillingSubscriptionSummary = {
  planCode: string;
  planName: string;
  status: string;
};

type BillingSubscriptionContextValue = {
  subscription: BillingSubscriptionSummary | null;
  loading: boolean;
  refresh: () => void;
};

const BillingSubscriptionContext = createContext<BillingSubscriptionContextValue | null>(null);

export function BillingSubscriptionProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const isAuthed = useIsAuthenticated();
  const { subscribe } = useDataSync();
  const [subscription, setSubscription] = useState<BillingSubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!isAuthed) {
      setSubscription(null);
      setLoading(false);
      return () => undefined;
    }

    let alive = true;
    setLoading(true);
    getJson<{ planCode: string; planName: string; status: string }>(auth, '/billing/subscription')
      .then((s) => {
        if (!alive) return;
        setSubscription({
          planCode: s.planCode,
          planName: s.planName,
          status: s.status,
        });
      })
      .catch(() => {
        if (!alive) return;
        setSubscription(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [auth, isAuthed]);

  useEffect(() => refresh(), [refresh]);

  useEffect(() => subscribe(['billing'], () => refresh()), [subscribe, refresh]);

  const value = useMemo(
    () => ({ subscription, loading, refresh }),
    [subscription, loading, refresh],
  );

  return (
    <BillingSubscriptionContext.Provider value={value}>{children}</BillingSubscriptionContext.Provider>
  );
}

export function useBillingSubscription(): BillingSubscriptionContextValue {
  const ctx = useContext(BillingSubscriptionContext);
  if (!ctx) {
    throw new Error('useBillingSubscription must be used within BillingSubscriptionProvider');
  }
  return ctx;
}
