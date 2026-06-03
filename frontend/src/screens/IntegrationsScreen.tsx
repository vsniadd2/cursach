import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { getJson, putJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import type { MoreStackParamList } from '../navigation/types';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useI18n } from '../i18n/useI18n';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { resolveBillingErrorMessage } from '../utils/billingErrors';
import { integrationJobStatusLabel } from '../utils/locale';
import {
  PROVIDER_ICONS,
  PROVIDER_ORDER,
  type ProviderId,
  type ProviderSummary,
} from './integrations/types';

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
    list: { gap: 8, marginBottom: 20 },
    providerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLow,
    },
    providerIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.primary}18`,
    },
    providerTitle: { fontSize: 14, fontWeight: '800', color: colors.onSurface, flex: 1 },
    providerSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
    settingsBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.primary}14`,
    },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
    section: { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginTop: 16, marginBottom: 8 },
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
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreIntegrations'>;

export function IntegrationsScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { language } = useAppPreferences();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const auth = useAuth();

  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hooks, setHooks] = useState<WebhooksResponse | null>(null);
  const [jobs, setJobs] = useState<JobsResponse | null>(null);

  const providerLabel = (id: ProviderId) => {
    if (id === 'telegram') return t('integrationsScreen.telegram');
    if (id === 'email') return t('integrationsScreen.email');
    return t('integrationsScreen.googleCalendar');
  };

  const loadProviders = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getJson<{ items: ProviderSummary[] }>(auth, '/integrations/providers'),
      getJson<WebhooksResponse>(auth, '/integrations/webhooks'),
      getJson<JobsResponse>(auth, '/integrations/jobs'),
    ])
      .then(([p, h, j]) => {
        if (!alive) return;
        setProviders(p.items ?? []);
        setHooks(h);
        setJobs(j);
      })
      .catch((e) => {
        if (!alive) return;
        setError(resolveBillingErrorMessage(e, t));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auth, t]);

  useAutoRefresh(['integrations'], loadProviders);

  const toggleEnabled = async (id: ProviderId, value: boolean) => {
    setError(null);
    try {
      await putJson(auth, `/integrations/providers/${id}`, { isEnabled: value });
      setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, isEnabled: value } : p)));
    } catch (e) {
      setError(resolveBillingErrorMessage(e, t));
    }
  };

  const openSettings = (id: ProviderId) => {
    navigation.navigate('MoreIntegrationSettings', { provider: id });
  };

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>{t('integrationsScreen.title')}</Text>
        <Text style={styles.sub}>{t('integrationsScreen.sub')}</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginBottom: 16 }} /> : null}

        <View style={styles.list}>
          {PROVIDER_ORDER.map((id) => {
            const summary = providers.find((p) => p.id === id);
            const isEnabled = summary?.isEnabled ?? false;
            return (
              <View key={id} style={styles.providerRow}>
                <View style={styles.providerIcon}>
                  <MaterialIcons name={PROVIDER_ICONS[id]} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.providerTitle}>{providerLabel(id)}</Text>
                  <Text style={styles.providerSub} numberOfLines={1}>
                    {summary?.isConfigured
                      ? summary.summary ?? t('integrationsScreen.enabled')
                      : t('integrationsScreen.notConfigured')}
                  </Text>
                </View>
                <Switch value={isEnabled} onValueChange={(v) => void toggleEnabled(id, v)} />
                <Pressable
                  style={styles.settingsBtn}
                  onPress={() => openSettings(id)}
                  accessibilityLabel={t('integrationsScreen.openSettings')}
                  accessibilityRole="button"
                >
                  <MaterialIcons name="settings" size={20} color={colors.primary} />
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text style={styles.section}>{t('integrationsScreen.advancedWebhooks')}</Text>
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

        <Text style={styles.section}>{t('integrationsScreen.advancedJobs')}</Text>
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
