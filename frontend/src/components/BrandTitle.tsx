import { Text, type TextProps, type TextStyle } from 'react-native';

import { useI18n } from '../i18n/useI18n';
import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';

type BrandTitleSize = 'header' | 'splash';

type BrandTitleProps = TextProps & {
  size?: BrandTitleSize;
};

function titleStyles(colors: AppPalette | null, size: BrandTitleSize): TextStyle {
  const isSplash = size === 'splash';
  return {
    fontFamily: 'PlayfairDisplay_700Bold_Italic',
    fontStyle: 'italic',
    fontSize: isSplash ? 34 : 26,
    fontWeight: '700',
    letterSpacing: isSplash ? 0.8 : 0.7,
    color: isSplash ? '#FFFFFF' : (colors?.onSurface ?? '#0F172A'),
    transform: [{ skewX: '-4deg' }],
  };
}

function accentColor(colors: AppPalette | null, size: BrandTitleSize): string {
  return size === 'splash' ? '#B8D4FF' : (colors?.primary ?? '#0058BC');
}

function BrandTitleInner({
  name,
  size,
  style,
  colors,
  ...rest
}: BrandTitleProps & { name: string; colors: AppPalette | null }) {
  const base = titleStyles(colors, size);
  const accent = accentColor(colors, size);

  if (name === 'EXPOGO') {
    return (
      <Text style={[base, style]} {...rest}>
        <Text>EXPO</Text>
        <Text style={{ color: accent }}>GO</Text>
      </Text>
    );
  }

  return (
    <Text style={[base, style]} {...rest}>
      <Text>Экспо</Text>
      <Text style={{ color: accent }}>го</Text>
    </Text>
  );
}

/** Название CRM курсивным акцентным шрифтом. */
export function BrandTitle({ size = 'header', style, ...rest }: BrandTitleProps) {
  const colors = useAppColors();
  const { t } = useI18n();
  return <BrandTitleInner name={t('header.appName')} size={size} style={style} colors={colors} {...rest} />;
}

/** Без React-контекста — для заставки до монтирования провайдеров. */
export function BrandTitleStatic({ name, size = 'splash', style, ...rest }: BrandTitleProps & { name: string }) {
  return <BrandTitleInner name={name} size={size} style={style} colors={null} {...rest} />;
}
