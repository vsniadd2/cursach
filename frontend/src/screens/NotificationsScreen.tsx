import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteJson, getJson, patchJson } from '../api/requests';
import type { NotificationItem, NotificationsResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { useNotifications } from '../notifications/NotificationsContext';
import type { RootStackParamList } from '../navigation/types';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { notificationIcon, relativeTimeRu } from '../utils/locale';

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, flex: 1 },
    markAll: { fontSize: 13, fontWeight: '800', color: colors.primary },
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
    card: {
      flexDirection: 'row',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 12,
      marginBottom: 8,
    },
    cardUnread: {
      borderColor: `${colors.primary}44`,
      backgroundColor: `${colors.primaryContainer}18`,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    cardBody: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
    rowText: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 4, lineHeight: 18 },
    rowTime: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 6, fontWeight: '600' },
    empty: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: 8,
    },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
    emptySub: { fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center' },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
  });
}

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const { refresh: refreshBadge, markAllRead } = useNotifications();

  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const d = await getJson<NotificationsResponse>(auth, '/notifications?take=80');
    setData(d);
    await refreshBadge();
  }, [auth, refreshBadge]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
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
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setRefreshing(false);
    }
  };

  const onMarkAll = async () => {
    try {
      await markAllRead();
      setData((prev) =>
        prev
          ? {
              ...prev,
              unreadCount: 0,
              items: prev.items.map((n) => ({ ...n, isRead: true })),
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отметить прочитанными');
    }
  };

  const openNotification = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await patchJson(auth, `/notifications/${item.id}/read`, {});
        setData((prev) =>
          prev
            ? {
                ...prev,
                unreadCount: Math.max(0, prev.unreadCount - 1),
                items: prev.items.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
              }
            : prev,
        );
        await refreshBadge();
      } catch {
        // continue navigation even if mark-read fails
      }
    }

    if (item.entityType === 'TaskItem' && item.entityId) {
      navigation.navigate('TaskEdit', { taskId: Number(item.entityId) });
      return;
    }
    if (item.entityType === 'Deal' && item.entityId) {
      navigation.navigate('App', {
        screen: 'Deals',
        params: {
          screen: 'DealEdit',
          params: { dealId: Number(item.entityId) },
        },
      });
      return;
    }
    if (item.type === 'TeamRoleChanged' || item.type === 'TeamBlocked') {
      navigation.navigate('App', {
        screen: 'More',
        params: { screen: 'MoreTeam' },
      });
    }
  };

  const onDismiss = async (item: NotificationItem) => {
    try {
      await deleteJson(auth, `/notifications/${item.id}`);
      setData((prev) => {
        if (!prev) return prev;
        const wasUnread = !item.isRead;
        return {
          unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
          items: prev.items.filter((n) => n.id !== item.id),
        };
      });
      await refreshBadge();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить');
    }
  };

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Уведомления</Text>
          {unreadCount > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => void onMarkAll()}>
              <Text style={styles.markAll}>Прочитать все</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.sub}>
          Задачи, сделки и события команды — всё в одном месте.
          {unreadCount > 0 ? ` Непрочитанных: ${unreadCount}.` : ''}
        </Text>

        {error ? <Text style={styles.err}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}

        {!loading && items.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons color={colors.onSurfaceVariant} name="notifications-none" size={40} />
            <Text style={styles.emptyTitle}>Пока пусто</Text>
            <Text style={styles.emptySub}>
              Здесь появятся напоминания о задачах, сделках и изменениях в команде.
            </Text>
          </View>
        ) : null}

        {items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onLongPress={() => void onDismiss(item)}
            onPress={() => void openNotification(item)}
            style={[styles.card, !item.isRead && styles.cardUnread]}
          >
            <View style={styles.iconWrap}>
              <MaterialIcons color={colors.primary} name={notificationIcon(item.type)} size={22} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowText}>{item.body}</Text>
              <Text style={styles.rowTime}>{relativeTimeRu(item.createdAtUtc)}</Text>
            </View>
            {!item.isRead ? (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.primary,
                  marginTop: 4,
                }}
              />
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
