import type { ReactNode } from 'react';
import { Modal, Platform, StyleSheet, View, type ModalProps } from 'react-native';

import { useWebIphonePreview } from '../web/WebIphonePreviewContext';

type Props = Pick<ModalProps, 'animationType' | 'onRequestClose' | 'transparent' | 'visible'> & {
  children: ReactNode;
};

/**
 * На web в iPhone-превью RN Modal монтируется в document.body и выходит за рамку устройства.
 * В этом режиме оверлей рисуется поверх экрана внутри appRoot.
 */
export function AppModal({
  visible,
  transparent,
  animationType = 'fade',
  onRequestClose,
  children,
}: Props) {
  const preview = useWebIphonePreview();
  const inlineInPhone = Platform.OS === 'web' && preview.active;

  if (inlineInPhone) {
    if (!visible) return null;
    return (
      <View style={[styles.inlineHost, styles.inlineHostPointer]}>{children}</View>
    );
  }

  return (
    <Modal
      animationType={animationType}
      onRequestClose={onRequestClose}
      transparent={transparent}
      visible={visible}
    >
      {children}
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlineHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    overflow: 'hidden',
  },
  inlineHostPointer: {
    pointerEvents: 'box-none',
  },
});
