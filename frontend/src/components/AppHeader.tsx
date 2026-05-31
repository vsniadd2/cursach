import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { showNotificationsInfo } from '../utils/appAlerts';

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
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 4,
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
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.8,
    },
  });
}

export function AppHeader({ onNotificationsPress = showNotificationsInfo, onBackPress }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
          accessibilityLabel="CRM.go"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() =>
            Alert.alert('CRM.go', 'Главный экран и быстрые действия.', [{ text: 'ОК' }])
          }
          style={({ pressed }) => [styles.brand, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.mark}
          >
            <Text style={styles.markText}>C</Text>
          </LinearGradient>
          <View style={styles.left}>
            <Text style={styles.title}>CRM.go</Text>
            <Text style={styles.subtitle}>ваша CRM для бизнеса</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityLabel="Уведомления"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onNotificationsPress}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons color={colors.slate600} name="notifications-none" size={24} />
        </Pressable>
      </View>
    </View>
  );
}
