/** iPhone 16 Pro — логические pt, safe area и визуальная оболочка для web-превью. */
export const IPHONE_16_PRO = {
  /** Viewport приложения (портрет), как window.innerWidth/Height на устройстве. */
  logical: { width: 402, height: 874 },
  scale: 3,
  /** Dynamic Island (pt). */
  island: { width: 126, height: 37, top: 11 },
  /** Отступ контента под Dynamic Island (island.top + island.height + зазор). */
  safeArea: { top: 11 + 37 + 14, right: 0, bottom: 34, left: 0 },
  /** Рамка корпуса вокруг OLED (визуальная, pt). */
  bezel: 11,
  /** Скругления: экран / корпус. */
  screenRadius: 53,
  shellRadius: 62,
  /** Home indicator. */
  homeIndicator: { width: 134, height: 5, bottom: 8 },
  /** Физическая ширина/высота корпуса (мм) — для масштаба «как в руке». */
  physicalMm: { width: 71.5, height: 149.6 },
} as const;

export function getIphone16ProOuterSize() {
  const { logical, bezel } = IPHONE_16_PRO;
  return {
    width: logical.width + bezel * 2,
    height: logical.height + bezel * 2,
  };
}

/** Масштаб CSS, чтобы ширина экрана ≈ реальной (71.5 мм при 96 dpi). */
export function getIphone16ProPhysicalScale() {
  const mmToCssPx = 96 / 25.4;
  const targetScreenPx = IPHONE_16_PRO.physicalMm.width * mmToCssPx;
  return targetScreenPx / IPHONE_16_PRO.logical.width;
}

export const IPHONE_16_PRO_INITIAL_METRICS = {
  frame: {
    x: 0,
    y: 0,
    width: IPHONE_16_PRO.logical.width,
    height: IPHONE_16_PRO.logical.height,
  },
  insets: { ...IPHONE_16_PRO.safeArea },
} as const;
