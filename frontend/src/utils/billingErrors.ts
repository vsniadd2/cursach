import { ApiError } from '../api/requests';
import type { MessageKey } from '../i18n/messages';

const CODE_TO_KEY: Record<string, MessageKey> = {
  'billing.limit.contacts': 'billing.limits.contacts',
  'billing.limit.pipelines': 'billing.limits.pipelines',
  'billing.limit.seats': 'billing.limits.seats',
  'billing.limit.integrations': 'billing.limits.integrations',
  'billing.limit.ai': 'billing.limits.ai',
  'billing.limit.teamRoles': 'billing.limits.teamRoles',
  'billing.limit.reports': 'billing.limits.reports',
  'billing.limit.teamMinSeats': 'billing.limits.teamMinSeats',
  'billing.limit.downgradeUsage': 'billing.limits.downgradeUsage',
  'billing.limit.storage': 'billing.limits.storage',
  'google.not_configured': 'integrationsScreen.googleOAuthNotConfigured',
};

export function resolveBillingErrorMessage(
  error: unknown,
  t: (key: MessageKey) => string,
): string {
  if (error instanceof ApiError && error.code) {
    const key = CODE_TO_KEY[error.code];
    if (key) return t(key);
  }
  if (error instanceof Error) return error.message;
  return t('common.loadError');
}

export function formatUsageLimit(used: number, limit: number, unlimitedLabel: string): string {
  if (limit < 0) return `${used} / ${unlimitedLabel}`;
  return `${used} / ${limit}`;
}
