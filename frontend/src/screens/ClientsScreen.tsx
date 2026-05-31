import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { getJson } from '../api/requests';
import type { ClientsListResponse } from '../api/types';
import { AppHeader } from '../components/AppHeader';
import { ClientAvatarImage } from '../components/ClientAvatarImage';
import type { ClientsStackParamList } from '../navigation/types';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

type Props = {
  navigation: NativeStackNavigationProp<ClientsStackParamList, 'ClientsList'>;
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 12 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 12 },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.onSurface },
    error: { color: colors.error, fontWeight: '700', marginBottom: 10 },
    muted: { color: colors.onSurfaceVariant, marginBottom: 10 },
    list: { gap: 12, marginTop: 6 },
    card: {
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}14`,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    rowAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}44`,
    },
    name: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
    company: { marginTop: 4, fontSize: 13, color: colors.onSurfaceVariant },
    role: { marginTop: 10, fontSize: 12, fontWeight: '700', color: colors.primary },
    fab: { position: 'absolute', right: 24, bottom: 112, zIndex: 40 },
    fabInner: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 12,
    },
  });
}

export function ClientsScreen({ navigation }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bottomPad = 120 + insets.bottom;
  const auth = useAuth();

  const [q, setQ] = useState('');
  const [data, setData] = useState<ClientsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    let alive = true;
    setError(null);
    setLoading(true);
    const path = query ? `/clients?q=${encodeURIComponent(query)}&pageSize=50` : '/clients?pageSize=50';
    getJson<ClientsListResponse>(auth, path)
      .then((d) => {
        if (!alive) return;
        setData(d);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auth, query]);

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Клиенты</Text>

        <View style={styles.searchRow}>
          <MaterialIcons color={colors.slate400} name="search" size={20} />
          <TextInput
            placeholder="Поиск по имени или компании"
            placeholderTextColor={`${colors.onSurfaceVariant}99`}
            value={q}
            onChangeText={setQ}
            style={styles.searchInput}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <Text style={styles.muted}>Загрузка…</Text> : null}

        <View style={styles.list}>
          {(data?.items ?? []).map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              onPress={() => navigation.navigate('ClientDetail', { clientId: c.id })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
            >
              <View style={styles.cardTop}>
                <ClientAvatarImage clientId={c.id} size={44} style={styles.rowAvatar} uri={c.avatarSmallUrl} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.fullName}</Text>
                  <Text style={styles.company}>{c.company}</Text>
                  {c.roleTitle ? <Text style={styles.role}>{c.roleTitle}</Text> : null}
                </View>
                <MaterialIcons color={colors.slate400} name="chevron-right" size={22} />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Pressable
        accessibilityLabel="Добавить клиента"
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => navigation.navigate('ClientEdit')}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <View style={styles.fabInner}>
          <MaterialIcons color={colors.onPrimary} name="add" size={28} />
        </View>
      </Pressable>
    </View>
  );
}
