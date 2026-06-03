import { Platform, type ViewStyle } from 'react-native';

type ShadowOpts = {
  color?: string;
  offset?: { width: number; height: number };
  opacity?: number;
  radius?: number;
  elevation?: number;
};

/** Тень: на web — boxShadow, на native — shadow*. */
export function rnwShadow(opts: ShadowOpts): ViewStyle {
  const {
    color = '#000',
    offset = { width: 0, height: 8 },
    opacity = 0.2,
    radius = 16,
    elevation = 8,
  } = opts;

  if (Platform.OS === 'web') {
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${hexWithAlpha(color, opacity)}`,
    } as ViewStyle;
  }

  return {
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
}

function hexWithAlpha(hex: string, opacity: number): string {
  if (hex.startsWith('rgba')) {
    return hex;
  }
  const h = hex.replace('#', '');
  if (h.length === 3) {
    const [r, g, b] = h.split('');
    return `rgba(${parseInt(r + r, 16)}, ${parseInt(g + g, 16)}, ${parseInt(b + b, 16)}, ${opacity})`;
  }
  if (h.length >= 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgba(0, 0, 0, ${opacity})`;
}
