import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import {
  formatDateDisplayRu,
  formatIsoDate,
  formatMonthYearRu,
  getMonthGrid,
  parseIsoDate,
  sameCalendarDay,
  shiftMonth,
  WEEKDAY_HEADERS_MON,
} from '../utils/calendarRu';

const pressableWeb = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : undefined;

const CALENDAR_CELL = 40;
const SHEET_MAX_WIDTH = 340;

type DatePickerFieldProps = {
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  allowClear?: boolean;
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}33`,
    },
    fieldText: { fontSize: 14, fontWeight: '600', color: colors.onSurface, flex: 1 },
    placeholder: { color: colors.onSurfaceVariant, fontWeight: '500' },
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      width: '100%',
      maxWidth: SHEET_MAX_WIDTH,
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}33`,
      ...(Platform.OS === 'web'
        ? {
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          }
        : {}),
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.onSurface,
      marginBottom: 12,
      textAlign: 'center',
    },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    monthLabel: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: 6,
      width: CALENDAR_CELL * 7,
      alignSelf: 'center',
    },
    weekday: {
      width: CALENDAR_CELL,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '800',
      color: colors.onSurfaceVariant,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: CALENDAR_CELL * 7,
      alignSelf: 'center',
    },
    cell: {
      width: CALENDAR_CELL,
      height: CALENDAR_CELL,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayBtnActive: { backgroundColor: colors.primary },
    dayBtnToday: { borderWidth: 1, borderColor: `${colors.primary}55` },
    dayText: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
    dayTextActive: { color: colors.onPrimary },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    actionBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}33`,
    },
    actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    actionText: { fontSize: 14, fontWeight: '800', color: colors.onSurfaceVariant },
    actionTextPrimary: { color: colors.onPrimary },
  });
}

export function DatePickerField({
  value,
  onChange,
  placeholder = 'Выберите дату',
  allowClear = true,
}: DatePickerFieldProps) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const parsed = parseIsoDate(value);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);
  const [viewMonth, setViewMonth] = useState(() => parsed ?? today);
  const [draft, setDraft] = useState<Date | null>(parsed);

  const grid = useMemo(() => getMonthGrid(viewMonth), [viewMonth]);

  const openPicker = () => {
    const base = parsed ?? today;
    setViewMonth(base);
    setDraft(parsed);
    setOpen(true);
  };

  const confirm = () => {
    if (draft) onChange(formatIsoDate(draft));
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setDraft(null);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Выбрать дату"
        onPress={openPicker}
        style={({ pressed }) => [styles.field, pressed && { opacity: 0.92 }, pressableWeb]}
      >
        <Text style={[styles.fieldText, !value && styles.placeholder]}>
          {value ? formatDateDisplayRu(value) : placeholder}
        </Text>
        <MaterialIcons color={colors.onSurfaceVariant} name="calendar-today" size={20} />
      </Pressable>

      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel="Закрыть"
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Выбор даты</Text>

            <View style={styles.monthRow}>
              <Pressable
                accessibilityLabel="Предыдущий месяц"
                onPress={() => setViewMonth((m) => shiftMonth(m, -1))}
                style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.8 }, pressableWeb]}
              >
                <MaterialIcons color={colors.onSurfaceVariant} name="chevron-left" size={22} />
              </Pressable>
              <Text style={styles.monthLabel}>{formatMonthYearRu(viewMonth)}</Text>
              <Pressable
                accessibilityLabel="Следующий месяц"
                onPress={() => setViewMonth((m) => shiftMonth(m, 1))}
                style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.8 }, pressableWeb]}
              >
                <MaterialIcons color={colors.onSurfaceVariant} name="chevron-right" size={22} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_HEADERS_MON.map((w) => (
                <Text key={w} style={styles.weekday}>
                  {w}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {grid.map((day, idx) => {
                if (!day) {
                  return <View key={`empty-${idx}`} style={styles.cell} />;
                }
                const active = draft ? sameCalendarDay(draft, day) : false;
                const isToday = sameCalendarDay(today, day);
                const key = formatIsoDate(day);
                return (
                  <View key={key} style={styles.cell}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setDraft(day)}
                      style={({ pressed }) => [
                        styles.dayBtn,
                        active && styles.dayBtnActive,
                        !active && isToday && styles.dayBtnToday,
                        pressed && { opacity: 0.85 },
                        pressableWeb,
                      ]}
                    >
                      <Text style={[styles.dayText, active && styles.dayTextActive]}>{day.getDate()}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={styles.actions}>
              {allowClear ? (
                <Pressable onPress={clear} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9 }]}>
                  <Text style={styles.actionText}>Очистить</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={confirm}
                disabled={!draft}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionPrimary,
                  !draft && { opacity: 0.5 },
                  pressed && draft && { opacity: 0.92 },
                ]}
              >
                <Text style={[styles.actionText, styles.actionTextPrimary]}>Готово</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
