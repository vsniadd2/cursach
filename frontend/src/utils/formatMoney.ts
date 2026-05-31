import { convertUsdToDisplay } from './fxRates';

/**
 * Форматирование суммы: `amountUsd` в БД в USD, пересчёт в выбранную валюту по курсу к доллару.
 */
export function formatMoneyAmount(amountUsd: number, displayCurrency: string): string {
  const code = displayCurrency.trim().toUpperCase() || 'BYN';
  const display = convertUsdToDisplay(amountUsd, code);
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(Math.round(display));
  } catch {
    return `${Math.round(display)} ${code}`;
  }
}
