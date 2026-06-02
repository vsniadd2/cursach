import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

export function useOpenNotifications() {
  const navigation = useNavigation<any>();

  return useCallback(() => {
    navigation.navigate('Notifications');
  }, [navigation]);
}
