import { forwardRef, useCallback } from 'react';
import { Platform, TextInput, type TextInputProps, type TextStyle } from 'react-native';

import { dismissKeyboard } from '../utils/keyboard';

export type AppTextInputProps = TextInputProps & {
  /** Клавиша на клавиатуре: done — закрыть, next — следующее поле, search — поиск. */
  returnKey?: 'done' | 'next' | 'search' | 'go' | 'send';
};

export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(function AppTextInput(
  { returnKey, multiline, blurOnSubmit, onSubmitEditing, returnKeyType, enterKeyHint, style, ...rest },
  ref,
) {
  const resolvedReturnKey = returnKey ?? (multiline ? undefined : 'done');

  const resolvedReturnKeyType = returnKeyType ?? resolvedReturnKey ?? 'done';

  const resolvedBlurOnSubmit = blurOnSubmit ?? !multiline;

  const handleSubmitEditing = useCallback<NonNullable<TextInputProps['onSubmitEditing']>>(
    (e) => {
      onSubmitEditing?.(e);
      if (!multiline || resolvedBlurOnSubmit) {
        dismissKeyboard();
      }
    },
    [multiline, onSubmitEditing, resolvedBlurOnSubmit],
  );

  const webEnterHint =
    enterKeyHint ??
    (resolvedReturnKeyType === 'search'
      ? 'search'
      : resolvedReturnKeyType === 'send' || resolvedReturnKeyType === 'go'
        ? resolvedReturnKeyType
        : multiline
          ? 'enter'
          : 'done');

  const webInputBaseStyle: TextStyle | undefined =
    Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          borderWidth: 0,
          backgroundColor: 'transparent',
          boxShadow: 'none',
        } as unknown as TextStyle)
      : undefined;

  return (
    <TextInput
      ref={ref}
      blurOnSubmit={resolvedBlurOnSubmit}
      enterKeyHint={Platform.OS === 'web' ? webEnterHint : enterKeyHint}
      multiline={multiline}
      returnKeyType={resolvedReturnKeyType}
      onSubmitEditing={handleSubmitEditing}
      style={webInputBaseStyle ? [webInputBaseStyle, style] : style}
      {...rest}
    />
  );
});
