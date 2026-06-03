import type { MaterialIcons } from '@expo/vector-icons';

export type ProviderId = 'telegram' | 'email' | 'google_calendar';

export type ProviderSummary = {
  id: ProviderId;
  name: string;
  isEnabled: boolean;
  isConfigured: boolean;
  summary?: string | null;
};

export type ProviderDetail = ProviderSummary & {
  config: Record<string, unknown>;
  secrets: {
    hasBotToken?: boolean;
    hasSmtpPassword?: boolean;
    hasGoogleTokens?: boolean;
  };
};

export const PROVIDER_ORDER: ProviderId[] = ['telegram', 'email', 'google_calendar'];

export const PROVIDER_ICONS: Record<ProviderId, keyof typeof MaterialIcons.glyphMap> = {
  telegram: 'send',
  email: 'email',
  google_calendar: 'event',
};

export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_ORDER.includes(value as ProviderId);
}
