import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { useAuth } from '../auth/AuthContext';
import { deleteJson, getJson, postJson, putJson } from '../api/requests';
import type { ClientsListResponse, DealStage } from '../api/types';
import { AppHeader } from '../components/AppHeader';
import { AppTextInput } from '../components/AppTextInput';
import { DatePickerField } from '../components/DatePickerField';
import type { DealsStackParamList } from '../navigation/types';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useDataSync } from '../data/DataSyncContext';
import { useAppColors, useDealStageLabel } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

type Props = {
  navigation: NativeStackNavigationProp<DealsStackParamList, 'DealEdit'>;
  route: RouteProp<DealsStackParamList, 'DealEdit'>;
};

type DealDetail = {
  id: number;
  clientId: number;
  title: string;
  stage: DealStage;
  amount: number;
  probabilityPct: number;
  expectedCloseDateUtc: string | null;
  decisionMaker: string | null;
};

export function DealEditScreen({ navigation, route }: Props) {
  const colors = useAppColors();
  const stageLabel = useDealStageLabel();
  const styles = useMemo(() => createDealEditStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const bottomPad = 120 + insets.bottom;
  const auth = useAuth();
  const { invalidate } = useDataSync();

  const dealId =
    typeof route.params?.dealId === 'number' && Number.isFinite(route.params.dealId) && route.params.dealId > 0
      ? route.params.dealId
      : undefined;
  const isEdit = dealId != null;

  const [clients, setClients] = useState<ClientsListResponse | null>(null);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientId, setClientId] = useState<number | null>(() => {
    const fromRoute = route.params?.clientId;
    return typeof fromRoute === 'number' && Number.isFinite(fromRoute) && fromRoute > 0 ? fromRoute : null;
  });
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<DealStage>('Lead');
  const [amount, setAmount] = useState('0');
  const [prob, setProb] = useState('25');
  const [decisionMaker, setDecisionMaker] = useState('');
  const [expectedClose, setExpectedClose] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientLabel = useMemo(() => {
    if (clientId == null) {
      if (clientsLoading) return 'Загрузка…';
      if (!clients?.items.length) return 'Нет клиентов — добавьте в разделе «Клиенты»';
      return 'Выберите клиента';
    }
    const c = clients?.items.find((x) => x.id === clientId);
    return c ? `${c.fullName} — ${c.company}` : `Клиент #${clientId}`;
  }, [clientId, clients?.items, clientsLoading]);

  useEffect(() => {
    let alive = true;
    setClientsLoading(true);
    getJson<ClientsListResponse>(auth, '/clients?pageSize=100')
      .then((d) => {
        if (!alive) return;
        setClients(d);
        const routeClientId = route.params?.clientId;
        const fromRoute =
          typeof routeClientId === 'number' && Number.isFinite(routeClientId) && routeClientId > 0
            ? routeClientId
            : null;
        setClientId((current) => {
          if (fromRoute && d.items.some((c) => c.id === fromRoute)) return fromRoute;
          if (current != null && d.items.some((c) => c.id === current)) return current;
          return d.items[0]?.id ?? null;
        });
      })
      .catch(() => {
        if (!alive) return;
        setClients(null);
        setClientId(null);
      })
      .finally(() => {
        if (alive) setClientsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auth, route.params?.clientId]);

  const loadDeal = useCallback(() => {
    if (!isEdit || dealId == null) return;
    let alive = true;
    setLoading(true);
    setError(null);
    getJson<{ deal: DealDetail }>(auth, `/deals/${dealId}`)
      .then((d) => {
        if (!alive) return;
        const deal = (d as any).deal ?? d;
        setClientId(deal.clientId);
        setTitle(deal.title ?? '');
        setStage(deal.stage ?? 'Lead');
        setAmount(String(deal.amount ?? 0));
        setProb(String(deal.probabilityPct ?? 25));
        setDecisionMaker(deal.decisionMaker ?? '');
        setExpectedClose(deal.expectedCloseDateUtc ? String(deal.expectedCloseDateUtc).slice(0, 10) : '');
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
  }, [auth, dealId, isEdit]);

  useAutoRefresh(['deals'], loadDeal);

  const onSave = async () => {
    if (loading) return;
    setError(null);

    const payload = {
      clientId,
      title: title.trim(),
      stage,
      amount: Number(amount) || 0,
      probabilityPct: Math.max(0, Math.min(100, Number(prob) || 0)),
      expectedCloseDateUtc: expectedClose ? `${expectedClose}T12:00:00.000Z` : null,
      decisionMaker: decisionMaker.trim() || null,
    };

    if (!payload.title) return setError('Введите название');
    const selectedClientId = clientId;
    if (selectedClientId == null || !clients?.items.some((c) => c.id === selectedClientId)) {
      return setError(
        clients?.items.length ? 'Выберите клиента' : 'Сначала добавьте клиента в разделе «Клиенты»',
      );
    }

    const body = { ...payload, clientId: selectedClientId };

    setLoading(true);
    try {
      if (isEdit) {
        await putJson<null>(auth, `/deals/${dealId}`, body);
      } else {
        await postJson<{ id: number }>(auth, '/deals', body);
      }
      invalidate('deals', 'clients', 'dashboard', 'reports', 'audit');
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!isEdit || loading) return;
    Alert.alert('Удалить сделку?', title || `#${dealId}`, [
      { text: 'Отмена' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await deleteJson(auth, `/deals/${dealId}`);
            invalidate('deals', 'clients', 'dashboard', 'reports', 'audit');
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
        <Text style={styles.title}>{isEdit ? 'Редактировать сделку' : 'Новая сделка'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Клиент</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const items = clients?.items ?? [];
            if (items.length === 0) {
              Alert.alert('Клиенты', 'Сначала добавьте клиента в разделе «Клиенты».');
              return;
            }
            Alert.alert('Выбор клиента', clientLabel, [
              { text: 'Отмена' },
              ...items.slice(0, 8).map((c) => ({
                text: `${c.fullName} — ${c.company}`,
                onPress: () => setClientId(c.id),
              })),
            ]);
          }}
          style={({ pressed }) => [styles.picker, pressed && { opacity: 0.92 }]}
        >
          <Text style={styles.pickerText}>{clientLabel}</Text>
        </Pressable>

        <Text style={styles.label}>Название</Text>
        <AppTextInput value={title} onChangeText={setTitle} placeholder="Коммерческое предложение" placeholderTextColor={`${colors.onSurfaceVariant}99`} style={styles.input} />

        <Text style={styles.label}>Стадия</Text>
        <View style={styles.stageRow}>
          {(['Lead', 'Negotiation', 'Closed'] as const).map((s) => {
            const active = stage === s;
            return (
              <Pressable key={s} onPress={() => setStage(s)} style={[styles.stagePill, active && styles.stagePillActive]}>
                <Text style={[styles.stageText, active && styles.stageTextActive]}>{stageLabel(s)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Сумма (USD)</Text>
        <Text style={styles.inputHint}>В списках и карточках сумма показывается в валюте профиля, пересчитанная от USD.</Text>
        <AppTextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={styles.input} />

        <Text style={styles.label}>Вероятность (%)</Text>
        <AppTextInput value={prob} onChangeText={setProb} keyboardType="numeric" style={styles.input} />

        <Text style={styles.label}>Ожидаемая дата закрытия</Text>
        <DatePickerField value={expectedClose} onChange={setExpectedClose} placeholder="Выберите дату" />

        <Text style={styles.label}>ЛПР</Text>
        <AppTextInput value={decisionMaker} onChangeText={setDecisionMaker} placeholder="Иван И." placeholderTextColor={`${colors.onSurfaceVariant}99`} style={styles.input} />

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

function createDealEditStyles(colors: AppPalette) {
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
  inputHint: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: -4,
    marginBottom: 10,
    lineHeight: 16,
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
  picker: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}22`,
  },
  pickerText: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  stageRow: { flexDirection: 'row', gap: 10 },
  stagePill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}22`,
  },
  stagePillActive: { backgroundColor: colors.primaryContainer, borderColor: `${colors.primary}33` },
  stageText: { fontSize: 12, fontWeight: '800', color: colors.onSurfaceVariant },
  stageTextActive: { color: colors.onPrimaryContainer },
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

