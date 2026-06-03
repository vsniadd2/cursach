import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { ApiError, getJson, postAiAdvisorStream, postJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { AppTextInput } from '../components/AppTextInput';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors, useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import type { MessageKey } from '../i18n/messages';
import { useI18n } from '../i18n/useI18n';
import { resolveBillingErrorMessage } from '../utils/billingErrors';

type AdvisorContext = {
  totalDeals: number;
  closedDeals: number;
  conversionPct: number;
  monthRevenueUsd: number;
  overdueTasks: number;
  clientCount: number;
  openTasks: number;
};

type AiSession = {
  id: string;
  title: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  preview?: string | null;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type SessionsResponse = { items: AiSession[] };
type SessionDetailResponse = {
  session: AiSession;
  messages: { id: number; role: string; content: string; createdAtUtc: string }[];
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 6 },
    sub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    kpi: {
      minWidth: '47%',
      flexGrow: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      backgroundColor: colors.surfaceContainerLowest,
      padding: 12,
    },
    kpiLabel: { fontSize: 11, color: colors.onSurfaceVariant, marginBottom: 4 },
    kpiValue: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: `${colors.primary}14`,
      borderWidth: 1,
      borderColor: `${colors.primary}33`,
    },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    analysisBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 16,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    analysisBtnDisabled: { opacity: 0.7 },
    analysisBtnText: { fontSize: 14, fontWeight: '800', color: colors.onPrimary },
    chat: { gap: 10, marginBottom: 16 },
    bubbleUser: {
      alignSelf: 'flex-end',
      maxWidth: '92%',
      backgroundColor: colors.primary,
      borderRadius: 16,
      borderBottomRightRadius: 4,
      padding: 12,
    },
    bubbleAssistant: {
      alignSelf: 'flex-start',
      maxWidth: '92%',
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      padding: 12,
    },
    bubbleRole: { fontSize: 10, fontWeight: '700', marginBottom: 4, opacity: 0.75 },
    bubbleUserRole: { color: colors.onPrimary },
    bubbleAssistantRole: { color: colors.onSurfaceVariant },
    bubbleUserText: { fontSize: 14, color: colors.onPrimary, lineHeight: 20 },
    bubbleAssistantText: { fontSize: 14, color: colors.onSurface, lineHeight: 20 },
    emptyChat: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      fontStyle: 'italic',
      marginBottom: 8,
    },
    composerWrap: {
      paddingHorizontal: 24,
      paddingTop: 10,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: `${colors.outlineVariant}33`,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}33`,
      backgroundColor: colors.surfaceContainerLow,
      color: colors.onSurface,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      lineHeight: 20,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },
    sessionBar: { marginBottom: 14 },
    sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sessionList: { flexGrow: 1, flexShrink: 1 },
    sessionChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}33`,
      backgroundColor: colors.surfaceContainerLow,
      maxWidth: 160,
    },
    sessionChipActive: {
      borderColor: `${colors.primary}55`,
      backgroundColor: `${colors.primary}14`,
    },
    sessionChipTitle: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
    sessionChipTitleActive: { color: colors.primary },
    newSessionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: `${colors.primary}44`,
      backgroundColor: `${colors.primary}10`,
    },
    newSessionBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  });
}

function mapApiMessages(
  rows: SessionDetailResponse['messages'],
): ChatMessage[] {
  return rows.map((m) => ({
    id: String(m.id),
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));
}

function resolveChatError(error: unknown, t: (key: MessageKey) => string): string {
  if (error instanceof ApiError) {
    if (error.code === 'ai.not_configured') return t('aiAdvisorScreen.notConfigured');
    if (error.code === 'ai.permission_denied' || error.code === 'ai.invalid_key')
      return t('aiAdvisorScreen.permissionDenied');
    const billing = resolveBillingErrorMessage(error, t);
    if (billing !== (error.message || '')) return billing;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return t('aiAdvisorScreen.chatError');
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreAiAdvisor'>;

export function AiAdvisorScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const tabBarPad = 90 + insets.bottom;
  const auth = useAuth();
  const { formatMoney } = useAppPreferences();
  const scrollRef = useRef<ScrollView>(null);

  const [context, setContext] = useState<AdvisorContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const loadContext = useCallback(() => {
    let alive = true;
    setContextLoading(true);
    setContextError(null);
    getJson<AdvisorContext>(auth, '/ai/advisor/context')
      .then((d) => {
        if (!alive) return;
        setContext(d);
      })
      .catch((e) => {
        if (!alive) return;
        setContextError(resolveBillingErrorMessage(e, t));
      })
      .finally(() => {
        if (!alive) return;
        setContextLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auth, t]);

  useEffect(() => loadContext(), [loadContext]);

  const refreshSessions = useCallback(async () => {
    const data = await getJson<SessionsResponse>(auth, '/ai/advisor/sessions');
    setSessions(data.items ?? []);
    return data.items ?? [];
  }, [auth]);

  const loadSessionMessages = useCallback(
    async (id: string) => {
      const data = await getJson<SessionDetailResponse>(auth, `/ai/advisor/sessions/${id}`);
      setSessionId(id);
      setMessages(mapApiMessages(data.messages ?? []));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 0);
    },
    [auth],
  );

  const createNewSession = useCallback(async () => {
    const created = await postJson<AiSession>(auth, '/ai/advisor/sessions', {
      title: t('aiAdvisorScreen.newSession'),
    });
    setSessions((prev) => [created, ...prev]);
    setSessionId(created.id);
    setMessages([]);
    setChatError(null);
    setDraft('');
  }, [auth, t]);

  useEffect(() => {
    let alive = true;
    setSessionsLoading(true);
    setSessionsError(null);
    (async () => {
      try {
        const items = await refreshSessions();
        if (!alive) return;
        if (items.length === 0) {
          const created = await postJson<AiSession>(auth, '/ai/advisor/sessions', {
            title: t('aiAdvisorScreen.newSession'),
          });
          if (!alive) return;
          setSessions([created]);
          setSessionId(created.id);
          setMessages([]);
          return;
        }
        const data = await getJson<SessionDetailResponse>(auth, `/ai/advisor/sessions/${items[0].id}`);
        if (!alive) return;
        setSessionId(items[0].id);
        setMessages(mapApiMessages(data.messages ?? []));
      } catch (e) {
        if (!alive) return;
        setSessionsError(e instanceof Error ? e.message : t('aiAdvisorScreen.sessionsLoadError'));
      } finally {
        if (alive) setSessionsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [auth, refreshSessions, t]);

  const sendChat = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || chatLoading || !sessionId) return;

    setChatError(null);
    setChatLoading(true);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    const assistantId = `a-${Date.now()}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    };
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setDraft('');

    try {
      await postAiAdvisorStream(
        auth,
        '/ai/advisor/chat',
        { sessionId, message: trimmed },
        (text) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m)),
          );
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 0);
        },
      );
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      try {
        const items = await refreshSessions();
        setSessions(items);
      } catch {
        // ignore list refresh errors
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id));
      setChatError(resolveChatError(e, t));
      try {
        await loadSessionMessages(sessionId);
      } catch {
        // ignore
      }
    } finally {
      setChatLoading(false);
    }
  };

  const chips = [
    t('aiAdvisorScreen.chipConversion'),
    t('aiAdvisorScreen.chipOverdue'),
    t('aiAdvisorScreen.chipRevenue'),
  ];

  const submitDraft = useCallback(() => {
    if (draft.trim() && !chatLoading && sessionId) void sendChat(draft);
  }, [draft, chatLoading, sessionId, messages, auth, t]);

  const onComposerKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS !== 'web' || e.nativeEvent.key !== 'Enter') return;
      const ev = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
      if (ev.shiftKey) return;
      e.preventDefault();
      submitDraft();
    },
    [submitDraft],
  );

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: 16 }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <Text style={styles.title}>{t('more.aiAdvisor')}</Text>
        <Text style={styles.sub}>{t('more.aiAdvisorDesc')}</Text>

        <View style={styles.sessionBar}>
          <View style={styles.sessionRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.sessionList}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}
            >
              {sessions.map((s) => {
                const active = s.id === sessionId;
                return (
                  <Pressable
                    key={s.id}
                    style={[styles.sessionChip, active && styles.sessionChipActive]}
                    onPress={() => {
                      if (s.id === sessionId || chatLoading) return;
                      void loadSessionMessages(s.id).catch((e) =>
                        setChatError(e instanceof Error ? e.message : t('aiAdvisorScreen.sessionsLoadError')),
                      );
                    }}
                    disabled={chatLoading || sessionsLoading}
                  >
                    <Text
                      style={[styles.sessionChipTitle, active && styles.sessionChipTitleActive]}
                      numberOfLines={1}
                    >
                      {s.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              style={styles.newSessionBtn}
              onPress={() => void createNewSession().catch((e) =>
                setChatError(e instanceof Error ? e.message : t('aiAdvisorScreen.sessionsLoadError')),
              )}
              disabled={chatLoading || sessionsLoading}
              accessibilityRole="button"
              accessibilityLabel={t('aiAdvisorScreen.newSession')}
            >
              <MaterialIcons name="add" size={18} color={colors.primary} />
              <Text style={styles.newSessionBtnText}>{t('aiAdvisorScreen.newSession')}</Text>
            </Pressable>
          </View>
        </View>

        {sessionsLoading ? <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} /> : null}
        {sessionsError ? <Text style={styles.err}>{sessionsError}</Text> : null}
        {contextError ? <Text style={styles.err}>{contextError}</Text> : null}
        {chatError ? <Text style={styles.err}>{chatError}</Text> : null}

        {contextLoading ? <ActivityIndicator color={colors.primary} style={{ marginBottom: 16 }} /> : null}
        {context ? (
          <View style={styles.grid}>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>{t('aiAdvisorScreen.kpiDeals')}</Text>
              <Text style={styles.kpiValue}>
                {context.closedDeals}/{context.totalDeals}
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>{t('aiAdvisorScreen.kpiConversion')}</Text>
              <Text style={styles.kpiValue}>{context.conversionPct}%</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>{t('aiAdvisorScreen.kpiRevenue')}</Text>
              <Text style={styles.kpiValue}>{formatMoney(context.monthRevenueUsd)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>{t('aiAdvisorScreen.kpiOverdue')}</Text>
              <Text style={styles.kpiValue}>{context.overdueTasks}</Text>
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.analysisBtn, chatLoading && styles.analysisBtnDisabled]}
          onPress={() => void sendChat(t('aiAdvisorScreen.getAnalysis'))}
          disabled={chatLoading || contextLoading || sessionsLoading || !sessionId}
          accessibilityRole="button"
        >
          {chatLoading ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <MaterialIcons name="auto-awesome" size={22} color={colors.onPrimary} />
          )}
          <Text style={styles.analysisBtnText}>
            {chatLoading ? t('aiAdvisorScreen.analyzing') : t('aiAdvisorScreen.getAnalysis')}
          </Text>
        </Pressable>

        <View style={styles.chips}>
          {chips.map((label) => (
            <Pressable
              key={label}
              style={styles.chip}
              onPress={() => void sendChat(label)}
              disabled={chatLoading || !sessionId}
            >
              <Text style={styles.chipText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {messages.length === 0 ? (
          <Text style={styles.emptyChat}>{t('aiAdvisorScreen.emptyChat')}</Text>
        ) : null}

        <View style={styles.chat}>
          {messages.map((m) =>
            m.role === 'user' ? (
              <View key={m.id} style={styles.bubbleUser}>
                <Text style={[styles.bubbleRole, styles.bubbleUserRole]}>{t('aiAdvisorScreen.you')}</Text>
                <Text style={styles.bubbleUserText}>{m.content}</Text>
              </View>
            ) : (
              <View key={m.id} style={styles.bubbleAssistant}>
                <Text style={[styles.bubbleRole, styles.bubbleAssistantRole]}>
                  {t('aiAdvisorScreen.assistant')}
                </Text>
                <Text style={styles.bubbleAssistantText}>
                  {m.content || (chatLoading ? t('aiAdvisorScreen.analyzing') : '')}
                </Text>
              </View>
            ),
          )}
        </View>
      </ScrollView>

      <View style={[styles.composerWrap, { paddingBottom: tabBarPad }]}>
        <View style={styles.composer}>
          <AppTextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('aiAdvisorScreen.placeholder')}
            placeholderTextColor={`${colors.onSurfaceVariant}99`}
            multiline
            returnKey="send"
            enterKeyHint="send"
            submitBehavior="submit"
            onSubmitEditing={submitDraft}
            onKeyPress={onComposerKeyPress}
            editable={!chatLoading}
          />
          <Pressable
            style={[styles.sendBtn, (!draft.trim() || chatLoading) && styles.sendBtnDisabled]}
            onPress={() => void sendChat(draft)}
            disabled={!draft.trim() || chatLoading || !sessionId}
            accessibilityRole="button"
            accessibilityLabel={t('aiAdvisorScreen.send')}
          >
            <MaterialIcons name="send" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
