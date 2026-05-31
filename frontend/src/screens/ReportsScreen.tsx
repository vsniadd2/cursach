import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

type ReportSummary = {
  totalDeals: number;
  closedDeals: number;
  conversionPct: number;
  monthRevenueUsd: number;
  quarterRevenueUsd: number;
  overdueTasks: number;
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 6 },
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
    grid: { gap: 10 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 14,
    },
    label: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 4 },
    value: { fontSize: 22, fontWeight: '900', color: colors.onSurface },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreReports'>;

export function ReportsScreen({ navigation }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const { formatMoney } = useAppPreferences();
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getJson<ReportSummary>(auth, '/reports/summary')
      .then((d) => {
        if (!alive) return;
        setData(d);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки отчёта');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>Отчёты</Text>
        <Text style={styles.sub}>KPI текущего tenant. Хранение сумм в USD, показ в выбранной валюте профиля.</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {data ? (
          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.label}>Выручка за месяц</Text>
              <Text style={styles.value}>{formatMoney(data.monthRevenueUsd)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Выручка за квартал</Text>
              <Text style={styles.value}>{formatMoney(data.quarterRevenueUsd)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Конверсия в закрытие</Text>
              <Text style={styles.value}>{data.conversionPct}%</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Сделок / закрытых</Text>
              <Text style={styles.value}>
                {data.totalDeals} / {data.closedDeals}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Просроченные задачи</Text>
              <Text style={styles.value}>{data.overdueTasks}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
