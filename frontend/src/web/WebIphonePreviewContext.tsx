import { createContext, useContext } from 'react';

/** Логические размеры экрана iPhone 16 Pro (портрет), pt. */
export const IPHONE_16_PRO_LOGICAL = { width: 402, height: 874 } as const;

export type WebIphonePreviewValue = {
  active: boolean;
  layoutWidth: number;
  layoutHeight: number;
};

const defaultValue: WebIphonePreviewValue = {
  active: false,
  layoutWidth: 0,
  layoutHeight: 0,
};

export const WebIphonePreviewContext = createContext<WebIphonePreviewValue>(defaultValue);

export function useWebIphonePreview(): WebIphonePreviewValue {
  return useContext(WebIphonePreviewContext);
}
