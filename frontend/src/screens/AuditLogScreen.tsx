import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { downloadBlob, getJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import type { MoreStackParamList } from '../navigation/types';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useI18n } from '../i18n/useI18n';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { saveBlobAsFile } from '../utils/downloadFile';
import { formatAuditDetail } from '../utils/formatAuditDetail';
import { auditActionLabel, entityTypeLabel, formatDateTime } from '../utils/locale';

type AuditResponse = {
  items: Array<{
    id: number;
    action: string;
    entityType: string;
    entityId: string;
    userId: number | null;
    userName: string | null;
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
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16, lineHeight: 20 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 12,
      marginBottom: 8,
    },
    rowTitle: { fontSize: 13, fontWeight: '800', color: colors.onSurface },
    rowSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4, lineHeight: 18 },
    rowDetail: { fontSize: 12, color: colors.onSurface, marginTop: 6, lineHeight: 18 },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
    empty: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 20,
    },
    emptyText: { fontSize: 14, color: colors.onSurfaceVariant, lineHeight: 20, textAlign: 'center' },
    receiptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      marginTop: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: `${colors.primary}18`,
    },
    receiptBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    receiptErr: { fontSize: 12, color: colors.error, marginTop: 6 },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreAuditLog'>;

export function AuditLogScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { language } = useAppPreferences();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const auth = useAuth();

  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptLoadingId, setReceiptLoadingId] = useState<number | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const downloadReceipt = async (auditId: number) => {
    setReceiptError(null);
    setReceiptLoadingId(auditId);
    try {
      const { blob, fileName } = await downloadBlob(
        auth,
        `/audit/${auditId}/receipt`,
        `expogo-receipt-${auditId}.pdf`,
      );
      saveBlobAsFile(blob, fileName);
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : t('auditScreen.receiptError'));
    } finally {
      setReceiptLoadingId(null);
    }
  };

  const loadAudit = useCallback(() => {
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
        setError(e instanceof Error ? e.message : t('auditScreen.loadError'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auth, t]);

  useAutoRefresh(['audit'], loadAudit);

  const items = data?.items ?? [];

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>{t('auditScreen.title')}</Text>
        <Text style={styles.sub}>{t('auditScreen.sub')}</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {receiptError ? <Text style={styles.receiptErr}>{receiptError}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {!loading && items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('auditScreen.empty')}</Text>
          </View>
        ) : null}
        {items.map((a) => {
          const detail = formatAuditDetail(a.action, a.beforeJson, a.afterJson, language);
          const actor =
            a.userName?.trim() ||
            (a.userId != null
              ? `${t('auditScreen.user')} #${a.userId}`
              : t('auditScreen.system'));
          return (
            <View key={a.id} style={styles.card}>
              <Text style={styles.rowTitle}>
                {a.createdAtUtc ? formatDateTime(a.createdAtUtc, language) : ''} ·{' '}
                {auditActionLabel(a.action, language)}
              </Text>
              <Text style={styles.rowSub}>
                {entityTypeLabel(a.entityType, language)} #{a.entityId} · {actor}
              </Text>
              {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
              {a.action === 'billing.checkout' ? (
                <Pressable
                  style={styles.receiptBtn}
                  onPress={() => void downloadReceipt(a.id)}
                  disabled={receiptLoadingId === a.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('auditScreen.downloadReceipt')}
                >
                  {receiptLoadingId === a.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <MaterialIcons name="picture-as-pdf" size={18} color={colors.primary} />
                  )}
                  <Text style={styles.receiptBtnText}>{t('auditScreen.downloadReceipt')}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
