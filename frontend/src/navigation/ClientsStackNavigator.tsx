import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ClientDetailScreen } from '../screens/ClientDetailScreen';
import { ClientEditScreen } from '../screens/ClientEditScreen';
import { ClientsScreen } from '../screens/ClientsScreen';
import type { ClientsStackParamList } from './types';

const Stack = createNativeStackNavigator<ClientsStackParamList>();

export function ClientsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={ClientsScreen} name="ClientsList" options={{ title: 'Клиенты' }} />
      <Stack.Screen component={ClientDetailScreen} name="ClientDetail" options={{ title: 'Карточка клиента' }} />
      <Stack.Screen component={ClientEditScreen} name="ClientEdit" options={{ title: 'Клиент' }} />
    </Stack.Navigator>
  );
}

