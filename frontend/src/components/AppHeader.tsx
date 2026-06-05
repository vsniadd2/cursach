import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandTitle } from './BrandTitle';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { useI18n } from '../i18n/useI18n';
import { useOpenNotifications } from '../navigation/useOpenNotifications';
import { useNotifications } from '../notifications/NotificationsContext';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

type AppHeaderProps = {
  onNotificationsPress?: () => void;
  /** Стрелка «назад» слева (подэкраны, формы). */
  onBackPress?: () => void;
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: `${colors.surfaceContainerLow}D9`,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: `${colors.outlineVariant}66`,
      paddingHorizontal: 24,
      paddingBottom: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 4,
    },
    backWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
    },
    brand: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 6,
      paddingRight: 12,
      borderRadius: 16,
      justifyContent: 'center',
    },
    titleWrap: {
      marginTop: -1,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellWrap: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.error,
      borderWidth: 2,
      borderColor: colors.surfaceContainerLow,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '900',
      color: colors.onError,
    },
    pressed: {
      opacity: 0.8,
    },
  });
}

export function AppHeader({ onNotificationsPress, onBackPress }: AppHeaderProps) {
  const insets = useAppSafeAreaInsets();
  const colors = useAppColors();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const openNotifications = useOpenNotifications();
  const { unreadCount } = useNotifications();
  const onBellPress = onNotificationsPress ?? openNotifications;
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  const appName = t('header.appName');
  const notificationsA11y =
    unreadCount > 0
      ? `${t('header.notifications')}, ${unreadCount} ${t('header.unread')}`
      : t('header.notifications');

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {onBackPress ? (
          <Pressable
            accessibilityLabel={t('header.back')}
            accessibilityRole="button"
            hitSlop={12}
            onPress={onBackPress}
            style={({ pressed }) => [styles.backWrap, pressed && styles.pressed]}
          >
            <MaterialIcons color={colors.slate600} name="arrow-back" size={22} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={appName}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() =>
            Alert.alert(appName, t('header.brandAlertMessage'), [{ text: t('header.ok') }])
          }
          style={({ pressed }) => [styles.brand, pressed && styles.pressed]}
        >
          <BrandTitle style={styles.titleWrap} numberOfLines={1} />
        </Pressable>
        <Pressable
          accessibilityLabel={notificationsA11y}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBellPress}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.bellWrap}>
            <MaterialIcons
              color={colors.slate600}
              name={unreadCount > 0 ? 'notifications' : 'notifications-none'}
              size={24}
            />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}
