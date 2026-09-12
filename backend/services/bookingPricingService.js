const {
  buildCurrentPolicySnapshotWithConnection,
  getBookingPolicySnapshotWithConnection,
} = require("./hotelSettingsService");

const {
  prepareGuestRosters,
  calculateGuestCharges,
} = require("./bookingGuestService");

/* ============================================================
   BOOKING PRICING SERVICE

   Handles:
   - Overnight room pricing
   - Day Use / Short Stay pricing
   - Hotel policy based calculations

   Important:
   - Client total_amount is never trusted.
   - Early Check-In is calculated later from ACTUAL arrival.
   - Guest roster pricing is derived from the same hotel-policy
     state used for the room booking.
   - Child occupancy and actual extra-bed charges are included
     in the authoritative booking total.
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
   ROOM EXTRA-BED CAPACITY

   Physical room limit is independent from:
   - guest capacity
   - hotel-wide extra-bed pricing

   The roster has already been normalized by bookingGuestService,
   so required child beds and explicit adult/child bed usage are
   represented by guest.extraBedUsed here.
============================================================ */

function resolveRoomExtraBedLimit(
  room
) {
  const maxExtraBeds =
    Number(
      room?.max_extra_beds
    );

  const capacity =
    Number(
      room?.capacity
    );


  if (
    !Number.isSafeInteger(
      maxExtraBeds
    ) ||
    maxExtraBeds < 0 ||
    !Number.isSafeInteger(
      capacity
    ) ||
    capacity < 1 ||
    maxExtraBeds >
      capacity
  ) {
    throw pricingError(
      500,
      "INVALID_ROOM_EXTRA_BED_LIMIT",
      `Room ${
        room?.room_number ||
        "—"
      } has an invalid extra-bed capacity configuration.`
    );
  }


  return maxExtraBeds;
}


function validateRoomExtraBedUsage({
  room,
  roster,
}) {
  const maxExtraBeds =
    resolveRoomExtraBedLimit(
      room
    );


  /*
   * Legacy booking:
   * physical limit is known, but historical usage
   * must never be invented.
   */
  if (!roster) {
    return {
      maxExtraBeds,

      extraBedsUsed:
        null,
    };
  }


  const guests =
    Array.isArray(
      roster.guests
    )
      ? roster.guests
      : [];


  const extraBedsUsed =
    guests.reduce(
      (
        total,
        guest
      ) =>
        total +
        (
          guest?.extraBedUsed ===
          true
            ? 1
            : 0
        ),
      0
    );


  if (
    extraBedsUsed >
    maxExtraBeds
  ) {
    const roomNumber =
      room?.room_number ||
      "selected room";


    const message =
      maxExtraBeds === 0
        ? `Room ${roomNumber} does not allow extra beds.`
        : `Room ${roomNumber} allows a maximum of ${maxExtraBeds} extra bed${
            maxExtraBeds === 1
              ? ""
              : "s"
          }.`;


    throw pricingError(
      400,
      "ROOM_EXTRA_BED_LIMIT_EXCEEDED",
      message
    );
  }


  return {
    maxExtraBeds,

    extraBedsUsed,
  };
}

/* ============================================================
   GUEST PRICING CONTEXT

   Guest rosters are normalized against the SAME policy state
   used to calculate the room price.

   This is important because:
   - New booking uses current policy.
   - Existing booking edit uses immutable booking snapshot.
============================================================ */

function resolveGuestPricingRosters({
  items,
  roomMap,
  policyState,
  guestContext,
}) {
  const rosterCount =
    items.filter(
      (item) =>
        item?.guestRosterProvided ===
        true
    ).length;


  /*
   * Legacy bookings / transitional API calls.
   *
   * No roster means old pricing remains exactly unchanged.
   */
  if (
    rosterCount === 0
  ) {
    return {
      rosters: null,
      guestPolicy: null,
    };
  }


  /*
   * Never allow partially migrated multi-room requests.
   *
   * Either every room carries its occupant roster,
   * or none of them do.
   */
  if (
    rosterCount !==
    items.length
  ) {
    throw pricingError(
      400,
      "INCOMPLETE_GUEST_ROSTER",
      "Guest details must be provided for every room in the reservation."
    );
  }


  if (
    !guestContext ||
    typeof guestContext !==
      "object" ||
    Array.isArray(
      guestContext
    )
  ) {
    throw pricingError(
      500,
      "GUEST_PRICING_CONTEXT_MISSING",
      "Guest pricing context was not provided."
    );
  }


  const primaryMode =
    String(
      guestContext.primaryMode ||
      ""
    ).trim();


  if (!primaryMode) {
    throw pricingError(
      500,
      "PRIMARY_GUEST_MODE_MISSING",
      "Primary guest allocation mode was not provided for pricing."
    );
  }


  const guestPolicy =
    policyState
      ?.policySnapshot
      ?.guest_requirements;


  if (
    !guestPolicy ||
    typeof guestPolicy !==
      "object"
  ) {
    throw pricingError(
      500,
      "GUEST_POLICY_MISSING",
      "The hotel's Guest & Occupancy policy could not be resolved."
    );
  }


  const prepared =
    prepareGuestRosters({
      rooms:
        items,

      roomMap,

      guestPolicy,

      primaryCustomer:
        guestContext
          .primaryCustomer ||
        null,

      primaryMode,
    });


  if (
    !Array.isArray(
      prepared.rooms
    ) ||
    prepared.rooms.length !==
      items.length
  ) {
    throw pricingError(
      500,
      "GUEST_ROSTER_PREPARATION_FAILED",
      "The room guest roster could not be prepared for pricing."
    );
  }


  return {
    rosters:
      prepared.rooms,

    guestPolicy:
      prepared.policy,

    totalGuests:
      prepared.totalGuests,

    primaryCount:
      prepared.primaryCount,
  };
}


/* ============================================================
   ADD GUEST CHARGES TO ROOM PRICE
============================================================ */

function applyGuestChargesToPrice({
  item,
  room,
  basePrice,
  roster,
  guestPolicy,
}) {
  const extraBedUsage =
    validateRoomExtraBedUsage({
      room,
      roster,
    });


  /*
   * Legacy booking without occupant details.
   *
   * Room's physical limit is still known, but we do not
   * invent historical extra-bed usage.
   */
  if (!roster) {
    return {
      ...basePrice,

      guestRosterProvided:
        false,

      maxExtraBeds:
        extraBedUsage
          .maxExtraBeds,

      extraBedsUsed:
        null,

      childChargeAmount:
        0,

      extraBedChargeAmount:
        0,

      guestChargeAmount:
        0,
    };
  }


  const guestCharges =
    calculateGuestCharges({
      roster,

      stayType:
        item.stayType,

      nights:
        basePrice.nights,

      ratePerNight:
        basePrice.ratePerNight,

      guestPolicy,
    });


  const childChargeAmount =
    money(
      guestCharges
        .childChargeTotal
    );


  const extraBedChargeAmount =
    money(
      guestCharges
        .extraBedChargeTotal
    );


  const guestChargeAmount =
    money(
      guestCharges
        .totalGuestCharges
    );


  const totalAmount =
    money(
      Number(
        basePrice.totalAmount ||
        0
      ) +
      guestChargeAmount
    );


  return {
    ...basePrice,

    guestRosterProvided:
      true,

    totalGuests:
      roster.totalGuests,

    maxExtraBeds:
      extraBedUsage
        .maxExtraBeds,

    extraBedsUsed:
      extraBedUsage
        .extraBedsUsed,

    childChargeAmount,

    extraBedChargeAmount,

    guestChargeAmount,

    totalAmount,

    guestRoster: {
      roomId:
        roster.roomId,

      roomNumber:
        roster.roomNumber,

      primaryGuestStaying:
        roster.primaryGuestStaying,

      totalGuests:
        roster.totalGuests,

      maxExtraBeds:
        extraBedUsage
          .maxExtraBeds,

      extraBedsUsed:
        extraBedUsage
          .extraBedsUsed,

      guests:
        guestCharges.guests,
    },
  };
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
  guestContext = null,
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


  const guestPricing =
    resolveGuestPricingRosters({
      items,
      roomMap,
      policyState,
      guestContext,
    });


  return items.map(
    (
      item,
      index
    ) => {
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


      let basePrice;


      if (
        item.stayType ===
        "day_use"
      ) {
        basePrice =
          calculateDayUsePrice({
            item,
            room,

            policy:
              dayUsePolicy,
          });
      } else if (
        item.stayType ===
        "overnight"
      ) {
        basePrice =
          calculateOvernightPrice({
            item,
            room,
          });
      } else {
        throw pricingError(
          400,
          "INVALID_STAY_TYPE",
          "The booking stay type is invalid."
        );
      }


      return applyGuestChargesToPrice({
        item,

        room,

        basePrice,

        roster:
          guestPricing.rosters
            ? guestPricing
                .rosters[
                  index
                ]
            : null,

        guestPolicy:
          guestPricing
            .guestPolicy,
      });
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
    guestContext = null,
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
      guestContext,
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
    guestContext = null,
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
      guestContext,
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