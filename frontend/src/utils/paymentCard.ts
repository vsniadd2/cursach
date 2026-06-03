export type CardBrand = 'visa' | 'mastercard' | 'unknown';

const MAX_CARD_DIGITS = 16;
const MAX_CVV = 3;

export function extractDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function detectCardBrand(digits: string): CardBrand {
  if (!digits) return 'unknown';
  if (digits.startsWith('4')) return 'visa';
  if (/^5[1-5]/.test(digits)) return 'mastercard';
  if (/^2(2[2-9]|[3-6]|7[01]|720)/.test(digits)) return 'mastercard';
  return 'unknown';
}

export function formatCardNumberDisplay(digits: string): string {
  const d = digits.slice(0, MAX_CARD_DIGITS);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function parseCardNumberInput(raw: string): string {
  return extractDigits(raw).slice(0, MAX_CARD_DIGITS);
}

export function formatExpiryInput(raw: string): string {
  const d = extractDigits(raw).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function parseCvvInput(raw: string): string {
  return extractDigits(raw).slice(0, MAX_CVV);
}

export function formatCardholderInput(raw: string): string {
  return raw
    .replace(/[^a-zA-ZÀ-ÿ\s'-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .toUpperCase();
}

export function luhnCheck(digits: string): boolean {
  if (digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i]!, 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function isExpiryValid(expiry: string): boolean {
  const d = extractDigits(expiry);
  if (d.length !== 4) return false;
  const month = parseInt(d.slice(0, 2), 10);
  const year = parseInt(d.slice(2, 4), 10);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
}

export type PaymentFormFields = {
  cardHolder: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
};

export type PaymentFormErrors = Partial<Record<keyof PaymentFormFields, string>>;

export function validatePaymentForm(
  fields: PaymentFormFields,
  messages: {
    holder: string;
    number: string;
    expiry: string;
    cvv: string;
  },
): PaymentFormErrors {
  const errors: PaymentFormErrors = {};
  const holder = fields.cardHolder.trim();
  const digits = parseCardNumberInput(fields.cardNumber);
  const cvv = parseCvvInput(fields.cvv);

  if (holder.length < 3 || !/^[A-ZÀ-ÿ\s'-]+$/.test(holder)) {
    errors.cardHolder = messages.holder;
  }
  if (digits.length !== MAX_CARD_DIGITS || !luhnCheck(digits)) {
    errors.cardNumber = messages.number;
  }
  if (!isExpiryValid(fields.expiry)) {
    errors.expiry = messages.expiry;
  }
  if (cvv.length !== MAX_CVV) {
    errors.cvv = messages.cvv;
  }
  return errors;
}

export function isPaymentFormComplete(fields: PaymentFormFields): boolean {
  const digits = parseCardNumberInput(fields.cardNumber);
  const cvv = parseCvvInput(fields.cvv);
  return (
    fields.cardHolder.trim().length >= 3 &&
    digits.length === MAX_CARD_DIGITS &&
    extractDigits(fields.expiry).length === 4 &&
    cvv.length === MAX_CVV
  );
}

export function maskCardPreview(digits: string): string {
  const d = parseCardNumberInput(digits);
  let out = '';
  for (let i = 0; i < MAX_CARD_DIGITS; i++) {
    if (i > 0 && i % 4 === 0) out += ' ';
    out += i < d.length ? d[i] : '•';
  }
  return out;
}
