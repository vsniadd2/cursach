import { useWindowDimensions } from 'react-native';

import { IPHONE_16_PRO } from './iphone16ProSpec';
import { useWebIphonePreview } from './WebIphonePreviewContext';

/** Ширина/высота для вёрстки: внутри iPhone-превью — 402×874, иначе окно браузера. */
export function useLayoutDimensions() {
  const preview = useWebIphonePreview();
  const win = useWindowDimensions();

  if (preview.active) {
    return {
      width: preview.layoutWidth || IPHONE_16_PRO.logical.width,
      height: preview.layoutHeight || IPHONE_16_PRO.logical.height,
      fontScale: win.fontScale,
      scale: preview.scale,
    };
  }

  return {
    width: win.width,
    height: win.height,
    fontScale: win.fontScale,
    scale: win.scale,
  };
}
