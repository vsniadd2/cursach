import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ClientDetailScreen } from '../screens/ClientDetailScreen';
import { DealsPipelineScreen } from '../screens/DealsPipelineScreen';
import { DealEditScreen } from '../screens/DealEditScreen';
import type { DealsStackParamList } from './types';

const Stack = createNativeStackNavigator<DealsStackParamList>();

export function DealsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        component={DealsPipelineScreen}
        name="DealsPipeline"
        options={{ title: 'Воронка сделок' }}
      />
      <Stack.Screen
        component={ClientDetailScreen}
        name="ClientDetail"
        options={{ title: 'Карточка клиента' }}
      />
      <Stack.Screen
        component={DealEditScreen}
        name="DealEdit"
        options={{ title: 'Сделка' }}
      />
    </Stack.Navigator>
  );
}
