/* ============================================================
   BOOKING FINANCIAL SETTLEMENT SERVICE

   Purpose:
   Preserve original booking value while deriving the final
   payable amount for lifecycle events such as No Show.

   Important:
   - bookings.total_amount is NEVER overwritten here.
   - Immutable booking-time policy snapshot is authoritative.
   - Current hotel settings are NEVER substituted.
   - Repeated reconciliation is idempotent.
   - Manual/invalid historical rules require review rather
     than inventing an amount.
============================================================ */


/* ============================================================
   CONSTANTS
============================================================ */

const SETTLEMENT_TYPE_NO_SHOW =
  "no_show";


const STATUS_FINALIZED =
  "finalized";


const STATUS_MANUAL_REVIEW =
  "manual_review_required";


const SUPPORTED_NO_SHOW_METHODS =
  new Set([
    "none",
    "fixed_amount",
    "percentage",
    "night_count",
    "actual_nights",
    "full_booking",
    "percentage_of_remaining",
    "manual",
  ]);


/* ============================================================
   ERROR HELPER
============================================================ */

function settlementError(
  status,
  code,
  message
) {
  const error =
    new Error(message);

  error.status =
    status;

  error.code =
    code;

  return error;
}


/* ============================================================
   NORMALIZATION HELPERS
============================================================ */

function positiveInteger(
  value
) {
  const number =
    Number(value);

  return (
    Number.isSafeInteger(
      number
    ) &&
    number > 0
  )
    ? number
    : null;
}


function money(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }


  return Number(
    number.toFixed(2)
  );
}


function nonNegativeMoney(
  value
) {
  const number =
    money(value);

  if (
    number === null ||
    number < 0
  ) {
    return null;
  }


  return number;
}


function normalizeText(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}


function parsePolicySnapshot(
  value
) {
  if (
    !value
  ) {
    return null;
  }


  if (
    typeof value ===
      "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }


  if (
    typeof value !==
    "string"
  ) {
    return null;
  }


  try {
    const parsed =
      JSON.parse(value);

    return (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(parsed)
    )
      ? parsed
      : null;
  } catch {
    return null;
  }
}


/* ============================================================
   DATE / NIGHT HELPERS
============================================================ */

function calculatePlannedNights(
  checkIn,
  checkOut
) {
  const start =
    new Date(checkIn);

  const end =
    new Date(checkOut);


  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    ) ||
    end <= start
  ) {
    return 0;
  }


  const milliseconds =
    end.getTime() -
    start.getTime();


  return Math.max(
    1,
    Math.ceil(
      milliseconds /
      (
        24 *
        60 *
        60 *
        1000
      )
    )
  );
}


function calculateActualNights(
  actualCheckIn,
  actualCheckOut
) {
  if (
    !actualCheckIn ||
    !actualCheckOut
  ) {
    return 0;
  }


  const start =
    new Date(
      actualCheckIn
    );

  const end =
    new Date(
      actualCheckOut
    );


  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    ) ||
    end <= start
  ) {
    return 0;
  }


  return Math.max(
    0,
    Math.ceil(
      (
        end.getTime() -
        start.getTime()
      ) /
      (
        24 *
        60 *
        60 *
        1000
      )
    )
  );
}


/* ============================================================
   MANUAL REVIEW RESULT

   Used when:
   - snapshot missing
   - snapshot malformed
   - calculation mode manual
   - charge rule unsupported
   - charge value invalid

   Lifecycle may still become No Show.
   Only financial settlement waits for review.
============================================================ */

function manualReviewResult({
  policySnapshotId = null,
  originalTotalAmount,
  calculationMode =
    "manual",
  chargeMethod =
    "manual",
  chargeValue =
    null,
  chargeBasisAmount =
    null,
  reason,
}) {
  return {
    settlementType:
      SETTLEMENT_TYPE_NO_SHOW,

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

    reviewReason:
      reason,
  };
}


/* ============================================================
   CALCULATE NO-SHOW SETTLEMENT

   This function does not write to DB.

   Important:
   final payable is the amount the booking should financially
   settle at AFTER becoming No Show.

   Example:
   booking total = 4000
   percentage    = 20
   payable       = 800
============================================================ */

function calculateNoShowSettlement({
  booking,
  policySnapshotId =
    null,
  policySnapshot,
}) {
  const originalTotalAmount =
    nonNegativeMoney(
      booking
        ?.total_amount
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


  const noShowPolicy =
    snapshot.no_show;


  if (
    !noShowPolicy ||
    typeof noShowPolicy !==
      "object" ||
    Array.isArray(
      noShowPolicy
    )
  ) {
    return manualReviewResult({
      policySnapshotId,

      originalTotalAmount,

      reason:
        "The booking-time No Show policy is missing.",
    });
  }

  /*
  * A booking can still be lifecycle-closed as No Show after
  * the complete stay window passes even when automatic
  * No-Show handling was disabled at booking time.
  *
  * In that case HMS must not silently apply the disabled
  * No-Show charge rule. Financial treatment requires review.
  */
  if (
    noShowPolicy.enabled !==
    true
  ) {
    return manualReviewResult({
      policySnapshotId,

      originalTotalAmount,

      calculationMode:
        normalizeText(
          noShowPolicy
            .calculation_mode
        ) ||
        "manual",

      chargeMethod:
        normalizeText(
          noShowPolicy
            ?.charge_rule
            ?.method
        ) ||
        "manual",

      chargeValue:
        Number.isFinite(
          Number(
            noShowPolicy
              ?.charge_rule
              ?.value
          )
        )
          ? money(
              Number(
                noShowPolicy
                  ?.charge_rule
                  ?.value
              )
            )
          : null,

      reason:
        "Automatic No Show handling was disabled in this booking's policy snapshot, so the financial settlement requires review.",
    });
  }

  const calculationMode =
    normalizeText(
      noShowPolicy
        .calculation_mode
    );


  const chargeRule =
    noShowPolicy
      .charge_rule;


  const chargeMethod =
    normalizeText(
      chargeRule
        ?.method
    );


  const rawChargeValue =
    chargeRule
      ?.value;


  const chargeValue =
    rawChargeValue ===
      undefined ||
    rawChargeValue ===
      null ||
    rawChargeValue ===
      ""
      ? 0
      : Number(
          rawChargeValue
        );


  /*
   * Manual mode means the hotel intentionally requires
   * human financial review.
   */
  if (
    calculationMode !==
      "rules"
  ) {
    return manualReviewResult({
      policySnapshotId,

      originalTotalAmount,

      calculationMode:
        calculationMode ||
        "manual",

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

      reason:
        "The booking-time No Show policy requires manual financial review.",
    });
  }


  if (
    !SUPPORTED_NO_SHOW_METHODS
      .has(
        chargeMethod
      )
  ) {
    return manualReviewResult({
      policySnapshotId,

      originalTotalAmount,

      calculationMode,

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

      reason:
        "The booking-time No Show charge method is unsupported.",
    });
  }


  if (
    chargeMethod ===
      "manual"
  ) {
    return manualReviewResult({
      policySnapshotId,

      originalTotalAmount,

      calculationMode,

      chargeMethod,

      chargeValue:
        0,

      reason:
        "The booking-time No Show charge rule requires manual review.",
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

      calculationMode,

      chargeMethod,

      chargeValue:
        null,

      reason:
        "The booking-time No Show charge value is invalid.",
    });
  }


  const bookedRatePerNight =
    nonNegativeMoney(
      booking
        ?.booked_rate_per_night
    ) ?? 0;


  const plannedNights =
    calculatePlannedNights(
      booking?.check_in,
      booking?.check_out
    );


  const actualNights =
    calculateActualNights(
      booking
        ?.actual_check_in,

      booking
        ?.actual_check_out
    );


  let chargeBasisAmount =
    null;


  let calculatedAmount =
    null;


  switch (
    chargeMethod
  ) {
    case "none": {
      chargeBasisAmount =
        originalTotalAmount;

      calculatedAmount =
        0;

      break;
    }


    case "fixed_amount": {
      calculatedAmount =
        chargeValue;

      break;
    }


    case "percentage": {
      if (
        chargeValue > 100
      ) {
        return manualReviewResult({
          policySnapshotId,

          originalTotalAmount,

          calculationMode,

          chargeMethod,

          chargeValue:
            money(
              chargeValue
            ),

          chargeBasisAmount:
            originalTotalAmount,

          reason:
            "The No Show percentage exceeds 100% and requires review.",
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
    }


    case "night_count": {
      if (
        !Number.isSafeInteger(
          chargeValue
        )
      ) {
        return manualReviewResult({
          policySnapshotId,

          originalTotalAmount,

          calculationMode,

          chargeMethod,

          chargeValue:
            money(
              chargeValue
            ),

          chargeBasisAmount:
            bookedRatePerNight,

          reason:
            "The No Show night-count rule must use a whole number of nights.",
        });
      }


      chargeBasisAmount =
        bookedRatePerNight;


      calculatedAmount =
        bookedRatePerNight *
        chargeValue;

      break;
    }


    case "actual_nights": {
      chargeBasisAmount =
        bookedRatePerNight;


      calculatedAmount =
        bookedRatePerNight *
        actualNights;

      break;
    }


    case "full_booking": {
      chargeBasisAmount =
        originalTotalAmount;


      calculatedAmount =
        originalTotalAmount;

      break;
    }


    case "percentage_of_remaining": {
      /*
       * A No Show has no consumed stay.
       *
       * Therefore the remaining contracted booking value is
       * the original booking amount.
       *
       * Payments are NOT deducted from the charge basis.
       * Payments are compared with final payable separately
       * to determine outstanding/refund due.
       */
      if (
        chargeValue > 100
      ) {
        return manualReviewResult({
          policySnapshotId,

          originalTotalAmount,

          calculationMode,

          chargeMethod,

          chargeValue:
            money(
              chargeValue
            ),

          chargeBasisAmount:
            originalTotalAmount,

          reason:
            "The No Show remaining-value percentage exceeds 100% and requires review.",
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
    }


    default: {
      return manualReviewResult({
        policySnapshotId,

        originalTotalAmount,

        calculationMode,

        chargeMethod,

        chargeValue:
          money(
            chargeValue
          ),

        reason:
          "The No Show settlement could not be calculated automatically.",
      });
    }
  }


  const normalizedCalculatedAmount =
    nonNegativeMoney(
      calculatedAmount
    );


  if (
    normalizedCalculatedAmount ===
      null
  ) {
    return manualReviewResult({
      policySnapshotId,

      originalTotalAmount,

      calculationMode,

      chargeMethod,

      chargeValue:
        money(
          chargeValue
        ),

      chargeBasisAmount:
        money(
          chargeBasisAmount
        ),

      reason:
        "The calculated No Show charge is invalid.",
    });
  }


  /*
   * No-Show settlement cannot exceed the original contracted
   * booking value unless HMS later introduces an explicit
   * surcharge/penalty concept.
   */
  const finalPayableAmount =
    money(
      Math.min(
        normalizedCalculatedAmount,
        originalTotalAmount
      )
    );


  return {
    settlementType:
      SETTLEMENT_TYPE_NO_SHOW,

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

    calculationMode,

    chargeMethod,

    chargeValue:
      money(
        chargeValue
      ),

    finalPayableAmount,

    reviewReason:
      null,

    plannedNights,

    actualNights,
  };
}


/* ============================================================
   READ EXISTING SETTLEMENT

   FOR UPDATE makes concurrent lifecycle reconciliation safe.
============================================================ */

async function getBookingFinancialSettlementWithConnection(
  connection,
  {
    hotelId,
    bookingId,
    settlementType,
    forUpdate = false,
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


  const safeSettlementType =
    normalizeText(
      settlementType
    );


  if (
    !safeHotelId ||
    !safeBookingId ||
    !safeSettlementType
  ) {
    throw settlementError(
      500,
      "INVALID_SETTLEMENT_LOOKUP",
      "A valid hotel, booking and settlement type are required."
    );
  }


  const [[row]] =
    await connection.query(
      `
        SELECT
          settlement_id,
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

          reviewed_by_type,
          reviewed_by_id,
          reviewed_at,
          review_notes,

          created_at,
          updated_at

        FROM booking_financial_settlements

        WHERE hotel_id = ?
          AND booking_id = ?
          AND settlement_type = ?

        LIMIT 1

        ${
          forUpdate
            ? "FOR UPDATE"
            : ""
        }
      `,
      [
        safeHotelId,
        safeBookingId,
        safeSettlementType,
      ]
    );


  return row || null;
}


/* ============================================================
   ENSURE NO-SHOW SETTLEMENT

   Idempotent:
   existing settlement is returned unchanged.

   This preserves the exact financial decision made when the
   booking first entered No Show.
============================================================ */

async function ensureNoShowSettlementWithConnection(
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
      "INVALID_NO_SHOW_SETTLEMENT_CONTEXT",
      "A valid hotel and booking are required for No Show settlement."
    );
  }


  /*
   * Load original contractual booking value and its immutable
   * booking-time policy snapshot.
   */
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

          b.actual_check_in,
          b.actual_check_out,

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
      "The booking could not be found for No Show settlement."
    );
  }


  /*
  * Financial settlement is created only after the booking
  * lifecycle has actually transitioned to No Show.
  *
  * The caller must update confirmed -> no_show first inside
  * the same transaction.
  */
  if (
    booking.booking_status !==
    "no_show"
  ) {
    throw settlementError(
      409,
      "NO_SHOW_SETTLEMENT_NOT_ALLOWED",
      "A No Show financial settlement can only be created after the reservation has been marked No Show."
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
          SETTLEMENT_TYPE_NO_SHOW,

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
    calculateNoShowSettlement({
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
          ?, ?,
          'no_show', ?,
          ?,
          ?, ?,
          ?, ?, ?,
          ?,
          'system', NULL,
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

        calculated
          .reviewReason,
      ]
    );


  const settlementId =
    Number(
      insertResult.insertId
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
          SETTLEMENT_TYPE_NO_SHOW,

        forUpdate:
          false,
      }
    );


  if (!createdSettlement) {
    throw settlementError(
      500,
      "NO_SHOW_SETTLEMENT_CREATE_FAILED",
      "The No Show financial settlement could not be loaded after creation."
    );
  }


  return {
    created:
      true,

    settlementId,

    calculation:
      calculated,

    settlement:
      createdSettlement,
  };
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  calculateNoShowSettlement,

  getBookingFinancialSettlementWithConnection,

  ensureNoShowSettlementWithConnection,
};