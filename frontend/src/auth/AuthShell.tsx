import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { BrandTitle } from '../components/BrandTitle';
import { APP_NAME } from '../constants/brand';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { rnwShadow } from '../utils/rnwShadow';
import { useLayoutDimensions } from '../web/useLayoutDimensions';
import { useWebIphonePreview } from '../web/WebIphonePreviewContext';

type Props = {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
};

function createAuthFormStyles(colors: AppPalette) {
  return StyleSheet.create({
    label: {
      marginTop: 10,
      marginBottom: 8,
      fontSize: 11,
      fontWeight: '800',
      color: colors.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 1.6,
    },
    input: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.onSurface,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}33`,
    },
    error: {
      marginTop: 12,
      fontSize: 13,
      fontWeight: '700',
      color: colors.error,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 18,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: `${colors.outlineVariant}55`,
    },
    dividerText: {
      fontSize: 10,
      fontWeight: '900',
      color: colors.outline,
      textTransform: 'uppercase',
      letterSpacing: 2.2,
    },
    socialRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 14,
    },
    socialBtn: {
      flex: 1,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkRow: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    linkText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
    },
    linkStrong: {
      fontSize: 12,
      fontWeight: '900',
      color: colors.primary,
    },
  });
}

export function useAuthFormStyles() {
  const colors = useAppColors();
  return useMemo(() => createAuthFormStyles(colors), [colors]);
}

function createShellStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 24,
      paddingBottom: 16,
      justifyContent: 'flex-end',
      backgroundColor: `${colors.surfaceContainerLow}D9`,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: `${colors.outlineVariant}66`,
    },
    brandTitle: {
      marginTop: -1,
    },
    bgWrap: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.06,
      pointerEvents: 'none',
    },
    scroll: {
      flex: 1,
      width: '100%',
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    blob1: {
      position: 'absolute',
      top: -120,
      right: -140,
      width: 520,
      height: 520,
      borderRadius: 260,
    },
    blob2: {
      position: 'absolute',
      bottom: -140,
      left: -160,
      width: 420,
      height: 420,
      borderRadius: 210,
    },
    card: {
      width: '100%',
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      ...rnwShadow({ opacity: 0.08, radius: 24, offset: { width: 0, height: 12 }, elevation: 10 }),
    },
    cardWide: {
      flexDirection: 'row',
    },
    leftPane: {
      flex: 1,
      backgroundColor: colors.surfaceContainerLow,
      justifyContent: 'space-between',
    },
    heroTitle: {
      fontWeight: '900',
      color: colors.onSurface,
      letterSpacing: -0.6,
    },
    heroSub: {
      marginTop: 14,
      maxWidth: 360,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    rightPane: {
      width: '100%',
    },
    rightPaneWide: {
      flex: 1,
    },
    head: {},
    title: {
      fontWeight: '900',
      color: colors.onSurface,
      letterSpacing: -0.2,
    },
    subtitle: {
      marginTop: 6,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    primaryBtn: {
      marginTop: 18,
      height: 52,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      ...rnwShadow({ color: colors.primary, opacity: 0.2, radius: 16, offset: { width: 0, height: 10 }, elevation: 8 }),
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.onPrimary,
    },
    footer: {
      marginTop: 18,
    },
  });
}

export function AuthShell({ title, subtitle, footer, children }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createShellStyles(colors), [colors]);
  const { width, height } = useLayoutDimensions();
  const preview = useWebIphonePreview();
  const insets = useAppSafeAreaInsets();
  const showLeft = Platform.OS === 'web' && !preview.active && width >= 900;
  const isCompact = width < 380 || height < 700;
  const isNarrow = width < 420;

  const cardMaxWidth = useMemo(() => {
    if (showLeft) return 1100;
    if (width >= 820) return 760;
    return width;
  }, [showLeft, width]);

  const rightPanePadding = isCompact ? 18 : isNarrow ? 22 : 30;
  const leftPanePadding = isCompact ? 22 : 36;
  const heroTitleFontSize = isCompact ? 30 : 38;
  const heroTitleLineHeight = isCompact ? 36 : 44;
  const heroSubFontSize = isCompact ? 13 : 14;
  const heroSubLineHeight = isCompact ? 20 : 22;
  const formTitleFontSize = isCompact ? 26 : 30;
  const formSubtitleFontSize = isCompact ? 13 : 14;
  const headMarginBottom = isCompact ? 12 : 16;
  const topBarHeight = insets.top + 8 + 16 + 34;

  const heroTitle = useMemo(() => {
    return (
      <View>
        <Text style={[styles.heroTitle, { fontSize: heroTitleFontSize, lineHeight: heroTitleLineHeight }]}>
          Масштабируй{'\n'}продажи с
        </Text>
        <BrandTitle style={{ marginTop: 4 }} />
      </View>
    );
  }, [heroTitleFontSize, heroTitleLineHeight, styles.heroTitle]);

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <BrandTitle style={styles.brandTitle} numberOfLines={1} />
      </View>

      <View style={styles.bgWrap}>
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.blob1}
        />
        <LinearGradient
          colors={[colors.secondaryContainer, colors.surfaceTint]}
          end={{ x: 1, y: 0 }}
          start={{ x: 0, y: 1 }}
          style={styles.blob2}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topBarHeight + 24, paddingBottom: Math.max(insets.bottom, 18) + 18 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={[styles.card, { maxWidth: cardMaxWidth }, showLeft && styles.cardWide]}>
          {showLeft ? (
            <View style={[styles.leftPane, { padding: leftPanePadding }]}>
              <View>
                {heroTitle}
                <Text style={[styles.heroSub, { fontSize: heroSubFontSize, lineHeight: heroSubLineHeight }]}>
                  {APP_NAME} — современная CRM для продаж: клиенты, сделки и задачи в одном месте, быстрый поиск и аналитика, безопасная авторизация и надёжное хранение данных. Готова к демо и масштабированию.
                </Text>
              </View>
            </View>
          ) : null}

          <View style={[showLeft ? styles.rightPaneWide : styles.rightPane, { padding: rightPanePadding }]}>
            <View style={[styles.head, { marginBottom: headMarginBottom }]}>
              <Text style={[styles.title, { fontSize: formTitleFontSize }]}>{title}</Text>
              <Text style={[styles.subtitle, { fontSize: formSubtitleFontSize }]}>{subtitle}</Text>
            </View>

            {children}

            <View style={styles.footer}>{footer}</View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export function AuthPrimaryButton({
  label,
  loading,
  onPress,
}: {
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  const colors = useAppColors();
  const styles = useMemo(() => createShellStyles(colors), [colors]);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.96 }]}>
      <LinearGradient
        colors={[colors.primary, colors.primaryContainer]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.primaryBtn}
      >
        <Text style={styles.primaryBtnText}>{loading ? '...' : label}</Text>
      </LinearGradient>
    </Pressable>
  );
}
