import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { MainTabBar } from '../components/MainTabBar';
import { useAuth } from '../auth/AuthContext';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { TaskEditScreen } from '../screens/TaskEditScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { useAppPreferences } from '../theme/AppPreferencesContext';
import { ClientsStackNavigator } from './ClientsStackNavigator';
import { DealsStackNavigator } from './DealsStackNavigator';
import { MoreStackNavigator } from './MoreStackNavigator';
import type { AuthStackParamList, MainTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AppTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <MainTabBar {...props} />}>
      <Tab.Screen component={DashboardScreen} name="Dashboard" />
      <Tab.Screen component={ClientsStackNavigator} name="Clients" />
      <Tab.Screen component={DealsStackNavigator} name="Deals" />
      <Tab.Screen component={TasksScreen} name="Tasks" />
      <Tab.Screen component={MoreStackNavigator} name="More" />
    </Tab.Navigator>
  );
}

function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login">
        {({ navigation }) => <LoginScreen goToRegister={() => navigation.navigate('Register')} />}
      </AuthStack.Screen>
      <AuthStack.Screen name="Register">
        {({ navigation }) => <RegisterScreen goToLogin={() => navigation.navigate('Login')} />}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const { state } = useAuth();
  const isAuthed = !!state.accessToken || !!state.refreshToken;
  const { theme, colors } = useAppPreferences();

  const navTheme = useMemo(() => {
    const base = theme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.surface,
        card: colors.surface,
        text: colors.onSurface,
        border: colors.outlineVariant,
        notification: colors.primary,
      },
    };
  }, [theme, colors]);

  return (
    <NavigationContainer theme={navTheme}>
      {state.isHydrating ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {isAuthed ? (
            <>
              <RootStack.Screen component={AppTabs} name="App" />
              <RootStack.Screen component={TaskEditScreen as any} name="TaskEdit" />
              <RootStack.Screen component={NotificationsScreen} name="Notifications" />
            </>
          ) : (
            <RootStack.Screen component={AuthFlow} name="Auth" />
          )}
        </RootStack.Navigator>
      )}
    </NavigationContainer>
  );
}
