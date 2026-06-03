import { useAuth } from './AuthContext';

/** Вход в приложение только с действующим access token (после hydrate). */
export function useIsAuthenticated(): boolean {
  const { state } = useAuth();
  return !state.isHydrating && !!state.accessToken;
}
