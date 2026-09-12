export function formatDate(
  value,
  { locale = "en-IN", timeZone } = {}
) {
  if (!value) return "\u2014";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "\u2014";
  }

  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  });
}

export function formatDateTime(
  value,
  { locale = "en-IN", timeZone } = {}
) {
  if (!value) return "\u2014";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "\u2014";
  }

  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}
