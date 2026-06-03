import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { AppHeader } from '../components/AppHeader';
import { useI18n } from '../i18n/useI18n';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { SUPPORTED_CURRENCIES, type UiThemeMode } from '../theme/palettes';
import type { AppLanguage } from '../utils/locale';

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
    error: { marginTop: 14, color: colors.error, fontWeight: '700', fontSize: 14 },
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
  const { t } = useI18n();
  const { theme, currency, language, profile, updatePreferences, formatMoney, isMeLoading, meError } =
    useAppPreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const bottomPad = 96 + insets.bottom;

  const [saving, setSaving] = useState(false);

  const apply = useCallback(
    async (p: { theme?: UiThemeMode; currency?: string; language?: AppLanguage }) => {
      setSaving(true);
      try {
        await updatePreferences(p);
      } finally {
        setSaving(false);
      }
    },
    [updatePreferences],
  );

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <Text style={styles.sub}>{t('settings.sub')}</Text>
        <Text style={styles.hint}>{t('settings.hint')}</Text>

        {isMeLoading && !profile ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : null}

        <Text style={styles.sectionLabel}>{t('settings.themeSection')}</Text>
        <View style={styles.row}>
          {(['light', 'dark'] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                if (mode !== theme) void apply({ theme: mode });
              }}
              style={[styles.chip, theme === mode && styles.chipActive, saving && { opacity: 0.7 }]}
            >
              <Text style={[styles.chipText, theme === mode && styles.chipTextActive]}>
                {mode === 'light' ? t('settings.themeLight') : t('settings.themeDark')}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t('settings.langSection')}</Text>
        <View style={styles.row}>
          {(
            [
              { id: 'ru' as const, label: t('settings.langRu') },
              { id: 'en' as const, label: t('settings.langEn') },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                if (opt.id !== language) void apply({ language: opt.id });
              }}
              style={[styles.chip, language === opt.id && styles.chipActive, saving && { opacity: 0.7 }]}
            >
              <Text style={[styles.chipText, language === opt.id && styles.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t('settings.currencySection')}</Text>
        <View style={styles.currencyGrid}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                if (c !== currency) void apply({ currency: c });
              }}
              style={[styles.chipGrid, currency === c && styles.chipActive, saving && { opacity: 0.7 }]}
            >
              <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewLabel}>{t('settings.previewLabel')}</Text>
          <Text style={styles.previewCaption}>{t('settings.previewCaption')}</Text>
          <Text style={styles.previewMoney}>{formatMoney(10000)}</Text>
        </View>

        {meError ? <Text style={styles.error}>{meError}</Text> : null}
      </ScrollView>
    </View>
  );
}
