import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { useAuth } from '../auth/AuthContext';
import { deleteJson, getJson, postJson, putJson } from '../api/requests';
import { AppHeader } from '../components/AppHeader';
import { AppTextInput } from '../components/AppTextInput';
import { DatePickerField } from '../components/DatePickerField';
import { SearchableSelectField } from '../components/SearchableSelectField';
import { useI18n } from '../i18n/useI18n';
import type { RootStackParamList } from '../navigation/types';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useDataSync } from '../data/DataSyncContext';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { taskPriorityLabel } from '../utils/locale';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TaskEdit'>;
  route: RouteProp<RootStackParamList, 'TaskEdit'>;
};

type TeamMember = {
  userId: number;
  username: string;
  fullName: string | null;
  isBlocked?: boolean;
};

type TeamResponse = { items: TeamMember[] };

type TaskDetail = {
  id: number;
  date: string;
  title: string;
  description: string | null;
  assigneeName: string | null;
  time: string | null;
  priority: 'Low' | 'Medium' | 'High';
  done: boolean;
};

function memberDisplayName(m: TeamMember): string {
  return m.fullName?.trim() || m.username;
}

/** "HH:MM" / "HH:MM:SS" из API → "09:00" для поля */
function apiTimeToHhMm(isoTime: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(isoTime).trim());
  if (!m) return '';
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Ввод "9:00" / "09:00" → "09:00:00" для API */
function hhMmToPayload(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

/** Маска ввода: только цифры, автоматически ЧЧ:ММ */
function formatHhMmInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function TaskEditScreen({ navigation, route }: Props) {
  const colors = useAppColors();
  const { language } = useAppPreferences();
  const { t } = useI18n();
  const styles = useMemo(() => createTaskEditStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const bottomPad = 120 + insets.bottom;
  const auth = useAuth();
  const { invalidate } = useDataSync();

  const taskId = route.params?.taskId;
  const presetTitle = route.params?.presetTitle;
  const isEdit = typeof taskId === 'number';

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState(() => presetTitle?.trim() ?? '');
  const [description, setDescription] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [timeHhMm, setTimeHhMm] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);

  const loadTeam = useCallback(() => {
    let alive = true;
    getJson<TeamResponse>(auth, '/team')
      .then((d) => {
        if (!alive) return;
        setTeam(d.items ?? []);
      })
      .catch(() => {
        if (!alive) return;
        setTeam([]);
      });
    return () => {
      alive = false;
    };
  }, [auth]);

  useAutoRefresh([], loadTeam);

  const loadTask = useCallback(() => {
    if (!isEdit || typeof taskId !== 'number') return;
    let alive = true;
    setLoading(true);
    setError(null);
    getJson<TaskDetail>(auth, `/tasks/${taskId}`)
      .then((t) => {
        if (!alive) return;
        setDate(String((t as any).date ?? '').slice(0, 10));
        setTitle((t as any).title ?? '');
        setDescription((t as any).description ?? '');
        setAssigneeName((t as any).assigneeName ?? '');
        setTimeHhMm((t as any).time ? apiTimeToHhMm(String((t as any).time)) : '');
        setPriority((t as any).priority ?? 'Medium');
        setDone(!!(t as any).done);
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
  }, [auth, isEdit, taskId]);

  useAutoRefresh(['tasks'], loadTask);

  const assigneeOptions = useMemo(
    () =>
      team
        .filter((m) => !m.isBlocked)
        .map((m) => ({ id: m.userId, label: memberDisplayName(m) })),
    [team],
  );

  const onSave = async () => {
    if (loading) return;
    setError(null);
    let timePayload: string | null = null;
    if (timeHhMm.trim()) {
      timePayload = hhMmToPayload(timeHhMm);
      if (timePayload === null) {
        setError('Время: укажите в формате ЧЧ:ММ, например 09:00 или 14:30');
        return;
      }
    }

    const payload = {
      date,
      title: title.trim(),
      description: description.trim() || null,
      assigneeName: assigneeName.trim() || null,
      time: timePayload,
      priority,
      done,
    };
    if (!payload.title) return setError('Введите название');
    if (!payload.date) return setError('Введите дату');

    setLoading(true);
    try {
      if (isEdit) {
        await putJson<null>(auth, `/tasks/${taskId}`, payload);
      } else {
        await postJson<{ id: number }>(auth, '/tasks', payload);
      }
      invalidate('tasks', 'dashboard', 'notifications', 'audit');
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = () => {
    if (!isEdit || loading) return;
    Alert.alert('Удалить задачу?', title || `#${taskId}`, [
      { text: 'Отмена' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await deleteJson(auth, `/tasks/${taskId}`);
            invalidate('tasks', 'dashboard', 'notifications', 'audit');
            navigation.goBack();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка удаления');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{isEdit ? 'Редактировать задачу' : 'Новая задача'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Дата</Text>
        <DatePickerField value={date} onChange={setDate} placeholder="Выберите дату" allowClear={false} />

        <Text style={styles.label}>Название</Text>
        <AppTextInput value={title} onChangeText={setTitle} style={styles.input} />

        <Text style={styles.label}>Описание</Text>
        <AppTextInput value={description} onChangeText={setDescription} style={[styles.input, { minHeight: 90 }]} multiline />

        <Text style={styles.label}>{t('taskEdit.assignee')}</Text>
        <SearchableSelectField
          value={assigneeName.trim() || null}
          options={assigneeOptions}
          onChange={(label) => setAssigneeName(label ?? '')}
          placeholder={t('taskEdit.assigneePlaceholder')}
          searchPlaceholder={t('taskEdit.assigneeSearch')}
          sheetTitle={t('taskEdit.assignee')}
          emptyLabel={t('taskEdit.assigneeNone')}
          allowEmpty
        />

        <Text style={styles.label}>Время</Text>
        <AppTextInput
          value={timeHhMm}
          onChangeText={(t) => setTimeHhMm(formatHhMmInput(t))}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          placeholder="09:00"
          placeholderTextColor={`${colors.onSurfaceVariant}99`}
          style={styles.input}
        />

        <Text style={styles.label}>Приоритет</Text>
        <View style={styles.row}>
          {(['Low', 'Medium', 'High'] as const).map((p) => {
            const active = priority === p;
            return (
              <Pressable key={p} onPress={() => setPriority(p)} style={[styles.pill, active && styles.pillActive]}>
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{taskPriorityLabel(p, language)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => setDone((v) => !v)} style={[styles.doneRow]}>
          <Text style={styles.doneText}>{done ? 'Выполнено' : 'Не выполнено'}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={onSave} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.92 }]}>
          <Text style={styles.primaryBtnText}>{loading ? '…' : 'Сохранить'}</Text>
        </Pressable>

        {isEdit ? (
          <Pressable accessibilityRole="button" onPress={onDelete} style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.dangerBtnText}>Удалить</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function createTaskEditStyles(colors: AppPalette) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: 24, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '900', color: colors.onSurface, marginBottom: 10 },
  error: { color: colors.error, fontWeight: '700', marginBottom: 10 },
  label: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  input: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
  },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}22`,
  },
  pillActive: { backgroundColor: colors.primaryContainer, borderColor: `${colors.primary}33` },
  pillText: { fontSize: 12, fontWeight: '800', color: colors.onSurfaceVariant },
  pillTextActive: { color: colors.onPrimaryContainer },
  doneRow: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}22`,
    alignItems: 'center',
  },
  doneText: { fontSize: 13, fontWeight: '900', color: colors.onSurface },
  primaryBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '900', color: colors.onPrimary },
  dangerBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorContainer,
    borderWidth: 1,
    borderColor: `${colors.error}33`,
  },
  dangerBtnText: { fontSize: 14, fontWeight: '900', color: colors.error },
});
}

