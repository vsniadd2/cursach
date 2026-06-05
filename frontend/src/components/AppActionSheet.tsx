import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '../theme/AppPreferencesContext';
import type { AppPalette } from '../theme/palettes';
import { AppModal } from './AppModal';

export type AppActionSheetAction = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  actions: AppActionSheetAction[];
  onClose: () => void;
};

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    backdropDismiss: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: colors.surface,
      paddingBottom: Platform.OS === 'web' ? 16 : 24,
      overflow: 'hidden',
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: `${colors.outlineVariant}66`,
    },
    title: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.onSurface,
      textAlign: 'center',
    },
    message: {
      marginTop: 6,
      fontSize: 13,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
    },
    action: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    actionText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    actionTextDestructive: {
      color: colors.error,
    },
    actionTextCancel: {
      color: colors.onSurfaceVariant,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: `${colors.outlineVariant}66`,
    },
    cancelGap: {
      height: 8,
      backgroundColor: colors.surfaceContainerLow,
    },
  });
}

export function AppActionSheet({ visible, title, message, actions, onClose }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const regularActions = actions.filter((a) => a.style !== 'cancel');
  const cancelAction = actions.find((a) => a.style === 'cancel');

  const runAction = (action: AppActionSheetAction) => {
    onClose();
    action.onPress?.();
  };

  return (
    <AppModal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.backdropDismiss} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>

          {regularActions.map((action, index) => (
            <View key={`${action.text}-${index}`}>
              {index > 0 ? <View style={styles.separator} /> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => runAction(action)}
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
              >
                <Text
                  style={[
                    styles.actionText,
                    action.style === 'destructive' && styles.actionTextDestructive,
                  ]}
                >
                  {action.text}
                </Text>
              </Pressable>
            </View>
          ))}

          {cancelAction ? (
            <>
              <View style={styles.cancelGap} />
              <Pressable
                accessibilityRole="button"
                onPress={() => runAction(cancelAction)}
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.actionText, styles.actionTextCancel]}>{cancelAction.text}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </AppModal>
  );
}
