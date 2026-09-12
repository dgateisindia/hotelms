const {
  getBookingFinancialSettlementWithConnection,
} = require("./bookingFinancialSettlementService");

const SETTLEMENT_TYPE = "cancellation";
const STATUS_FINALIZED = "finalized";
const STATUS_MANUAL_REVIEW = "manual_review_required";

const VALID_SOURCES = new Set([
  "customer",
  "hotel",
]);

const SUPPORTED_METHODS = new Set([
  "none",
  "fixed_amount",
  "percentage",
  "night_count",
  "full_booking",
  "percentage_of_remaining",
  "manual",
]);


function settlementError(
  status,
  code,
  message
) {
  const error = new Error(message);

  error.status = status;
  error.code = code;

  return error;
}


function positiveInteger(value) {
  const number = Number(value);

  return (
    Number.isSafeInteger(number) &&
    number > 0
  )
    ? number
    : null;
}


function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}


function money(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? Number(number.toFixed(2))
    : null;
}


function nonNegativeMoney(value) {
  const number = money(value);

  return (
    number !== null &&
    number >= 0
  )
    ? number
    : null;
}


function parsePolicySnapshot(value) {
  if (!value) return null;

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    return (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    )
      ? parsed
      : null;
  } catch {
    return null;
  }
}


function manualReviewResult({
  policySnapshotId = null,
  originalTotalAmount,
  calculationMode = "manual",
  chargeMethod = "manual",
  chargeValue = null,
  chargeBasisAmount = null,
  cancellationSource = null,
  ruleBasis = null,
  hoursBeforeCheckIn = null,
  reason,
}) {
  return {
    settlementType:
      SETTLEMENT_TYPE,

    settlementStatus:
      STATUS_MANUAL_REVIEW,

    policySnapshotId,
    originalTotalAmount,
    chargeBasisAmount,
    calculationMode,
    chargeMethod,
    chargeValue,

    finalPayableAmount:
      null,

    cancellationSource,
    ruleBasis,
    hoursBeforeCheckIn,

    reviewReason:
      reason,
  };
}


function ruleValue(rule) {
  if (
    !rule ||
    typeof rule !== "object" ||
    Array.isArray(rule)
  ) {
    return null;
  }

  const method =
    normalizeText(
      rule.method
    );

  const rawValue =
    rule.value;

  const value =
    rawValue === undefined ||
    rawValue === null ||
    rawValue === ""
      ? 0
      : Number(rawValue);

  return {
    method,
    value,
  };
}


function resolveCustomerRule(
  policy,
  booking
) {
  const calculationMode =
    normalizeText(
      policy.calculation_mode
    );


  if (
    calculationMode !==
    "rules"
  ) {
    return {
      calculationMode:
        calculationMode ||
        "manual",

      reviewReason:
        "The booking-time cancellation policy requires manual financial review.",
    };
  }


  const checkIn =
    new Date(
      booking.check_in
    );

  const cancelledAt =
    new Date(
      booking.cancelled_at
    );


  if (
    Number.isNaN(
      checkIn.getTime()
    ) ||
    Number.isNaN(
      cancelledAt.getTime()
    )
  ) {
    return {
      calculationMode,

      reviewReason:
        "The cancellation time or scheduled check-in time is invalid.",
    };
  }


  const hoursBeforeCheckIn =
    Number(
      (
        (
          checkIn.getTime() -
          cancelledAt.getTime()
        ) /
        3600000
      ).toFixed(4)
    );


  if (
    hoursBeforeCheckIn < 0
  ) {
    return {
      calculationMode,
      hoursBeforeCheckIn,

      reviewReason:
        "The reservation was cancelled after its scheduled check-in time and requires review.",
    };
  }


  const sameDay =
    booking.check_in_date_key &&
    booking.cancelled_date_key &&
    booking.check_in_date_key ===
      booking.cancelled_date_key;


  if (sameDay) {
    return {
      calculationMode,

      chargeRule:
        policy.same_day_rule,

      ruleBasis:
        "same_day",

      hoursBeforeCheckIn,
    };
  }


  const rules =
    Array.isArray(
      policy.rules
    )
      ? policy.rules
      : [];

  const matches = [];


  for (const rule of rules) {
    if (
      !rule ||
      typeof rule !== "object" ||
      Array.isArray(rule)
    ) {
      continue;
    }


    const from =
      rule.from_hours_before ==
      null
        ? 0
        : Number(
            rule.from_hours_before
          );

    const to =
      rule.to_hours_before ==
      null
        ? Infinity
        : Number(
            rule.to_hours_before
          );


    if (
      !Number.isFinite(from) ||
      from < 0 ||
      (
        to !== Infinity &&
        (
          !Number.isFinite(to) ||
          to < 0
        )
      ) ||
      from > to
    ) {
      return {
        calculationMode,
        hoursBeforeCheckIn,

        reviewReason:
          "The booking-time cancellation slab configuration is invalid.",
      };
    }


    if (
      hoursBeforeCheckIn >= from &&
      hoursBeforeCheckIn <= to
    ) {
      matches.push(
        rule
      );
    }
  }


  if (
    matches.length === 0
  ) {
    return {
      calculationMode,
      hoursBeforeCheckIn,

      reviewReason:
        "No booking-time cancellation slab matches this cancellation time.",
    };
  }


  if (
    matches.length > 1
  ) {
    return {
      calculationMode,
      hoursBeforeCheckIn,

      reviewReason:
        "Multiple booking-time cancellation slabs match this cancellation time.",
    };
  }


  return {
    calculationMode,

    chargeRule:
      matches[0].charge,

    ruleBasis:
      "slab",

    hoursBeforeCheckIn,
  };
}


function calculateCancellationSettlement({
  booking,
  policySnapshotId = null,
  policySnapshot,
}) {
  const originalTotalAmount =
    nonNegativeMoney(
      booking?.total_amount
    );


  if (
    originalTotalAmount ===
    null
  ) {
    return manualReviewResult({
      policySnapshotId,

      originalTotalAmount:
        0,

      reason:
        "The original booking amount is invalid.",
    });
  }


  const snapshot =
    parsePolicySnapshot(
      policySnapshot
    );


  if (!snapshot) {
    return manualReviewResult({
      policySnapshotId,
      originalTotalAmount,

      reason:
        "The immutable booking policy snapshot is missing or invalid.",
    });
  }


  const policy =
    snapshot.cancellation;


  if (
    !policy ||
    typeof policy !==
      "object" ||
    Array.isArray(policy)
  ) {
    return manualReviewResult({
      policySnapshotId,
      originalTotalAmount,

      reason:
        "The booking-time cancellation policy is missing.",
    });
  }


  const cancellationSource =
    normalizeText(
      booking
        ?.cancellation_source
    );


  if (
    !VALID_SOURCES.has(
      cancellationSource
    )
  ) {
    return manualReviewResult({
      policySnapshotId,
      originalTotalAmount,

      cancellationSource:
        cancellationSource ||
        null,

      reason:
        "The cancellation source is missing or invalid.",
    });
  }


  if (
    !booking?.cancelled_at
  ) {
    return manualReviewResult({
      policySnapshotId,
      originalTotalAmount,
      cancellationSource,

      reason:
        "The actual cancellation time is missing.",
    });
  }


  let resolution;


  if (
    cancellationSource ===
    "hotel"
  ) {
    resolution = {
      calculationMode:
        "hotel_rule",

      chargeRule:
        policy
          .hotel_cancellation_rule,

      ruleBasis:
        "hotel_cancellation",

      hoursBeforeCheckIn:
        null,
    };
  } else {

    if (
      policy.enabled !== true
    ) {
      return manualReviewResult({
        policySnapshotId,
        originalTotalAmount,
        cancellationSource,

        calculationMode:
          normalizeText(
            policy
              .calculation_mode
          ) ||
          "manual",

        reason:
          "Customer cancellation was disabled in this booking's policy snapshot.",
      });
    }


    resolution =
      resolveCustomerRule(
        policy,
        booking
      );
  }


  if (
    resolution.reviewReason
  ) {
    return manualReviewResult({
      policySnapshotId,
      originalTotalAmount,
      cancellationSource,

      calculationMode:
        resolution
          .calculationMode ||
        "manual",

      ruleBasis:
        resolution.ruleBasis ||
        null,

      hoursBeforeCheckIn:
        resolution
          .hoursBeforeCheckIn ??
        null,

      reason:
        resolution
          .reviewReason,
    });
  }


  const normalizedRule =
    ruleValue(
      resolution.chargeRule
    );


  if (!normalizedRule) {
    return manualReviewResult({
      policySnapshotId,
      originalTotalAmount,
      cancellationSource,

      calculationMode:
        resolution
          .calculationMode,

      ruleBasis:
        resolution
          .ruleBasis,

      hoursBeforeCheckIn:
        resolution
          .hoursBeforeCheckIn ??
        null,

      reason:
        "The booking-time cancellation charge rule is missing or invalid.",
    });
  }


  const {
    method:
      chargeMethod,

    value:
      chargeValue,
  } = normalizedRule;


  if (
    !SUPPORTED_METHODS.has(
      chargeMethod
    )
  ) {
    return manualReviewResult({
      policySnapshotId,
      originalTotalAmount,
      cancellationSource,

      calculationMode:
        resolution
          .calculationMode,

      chargeMethod:
        chargeMethod ||
        "manual",

      chargeValue:
        Number.isFinite(
          chargeValue
        )
          ? money(
              chargeValue
            )
          : null,

      ruleBasis:
        resolution.ruleBasis,

      hoursBeforeCheckIn:
        resolution
          .hoursBeforeCheckIn ??
        null,

      reason:
        "The booking-time cancellation charge method is unsupported.",
    });
  }


  if (
    chargeMethod ===
    "manual"
  ) {
    return manualReviewResult({
      policySnapshotId,
      originalTotalAmount,
      cancellationSource,

      calculationMode:
        resolution
          .calculationMode,

      chargeMethod,

      chargeValue:
        0,

      ruleBasis:
        resolution.ruleBasis,

      hoursBeforeCheckIn:
        resolution
          .hoursBeforeCheckIn ??
        null,

      reason:
        "The booking-time cancellation charge rule requires manual review.",
    });
  }


  if (
    !Number.isFinite(
      chargeValue
    ) ||
    chargeValue < 0
  ) {
    return manualReviewResult({
      policySnapshotId,
      originalTotalAmount,
      cancellationSource,

      calculationMode:
        resolution
          .calculationMode,

      chargeMethod,

      chargeValue:
        null,

      ruleBasis:
        resolution.ruleBasis,

      hoursBeforeCheckIn:
        resolution
          .hoursBeforeCheckIn ??
        null,

      reason:
        "The booking-time cancellation charge value is invalid.",
    });
  }


  const bookedRatePerNight =
    nonNegativeMoney(
      booking
        ?.booked_rate_per_night
    ) ?? 0;


  let chargeBasisAmount =
    null;

  let calculatedAmount =
    null;


  switch (chargeMethod) {

    case "none":

      chargeBasisAmount =
        originalTotalAmount;

      calculatedAmount =
        0;

      break;


    case "fixed_amount":

      calculatedAmount =
        chargeValue;

      break;


    case "percentage":
    case "percentage_of_remaining":

      if (
        chargeValue > 100
      ) {
        return manualReviewResult({
          policySnapshotId,
          originalTotalAmount,
          cancellationSource,

          calculationMode:
            resolution
              .calculationMode,

          chargeMethod,

          chargeValue:
            money(
              chargeValue
            ),

          chargeBasisAmount:
            originalTotalAmount,

          ruleBasis:
            resolution
              .ruleBasis,

          hoursBeforeCheckIn:
            resolution
              .hoursBeforeCheckIn ??
            null,

          reason:
            "The cancellation percentage exceeds 100% and requires review.",
        });
      }


      chargeBasisAmount =
        originalTotalAmount;


      calculatedAmount =
        originalTotalAmount *
        (
          chargeValue /
          100
        );

      break;


    case "night_count":

      if (
        !Number.isSafeInteger(
          chargeValue
        )
      ) {
        return manualReviewResult({
          policySnapshotId,
          originalTotalAmount,
          cancellationSource,

          calculationMode:
            resolution
              .calculationMode,

          chargeMethod,

          chargeValue:
            money(
              chargeValue
            ),

          chargeBasisAmount:
            bookedRatePerNight,

          ruleBasis:
            resolution
              .ruleBasis,

          hoursBeforeCheckIn:
            resolution
              .hoursBeforeCheckIn ??
            null,

          reason:
            "The cancellation night-count rule must use a whole number of nights.",
        });
      }


      chargeBasisAmount =
        bookedRatePerNight;


      calculatedAmount =
        bookedRatePerNight *
        chargeValue;

      break;


    case "full_booking":

      chargeBasisAmount =
        originalTotalAmount;

      calculatedAmount =
        originalTotalAmount;

      break;


    default:

      return manualReviewResult({
        policySnapshotId,
        originalTotalAmount,
        cancellationSource,

        calculationMode:
          resolution
            .calculationMode,

        chargeMethod,

        chargeValue:
          money(
            chargeValue
          ),

        ruleBasis:
          resolution.ruleBasis,

        hoursBeforeCheckIn:
          resolution
            .hoursBeforeCheckIn ??
          null,

        reason:
          "The cancellation settlement could not be calculated automatically.",
      });
  }


  const normalizedAmount =
    nonNegativeMoney(
      calculatedAmount
    );


  if (
    normalizedAmount ===
    null
  ) {
    return manualReviewResult({
      policySnapshotId,
      originalTotalAmount,
      cancellationSource,

      calculationMode:
        resolution
          .calculationMode,

      chargeMethod,

      chargeValue:
        money(
          chargeValue
        ),

      chargeBasisAmount:
        money(
          chargeBasisAmount
        ),

      ruleBasis:
        resolution.ruleBasis,

      hoursBeforeCheckIn:
        resolution
          .hoursBeforeCheckIn ??
        null,

      reason:
        "The calculated cancellation charge is invalid.",
    });
  }


  return {
    settlementType:
      SETTLEMENT_TYPE,

    settlementStatus:
      STATUS_FINALIZED,

    policySnapshotId,
    originalTotalAmount,

    chargeBasisAmount:
      chargeBasisAmount ===
      null
        ? null
        : money(
            chargeBasisAmount
          ),

    calculationMode:
      resolution
        .calculationMode,

    chargeMethod,

    chargeValue:
      money(
        chargeValue
      ),

    finalPayableAmount:
      money(
        Math.min(
          normalizedAmount,
          originalTotalAmount
        )
      ),

    cancellationSource,

    ruleBasis:
      resolution.ruleBasis,

    hoursBeforeCheckIn:
      resolution
        .hoursBeforeCheckIn ??
      null,

    reviewReason:
      null,
  };
}


async function ensureCancellationSettlementWithConnection(
  connection,
  {
    hotelId,
    bookingId,
  }
) {
  const safeHotelId =
    positiveInteger(
      hotelId
    );

  const safeBookingId =
    positiveInteger(
      bookingId
    );


  if (
    !safeHotelId ||
    !safeBookingId
  ) {
    throw settlementError(
      500,
      "INVALID_CANCELLATION_SETTLEMENT_CONTEXT",
      "A valid hotel and booking are required for cancellation settlement."
    );
  }


  const [[booking]] =
    await connection.query(
      `
        SELECT
          b.booking_id,
          b.booking_code,
          b.booking_status,
          b.stay_type,

          b.booked_rate_per_night,
          b.total_amount,

          b.check_in,
          b.check_out,

          b.cancellation_source,
          b.cancellation_reason,
          b.cancelled_at,
          b.cancelled_by_admin_id,

          DATE_FORMAT(
            b.check_in,
            '%Y-%m-%d'
          ) AS check_in_date_key,

          DATE_FORMAT(
            b.cancelled_at,
            '%Y-%m-%d'
          ) AS cancelled_date_key,

          bps.snapshot_id,
          bps.policy_snapshot

        FROM bookings b

        LEFT JOIN booking_policy_snapshots bps
          ON bps.hotel_id =
             b.hotel_id

         AND bps.booking_id =
             b.booking_id

        WHERE b.hotel_id = ?
          AND b.booking_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        safeHotelId,
        safeBookingId,
      ]
    );


  if (!booking) {
    throw settlementError(
      404,
      "BOOKING_NOT_FOUND",
      "The booking could not be found for cancellation settlement."
    );
  }


  if (
    booking.booking_status !==
    "cancelled"
  ) {
    throw settlementError(
      409,
      "CANCELLATION_SETTLEMENT_NOT_ALLOWED",
      "A cancellation settlement can only be created after the booking has been cancelled."
    );
  }


  const existing =
    await getBookingFinancialSettlementWithConnection(
      connection,
      {
        hotelId:
          safeHotelId,

        bookingId:
          safeBookingId,

        settlementType:
          SETTLEMENT_TYPE,

        forUpdate:
          true,
      }
    );


  if (existing) {
    return {
      created:
        false,

      settlement:
        existing,
    };
  }


  const calculated =
    calculateCancellationSettlement({
      booking,

      policySnapshotId:
        booking.snapshot_id
          ? Number(
              booking.snapshot_id
            )
          : null,

      policySnapshot:
        booking.policy_snapshot,
    });


  const createdByAdminId =
    positiveInteger(
      booking
        .cancelled_by_admin_id
    );


  const [insertResult] =
    await connection.query(
      `
        INSERT INTO booking_financial_settlements (
          hotel_id,
          booking_id,

          settlement_type,
          settlement_status,

          policy_snapshot_id,

          original_total_amount,
          charge_basis_amount,

          calculation_mode,
          charge_method,
          charge_value,

          final_payable_amount,

          created_by_type,
          created_by_id,

          review_notes
        )

        VALUES (
          ?,
          ?,

          'cancellation',
          ?,

          ?,

          ?,
          ?,

          ?,
          ?,
          ?,

          ?,

          ?,
          ?,

          ?
        )
      `,
      [
        safeHotelId,
        safeBookingId,

        calculated
          .settlementStatus,

        calculated
          .policySnapshotId,

        calculated
          .originalTotalAmount,

        calculated
          .chargeBasisAmount,

        calculated
          .calculationMode,

        calculated
          .chargeMethod,

        calculated
          .chargeValue,

        calculated
          .finalPayableAmount,

        createdByAdminId
          ? "admin"
          : "system",

        createdByAdminId,

        calculated
          .reviewReason,
      ]
    );


  const createdSettlement =
    await getBookingFinancialSettlementWithConnection(
      connection,
      {
        hotelId:
          safeHotelId,

        bookingId:
          safeBookingId,

        settlementType:
          SETTLEMENT_TYPE,

        forUpdate:
          false,
      }
    );


  if (!createdSettlement) {
    throw settlementError(
      500,
      "CANCELLATION_SETTLEMENT_CREATE_FAILED",
      "The cancellation financial settlement could not be loaded after creation."
    );
  }


  return {
    created:
      true,

    settlementId:
      Number(
        insertResult.insertId
      ),

    calculation:
      calculated,

    settlement:
      createdSettlement,
  };
}


module.exports = {
  calculateCancellationSettlement,
  ensureCancellationSettlementWithConnection,
};