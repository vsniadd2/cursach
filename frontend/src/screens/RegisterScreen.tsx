import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthPrimaryButton, AuthShell, useAuthFormStyles } from '../auth/AuthShell';
import { useAuth } from '../auth/AuthContext';
import { AppTextInput } from '../components/AppTextInput';
import { APP_NAME, APP_EMAIL_DOMAIN } from '../constants/brand';
import { useAppColors } from '../theme/AppPreferencesContext';

type Props = {
  goToLogin: () => void;
};

export function RegisterScreen({ goToLogin }: Props) {
  const colors = useAppColors();
  const authStyles = useAuthFormStyles();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (loading) return;
    setError(null);
    const u = username.trim();
    if (!u) return setError('Введите логин');
    if (password.length < 6) return setError('Пароль минимум 6 символов');
    if (password !== confirm) return setError('Пароли не совпадают');

    setLoading(true);
    try {
      await signUp({
        username: u,
        password,
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Создать аккаунт"
      subtitle={`Регистрация для доступа к ${APP_NAME}`}
      footer={
        <>
          <View style={authStyles.linkRow}>
            <Text style={authStyles.linkText}>Уже есть аккаунт?</Text>
            <Pressable accessibilityRole="button" onPress={goToLogin}>
              <Text style={authStyles.linkStrong}>Войти</Text>
            </Pressable>
          </View>
        </>
      }
    >
      <Text style={authStyles.label}>ФИО</Text>
      <AppTextInput
        placeholder="Иван Иванов"
        placeholderTextColor={`${colors.onSurfaceVariant}99`}
        returnKey="next"
        value={fullName}
        onChangeText={setFullName}
        style={authStyles.input}
      />

      <Text style={authStyles.label}>Электронная почта</Text>
      <AppTextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder={`ivan@${APP_EMAIL_DOMAIN}`}
        placeholderTextColor={`${colors.onSurfaceVariant}99`}
        returnKey="next"
        value={email}
        onChangeText={setEmail}
        style={authStyles.input}
      />

      <Text style={authStyles.label}>Логин</Text>
      <AppTextInput
        autoCapitalize="none"
        placeholder="ivan"
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
        returnKey="next"
        value={password}
        onChangeText={setPassword}
        style={authStyles.input}
      />

      <Text style={authStyles.label}>Подтверждение пароля</Text>
      <AppTextInput
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={`${colors.onSurfaceVariant}99`}
        returnKey="done"
        value={confirm}
        onChangeText={setConfirm}
        onSubmitEditing={() => void onSubmit()}
        style={authStyles.input}
      />

      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <AuthPrimaryButton label="Зарегистрироваться" loading={loading} onPress={onSubmit} />
    </AuthShell>
  );
}

