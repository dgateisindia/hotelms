export function formatCurrency(value, { currency = "INR", locale = "en-IN" } = {}) {
  const amount = Number(value);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}