import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getJson, patchJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { APP_NAME } from '../constants/brand';
import type { MoreStackParamList } from '../navigation/types';
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

const MANAGEABLE_ROLES = ['Admin', 'Member'] as const;

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 6 },
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
    denied: { fontSize: 15, color: colors.onSurfaceVariant, lineHeight: 22 },
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
  const { isAdmin } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [items, setItems] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<TeamResponse>(auth, '/team');
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const onSetRole = async (userId: number, role: string) => {
    try {
      await patchJson<null>(auth, '/team/role', { userId, role });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка изменения роли');
    }
  };

  const onToggleBlock = async (userId: number, blocked: boolean) => {
    try {
      await patchJson<null>(auth, '/team/block', { userId, blocked });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка блокировки');
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.root}>
        <AppHeader onBackPress={() => navigation.goBack()} />
        <View style={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
          <Text style={styles.title}>Пользователи</Text>
          <Text style={styles.denied}>Раздел доступен только администратору.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>Пользователи</Text>
        <Text style={styles.sub}>Управление ролями и доступом в организации {APP_NAME}.</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {items.map((m) => (
          <View key={m.id} style={[styles.card, m.isBlocked && styles.cardBlocked]}>
            <Text style={styles.name}>{m.fullName || m.username}</Text>
            <Text style={styles.meta}>
              @{m.username} {m.email ? `• ${m.email}` : ''}
            </Text>
            {m.isBlocked ? <Text style={styles.status}>Заблокирован</Text> : null}
            <View style={styles.roles}>
              {MANAGEABLE_ROLES.map((role) => (
                <Pressable
                  key={role}
                  onPress={() => void onSetRole(m.userId, role)}
                  style={[styles.roleBtn, m.role === role && styles.roleBtnActive]}
                >
                  <Text style={[styles.roleText, m.role === role && styles.roleTextActive]}>{teamRoleLabel(role)}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => void onToggleBlock(m.userId, !m.isBlocked)}
              style={[styles.blockBtn, !m.isBlocked ? undefined : styles.unblockBtn]}
            >
              <Text style={[styles.blockText, m.isBlocked && styles.unblockText]}>
                {m.isBlocked ? 'Разблокировать' : 'Заблокировать'}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
