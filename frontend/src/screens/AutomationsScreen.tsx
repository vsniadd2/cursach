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
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { resolveBillingErrorMessage } from '../utils/billingErrors';

type RulesResponse = {
  items: Array<{
    id: number;
    name: string;
    trigger: string;
    action: string;
    configJson: string | null;
    isEnabled: boolean;
    createdAtUtc: string;
  }>;
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
      padding: 12,
      marginBottom: 8,
    },
    rowTitle: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
    rowSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreAutomations'>;

export function AutomationsScreen({ navigation }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const auth = useAuth();
  const { t } = useI18n();

  const [data, setData] = useState<RulesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAutomations = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getJson<RulesResponse>(auth, '/automations')
      .then((d) => {
        if (!alive) return;
        setData(d);
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

  useAutoRefresh(['integrations'], loadAutomations);

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>{t('more.automations')}</Text>
        <Text style={styles.sub}>{t('more.automationsDesc')}</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {(data?.items ?? []).map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.rowTitle}>
              {r.name} {!r.isEnabled ? '(выкл.)' : ''}
            </Text>
            <Text style={styles.rowSub}>
              {r.trigger} → {r.action}
            </Text>
            {r.configJson ? (
              <Text style={[styles.rowSub, { marginTop: 6 }]} numberOfLines={4}>
                {r.configJson}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
