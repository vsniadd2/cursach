import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '../components/AppHeader';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

type Props = NativeStackScreenProps<MoreStackParamList, 'MorePlaceholder'>;

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    content: {
      paddingHorizontal: 24,
      paddingTop: 10,
    },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}30`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 18,
      gap: 10,
    },
    title: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.onSurface,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 15,
      color: colors.onSurfaceVariant,
      lineHeight: 21,
    },
    note: {
      marginTop: 8,
      fontSize: 13,
      color: colors.outline,
      lineHeight: 19,
    },
  });
}

export function MorePlaceholderScreen({ navigation, route }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bottomPad = 96 + insets.bottom;
  const { title, description } = route.params;

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{description}</Text>
          <Text style={styles.note}>
            Этот раздел оформлен как отдельный экран для демонстрации законченной навигации CRM.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
