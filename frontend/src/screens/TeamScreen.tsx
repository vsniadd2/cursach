import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { getJson, patchJson } from '../api/requests';
import { resolveBillingErrorMessage } from '../utils/billingErrors';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { APP_NAME } from '../constants/brand';
import { useI18n } from '../i18n/useI18n';
import type { MoreStackParamList } from '../navigation/types';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useDataSync } from '../data/DataSyncContext';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { teamRoleLabel } from '../utils/locale';

type TeamMember = {
  id: number;
  userId: number;
  username: string;
  fullName: string | null;
  email: string | null;
  role: string;
  isBlocked: boolean;
  lockoutEndUtc: string | null;
  createdAtUtc: string;
};

type TeamResponse = { items: TeamMember[] };

type TeamTab = 'admins' | 'users';

const MANAGEABLE_ROLES = ['Admin', 'Member'] as const;

function isAdminRole(role: string): boolean {
  return role === 'Admin' || role === 'Owner';
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 6 },
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
    denied: { fontSize: 15, color: colors.onSurfaceVariant, lineHeight: 22 },
    tabs: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 18,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}44`,
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerLowest,
    },
    tabActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}12`,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.onSurfaceVariant,
    },
    tabTextActive: {
      color: colors.primary,
    },
    tabCount: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    tabCountActive: {
      color: colors.primary,
    },
    empty: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      paddingVertical: 32,
    },
    card: {
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      padding: 14,
      marginBottom: 10,
      gap: 6,
    },
    cardBlocked: {
      opacity: 0.72,
      borderColor: `${colors.error}44`,
    },
    name: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
    meta: { fontSize: 12, color: colors.onSurfaceVariant },
    status: { fontSize: 12, fontWeight: '700', color: colors.error, marginTop: 2 },
    roles: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
    roleBtn: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}44`,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surfaceContainerLow,
    },
    roleBtnActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
    roleText: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant },
    roleTextActive: { color: colors.primary },
    blockBtn: {
      marginTop: 8,
      alignSelf: 'flex-start',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: `${colors.error}55`,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: `${colors.error}10`,
    },
    unblockBtn: {
      borderColor: `${colors.primary}55`,
      backgroundColor: `${colors.primary}10`,
    },
    blockText: { fontSize: 12, fontWeight: '800', color: colors.error },
    unblockText: { color: colors.primary },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreTeam'>;

export function TeamScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { isAdmin, language } = useAppPreferences();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const auth = useAuth();
  const { invalidate } = useDataSync();
  const [items, setItems] = useState<TeamMember[]>([]);
  const [tab, setTab] = useState<TeamTab>('admins');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const admins = useMemo(() => items.filter((m) => isAdminRole(m.role)), [items]);
  const users = useMemo(() => items.filter((m) => !isAdminRole(m.role)), [items]);
  const visibleItems = tab === 'admins' ? admins : users;

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<TeamResponse>(auth, '/team');
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('teamScreen.loadError'));
    } finally {
      setLoading(false);
    }
  }, [auth, isAdmin, t]);

  const loadOnFocus = useCallback(() => {
    void load();
  }, [load]);

  useAutoRefresh(['team'], loadOnFocus);

  const onSetRole = async (userId: number, role: string) => {
    try {
      await patchJson<null>(auth, '/team/role', { userId, role });
      invalidate('team', 'audit');
      await load();
    } catch (e) {
      setError(resolveBillingErrorMessage(e, t));
    }
  };

  const onToggleBlock = async (userId: number, blocked: boolean) => {
    try {
      await patchJson<null>(auth, '/team/block', { userId, blocked });
      invalidate('team', 'audit');
      await load();
    } catch (e) {
      setError(resolveBillingErrorMessage(e, t));
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.root}>
        <AppHeader onBackPress={() => navigation.goBack()} />
        <View style={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
          <Text style={styles.title}>{t('teamScreen.title')}</Text>
          <Text style={styles.denied}>{t('teamScreen.denied')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>{t('teamScreen.title')}</Text>
        <Text style={styles.sub}>
          {t('teamScreen.sub')} {APP_NAME}.
        </Text>

        <View style={styles.tabs}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'admins' }}
            onPress={() => setTab('admins')}
            style={[styles.tab, tab === 'admins' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'admins' && styles.tabTextActive]}>
              {t('teamScreen.tabAdmins')}
            </Text>
            <Text style={[styles.tabCount, tab === 'admins' && styles.tabCountActive]}>{admins.length}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'users' }}
            onPress={() => setTab('users')}
            style={[styles.tab, tab === 'users' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>
              {t('teamScreen.tabUsers')}
            </Text>
            <Text style={[styles.tabCount, tab === 'users' && styles.tabCountActive]}>{users.length}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.err}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}

        {!loading && visibleItems.length === 0 ? (
          <Text style={styles.empty}>
            {tab === 'admins' ? t('teamScreen.emptyAdmins') : t('teamScreen.emptyUsers')}
          </Text>
        ) : null}

        {visibleItems.map((m) => (
          <View key={m.id} style={[styles.card, m.isBlocked && styles.cardBlocked]}>
            <Text style={styles.name}>{m.fullName || m.username}</Text>
            <Text style={styles.meta}>
              @{m.username} {m.email ? `• ${m.email}` : ''}
            </Text>
            {m.isBlocked ? <Text style={styles.status}>{t('teamScreen.blocked')}</Text> : null}
            <View style={styles.roles}>
              {MANAGEABLE_ROLES.map((role) => (
                <Pressable
                  key={role}
                  onPress={() => void onSetRole(m.userId, role)}
                  style={[styles.roleBtn, m.role === role && styles.roleBtnActive]}
                >
                  <Text style={[styles.roleText, m.role === role && styles.roleTextActive]}>
                    {teamRoleLabel(role, language)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => void onToggleBlock(m.userId, !m.isBlocked)}
              style={[styles.blockBtn, m.isBlocked ? styles.unblockBtn : undefined]}
            >
              <Text style={[styles.blockText, m.isBlocked && styles.unblockText]}>
                {m.isBlocked ? t('teamScreen.unblock') : t('teamScreen.block')}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
