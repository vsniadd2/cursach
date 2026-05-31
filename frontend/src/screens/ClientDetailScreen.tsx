import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';

import { ClientAvatarImage } from '../components/ClientAvatarImage';
import { useAuth } from '../auth/AuthContext';
import { getJson } from '../api/requests';
import type { ClientDetailResponse } from '../api/types';
import type { DealsStackParamList } from '../navigation/types';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

function timeAgoRu(dtIso: string) {
  const dt = new Date(dtIso);
  const diffMs = Date.now() - dt.getTime();
  const m = Math.round(diffMs / 60000);
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  return `${d} дн назад`;
}

type Props = {
  navigation: NativeStackNavigationProp<DealsStackParamList, 'ClientDetail'>;
  route: RouteProp<DealsStackParamList, 'ClientDetail'>;
};

export function ClientDetailScreen({ navigation, route }: Props) {
  const colors = useAppColors();
  const { formatMoney } = useAppPreferences();
  const styles = useMemo(() => createClientDetailStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bottomPad = 100 + insets.bottom;
  const auth = useAuth();

  const [data, setData] = useState<ClientDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    getJson<ClientDetailResponse>(auth, `/clients/${route.params.clientId}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      });
    return () => {
      alive = false;
    };
  }, [auth, route.params.clientId]);

  const client = data?.client;
  const deal = data?.activeDeal;
  const events = useMemo(() => data?.events ?? [], [data]);
  const clientIdForAvatar = client?.id ?? route.params.clientId;

  const onCallPress = () => {
    const raw = client?.phone?.trim();
    if (!raw) {
      Alert.alert('Телефон не указан', 'Добавьте номер в редактировании карточки клиента.');
      return;
    }
    const dial = raw.replace(/[\s()-]/g, '');
    void Linking.openURL(`tel:${dial}`);
  };

  const onMailPress = () => {
    const raw = client?.workEmail?.trim();
    if (!raw) {
      Alert.alert('Почта не указана', 'Добавьте рабочую почту в редактировании карточки клиента.');
      return;
    }
    void Linking.openURL(`mailto:${raw}`);
  };

  const onHeaderMenuPress = () => {
    const id = client?.id ?? route.params.clientId;
    const subtitle = client?.fullName ?? `Клиент #${id}`;
    const tabNav = navigation.getParent() as
      | { navigate: (name: string, params?: Record<string, unknown>) => void }
      | undefined;
    if (!tabNav?.navigate) {
      Alert.alert('Навигация', 'Не удалось перейти в другой раздел.');
      return;
    }
    Alert.alert('Действия', subtitle, [
      {
        text: 'Редактировать',
        onPress: () => {
          tabNav.navigate('Clients', { screen: 'ClientEdit', params: { clientId: id } });
        },
      },
      {
        text: 'Новая сделка',
        onPress: () => {
          tabNav.navigate('Deals', { screen: 'DealEdit', params: { clientId: id } });
        },
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => navigation.goBack()}
          style={styles.headerLeft}
        >
          <MaterialIcons color={colors.slate500} name="arrow-back" size={24} />
          <Text style={styles.headerTitle}>Карточка клиента</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityLabel="Действия с клиентом"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onHeaderMenuPress}
            style={({ pressed }) => [styles.headerMenuBtn, pressed && { opacity: 0.65 }]}
          >
            <MaterialIcons color={colors.slate500} name="more-horiz" size={24} />
          </Pressable>
          <ClientAvatarImage
            clientId={clientIdForAvatar}
            size={32}
            style={styles.headerAvatar}
            uri={client?.avatarSmallUrl}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <ClientAvatarImage
              clientId={clientIdForAvatar}
              size={96}
              style={styles.avatarLarge}
              uri={client?.avatarLargeUrl ?? client?.avatarSmallUrl}
            />
            <View style={styles.verified}>
              <MaterialIcons color={colors.onPrimary} name="check" size={10} />
            </View>
          </View>
          <Text style={styles.name}>{client?.fullName ?? '—'}</Text>
          <Text style={styles.role}>
            {client?.roleTitle ? `${client.roleTitle}, ` : ''}
            {client?.company ?? '—'}
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.btnPrimaryWrap} onPress={onCallPress}>
              <LinearGradient
                colors={[colors.primary, colors.primaryContainer]}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={styles.btnPrimary}
              >
                <MaterialIcons color={colors.onPrimary} name="call" size={20} />
                <Text style={styles.btnPrimaryText}>Позвонить</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.btnSecondary} onPress={onMailPress}>
              <MaterialIcons color={colors.primary} name="mail-outline" size={20} />
              <Text style={styles.btnSecondaryText}>Почта</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Сумма сделки</Text>
            <Text style={[styles.metricValue, { color: colors.primary }]}>
              {formatMoney(Math.round(deal?.amount ?? 0))}
            </Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Вероятность</Text>
            <Text style={[styles.metricValue, { color: colors.tertiary }]}>
              {deal ? `${deal.probabilityPct}%` : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Данные по активной сделке</Text>
            <Pressable>
              <Text style={styles.editLink}>Изменить</Text>
            </Pressable>
          </View>
          <View style={styles.metaCard}>
            <View style={[styles.metaRow, styles.metaRowAlt]}>
              <View style={styles.metaLeft}>
                <MaterialIcons color={colors.onSurfaceVariant} name="analytics" size={22} />
                <Text style={styles.metaText}>Этап воронки</Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{deal?.stage ?? '—'}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaLeft}>
                <MaterialIcons color={colors.onSurfaceVariant} name="today" size={22} />
                <Text style={styles.metaText}>Ожидаемое закрытие</Text>
              </View>
              <Text style={styles.metaRight}>
                {deal?.expectedCloseDateUtc ? new Date(deal.expectedCloseDateUtc).toLocaleDateString() : '—'}
              </Text>
            </View>
            <View style={[styles.metaRow, styles.metaRowAlt]}>
              <View style={styles.metaLeft}>
                <MaterialIcons color={colors.onSurfaceVariant} name="person" size={22} />
                <Text style={styles.metaText}>Лицо, принимающее решение</Text>
              </View>
              <Text style={styles.metaRight}>{deal?.decisionMaker ?? '—'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleBig}>Недавние контакты</Text>
          <View style={styles.timeline}>
            <View style={styles.timelineLine} />
            {events.map((e, idx) => (
              <View key={e.id} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: idx === 0 ? colors.primary : colors.outlineVariant },
                  ]}
                />
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHead}>
                    <Text style={styles.timelineTitle}>{e.title}</Text>
                    <Text style={styles.timelineTime}>{timeAgoRu(e.occurredAtUtc)}</Text>
                  </View>
                  {e.body ? (
                    idx === 0 ? (
                      <View style={styles.timelineCard}>
                        <Text style={styles.timelineBody}>{e.body}</Text>
                      </View>
                    ) : (
                      <Text style={styles.timelinePlain}>{e.body}</Text>
                    )
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function createClientDetailStyles(colors: AppPalette) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: `${colors.surfaceContainerLow}E6`,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${colors.outlineVariant}99`,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerMenuBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.error,
    marginBottom: 16,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarRing: {
    position: 'relative',
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: colors.surfaceContainerLowest,
  },
  verified: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.tertiaryContainer,
    borderWidth: 2,
    borderColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: '900',
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  role: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
    maxWidth: 360,
  },
  btnPrimaryWrap: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
  },
  metricBox: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 24,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: `${colors.onSurfaceVariant}99`,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  section: {
    marginBottom: 28,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.onSurface,
  },
  sectionTitleBig: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.onSurface,
    marginBottom: 16,
  },
  editLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  metaCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  metaRowAlt: {
    backgroundColor: `${colors.surfaceContainerLowest}80`,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  metaRight: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  pill: {
    backgroundColor: `${colors.primary}1A`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  timeline: {
    position: 'relative',
    paddingLeft: 8,
  },
  timelineLine: {
    position: 'absolute',
    left: 19,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: `${colors.outlineVariant}33`,
    borderRadius: 1,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 28,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
    zIndex: 2,
    borderWidth: 4,
    borderColor: colors.surface,
  },
  timelineContent: {
    flex: 1,
    gap: 8,
  },
  timelineHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.onSurface,
    flex: 1,
  },
  timelineTime: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  timelineCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  timelineBody: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  timelinePlain: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
});
}
