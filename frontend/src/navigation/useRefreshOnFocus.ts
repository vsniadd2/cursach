import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

/** Перезагрузка данных при возврате на экран (goBack / смена вкладки). */
export function useRefreshOnFocus(refresh: () => void | (() => void)) {
  useFocusEffect(
    useCallback(() => {
      return refresh();
    }, [refresh]),
  );
}
