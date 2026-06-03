import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { AppTextInput } from '../components/AppTextInput';
import { getJson } from '../api/requests';
import { useI18n } from '../i18n/useI18n';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { confirmAsync } from '../utils/appAlerts';
import {
  gradientChoicesFor,
  mapApiQuickActions,
  toApiQuickActions,
  type UiQuickAction,
} from '../utils/dashboardQuickActions';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { DEAL_STAGES, dealStageLabel, formatGrowthPct, greetingByTime } from '../utils/locale';
import { rnwShadow } from '../utils/rnwShadow';
import type { DashboardResponse, DealStage } from '../api/types';
import type { MainTabParamList } from '../navigation/types';

function timeAgoShortRu(iso: string) {
  const dt = new Date(iso);
  const diffMs = Date.now() - dt.getTime();
  const m = Math.max(0, Math.round(diffMs / 60000));
  if (m < 60) return `${m} мин`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.round(h / 24);
  return `${d} дн`;
}

type QuickAction = UiQuickAction;

const ICON_CHOICES: Array<QuickAction['icon']> = [
  'add',
  'person-add',
  'call',
  'event',
  'mail',
  'assignment',
  'check-circle',
  'calendar-today',
  'payments',
  'local-offer',
];

export function DashboardScreen() {
  const colors = useAppColors();
  const { formatMoney, profile, language, updatePreferences } = useAppPreferences();
  const { t } = useI18n();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);
  const gradientChoices = useMemo(() => gradientChoicesFor(colors), [colors]);

  const insets = useAppSafeAreaInsets();
  const bottomPad = 100 + insets.bottom;
  const auth = useAuth();
  const navigation = useNavigation<any>();

  const [dash, setDash] = useState<DashboardResponse | null>(null);
  const [dashError, setDashError] = useState<string | null>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);

  const activitiesTake = activityExpanded ? 100 : 10;

  const loadDashboard = useCallback(() => {
    let alive = true;
    setDashError(null);
    getJson<DashboardResponse>(auth, `/dashboard?activitiesTake=${activitiesTake}`)
      .then((d) => {
        if (!alive) return;
        setDash(d);
      })
      .catch((e) => {
        if (!alive) return;
        setDashError(e instanceof Error ? e.message : t('dashboard.loadError'));
      });
    return () => {
      alive = false;
    };
  }, [auth, activitiesTake, t]);

  useAutoRefresh(['dashboard', 'deals', 'tasks'], loadDashboard);

  const quickActions = useMemo(
    () => mapApiQuickActions(profile?.dashboardQuickActions ?? [], colors, t),
    [profile?.dashboardQuickActions, colors, t],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftIcon, setDraftIcon] = useState<QuickAction['icon']>('add');
  const [draftGradientIdx, setDraftGradientIdx] = useState(0);

  const draftGradient = gradientChoices[draftGradientIdx] ?? gradientChoices[0];

  const greetingName = profile?.fullName?.trim() || profile?.username || t('dashboard.colleague');
  const growthPct = dash?.monthSalesGrowthPct;
  const growthLabel =
    growthPct != null ? formatGrowthPct(growthPct, language) : null;
  const growthPositive = growthPct != null && growthPct >= 0;
  const openTaskCreate = (presetTitle?: string) => {
    navigation.navigate('TaskEdit', presetTitle ? { presetTitle } : undefined);
  };
  const openDealsCreate = () => {
    navigation.navigate('Deals' satisfies keyof MainTabParamList, { screen: 'DealEdit' });
  };
  const openDealsPipeline = () => {
    navigation.navigate('Deals' satisfies keyof MainTabParamList, { screen: 'DealsPipeline' });
  };
  const persistQuickActions = async (next: QuickAction[]) => {
    await updatePreferences({ dashboardQuickActions: toApiQuickActions(next) });
  };
  const onQuickActionPress = (a: QuickAction) => {
    if (a.id === 'lead') {
      openDealsCreate();
      return;
    }
    if (a.id === 'call') {
      openTaskCreate(t('dashboard.quickCall'));
      return;
    }
    if (a.id === 'meeting') {
      openTaskCreate(t('dashboard.quickMeeting'));
      return;
    }
    openDealsPipeline();
  };
  const onQuickActionLongPress = async (a: QuickAction) => {
    const ok = await confirmAsync({
      title: t('dashboard.deleteActionTitle'),
      message: a.title,
      cancelLabel: t('common.cancel'),
      confirmLabel: t('common.delete'),
    });
    if (ok) {
      const next = quickActions.filter((x) => x.id !== a.id);
      await persistQuickActions(next);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.greeting}>{greetingByTime(new Date(), language)}, {greetingName}</Text>
          <Text style={styles.headline}>{t('dashboard.headline')}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.activityHeader}>
            <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
            <Pressable accessibilityRole="button" onPress={() => setAddOpen(true)}>
              <Text style={styles.viewAll}>{t('dashboard.add')}</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickTilesRow}
          >
            {quickActions.map((a) => (
              <Pressable
                accessibilityRole="button"
                key={a.id}
                onLongPress={() => void onQuickActionLongPress(a)}
                onPress={() => onQuickActionPress(a)}
                style={({ pressed }) => [pressed && { opacity: 0.92 }]}
              >
                <LinearGradient
                  colors={a.gradient}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={styles.quickTile}
                >
                  <MaterialIcons color={colors.onPrimary} name={a.icon} size={26} />
                </LinearGradient>
                <Text numberOfLines={1} style={styles.quickTileLabel}>
                  {a.title}
                </Text>
              </Pressable>
            ))}

            <Pressable
              accessibilityRole="button"
              onPress={() => setAddOpen(true)}
              style={({ pressed }) => [pressed && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryContainer]}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={styles.quickTile}
              >
                <MaterialIcons color={colors.onPrimary} name="add" size={28} />
              </LinearGradient>
              <Text numberOfLines={1} style={styles.quickTileLabel}>
                {t('dashboard.newQuick')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        <View style={styles.quickGrid}>
          <Pressable
            accessibilityRole="button"
            onPress={openDealsCreate}
            style={({ pressed }) => [pressed && { opacity: 0.92 }]}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryContainer]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.addLead}
            >
              <MaterialIcons color={colors.onPrimaryContainer} name="person-add" size={32} />
              <Text style={styles.addLeadText}>{t('dashboard.addLead')}</Text>
            </LinearGradient>
          </Pressable>
          <View style={styles.quickCol}>
            <Pressable
              accessibilityRole="button"
              onPress={() => openTaskCreate(t('dashboard.call'))}
              style={({ pressed }) => [styles.smallAction, pressed && { opacity: 0.9 }]}
            >
              <View style={[styles.smallIconBg, { backgroundColor: `${colors.tertiary}18` }]}>
                <MaterialIcons color={colors.tertiary} name="call" size={22} />
              </View>
              <Text style={styles.smallActionLabel}>{t('dashboard.call')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => openTaskCreate(t('dashboard.meeting'))}
              style={({ pressed }) => [styles.smallAction, pressed && { opacity: 0.9 }]}
            >
              <View style={[styles.smallIconBg, { backgroundColor: `${colors.secondary}18` }]}>
                <MaterialIcons color={colors.secondary} name="event" size={22} />
              </View>
              <Text style={styles.smallActionLabel}>{t('dashboard.meeting')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.efficiencySummary')}</Text>
          <View style={styles.bento}>
            <View style={styles.salesCard}>
              <View style={styles.salesRow}>
                <Text style={styles.mutedLabel}>{t('dashboard.totalSales')}</Text>
                {growthLabel ? (
                  <View
                    style={[
                      styles.growthBadge,
                      growthPositive ? styles.growthBadgePositive : styles.growthBadgeNegative,
                    ]}
                  >
                    <Text
                      style={[
                        styles.growthBadgeText,
                        growthPositive ? styles.growthBadgeTextPositive : styles.growthBadgeTextNegative,
                      ]}
                    >
                      {growthLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.salesAmountRow}>
                <Text style={styles.salesAmount}>{formatMoney(dash?.monthSales ?? 0)}</Text>
                <Text style={styles.salesSub}>{t('dashboard.perMonth')}</Text>
              </View>
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metricThird}>
                <MaterialIcons color={colors.primary} name="group" size={22} />
                <Text style={styles.metricNum}>{dash?.newLeads ?? 0}</Text>
                <Text style={styles.metricCap}>{t('dashboard.newLeads')}</Text>
              </View>
              <View style={styles.metricThird}>
                <MaterialIcons color={colors.secondary} name="assignment-turned-in" size={22} />
                <Text style={styles.metricNum}>{dash?.activeTasks ?? 0}</Text>
                <Text style={styles.metricCap}>{t('dashboard.activeTasks')}</Text>
              </View>
              <View style={styles.metricThird}>
                <MaterialIcons color={colors.error} name="warning" size={22} />
                <Text style={styles.metricNum}>{dash?.overdueTasks ?? 0}</Text>
                <Text style={styles.metricCap}>{t('dashboard.overdueTasks')}</Text>
              </View>
            </View>
            {dash?.dealsByStage?.countByStage ? (
              <View style={styles.funnelRow}>
                {DEAL_STAGES.map((stage: DealStage) => (
                  <View key={stage} style={styles.funnelItem}>
                    <Text style={styles.funnelCount}>
                      {dash.dealsByStage?.countByStage[stage] ?? 0}
                    </Text>
                    <Text style={styles.funnelLabel}>{dealStageLabel(stage, language)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.activityHeader}>
            <Text style={styles.sectionTitle}>{t('dashboard.recentActivity')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActivityExpanded((v) => !v)}
            >
              <Text style={styles.viewAll}>{activityExpanded ? t('dashboard.collapse') : t('dashboard.viewAll')}</Text>
            </Pressable>
          </View>
          {dashError ? <Text style={styles.errorText}>{dashError}</Text> : null}
          <View style={styles.activityList}>
            {(dash?.activities ?? []).map((a) => {
              const badgeBg =
                a.badgeIcon === 'check'
                  ? colors.tertiaryContainer
                  : a.badgeIcon === 'mail'
                    ? colors.primary
                    : colors.surfaceContainerHighest;

              const badgeName =
                a.badgeIcon === 'check'
                  ? ('check' as const)
                  : a.badgeIcon === 'mail'
                    ? ('mail' as const)
                    : ('schedule' as const);

              return (
                <View key={a.id} style={styles.activityItem}>
                  <View style={styles.activityAvatarWrap}>
                    {a.avatarUrl ? (
                      <Image source={{ uri: a.avatarUrl }} style={styles.activityAvatar} />
                    ) : (
                      <View style={styles.scheduleIcon} />
                    )}
                    <View style={[styles.activityBadge, { backgroundColor: badgeBg }]}>
                      <MaterialIcons color={colors.onPrimary} name={badgeName} size={10} />
                    </View>
                  </View>
                  <View style={styles.activityBody}>
                    <Text style={styles.activityName}>{a.title}</Text>
                    <Text style={styles.activityDesc}>{a.description}</Text>
                  </View>
                  <Text style={styles.activityTime}>
                    {timeAgoShortRu(a.createdAtUtc)} {t('dashboard.agoSuffix')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={addOpen}
        onRequestClose={() => setAddOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Добавить действие</Text>

            <Text style={styles.modalLabel}>Название</Text>
            <AppTextInput
              placeholder="Например: КП"
              placeholderTextColor={`${colors.onSurfaceVariant}99`}
              value={draftTitle}
              onChangeText={setDraftTitle}
              style={styles.input}
            />

            <Text style={styles.modalLabel}>Иконка</Text>
            <View style={styles.choiceRow}>
              {ICON_CHOICES.map((icon) => {
                const active = icon === draftIcon;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={icon}
                    onPress={() => setDraftIcon(icon)}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                  >
                    <MaterialIcons
                      color={active ? colors.onPrimary : colors.onSurfaceVariant}
                      name={icon}
                      size={18}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>Градиент</Text>
            <View style={styles.choiceRow}>
              {gradientChoices.map((g, idx) => {
                const active = idx === draftGradientIdx;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={`${g[0]}-${g[1]}`}
                    onPress={() => setDraftGradientIdx(idx)}
                  >
                    <LinearGradient
                      colors={g}
                      end={{ x: 1, y: 1 }}
                      start={{ x: 0, y: 0 }}
                      style={[styles.gradientSwatch, active && styles.gradientSwatchActive]}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAddOpen(false)}
                style={styles.modalBtnGhost}
              >
                <Text style={styles.modalBtnGhostText}>Отмена</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const title = draftTitle.trim();
                  if (!title) {
                    Alert.alert('Название пустое', 'Введите название действия.');
                    return;
                  }
                  const id = `custom_${Date.now()}`;
                  const next: QuickAction[] = [
                    ...quickActions,
                    {
                      id,
                      title,
                      icon: draftIcon,
                      gradient: draftGradient,
                      gradientIdx: draftGradientIdx,
                    },
                  ];
                  void persistQuickActions(next);
                  setDraftTitle('');
                  setDraftIcon('add');
                  setDraftGradientIdx(0);
                  setAddOpen(false);
                }}
                style={styles.modalBtnPrimary}
              >
                <Text style={styles.modalBtnPrimaryText}>Добавить</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createDashboardStyles(colors: AppPalette) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  section: {
    marginBottom: 28,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
  },
  quickTilesRow: {
    paddingHorizontal: 4,
    gap: 14,
    paddingVertical: 6,
  },
  quickTile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...rnwShadow({ offset: { width: 0, height: 6 }, opacity: 0.12, radius: 12, elevation: 6 }),
  },
  quickTileLabel: {
    marginTop: 8,
    width: 64,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  addLead: {
    flex: 1,
    minHeight: 140,
    borderRadius: 24,
    padding: 24,
    justifyContent: 'space-between',
    ...rnwShadow({ color: colors.primary, offset: { width: 0, height: 8 }, opacity: 0.2, radius: 16, elevation: 6 }),
  },
  addLeadText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  quickCol: {
    flex: 1,
    gap: 16,
  },
  smallAction: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...rnwShadow({ offset: { width: 0, height: 1 }, opacity: 0.05, radius: 4, elevation: 2 }),
  },
  smallIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  bento: {
    gap: 16,
  },
  salesCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}22`,
  },
  salesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  mutedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  growthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  growthBadgePositive: {
    backgroundColor: `${colors.tertiaryContainer}22`,
  },
  growthBadgeNegative: {
    backgroundColor: `${colors.error}18`,
  },
  growthBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  growthBadgeTextPositive: {
    color: colors.tertiary,
  },
  growthBadgeTextNegative: {
    color: colors.error,
  },
  salesAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  salesAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.onSurface,
    letterSpacing: -1,
  },
  salesSub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricThird: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 20,
    padding: 14,
  },
  funnelRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  funnelItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHighest,
  },
  funnelCount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.onSurface,
  },
  funnelLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginTop: 2,
    textAlign: 'center',
  },
  metricNum: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.onSurface,
    marginTop: 4,
  },
  metricCap: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
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
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    padding: 20,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}44`,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.onSurface,
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginTop: 10,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choicePill: {
    width: 40,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
  },
  choicePillActive: {
    backgroundColor: colors.primary,
    borderColor: `${colors.primary}66`,
  },
  gradientSwatch: {
    width: 44,
    height: 28,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gradientSwatchActive: {
    borderColor: colors.onSurface,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
  },
  modalBtnGhostText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
  },
  modalBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  modalBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.onPrimary,
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    ...rnwShadow({ offset: { width: 0, height: 1 }, opacity: 0.05, radius: 3, elevation: 1 }),
  },
  activityMuted: {
    backgroundColor: colors.surfaceContainerLow,
    opacity: 0.85,
  },
  activityAvatarWrap: {
    position: 'relative',
  },
  activityAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  activityBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBody: {
    flex: 1,
  },
  activityName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.onSurface,
  },
  activityDesc: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 10,
    fontWeight: '800',
    color: `${colors.onSurfaceVariant}99`,
    textTransform: 'uppercase',
  },
  });
}
