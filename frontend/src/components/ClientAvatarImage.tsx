import { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ImageStyle } from 'react-native';

import { clientAvatarFallbackBackground } from '../utils/clientAvatar';

type Props = {
  clientId: number;
  /** Если задано и не пустое — показываем кастомное фото из CRM. */
  uri?: string | null;
  size: number;
  style?: StyleProp<ImageStyle>;
};

/** Аватар по умолчанию — уникальный номер клиента (#id) на цветном круге. */
export function ClientAvatarImage({ clientId, uri, size, style }: Props) {
  const trimmed = uri?.trim();
  const hasCustom = !!(trimmed && trimmed.length > 0);
  const [imgFailed, setImgFailed] = useState(false);

  const fallbackBg = useMemo(() => clientAvatarFallbackBackground(clientId), [clientId]);
  const baseSize = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
    }),
    [size],
  );
  const label = `#${clientId}`;
  const fontSize = Math.max(7, Math.min(16, Math.round(size * 0.32)));

  const onImageError = useCallback(() => {
    setImgFailed(true);
  }, []);

  if (!hasCustom || imgFailed) {
    return (
      <View
        accessibilityLabel={`Аватар клиента ${clientId}`}
        accessibilityRole="image"
        style={[baseSize, styles.badge, { backgroundColor: fallbackBg }, style as object]}
      >
        <Text style={[styles.badgeText, { fontSize }]} numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={`Аватар клиента ${clientId}`}
      source={{ uri: trimmed }}
      onError={onImageError}
      style={[baseSize, style]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeText: {
    fontWeight: '900',
    paddingHorizontal: 2,
    color: 'rgba(255,255,255,0.95)',
  },
});
