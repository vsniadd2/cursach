import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '../i18n/useI18n';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

const PAY_GREEN = '#16a34a';

type Props = {
  onDone: () => void;
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
      paddingHorizontal: 24,
      minHeight: 280,
    },
    circle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: `${PAY_GREEN}22`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.onSurface,
      textAlign: 'center',
      marginBottom: 8,
    },
    sub: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    doneBtn: {
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 32,
      backgroundColor: PAY_GREEN,
      minWidth: 160,
      alignItems: 'center',
    },
    doneBtnText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#fff',
    },
  });
}

export function PaymentSuccessView({ onDone }: Props) {
  const colors = useAppColors();
  const { t } = useI18n();
  const styles = createStyles(colors);
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    scale.setValue(0);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver,
      }),
    ]).start();
  }, [opacity, scale, useNativeDriver]);

  useEffect(() => {
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.circle, { transform: [{ scale }], opacity }]}>
        <MaterialIcons color={PAY_GREEN} name="check-circle" size={56} />
      </Animated.View>
      <Text style={styles.title}>{t('billingScreen.payment.successTitle')}</Text>
      <Text style={styles.sub}>{t('billingScreen.payment.successSub')}</Text>
      <Pressable accessibilityRole="button" onPress={onDone} style={styles.doneBtn}>
        <Text style={styles.doneBtnText}>{t('billingScreen.payment.successDone')}</Text>
      </Pressable>
    </View>
  );
}
