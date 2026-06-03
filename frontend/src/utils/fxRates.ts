import { apiUrl } from '../api/client';

export type FxRatesResponse = {
  baseCurrency: string;
  rates: Record<string, number>;
  updatedAtUtc: string;
};

/** Сколько единиц валюты за 1 USD (загружается с сервера). */
let unitsPerOneUsd: Record<string, number> = { USD: 1 };

export function setFxRates(rates: Record<string, number>) {
  unitsPerOneUsd = { USD: 1, ...rates };
}

export function getFxRate(displayCurrency: string): number | null {
  const code = displayCurrency.trim().toUpperCase() || 'USD';
  if (code === 'USD') return 1;
  const rate = unitsPerOneUsd[code];
  return rate != null && rate > 0 ? rate : null;
}

export async function loadFxRates(): Promise<void> {
  const res = await fetch(apiUrl('/fx/rates'));
  if (!res.ok) return;
  const data = (await res.json()) as FxRatesResponse;
  if (data.rates && typeof data.rates === 'object') {
    setFxRates(data.rates);
  }
}

export function convertUsdToDisplay(amountUsd: number, displayCurrency: string): number {
  const code = displayCurrency.trim().toUpperCase() || 'USD';
  const rate = getFxRate(code);
  if (rate == null) return amountUsd;
  return amountUsd * rate;
}
