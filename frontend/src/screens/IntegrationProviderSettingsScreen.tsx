import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { getJson, postJson, putJson } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { AppTextInput } from '../components/AppTextInput';
import type { MoreStackParamList } from '../navigation/types';
import { useI18n } from '../i18n/useI18n';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { resolveBillingErrorMessage } from '../utils/billingErrors';
import type { ProviderDetail, ProviderId } from './integrations/types';

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 22, fontWeight: '900', color: colors.onSurface, marginBottom: 16 },
    label: { fontSize: 12, fontWeight: '700', color: colors.onSurfaceVariant, marginTop: 10, marginBottom: 6 },
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
    rowSwitch: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      gap: 12,
    },
    rowSwitchLabel: { flex: 1, fontSize: 13, color: colors.onSurface },
    actions: { gap: 10, marginTop: 24 },
    btn: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    btnSecondary: {
      backgroundColor: `${colors.primary}14`,
      borderWidth: 1,
      borderColor: `${colors.primary}44`,
    },
    btnText: { fontSize: 14, fontWeight: '800', color: colors.onPrimary },
    btnTextSecondary: { color: colors.primary },
    ok: { color: colors.tertiary, fontSize: 13, fontWeight: '700', marginBottom: 8 },
    err: { color: colors.error, fontSize: 13, marginBottom: 8 },
    statusBadge: {
      fontSize: 11,
      color: colors.onSurfaceVariant,
      marginTop: 4,
    },
  });
}

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreIntegrationSettings'>;

export function IntegrationProviderSettingsScreen({ navigation, route }: Props) {
  const provider = route.params.provider;
  const colors = useAppColors();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const auth = useAuth();

  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [configForm, setConfigForm] = useState<Record<string, unknown>>({});
  const [secretsForm, setSecretsForm] = useState<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const providerLabel = (id: ProviderId) => {
    if (id === 'telegram') return t('integrationsScreen.telegram');
    if (id === 'email') return t('integrationsScreen.email');
    return t('integrationsScreen.googleCalendar');
  };

  const loadDetail = useCallback(() => {
    let alive = true;
    setDetailLoading(true);
    getJson<ProviderDetail>(auth, `/integrations/providers/${provider}`)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setConfigForm({ ...(d.config as Record<string, unknown>) });
        setSecretsForm({});
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : t('integrationsScreen.loadError'));
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auth, provider, t]);

  useEffect(() => loadDetail(), [loadDetail]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (window.location.search.includes('gcal=connected') && provider === 'google_calendar') {
      setMessage(t('integrationsScreen.googleConnected'));
      loadDetail();
    }
  }, [provider, t, loadDetail]);

  const setConfigField = (key: string, value: unknown) => {
    setConfigForm((prev) => ({ ...prev, [key]: value }));
  };

  const persistSettings = async () => {
    const secretsPayload: Record<string, string> = {};
    if (provider === 'telegram' && secretsForm.botToken?.trim())
      secretsPayload.botToken = secretsForm.botToken.trim();
    if (provider === 'email' && secretsForm.smtpPassword?.trim())
      secretsPayload.smtpPassword = secretsForm.smtpPassword.trim();

    const body: { config: Record<string, unknown>; secrets?: Record<string, string> } = {
      config: configForm,
    };
    if (Object.keys(secretsPayload).length > 0) body.secrets = secretsPayload;

    const updated = await putJson<ProviderDetail>(auth, `/integrations/providers/${provider}`, body);
    if (updated) {
      setDetail(updated);
      setConfigForm({ ...(updated.config as Record<string, unknown>) });
      setSecretsForm({});
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await persistSettings();
      setMessage(t('integrationsScreen.saved'));
    } catch (e) {
      setError(resolveBillingErrorMessage(e, t));
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      await persistSettings();
      await postJson(auth, `/integrations/providers/${provider}/test`, {});
      setMessage(t('integrationsScreen.testOk'));
    } catch (e) {
      setError(resolveBillingErrorMessage(e, t));
    } finally {
      setTesting(false);
    }
  };

  const connectGoogle = async () => {
    setError(null);
    try {
      const res = await getJson<{ url: string }>(auth, '/integrations/google-calendar/connect');
      if (res.url) await Linking.openURL(res.url);
    } catch (e) {
      setError(resolveBillingErrorMessage(e, t));
    }
  };

  const renderSettings = () => {
    if (detailLoading || !detail) {
      return <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />;
    }

    if (provider === 'telegram') {
      return (
        <>
          <Text style={styles.label}>{t('integrationsScreen.botToken')}</Text>
          <AppTextInput
            style={styles.input}
            placeholder={t('integrationsScreen.botTokenPlaceholder')}
            placeholderTextColor={`${colors.onSurfaceVariant}99`}
            secureTextEntry
            value={secretsForm.botToken ?? ''}
            onChangeText={(v) => setSecretsForm((s) => ({ ...s, botToken: v }))}
          />
          {detail.secrets.hasBotToken ? (
            <Text style={styles.statusBadge}>••••••••</Text>
          ) : null}
          <Text style={styles.label}>{t('integrationsScreen.chatId')}</Text>
          <AppTextInput
            style={styles.input}
            placeholder={t('integrationsScreen.chatIdPlaceholder')}
            placeholderTextColor={`${colors.onSurfaceVariant}99`}
            value={String(configForm.chatId ?? '')}
            onChangeText={(v) => setConfigField('chatId', v)}
          />
          <View style={styles.rowSwitch}>
            <Text style={styles.rowSwitchLabel}>{t('integrationsScreen.notifyDealClosed')}</Text>
            <Switch
              value={Boolean(configForm.notifyDealClosed ?? true)}
              onValueChange={(v) => setConfigField('notifyDealClosed', v)}
            />
          </View>
          <View style={styles.rowSwitch}>
            <Text style={styles.rowSwitchLabel}>{t('integrationsScreen.notifyTaskOverdue')}</Text>
            <Switch
              value={Boolean(configForm.notifyTaskOverdue ?? true)}
              onValueChange={(v) => setConfigField('notifyTaskOverdue', v)}
            />
          </View>
          <View style={styles.rowSwitch}>
            <Text style={styles.rowSwitchLabel}>{t('integrationsScreen.notifyNewClient')}</Text>
            <Switch
              value={Boolean(configForm.notifyNewClient)}
              onValueChange={(v) => setConfigField('notifyNewClient', v)}
            />
          </View>
        </>
      );
    }

    if (provider === 'email') {
      return (
        <>
          <Text style={styles.label}>{t('integrationsScreen.smtpHost')}</Text>
          <AppTextInput
            style={styles.input}
            value={String(configForm.smtpHost ?? '')}
            onChangeText={(v) => setConfigField('smtpHost', v)}
            placeholder="smtp.gmail.com"
            placeholderTextColor={`${colors.onSurfaceVariant}99`}
          />
          <Text style={styles.label}>{t('integrationsScreen.smtpPort')}</Text>
          <AppTextInput
            style={styles.input}
            keyboardType="numeric"
            value={String(configForm.smtpPort ?? 587)}
            onChangeText={(v) => setConfigField('smtpPort', parseInt(v, 10) || 587)}
          />
          <View style={styles.rowSwitch}>
            <Text style={styles.rowSwitchLabel}>{t('integrationsScreen.useSsl')}</Text>
            <Switch
              value={Boolean(configForm.useSsl ?? true)}
              onValueChange={(v) => setConfigField('useSsl', v)}
            />
          </View>
          <Text style={styles.label}>{t('integrationsScreen.smtpUser')}</Text>
          <AppTextInput
            style={styles.input}
            autoCapitalize="none"
            value={String(configForm.smtpUser ?? '')}
            onChangeText={(v) => setConfigField('smtpUser', v)}
          />
          <Text style={styles.label}>{t('integrationsScreen.smtpPassword')}</Text>
          <AppTextInput
            style={styles.input}
            secureTextEntry
            value={secretsForm.smtpPassword ?? ''}
            onChangeText={(v) => setSecretsForm((s) => ({ ...s, smtpPassword: v }))}
          />
          {detail.secrets.hasSmtpPassword ? <Text style={styles.statusBadge}>••••••••</Text> : null}
          <Text style={styles.label}>{t('integrationsScreen.fromEmail')}</Text>
          <AppTextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={String(configForm.fromEmail ?? '')}
            onChangeText={(v) => setConfigField('fromEmail', v)}
          />
          <Text style={styles.label}>{t('integrationsScreen.fromName')}</Text>
          <AppTextInput
            style={styles.input}
            value={String(configForm.fromName ?? '')}
            onChangeText={(v) => setConfigField('fromName', v)}
          />
          <View style={styles.rowSwitch}>
            <Text style={styles.rowSwitchLabel}>{t('integrationsScreen.notifyDealClosed')}</Text>
            <Switch
              value={Boolean(configForm.notifyDealClosed ?? true)}
              onValueChange={(v) => setConfigField('notifyDealClosed', v)}
            />
          </View>
        </>
      );
    }

    return (
      <>
        {detail.secrets.hasGoogleTokens ? (
          <Text style={styles.ok}>
            {t('integrationsScreen.connectedAs')}: {String(configForm.connectedEmail ?? 'Google')}
          </Text>
        ) : (
          <Text style={styles.statusBadge}>{t('integrationsScreen.notConfigured')}</Text>
        )}
        <Pressable style={[styles.btn, styles.btnSecondary, { marginTop: 12 }]} onPress={() => void connectGoogle()}>
          <Text style={[styles.btnText, styles.btnTextSecondary]}>{t('integrationsScreen.connectGoogle')}</Text>
        </Pressable>
        <Text style={styles.label}>{t('integrationsScreen.calendarId')}</Text>
        <AppTextInput
          style={styles.input}
          value={String(configForm.calendarId ?? 'primary')}
          onChangeText={(v) => setConfigField('calendarId', v)}
          placeholder="primary"
          placeholderTextColor={`${colors.onSurfaceVariant}99`}
        />
        <View style={styles.rowSwitch}>
          <Text style={styles.rowSwitchLabel}>{t('integrationsScreen.syncTasks')}</Text>
          <Switch
            value={Boolean(configForm.syncTasks ?? true)}
            onValueChange={(v) => setConfigField('syncTasks', v)}
          />
        </View>
      </>
    );
  };

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>
          {providerLabel(provider)} — {t('integrationsScreen.settings')}
        </Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {message ? <Text style={styles.ok}>{message}</Text> : null}
        {renderSettings()}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, saving && { opacity: 0.7 }]}
            onPress={() => void saveSettings()}
            disabled={saving || testing || detailLoading}
          >
            <Text style={styles.btnText}>{saving ? '…' : t('integrationsScreen.save')}</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnSecondary, (saving || testing) && { opacity: 0.7 }]}
            onPress={() => void runTest()}
            disabled={saving || testing || detailLoading}
          >
            <Text style={[styles.btnText, styles.btnTextSecondary]}>
              {testing ? '…' : t('integrationsScreen.test')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
