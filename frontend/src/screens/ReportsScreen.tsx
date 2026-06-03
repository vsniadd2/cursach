import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { downloadBlob, getJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import type { MoreStackParamList } from '../navigation/types';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { useI18n } from '../i18n/useI18n';
import { resolveBillingErrorMessage } from '../utils/billingErrors';
import { saveBlobAsFile } from '../utils/downloadFile';

type ReportSummary = {
  tier?: string;
  totalDeals: number;
  closedDeals: number;
  conversionPct: number;
  monthRevenueUsd: number;
  quarterRevenueUsd?: number;
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
    downloadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 16,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    downloadBtnDisabled: { opacity: 0.7 },
    downloadBtnText: { fontSize: 14, fontWeight: '800', color: colors.onPrimary },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreReports'>;

export function ReportsScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const auth = useAuth();
  const { formatMoney } = useAppPreferences();
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const loadReports = useCallback(() => {
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

  useAutoRefresh(['reports', 'deals'], loadReports);

  const downloadPdf = async () => {
    setPdfError(null);
    setPdfLoading(true);
    try {
      const { blob, fileName } = await downloadBlob(
        auth,
        '/reports/export.pdf',
        'expogo-report.pdf',
      );
      saveBlobAsFile(blob, fileName);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : t('reportsScreen.downloadError'));
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>{t('nav.reports')}</Text>
        <Text style={styles.sub}>{t('more.reportsDesc')}</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {pdfError ? <Text style={styles.err}>{pdfError}</Text> : null}
        <Pressable
          style={[styles.downloadBtn, pdfLoading && styles.downloadBtnDisabled]}
          onPress={() => void downloadPdf()}
          disabled={pdfLoading || loading}
          accessibilityRole="button"
          accessibilityLabel={t('reportsScreen.downloadPdf')}
        >
          {pdfLoading ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <MaterialIcons name="picture-as-pdf" size={22} color={colors.onPrimary} />
          )}
          <Text style={styles.downloadBtnText}>
            {pdfLoading ? t('reportsScreen.downloading') : t('reportsScreen.downloadPdf')}
          </Text>
        </Pressable>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {data ? (
          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.label}>{t('dashboard.perMonth')}</Text>
              <Text style={styles.value}>{formatMoney(data.monthRevenueUsd)}</Text>
            </View>
            {data.quarterRevenueUsd != null ? (
              <View style={styles.card}>
                <Text style={styles.label}>{t('billingScreen.plans.team.f4')}</Text>
                <Text style={styles.value}>{formatMoney(data.quarterRevenueUsd)}</Text>
              </View>
            ) : null}
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
