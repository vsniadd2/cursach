import { createContext, useContext } from 'react';

import { IPHONE_16_PRO } from './iphone16ProSpec';

/** @deprecated используйте IPHONE_16_PRO.logical */
export const IPHONE_16_PRO_LOGICAL = IPHONE_16_PRO.logical;

export type WebIphonePreviewValue = {
  active: boolean;
  layoutWidth: number;
  layoutHeight: number;
  /** CSS-масштаб оболочки (физический размер + вписывание в окно). */
  scale: number;
};

const defaultValue: WebIphonePreviewValue = {
  active: false,
  layoutWidth: 0,
  layoutHeight: 0,
  scale: 1,
};

export const WebIphonePreviewContext = createContext<WebIphonePreviewValue>(defaultValue);

export function useWebIphonePreview(): WebIphonePreviewValue {
  return useContext(WebIphonePreviewContext);
}
