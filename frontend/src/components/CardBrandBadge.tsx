import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { CardBrand } from '../utils/paymentCard';

type Props = {
  brand: CardBrand;
  size?: 'sm' | 'md';
};

export function CardBrandBadge({ brand, size = 'md' }: Props) {
  const compact = size === 'sm';
  if (brand === 'visa') {
    return (
      <View style={[styles.visaWrap, compact && styles.visaWrapSm]}>
        <Text style={[styles.visaText, compact && styles.visaTextSm]}>VISA</Text>
      </View>
    );
  }
  if (brand === 'mastercard') {
    return (
      <View style={[styles.mcWrap, compact && styles.mcWrapSm]}>
        <View style={[styles.mcCircle, compact && styles.mcCircleSm, { backgroundColor: '#eb001b' }]} />
        <View
          style={[
            styles.mcCircle,
            compact && styles.mcCircleSm,
            styles.mcCircleRight,
            compact && styles.mcCircleRightSm,
            { backgroundColor: '#f79e1b' },
          ]}
        />
      </View>
    );
  }
  return (
    <View style={styles.genericWrap}>
      <MaterialIcons color="#888" name="credit-card" size={compact ? 22 : 28} />
    </View>
  );
}

const styles = StyleSheet.create({
  visaWrap: {
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  visaWrapSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  visaText: {
    color: '#1a1f71',
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  visaTextSm: {
    fontSize: 14,
  },
  mcWrap: {
    width: 44,
    height: 28,
    position: 'relative',
  },
  mcWrapSm: {
    width: 36,
    height: 22,
  },
  mcCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.95,
  },
  mcCircleSm: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  mcCircleRight: {
    left: 16,
  },
  mcCircleRightSm: {
    left: 14,
  },
  genericWrap: {
    opacity: 0.85,
  },
});
