import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/auth/AuthProvider';
import { BrandedSplash } from './src/components/BrandedSplash';
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

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppPreferencesProvider>
          <ThemedChrome>
            {Platform.OS === 'web' ? (
              <Iphone16ProFrame>
                <RootNavigator />
              </Iphone16ProFrame>
            ) : (
              <RootNavigator />
            )}
          </ThemedChrome>
        </AppPreferencesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#001233',
  },
});
