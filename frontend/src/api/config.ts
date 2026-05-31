import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = 5278;
const WEB_DEFAULT = `http://localhost:${DEFAULT_PORT}`;

function getExpoGoHostIp(): string | null {
  // Expo Go usually provides something like "192.168.0.10:8081"
  const anyConstants = Constants as unknown as {
    expoConfig?: { hostUri?: string | null } | null;
    manifest?: { debuggerHost?: string | null } | null;
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string | null } | null } | null } | null;
  };

  const hostUri =
    anyConstants.expoConfig?.hostUri ??
    anyConstants.manifest2?.extra?.expoGo?.debuggerHost ??
    anyConstants.manifest?.debuggerHost ??
    null;

  if (!hostUri) return null;
  const host = hostUri.split(':')[0]?.trim();
  return host && host.length > 0 ? host : null;
}

export const API_BASE_URL = (() => {
  if (Platform.OS === 'web') return WEB_DEFAULT;

  // On real devices, "localhost" points to the device itself.
  // In Expo Go (LAN), we can infer the dev machine IP from Metro host.
  const hostIp = getExpoGoHostIp();
  if (hostIp) return `http://${hostIp}:${DEFAULT_PORT}`;

  // Fallback: emulator/simulator or if host can't be inferred.
  return WEB_DEFAULT;
})();

