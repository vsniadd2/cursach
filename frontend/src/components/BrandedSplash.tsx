import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { SplashBrandTitleAnimated } from './BrandTitle';

const MIN_VISIBLE_MS = 5200;
const DRAW_MS = 3600;

type Props = {
  fontsLoaded: boolean;
  onAnimationComplete: () => void;
};

/**
 * Светлая заставка: название «Экспого» плавно прорисовывается слева направо.
 */
export function BrandedSplash({ fontsLoaded, onAnimationComplete }: Props) {
  const mountAt = useRef(Date.now());
  const shellOpacity = useRef(new Animated.Value(1)).current;
  const shellScale = useRef(new Animated.Value(1)).current;
  const drawProgress = useRef(new Animated.Value(0)).current;
  const ambientOpacity = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    Animated.timing(ambientOpacity, {
      toValue: 1,
      duration: 1600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  }, [ambientOpacity, useNativeDriver]);

  useEffect(() => {
    if (!fontsLoaded) return;

    drawProgress.setValue(0);
    Animated.timing(drawProgress, {
      toValue: 1,
      duration: DRAW_MS,
      easing: Easing.bezier(0.33, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [fontsLoaded, drawProgress]);

  useEffect(() => {
    if (!fontsLoaded) return;

    const elapsed = Date.now() - mountAt.current;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(shellOpacity, {
          toValue: 0,
          duration: 680,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
        Animated.timing(shellScale, {
          toValue: 1.025,
          duration: 680,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
      ]).start(({ finished }) => {
        if (finished) onAnimationComplete();
      });
    }, delay);

    return () => clearTimeout(t);
  }, [fontsLoaded, onAnimationComplete, shellOpacity, shellScale, useNativeDriver]);

  return (
    <Animated.View style={[styles.shell, { opacity: shellOpacity, transform: [{ scale: shellScale }] }]}>
      <LinearGradient
        colors={['#FFFFFF', '#FAFBFE', '#F3F6FB']}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        style={styles.gradient}
      >
        <Animated.View style={[styles.titleBlock, { opacity: ambientOpacity }]}>
          <SplashBrandTitleAnimated drawProgress={drawProgress} fontsReady={fontsLoaded} />
        </Animated.View>
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
    paddingHorizontal: 40,
  },
  titleBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    minWidth: 200,
  },
});
