export const humanize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );

export const equal = (a, b) =>
  JSON.stringify(a) ===
  JSON.stringify(b);

export function supportedValues(
  type,
  fallback
) {
  try {
    if (
      typeof Intl.supportedValuesOf ===
      "function"
    ) {
      return Intl.supportedValuesOf(
        type
      );
    }
  } catch (_) {
    // Browser fallback below.
  }

  return fallback;
}

export function chargeLabel(
  method
) {
  const labels = {
    none:
      "No Charge",

    fixed_amount:
      "Fixed Amount",

    percentage:
      "Percentage",

    night_count:
      "Number Of Nights",

    actual_nights:
      "Actual Occupied Nights",

    full_booking:
      "Full Booking Amount",

    percentage_of_remaining:
      "Percentage Of Remaining Amount",

    manual:
      "Manual Settlement",
  };

  return (
    labels[method] ||
    humanize(method)
  );
}

export function priceLabel(
  method
) {
  const labels = {
    original_rate:
      "Original Contracted Rate",

    new_room_rate:
      "New Room Rate",

    lower_of_both:
      "Lower Of Both Rates",

    higher_of_both:
      "Higher Of Both Rates",

    custom_rate:
      "Custom Rate",

    manual:
      "Admin Decides Manually",
  };

  return (
    labels[method] ||
    humanize(method)
  );
}
