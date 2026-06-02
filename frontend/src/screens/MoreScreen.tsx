import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { APP_NAME } from '../constants/brand';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { confirmAsync } from '../utils/appAlerts';

const ROWS = [
  {
    icon: 'settings' as const,
    label: 'Настройки',
    description: 'Конфигурация приложения, предпочтения пользователя и параметры интерфейса.',
    adminOnly: false,
  },
  {
    icon: 'people' as const,
    label: 'Пользователи',
    description: 'Список пользователей организации, роли и блокировка доступа.',
    adminOnly: true,
  },
  {
    icon: 'credit-card' as const,
    label: 'Тариф и лимиты',
    description: 'План подписки, места и лимиты хранилища, учёт использования.',
    adminOnly: true,
  },
  {
    icon: 'device-hub' as const,
    label: 'Интеграции',
    description: 'Вебхуки и фоновые задачи доставки событий.',
    adminOnly: true,
  },
  {
    icon: 'flash-on' as const,
    label: 'Автоматизации',
    description: 'Правила по триггерам CRM и связанные действия.',
    adminOnly: true,
  },
  {
    icon: 'history' as const,
    label: 'Журнал аудита',
    description: 'История изменений данных и важных операций.',
    adminOnly: true,
  },
  {
    icon: 'description' as const,
    label: 'Отчёты',
    description: 'Сводные отчёты по воронке, закрытым сделкам и эффективности менеджеров.',
    adminOnly: true,
  },
  {
    icon: 'help-outline' as const,
    label: 'Помощь и поддержка',
    description: 'Канал обратной связи, подсказки по работе с системой и FAQ для пользователей.',
    adminOnly: false,
  },
];

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    scroll: {
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    headline: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.onSurface,
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    sub: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      marginBottom: 24,
    },
    list: {
      gap: 10,
    },
    logout: {
      marginTop: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.error,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: `${colors.primary}14`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.onSurface,
    },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

export function MoreScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { isAdmin } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bottomPad = 100 + insets.bottom;
  const { signOut } = useAuth();

  const visibleRows = useMemo(() => ROWS.filter((row) => !row.adminOnly || isAdmin), [isAdmin]);

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>Ещё</Text>
        <Text style={styles.sub}>Дополнительные разделы {APP_NAME}</Text>
        <View style={styles.list}>
          {visibleRows.map((row) => (
            <Pressable
              key={row.label}
              accessibilityRole="button"
              onPress={() => {
                if (row.label === 'Настройки') {
                  navigation.navigate('MoreSettings');
                  return;
                }
                if (row.label === 'Пользователи') {
                  navigation.navigate('MoreTeam');
                  return;
                }
                if (row.label === 'Отчёты') {
                  navigation.navigate('MoreReports');
                  return;
                }
                if (row.label === 'Тариф и лимиты') {
                  navigation.navigate('MoreBilling');
                  return;
                }
                if (row.label === 'Интеграции') {
                  navigation.navigate('MoreIntegrations');
                  return;
                }
                if (row.label === 'Автоматизации') {
                  navigation.navigate('MoreAutomations');
                  return;
                }
                if (row.label === 'Журнал аудита') {
                  navigation.navigate('MoreAuditLog');
                  return;
                }
                if (row.label === 'Помощь и поддержка') {
                  navigation.navigate('MoreSupport');
                  return;
                }
                navigation.navigate('MorePlaceholder', {
                  title: row.label,
                  description: row.description,
                });
              }}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.rowIcon}>
                <MaterialIcons color={colors.primary} name={row.icon} size={22} />
              </View>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <MaterialIcons color={colors.slate400} name="chevron-right" size={22} />
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            const ok = await confirmAsync({
              title: 'Выйти из аккаунта?',
              message: 'Токены будут удалены с устройства.',
              cancelLabel: 'Отмена',
              confirmLabel: 'Выйти',
            });
            if (ok) void signOut();
          }}
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.9 }]}
        >
          <MaterialIcons color={colors.error} name="logout" size={20} />
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
