/* ============================================================
   BOOKING GUEST / OCCUPANCY SERVICE

   Responsibilities:
   - Normalize room-wise staying guest roster
   - Enforce hotel guest requirement policy
   - Enforce one primary guest placement for new reservation
   - Derive total_guests from actual roster
   - Calculate child / extra-bed charges
   - Persist and read booking_guests

   Important:
   - Customer = reservation owner / primary guest profile.
   - Accompanying guests do NOT become customer records.
   - Day Use currently records occupants but does not apply
     per-night child / extra-bed charges.
============================================================ */

const MAX_GUEST_AGE = 120;

const GUEST_TYPES = new Set([
  "adult",
  "child",
]);

const PRIMARY_MODES = new Set([
  "exactly_one",
  "none",
  "zero_or_one",
]);

const CHILD_CHARGE_METHODS = new Set([
  "none",
  "fixed_amount",
  "percentage",
]);

const CHILD_BED_POLICIES = new Set([
  "share_existing_bed",
  "extra_bed_optional",
  "extra_bed_required",
]);


/* ============================================================
   ERROR / BASIC HELPERS
============================================================ */

function guestError(
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


function positiveId(
  value,
  label
) {
  const id =
    Number(value);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw guestError(
      500,
      "INVALID_GUEST_SERVICE_CONTEXT",
      `${label} is invalid.`
    );
  }

  return id;
}


function money(value) {
  const amount =
    Number(value);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw guestError(
      500,
      "INVALID_GUEST_CHARGE",
      "A guest charge calculation produced an invalid amount."
    );
  }

  return Number(
    amount.toFixed(2)
  );
}


function optionalText(
  value,
  maxLength,
  label
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const text =
    String(value).trim();

  if (
    text.length >
    maxLength
  ) {
    throw guestError(
      400,
      "INVALID_GUEST_DETAILS",
      `${label} must not exceed ${maxLength} characters.`
    );
  }

  return text;
}


function strictBoolean(
  value,
  label,
  defaultValue = false
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return defaultValue;
  }

  if (
    value === true ||
    value === 1 ||
    value === "1"
  ) {
    return true;
  }

  if (
    value === false ||
    value === 0 ||
    value === "0"
  ) {
    return false;
  }

  throw guestError(
    400,
    "INVALID_GUEST_DETAILS",
    `${label} must be true or false.`
  );
}


function normalizeAge(
  value,
  {
    required,
    label,
  }
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    if (required) {
      throw guestError(
        400,
        "GUEST_AGE_REQUIRED",
        `${label} age is required by hotel policy.`
      );
    }

    return null;
  }

  const age =
    Number(value);

  if (
    !Number.isSafeInteger(age) ||
    age < 0 ||
    age > MAX_GUEST_AGE
  ) {
    throw guestError(
      400,
      "INVALID_GUEST_AGE",
      `${label} age must be a whole number between 0 and ${MAX_GUEST_AGE}.`
    );
  }

  return age;
}


/* ============================================================
   ID PROOF
============================================================ */

function validateIdProof(
  type,
  number,
  label
) {
  const proofType =
    optionalText(
      type,
      100,
      `${label} ID proof type`
    );

  const proofNumber =
    optionalText(
      number,
      100,
      `${label} ID proof number`
    );

  if (
    Boolean(proofType) !==
    Boolean(proofNumber)
  ) {
    throw guestError(
      400,
      "INVALID_GUEST_ID_PROOF",
      `${label} ID proof type and ID proof number must be entered together.`
    );
  }

  if (!proofType) {
    return {
      idProofType: null,
      idProofNumber: null,
    };
  }

  const normalizedType =
    proofType.toLowerCase();

  let valid = true;

  if (
    normalizedType ===
    "aadhaar"
  ) {
    valid =
      /^\d{12}$/.test(
        proofNumber
      );
  } else if (
    normalizedType ===
    "passport"
  ) {
    valid =
      /^[A-Za-z0-9]{6,20}$/.test(
        proofNumber
      );
  } else if (
    normalizedType ===
    "driving licence"
  ) {
    valid =
      /^[A-Za-z0-9/-]{5,30}$/.test(
        proofNumber
      );
  } else if (
    normalizedType ===
    "voter id"
  ) {
    valid =
      /^[A-Za-z0-9]{8,20}$/.test(
        proofNumber
      );
  } else {
    valid =
      proofNumber.length >= 4 &&
      proofNumber.length <= 50;
  }

  if (!valid) {
    throw guestError(
      400,
      "INVALID_GUEST_ID_PROOF",
      `${label} ID proof number is invalid.`
    );
  }

  return {
    idProofType:
      proofType,

    idProofNumber:
      proofNumber,
  };
}


/* ============================================================
   GUEST POLICY
============================================================ */

function normalizeGuestPolicy(
  policy
) {
  const source =
    policy &&
    typeof policy === "object" &&
    !Array.isArray(policy)
      ? policy
      : {};

  const adultAgeFrom =
    Number(
      source.adult_age_from
    );

  if (
    !Number.isSafeInteger(
      adultAgeFrom
    ) ||
    adultAgeFrom < 1 ||
    adultAgeFrom >
      MAX_GUEST_AGE
  ) {
    throw guestError(
      500,
      "INVALID_GUEST_POLICY",
      "The hotel's adult age threshold is invalid."
    );
  }

  const rules =
    Array.isArray(
      source.child_age_rules
    )
      ? source.child_age_rules
      : [];

  const childAgeRules =
    rules.map(
      (
        rule,
        index
      ) => {
        const minAge =
          Number(
            rule?.min_age
          );

        const maxAge =
          Number(
            rule?.max_age
          );

        const chargeMethod =
          String(
            rule?.charge?.method ||
            ""
          ).trim();

        const chargeValue =
          Number(
            rule?.charge?.value ??
            0
          );

        const bedPolicy =
          String(
            rule?.bed_policy ||
            ""
          ).trim();

        if (
          !Number.isSafeInteger(
            minAge
          ) ||
          !Number.isSafeInteger(
            maxAge
          ) ||
          minAge < 0 ||
          maxAge < minAge ||
          maxAge >=
            adultAgeFrom ||
          !CHILD_CHARGE_METHODS
            .has(
              chargeMethod
            ) ||
          !Number.isFinite(
            chargeValue
          ) ||
          chargeValue < 0 ||
          (
            chargeMethod ===
              "percentage" &&
            chargeValue > 100
          ) ||
          !CHILD_BED_POLICIES
            .has(
              bedPolicy
            )
        ) {
          throw guestError(
            500,
            "INVALID_GUEST_POLICY",
            `The hotel's child age rule ${index + 1} is invalid.`
          );
        }

        return {
          minAge,
          maxAge,
          chargeMethod,
          chargeValue,
          bedPolicy,
        };
      }
    );

  const adultExtraBedChargePerNight =
    Number(
      source
        .adult_extra_bed_charge_per_night ??
      0
    );

  const childExtraBedChargePerNight =
    Number(
      source
        .child_extra_bed_charge_per_night ??
      0
    );

  if (
    !Number.isFinite(
      adultExtraBedChargePerNight
    ) ||
    adultExtraBedChargePerNight <
      0 ||
    !Number.isFinite(
      childExtraBedChargePerNight
    ) ||
    childExtraBedChargePerNight <
      0
  ) {
    throw guestError(
      500,
      "INVALID_GUEST_POLICY",
      "The hotel's extra-bed pricing is invalid."
    );
  }

  return {
    primaryIdRequired:
      source
        .id_proof_required ===
      true,

    allGuestNamesRequired:
      source
        .all_guest_names_required ===
      true,

    otherAdultIdRequired:
      source
        .other_adult_id_required ===
      true,

    childAgeRequired:
      source
        .child_age_required ===
      true,

    childIdRequired:
      source
        .child_id_required ===
      true,

    adultAgeFrom,

    childAgeRules,

    extraBedEnabled:
      source
        .extra_bed_enabled ===
      true,

    adultExtraBedChargePerNight:
      money(
        adultExtraBedChargePerNight
      ),

    childExtraBedChargePerNight:
      money(
        childExtraBedChargePerNight
      ),
  };
}


function findChildRule(
  policy,
  age
) {
  if (
    age === null
  ) {
    return null;
  }

  return (
    policy.childAgeRules.find(
      (rule) =>
        age >=
          rule.minAge &&
        age <=
          rule.maxAge
    ) ||
    null
  );
}


/* ============================================================
   PRIMARY CUSTOMER SNAPSHOT
============================================================ */

function normalizePrimaryCustomer(
  customer,
  policy
) {
  if (
    !customer ||
    typeof customer !==
      "object"
  ) {
    throw guestError(
      400,
      "PRIMARY_GUEST_REQUIRED",
      "Primary guest details are required."
    );
  }

  const fullName =
    optionalText(
      customer.fullName ??
        customer.full_name,
      150,
      "Primary guest name"
    );

  if (!fullName) {
    throw guestError(
      400,
      "PRIMARY_GUEST_NAME_REQUIRED",
      "Primary guest name is required."
    );
  }

  const idProof =
    validateIdProof(
      customer.idProofType ??
        customer.id_proof_type,

      customer.idProofNumber ??
        customer.id_proof_number,

      "Primary guest"
    );

  if (
    policy.primaryIdRequired &&
    (
      !idProof.idProofType ||
      !idProof.idProofNumber
    )
  ) {
    throw guestError(
      400,
      "PRIMARY_GUEST_ID_REQUIRED",
      "Primary guest ID proof is required by hotel policy."
    );
  }

  return {
    guestRole:
      "primary",

    guestType:
      "adult",

    fullName,

    age:
      null,

    idProofType:
      idProof.idProofType,

    idProofNumber:
      idProof.idProofNumber,

    extraBedUsed:
      false,

    childRule:
      null,
  };
}


/* ============================================================
   ACCOMPANYING GUEST
============================================================ */

function normalizeAccompanyingGuest(
  rawGuest,
  index,
  policy
) {
  const source =
    rawGuest &&
    typeof rawGuest ===
      "object"
      ? rawGuest
      : {};

  const label =
    `Guest ${index + 1}`;

  const guestType =
    String(
      source.guest_type ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    !GUEST_TYPES.has(
      guestType
    )
  ) {
    throw guestError(
      400,
      "INVALID_GUEST_TYPE",
      `${label}: select Adult or Child.`
    );
  }

  const fullName =
    optionalText(
      source.full_name,
      150,
      `${label} name`
    );

  if (
    policy
      .allGuestNamesRequired &&
    !fullName
  ) {
    throw guestError(
      400,
      "GUEST_NAME_REQUIRED",
      `${label}: name is required by hotel policy.`
    );
  }

  const age =
    normalizeAge(
      source.age,
      {
        required:
          guestType ===
            "child" &&
          policy
            .childAgeRequired,

        label,
      }
    );

  if (
    guestType ===
      "adult" &&
    age !== null &&
    age <
      policy.adultAgeFrom
  ) {
    throw guestError(
      400,
      "GUEST_AGE_TYPE_MISMATCH",
      `${label}: age ${age} must be recorded as Child under the hotel's age policy.`
    );
  }

  if (
    guestType ===
      "child" &&
    age !== null &&
    age >=
      policy.adultAgeFrom
  ) {
    throw guestError(
      400,
      "GUEST_AGE_TYPE_MISMATCH",
      `${label}: age ${age} must be recorded as Adult under the hotel's age policy.`
    );
  }

  const idProof =
    validateIdProof(
      source.id_proof_type,
      source.id_proof_number,
      label
    );

  const idRequired =
    guestType ===
      "adult"
      ? policy
          .otherAdultIdRequired
      : policy
          .childIdRequired;

  if (
    idRequired &&
    (
      !idProof.idProofType ||
      !idProof.idProofNumber
    )
  ) {
    throw guestError(
      400,
      "GUEST_ID_REQUIRED",
      `${label}: ID proof is required by hotel policy.`
    );
  }

  let extraBedUsed =
    strictBoolean(
      source.extra_bed_used,
      `${label} extra_bed_used`,
      false
    );

  if (
    extraBedUsed &&
    !policy.extraBedEnabled
  ) {
    throw guestError(
      400,
      "EXTRA_BED_DISABLED",
      `${label}: extra beds are disabled by hotel policy.`
    );
  }

  const childRule =
    guestType ===
      "child"
      ? findChildRule(
          policy,
          age
        )
      : null;

  if (childRule) {
    if (
      childRule.bedPolicy ===
      "share_existing_bed"
    ) {
      if (extraBedUsed) {
        throw guestError(
          400,
          "CHILD_EXTRA_BED_NOT_ALLOWED",
          `${label}: this child age slab must share the existing bed.`
        );
      }

      extraBedUsed =
        false;
    }

    if (
      childRule.bedPolicy ===
      "extra_bed_required"
    ) {
      if (
        !policy
          .extraBedEnabled
      ) {
        throw guestError(
          500,
          "INVALID_GUEST_POLICY",
          "The hotel policy requires an extra bed for this child age slab while extra beds are disabled."
        );
      }

      if (!extraBedUsed) {
        throw guestError(
          400,
          "CHILD_EXTRA_BED_REQUIRED",
          `${label}: an extra bed is required for this child age slab.`
        );
      }
    }
  }

  return {
    guestRole:
      "accompanying",

    guestType,

    fullName,
    age,

    idProofType:
      idProof.idProofType,

    idProofNumber:
      idProof.idProofNumber,

    extraBedUsed,

    childRule,
  };
}


/* ============================================================
   ROOM / REQUEST ROSTER
============================================================ */

function prepareGuestRosters({
  rooms,
  roomMap,
  guestPolicy,
  primaryCustomer,
  primaryMode =
    "exactly_one",
}) {
  if (
    !Array.isArray(rooms) ||
    rooms.length === 0
  ) {
    throw guestError(
      400,
      "GUEST_ROOMS_REQUIRED",
      "At least one room is required for guest allocation."
    );
  }

  if (
    !PRIMARY_MODES.has(
      primaryMode
    )
  ) {
    throw guestError(
      500,
      "INVALID_PRIMARY_GUEST_MODE",
      "Primary guest allocation mode is invalid."
    );
  }

  const policy =
    normalizeGuestPolicy(
      guestPolicy
    );

  const primary =
    normalizePrimaryCustomer(
      primaryCustomer,
      policy
    );

  const prepared =
    rooms.map(
      (
        roomInput,
        roomIndex
      ) => {
        const source =
          roomInput &&
          typeof roomInput ===
            "object"
            ? roomInput
            : {};

        const roomId =
          Number(
            source.roomId ??
            source.room_id
          );

        if (
          !Number.isSafeInteger(
            roomId
          ) ||
          roomId <= 0
        ) {
          throw guestError(
            400,
            "INVALID_GUEST_ROOM",
            `Room ${roomIndex + 1}: room ID is invalid.`
          );
        }

        const room =
          roomMap?.get(
            roomId
          );

        if (!room) {
          throw guestError(
            404,
            "ROOM_NOT_FOUND_FOR_GUESTS",
            `Room ${roomIndex + 1} could not be found for guest allocation.`
          );
        }

        const primaryGuestStaying =
          strictBoolean(
            source
              .primary_guest_staying ??
              source
                .primaryGuestStaying,

            `Room ${
              room.room_number ||
              roomIndex + 1
            } primary_guest_staying`,

            false
          );

        const rawGuests =
          source.guests ===
            undefined ||
          source.guests ===
            null
            ? []
            : source.guests;

        if (
          !Array.isArray(
            rawGuests
          )
        ) {
          throw guestError(
            400,
            "INVALID_GUEST_LIST",
            `Room ${room.room_number || roomIndex + 1}: guests must be a list.`
          );
        }

        const guests = [];

        if (
          primaryGuestStaying
        ) {
          guests.push({
            ...primary,
          });
        }

        rawGuests.forEach(
          (
            rawGuest,
            guestIndex
          ) => {
            guests.push(
              normalizeAccompanyingGuest(
                rawGuest,
                guestIndex,
                policy
              )
            );
          }
        );

        const totalGuests =
          guests.length;

        if (
          totalGuests < 1
        ) {
          throw guestError(
            400,
            "ROOM_GUEST_REQUIRED",
            `Room ${room.room_number}: add at least one staying guest.`
          );
        }

        const capacity =
          Number(
            room.capacity
          );

        if (
          !Number.isSafeInteger(
            capacity
          ) ||
          capacity < 1
        ) {
          throw guestError(
            500,
            "INVALID_ROOM_CAPACITY",
            `Room ${room.room_number} has an invalid capacity.`
          );
        }

        if (
          totalGuests >
          capacity
        ) {
          throw guestError(
            400,
            "ROOM_CAPACITY_EXCEEDED",
            `Room ${room.room_number} allows a maximum of ${capacity} guest(s).`
          );
        }

        return {
          roomId,

          roomNumber:
            room.room_number,

          primaryGuestStaying,

          totalGuests,

          guests,
        };
      }
    );

  const primaryCount =
    prepared.reduce(
      (
        count,
        room
      ) =>
        count +
        (
          room
            .primaryGuestStaying
            ? 1
            : 0
        ),
      0
    );

  if (
    primaryMode ===
      "exactly_one" &&
    primaryCount !== 1
  ) {
    throw guestError(
      400,
      "PRIMARY_GUEST_ALLOCATION_REQUIRED",
      "Select exactly one room where the primary guest will stay."
    );
  }

  if (
    primaryMode ===
      "none" &&
    primaryCount !== 0
  ) {
    throw guestError(
      400,
      "PRIMARY_GUEST_ALREADY_ALLOCATED",
      "The reservation group's primary guest is already allocated to an existing room."
    );
  }

  if (
    primaryMode ===
      "zero_or_one" &&
    primaryCount > 1
  ) {
    throw guestError(
      400,
      "MULTIPLE_PRIMARY_GUEST_ROOMS",
      "The primary guest can stay in only one room within the reservation."
    );
  }

  return {
    policy,

    primaryCount,

    rooms:
      prepared,

    totalGuests:
      prepared.reduce(
        (
          sum,
          room
        ) =>
          sum +
          room.totalGuests,
        0
      ),
  };
}


/* ============================================================
   FINANCIAL CHARGES
============================================================ */

function calculateGuestCharges({
  roster,
  stayType,
  nights,
  ratePerNight,
  guestPolicy,
}) {
  if (
    !roster ||
    !Array.isArray(
      roster.guests
    )
  ) {
    throw guestError(
      500,
      "GUEST_ROSTER_MISSING",
      "Guest roster is missing for charge calculation."
    );
  }

  const policy =
    guestPolicy
      ?.adultAgeFrom !==
      undefined
      ? guestPolicy
      : normalizeGuestPolicy(
          guestPolicy
        );

  const type =
    String(
      stayType ||
      ""
    ).trim();

  if (
    ![
      "overnight",
      "day_use",
    ].includes(type)
  ) {
    throw guestError(
      400,
      "INVALID_STAY_TYPE",
      "Guest charges could not be calculated for the selected stay type."
    );
  }

  /*
   * Current guest/extra-bed settings are explicitly PER NIGHT.
   * Therefore Day Use records occupants but does not invent
   * an automatic per-night surcharge.
   */
  if (
    type ===
    "day_use"
  ) {
    return {
      guests:
        roster.guests.map(
          (guest) => ({
            ...guest,

            childChargeAmount:
              0,

            extraBedChargeAmount:
              0,
          })
        ),

      childChargeTotal:
        0,

      extraBedChargeTotal:
        0,

      totalGuestCharges:
        0,
    };
  }

  const nightCount =
    Number(nights);

  const roomRate =
    Number(
      ratePerNight
    );

  if (
    !Number.isSafeInteger(
      nightCount
    ) ||
    nightCount < 1
  ) {
    throw guestError(
      500,
      "INVALID_GUEST_CHARGE_DURATION",
      "Overnight guest charges require a valid night count."
    );
  }

  if (
    !Number.isFinite(
      roomRate
    ) ||
    roomRate < 0
  ) {
    throw guestError(
      500,
      "INVALID_GUEST_CHARGE_RATE",
      "Guest charges require a valid room rate."
    );
  }

  let childChargeTotal =
    0;

  let extraBedChargeTotal =
    0;

  const guests =
    roster.guests.map(
      (guest) => {
        let childChargeAmount =
          0;

        let extraBedChargeAmount =
          0;

        if (
          guest.guestType ===
            "child" &&
          guest.childRule
        ) {
          const {
            chargeMethod,
            chargeValue,
          } =
            guest.childRule;

          if (
            chargeMethod ===
            "fixed_amount"
          ) {
            childChargeAmount =
              money(
                chargeValue *
                nightCount
              );
          } else if (
            chargeMethod ===
            "percentage"
          ) {
            childChargeAmount =
              money(
                roomRate *
                (
                  chargeValue /
                  100
                ) *
                nightCount
              );
          }
        }

        if (
          guest.extraBedUsed
        ) {
          const perNight =
            guest.guestType ===
              "child"
              ? policy
                  .childExtraBedChargePerNight
              : policy
                  .adultExtraBedChargePerNight;

          extraBedChargeAmount =
            money(
              perNight *
              nightCount
            );
        }

        childChargeTotal =
          money(
            childChargeTotal +
            childChargeAmount
          );

        extraBedChargeTotal =
          money(
            extraBedChargeTotal +
            extraBedChargeAmount
          );

        return {
          ...guest,

          childChargeAmount,

          extraBedChargeAmount,
        };
      }
    );

  return {
    guests,

    childChargeTotal,

    extraBedChargeTotal,

    totalGuestCharges:
      money(
        childChargeTotal +
        extraBedChargeTotal
      ),
  };
}


/* ============================================================
   CUSTOMER LOAD
============================================================ */

async function loadPrimaryCustomerWithConnection(
  connection,
  {
    hotelId,
    customerId,
    forUpdate = false,
  }
) {
  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );

  const cId =
    positiveId(
      customerId,
      "Customer ID"
    );

  let sql = `
    SELECT
      customer_id,
      full_name,
      id_proof_type,
      id_proof_number

    FROM customers

    WHERE hotel_id = ?
      AND customer_id = ?

    LIMIT 1
  `;

  if (forUpdate) {
    sql +=
      " FOR UPDATE";
  }

  const [[customer]] =
    await connection.query(
      sql,
      [
        hId,
        cId,
      ]
    );

  if (!customer) {
    throw guestError(
      404,
      "CUSTOMER_NOT_FOUND",
      "The reservation customer could not be found in this hotel."
    );
  }

  return {
    customerId:
      Number(
        customer.customer_id
      ),

    fullName:
      customer.full_name,

    idProofType:
      customer.id_proof_type,

    idProofNumber:
      customer.id_proof_number,
  };
}


/* ============================================================
   PERSIST BOOKING GUESTS
============================================================ */

async function insertBookingGuestsWithConnection(
  connection,
  {
    hotelId,
    bookingId,
    customerId,
    adminId,
    guests,
  }
) {
  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );

  const bId =
    positiveId(
      bookingId,
      "Booking ID"
    );

  const cId =
    positiveId(
      customerId,
      "Customer ID"
    );

  const aId =
    positiveId(
      adminId,
      "Admin ID"
    );

  if (
    !Array.isArray(
      guests
    ) ||
    guests.length < 1
  ) {
    throw guestError(
      500,
      "BOOKING_GUESTS_REQUIRED",
      "At least one booking guest is required before saving the reservation."
    );
  }

  const insertedIds = [];

  for (
    const guest of
      guests
  ) {
    const isPrimary =
      guest.guestRole ===
      "primary";

    if (
      ![
        "primary",
        "accompanying",
      ].includes(
        guest.guestRole
      ) ||
      !GUEST_TYPES.has(
        guest.guestType
      )
    ) {
      throw guestError(
        500,
        "INVALID_NORMALIZED_GUEST",
        "A normalized booking guest is invalid."
      );
    }

    const [result] =
      await connection.query(
        `
          INSERT INTO booking_guests (
            hotel_id,
            booking_id,
            customer_id,
            guest_role,
            guest_type,
            full_name,
            age,
            id_proof_type,
            id_proof_number,
            extra_bed_used,
            child_charge_amount,
            extra_bed_charge_amount,
            created_by_admin_id,
            updated_by_admin_id
          )

          VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, NULL
          )
        `,
        [
          hId,
          bId,

          isPrimary
            ? cId
            : null,

          guest.guestRole,
          guest.guestType,
          guest.fullName,
          guest.age,
          guest.idProofType,
          guest.idProofNumber,

          guest.extraBedUsed
            ? 1
            : 0,

          money(
            guest
              .childChargeAmount ??
            0
          ),

          money(
            guest
              .extraBedChargeAmount ??
            0
          ),

          aId,
        ]
      );

    insertedIds.push(
      Number(
        result.insertId
      )
    );
  }

  return {
    bookingId:
      bId,

    guestCount:
      guests.length,

    bookingGuestIds:
      insertedIds,
  };
}


async function replaceBookingGuestsWithConnection(
  connection,
  values
) {
  const hId =
    positiveId(
      values?.hotelId,
      "Hotel ID"
    );

  const bId =
    positiveId(
      values?.bookingId,
      "Booking ID"
    );

  await connection.query(
    `
      DELETE FROM booking_guests

      WHERE hotel_id = ?
        AND booking_id = ?
    `,
    [
      hId,
      bId,
    ]
  );

  return (
    insertBookingGuestsWithConnection(
      connection,
      values
    )
  );
}


/* ============================================================
   READ BOOKING GUESTS
============================================================ */

async function getBookingGuestsWithConnection(
  connection,
  {
    hotelId,
    bookingId,
  }
) {
  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );

  const bId =
    positiveId(
      bookingId,
      "Booking ID"
    );

  const [rows] =
    await connection.query(
      `
        SELECT
          booking_guest_id,
          customer_id,
          guest_role,
          guest_type,
          full_name,
          age,
          id_proof_type,
          id_proof_number,
          extra_bed_used,
          child_charge_amount,
          extra_bed_charge_amount,
          created_by_admin_id,
          updated_by_admin_id,
          created_at,
          updated_at

        FROM booking_guests

        WHERE hotel_id = ?
          AND booking_id = ?

        ORDER BY
          CASE
            WHEN guest_role = 'primary'
            THEN 0
            ELSE 1
          END,
          booking_guest_id ASC
      `,
      [
        hId,
        bId,
      ]
    );

  return rows.map(
    (row) => ({
      bookingGuestId:
        Number(
          row.booking_guest_id
        ),

      customerId:
        row.customer_id ===
          null
          ? null
          : Number(
              row.customer_id
            ),

      guestRole:
        row.guest_role,

      guestType:
        row.guest_type,

      fullName:
        row.full_name,

      age:
        row.age ===
          null
          ? null
          : Number(
              row.age
            ),

      idProofType:
        row.id_proof_type,

      idProofNumber:
        row.id_proof_number,

      extraBedUsed:
        Boolean(
          row.extra_bed_used
        ),

      childChargeAmount:
        Number(
          row
            .child_charge_amount ||
          0
        ),

      extraBedChargeAmount:
        Number(
          row
            .extra_bed_charge_amount ||
          0
        ),

      createdByAdminId:
        Number(
          row
            .created_by_admin_id
        ),

      updatedByAdminId:
        row
          .updated_by_admin_id ===
        null
          ? null
          : Number(
              row
                .updated_by_admin_id
            ),

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    })
  );
}


/* ============================================================
   GROUP PRIMARY GUEST COUNT

   Used by Add Another Room / future group operations.
============================================================ */

async function countGroupPrimaryGuestsWithConnection(
  connection,
  {
    hotelId,
    reservationGroupId,
  }
) {
  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );

  const groupId =
    positiveId(
      reservationGroupId,
      "Reservation group ID"
    );

  const [[row]] =
    await connection.query(
      `
        SELECT
          COUNT(*) AS primary_count

        FROM booking_guests bg

        INNER JOIN bookings b
          ON b.hotel_id =
             bg.hotel_id
         AND b.booking_id =
             bg.booking_id

        WHERE bg.hotel_id = ?
          AND b.reservation_group_id = ?
          AND bg.guest_role = 'primary'
      `,
      [
        hId,
        groupId,
      ]
    );

  return Number(
    row?.primary_count ||
    0
  );
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  normalizeGuestPolicy,

  normalizePrimaryCustomer,

  prepareGuestRosters,

  calculateGuestCharges,

  loadPrimaryCustomerWithConnection,

  insertBookingGuestsWithConnection,

  replaceBookingGuestsWithConnection,

  getBookingGuestsWithConnection,

  countGroupPrimaryGuestsWithConnection,
};