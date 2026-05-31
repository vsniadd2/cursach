import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getJson, patchJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

type TeamMember = {
  id: number;
  userId: number;
  username: string;
  fullName: string | null;
  email: string | null;
  role: string;
  createdAtUtc: string;
};

type TeamResponse = { items: TeamMember[] };

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 6 },
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
    card: {
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      padding: 14,
      marginBottom: 10,
      gap: 6,
    },
    name: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
    meta: { fontSize: 12, color: colors.onSurfaceVariant },
    roles: { flexDirection: 'row', gap: 8, marginTop: 6 },
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
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreTeam'>;

export function TeamScreen({ navigation }: Props) {
  const colors = useAppColors();
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
      setError(e instanceof Error ? e.message : 'Ошибка загрузки команды');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSetRole = async (userId: number, role: string) => {
    try {
      await patchJson<null>(auth, '/team/role', { userId, role });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка изменения роли');
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>Команда</Text>
        <Text style={styles.sub}>Управление ролями участников текущего tenant.</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {items.map((m) => (
          <View key={m.id} style={styles.card}>
            <Text style={styles.name}>{m.fullName || m.username}</Text>
            <Text style={styles.meta}>
              @{m.username} {m.email ? `• ${m.email}` : ''}
            </Text>
            <View style={styles.roles}>
              {(['Owner', 'Admin', 'Manager', 'Member', 'Viewer'] as const).map((role) => (
                <Pressable
                  key={role}
                  onPress={() => void onSetRole(m.userId, role)}
                  style={[styles.roleBtn, m.role === role && styles.roleBtnActive]}
                >
                  <Text style={[styles.roleText, m.role === role && styles.roleTextActive]}>{role}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
