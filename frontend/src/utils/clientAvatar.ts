/**
 * Цвет и инициалы аватара клиента.
 */
export function clientAvatarBackground(hue: number, clientId?: number): string {
  const h = hue > 0 ? hue % 360 : clientId != null ? (clientId * 47) % 360 : 200;
  const sat = 42 + (h % 3) * 8;
  const light = 36 + (h % 5) * 4;
  return `hsl(${h}, ${sat}%, ${light}%)`;
}

/** @deprecated используйте clientAvatarBackground(hue, clientId) */
export function clientAvatarFallbackBackground(clientId: number): string {
  return clientAvatarBackground(0, clientId);
}

export function clientInitials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const w = parts[0]!;
    return w.length >= 2 ? w.slice(0, 2).toUpperCase() : w.toUpperCase();
  }
  const first = parts[0]![0] ?? '';
  const last = parts[parts.length - 1]![0] ?? '';
  return `${first}${last}`.toUpperCase();
}
