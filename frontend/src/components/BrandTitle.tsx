import { useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View, type TextProps, type TextStyle } from 'react-native';

import { useI18n } from '../i18n/useI18n';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

type BrandTitleSize = 'header' | 'splash';

type BrandTitleProps = TextProps & {
  size?: BrandTitleSize;
};

function titleStyles(colors: AppPalette | null, size: BrandTitleSize): TextStyle {
  const isSplash = size === 'splash';
  return {
    fontFamily: 'PlayfairDisplay_700Bold_Italic',
    fontStyle: 'italic',
    fontSize: isSplash ? 34 : 26,
    fontWeight: '700',
    letterSpacing: isSplash ? 0.8 : 0.7,
    color: isSplash ? '#FFFFFF' : (colors?.onSurface ?? '#0F172A'),
    transform: [{ skewX: '-4deg' }],
  };
}

function accentColor(colors: AppPalette | null, size: BrandTitleSize): string {
  return size === 'splash' ? '#B8D4FF' : (colors?.primary ?? '#0058BC');
}

function BrandTitleInner({
  name,
  size,
  style,
  colors,
  ...rest
}: BrandTitleProps & { name: string; colors: AppPalette | null }) {
  const base = titleStyles(colors, size);
  const accent = accentColor(colors, size);

  if (name === 'EXPOGO') {
    return (
      <Text style={[base, style]} {...rest}>
        <Text>EXPO</Text>
        <Text style={{ color: accent }}>GO</Text>
      </Text>
    );
  }

  return (
    <Text style={[base, style]} {...rest}>
      <Text>Экспо</Text>
      <Text style={{ color: accent }}>го</Text>
    </Text>
  );
}

/** Название CRM курсивным акцентным шрифтом. */
export function BrandTitle({ size = 'header', style, ...rest }: BrandTitleProps) {
  const colors = useAppColors();
  const { t } = useI18n();
  return <BrandTitleInner name={t('header.appName')} size={size} style={style} colors={colors} {...rest} />;
}

/** Без React-контекста — для заставки до монтирования провайдеров. */
export function BrandTitleStatic({ name, size = 'splash', style, ...rest }: BrandTitleProps & { name: string }) {
  return <BrandTitleInner name={name} size={size} style={style} colors={null} {...rest} />;
}

const SPLASH_TITLE: TextStyle = {
  fontFamily: 'PlayfairDisplay_700Bold_Italic',
  fontStyle: 'italic',
  fontSize: 32,
  fontWeight: '700',
  letterSpacing: 0.7,
  color: '#1A1B1F',
};

type SplashBrandTitleAnimatedProps = {
  drawProgress: Animated.Value;
  fontsReady: boolean;
};

/** Название на заставке — плавная прорисовка слева направо без декоративных пятен. */
export function SplashBrandTitleAnimated({ drawProgress, fontsReady }: SplashBrandTitleAnimatedProps) {
  const [expoWidth, setExpoWidth] = useState(0);

  const clipWidth = drawProgress.interpolate({
    inputRange: [0, 0.68],
    outputRange: [0, Math.max(expoWidth, 1)],
    extrapolate: 'clamp',
  });
  const goOpacity = drawProgress.interpolate({
    inputRange: [0.5, 0.78],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const goTranslateX = drawProgress.interpolate({
    inputRange: [0.5, 0.78],
    outputRange: [14, 0],
    extrapolate: 'clamp',
  });
  const underlineScale = drawProgress.interpolate({
    inputRange: [0.74, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const underlineOpacity = drawProgress.interpolate({
    inputRange: [0.74, 1],
    outputRange: [0, 0.28],
    extrapolate: 'clamp',
  });

  const textStyle: TextStyle = fontsReady
    ? SPLASH_TITLE
    : { ...SPLASH_TITLE, fontFamily: undefined, opacity: 0 };

  return (
    <View style={splashStyles.wrap}>
      <View style={splashStyles.row}>
        <View pointerEvents="none" style={splashStyles.measure}>
          <Text style={SPLASH_TITLE} onLayout={(e) => setExpoWidth(e.nativeEvent.layout.width)}>
            Экспо
          </Text>
        </View>
        <Animated.View style={[splashStyles.clip, { width: clipWidth }]}>
          <Text style={textStyle}>Экспо</Text>
        </Animated.View>
        <Animated.Text
          style={[
            textStyle,
            splashStyles.go,
            { opacity: goOpacity, transform: [{ translateX: goTranslateX }] },
          ]}
        >
          го
        </Animated.Text>
      </View>
      <Animated.View
        style={[
          splashStyles.underline,
          {
            opacity: underlineOpacity,
            transform: [{ scaleX: underlineScale }],
            ...(Platform.OS === 'web' ? { transformOrigin: 'left center' } : null),
          },
        ]}
      />
    </View>
  );
}

const splashStyles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    transform: [{ skewX: '-4deg' }],
  },
  measure: {
    position: 'absolute',
    opacity: 0,
  },
  clip: {
    overflow: 'hidden',
  },
  go: {
    color: '#0058BC',
  },
  underline: {
    marginTop: 11,
    height: 1.5,
    alignSelf: 'stretch',
    backgroundColor: '#0058BC',
    borderRadius: 1,
  },
});
