import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { useAuth } from '../auth/AuthContext';
import { deleteJson, getJson, postJson, putJson } from '../api/requests';
import type { ClientDetailResponse } from '../api/types';
import { AppHeader } from '../components/AppHeader';
import { AppTextInput } from '../components/AppTextInput';
import { APP_EMAIL_DOMAIN } from '../constants/brand';
import type { ClientsStackParamList } from '../navigation/types';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useDataSync } from '../data/DataSyncContext';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { resolveBillingErrorMessage } from '../utils/billingErrors';
import { useI18n } from '../i18n/useI18n';

type Props = {
  navigation: NativeStackNavigationProp<ClientsStackParamList, 'ClientEdit'>;
  route: RouteProp<ClientsStackParamList, 'ClientEdit'>;
};

export function ClientEditScreen({ navigation, route }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createClientEditStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const bottomPad = 120 + insets.bottom;
  const auth = useAuth();
  const { invalidate } = useDataSync();
  const { t } = useI18n();

  const clientId = route.params?.clientId;
  const isEdit = typeof clientId === 'number';

  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [avatarSmallUrl, setAvatarSmallUrl] = useState('');
  const [avatarLargeUrl, setAvatarLargeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClient = useCallback(() => {
    if (!isEdit || typeof clientId !== 'number') return;
    let alive = true;
    setError(null);
    setLoading(true);
    getJson<ClientDetailResponse>(auth, `/clients/${clientId}`)
      .then((d) => {
        if (!alive) return;
        setFullName(d.client.fullName ?? '');
        setCompany(d.client.company ?? '');
        setRoleTitle(d.client.roleTitle ?? '');
        setPhone(d.client.phone ?? '');
        setWorkEmail(d.client.workEmail ?? '');
        setAvatarSmallUrl(d.client.avatarSmallUrl ?? '');
        setAvatarLargeUrl(d.client.avatarLargeUrl ?? '');
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
  }, [auth, clientId, isEdit]);

  useAutoRefresh(['clients'], loadClient);

  const onSave = async () => {
    if (loading) return;
    setError(null);
    const payload = {
      fullName: fullName.trim(),
      company: company.trim(),
      roleTitle: roleTitle.trim() || null,
      phone: phone.trim() || null,
      workEmail: workEmail.trim() || null,
      avatarSmallUrl: avatarSmallUrl.trim() || null,
      avatarLargeUrl: avatarLargeUrl.trim() || null,
    };
    if (!payload.fullName) return setError('Введите ФИО');
    if (!payload.company) return setError('Введите компанию');

    setLoading(true);
    try {
      if (isEdit) {
        await putJson<null>(auth, `/clients/${clientId}`, payload);
        invalidate('clients', 'dashboard', 'deals', 'audit');
        navigation.replace('ClientDetail', { clientId: clientId! });
      } else {
        const created = await postJson<{ id: number }>(auth, '/clients', payload);
        invalidate('clients', 'dashboard', 'deals', 'audit');
        navigation.replace('ClientDetail', { clientId: created.id });
      }
    } catch (e) {
      setError(resolveBillingErrorMessage(e, t));
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!isEdit || loading) return;
    Alert.alert('Удалить клиента?', 'Будут удалены связанные сделки и события.', [
      { text: 'Отмена' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await deleteJson(auth, `/clients/${clientId}`);
            invalidate('clients', 'dashboard', 'deals', 'audit');
            navigation.popToTop();
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
        <Text style={styles.title}>{isEdit ? 'Редактировать клиента' : 'Новый клиент'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && !fullName && isEdit ? <Text style={styles.muted}>Загрузка…</Text> : null}

        <Text style={styles.label}>ФИО</Text>
        <AppTextInput value={fullName} onChangeText={setFullName} placeholder="Иван Иванов" placeholderTextColor={`${colors.onSurfaceVariant}99`} style={styles.input} />

        <Text style={styles.label}>Компания</Text>
        <AppTextInput value={company} onChangeText={setCompany} placeholder="Acme Corp" placeholderTextColor={`${colors.onSurfaceVariant}99`} style={styles.input} />

        <Text style={styles.label}>Должность</Text>
        <AppTextInput value={roleTitle} onChangeText={setRoleTitle} placeholder="Менеджер" placeholderTextColor={`${colors.onSurfaceVariant}99`} style={styles.input} />

        <Text style={styles.label}>Телефон</Text>
        <AppTextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+375 29 123-45-67"
          placeholderTextColor={`${colors.onSurfaceVariant}99`}
          keyboardType="phone-pad"
          style={styles.input}
        />

        <Text style={styles.label}>Рабочая почта</Text>
        <AppTextInput
          value={workEmail}
          onChangeText={setWorkEmail}
          placeholder={`name@${APP_EMAIL_DOMAIN}`}
          placeholderTextColor={`${colors.onSurfaceVariant}99`}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

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

function createClientEditStyles(colors: AppPalette) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: 24, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '900', color: colors.onSurface, marginBottom: 10 },
  error: { color: colors.error, fontWeight: '700', marginBottom: 10 },
  muted: { color: colors.onSurfaceVariant, marginBottom: 10 },
  label: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
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

