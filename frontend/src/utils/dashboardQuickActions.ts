import type { MaterialIcons } from '@expo/vector-icons';

import type { DashboardQuickAction } from '../api/types';
import type { AppPalette } from '../theme/palettes';

export type UiQuickAction = {
  id: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  gradient: readonly [string, string];
  gradientIdx: number;
};

const BUILTIN_IDS = new Set(['lead', 'call', 'meeting']);

const ICON_SET = new Set<string>([
  'add',
  'person-add',
  'call',
  'event',
  'mail',
  'assignment',
  'check-circle',
  'calendar-today',
  'payments',
  'local-offer',
]);

export function gradientChoicesFor(colors: AppPalette): Array<readonly [string, string]> {
  return [
    [colors.primary, colors.primaryContainer],
    [colors.secondary, colors.primaryFixedDim],
    [colors.tertiaryContainer, colors.tertiary],
    [colors.orange700, colors.orange50],
  ];
}

export function resolveQuickActionTitle(
  id: string,
  storedTitle: string,
  t: (key: string) => string,
): string {
  if (id === 'lead') return t('dashboard.quickLead');
  if (id === 'call') return t('dashboard.quickCall');
  if (id === 'meeting') return t('dashboard.quickMeeting');
  return storedTitle;
}

export function mapApiQuickActions(
  items: DashboardQuickAction[],
  colors: AppPalette,
  t: (key: string) => string,
): UiQuickAction[] {
  const gradients = gradientChoicesFor(colors);
  return items.map((item) => {
    const gradientIdx = item.gradientIdx >= 0 && item.gradientIdx < gradients.length ? item.gradientIdx : 0;
    const icon = (ICON_SET.has(item.icon) ? item.icon : 'add') as UiQuickAction['icon'];
    return {
      id: item.id,
      title: resolveQuickActionTitle(item.id, item.title, t),
      icon,
      gradient: gradients[gradientIdx] ?? gradients[0],
      gradientIdx,
    };
  });
}

export function toApiQuickActions(actions: UiQuickAction[]): DashboardQuickAction[] {
  return actions.map((a) => ({
    id: a.id,
    title: BUILTIN_IDS.has(a.id) ? '' : a.title,
    icon: a.icon,
    gradientIdx: a.gradientIdx,
  }));
}
