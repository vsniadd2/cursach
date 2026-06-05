import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from './AppTextInput';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

const pressableWeb = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : undefined;

export type SearchableSelectOption = {
  id: string | number;
  label: string;
};

type SearchableSelectFieldProps = {
  value: string | null;
  options: SearchableSelectOption[];
  onChange: (label: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  sheetTitle?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
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
      pointerEvents: 'auto',
    },
    sheet: {
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
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
    search: {
      marginBottom: 10,
    },
    list: {
      maxHeight: 280,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 12,
      marginBottom: 4,
    },
    optionActive: {
      backgroundColor: colors.primaryContainer,
    },
    optionText: { fontSize: 14, fontWeight: '700', color: colors.onSurface, flex: 1 },
    optionTextActive: { color: colors.onPrimaryContainer },
    emptyHint: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      paddingVertical: 24,
    },
    closeBtn: {
      marginTop: 12,
      alignItems: 'center',
      paddingVertical: 10,
    },
    closeBtnText: { fontSize: 14, fontWeight: '800', color: colors.onSurfaceVariant },
  });
}

export function SearchableSelectField({
  value,
  options,
  onChange,
  placeholder = 'Выберите',
  searchPlaceholder = 'Поиск…',
  sheetTitle = 'Выбор',
  allowEmpty = true,
  emptyLabel = '—',
}: SearchableSelectFieldProps) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const openPicker = () => {
    setQuery('');
    setOpen(true);
  };

  const select = (label: string | null) => {
    onChange(label);
    setOpen(false);
  };

  const displayValue = value?.trim() || null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={openPicker}
        style={({ pressed }) => [styles.field, pressed && { opacity: 0.92 }, pressableWeb]}
      >
        <Text style={[styles.fieldText, !displayValue && styles.placeholder]} numberOfLines={1}>
          {displayValue || placeholder}
        </Text>
        <MaterialIcons color={colors.onSurfaceVariant} name="arrow-drop-down" size={24} />
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
            <Text style={styles.sheetTitle}>{sheetTitle}</Text>
            <AppTextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={`${colors.onSurfaceVariant}99`}
              style={styles.search}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {allowEmpty ? (
                <Pressable
                  onPress={() => select(null)}
                  style={({ pressed }) => [
                    styles.option,
                    !displayValue && styles.optionActive,
                    pressed && { opacity: 0.85 },
                    pressableWeb,
                  ]}
                >
                  <Text style={[styles.optionText, !displayValue && styles.optionTextActive]}>{emptyLabel}</Text>
                  {!displayValue ? (
                    <MaterialIcons color={colors.onPrimaryContainer} name="check" size={18} />
                  ) : null}
                </Pressable>
              ) : null}
              {filtered.length === 0 ? (
                <Text style={styles.emptyHint}>Ничего не найдено</Text>
              ) : (
                filtered.map((o) => {
                  const active = displayValue === o.label;
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => select(o.label)}
                      style={({ pressed }) => [
                        styles.option,
                        active && styles.optionActive,
                        pressed && { opacity: 0.85 },
                        pressableWeb,
                      ]}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>
                        {o.label}
                      </Text>
                      {active ? <MaterialIcons color={colors.onPrimaryContainer} name="check" size={18} /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Закрыть</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
