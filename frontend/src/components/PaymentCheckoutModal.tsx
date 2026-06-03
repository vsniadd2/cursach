import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';

import { AppModal } from './AppModal';
import { CardBrandBadge } from './CardBrandBadge';
import { PaymentCardPreview } from './PaymentCardPreview';
import { PaymentSuccessView } from './PaymentSuccessView';
import { useI18n } from '../i18n/useI18n';
import { useLayoutDimensions } from '../web/useLayoutDimensions';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import type { BillingPlanCode } from '../utils/billingPlans';
import {
  detectCardBrand,
  formatCardholderInput,
  formatCardNumberDisplay,
  formatExpiryInput,
  maskCardPreview,
  parseCardNumberInput,
  parseCvvInput,
  validatePaymentForm,
} from '../utils/paymentCard';
import { AppTextInput } from './AppTextInput';

const PAY_GREEN = '#16a34a';

type Phase = 'form' | 'success';

type Props = {
  visible: boolean;
  planCode: BillingPlanCode | null;
  error: string | null;
  onClose: () => void;
  onPay: (payload: {
    cardHolder: string;
    cardNumber: string;
    expiry: string;
    cvv: string;
  }) => Promise<void>;
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    backdropDismiss: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: colors.surface,
      width: '100%',
      overflow: 'hidden',
      zIndex: 1,
    },
    sheetScroll: {
      flexGrow: 0,
      flexShrink: 1,
      ...(Platform.OS === 'web'
        ? ({
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          } as const)
        : {}),
    },
    sheetScrollContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 28,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: `${colors.outlineVariant}66`,
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    title: { fontSize: 20, fontWeight: '900', color: colors.onSurface, flex: 1 },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    planPill: {
      alignSelf: 'flex-start',
      backgroundColor: `${colors.primary}18`,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginBottom: 14,
    },
    planPillText: { fontSize: 12, fontWeight: '800', color: colors.primary },
    secureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 16,
    },
    secureText: { fontSize: 12, color: colors.onSurfaceVariant },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    inputWrap: {
      borderWidth: 1.5,
      borderColor: `${colors.outlineVariant}44`,
      borderRadius: 12,
      backgroundColor: colors.surfaceContainerLowest,
      marginBottom: 4,
    },
    inputWrapError: {
      borderColor: colors.error,
    },
    inputWrapFocused: {
      borderColor: colors.primary,
    },
    input: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.onSurface,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    inputFlex: { flex: 1 },
    brandSlot: {
      paddingRight: 14,
      minWidth: 52,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    fieldError: {
      fontSize: 11,
      color: colors.error,
      marginBottom: 10,
      marginTop: 2,
    },
    row2: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    formError: {
      fontSize: 13,
      color: colors.error,
      marginBottom: 10,
      backgroundColor: `${colors.error}12`,
      padding: 10,
      borderRadius: 10,
    },
    actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
    cancelBtn: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}55`,
      backgroundColor: colors.surfaceContainerLowest,
    },
    cancelBtnText: { fontSize: 15, fontWeight: '700', color: colors.onSurfaceVariant },
    payBtn: {
      flex: 1.4,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: PAY_GREEN,
    },
    payBtnDisabled: {
      backgroundColor: `${colors.outlineVariant}55`,
    },
    payBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  });
}

export function PaymentCheckoutModal({
  visible,
  planCode,
  error,
  onClose,
  onPay,
}: Props) {
  const colors = useAppColors();
  const { t } = useI18n();
  const { height: layoutHeight } = useLayoutDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sheetMaxHeight = useMemo(() => Math.round(layoutHeight * 0.9), [layoutHeight]);

  const [phase, setPhase] = useState<Phase>('form');
  const [paying, setPaying] = useState(false);
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [focused, setFocused] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const numberRef = useRef<TextInput>(null);
  const expiryRef = useRef<TextInput>(null);
  const cvvRef = useRef<TextInput>(null);

  const cardDigits = useMemo(() => parseCardNumberInput(cardNumber), [cardNumber]);
  const brand = useMemo(() => detectCardBrand(cardDigits), [cardDigits]);
  const isFlipped = focused === 'cvv';

  const validationMessages = useMemo(
    () => ({
      holder: t('billingScreen.payment.invalidHolder'),
      number: t('billingScreen.payment.invalidNumber'),
      expiry: t('billingScreen.payment.invalidExpiry'),
      cvv: t('billingScreen.payment.invalidCvv'),
    }),
    [t],
  );

  const fieldErrors = useMemo(
    () =>
      validatePaymentForm({ cardHolder, cardNumber, expiry, cvv }, validationMessages),
    [cardHolder, cardNumber, cvv, expiry, validationMessages],
  );

  const showError = (key: keyof typeof fieldErrors) =>
    (submitAttempted || touched[key]) && fieldErrors[key];

  const canPay =
    Object.keys(
      validatePaymentForm({ cardHolder, cardNumber, expiry, cvv }, validationMessages),
    ).length === 0;

  const resetForm = useCallback(() => {
    setCardHolder('');
    setCardNumber('');
    setExpiry('');
    setCvv('');
    setTouched({});
    setFocused(null);
    setSubmitAttempted(false);
    setPhase('form');
    setPaying(false);
  }, []);

  useEffect(() => {
    if (!visible) resetForm();
  }, [visible, resetForm]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, [visible]);

  const handleClose = useCallback(() => {
    if (paying) return;
    resetForm();
    onClose();
  }, [onClose, paying, resetForm]);

  const handleSuccessDone = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handlePay = useCallback(async () => {
    setSubmitAttempted(true);
    const errors = validatePaymentForm(
      { cardHolder, cardNumber, expiry, cvv },
      validationMessages,
    );
    if (Object.keys(errors).length > 0) return;
    setPaying(true);
    try {
      await onPay({
        cardHolder: cardHolder.trim(),
        cardNumber: cardDigits,
        expiry: expiry.trim(),
        cvv: parseCvvInput(cvv),
      });
      setPhase('success');
    } catch {
      // error shown via error prop from parent
    } finally {
      setPaying(false);
    }
  }, [cardDigits, cardHolder, cvv, expiry, onPay, validationMessages]);

  const previewHolder = cardHolder.trim() || t('billingScreen.payment.holderPlaceholder');
  const previewExpiry = expiry || 'MM/YY';

  const sheetBody =
    phase === 'success' ? (
      <PaymentSuccessView onDone={handleSuccessDone} />
    ) : (
      <>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('billingScreen.payment.title')}</Text>
          <Pressable accessibilityRole="button" onPress={handleClose} style={styles.closeBtn}>
            <MaterialIcons color={colors.onSurfaceVariant} name="close" size={22} />
          </Pressable>
        </View>
        {planCode ? (
          <View style={styles.planPill}>
            <Text style={styles.planPillText}>{planCode.toUpperCase()}</Text>
          </View>
        ) : null}

        <PaymentCardPreview
          brand={brand}
          cardNumberMasked={maskCardPreview(cardDigits)}
          cvv={cvv}
          cvvLabel={t('billingScreen.payment.cvv')}
          expiry={previewExpiry}
          holder={previewHolder}
          isFlipped={isFlipped}
        />

        <View style={styles.secureRow}>
          <MaterialIcons color={colors.onSurfaceVariant} name="lock" size={14} />
          <Text style={styles.secureText}>{t('billingScreen.payment.secureHint')}</Text>
        </View>

        {error ? <Text style={styles.formError}>{error}</Text> : null}

        <Text style={styles.fieldLabel}>{t('billingScreen.payment.cardHolder')}</Text>
        <View
          style={[
            styles.inputWrap,
            focused === 'holder' && styles.inputWrapFocused,
            showError('cardHolder') && styles.inputWrapError,
          ]}
        >
          <AppTextInput
            value={cardHolder}
            onChangeText={(v) => setCardHolder(formatCardholderInput(v))}
            onFocus={() => setFocused('holder')}
            onBlur={() => {
              setFocused(null);
              setTouched((p) => ({ ...p, cardHolder: true }));
            }}
            style={styles.input}
            placeholder={t('billingScreen.payment.holderPlaceholder')}
            placeholderTextColor={`${colors.onSurfaceVariant}88`}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKey="next"
            onSubmitEditing={() => numberRef.current?.focus()}
          />
        </View>
        {showError('cardHolder') ? (
          <Text style={styles.fieldError}>{fieldErrors.cardHolder}</Text>
        ) : null}

        <Text style={styles.fieldLabel}>{t('billingScreen.payment.cardNumber')}</Text>
        <View
          style={[
            styles.inputWrap,
            focused === 'number' && styles.inputWrapFocused,
            showError('cardNumber') && styles.inputWrapError,
          ]}
        >
          <View style={styles.inputRow}>
            <AppTextInput
              ref={numberRef}
              value={formatCardNumberDisplay(cardDigits)}
              onChangeText={(v) => setCardNumber(parseCardNumberInput(v))}
              onFocus={() => setFocused('number')}
              onBlur={() => {
                setFocused(null);
                setTouched((p) => ({ ...p, cardNumber: true }));
              }}
              style={[styles.input, styles.inputFlex]}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={`${colors.onSurfaceVariant}88`}
              keyboardType="number-pad"
              maxLength={19}
              returnKey="next"
              onSubmitEditing={() => expiryRef.current?.focus()}
            />
            <View style={styles.brandSlot}>
              <CardBrandBadge brand={brand} />
            </View>
          </View>
        </View>
        {showError('cardNumber') ? (
          <Text style={styles.fieldError}>{fieldErrors.cardNumber}</Text>
        ) : null}

        <View style={styles.row2}>
          <View style={styles.half}>
            <Text style={styles.fieldLabel}>{t('billingScreen.payment.expiry')}</Text>
            <View
              style={[
                styles.inputWrap,
                focused === 'expiry' && styles.inputWrapFocused,
                showError('expiry') && styles.inputWrapError,
              ]}
            >
              <AppTextInput
                ref={expiryRef}
                value={expiry}
                onChangeText={(v) => setExpiry(formatExpiryInput(v))}
                onFocus={() => setFocused('expiry')}
                onBlur={() => {
                  setFocused(null);
                  setTouched((p) => ({ ...p, expiry: true }));
                }}
                style={styles.input}
                placeholder="MM/YY"
                placeholderTextColor={`${colors.onSurfaceVariant}88`}
                keyboardType="number-pad"
                maxLength={5}
                returnKey="next"
                onSubmitEditing={() => cvvRef.current?.focus()}
              />
            </View>
            {showError('expiry') ? (
              <Text style={styles.fieldError}>{fieldErrors.expiry}</Text>
            ) : null}
          </View>
          <View style={styles.half}>
            <Text style={styles.fieldLabel}>{t('billingScreen.payment.cvv')}</Text>
            <View
              style={[
                styles.inputWrap,
                focused === 'cvv' && styles.inputWrapFocused,
                showError('cvv') && styles.inputWrapError,
              ]}
            >
              <AppTextInput
                ref={cvvRef}
                value={cvv}
                onChangeText={(v) => setCvv(parseCvvInput(v))}
                onFocus={() => setFocused('cvv')}
                onBlur={() => {
                  setFocused(null);
                  setTouched((p) => ({ ...p, cvv: true }));
                }}
                style={styles.input}
                placeholder="•••"
                placeholderTextColor={`${colors.onSurfaceVariant}88`}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={3}
                returnKey="done"
              />
            </View>
            {showError('cvv') ? (
              <Text style={styles.fieldError}>{fieldErrors.cvv}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={paying} onPress={handleClose} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>{t('billingScreen.payment.cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={paying || !canPay}
            onPress={() => void handlePay()}
            style={[styles.payBtn, (paying || !canPay) && styles.payBtnDisabled]}
          >
            {paying ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.payBtnText}>{t('billingScreen.payment.pay')}</Text>
            )}
          </Pressable>
        </View>
      </>
    );

  return (
    <AppModal animationType="slide" transparent visible={visible} onRequestClose={handleClose}>
      <View accessibilityViewIsModal importantForAccessibility="yes" style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('billingScreen.payment.cancel')}
          onPress={handleClose}
          style={styles.backdropDismiss}
        />
        <View style={[styles.sheet, { maxHeight: sheetMaxHeight }]}>
          <ScrollView
            bounces={false}
            contentContainerStyle={phase === 'success' ? undefined : styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={Platform.OS === 'web' && phase === 'form'}
            style={[
              styles.sheetScroll,
              Platform.OS === 'web'
                ? { height: sheetMaxHeight, maxHeight: sheetMaxHeight }
                : { maxHeight: sheetMaxHeight },
            ]}
          >
            {sheetBody}
          </ScrollView>
        </View>
      </View>
    </AppModal>
  );
}
