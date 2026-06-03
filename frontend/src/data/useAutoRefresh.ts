import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { DataTopic } from './DataSyncContext';
import { useDataSync } from './DataSyncContext';

type Loader = () => void | (() => void);

/**
 * Перезагрузка данных при фокусе экрана и при invalidate связанных топиков.
 */
export function useAutoRefresh(topics: DataTopic[], loader: Loader) {
  const { subscribe } = useDataSync();
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const topicsRef = useRef(topics);
  topicsRef.current = topics;

  const topicsKey = useMemo(() => topics.join(','), [topics]);

  const runLoader = useCallback(() => {
    return loaderRef.current();
  }, []);

  useFocusEffect(
    useCallback(() => {
      return runLoader();
    }, [runLoader]),
  );

  useEffect(() => {
    if (topicsRef.current.length === 0) return;
    return subscribe(topicsRef.current, () => {
      runLoader();
    });
  }, [topicsKey, subscribe, runLoader]);
}
