const {
  buildCurrentPolicySnapshotWithConnection,
  getBookingPolicySnapshotWithConnection,
} = require("./hotelSettingsService");


/* ============================================================
   BOOKING PRICING SERVICE

   Handles:
   - Overnight room pricing
   - Day Use / Short Stay pricing
   - Hotel policy based calculations

   Important:
   - Client total_amount is never trusted.
   - Early Check-In is calculated later from ACTUAL arrival.
   - Child / Extra Bed charges will be connected when guest
     roster data is connected to booking.
============================================================ */


function pricingError(
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


function money(
  value
) {
  return Number(
    Number(value)
      .toFixed(2)
  );
}


function validRoomRate(
  room
) {
  const rate =
    Number(
      room?.price_per_night
    );


  if (
    !Number.isFinite(rate) ||
    rate < 0
  ) {
    throw pricingError(
      500,
      "INVALID_ROOM_RATE",
      "The selected room has an invalid nightly rate."
    );
  }


  return money(rate);
}


/* ============================================================
   OVERNIGHT
============================================================ */

function calculateOvernightPrice({
  item,
  room,
}) {
  const ratePerNight =
    validRoomRate(room);


  const nights =
    Number(
      item?.nights
    );


  if (
    !Number.isSafeInteger(
      nights
    ) ||
    nights < 1
  ) {
    throw pricingError(
      400,
      "INVALID_OVERNIGHT_DURATION",
      "An overnight booking must contain at least one hotel night."
    );
  }


  const roomCharge =
    money(
      ratePerNight *
      nights
    );


  return {
    roomId:
      item.roomId,

    stayType:
      "overnight",

    pricingMode:
      "nightly",

    nights,

    durationMinutes:
      Number(
        item.durationMinutes ||
        0
      ),

    ratePerNight,

    roomCharge,

    totalAmount:
      roomCharge,
  };
}


/* ============================================================
   DAY USE SLAB MATCH
============================================================ */

function findDayUseSlab(
  slabs,
  durationMinutes
) {
  const safeSlabs =
    Array.isArray(slabs)
      ? slabs
      : [];


  return (
    safeSlabs.find(
      (slab) =>
        durationMinutes <=
        Number(
          slab?.up_to_hours
        ) * 60
    ) ||
    null
  );
}


/* ============================================================
   DAY USE
============================================================ */

function calculateDayUsePrice({
  item,
  room,
  policy,
}) {
  if (
    policy?.enabled !==
    true
  ) {
    throw pricingError(
      409,
      "DAY_USE_DISABLED",
      "Day Use / Short Stay is disabled for this hotel."
    );
  }


  const ratePerNight =
    validRoomRate(room);


  const durationMinutes =
    Number(
      item?.durationMinutes
    );


  if (
    !Number.isFinite(
      durationMinutes
    ) ||
    durationMinutes <= 0
  ) {
    throw pricingError(
      400,
      "INVALID_DAY_USE_DURATION",
      "Day Use / Short Stay duration is invalid."
    );
  }


  const pricingMode =
    String(
      policy?.pricing_mode ||
      ""
    );


  /* ==========================================================
     FIXED SLOT / PERCENTAGE SLAB
  ========================================================== */

  if (
    [
      "fixed_slots",
      "percentage_slabs",
    ].includes(
      pricingMode
    )
  ) {
    const slab =
      findDayUseSlab(
        policy?.pricing_slabs,
        durationMinutes
      );


    if (!slab) {
      throw pricingError(
        409,
        "DAY_USE_DURATION_EXCEEDED",
        "The requested short stay exceeds the configured Day Use duration. Create an overnight reservation instead."
      );
    }


    const slabValue =
      Number(
        slab.value
      );


    let roomCharge;


    if (
      pricingMode ===
      "fixed_slots"
    ) {
      roomCharge =
        money(
          slabValue
        );
    } else {
      roomCharge =
        money(
          ratePerNight *
          (
            slabValue /
            100
          )
        );
    }


    return {
      roomId:
        item.roomId,

      stayType:
        "day_use",

      pricingMode,

      nights: 0,

      durationMinutes,

      ratePerNight,

      matchedUpToHours:
        Number(
          slab.up_to_hours
        ),

      appliedValue:
        slabValue,

      roomCharge,

      totalAmount:
        roomCharge,
    };
  }


  /* ==========================================================
     HOURLY DAY USE
  ========================================================== */

  if (
    pricingMode ===
    "hourly"
  ) {
    const maximumHours =
      Number(
        policy
          ?.maximum_day_use_hours
      );


    if (
      !Number.isFinite(
        maximumHours
      ) ||
      maximumHours <= 0
    ) {
      throw pricingError(
        500,
        "INVALID_DAY_USE_MAXIMUM_HOURS",
        "The hotel's Day Use maximum duration is invalid."
      );
    }


    if (
      durationMinutes >
      maximumHours * 60
    ) {
      throw pricingError(
        409,
        "DAY_USE_DURATION_EXCEEDED",
        "The requested short stay exceeds the configured Day Use duration. Create an overnight reservation instead."
      );
    }


    const rateType =
      String(
        policy
          ?.hourly_rate_type ||
        ""
      );


    const rateValue =
      Number(
        policy
          ?.hourly_rate_value
      );


    if (
      !Number.isFinite(
        rateValue
      ) ||
      rateValue < 0
    ) {
      throw pricingError(
        500,
        "INVALID_DAY_USE_HOURLY_RATE",
        "The hotel's Day Use hourly rate is invalid."
      );
    }


    /*
     * Exact elapsed time is used.
     *
     * 2 hours 30 minutes = 2.5 hours.
     *
     * This keeps billing automatic without adding
     * another confusing hourly-rounding setting.
     */
    const exactHours =
      durationMinutes /
      60;


    let rawCharge;


    if (
      rateType ===
      "fixed_amount"
    ) {
      rawCharge =
        rateValue *
        exactHours;
    } else if (
      rateType ===
      "percentage_of_night"
    ) {
      rawCharge =
        ratePerNight *
        (
          rateValue /
          100
        ) *
        exactHours;
    } else {
      throw pricingError(
        500,
        "INVALID_DAY_USE_HOURLY_TYPE",
        "The hotel's Day Use hourly-rate type is invalid."
      );
    }


    const capPercent =
      Number(
        policy
          ?.maximum_day_use_charge_percent
      );


    if (
      !Number.isFinite(
        capPercent
      ) ||
      capPercent <= 0 ||
      capPercent > 100
    ) {
      throw pricingError(
        500,
        "INVALID_DAY_USE_CHARGE_CAP",
        "The hotel's Day Use charge cap is invalid."
      );
    }


    const maximumCharge =
      ratePerNight *
      (
        capPercent /
        100
      );


    const roomCharge =
      money(
        Math.min(
          rawCharge,
          maximumCharge
        )
      );


    return {
      roomId:
        item.roomId,

      stayType:
        "day_use",

      pricingMode:
        "hourly",

      nights: 0,

      durationMinutes,

      exactHours:
        Number(
          exactHours
            .toFixed(4)
        ),

      ratePerNight,

      hourlyRateType:
        rateType,

      hourlyRateValue:
        rateValue,

      maximumChargePercent:
        capPercent,

      roomCharge,

      totalAmount:
        roomCharge,
    };
  }


  throw pricingError(
    500,
    "INVALID_DAY_USE_PRICING_MODE",
    "The hotel's Day Use pricing mode is invalid."
  );
}

/* ============================================================
   PRICE ITEMS AGAINST A GIVEN POLICY STATE

   Used by:
   - New booking       → current hotel policy
   - Existing booking  → booking-time immutable snapshot

   Actual pricing formulas remain in one place.
============================================================ */

function priceBookingItemsAgainstPolicyState({
  items,
  roomMap,
  policyState,
}) {
  if (
    !Array.isArray(items) ||
    !items.length
  ) {
    throw pricingError(
      400,
      "BOOKING_ITEMS_REQUIRED",
      "At least one booking item is required for pricing."
    );
  }


  if (
    !policyState ||
    typeof policyState !==
      "object"
  ) {
    throw pricingError(
      500,
      "BOOKING_POLICY_MISSING",
      "The booking pricing policy could not be resolved."
    );
  }


  const dayUsePolicy =
    policyState
      ?.policySnapshot
      ?.day_use ||
    {};


  return items.map(
    (item) => {
      const room =
        roomMap?.get(
          item.roomId
        );


      if (!room) {
        throw pricingError(
          404,
          "ROOM_NOT_FOUND_FOR_PRICING",
          "The selected room could not be found for pricing."
        );
      }


      if (
        item.stayType ===
        "day_use"
      ) {
        return calculateDayUsePrice({
          item,
          room,

          policy:
            dayUsePolicy,
        });
      }


      if (
        item.stayType ===
        "overnight"
      ) {
        return calculateOvernightPrice({
          item,
          room,
        });
      }


      throw pricingError(
        400,
        "INVALID_STAY_TYPE",
        "The booking stay type is invalid."
      );
    }
  );
}

/* ============================================================
   PRICE COMPLETE BOOKING REQUEST

   Reads hotel policies once, then prices all rooms.
============================================================ */

async function priceBookingItemsWithConnection(
  connection,
  {
    hotelId,
    items,
    roomMap,
  }
) {
  const hId =
    Number(
      hotelId
    );


  if (
    !connection ||
    !Number.isSafeInteger(
      hId
    ) ||
    hId <= 0
  ) {
    throw pricingError(
      500,
      "INVALID_PRICING_CONTEXT",
      "Booking pricing context is invalid."
    );
  }


  const policyState =
    await buildCurrentPolicySnapshotWithConnection(
      connection,
      hId
    );


  const prices =
    priceBookingItemsAgainstPolicyState({
      items,
      roomMap,
      policyState,
    });


  return {
    prices,

    policySource:
      "current",

    snapshotId:
      null,

    policyVersions:
      policyState
        .policyVersions,

    policySnapshot:
      policyState
        .policySnapshot,
  };
}

/* ============================================================
   PRICE EXISTING BOOKING USING ITS ORIGINAL POLICY SNAPSHOT

   Hotel settings may have changed after booking creation.

   Example:
   Booking created:
     6h Day Use = 50%

   Hotel later changes:
     6h Day Use = 70%

   Editing old reservation still uses:
     50%
============================================================ */

async function priceBookingItemsFromSnapshotWithConnection(
  connection,
  {
    hotelId,
    bookingId,
    items,
    roomMap,
  }
) {
  const hId =
    Number(
      hotelId
    );


  const bId =
    Number(
      bookingId
    );


  if (
    !connection ||
    !Number.isSafeInteger(
      hId
    ) ||
    hId <= 0 ||
    !Number.isSafeInteger(
      bId
    ) ||
    bId <= 0
  ) {
    throw pricingError(
      500,
      "INVALID_SNAPSHOT_PRICING_CONTEXT",
      "The booking snapshot pricing context is invalid."
    );
  }


  const snapshot =
    await getBookingPolicySnapshotWithConnection(
      connection,
      {
        hotelId:
          hId,

        bookingId:
          bId,
      }
    );


  /*
   * Legacy bookings created before policy snapshots existed
   * must never be repriced using today's policy pretending
   * that it was their original policy.
   */
  if (!snapshot) {
    throw pricingError(
      409,
      "BOOKING_POLICY_SNAPSHOT_MISSING",
      "This legacy booking does not have its original hotel-policy snapshot, so automatic policy-based repricing is unavailable."
    );
  }


  const policyState = {
    policyVersions:
      snapshot
        .policyVersions,

    policySnapshot:
      snapshot
        .policySnapshot,
  };


  const prices =
    priceBookingItemsAgainstPolicyState({
      items,
      roomMap,
      policyState,
    });


  return {
    prices,

    policySource:
      "booking_snapshot",

    snapshotId:
      snapshot
        .snapshotId,

    policyVersions:
      snapshot
        .policyVersions,

    policySnapshot:
      snapshot
        .policySnapshot,

    snapshotCreatedAt:
      snapshot
        .createdAt,
  };
}


module.exports = {
  calculateOvernightPrice,
  calculateDayUsePrice,

  priceBookingItemsAgainstPolicyState,

  priceBookingItemsWithConnection,

  priceBookingItemsFromSnapshotWithConnection,
};