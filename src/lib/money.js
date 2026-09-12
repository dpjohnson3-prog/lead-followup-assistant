/**
 * Every user is Cincinnati-local, so the currency is a constant rather than a
 * profile field. If a second currency ever appears, this is the single place
 * that has to change.
 */
export const CURRENCY = 'USD';

export function formatMoney(amount) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/**
 * Reads what someone actually types into a money field — "1,250", "$1250",
 * " 1250.50 ". Returns null for blank or unparseable input so the field stays
 * genuinely optional rather than defaulting to 0.
 */
export function parseMoney(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (!input) return null;
  const cleaned = String(input).replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
