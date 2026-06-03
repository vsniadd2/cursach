import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { getJson, postJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { AppTextInput } from '../components/AppTextInput';
import type { MoreStackParamList } from '../navigation/types';
import { useDataSync } from '../data/DataSyncContext';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { formatDateTime } from '../utils/locale';

type FaqItem = { id: string; question: string; answer: string };
type SupportFaqResponse = { items: FaqItem[] };
type SupportTicketItem = {
  id: number;
  subject: string;
  status: string;
  createdAtUtc: string;
  userId: number;
};
type SupportTicketsResponse = { items: SupportTicketItem[] };

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 6 },
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.onSurface,
      marginTop: 8,
      marginBottom: 10,
    },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 14,
      marginBottom: 10,
      gap: 6,
    },
    ticketCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 14,
      marginBottom: 8,
    },
    q: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
    a: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 19 },
    ticketSubject: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
    ticketMeta: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 },
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
    empty: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 8 },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreSupport'>;

export function SupportScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { language } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const auth = useAuth();
  const { invalidate } = useDataSync();
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSupport = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getJson<SupportFaqResponse>(auth, '/support/faq'),
      getJson<SupportTicketsResponse>(auth, '/support/tickets'),
    ])
      .then(([faqRes, ticketsRes]) => {
        if (!alive) return;
        setFaq(faqRes.items ?? []);
        setTickets(ticketsRes.items ?? []);
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
  }, [auth]);

  useAutoRefresh([], loadSupport);

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
      invalidate('audit');
      setMessage('Обращение отправлено.');
      setSubject('');
      setBody('');
      loadSupport();
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

        <Text style={styles.sectionTitle}>Мои обращения</Text>
        {tickets.length === 0 ? <Text style={styles.empty}>Пока нет обращений.</Text> : null}
        {tickets.map((ticket) => (
          <View key={ticket.id} style={styles.ticketCard}>
            <Text style={styles.ticketSubject}>{ticket.subject}</Text>
            <Text style={styles.ticketMeta}>
              {ticket.status} · {formatDateTime(ticket.createdAtUtc, language)}
            </Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>FAQ</Text>
        {faq.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.q}>{item.question}</Text>
            <Text style={styles.a}>{item.answer}</Text>
          </View>
        ))}

        <Text style={styles.label}>Тема обращения</Text>
        <AppTextInput value={subject} onChangeText={setSubject} style={styles.input} placeholder="Проблема с отчётом" placeholderTextColor={`${colors.onSurfaceVariant}99`} />
        <Text style={styles.label}>Описание</Text>
        <AppTextInput
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
