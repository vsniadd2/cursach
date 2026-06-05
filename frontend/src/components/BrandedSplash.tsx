import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { APP_NAME } from '../constants/brand';

import { BrandTitleStatic } from './BrandTitle';

import { lightColors } from '../theme/palettes';

const MIN_VISIBLE_MS = 1700;

type Props = {
  fontsLoaded: boolean;
  onAnimationComplete: () => void;
};

/**
 * Полноэкранная заставка при старте: градиент, «бесконечность», пульс кольца,
 * выход по готовности шрифтов и минимальному времени показа.
 */
export function BrandedSplash({ fontsLoaded, onAnimationComplete }: Props) {
  const mountAt = useRef(Date.now());
  const shellOpacity = useRef(new Animated.Value(1)).current;
  const shellScale = useRef(new Animated.Value(1)).current;
  const titleEnter = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;
  const dot0 = useRef(new Animated.Value(0.3)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dots = [dot0, dot1, dot2];
  /** На web нет нативного драйвера анимаций — явно false, без предупреждений в консоли. */
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    Animated.spring(titleEnter, {
      toValue: 1,
      friction: 8,
      tension: 70,
      useNativeDriver,
      overshootClamping: true,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
        Animated.timing(ringPulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
      ]),
    );
    pulseLoop.start();

    const spinLoop = Animated.loop(
      Animated.timing(ringRotate, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver,
      }),
    );
    spinLoop.start();

    const dotLoops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(d, {
            toValue: 1,
            duration: 400,
            useNativeDriver,
          }),
          Animated.timing(d, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver,
          }),
        ]),
      ),
    );
    dotLoops.forEach((l) => l.start());

    return () => {
      pulseLoop.stop();
      spinLoop.stop();
      dotLoops.forEach((l) => l.stop());
    };
    // Анимации заставки — один раз при монтировании (стабильные ref на Animated.Value).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    const elapsed = Date.now() - mountAt.current;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(shellOpacity, {
          toValue: 0,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
        Animated.timing(shellScale, {
          toValue: 1.06,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
      ]).start(({ finished }) => {
        if (finished) onAnimationComplete();
      });
    }, delay);
    return () => clearTimeout(t);
  }, [fontsLoaded, onAnimationComplete, shellOpacity, shellScale, useNativeDriver]);

  const ringScale = ringPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const ringOpacity = ringPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });
  const spin = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const titleScale = titleEnter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  return (
    <Animated.View style={[styles.shell, { opacity: shellOpacity, transform: [{ scale: shellScale }] }]}>
      <LinearGradient
        colors={['#000814', '#001233', lightColors.primary, '#0058bc']}
        end={{ x: 0.85, y: 1 }}
        locations={[0, 0.35, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <Animated.View
          style={[
            styles.ringOuter,
            {
              opacity: ringOpacity,
              transform: [{ rotate: spin }, { scale: ringScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.titleWrap,
            {
              opacity: titleEnter,
              transform: [
                { scale: titleScale },
                { translateY: titleEnter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              ],
            },
          ]}
        >
          <BrandTitleStatic name={APP_NAME} size="splash" />
        </Animated.View>

        <View style={styles.dotsRow}>
          {dots.map((d, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: d, transform: [{ scale: d }] }]} />
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  glowTop: {
    position: 'absolute',
    top: '-15%',
    left: '10%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: `${lightColors.primary}44`,
    transform: [{ scaleX: 1.4 }],
    pointerEvents: 'none',
  },
  glowBottom: {
    position: 'absolute',
    bottom: '-20%',
    right: '-5%',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#0070eb33',
    pointerEvents: 'none',
  },
  ringOuter: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  titleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 56,
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
});
