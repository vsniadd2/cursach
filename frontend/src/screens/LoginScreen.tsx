import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AuthPrimaryButton, AuthShell, useAuthFormStyles } from '../auth/AuthShell';
import { useAuth } from '../auth/AuthContext';
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
      subtitle="Авторизация перед доступом к CRM"
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
      <TextInput
        autoCapitalize="none"
        placeholder="admin"
        placeholderTextColor={`${colors.onSurfaceVariant}99`}
        value={username}
        onChangeText={setUsername}
        style={authStyles.input}
      />

      <Text style={authStyles.label}>Пароль</Text>
      <TextInput
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={`${colors.onSurfaceVariant}99`}
        value={password}
        onChangeText={setPassword}
        style={authStyles.input}
      />

      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <AuthPrimaryButton label="Войти" loading={loading} onPress={onSubmit} />
    </AuthShell>
  );
}
