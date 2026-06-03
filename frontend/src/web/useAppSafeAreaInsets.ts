import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IPHONE_16_PRO } from './iphone16ProSpec';
import { useWebIphonePreview } from './WebIphonePreviewContext';

/** Safe area с учётом Dynamic Island в web-превью iPhone 16 Pro. */
export function useAppSafeAreaInsets() {
  const insets = useSafeAreaInsets();
  const preview = useWebIphonePreview();

  if (Platform.OS !== 'web' || !preview.active) {
    return insets;
  }

  const spec = IPHONE_16_PRO.safeArea;
  return {
    top: Math.max(insets.top, spec.top),
    bottom: Math.max(insets.bottom, spec.bottom),
    left: Math.max(insets.left, spec.left),
    right: Math.max(insets.right, spec.right),
  };
}
