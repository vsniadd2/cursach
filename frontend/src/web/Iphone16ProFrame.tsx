import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import {
  getIphone16ProOuterSize,
  getIphone16ProPhysicalScale,
  IPHONE_16_PRO,
  IPHONE_16_PRO_INITIAL_METRICS,
} from './iphone16ProSpec';
import { rnwShadow } from '../utils/rnwShadow';
import { WebIphonePreviewContext } from './WebIphonePreviewContext';

function useWebPageChrome() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const root = document.getElementById('root');
    const prevRoot = root
      ? {
          height: root.style.height,
          width: root.style.width,
          maxWidth: root.style.maxWidth,
          margin: root.style.margin,
          overflow: root.style.overflow,
        }
      : null;
    if (root) {
      root.style.height = '100%';
      root.style.width = '100%';
      root.style.maxWidth = 'none';
      root.style.margin = '0';
      root.style.overflow = 'hidden';
    }

    const html = document.documentElement;
    const body = document.body;
    const prevDoc = {
      htmlHeight: html.style.height,
      htmlOverflow: html.style.overflow,
      bodyHeight: body.style.height,
      bodyMargin: body.style.margin,
      bodyOverflow: body.style.overflow,
    };
    html.style.height = '100%';
    html.style.overflow = 'hidden';
    body.style.height = '100%';
    body.style.margin = '0';
    body.style.overflow = 'hidden';

    return () => {
      if (root && prevRoot) {
        root.style.height = prevRoot.height;
        root.style.width = prevRoot.width;
        root.style.maxWidth = prevRoot.maxWidth;
        root.style.margin = prevRoot.margin;
        root.style.overflow = prevRoot.overflow;
      }
      html.style.height = prevDoc.htmlHeight;
      html.style.overflow = prevDoc.htmlOverflow;
      body.style.height = prevDoc.bodyHeight;
      body.style.margin = prevDoc.bodyMargin;
      body.style.overflow = prevDoc.bodyOverflow;
    };
  }, []);
}

type Props = {
  children: React.ReactNode;
};

export function Iphone16ProFrame({ children }: Props) {
  useWebPageChrome();

  const colors = useAppColors();
  const { theme } = useAppPreferences();
  const browser = useWindowDimensions();

  const { width: deviceW, height: deviceH } = IPHONE_16_PRO.logical;
  const { width: outerW, height: outerH } = getIphone16ProOuterSize();
  const { bezel, shellRadius, screenRadius, island, homeIndicator } = IPHONE_16_PRO;

  const scale = useMemo(() => {
    const pad = 40;
    const fitX = (browser.width - pad) / outerW;
    const fitY = (browser.height - pad) / outerH;
    const fitScale = Math.min(fitX, fitY);
    const physicalScale = getIphone16ProPhysicalScale();
    // Не увеличиваем больше 1:1 pt — чёткая вёрстка; уменьшаем под окно или «реальный» размер.
    return Math.max(0.35, Math.min(1, fitScale, physicalScale));
  }, [browser.height, browser.width, outerH, outerW]);

  const previewValue = useMemo(
    () => ({
      active: true as const,
      layoutWidth: deviceW,
      layoutHeight: deviceH,
      scale,
    }),
    [deviceH, deviceW, scale],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const meta = document.querySelector('meta[name="viewport"]');
    const prevContent = meta?.getAttribute('content') ?? null;
    if (meta) {
      meta.setAttribute(
        'content',
        'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
      );
    }
    return () => {
      if (meta && prevContent !== null) {
        meta.setAttribute('content', prevContent);
      }
    };
  }, []);

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const stageBg = theme === 'dark' ? '#0B0F19' : colors.slate100;

  return (
    <View style={[styles.stage, { backgroundColor: stageBg }]}>
      <View
        style={[
          styles.scaledOuter,
          {
            width: outerW,
            height: outerH,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={[styles.shell, { width: outerW, height: outerH, padding: bezel, borderRadius: shellRadius }]}>
          <View
            style={[
              styles.islandWrap,
              styles.noPointer,
              {
                top: bezel + island.top,
              },
            ]}
          >
            <View
              style={[
                styles.island,
                {
                  width: island.width,
                  height: island.height,
                  borderRadius: island.height / 2,
                },
              ]}
            />
          </View>

          <View
            style={[
              styles.screen,
              {
                width: deviceW,
                height: deviceH,
                borderRadius: screenRadius,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <View
              style={[
                styles.homeIndicatorWrap,
                styles.noPointer,
                {
                  bottom: homeIndicator.bottom,
                },
              ]}
            >
              <View
                style={[
                  styles.homeIndicator,
                  {
                    width: homeIndicator.width,
                    height: homeIndicator.height,
                    borderRadius: homeIndicator.height / 2,
                  },
                ]}
              />
            </View>

            <SafeAreaProvider initialMetrics={IPHONE_16_PRO_INITIAL_METRICS}>
              <WebIphonePreviewContext.Provider value={previewValue}>
                <View
                  style={[
                    styles.appRoot,
                    { width: deviceW, height: deviceH, maxWidth: deviceW, maxHeight: deviceH },
                  ]}
                >
                  {children}
                </View>
              </WebIphonePreviewContext.Provider>
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
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scaledOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shell: {
    position: 'relative',
    backgroundColor: '#1C1C1E',
    ...rnwShadow({ opacity: 0.5, radius: 40, offset: { width: 0, height: 24 }, elevation: 16 }),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3A3A3C',
  },
  noPointer: {
    pointerEvents: 'none',
  },
  screen: {
    overflow: 'hidden',
    position: 'relative',
  },
  islandWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  island: {
    backgroundColor: '#000000',
  },
  homeIndicatorWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  homeIndicator: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  appRoot: {
    flex: 1,
    overflow: 'hidden',
  },
});
