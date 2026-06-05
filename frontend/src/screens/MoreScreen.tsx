import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { APP_NAME } from '../constants/brand';
import { useI18n } from '../i18n/useI18n';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { confirmAsync } from '../utils/appAlerts';

type MoreRowId =
  | 'settings'
  | 'team'
  | 'billing'
  | 'integrations'
  | 'aiAdvisor'
  | 'audit'
  | 'reports'
  | 'support'
  | 'cloudStorage';

const ROWS: Array<{
  id: MoreRowId;
  icon: keyof typeof MaterialIcons.glyphMap;
  adminOnly: boolean;
}> = [
  { id: 'settings', icon: 'settings', adminOnly: false },
  { id: 'team', icon: 'people', adminOnly: true },
  { id: 'billing', icon: 'credit-card', adminOnly: true },
  { id: 'integrations', icon: 'device-hub', adminOnly: true },
  { id: 'aiAdvisor', icon: 'psychology', adminOnly: true },
  { id: 'audit', icon: 'history', adminOnly: true },
  { id: 'reports', icon: 'description', adminOnly: true },
  { id: 'cloudStorage', icon: 'cloud', adminOnly: false },
  { id: 'support', icon: 'help-outline', adminOnly: false },
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
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const bottomPad = 100 + insets.bottom;
  const { signOut } = useAuth();

  const visibleRows = useMemo(() => ROWS.filter((row) => !row.adminOnly || isAdmin), [isAdmin]);

  const rowLabel = (id: MoreRowId) => t(`more.${id}`);

  const onRowPress = (id: MoreRowId) => {
    switch (id) {
      case 'settings':
        navigation.navigate('MoreSettings');
        return;
      case 'team':
        navigation.navigate('MoreTeam');
        return;
      case 'reports':
        navigation.navigate('MoreReports');
        return;
      case 'billing':
        navigation.navigate('MoreBilling');
        return;
      case 'integrations':
        navigation.navigate('MoreIntegrations');
        return;
      case 'aiAdvisor':
        navigation.navigate('MoreAiAdvisor');
        return;
      case 'audit':
        navigation.navigate('MoreAuditLog');
        return;
      case 'support':
        navigation.navigate('MoreSupport');
        return;
      case 'cloudStorage':
        navigation.navigate('MoreCloudStorage');
        return;
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>{t('more.headline')}</Text>
        <Text style={styles.sub}>
          {t('more.sub')} {APP_NAME}
        </Text>
        <View style={styles.list}>
          {visibleRows.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => onRowPress(row.id)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.rowIcon}>
                <MaterialIcons color={colors.primary} name={row.icon} size={22} />
              </View>
              <Text style={styles.rowLabel}>{rowLabel(row.id)}</Text>
              <MaterialIcons color={colors.slate400} name="chevron-right" size={22} />
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            const ok = await confirmAsync({
              title: t('more.logoutTitle'),
              message: t('more.logoutMessage'),
              cancelLabel: t('common.cancel'),
              confirmLabel: t('common.signOut'),
            });
            if (ok) void signOut();
          }}
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.9 }]}
        >
          <MaterialIcons color={colors.error} name="logout" size={20} />
          <Text style={styles.logoutText}>{t('more.logout')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
