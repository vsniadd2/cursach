import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { useI18n } from '../i18n/useI18n';
import { useNotifications } from '../notifications/NotificationsContext';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { rnwShadow } from '../utils/rnwShadow';

const TOAST_WIDTH = 280;
const VISIBLE_MS = 5000;
const SLIDE_IN_MS = 320;
const FLY_OUT_MS = 480;

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    host: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'box-none',
      zIndex: 9999,
      elevation: 9999,
    },
    toast: {
      position: 'absolute',
      width: TOAST_WIDTH,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: `${colors.primary}44`,
      ...rnwShadow({ color: '#000', offset: { width: 0, height: 8 }, opacity: 0.18, radius: 16, elevation: 8 }),
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.primaryContainer}88`,
    },
    body: { flex: 1, minWidth: 0 },
    title: { fontSize: 13, fontWeight: '900', color: colors.onSurface },
    text: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4, lineHeight: 17 },
  });
}

export function NotificationToastHost() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const { t } = useI18n();
  const { pendingToast, dismissToast, refresh } = useNotifications();

  const translateX = useRef(new Animated.Value(TOAST_WIDTH + 40)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const toastTop = insets.top + 72;
  const toastRight = 16;
  const bellTop = insets.top + 12;
  const bellRight = 24;

  useEffect(() => {
    if (!pendingToast) return;

    translateX.setValue(TOAST_WIDTH + 40);
    translateY.setValue(0);
    scale.setValue(1);
    opacity.setValue(0);

    const flyDeltaY = bellTop - toastTop;
    const flyDeltaX = bellRight - toastRight + TOAST_WIDTH * 0.7;

    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: SLIDE_IN_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: SLIDE_IN_MS, useNativeDriver: true }),
      ]),
      Animated.delay(VISIBLE_MS),
      Animated.parallel([
        Animated.timing(translateX, { toValue: flyDeltaX, duration: FLY_OUT_MS, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: flyDeltaY, duration: FLY_OUT_MS, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.25, duration: FLY_OUT_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: FLY_OUT_MS, useNativeDriver: true }),
      ]),
    ]);

    anim.start(({ finished }) => {
      if (finished) {
        dismissToast();
        void refresh();
      }
    });

    return () => anim.stop();
  }, [pendingToast, dismissToast, refresh, translateX, translateY, scale, opacity, toastTop, bellTop, bellRight, toastRight]);

  if (!pendingToast) return null;

  const title =
    pendingToast.type === 'TaskAssignedByManager'
      ? t('notificationsScreen.taskFromManager')
      : pendingToast.title;

  return (
    <View style={styles.host} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          {
            top: toastTop,
            right: toastRight,
            opacity,
            transform: [{ translateX }, { translateY }, { scale }],
          },
          Platform.OS === 'web' ? ({ pointerEvents: 'none' } as const) : undefined,
        ]}
      >
        <View style={styles.iconWrap}>
          <MaterialIcons color={colors.primary} name="assignment-ind" size={20} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.text} numberOfLines={3}>
            {pendingToast.body}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
