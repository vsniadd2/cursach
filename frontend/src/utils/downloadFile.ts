import { Platform } from 'react-native';

export function saveBlobAsFile(blob: Blob, fileName: string): void {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }

  throw new Error('Скачивание файла поддерживается в веб-версии приложения.');
}
