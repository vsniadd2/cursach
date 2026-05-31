import { useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import { IPHONE_16_PRO_LOGICAL, WebIphonePreviewContext } from './WebIphonePreviewContext';

type Props = {
  children: React.ReactNode;
};

/** Метрики как у iPhone с Dynamic Island (в web нет нативных inset — задаём явно). */
const IPHONE_16_PRO_INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: IPHONE_16_PRO_LOGICAL.width, height: IPHONE_16_PRO_LOGICAL.height },
  insets: { top: 62, right: 0, bottom: 34, left: 0 },
} as const;

// Важно: это именно визуальная имитация для web (React Native Web),
// чтобы удобнее демонстрировать «как на телефоне». На iOS/Android не используется.
export function Iphone16ProFrame({ children }: Props) {
  const colors = useAppColors();
  const { theme } = useAppPreferences();
  const { width: w, height: h } = useWindowDimensions();

  const deviceW = IPHONE_16_PRO_LOGICAL.width;
  const deviceH = IPHONE_16_PRO_LOGICAL.height;

  const bezel = 18;
  const outerW = deviceW + bezel * 2;
  const outerH = deviceH + bezel * 2;

  const scale = useMemo(() => {
    // Небольшие поля вокруг, чтобы не прилипало к краям окна.
    const pad = 32;
    const sx = (w - pad) / outerW;
    const sy = (h - pad) / outerH;
    return Math.max(0.25, Math.min(1, sx, sy));
  }, [h, outerH, outerW, w]);

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const previewValue = useMemo(
    () => ({
      active: true as const,
      layoutWidth: deviceW,
      layoutHeight: deviceH,
    }),
    [deviceH, deviceW],
  );

  const stageBg = theme === 'dark' ? '#0B0F19' : colors.slate100;

  return (
    <View style={[styles.stage, { backgroundColor: stageBg }]}>
      <View style={[styles.scaler, { transform: [{ scale }] }]}>
        <View style={styles.shell}>
          <View style={styles.islandWrap}>
            <View style={styles.island} />
          </View>

          <View style={[styles.screen, { backgroundColor: colors.surface }]}>
            <SafeAreaProvider initialMetrics={IPHONE_16_PRO_INITIAL_METRICS}>
              <WebIphonePreviewContext.Provider value={previewValue}>{children}</WebIphonePreviewContext.Provider>
            </SafeAreaProvider>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scaler: {
    // чтобы масштабирование шло «от центра»
    alignItems: 'center',
    justifyContent: 'center',
  },
  shell: {
    position: 'relative',
    width: 402 + 18 * 2,
    height: 874 + 18 * 2,
    padding: 18,
    borderRadius: 60,
    backgroundColor: '#0A0A0A',
    // web shadow (RNW понимает часть shadow*, в браузере будет мягкий эффект)
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    // Android/web fallback
    elevation: 12,
  },
  screen: {
    flex: 1,
    borderRadius: 46,
    overflow: 'hidden',
  },
  islandWrap: {
    position: 'absolute',
    // островок по вертикали как на OLED iPhone (от верха внутренней области дисплея)
    top: 18 + 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    pointerEvents: 'none',
  },
  island: {
    width: 126,
    height: 37,
    borderRadius: 20,
    backgroundColor: '#050505',
    opacity: 0.92,
  },
});

