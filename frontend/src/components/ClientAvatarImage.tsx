import { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ImageStyle } from 'react-native';

import { clientAvatarBackground, clientInitials } from '../utils/clientAvatar';

type Props = {
  clientId: number;
  fullName?: string | null;
  avatarHue?: number | null;
  /** Если задано и не пустое — показываем кастомное фото из CRM. */
  uri?: string | null;
  size: number;
  style?: StyleProp<ImageStyle>;
};

/** Аватар: фото или инициалы на уникальном цветном фоне. */
export function ClientAvatarImage({ clientId, fullName, avatarHue, uri, size, style }: Props) {
  const trimmed = uri?.trim();
  const hasCustom = !!(trimmed && trimmed.length > 0);
  const [imgFailed, setImgFailed] = useState(false);

  const hue = avatarHue != null && avatarHue > 0 ? avatarHue : 0;
  const fallbackBg = useMemo(() => clientAvatarBackground(hue, clientId), [hue, clientId]);
  const initials = useMemo(
    () => (fullName?.trim() ? clientInitials(fullName) : `#${clientId}`),
    [fullName, clientId],
  );
  const baseSize = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
    }),
    [size],
  );
  const fontSize = Math.max(8, Math.min(18, Math.round(size * 0.36)));

  const onImageError = useCallback(() => {
    setImgFailed(true);
  }, []);

  if (!hasCustom || imgFailed) {
    return (
      <View
        accessibilityLabel={`Аватар клиента ${fullName?.trim() || clientId}`}
        accessibilityRole="image"
        style={[baseSize, styles.badge, { backgroundColor: fallbackBg }, style as object]}
      >
        <Text style={[styles.badgeText, { fontSize }]} numberOfLines={1} adjustsFontSizeToFit>
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={`Аватар клиента ${fullName?.trim() || clientId}`}
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
