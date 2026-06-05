import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppSafeAreaInsets } from '../web/useAppSafeAreaInsets';

import { deleteJson, downloadBlob, getJson, ApiError } from '../api/requests';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { useDataSync } from '../data/DataSyncContext';
import { useAutoRefresh } from '../data/useAutoRefresh';
import { useI18n } from '../i18n/useI18n';
import type { MoreStackParamList } from '../navigation/types';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { confirmAsync } from '../utils/appAlerts';
import { resolveBillingErrorMessage } from '../utils/billingErrors';
import { formatDate } from '../utils/locale';
import { apiUrl } from '../api/client';

type CloudFile = {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAtUtc: string;
};

type CloudStorageResponse = {
  quota: {
    storageGbPerSeat: number;
    activeSeats: number;
    storageGbTotalLimit: number;
    storageGbUsed: number;
    limitBytes: number;
    usedBytes: number;
  };
  items: CloudFile[];
};

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreCloudStorage'>;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    title: { fontSize: 26, fontWeight: '900', color: colors.onSurface, marginBottom: 6 },
    sub: { fontSize: 14, color: colors.onSurfaceVariant, marginBottom: 16, lineHeight: 20 },
    err: { color: colors.error, fontWeight: '700', marginBottom: 12 },
    quotaCard: {
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}22`,
      marginBottom: 16,
    },
    quotaTitle: { fontSize: 13, fontWeight: '800', color: colors.onSurfaceVariant, marginBottom: 8 },
    quotaValue: { fontSize: 18, fontWeight: '900', color: colors.onSurface, marginBottom: 4 },
    quotaMeta: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 10 },
    quotaTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: `${colors.outlineVariant}33`,
      overflow: 'hidden',
    },
    quotaFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
    uploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 14,
      marginBottom: 16,
    },
    uploadBtnDisabled: { opacity: 0.55 },
    uploadBtnText: { color: colors.onPrimary, fontWeight: '800', fontSize: 15 },
    list: { gap: 10 },
    fileCard: {
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: `${colors.outlineVariant}18`,
    },
    fileTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    fileIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.primary}18`,
    },
    fileName: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.onSurface },
    fileMeta: { marginTop: 4, fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 18 },
    fileActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.surfaceContainerLow,
    },
    actionBtnDanger: { backgroundColor: `${colors.error}14` },
    actionText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    actionTextDanger: { color: colors.error },
    empty: { textAlign: 'center', color: colors.onSurfaceVariant, marginTop: 24, lineHeight: 20 },
  });
}

export function CloudStorageScreen({ navigation }: Props) {
  const colors = useAppColors();
  const { t, language } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useAppSafeAreaInsets();
  const auth = useAuth();
  const { invalidate } = useDataSync();

  const [data, setData] = useState<CloudStorageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getJson<CloudStorageResponse>(auth, '/cloud-storage')
      .then((d) => {
        if (!alive) return;
        setData(d);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : t('common.loadError'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auth, t]);

  useAutoRefresh(['billing'], load);

  const quota = data?.quota;
  const usagePct =
    quota && quota.limitBytes > 0 ? Math.min(100, (quota.usedBytes / quota.limitBytes) * 100) : 0;

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append('file', file, file.name);
        const res = await auth.fetchWithAuth(apiUrl('/cloud-storage/upload'), {
          method: 'POST',
          body: form,
        });
        if (res.status === 401) throw new Error('SESSION_EXPIRED');
        if (!res.ok) {
          const text = await res.text();
          try {
            const parsed = JSON.parse(text) as { message?: string; code?: string };
            throw new ApiError(parsed.message ?? text, parsed.code);
          } catch (e) {
            if (e instanceof ApiError) throw e;
            throw new Error(text || `HTTP ${res.status}`);
          }
        }
        invalidate('billing');
        load();
      } catch (e) {
        const msg = resolveBillingErrorMessage(e, t);
        setError(msg);
      } finally {
        setUploading(false);
      }
    },
    [auth, invalidate, load, t],
  );

  const onUploadPress = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) void uploadFile(file);
      };
      input.click();
      return;
    }
    setError(t('cloudStorage.webOnlyUpload'));
  };

  const onDownload = async (item: CloudFile) => {
    try {
      const { blob, fileName } = await downloadBlob(auth, `/cloud-storage/${item.id}/download`, item.fileName);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.loadError'));
    }
  };

  const onDelete = async (item: CloudFile) => {
    const ok = await confirmAsync({
      title: t('cloudStorage.deleteTitle'),
      message: item.fileName,
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    try {
      await deleteJson(auth, `/cloud-storage/${item.id}`);
      invalidate('billing');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.loadError'));
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}>
        <Text style={styles.title}>{t('cloudStorage.title')}</Text>
        <Text style={styles.sub}>{t('cloudStorage.sub')}</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {loading && !data ? <ActivityIndicator color={colors.primary} /> : null}

        {quota ? (
          <View style={styles.quotaCard}>
            <Text style={styles.quotaTitle}>{t('cloudStorage.quotaTitle')}</Text>
            <Text style={styles.quotaValue}>
              {quota.storageGbUsed} / {quota.storageGbTotalLimit} GB
            </Text>
            <Text style={styles.quotaMeta}>
              {quota.storageGbPerSeat} GB × {quota.activeSeats} — {t('cloudStorage.perSeatHint')}
            </Text>
            <View style={styles.quotaTrack}>
              <View style={[styles.quotaFill, { width: `${usagePct}%` }]} />
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={uploading}
          onPress={onUploadPress}
          style={({ pressed }) => [
            styles.uploadBtn,
            (uploading || pressed) && styles.uploadBtnDisabled,
          ]}
        >
          {uploading ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <>
              <MaterialIcons color={colors.onPrimary} name="cloud-upload" size={20} />
              <Text style={styles.uploadBtnText}>{t('cloudStorage.upload')}</Text>
            </>
          )}
        </Pressable>

        <View style={styles.list}>
          {(data?.items ?? []).map((item) => (
            <View key={item.id} style={styles.fileCard}>
              <View style={styles.fileTop}>
                <View style={styles.fileIcon}>
                  <MaterialIcons color={colors.primary} name="insert-drive-file" size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={2}>
                    {item.fileName}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {formatBytes(item.sizeBytes)}
                    {' · '}
                    {item.uploadedBy}
                    {' · '}
                    {formatDate(item.createdAtUtc, language)}
                  </Text>
                </View>
              </View>
              <View style={styles.fileActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onDownload(item)}
                  style={styles.actionBtn}
                >
                  <MaterialIcons color={colors.primary} name="download" size={18} />
                  <Text style={styles.actionText}>{t('cloudStorage.download')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onDelete(item)}
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                >
                  <MaterialIcons color={colors.error} name="delete-outline" size={18} />
                  <Text style={[styles.actionText, styles.actionTextDanger]}>{t('common.delete')}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {!loading && (data?.items.length ?? 0) === 0 ? (
          <Text style={styles.empty}>{t('cloudStorage.empty')}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
