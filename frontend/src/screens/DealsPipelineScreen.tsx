import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';

import { AppHeader } from '../components/AppHeader';
import { ClientAvatarImage } from '../components/ClientAvatarImage';
import { useAuth } from '../auth/AuthContext';
import type { DealsStackParamList } from '../navigation/types';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { getJson, patchJson } from '../api/requests';
import type { DealsPipelineResponse, DealStage, PipelineDeal } from '../api/types';

function stageLabel(stage: DealStage) {
  switch (stage) {
    case 'Lead':
      return 'Лид';
    case 'Negotiation':
      return 'Переговоры';
    case 'Closed':
      return 'Закрыто';
  }
}

type Props = {
  navigation: NativeStackNavigationProp<DealsStackParamList, 'DealsPipeline'>;
};

export function DealsPipelineScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { formatMoney } = useAppPreferences();
  const styles = useMemo(() => createPipelineStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bottomPad = 120 + insets.bottom;
  const auth = useAuth();

  const [data, setData] = useState<DealsPipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    let alive = true;
    setError(null);
    getJson<DealsPipelineResponse>(auth, '/deals/pipeline')
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
  };

  useEffect(() => reload(), [auth]);

  const stages = useMemo(() => {
    return (data?.stages ?? {}) as Record<DealStage, PipelineDeal[]>;
  }, [data]);

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Стратегия портфеля</Text>
          <Text style={styles.heroTitle}>Воронка сделок</Text>
          <ScrollView
            contentContainerStyle={styles.chipsRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>Сумма</Text>
              <Text style={[styles.chipValue, { color: colors.primary }]}>
                {formatMoney(data?.totals.total ?? 0)}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>Взвешенно</Text>
              <Text style={[styles.chipValue, { color: colors.secondary }]}>
                {formatMoney(data?.totals.weighted ?? 0)}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>Средний чек</Text>
              <Text style={[styles.chipValue, { color: colors.onSurface }]}>
                {formatMoney(data?.totals.avg ?? 0)}
              </Text>
            </View>
          </ScrollView>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {(['Lead', 'Negotiation', 'Closed'] as const).map((stage) => {
          const list = stages[stage] ?? [];
          if (!data && list.length === 0) return null;

          const dotColor =
            stage === 'Lead'
              ? colors.primaryContainer
              : stage === 'Negotiation'
                ? colors.secondary
                : colors.tertiaryContainer;

          return (
            <View key={stage} style={styles.stage}>
              <View style={styles.stageHead}>
                <View style={styles.stageTitleRow}>
                  <View style={[styles.dot, { backgroundColor: dotColor }]} />
                  <Text style={styles.stageTitle}>
                    {stageLabel(stage)} <Text style={styles.stageCount}>({list.length})</Text>
                  </Text>
                </View>
              </View>

              {list.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => navigation.navigate('ClientDetail', { clientId: d.client.clientId })}
                  onLongPress={() => {
                    Alert.alert('Стадия сделки', d.title, [
                      { text: 'Отмена' },
                      {
                        text: 'Лид',
                        onPress: async () => {
                          await patchJson<null>(auth, `/deals/${d.id}/stage`, { stage: 'Lead' });
                          reload();
                        },
                      },
                      {
                        text: 'Переговоры',
                        onPress: async () => {
                          await patchJson<null>(auth, `/deals/${d.id}/stage`, { stage: 'Negotiation' });
                          reload();
                        },
                      },
                      {
                        text: 'Закрыто',
                        onPress: async () => {
                          await patchJson<null>(auth, `/deals/${d.id}/stage`, { stage: 'Closed' });
                          reload();
                        },
                      },
                    ]);
                  }}
                  style={({ pressed }) => [
                    stage === 'Negotiation' ? styles.negCard : styles.dealCard,
                    pressed && { opacity: 0.95 },
                  ]}
                >
                  {stage === 'Negotiation' ? <View style={styles.negAccent} /> : null}

                  <View style={styles.dealTop}>
                    <View>
                      <Text style={styles.dealName}>{d.title}</Text>
                      <Text style={styles.dealCompany}>{d.client.company}</Text>
                    </View>
                    <View style={stage === 'Negotiation' ? styles.tagOrange : styles.tagBlue}>
                      <Text style={stage === 'Negotiation' ? styles.tagOrangeText : styles.tagBlueText}>
                        {stageLabel(stage)}
                      </Text>
                    </View>
                  </View>

                  {stage === 'Negotiation' ? (
                    <View style={styles.negFooter}>
                      <View>
                        <Text style={styles.probLabel}>Вероятность</Text>
                        <View style={styles.probRow}>
                          <View style={styles.probTrack}>
                            <View style={[styles.probFill, { width: `${Math.max(0, Math.min(100, d.probabilityPct))}%` }]} />
                          </View>
                          <Text style={styles.probPct}>{d.probabilityPct}%</Text>
                        </View>
                      </View>
                      <Text style={styles.negMoney}>{formatMoney(d.amount)}</Text>
                    </View>
                  ) : (
                    <View style={styles.dealBottom}>
                      <View style={styles.avatars}>
                        <ClientAvatarImage
                          clientId={d.client.clientId}
                          size={28}
                          style={styles.avatarSm}
                          uri={d.client.avatarSmallUrl}
                        />
                      </View>
                      <Text style={styles.dealMoney}>{formatMoney(d.amount)}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('DealEdit')}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.fabInner}
        >
          <MaterialIcons color={colors.onPrimary} name="add" size={32} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function createPipelineStyles(colors: AppPalette) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  hero: {
    marginBottom: 28,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 2,
  },
  chip: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}22`,
    marginRight: 4,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  chipValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  stage: {
    marginBottom: 36,
  },
  stageHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.onSurface,
  },
  stageCount: {
    fontWeight: '400',
    color: `${colors.onSurfaceVariant}88`,
  },
  viewAll: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.error,
    marginBottom: 16,
  },
  dealCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}14`,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dealTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dealName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  dealCompany: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  tagBlue: {
    backgroundColor: colors.blue50,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagBlueText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dealBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSm: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  dealMoney: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.onSurface,
  },
  negCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}22`,
    overflow: 'hidden',
    position: 'relative',
  },
  negAccent: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: colors.primaryContainer,
  },
  highValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  highValueText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.error,
    textTransform: 'uppercase',
  },
  tagOrange: {
    backgroundColor: colors.orange50,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagOrangeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.orange700,
    textTransform: 'uppercase',
  },
  negFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: `${colors.outlineVariant}22`,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  probLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  probRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  probTrack: {
    width: 80,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceContainer,
    overflow: 'hidden',
  },
  probFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  probPct: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.onSurface,
  },
  negMoney: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.onSurface,
  },
  closedCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}22`,
  },
  closedTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  wonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wonText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.tertiary,
    textTransform: 'uppercase',
  },
  closedMoney: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 112,
    zIndex: 40,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  });
}
