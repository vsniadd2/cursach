import { MaterialIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

const TAB_ICONS = {
  Dashboard: 'dashboard' as const,
  Clients: 'group' as const,
  Deals: 'payment' as const,
  Tasks: 'assignment' as const,
  More: 'menu' as const,
};

type TabName = keyof typeof TAB_ICONS;

const LABELS: Record<TabName, string> = {
  Dashboard: 'Главная',
  Clients: 'Клиенты',
  Deals: 'Сделки',
  Tasks: 'Задачи',
  More: 'Ещё',
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingTop: 12,
      paddingHorizontal: 8,
      backgroundColor: `${colors.surfaceContainerLowest}F0`,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: `${colors.outlineVariant}55`,
    },
    tab: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 16,
      minWidth: 72,
    },
    tabActive: {
      backgroundColor: `${colors.primary}18`,
    },
    tabLabel: {
      marginTop: 4,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.slate400,
    },
    tabLabelActive: {
      color: colors.blue700,
    },
  });
}

export function MainTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const name = route.name as TabName;
        const iconName = TAB_ICONS[name] ?? 'circle';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            key={route.key}
            onPress={onPress}
            style={[styles.tab, isFocused && styles.tabActive]}
          >
            <MaterialIcons
              color={isFocused ? colors.blue700 : colors.slate400}
              name={iconName}
              size={24}
            />
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {LABELS[name] ?? route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
