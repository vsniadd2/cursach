import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_700Bold_Italic } from '@expo-google-fonts/playfair-display';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { LogBox, Platform, StyleSheet, Text, View } from 'react-native';

LogBox.ignoreLogs([
  'props.pointerEvents is deprecated',
  '"shadow*" style props are deprecated',
]);
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/auth/AuthProvider';
import { NotificationsProvider } from './src/notifications/NotificationsContext';
import { BillingSubscriptionProvider } from './src/data/BillingSubscriptionContext';
import { DataSyncProvider } from './src/data/DataSyncContext';
import { BrandedSplash } from './src/components/BrandedSplash';
import { NotificationToastHost } from './src/components/NotificationToastHost';
import { AppPreferencesProvider, useAppPreferences } from './src/theme/AppPreferencesContext';
import { Iphone16ProFrame } from './src/web/Iphone16ProFrame';

function ThemedChrome({ children }: { children: React.ReactNode }) {
  const { theme } = useAppPreferences();
  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {children}
    </>
  );
}

export default function App() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    PlayfairDisplay_700Bold_Italic,
  });
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    const T = Text as typeof Text & { defaultProps?: { style?: object } };
    T.defaultProps = T.defaultProps ?? {};
    T.defaultProps.style = { fontFamily: 'Inter_400Regular' };
  }, [loaded]);

  if (!splashDone) {
    return (
      <View style={styles.boot}>
        <StatusBar style="light" />
        <BrandedSplash fontsLoaded={loaded} onAnimationComplete={() => setSplashDone(true)} />
      </View>
    );
  }

  const appTree = (
    <AuthProvider>
      <DataSyncProvider>
        <AppPreferencesProvider>
          <BillingSubscriptionProvider>
            <NotificationsProvider>
              <ThemedChrome>
                {Platform.OS === 'web' ? (
                  <Iphone16ProFrame>
                    <RootNavigator />
                    <NotificationToastHost />
                  </Iphone16ProFrame>
                ) : (
                  <SafeAreaProvider>
                    <RootNavigator />
                    <NotificationToastHost />
                  </SafeAreaProvider>
                )}
              </ThemedChrome>
            </NotificationsProvider>
          </BillingSubscriptionProvider>
        </AppPreferencesProvider>
      </DataSyncProvider>
    </AuthProvider>
  );

  return appTree;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#001233',
  },
});
