import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { APP_NAME } from '../constants/brand';
import { useBillingSubscription } from '../data/BillingSubscriptionContext';
import { useOpenNotifications } from '../navigation/useOpenNotifications';
import { useNotifications } from '../notifications/NotificationsContext';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { planDisplayName } from '../utils/billingPlans';
import { rnwShadow } from '../utils/rnwShadow';

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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 6,
      paddingRight: 12,
      borderRadius: 16,
    },
    left: {
      flex: 1,
      minWidth: 0,
    },
    mark: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      ...rnwShadow({ color: colors.primary, offset: { width: 0, height: 3 }, opacity: 0.25, radius: 6, elevation: 4 }),
    },
    markText: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.onPrimary,
      marginTop: -1,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: colors.onSurface,
    },
    subtitle: {
      marginTop: 1,
      fontSize: 12,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    planStatus: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '700',
      color: '#000000',
      letterSpacing: 0.3,
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const openNotifications = useOpenNotifications();
  const { unreadCount } = useNotifications();
  const { subscription, loading: billingLoading } = useBillingSubscription();
  const onBellPress = onNotificationsPress ?? openNotifications;
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  const planLabel = useMemo(() => {
    if (billingLoading || !subscription) return null;
    return planDisplayName(subscription.planName || subscription.planCode);
  }, [billingLoading, subscription]);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {onBackPress ? (
          <Pressable
            accessibilityLabel="Назад"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onBackPress}
            style={({ pressed }) => [styles.backWrap, pressed && styles.pressed]}
          >
            <MaterialIcons color={colors.slate600} name="arrow-back" size={22} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={APP_NAME}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() =>
            Alert.alert(APP_NAME, 'Главный экран и быстрые действия.', [{ text: 'ОК' }])
          }
          style={({ pressed }) => [styles.brand, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.mark}
          >
            <Text style={styles.markText}>Э</Text>
          </LinearGradient>
          <View style={styles.left}>
            <Text style={styles.title}>{APP_NAME}</Text>
            <Text style={styles.subtitle}>клиенты, сделки и задачи</Text>
            {planLabel ? <Text style={styles.planStatus}>{planLabel}</Text> : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityLabel={unreadCount > 0 ? `Уведомления, ${unreadCount} непрочитанных` : 'Уведомления'}
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
