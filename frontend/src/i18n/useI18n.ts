import { useCallback, useMemo } from 'react';

import { useAppPreferences } from '../theme/AppPreferencesContext';
import type { AppLanguage } from '../utils/locale';
import { translate, type MessageKey } from './messages';

export function useI18n() {
  const { language } = useAppPreferences();

  const t = useCallback((key: MessageKey) => translate(language, key), [language]);

  return useMemo(() => ({ t, language }), [language, t]);
}

export function useTranslate(language: AppLanguage) {
  return useCallback((key: MessageKey) => translate(language, key), [language]);
}
