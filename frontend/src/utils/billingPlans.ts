export const BILLING_PLAN_CODES = ['free', 'pro', 'team'] as const;

export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];

export const BILLING_PLAN_FEATURE_KEYS: Record<BillingPlanCode, string[]> = {
  free: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'],
  pro: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'],
  team: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'],
};

export function planDisplayName(code: string): string {
  const normalized = code.trim().toLowerCase();
  if (normalized === 'starter') return 'FREE';
  return normalized.toUpperCase();
}
