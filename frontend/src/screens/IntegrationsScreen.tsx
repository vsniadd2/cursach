import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { getJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import type { MoreStackParamList } from '../navigation/types';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useI18n } from '../i18n/useI18n';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { resolveBillingErrorMessage } from '../utils/billingErrors';
import { integrationJobStatusLabel } from '../utils/locale';

type WebhooksResponse = {
  items: Array<{ id: number; name: string; url: string; isActive: boolean; createdAtUtc: string }>;
};

type JobsResponse = {
  items: Array<{
    id: number;
    jobType: string;
    status: string;
    attempts: number;
    scheduledAtUtc: string;
    processedAtUtc: string | null;
    lastError: string | null;
  }>;
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 6 },
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
    section: { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginTop: 8, marginBottom: 8 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 12,
      marginBottom: 8,
    },
    rowTitle: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
    rowSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreIntegrations'>;

export function IntegrationsScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { language } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const auth = useAuth();
  const { t } = useI18n();

  const [hooks, setHooks] = useState<WebhooksResponse | null>(null);
  const [jobs, setJobs] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadIntegrations = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getJson<WebhooksResponse>(auth, '/integrations/webhooks'),
      getJson<JobsResponse>(auth, '/integrations/jobs'),
    ])
      .then(([h, j]) => {
        if (!alive) return;
        setHooks(h);
        setJobs(j);
      })
      .catch((e) => {
        if (!alive) return;
        setError(resolveBillingErrorMessage(e, t));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auth, t]);

  useAutoRefresh(['integrations'], loadIntegrations);

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>{t('more.integrations')}</Text>
        <Text style={styles.sub}>{t('more.integrationsDesc')}</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        <Text style={styles.section}>Вебхуки</Text>
        {(hooks?.items ?? []).map((h) => (
          <View key={h.id} style={styles.card}>
            <Text style={styles.rowTitle}>
              {h.name} {h.isActive ? '' : '(выкл.)'}
            </Text>
            <Text style={styles.rowSub} numberOfLines={2}>
              {h.url}
            </Text>
          </View>
        ))}
        <Text style={styles.section}>Фоновые задачи</Text>
        {(jobs?.items ?? []).map((j) => (
          <View key={j.id} style={styles.card}>
            <Text style={styles.rowTitle}>
              #{j.id} {j.jobType} — {integrationJobStatusLabel(j.status, language)}
            </Text>
            <Text style={styles.rowSub}>
              попыток: {j.attempts}
              {j.lastError ? ` · ${j.lastError}` : ''}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
