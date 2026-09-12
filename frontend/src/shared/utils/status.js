const BOOKING_STATUS_LABELS = {
  pending: "Pending",
  expected: "Expected",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  checked_out: "Checked Out",
  cancelled: "Cancelled",
  no_show: "No Show",
  expired: "Expired",
};

const PAYMENT_STATUS_LABELS = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
  review_required: "Review Required",
};

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

export function formatStatus(value) {
  return BOOKING_STATUS_LABELS[normalizeStatus(value)] || "Unknown";
}

export function formatPaymentStatus(value) {
  return PAYMENT_STATUS_LABELS[normalizeStatus(value)] || "Unknown";
}