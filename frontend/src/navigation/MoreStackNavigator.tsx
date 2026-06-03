import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AutomationsScreen } from '../screens/AutomationsScreen';
import { AuditLogScreen } from '../screens/AuditLogScreen';
import { BillingScreen } from '../screens/BillingScreen';
import { IntegrationsScreen } from '../screens/IntegrationsScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SupportScreen } from '../screens/SupportScreen';
import { TeamScreen } from '../screens/TeamScreen';
import type { MoreStackParamList } from './types';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={MoreScreen} name="MoreHome" options={{ title: 'Ещё' }} />
      <Stack.Screen component={SettingsScreen} name="MoreSettings" options={{ title: 'Настройки' }} />
      <Stack.Screen component={TeamScreen} name="MoreTeam" options={{ title: 'Пользователи' }} />
      <Stack.Screen component={ReportsScreen} name="MoreReports" options={{ title: 'Отчёты' }} />
      <Stack.Screen component={BillingScreen} name="MoreBilling" options={{ title: 'Тариф' }} />
      <Stack.Screen component={IntegrationsScreen} name="MoreIntegrations" options={{ title: 'Интеграции' }} />
      <Stack.Screen component={AutomationsScreen} name="MoreAutomations" options={{ title: 'Автоматизации' }} />
      <Stack.Screen component={AuditLogScreen} name="MoreAuditLog" options={{ title: 'Аудит' }} />
      <Stack.Screen component={SupportScreen} name="MoreSupport" options={{ title: 'Поддержка' }} />
    </Stack.Navigator>
  );
}

