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
   - Customer = reservation contact profile.
   - Reservation Contact may or may not be a staying Primary Guest.
   - Accompanying guests do NOT become customer records.
   - Day Use currently records occupants but does not apply
     per-night child / extra-bed charges.
============================================================ */

const {
  resolveAllowedGuestIdProofTypes,
  validateGuestIdProof,
} = require(
  "./guestIdProofService"
);

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

function normalizeGuestPhone(
  value,
  label = "Guest phone"
) {
  const phone =
    optionalText(
      value,
      30,
      label
    );

  if (!phone) {
    return null;
  }

  if (
    !/^[+\d\s().-]+$/.test(phone)
  ) {
    throw guestError(
      400,
      "INVALID_GUEST_PHONE",
      `${label} contains invalid characters.`
    );
  }

  const digitCount =
    phone.replace(/\D/g, "").length;

  if (
    digitCount < 7 ||
    digitCount > 15
  ) {
    throw guestError(
      400,
      "INVALID_GUEST_PHONE",
      `${label} must contain between 7 and 15 digits.`
    );
  }

  return phone;
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

  const childAgeRequired =
    source.child_age_required ===
    true;

  const extraBedEnabled =
    source.extra_bed_enabled ===
    true;

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

        if (
          chargeMethod === "none" &&
          chargeValue !== 0
        ) {
          throw guestError(
            500,
            "INVALID_GUEST_POLICY",
            `The hotel's child age rule ${index + 1} must use charge value 0 when the charge method is none.`
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
    
    if (
      childAgeRules.length > 0
    ) {
      if (!childAgeRequired) {
        throw guestError(
          500,
          "INVALID_GUEST_POLICY",
          "Child age must be required when child age-based pricing rules are configured."
        );
      }

      let expectedMinAge = 0;

      childAgeRules.forEach(
        (rule, index) => {
          if (
            rule.minAge !==
            expectedMinAge
          ) {
            throw guestError(
              500,
              "INVALID_GUEST_POLICY",
              `The booking's child age rule ${index + 1} must start at age ${expectedMinAge}.`
            );
          }

          expectedMinAge =
            rule.maxAge + 1;
        }
      );

      if (
        expectedMinAge !==
        adultAgeFrom
      ) {
        throw guestError(
          500,
          "INVALID_GUEST_POLICY",
          `The booking's child age rules must cover every child age from 0 to ${adultAgeFrom - 1}.`
        );
      }

      if (!extraBedEnabled) {
        const invalidBedRule =
          childAgeRules.find(
            (rule) =>
              [
                "extra_bed_optional",
                "extra_bed_required",
              ].includes(
                rule.bedPolicy
              )
          );

        if (invalidBedRule) {
          throw guestError(
            500,
            "INVALID_GUEST_POLICY",
            "The booking's child age policy requires or allows an extra bed while extra beds are disabled."
          );
        }
      }
    }
  

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

  let allowedIdProofTypes;

  try {
    allowedIdProofTypes =
      resolveAllowedGuestIdProofTypes(
        source.allowed_id_proof_types
      );
  } catch (error) {
    throw guestError(
      500,
      "INVALID_GUEST_POLICY",
      "The booking's allowed guest ID proof types are invalid."
    );
  }

  return {
    primaryIdRequired:
      source
        .id_proof_required ===
      true,

    allowedIdProofTypes,

    allGuestNamesRequired:
      source
        .all_guest_names_required ===
      true,

    otherAdultIdRequired:
      source
        .other_adult_id_required ===
      true,

    childAgeRequired,

    childIdRequired:
      source
        .child_id_required ===
      true,

    adultAgeFrom,

    childAgeRules,

    extraBedEnabled,

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

  const phone =
    normalizeGuestPhone(
      customer.phone,
      "Primary guest phone"
    );

  if (!fullName) {
    throw guestError(
      400,
      "PRIMARY_GUEST_NAME_REQUIRED",
      "Primary guest name is required."
    );
  }

  const idProof =
    validateGuestIdProof({
      type:
        customer.idProofType ??
        customer.id_proof_type,

      number:
        customer.idProofNumber ??
        customer.id_proof_number,

      label:
        "Primary guest",

      allowedTypes:
        policy.allowedIdProofTypes,
    });

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
    phone,

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

  const phone =
    normalizeGuestPhone(
      source.phone,
      `${label} phone`
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
    validateGuestIdProof({
      type:
        source.id_proof_type ??
        source.idProofType,

      number:
        source.id_proof_number ??
        source.idProofNumber,

      label,

      allowedTypes:
        policy.allowedIdProofTypes,
    });

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
    phone,
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
   SINGLE ARRIVING GUEST

   Used by individual guest check-in.

   Reservation Contact:
   guestRole = primary

   Any other person:
   guestRole = accompanying
============================================================ */

function prepareSingleBookingGuest({
  guestRole = "accompanying",
  guest,
  primaryCustomer = null,
  guestPolicy,
}) {
  const policy =
    normalizeGuestPolicy(
      guestPolicy
    );


  const role =
    String(
      guestRole ||
      "accompanying"
    )
      .trim()
      .toLowerCase();


  if (
    ![
      "primary",
      "accompanying",
    ].includes(
      role
    )
  ) {
    throw guestError(
      400,
      "INVALID_GUEST_ROLE",
      "Guest role must be Primary or Accompanying."
    );
  }


  const normalizedGuest =
    role ===
      "primary"
      ? normalizePrimaryCustomer(
          primaryCustomer,
          policy
        )
      : normalizeAccompanyingGuest(
          guest,
          0,
          policy
        );


  return {
    policy,
    guest:
      normalizedGuest,
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
    "zero_or_one",
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

  let primary =
    null;

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
          if (!primary) {
            primary =
              normalizePrimaryCustomer(
                primaryCustomer,
                policy
              );
          }
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
      phone,
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

    phone:
      customer.phone,

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
    )
  ) {
    throw guestError(
      500,
      "INVALID_BOOKING_GUEST_LIST",
      "Booking guests must be supplied as a list."
    );
  }


  if (
    guests.length === 0
  ) {
    return {
      bookingId:
        bId,

      guestCount:
        0,

      bookingGuestIds:
        [],
    };
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
            phone,
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
            ?, ?, ?, ?, ?, ?, ?, ?,
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
          guest.phone,
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

/* ============================================================
   INSERT INDIVIDUALLY CHECKED-IN GUEST

   Important:
   - Guest is created only when genuinely arriving.
   - No fake expected guest is created.
   - Actual check-in time comes from the database clock.
============================================================ */

async function insertCheckedInGuestWithConnection(
  connection,
  {
    hotelId,
    bookingId,
    customerId = null,
    adminId,
    guest,
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


  const aId =
    positiveId(
      adminId,
      "Admin ID"
    );


  if (
    !guest ||
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
      "INVALID_CHECKIN_GUEST",
      "The guest prepared for check-in is invalid."
    );
  }


  const isPrimary =
    guest.guestRole ===
    "primary";


  const cId =
    isPrimary
      ? positiveId(
          customerId,
          "Customer ID"
        )
      : null;


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
          phone,
          age,
          id_proof_type,
          id_proof_number,
          extra_bed_used,
          child_charge_amount,
          extra_bed_charge_amount,

          guest_status,
          actual_check_in,
          checked_in_by_admin_id,

          created_by_admin_id,
          updated_by_admin_id
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,

          'checked_in',
          CURRENT_TIMESTAMP,
          ?,

          ?,
          NULL
        )
      `,
      [
        hId,
        bId,
        cId,

        guest.guestRole,
        guest.guestType,
        guest.fullName,
        guest.phone,
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
        aId,
      ]
    );


  return {
    bookingGuestId:
      Number(
        result.insertId
      ),

    bookingId:
      bId,

    guestStatus:
      "checked_in",
  };
}

/* ============================================================
   RESOLVE ACTUAL GUEST CHECKOUT TIME

   Checkout timestamps always come from the database clock.

   A caller performing a complete room checkout may supply one
   already-resolved DB timestamp so booking + every guest share
   exactly the same actual checkout time.
============================================================ */

async function resolveGuestCheckoutTime(
  connection,
  actualCheckOut = null
) {
  if (
    actualCheckOut !== null &&
    actualCheckOut !== undefined
  ) {
    return actualCheckOut;
  }


  const [[clock]] =
    await connection.query(
      `
        SELECT
          NOW() AS checkout_time
      `
    );


  if (!clock?.checkout_time) {
    throw guestError(
      500,
      "GUEST_CHECKOUT_TIME_MISSING",
      "The actual guest checkout time could not be resolved."
    );
  }


  return clock.checkout_time;
}


/* ============================================================
   CHECK OUT ONE ACTUAL GUEST

   This updates only the staying guest lifecycle.

   Important:
   - Does NOT close the room booking.
   - Does NOT release the room.
   - Does NOT change financial totals.
   - Formal room checkout remains a separate operation.

   This allows:
   Guest A leaves
   Guest B remains
   → room booking stays checked_in.
============================================================ */

async function checkoutBookingGuestWithConnection(
  connection,
  {
    hotelId,
    bookingId,
    bookingGuestId,
    adminId,
    actualCheckOut = null,
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


  const guestId =
    positiveId(
      bookingGuestId,
      "Booking guest ID"
    );


  const aId =
    positiveId(
      adminId,
      "Admin ID"
    );


  const [[guest]] =
    await connection.query(
      `
        SELECT
          booking_guest_id,
          guest_role,
          guest_type,
          full_name,
          guest_status,
          actual_check_in,
          actual_check_out

        FROM booking_guests

        WHERE hotel_id = ?
          AND booking_id = ?
          AND booking_guest_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hId,
        bId,
        guestId,
      ]
    );


  if (!guest) {
    throw guestError(
      404,
      "BOOKING_GUEST_NOT_FOUND",
      "The selected guest was not found in this room reservation."
    );
  }


  if (
    guest.guest_status ===
    "checked_out"
  ) {
    throw guestError(
      409,
      "GUEST_ALREADY_CHECKED_OUT",
      "This guest has already been checked out."
    );
  }


  if (
    guest.guest_status ===
    "expected"
  ) {
    throw guestError(
      409,
      "GUEST_NOT_CHECKED_IN",
      "An expected guest who never checked in cannot be checked out."
    );
  }


  if (
    guest.guest_status ===
    "cancelled"
  ) {
    throw guestError(
      409,
      "CANCELLED_GUEST_CANNOT_CHECK_OUT",
      "A cancelled guest allocation cannot be checked out."
    );
  }


  if (
    guest.guest_status !==
    "checked_in"
  ) {
    throw guestError(
      409,
      "GUEST_CHECKOUT_NOT_ALLOWED",
      "This guest cannot be checked out from the current status."
    );
  }


  if (
    !guest.actual_check_in
  ) {
    throw guestError(
      409,
      "GUEST_CHECK_IN_TIME_MISSING",
      "This guest is marked checked in but has no actual check-in time."
    );
  }


const checkoutTime =
    await resolveGuestCheckoutTime(
      connection,
      actualCheckOut
    );


  const [updateResult] =
    await connection.query(
      `
        UPDATE booking_guests

        SET
          guest_status =
            'checked_out',

          actual_check_out = COALESCE(actual_check_out, ?),
          checked_out_by_admin_id = COALESCE(checked_out_by_admin_id, ?),
          updated_by_admin_id = ?

        WHERE hotel_id = ?
          AND booking_id = ?
          AND booking_guest_id = ?
          AND guest_status =
            'checked_in'
      `,
      [
        checkoutTime,
        aId,
        aId,
        hId,
        bId,
        guestId,
      ]
    );


  if (
    Number(
      updateResult.affectedRows ||
      0
    ) !== 1
  ) {
    throw guestError(
      409,
      "GUEST_CHECKOUT_STATE_CHANGED",
      "The guest checkout state changed before the operation could be completed."
    );
  }


  await closeOpenBookingGuestStayWithConnection(
    connection,
    {
      hotelId: hId,
      bookingGuestId: guestId,
      adminId: aId,
      checkOutAt: checkoutTime,
    }
  );

  const [[counts]] =
    await connection.query(
      `
        SELECT
          COALESCE(
            SUM(
              guest_status =
                'checked_in'
            ),
            0
          ) AS checked_in_count,

          COALESCE(
            SUM(
              guest_status =
                'expected'
            ),
            0
          ) AS expected_count

        FROM booking_guests

        WHERE hotel_id = ?
          AND booking_id = ?
      `,
      [
        hId,
        bId,
      ]
    );


  return {
    bookingId:
      bId,

    bookingGuestId:
      guestId,

    guestRole:
      guest.guest_role,

    guestType:
      guest.guest_type,

    fullName:
      guest.full_name,

    guestStatus:
      "checked_out",

    actualCheckOut:
      checkoutTime,

    checkedInGuestsRemaining:
      Number(
        counts?.checked_in_count ||
        0
      ),

    expectedGuestsRemaining:
      Number(
        counts?.expected_count ||
        0
      ),
  };
}


/* ============================================================
   CLOSE ALL GUEST STATES FOR FORMAL ROOM CHECKOUT

   Formal room checkout closes the occupant lifecycle too.

   checked_in
     → checked_out
     → receives actual_check_out + admin attribution

   expected
     → cancelled
     → never receives a fake actual checkout

   already checked_out / cancelled
     → preserved unchanged

   This function does NOT change:
   - booking status
   - room status
   - room history
   - payment ledger

   Those remain booking lifecycle responsibilities.
============================================================ */

async function closeBookingGuestsForRoomCheckoutWithConnection(
  connection,
  {
    hotelId,
    bookingId,
    adminId,
    actualCheckOut = null,
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


  const aId =
    positiveId(
      adminId,
      "Admin ID"
    );


  const checkoutTime =
    await resolveGuestCheckoutTime(
      connection,
      actualCheckOut
    );


  const [guests] =
    await connection.query(
      `
        SELECT
          booking_guest_id,
          guest_status,
          actual_check_in,
          actual_check_out

        FROM booking_guests

        WHERE hotel_id = ?
          AND booking_id = ?

        ORDER BY
          booking_guest_id ASC

        FOR UPDATE
      `,
      [
        hId,
        bId,
      ]
    );


  const invalidCheckedInGuest =
    guests.find(
      (guest) =>
        guest.guest_status ===
          "checked_in" &&
        !guest.actual_check_in
    );


  if (
    invalidCheckedInGuest
  ) {
    throw guestError(
      409,
      "GUEST_CHECK_IN_TIME_MISSING",
      "A checked-in guest has no actual check-in time. Review the guest lifecycle before checking out this room."
    );
  }


const checkedInCount =
    guests.filter(
      (guest) =>
        guest.guest_status ===
        "checked_in"
    ).length;


  const expectedCount =
    guests.filter(
      (guest) =>
        guest.guest_status ===
        "expected"
    ).length;


  if (
    checkedInCount > 0
  ) {
    for (const guest of guests) {
      if (guest.guest_status !== "checked_in") continue;

      await closeOpenBookingGuestStayWithConnection(connection, {
        hotelId: hId,
        bookingGuestId: Number(guest.booking_guest_id),
        adminId: aId,
        checkOutAt: checkoutTime,
      });
    }

    await connection.query(
      `
        UPDATE booking_guests

        SET
          guest_status =
            'checked_out',

          actual_check_out = COALESCE(actual_check_out, ?),
          checked_out_by_admin_id = COALESCE(checked_out_by_admin_id, ?),
          updated_by_admin_id = ?

        WHERE hotel_id = ?
          AND booking_id = ?
          AND guest_status =
            'checked_in'
      `,
      [
        checkoutTime,
        aId,
        aId,
        hId,
        bId,
      ]
    );
  }


  if (
    expectedCount > 0
  ) {
    await connection.query(
      `
        UPDATE booking_guests

        SET
          guest_status =
            'cancelled',

          actual_check_out = NULL,
          checked_out_by_admin_id = NULL,
          updated_by_admin_id = ?

        WHERE hotel_id = ?
          AND booking_id = ?
          AND guest_status =
            'expected'
      `,
      [
        aId,
        hId,
        bId,
      ]
    );
  }


  return {
    bookingId:
      bId,

    actualCheckOut:
      checkoutTime,

    guestCount:
      guests.length,

    checkedOutGuestCount:
      checkedInCount,

    cancelledExpectedGuestCount:
      expectedCount,

    alreadyClosedGuestCount:
      guests.length -
      checkedInCount -
      expectedCount,
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


function mapBookingGuestStayRow(
  row
) {
  return {
    guestStayId:
      Number(
        row.guest_stay_id
      ),

    staySequence:
      Number(
        row.stay_sequence
      ),

    checkInAt:
      row.check_in_at ||
      null,

    checkOutAt:
      row.check_out_at ||
      null,

    checkedInByAdminId:
      row.checked_in_by_admin_id ===
        null ||
      row.checked_in_by_admin_id ===
        undefined
        ? null
        : Number(
            row.checked_in_by_admin_id
          ),

    checkedOutByAdminId:
      row.checked_out_by_admin_id ===
        null ||
      row.checked_out_by_admin_id ===
        undefined
        ? null
        : Number(
            row.checked_out_by_admin_id
          ),

    entryType:
      row.entry_type ||
      null,

    recordSource:
      row.record_source ||
      null,

    reentryReason:
      row.reentry_reason ||
      null,

    createdAt:
      row.created_at ||
      null,

    updatedAt:
      row.updated_at ||
      null,
  };
}

function mapBookingGuestRow(
  row
) {
  return {
    bookingGuestId:
      Number(
        row.booking_guest_id
      ),

    bookingId:
      row.booking_id ===
        undefined
        ? null
        : Number(
            row.booking_id
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

    phone:
      row.phone,

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
        row.child_charge_amount ||
        0
      ),

    extraBedChargeAmount:
      Number(
        row.extra_bed_charge_amount ||
        0
      ),

    guestStatus:
      row.guest_status ||
      "expected",

    actualCheckIn:
      row.actual_check_in ||
      null,

    actualCheckOut:
      row.actual_check_out ||
      null,

    checkedInByAdminId:
      row.checked_in_by_admin_id ===
        null ||
      row.checked_in_by_admin_id ===
        undefined
        ? null
        : Number(
            row.checked_in_by_admin_id
          ),

    checkedOutByAdminId:
      row.checked_out_by_admin_id ===
        null ||
      row.checked_out_by_admin_id ===
        undefined
        ? null
        : Number(
            row.checked_out_by_admin_id
          ),

    createdByAdminId:
      Number(
        row.created_by_admin_id
      ),

    updatedByAdminId:
      row.updated_by_admin_id ===
        null
        ? null
        : Number(
            row.updated_by_admin_id
          ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
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
          phone,
          age,
          id_proof_type,
          id_proof_number,
          extra_bed_used,
          child_charge_amount,
          extra_bed_charge_amount,

          guest_status,
          actual_check_in,
          actual_check_out,
          checked_in_by_admin_id,
          checked_out_by_admin_id,

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

  if (
    rows.length === 0
  ) {
    return [];
  }


  /* ==========================================================
     READ BOOKING GUEST STAY SESSIONS

     booking_guest_stays is the immutable stay-session truth.

     Scope remains:
     hotel + booking + booking guest.

     booking_guests.actual_check_in / actual_check_out remain
     preserved historical first-stay projection fields.
  ========================================================== */

  const [stayRows] =
    await connection.query(
      `
        SELECT
          bgs.booking_guest_id,
          bgs.guest_stay_id,
          bgs.stay_sequence,
          bgs.check_in_at,
          bgs.check_out_at,
          bgs.checked_in_by_admin_id,
          bgs.checked_out_by_admin_id,
          bgs.entry_type,
          bgs.record_source,
          bgs.reentry_reason,
          bgs.created_at,
          bgs.updated_at

        FROM booking_guest_stays bgs

        INNER JOIN booking_guests bg
          ON bg.hotel_id =
             bgs.hotel_id
         AND bg.booking_guest_id =
             bgs.booking_guest_id

        WHERE bg.hotel_id = ?
          AND bg.booking_id = ?

        ORDER BY
          bgs.booking_guest_id ASC,
          bgs.stay_sequence ASC,
          bgs.guest_stay_id ASC
      `,
      [
        hId,
        bId,
      ]
    );


  const staysByGuestId =
    new Map();


  for (
    const stayRow of
    stayRows
  ) {
    const bookingGuestId =
      Number(
        stayRow.booking_guest_id
      );

    if (
      !staysByGuestId.has(
        bookingGuestId
      )
    ) {
      staysByGuestId.set(
        bookingGuestId,
        []
      );
    }

    staysByGuestId
      .get(
        bookingGuestId
      )
      .push(
        mapBookingGuestStayRow(
          stayRow
        )
      );
  }


  return rows.map(
    (row) => {
      const guest =
        mapBookingGuestRow(
          row
        );

      const stayHistory =
        staysByGuestId.get(
          Number(
            row.booking_guest_id
          )
        ) ||
        [];

      const currentStay =
        stayHistory.find(
          (stay) =>
            !stay.checkOutAt
        ) ||
        null;

      const latestStay =
        stayHistory.length > 0
          ? stayHistory[
              stayHistory.length -
              1
            ]
          : null;

      return {
        ...guest,

        stayCount:
          stayHistory.length,

        currentStay,

        latestStay,

        stayHistory,
      };
    }
  );
}

/* ============================================================
   READ RESERVATION GROUP GUESTS

   Returns only genuinely captured occupant records.

   Historical bookings without booking_guests remain empty;
   they are never fake-backfilled.
============================================================ */

async function getReservationGroupGuestsWithConnection(
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


  const [rows] =
    await connection.query(
      `
        SELECT
          bg.booking_guest_id,
          bg.booking_id,
          bg.customer_id,
          bg.guest_role,
          bg.guest_type,
          bg.full_name,
          bg.phone,
          bg.age,
          bg.id_proof_type,
          bg.id_proof_number,
          bg.extra_bed_used,
          bg.child_charge_amount,
          bg.extra_bed_charge_amount,

          bg.guest_status,
          bg.actual_check_in,
          bg.actual_check_out,
          bg.checked_in_by_admin_id,
          bg.checked_out_by_admin_id,

          bg.created_by_admin_id,
          bg.updated_by_admin_id,
          bg.created_at,
          bg.updated_at

        FROM booking_guests bg

        INNER JOIN bookings b
          ON b.hotel_id =
             bg.hotel_id
         AND b.booking_id =
             bg.booking_id

        WHERE bg.hotel_id = ?
          AND b.reservation_group_id = ?

        ORDER BY
          b.booking_id ASC,

          CASE
            WHEN bg.guest_role = 'primary'
            THEN 0
            ELSE 1
          END,

          bg.booking_guest_id ASC
      `,
      [
        hId,
        groupId,
      ]
    );


  return rows.map(
    mapBookingGuestRow
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
    excludeBookingId = null,
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

  const excludedId =
    excludeBookingId ===
      null ||
    excludeBookingId ===
      undefined
      ? null
      : positiveId(
          excludeBookingId,
          "Excluded booking ID"
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
          AND (
            ? IS NULL
            OR bg.booking_id <> ?
          )
      `,
      [
        hId,
        groupId,
        excludedId,
        excludedId,
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


/* ============================================================
   BOOKING GUEST STAY SESSIONS

   booking_guests:
   - guest allocation / current lifecycle state

   booking_guest_stays:
   - immutable physical entry / exit sessions

   One guest may therefore have:
   stay_sequence 1 = initial stay
   stay_sequence 2+ = re-entry stays
============================================================ */

async function openBookingGuestStayWithConnection(
  connection,
  {
    hotelId,
    bookingGuestId,
    adminId,
    entryType = "initial",
    checkInAt = null,
    reentryReason = null,
  } = {}
) {
  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );

  const guestId =
    positiveId(
      bookingGuestId,
      "Booking guest ID"
    );

  const aId =
    positiveId(
      adminId,
      "Admin ID"
    );

  const normalizedEntryType =
    String(
      entryType || "initial"
    )
      .trim()
      .toLowerCase();

  if (
    ![
      "initial",
      "re_entry",
    ].includes(
      normalizedEntryType
    )
  ) {
    throw guestError(
      400,
      "INVALID_GUEST_STAY_ENTRY_TYPE",
      "Guest stay entry type must be initial or re_entry."
    );
  }

  const reason =
    reentryReason === null ||
    reentryReason === undefined
      ? null
      : String(
          reentryReason
        ).trim() || null;

  if (
    reason &&
    reason.length > 500
  ) {
    throw guestError(
      400,
      "GUEST_REENTRY_REASON_TOO_LONG",
      "Guest re-entry reason must not exceed 500 characters."
    );
  }

  const [[guest]] =
    await connection.query(
      `
        SELECT
          booking_guest_id,
          guest_status,
          actual_check_in

        FROM booking_guests

        WHERE hotel_id = ?
          AND booking_guest_id = ?

        LIMIT 1
        FOR UPDATE
      `,
      [
        hId,
        guestId,
      ]
    );

  if (!guest) {
    throw guestError(
      404,
      "BOOKING_GUEST_NOT_FOUND",
      "The selected guest could not be found."
    );
  }

  if (
    guest.guest_status !==
    "checked_in"
  ) {
    throw guestError(
      409,
      "GUEST_STAY_OPEN_NOT_ALLOWED",
      "A stay session can only be opened for a checked-in guest."
    );
  }

  const [[openStay]] =
    await connection.query(
      `
        SELECT
          guest_stay_id,
          stay_sequence

        FROM booking_guest_stays

        WHERE hotel_id = ?
          AND booking_guest_id = ?
          AND check_out_at IS NULL

        LIMIT 1
        FOR UPDATE
      `,
      [
        hId,
        guestId,
      ]
    );

  if (openStay) {
    throw guestError(
      409,
      "GUEST_STAY_ALREADY_OPEN",
      "This guest already has an active stay session."
    );
  }

  const [[sequenceRow]] =
    await connection.query(
      `
        SELECT
          COALESCE(
            MAX(stay_sequence),
            0
          ) + 1 AS next_sequence

        FROM booking_guest_stays

        WHERE hotel_id = ?
          AND booking_guest_id = ?
      `,
      [
        hId,
        guestId,
      ]
    );

  const staySequence =
    Number(
      sequenceRow
        ?.next_sequence ||
      1
    );

  if (
    normalizedEntryType ===
      "initial" &&
    staySequence !== 1
  ) {
    throw guestError(
      409,
      "GUEST_INITIAL_STAY_ALREADY_EXISTS",
      "This guest already has historical stay sessions."
    );
  }

  if (
    normalizedEntryType ===
      "re_entry" &&
    staySequence < 2
  ) {
    throw guestError(
      409,
      "GUEST_REENTRY_HISTORY_MISSING",
      "A re-entry requires a previous guest stay session."
    );
  }

  const effectiveCheckIn =
    checkInAt ||
    guest.actual_check_in;

  if (!effectiveCheckIn) {
    throw guestError(
      409,
      "GUEST_STAY_CHECKIN_TIME_MISSING",
      "The guest stay session has no check-in time."
    );
  }

  const [result] =
    await connection.query(
      `
        INSERT INTO booking_guest_stays (
          hotel_id,
          booking_guest_id,
          stay_sequence,
          check_in_at,
          check_out_at,
          checked_in_by_admin_id,
          checked_out_by_admin_id,
          entry_type,
          record_source,
          reentry_reason
        )

        VALUES (
          ?,
          ?,
          ?,
          ?,
          NULL,
          ?,
          NULL,
          ?,
          'lifecycle',
          ?
        )
      `,
      [
        hId,
        guestId,
        staySequence,
        effectiveCheckIn,
        aId,
        normalizedEntryType,
        reason,
      ]
    );

  return {
    guestStayId:
      Number(
        result.insertId
      ),

    bookingGuestId:
      guestId,

    staySequence,

    entryType:
      normalizedEntryType,

    checkInAt:
      effectiveCheckIn,
  };
}


async function closeOpenBookingGuestStayWithConnection(
  connection,
  {
    hotelId,
    bookingGuestId,
    adminId,
    checkOutAt,
  } = {}
) {
  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );

  const guestId =
    positiveId(
      bookingGuestId,
      "Booking guest ID"
    );

  const aId =
    positiveId(
      adminId,
      "Admin ID"
    );

  if (!checkOutAt) {
    throw guestError(
      500,
      "GUEST_STAY_CHECKOUT_TIME_MISSING",
      "The guest stay checkout time is required."
    );
  }

  const [[guest]] =
    await connection.query(
      `
        SELECT
          booking_guest_id,
          guest_status

        FROM booking_guests

        WHERE hotel_id = ?
          AND booking_guest_id = ?

        LIMIT 1
        FOR UPDATE
      `,
      [
        hId,
        guestId,
      ]
    );

  if (!guest) {
    throw guestError(
      404,
      "BOOKING_GUEST_NOT_FOUND",
      "The selected guest could not be found."
    );
  }

  const [[openStay]] =
    await connection.query(
      `
        SELECT
          guest_stay_id,
          stay_sequence,
          check_in_at

        FROM booking_guest_stays

        WHERE hotel_id = ?
          AND booking_guest_id = ?
          AND check_out_at IS NULL

        ORDER BY
          stay_sequence DESC

        LIMIT 1
        FOR UPDATE
      `,
      [
        hId,
        guestId,
      ]
    );

  if (!openStay) {
    throw guestError(
      409,
      "GUEST_OPEN_STAY_NOT_FOUND",
      "No active stay session exists for this guest."
    );
  }

  const [result] =
    await connection.query(
      `
        UPDATE booking_guest_stays

        SET
          check_out_at = ?,
          checked_out_by_admin_id = ?

        WHERE hotel_id = ?
          AND guest_stay_id = ?
          AND check_out_at IS NULL
      `,
      [
        checkOutAt,
        aId,
        hId,
        openStay.guest_stay_id,
      ]
    );

  if (
    Number(
      result.affectedRows ||
      0
    ) !== 1
  ) {
    throw guestError(
      409,
      "GUEST_STAY_CLOSE_STATE_CHANGED",
      "The guest stay session changed before it could be closed."
    );
  }

  return {
    guestStayId:
      Number(
        openStay.guest_stay_id
      ),

    bookingGuestId:
      guestId,

    staySequence:
      Number(
        openStay.stay_sequence
      ),

    checkInAt:
      openStay.check_in_at,

    checkOutAt,
  };
}

module.exports = {
  normalizeGuestPolicy,

  normalizePrimaryCustomer,

  prepareGuestRosters,

  prepareSingleBookingGuest,

  calculateGuestCharges,

  loadPrimaryCustomerWithConnection,

  insertBookingGuestsWithConnection,

  insertCheckedInGuestWithConnection,

  openBookingGuestStayWithConnection,

  closeOpenBookingGuestStayWithConnection,

  checkoutBookingGuestWithConnection,

  closeBookingGuestsForRoomCheckoutWithConnection,

  replaceBookingGuestsWithConnection,

  getBookingGuestsWithConnection,

  getReservationGroupGuestsWithConnection,

  countGroupPrimaryGuestsWithConnection,
};