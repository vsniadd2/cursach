import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthPrimaryButton, AuthShell, useAuthFormStyles } from '../auth/AuthShell';
import { useAuth } from '../auth/AuthContext';
import { AppTextInput } from '../components/AppTextInput';
import { APP_NAME } from '../constants/brand';
import { useAppColors } from '../theme/AppPreferencesContext';

type Props = {
  goToRegister: () => void;
};

export function LoginScreen({ goToRegister }: Props) {
  const colors = useAppColors();
  const authStyles = useAuthFormStyles();
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await signIn(username.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Вход"
      subtitle={`Авторизация перед доступом к ${APP_NAME}`}
      footer={
        <>
          <View style={authStyles.linkRow}>
            <Text style={authStyles.linkText}>Нет аккаунта?</Text>
            <Pressable accessibilityRole="button" onPress={goToRegister}>
              <Text style={authStyles.linkStrong}>Регистрация</Text>
            </Pressable>
          </View>
        </>
      }
    >
      <Text style={authStyles.label}>Логин</Text>
      <AppTextInput
        autoCapitalize="none"
        placeholder="admin"
        placeholderTextColor={`${colors.onSurfaceVariant}99`}
        returnKey="next"
        value={username}
        onChangeText={setUsername}
        style={authStyles.input}
      />

      <Text style={authStyles.label}>Пароль</Text>
      <AppTextInput
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={`${colors.onSurfaceVariant}99`}
        returnKey="done"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => void onSubmit()}
        style={authStyles.input}
      />

      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <AuthPrimaryButton label="Войти" loading={loading} onPress={onSubmit} />
    </AuthShell>
  );
}
