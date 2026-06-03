import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import type { CardBrand } from '../utils/paymentCard';
import { CardBrandBadge } from './CardBrandBadge';

function cardGradient(brand: CardBrand): [string, string] {
  switch (brand) {
    case 'visa':
      return ['#1a1f71', '#2d4aa8'];
    case 'mastercard':
      return ['#1a1a1a', '#3d3d3d'];
    default:
      return ['#0f0f0f', '#2a2a2a'];
  }
}

function maskCvvPreview(cvv: string): string {
  const len = cvv.length;
  if (len === 0) return '•••';
  return cvv.padEnd(3, '•');
}

const faceHidden = Platform.select({
  web: {
    backfaceVisibility: 'hidden' as const,
    // RN Web maps these for correct 3D flip
    WebkitBackfaceVisibility: 'hidden' as const,
  },
  default: {
    backfaceVisibility: 'hidden' as const,
  },
});

type Props = {
  brand: CardBrand;
  cardNumberMasked: string;
  holder: string;
  expiry: string;
  cvv: string;
  cvvLabel: string;
  isFlipped: boolean;
};

export function PaymentCardPreview({
  brand,
  cardNumberMasked,
  holder,
  expiry,
  cvv,
  cvvLabel,
  isFlipped,
}: Props) {
  const flipAnim = useRef(new Animated.Value(isFlipped ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 1 : 0,
      duration: 420,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [flipAnim, isFlipped]);

  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const cvvPreview = useMemo(() => maskCvvPreview(cvv), [cvv]);

  const perspectiveStyle =
    Platform.OS === 'web'
      ? ({
          perspective: 1200,
          transformStyle: 'preserve-3d',
        } as const)
      : { transform: [{ perspective: 1200 }] };

  return (
    <View style={[styles.wrapper, perspectiveStyle]}>
      <Animated.View
        style={[
          styles.face,
          faceHidden,
          {
            transform: [{ rotateY: frontRotateY }],
          },
        ]}
      >
        <LinearGradient colors={cardGradient(brand)} style={styles.cardFace}>
          <View style={styles.frontTop}>
            <View style={styles.chip} />
            <CardBrandBadge brand={brand} />
          </View>
          <Text style={styles.previewNumber}>{cardNumberMasked}</Text>
          <View style={styles.previewBottom}>
            <Text style={styles.previewHolder} numberOfLines={1}>
              {holder}
            </Text>
            <Text style={styles.previewExpiry}>{expiry}</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View
        style={[
          styles.face,
          faceHidden,
          {
            transform: [{ rotateY: backRotateY }],
          },
        ]}
      >
        <View style={styles.backCard}>
          <View style={styles.magneticStripe} />
          <View style={styles.cvvPanel}>
            <Text style={styles.cvvPanelLabel}>{cvvLabel}</Text>
            <View style={styles.cvvBox}>
              <Text style={styles.cvvValue}>{cvvPreview}</Text>
            </View>
          </View>
          <View style={styles.backBrandRow}>
            <CardBrandBadge brand={brand} size="sm" />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 168,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  face: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  cardFace: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  frontTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  chip: {
    width: 40,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  previewNumber: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  previewBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
  },
  previewHolder: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    maxWidth: '65%',
  },
  previewExpiry: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
  },
  backCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
  },
  magneticStripe: {
    height: 44,
    marginTop: 24,
    backgroundColor: '#0a0a0a',
  },
  cvvPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  cvvPanelLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1,
  },
  cvvBox: {
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    alignItems: 'center',
  },
  cvvValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  backBrandRow: {
    position: 'absolute',
    bottom: 16,
    right: 20,
  },
});
