import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '../components/AppHeader';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { SUPPORTED_CURRENCIES, type UiThemeMode } from '../theme/palettes';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreSettings'>;

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    content: { paddingHorizontal: 24, paddingTop: 10 },
    title: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.onSurface,
      letterSpacing: -0.4,
      marginBottom: 8,
    },
    sub: { fontSize: 14, color: colors.onSurfaceVariant, marginBottom: 10 },
    hint: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      lineHeight: 17,
      marginBottom: 22,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 10,
    },
    row: { flexDirection: 'row', gap: 10, marginBottom: 22 },
    currencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 22,
    },
    chip: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}44`,
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerLowest,
    },
    chipGrid: {
      flex: 0,
      flexGrow: 0,
      flexShrink: 0,
      width: '31%',
      minWidth: 96,
      maxWidth: '33%',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}44`,
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerLowest,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}12`,
    },
    chipText: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
    chipTextActive: { color: colors.primary },
    saveBtn: {
      marginTop: 8,
      height: 52,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { fontSize: 16, fontWeight: '900', color: colors.onPrimary },
    error: { marginTop: 14, color: colors.error, fontWeight: '700', fontSize: 14 },
    ok: { marginTop: 14, color: colors.tertiary, fontWeight: '700', fontSize: 14 },
    preview: {
      marginTop: 20,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}33`,
      backgroundColor: colors.surfaceContainerLow,
    },
    previewLabel: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 4 },
    previewCaption: { fontSize: 11, color: colors.onSurfaceVariant, marginBottom: 6, opacity: 0.9 },
    previewMoney: { fontSize: 20, fontWeight: '900', color: colors.onSurface },
  });
}

export function SettingsScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { theme, currency, profile, updatePreferences, formatMoney, isMeLoading } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bottomPad = 96 + insets.bottom;

  const [draftTheme, setDraftTheme] = useState<UiThemeMode>(theme);
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    setDraftTheme(theme);
    setDraftCurrency(currency);
  }, [theme, currency]);

  const onSave = useCallback(async () => {
    setLocalError(null);
    setSavedOk(false);
    setSaving(true);
    try {
      const ok = await updatePreferences({ theme: draftTheme, currency: draftCurrency });
      if (ok) setSavedOk(true);
      else setLocalError('Сервер отклонил сохранение');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }, [draftCurrency, draftTheme, updatePreferences]);

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <Text style={styles.title}>Настройки</Text>
        <Text style={styles.sub}>
          Тема и валюта сохраняются в вашем профиле на сервере и применяются на всех экранах.
        </Text>
        <Text style={styles.hint}>
          Суммы сделок и аналитика в базе хранятся в USD; в интерфейсе показываются в выбранной валюте по
          демонстрационному курсу к доллару (без онлайн-подгрузки курсов).
        </Text>

        {isMeLoading && !profile ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : null}

        <Text style={styles.sectionLabel}>Тема оформления</Text>
        <View style={styles.row}>
          {(['light', 'dark'] as const).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              onPress={() => setDraftTheme(t)}
              style={[styles.chip, draftTheme === t && styles.chipActive]}
            >
              <Text style={[styles.chipText, draftTheme === t && styles.chipTextActive]}>
                {t === 'light' ? 'Светлая' : 'Тёмная'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Валюта отображения</Text>
        <View style={styles.currencyGrid}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              onPress={() => setDraftCurrency(c)}
              style={[styles.chipGrid, draftCurrency === c && styles.chipActive]}
            >
              <Text style={[styles.chipText, draftCurrency === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Пересчёт из USD</Text>
          <Text style={styles.previewCaption}>эквивалент 10 000 USD в выбранной валюте</Text>
          <Text style={styles.previewMoney}>{formatMoney(10000)}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void onSave()}
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.saveText}>Сохранить</Text>
          )}
        </Pressable>

        {localError ? <Text style={styles.error}>{localError}</Text> : null}
        {savedOk && !localError ? <Text style={styles.ok}>Сохранено</Text> : null}
      </ScrollView>
    </View>
  );
}
