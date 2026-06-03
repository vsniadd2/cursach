import { convertUsdToDisplay, getFxRate } from './fxRates';

/**
 * Форматирование суммы: `amountUsd` в БД в USD, пересчёт в выбранную валюту по курсу к доллару.
 */
export function formatMoneyAmount(amountUsd: number, displayCurrency: string): string {
  const code = displayCurrency.trim().toUpperCase() || 'USD';
  const rate = getFxRate(code);
  const currencyCode = rate == null ? 'USD' : code;
  const display = rate == null ? amountUsd : convertUsdToDisplay(amountUsd, code);
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(Math.round(display));
  } catch {
    return `${Math.round(display)} ${currencyCode}`;
  }
}
