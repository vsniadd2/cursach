/** Декодирует exp из JWT (секунды UTC). Без проверки подписи — только для клиентского TTL. */
export function getJwtExpiryMs(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number') return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/** true, если access истёк или истекает в ближайшие skewSec секунд. */
export function isAccessTokenStale(token: string | null | undefined, skewSec = 60): boolean {
  const expMs = getJwtExpiryMs(token);
  if (expMs === null) return true;
  return Date.now() >= expMs - skewSec * 1000;
}
