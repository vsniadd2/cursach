/**
 * Демо-курсы: сколько единиц валюты за 1 USD (для пересчёта отображения).
 * Суммы в API/БД хранятся в USD.
 */
export const UNITS_PER_ONE_USD: Record<string, number> = {
  USD: 1,
  BYN: 3.27,
  RUB: 97,
  EUR: 0.93,
  UAH: 41,
  GBP: 0.79,
  CNY: 7.24,
  JPY: 150,
  CHF: 0.88,
  PLN: 4.0,
};

export function convertUsdToDisplay(amountUsd: number, displayCurrency: string): number {
  const code = displayCurrency.trim().toUpperCase() || 'BYN';
  const rate = UNITS_PER_ONE_USD[code] ?? UNITS_PER_ONE_USD.USD;
  return amountUsd * rate;
}
