import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';

import { useAuth } from '../auth/AuthContext';
import { getJson, patchJson } from '../api/requests';
import type { TasksResponse } from '../api/types';
import { AppHeader } from '../components/AppHeader';
import { useI18n } from '../i18n/useI18n';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { taskPriorityLabel } from '../utils/locale';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useDataSync } from '../data/DataSyncContext';
import { rnwShadow } from '../utils/rnwShadow';
import {
  formatMonthYear,
  getMondayToFriday,
  sameCalendarDay,
  shiftMonth,
  weekdayShort,
} from '../utils/calendarRu';

const pressableWeb = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : undefined;

type RootNav = NativeStackNavigationProp<any>;

export function TasksScreen({ navigation }: { navigation: RootNav }) {
  const colors = useAppColors();
  const { language } = useAppPreferences();
  const { t } = useI18n();
  const styles = useMemo(() => createTasksScreenStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const bottomPad = 120 + insets.bottom;
  const auth = useAuth();
  const { invalidate } = useDataSync();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [data, setData] = useState<TasksResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekDays = useMemo(() => getMondayToFriday(selectedDate), [selectedDate]);

  const dateStr = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const loadTasks = useCallback(() => {
    let alive = true;
    setError(null);
    setLoading(true);
    getJson<TasksResponse>(auth, `/tasks?date=${encodeURIComponent(dateStr)}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : t('common.loadError'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auth, dateStr, t]);

  useAutoRefresh(['tasks'], loadTasks);

  useEffect(() => {
    return loadTasks();
  }, [loadTasks]);

  const selectDate = useCallback((d: Date) => {
    setSelectedDate(new Date(d));
    setData(null);
    setLoading(true);
  }, []);

  const goPrevMonth = useCallback(() => {
    setSelectedDate((d) => shiftMonth(d, -1));
  }, []);

  const goNextMonth = useCallback(() => {
    setSelectedDate((d) => shiftMonth(d, 1));
  }, []);

  const toggleTask = useCallback(
    async (id: number, nextDone: boolean) => {
      setData((p) =>
        p
          ? {
              ...p,
              done: p.done + (nextDone ? 1 : -1),
              items: p.items.map((t) => (t.id === id ? { ...t, done: nextDone } : t)),
            }
          : p
      );
      try {
        await patchJson<null>(auth, `/tasks/${id}/done`, { done: nextDone });
        invalidate('tasks', 'dashboard', 'audit');
      } catch (e) {
        // откат
        setData((p) =>
          p
            ? {
                ...p,
                done: p.done + (nextDone ? -1 : 1),
                items: p.items.map((t) => (t.id === id ? { ...t, done: !nextDone } : t)),
              }
            : p
        );
        setError(e instanceof Error ? e.message : t('tasks.saveError'));
      }
    },
    [auth, invalidate, t],
  );

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.calHeader}>
          <Text style={styles.monthTitle}>{formatMonthYear(selectedDate, language)}</Text>
          <View style={styles.calNav}>
            <Pressable
              accessibilityLabel={t('tasks.prevMonth')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={goPrevMonth}
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressed, pressableWeb]}
            >
              <MaterialIcons color={colors.onSurfaceVariant} name="chevron-left" size={20} />
            </Pressable>
            <Pressable
              accessibilityLabel={t('tasks.nextMonth')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={goNextMonth}
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressed, pressableWeb]}
            >
              <MaterialIcons color={colors.onSurfaceVariant} name="chevron-right" size={20} />
            </Pressable>
          </View>
        </View>

        <View style={styles.daysRow}>
          {weekDays.map((d) => {
            const active = sameCalendarDay(selectedDate, d);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            return (
              <Pressable
                accessibilityLabel={`${weekdayShort(d, language)} ${d.getDate()}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={key}
                onPress={() => selectDate(d)}
                style={({ pressed }) => [
                  styles.dayCell,
                  active ? styles.dayCellActive : styles.dayCellIdle,
                  pressed && styles.dayCellPressed,
                  pressableWeb,
                ]}
              >
                <Text style={[styles.dayName, active && styles.dayNameActive]}>
                  {weekdayShort(d, language)}
                </Text>
                <Text style={[styles.dayNum, active && styles.dayNumActive]}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('tasks.done')}</Text>
            <View style={styles.statValues}>
              <Text style={[styles.statMain, { color: colors.primary }]}>{data?.done ?? 0}</Text>
              <Text style={styles.statSlash}>/ {data?.total ?? 0}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('tasks.productivity')}</Text>
            <View style={styles.statValues}>
              <Text style={[styles.statMain, { color: colors.tertiary }]}>
                {data?.total ? `${Math.round((data.done / data.total) * 100)}%` : '—'}
              </Text>
              <MaterialIcons color={colors.tertiary} name="trending-up" size={18} />
            </View>
          </View>
        </View>

        <View style={styles.focusBlock}>
          <View style={styles.focusHead}>
            <Text style={styles.focusTitle}>{t('tasks.focusTitle')}</Text>
            {loading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.viewAll}>{error ? t('tasks.error') : ' '}</Text>
            )}
          </View>

          {(data?.items ?? []).map((task) => {
            const badge =
              task.priority === 'High'
                ? { wrap: styles.badgeHigh, text: styles.badgeHighText, label: taskPriorityLabel(task.priority, language) }
                : task.priority === 'Medium'
                  ? { wrap: styles.badgeMed, text: styles.badgeMedText, label: taskPriorityLabel(task.priority, language) }
                  : { wrap: styles.badgeLow, text: styles.badgeLowText, label: taskPriorityLabel(task.priority, language) };

            return (
              <Pressable
                key={task.id}
                onPress={() => navigation.navigate('TaskEdit', { taskId: task.id })}
                style={({ pressed }) => [styles.taskCard, task.done && styles.taskDone, pressed && { opacity: 0.95 }]}
              >
                <Pressable
                  accessibilityLabel={t('tasks.toggleA11y')}
                  hitSlop={8}
                  onPress={() => toggleTask(task.id, !task.done)}
                  style={({ pressed }) => [styles.checkboxWrap, pressed && styles.pressed]}
                >
                  <View style={task.done ? styles.checkboxFilled : styles.checkbox}>
                    {task.done ? (
                      <MaterialIcons color={colors.onPrimaryContainer} name="check" size={16} />
                    ) : null}
                  </View>
                </Pressable>
                <View style={styles.taskMain}>
                  <View style={styles.taskTitleRow}>
                    <Text style={[styles.taskTitle, task.done && styles.taskTitleStrike]}>{task.title}</Text>
                    <View style={badge.wrap}>
                      <Text style={badge.text}>{badge.label}</Text>
                    </View>
                  </View>
                  {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
                  <View style={styles.taskMeta}>
                    {task.time ? (
                      <View style={styles.metaItem}>
                        <MaterialIcons color={colors.onSurfaceVariant} name="schedule" size={14} />
                        <Text style={styles.metaText}>{String(task.time).slice(0, 5)}</Text>
                      </View>
                    ) : null}
                    {task.assigneeName ? (
                      <View style={styles.metaItem}>
                        <MaterialIcons color={colors.onSurfaceVariant} name="person" size={14} />
                        <Text style={styles.metaText}>{task.assigneeName}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        accessibilityLabel={t('tasks.addA11y')}
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => navigation.navigate('TaskEdit')}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed, pressableWeb]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.fabInner}
        >
          <MaterialIcons color={colors.onPrimary} name="add" size={28} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function createTasksScreenStyles(colors: AppPalette) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  calNav: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLow,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 20,
  },
  dayCell: {
    flex: 1,
    minWidth: 52,
    maxWidth: 72,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
  },
  dayCellIdle: {
    backgroundColor: colors.surfaceContainerLow,
  },
  dayCellActive: {
    backgroundColor: colors.primaryContainer,
    ...rnwShadow({ color: colors.primary, offset: { width: 0, height: 4 }, opacity: 0.2, radius: 8, elevation: 4 }),
  },
  dayCellPressed: {
    opacity: 0.85,
  },
  dayName: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    marginBottom: 6,
  },
  dayNameActive: {
    color: colors.onPrimaryContainer,
  },
  dayNum: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
  },
  dayNumActive: {
    color: colors.onPrimaryContainer,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 20,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  statMain: {
    fontSize: 26,
    fontWeight: '800',
  },
  statSlash: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  focusBlock: {
    gap: 16,
    marginBottom: 24,
  },
  focusHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  focusTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.onSurface,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  taskCard: {
    flexDirection: 'row',
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerLowest,
  },
  taskDone: {
    backgroundColor: colors.surfaceContainerLow,
    opacity: 0.85,
  },
  checkboxWrap: {
    paddingVertical: 4,
    paddingRight: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: `${colors.primary}33`,
    marginTop: 4,
  },
  checkboxFilled: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.primaryContainer,
    borderWidth: 2,
    borderColor: colors.primaryContainer,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskMain: {
    flex: 1,
    gap: 8,
  },
  taskTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  taskTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.2,
  },
  taskTitleStrike: {
    textDecorationLine: 'line-through',
  },
  taskDesc: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  taskMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    color: `${colors.onSurfaceVariant}B3`,
  },
  badgeHigh: {
    backgroundColor: colors.errorContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeHighText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.error,
    textTransform: 'uppercase',
  },
  badgeMed: {
    backgroundColor: `${colors.secondaryContainer}55`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeMedText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onSecondaryContainer,
    textTransform: 'uppercase',
  },
  badgeLow: {
    backgroundColor: colors.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeLowText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
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
    ...rnwShadow({ color: colors.primary, offset: { width: 0, height: 6 }, opacity: 0.35, radius: 12, elevation: 10 }),
  },
  pressed: {
    opacity: 0.75,
  },
});
}
