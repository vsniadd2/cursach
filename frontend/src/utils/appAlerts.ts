import { Alert, Platform } from 'react-native';

export function showNotificationsInfo(): void {
  Alert.alert(
    'Уведомления',
    'Здесь будут оповещения по сделкам, задачам и напоминаниям.',
    [{ text: 'ОК' }],
  );
}

export type ConfirmAsyncOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};

/** Подтверждение: на web — `window.confirm` (Alert с кнопками в RN Web ненадёжен). */
export function confirmAsync({
  title,
  message,
  confirmLabel,
  cancelLabel,
}: ConfirmAsyncOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = `${title}\n\n${message}`;
    const ok =
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as unknown as { confirm?: (m: string) => boolean }).confirm === 'function' &&
      (globalThis as unknown as { confirm: (m: string) => boolean }).confirm(text);
    return Promise.resolve(Boolean(ok));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
