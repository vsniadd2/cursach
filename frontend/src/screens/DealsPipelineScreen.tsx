import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppHeader } from '../components/AppHeader';
import { ClientAvatarImage } from '../components/ClientAvatarImage';
import { useAuth } from '../auth/AuthContext';
import type { DealsStackParamList } from '../navigation/types';
import { useI18n } from '../i18n/useI18n';
import { useAppColors, useAppPreferences, useDealStageLabel } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { getJson, patchJson, postJson } from '../api/requests';
import type { DealsPipelineResponse, DealStage, PipelineDeal, SalesPipelineItem } from '../api/types';
import { resolveBillingErrorMessage } from '../utils/billingErrors';
import { AppTextInput } from '../components/AppTextInput';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useDataSync } from '../data/DataSyncContext';
import { DEAL_STAGES } from '../utils/locale';
import { rnwShadow } from '../utils/rnwShadow';

type Props = {
  navigation: NativeStackNavigationProp<DealsStackParamList, 'DealsPipeline'>;
};

export function DealsPipelineScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { t } = useI18n();
  const { formatMoney } = useAppPreferences();
  const stageLabel = useDealStageLabel();
  const styles = useMemo(() => createPipelineStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const bottomPad = 120 + insets.bottom;
  const auth = useAuth();
  const { invalidate } = useDataSync();

  const [data, setData] = useState<DealsPipelineResponse | null>(null);
  const [pipelines, setPipelines] = useState<SalesPipelineItem[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadPipelines = useCallback(() => {
    getJson<{ items: SalesPipelineItem[] }>(auth, '/pipelines')
      .then((res) => {
        setPipelines(res.items);
        setSelectedPipelineId((prev) => {
          if (prev != null && res.items.some((p) => p.id === prev)) return prev;
          const def = res.items.find((p) => p.isDefault) ?? res.items[0];
          return def?.id ?? null;
        });
      })
      .catch(() => {});
  }, [auth]);

  const loadPipeline = useCallback(() => {
    if (selectedPipelineId == null) return;
    let alive = true;
    setError(null);
    getJson<DealsPipelineResponse>(auth, `/deals/pipeline?pipelineId=${selectedPipelineId}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : t('common.loadError'));
      });
    return () => {
      alive = false;
    };
  }, [auth, selectedPipelineId, t]);

  useAutoRefresh(['deals', 'billing'], loadPipelines);

  useEffect(() => {
    if (selectedPipelineId == null) return;
    return loadPipeline();
  }, [selectedPipelineId, loadPipeline]);

  const createPipeline = useCallback(async () => {
    const name = newPipelineName.trim();
    if (!name) return;
    setError(null);
    try {
      const created = await postJson<{ id: number; name: string }>(auth, '/pipelines', { name });
      setNewPipelineName('');
      setSelectedPipelineId(created.id);
      loadPipelines();
      invalidate('billing', 'audit');
    } catch (e) {
      setError(resolveBillingErrorMessage(e, t));
    }
  }, [auth, invalidate, loadPipelines, newPipelineName, t]);

  const moveDealStage = useCallback((dealId: number, fromStage: DealStage, toStage: DealStage) => {
    if (fromStage === toStage) return;
    setData((prev) => {
      if (!prev) return prev;
      const deal = prev.stages[fromStage]?.find((x) => x.id === dealId);
      if (!deal) return prev;
      const nextStages: Record<DealStage, PipelineDeal[]> = {
        Lead: [...(prev.stages.Lead ?? [])],
        Negotiation: [...(prev.stages.Negotiation ?? [])],
        Closed: [...(prev.stages.Closed ?? [])],
      };
      nextStages[fromStage] = nextStages[fromStage].filter((x) => x.id !== dealId);
      nextStages[toStage] = [...nextStages[toStage], { ...deal, stage: toStage }];
      return { ...prev, stages: nextStages };
    });
  }, []);

  const changeDealStage = useCallback(
    async (deal: PipelineDeal, fromStage: DealStage, toStage: DealStage) => {
      if (fromStage === toStage) return;
      const snapshot = data;
      moveDealStage(deal.id, fromStage, toStage);
      try {
        await patchJson<null>(auth, `/deals/${deal.id}/stage`, { stage: toStage });
        invalidate('deals', 'dashboard', 'reports', 'audit');
      } catch {
        setData(snapshot);
      }
    },
    [auth, data, invalidate, moveDealStage],
  );

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
          <Text style={styles.heroEyebrow}>{t('deals.eyebrow')}</Text>
          <Text style={styles.heroTitle}>{t('deals.title')}</Text>
          {pipelines.length > 0 ? (
            <ScrollView
              contentContainerStyle={styles.pipelineRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {pipelines.map((p) => {
                const active = p.id === selectedPipelineId;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    onPress={() => setSelectedPipelineId(p.id)}
                    style={[styles.pipelineChip, active && styles.pipelineChipActive]}
                  >
                    <Text style={[styles.pipelineChipText, active && styles.pipelineChipTextActive]}>
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          {pipelines.length > 0 ? (
            <View style={styles.addPipelineRow}>
              <AppTextInput
                value={newPipelineName}
                onChangeText={setNewPipelineName}
                placeholder={t('deals.pipelineName')}
                placeholderTextColor={`${colors.onSurfaceVariant}99`}
                style={styles.pipelineInput}
              />
              <Pressable accessibilityRole="button" onPress={() => void createPipeline()} style={styles.addPipelineBtn}>
                <Text style={styles.addPipelineBtnText}>{t('deals.addPipeline')}</Text>
              </Pressable>
            </View>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.chipsRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{t('deals.sum')}</Text>
              <Text style={[styles.chipValue, { color: colors.primary }]}>
                {formatMoney(data?.totals.total ?? 0)}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{t('deals.weighted')}</Text>
              <Text style={[styles.chipValue, { color: colors.secondary }]}>
                {formatMoney(data?.totals.weighted ?? 0)}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{t('deals.avgCheck')}</Text>
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
                    Alert.alert(t('deals.dealAlert'), d.title, [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('deals.edit'),
                        onPress: () => navigation.navigate('DealEdit', { dealId: d.id }),
                      },
                      ...DEAL_STAGES.map((s) => ({
                        text: stageLabel(s),
                        onPress: () => void changeDealStage(d, stage, s),
                      })),
                    ]);
                  }}
                  style={({ pressed }) => [
                    stage === 'Negotiation' ? styles.negCard : styles.dealCard,
                    pressed && { opacity: 0.95 },
                  ]}
                >
                  {stage === 'Negotiation' ? <View style={styles.negAccent} /> : null}

                  <View style={styles.dealTop}>
                    <View style={styles.dealTitleBlock}>
                      <Text style={styles.dealName} numberOfLines={2}>
                        {d.title}
                      </Text>
                      <Text style={styles.dealCompany} numberOfLines={1}>
                        {d.client.company}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.dealStageTag,
                        stage === 'Negotiation' ? styles.tagOrange : styles.tagBlue,
                      ]}
                    >
                      <Text
                        style={stage === 'Negotiation' ? styles.tagOrangeText : styles.tagBlueText}
                        numberOfLines={1}
                      >
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
                          fullName={d.client.fullName}
                          avatarHue={d.client.avatarHue}
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
    marginBottom: 12,
  },
  pipelineRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  pipelineChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}44`,
    backgroundColor: colors.surfaceContainerLowest,
  },
  pipelineChipActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}18`,
  },
  pipelineChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  pipelineChipTextActive: {
    color: colors.primary,
  },
  addPipelineRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  pipelineInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}44`,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLowest,
  },
  addPipelineBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primary,
  },
  addPipelineBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.onPrimary,
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
    ...rnwShadow({ offset: { width: 0, height: 1 }, opacity: 0.05, radius: 4, elevation: 2 }),
  },
  dealTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  dealTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2,
  },
  dealName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  dealCompany: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  dealStageTag: {
    flexShrink: 0,
    alignSelf: 'flex-start',
    maxWidth: '38%',
  },
  tagBlue: {
    backgroundColor: colors.blue50,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    marginBottom: 16,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    ...rnwShadow({ color: colors.primary, offset: { width: 0, height: 8 }, opacity: 0.35, radius: 16, elevation: 12 }),
  },
  });
}
