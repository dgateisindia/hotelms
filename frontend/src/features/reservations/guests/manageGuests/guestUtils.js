export function normalizeGuestValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function formatGuestLabel(value) {
  const text = normalizeGuestValue(value);
  if (!text) return "—";

  return text
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function guestUsesExtraBed(guest) {
  return (
    guest?.extra_bed_used === true ||
    Number(guest?.extra_bed_used) === 1
  );
}

export function formatGuestDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}