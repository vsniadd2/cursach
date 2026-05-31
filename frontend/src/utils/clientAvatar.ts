/**
 * HSL-фон для аватарки с номером клиента — детерминирован от id.
 */
export function clientAvatarFallbackBackground(clientId: number): string {
  const hue = (clientId * 47) % 360;
  const sat = 42 + (clientId % 3) * 8;
  const light = 32 + (clientId % 5) * 4;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}
