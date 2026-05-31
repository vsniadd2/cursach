import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { deleteJson, getJson, postJson, putJson } from '../api/requests';
import { AppHeader } from '../components/AppHeader';
import type { TasksResponse } from '../api/types';
import type { RootStackParamList } from '../navigation/types';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TaskEdit'>;
  route: RouteProp<RootStackParamList, 'TaskEdit'>;
};

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

const MINUTES_PER_DAY = 24 * 60 - 1; // 1439

/** "HH:MM" / "HH:MM:SS" → строка минут от полуночи для поля ввода */
function apiTimeToMinutesField(isoTime: string): string {
  const s = String(isoTime).trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return '';
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return '';
  return String(h * 60 + min);
}

/** Минуты от полуночи → "HH:MM:00" для API */
function minutesFieldToPayload(minutesStr: string): string | null {
  const raw = minutesStr.trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  const clamped = Math.min(MINUTES_PER_DAY, Math.max(0, n));
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

function minutesPreview(minutesStr: string): string | null {
  const raw = minutesStr.trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  const clamped = Math.min(MINUTES_PER_DAY, Math.max(0, n));
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function TaskEditScreen({ navigation, route }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createTaskEditStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bottomPad = 120 + insets.bottom;
  const auth = useAuth();

  const taskId = route.params?.taskId;
  const isEdit = typeof taskId === 'number';

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [timeMinutes, setTimeMinutes] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!isEdit) return;
    setLoading(true);
    setError(null);
    getJson<TaskDetail>(auth, `/tasks/${taskId}`)
      .then((t) => {
        if (!alive) return;
        setDate(String((t as any).date ?? '').slice(0, 10));
        setTitle((t as any).title ?? '');
        setDescription((t as any).description ?? '');
        setAssigneeName((t as any).assigneeName ?? '');
        setTimeMinutes((t as any).time ? apiTimeToMinutesField(String((t as any).time)) : '');
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

  const timePreview = useMemo(() => minutesPreview(timeMinutes), [timeMinutes]);

  const onSave = async () => {
    if (loading) return;
    setError(null);
    let timePayload: string | null = null;
    if (timeMinutes.trim()) {
      timePayload = minutesFieldToPayload(timeMinutes);
      if (timePayload === null) {
        setError('Время: введите целое число минут от 0 до 1439');
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

        <Text style={styles.label}>Дата (YYYY-MM-DD)</Text>
        <TextInput value={date} onChangeText={setDate} autoCapitalize="none" style={styles.input} />

        <Text style={styles.label}>Название</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} />

        <Text style={styles.label}>Описание</Text>
        <TextInput value={description} onChangeText={setDescription} style={[styles.input, { minHeight: 90 }]} multiline />

        <Text style={styles.label}>Исполнитель</Text>
        <TextInput value={assigneeName} onChangeText={setAssigneeName} style={styles.input} />

        <Text style={styles.label}>Время (минуты от полуночи)</Text>
        <Text style={styles.hint}>Одно число: 0 = 00:00, 90 = 01:30, 1439 = 23:59</Text>
        <TextInput
          value={timeMinutes}
          onChangeText={(t) => setTimeMinutes(t.replace(/\D/g, '').slice(0, 4))}
          autoCapitalize="none"
          keyboardType="number-pad"
          placeholder="например 540"
          placeholderTextColor={`${colors.onSurfaceVariant}99`}
          style={styles.input}
        />
        {timePreview ? (
          <Text style={styles.preview}>
            На часах: <Text style={styles.previewBold}>{timePreview}</Text>
          </Text>
        ) : null}

        <Text style={styles.label}>Приоритет</Text>
        <View style={styles.row}>
          {(['Low', 'Medium', 'High'] as const).map((p) => {
            const active = priority === p;
            return (
              <Pressable key={p} onPress={() => setPriority(p)} style={[styles.pill, active && styles.pillActive]}>
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{p}</Text>
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
  hint: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginBottom: 8,
    lineHeight: 16,
  },
  preview: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 6,
  },
  previewBold: {
    fontWeight: '800',
    color: colors.onSurface,
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
  row: { flexDirection: 'row', gap: 10 },
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

