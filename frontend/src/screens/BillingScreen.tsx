import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { getJson, patchJson, postJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { PaymentCheckoutModal } from '../components/PaymentCheckoutModal';
import { useDataSync } from '../data/DataSyncContext';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useI18n } from '../i18n/useI18n';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import {
  BILLING_PLAN_CODES,
  BILLING_PLAN_FEATURE_KEYS,
  planDisplayName,
  type BillingPlanCode,
} from '../utils/billingPlans';
import { formatUsageLimit, resolveBillingErrorMessage } from '../utils/billingErrors';
import { formatDate } from '../utils/locale';

const PREPARE_MS = 3000;
const PAY_MS = 2000;

type SubscriptionDto = {
  planCode: string;
  planName: string;
  status: string;
  currentPeriodStartUtc: string;
  currentPeriodEndUtc: string;
  limits: {
    contactsLimit: number;
    funnelsLimit: number;
    seatsLimit: number;
    storageGbLimit: number;
  };
  usage: {
    contacts: number;
    activeSeats: number;
    pipelines: number;
    storageGb: number;
  };
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 6 },
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 20, lineHeight: 20 },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
    currentCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.primary}55`,
      backgroundColor: `${colors.primary}12`,
      padding: 14,
      marginBottom: 12,
    },
    usageCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 14,
      marginBottom: 16,
    },
    usageTitle: { fontSize: 14, fontWeight: '800', color: colors.onSurface, marginBottom: 10 },
    usageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    usageLabel: { fontSize: 13, color: colors.onSurfaceVariant },
    usageValue: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
    currentLabel: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 4 },
    currentValue: { fontSize: 22, fontWeight: '900', color: colors.onSurface },
    currentMeta: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8, lineHeight: 20 },
    planCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 16,
      marginBottom: 12,
    },
    planCardActive: {
      borderColor: colors.primary,
      borderWidth: 2,
      backgroundColor: `${colors.primary}0d`,
    },
    planHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    planName: { fontSize: 20, fontWeight: '900', color: colors.onSurface, letterSpacing: 0.5 },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: `${colors.primary}22`,
    },
    badgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
    planPrice: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 12,
    },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
    bullet: { fontSize: 14, color: colors.primary, marginRight: 8, lineHeight: 20 },
    featureText: { flex: 1, fontSize: 14, color: colors.onSurface, lineHeight: 20 },
    selectBtn: {
      marginTop: 14,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    selectBtnDisabled: {
      backgroundColor: `${colors.outlineVariant}44`,
    },
    selectBtnText: { fontSize: 14, fontWeight: '800', color: colors.onPrimary },
    selectBtnTextDisabled: { color: colors.onSurfaceVariant },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreBilling'>;

export function BillingScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { language } = useAppPreferences();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const auth = useAuth();
  const { invalidate } = useDataSync();

  const [sub, setSub] = useState<SubscriptionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<BillingPlanCode | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const loadBilling = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getJson<SubscriptionDto>(auth, '/billing/subscription')
      .then((s) => {
        if (!alive) return;
        setSub(s);
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

  useAutoRefresh(['billing'], loadBilling);

  const currentPlanCode = (sub?.planCode ?? 'free').toLowerCase();

  const closePaymentModal = useCallback(() => {
    setPaymentOpen(false);
    setPaymentError(null);
    setPendingPlan(null);
  }, []);

  const selectFreePlan = useCallback(async () => {
    if (currentPlanCode === 'free' || switching) return;
    setSwitching('free');
    setError(null);
    try {
      await patchJson<null>(auth, '/billing/subscription', { planCode: 'free' });
      invalidate('billing', 'audit');
      loadBilling();
    } catch (e) {
      setError(resolveBillingErrorMessage(e, t));
    } finally {
      setSwitching(null);
    }
  }, [auth, currentPlanCode, invalidate, loadBilling, switching, t]);

  const beginPaidPlanSelection = useCallback(
    (code: BillingPlanCode) => {
      if (currentPlanCode === code || switching) return;
      setSwitching(code);
      setError(null);
      setTimeout(() => {
        setSwitching(null);
        setPendingPlan(code);
        setPaymentError(null);
        setPaymentOpen(true);
      }, PREPARE_MS);
    },
    [currentPlanCode, switching],
  );

  const submitPayment = useCallback(
    async (payload: {
      cardHolder: string;
      cardNumber: string;
      expiry: string;
      cvv: string;
    }) => {
      if (!pendingPlan) return;
      setPaymentError(null);
      await new Promise((r) => setTimeout(r, PAY_MS));
      try {
        await postJson(auth, '/billing/checkout', {
          planCode: pendingPlan,
          ...payload,
        });
        invalidate('billing', 'audit');
        loadBilling();
      } catch (e) {
        setPaymentError(resolveBillingErrorMessage(e, t));
        throw e;
      }
    },
    [auth, invalidate, loadBilling, pendingPlan, t],
  );

  const periodLabel = useMemo(() => {
    if (!sub) return '';
    if (currentPlanCode === 'free') return t('billingScreen.periodUnlimited');
    return `${formatDate(sub.currentPeriodStartUtc, language)} — ${formatDate(sub.currentPeriodEndUtc, language)}`;
  }, [sub, currentPlanCode, language, t]);

  const unlimited = t('billingScreen.unlimited');

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>{t('billingScreen.title')}</Text>
        <Text style={styles.sub}>{t('billingScreen.intro')}</Text>
        {error && !paymentOpen ? <Text style={styles.err}>{error}</Text> : null}
        {loading && !sub ? <ActivityIndicator color={colors.primary} /> : null}

        {sub ? (
          <>
            <View style={styles.currentCard}>
              <Text style={styles.currentLabel}>{t('billingScreen.currentPlan')}</Text>
              <Text style={styles.currentValue}>{planDisplayName(sub.planName || sub.planCode)}</Text>
              <Text style={styles.currentMeta}>
                {t('billingScreen.status')}: {t('billingScreen.statusActive')}
                {'\n'}
                {t('billingScreen.period')}: {periodLabel}
              </Text>
            </View>
            <View style={styles.usageCard}>
              <Text style={styles.usageTitle}>{t('billingScreen.usageTitle')}</Text>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>{t('billingScreen.usageContacts')}</Text>
                <Text style={styles.usageValue}>
                  {formatUsageLimit(sub.usage.contacts, sub.limits.contactsLimit, unlimited)}
                </Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>{t('billingScreen.usageSeats')}</Text>
                <Text style={styles.usageValue}>
                  {formatUsageLimit(sub.usage.activeSeats, sub.limits.seatsLimit, unlimited)}
                </Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>{t('billingScreen.usagePipelines')}</Text>
                <Text style={styles.usageValue}>
                  {formatUsageLimit(sub.usage.pipelines, sub.limits.funnelsLimit, unlimited)}
                </Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>{t('billingScreen.usageStorage')}</Text>
                <Text style={styles.usageValue}>
                  {sub.usage.storageGb} / {sub.limits.storageGbLimit} GB
                </Text>
              </View>
            </View>
          </>
        ) : null}

        {BILLING_PLAN_CODES.map((code) => {
          const isCurrent = currentPlanCode === code;
          const isBusy = switching === code;
          const features = BILLING_PLAN_FEATURE_KEYS[code];

          return (
            <View key={code} style={[styles.planCard, isCurrent && styles.planCardActive]}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{code.toUpperCase()}</Text>
                {isCurrent ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{t('billingScreen.currentPlan')}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.planPrice}>{t(`billingScreen.plans.${code}.price`)}</Text>
              {features.map((featureKey) => (
                <View key={featureKey} style={styles.featureRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.featureText}>
                    {t(`billingScreen.plans.${code}.${featureKey}`)}
                  </Text>
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                disabled={isCurrent || !!switching}
                onPress={() => (code === 'free' ? void selectFreePlan() : beginPaidPlanSelection(code))}
                style={[styles.selectBtn, (isCurrent || !!switching) && styles.selectBtnDisabled]}
              >
                {isBusy ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.selectBtnText,
                      (isCurrent || !!switching) && styles.selectBtnTextDisabled,
                    ]}
                  >
                    {isCurrent
                      ? t('billingScreen.currentPlan')
                      : isBusy
                        ? t('billingScreen.payment.preparing')
                        : t('billingScreen.selectPlan')}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <PaymentCheckoutModal
        visible={paymentOpen}
        planCode={pendingPlan}
        error={paymentError}
        onClose={closePaymentModal}
        onPay={submitPayment}
      />
    </View>
  );
}
