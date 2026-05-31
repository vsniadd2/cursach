import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getJson, postJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

type FaqItem = { id: string; question: string; answer: string };
type SupportFaqResponse = { items: FaqItem[] };

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 6 },
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 14,
      marginBottom: 10,
      gap: 6,
    },
    q: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
    a: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 19 },
    label: { fontSize: 12, fontWeight: '700', color: colors.onSurfaceVariant, marginTop: 8, marginBottom: 6 },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}33`,
      backgroundColor: colors.surfaceContainerLow,
      color: colors.onSurface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    submit: {
      marginTop: 12,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    submitText: { color: colors.onPrimary, fontWeight: '800', fontSize: 15 },
    ok: { marginTop: 8, color: colors.tertiary, fontWeight: '700' },
    err: { marginTop: 8, color: colors.error, fontWeight: '700' },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreSupport'>;

export function SupportScreen({ navigation }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getJson<SupportFaqResponse>(auth, '/support/faq')
      .then((d) => {
        if (!alive) return;
        setFaq(d.items ?? []);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки FAQ');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const onSubmit = async () => {
    setError(null);
    setMessage(null);
    if (!subject.trim() || !body.trim()) {
      setError('Заполните тему и описание.');
      return;
    }
    setSaving(true);
    try {
      await postJson(auth, '/support/tickets', { subject: subject.trim(), body: body.trim() });
      setMessage('Обращение отправлено.');
      setSubject('');
      setBody('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 + insets.bottom }]}>
        <Text style={styles.title}>Помощь и поддержка</Text>
        <Text style={styles.sub}>FAQ и отправка обращения в поддержку.</Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {faq.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.q}>{item.question}</Text>
            <Text style={styles.a}>{item.answer}</Text>
          </View>
        ))}

        <Text style={styles.label}>Тема обращения</Text>
        <TextInput value={subject} onChangeText={setSubject} style={styles.input} placeholder="Проблема с отчётом" placeholderTextColor={`${colors.onSurfaceVariant}99`} />
        <Text style={styles.label}>Описание</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          style={[styles.input, { minHeight: 90 }]}
          multiline
          placeholder="Опишите проблему подробно"
          placeholderTextColor={`${colors.onSurfaceVariant}99`}
        />
        <Pressable onPress={() => void onSubmit()} style={({ pressed }) => [styles.submit, pressed && { opacity: 0.9 }]}>
          <Text style={styles.submitText}>{saving ? 'Отправка…' : 'Отправить'}</Text>
        </Pressable>
        {message ? <Text style={styles.ok}>{message}</Text> : null}
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}
