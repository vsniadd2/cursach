import { forwardRef, useCallback } from 'react';
import { Platform, TextInput, type TextInputProps } from 'react-native';

import { dismissKeyboard } from '../utils/keyboard';

export type AppTextInputProps = TextInputProps & {
  /** Клавиша на клавиатуре: done — закрыть, next — следующее поле, search — поиск. */
  returnKey?: 'done' | 'next' | 'search' | 'go' | 'send';
};

export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(function AppTextInput(
  { returnKey, multiline, blurOnSubmit, onSubmitEditing, returnKeyType, enterKeyHint, ...rest },
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
    (resolvedReturnKeyType === 'search' ? 'search' : multiline ? 'enter' : 'done');

  return (
    <TextInput
      ref={ref}
      blurOnSubmit={resolvedBlurOnSubmit}
      enterKeyHint={Platform.OS === 'web' ? webEnterHint : enterKeyHint}
      multiline={multiline}
      returnKeyType={resolvedReturnKeyType}
      onSubmitEditing={handleSubmitEditing}
      {...rest}
    />
  );
});
