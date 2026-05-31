import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { formatDateRu, formatDateTimeRu } from '../utils/locale';

type SubscriptionDto = {
  id: number;
  tenantId: number;
  planCode: string;
  status: string;
  seatsLimit: number;
  storageGbLimit: number;
  currentPeriodStartUtc: string;
  currentPeriodEndUtc: string;
};

type UsageResponse = {
  items: Array<{ metricKey: string; value: number; recordedAtUtc: string }>;
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 6 },
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 14,
      marginBottom: 10,
    },
    label: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 4 },
    value: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
    mono: { fontFamily: undefined, fontSize: 12, color: colors.onSurfaceVariant },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreBilling'>;

export function BillingScreen({ navigation }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const auth = useAuth();

  const [sub, setSub] = useState<SubscriptionDto | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getJson<SubscriptionDto>(auth, '/billing/subscription'),
      getJson<UsageResponse>(auth, '/billing/usage'),
    ])
      .then(([s, u]) => {
        if (!alive) return;
        setSub(s);
        setUsage(u);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auth]);

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>Тариф и лимиты</Text>
        <Text style={styles.sub}>Подписка tenant, usage metering (последние записи).</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {sub ? (
          <View style={styles.card}>
            <Text style={styles.label}>План</Text>
            <Text style={styles.value}>{sub.planCode}</Text>
            <Text style={[styles.label, { marginTop: 10 }]}>Статус</Text>
            <Text style={styles.value}>{sub.status}</Text>
            <Text style={[styles.label, { marginTop: 10 }]}>Места / хранилище</Text>
            <Text style={styles.value}>
              {sub.seatsLimit} пользователей, {sub.storageGbLimit} ГБ
            </Text>
            <Text style={[styles.label, { marginTop: 10 }]}>Период</Text>
            <Text style={styles.mono}>
              {formatDateRu(sub.currentPeriodStartUtc)} —{' '}
              {formatDateRu(sub.currentPeriodEndUtc)}
            </Text>
          </View>
        ) : null}
        {usage?.items?.length ? (
          <View style={styles.card}>
            <Text style={styles.label}>Метрики (usage)</Text>
            {usage.items.slice(0, 30).map((x) => (
              <Text key={`${x.metricKey}-${x.recordedAtUtc}`} style={styles.mono}>
                {x.metricKey}: {x.value} @ {formatDateTimeRu(x.recordedAtUtc)}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
