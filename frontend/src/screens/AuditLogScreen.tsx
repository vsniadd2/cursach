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
import { auditActionLabel, entityTypeLabel, formatDateTimeRu } from '../utils/locale';

type AuditResponse = {
  items: Array<{
    id: number;
    action: string;
    entityType: string;
    entityId: string;
    userId: number | null;
    correlationId: string | null;
    createdAtUtc: string;
    beforeJson: string | null;
    afterJson: string | null;
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
    rowTitle: { fontSize: 13, fontWeight: '800', color: colors.onSurface },
    rowSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 4 },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreAuditLog'>;

export function AuditLogScreen({ navigation }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const auth = useAuth();

  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getJson<AuditResponse>(auth, '/audit?take=120')
      .then((d) => {
        if (!alive) return;
        setData(d);
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
        <Text style={styles.title}>Журнал аудита</Text>
        <Text style={styles.sub}>Кто, что и когда изменил в вашей организации.</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {(data?.items ?? []).map((a) => (
          <View key={a.id} style={styles.card}>
            <Text style={styles.rowTitle}>
              {a.createdAtUtc ? formatDateTimeRu(a.createdAtUtc) : ''} · {auditActionLabel(a.action)}
            </Text>
            <Text style={styles.rowSub}>
              {entityTypeLabel(a.entityType)} #{a.entityId}
              {a.userId != null ? ` · пользователь ${a.userId}` : ''}
            </Text>
            {a.beforeJson ?? a.afterJson ? (
              <Text style={[styles.rowSub, { marginTop: 6 }]} numberOfLines={6}>
                {(a.beforeJson ? `− ${a.beforeJson}\n` : '') + (a.afterJson ? `+ ${a.afterJson}` : '')}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
