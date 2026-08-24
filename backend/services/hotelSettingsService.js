const db = require("../config/db").promisePool;

const {
  CHARGE_METHODS,
  PRICE_METHODS,
  EFFECTIVE_FROM_OPTIONS,
  REFUND_HANDLING_OPTIONS,
  VIP_BILLING_MODES,
  POLICY_SECTIONS,
  SENSITIVE_SETTING_SECTIONS,
  flattenHotelSettings,
  getDefaultSetting,
  serializeSettingValue,
} = require("./hotelSettingsDefaults");


/* ============================================================
   HOTEL SETTINGS SERVICE

   Responsibilities:
   - Initialize missing settings
   - Hotel isolation
   - Admin / Super Admin actor tracking
   - Read settings
   - Save multiple settings atomically
   - Immutable audit history
   - Policy versioning
   - Restore previous values
   - Reset to default
   - Booking policy snapshots
============================================================ */


/* ============================================================
   ALLOWED MODES
============================================================ */

const CANCELLATION_MODES =
  new Set([
    "manual",
    "rules",
  ]);


const CONCESSION_MODES =
  new Set([
    "manual_at_checkout",
    "suggested_fixed",
    "suggested_percentage",
  ]);


const ROOM_READY_ACTIONS =
  new Set([
    "ask_guest",
    "return_original",
    "stay_replacement",
    "admin_decides",
  ]);


const REFUND_MODES =
  new Set([
    "manual_process",
    "calculate_and_show",
  ]);

const CHILD_CHARGE_METHODS =
  new Set([
    "none",
    "fixed_amount",
    "percentage",
  ]);


const CHILD_BED_POLICIES =
  new Set([
    "share_existing_bed",
    "extra_bed_optional",
    "extra_bed_required",
  ]);


const MAX_GUEST_AGE =
  120;

const EARLY_CHECKIN_CHARGE_METHODS =
  new Set([
    "none",
    "fixed_amount",
    "fixed_per_hour",
    "percentage_per_hour",
    "manual",
  ]);


const VERY_EARLY_ARRIVAL_ACTIONS =
  new Set([
    "manual",
    "previous_night",
    "day_use",
  ]);


const DAY_USE_PRICING_MODES =
  new Set([
    "fixed_slots",
    "percentage_slabs",
    "hourly",
  ]);


const DAY_USE_HOURLY_RATE_TYPES =
  new Set([
    "fixed_amount",
    "percentage_of_night",
  ]);


const DAY_USE_OVERNIGHT_MODES =
  new Set([
    "adjust_against_night_rate",
    "charge_full_night_separately",
  ]);

/* ============================================================
   ERROR
============================================================ */

function serviceError(
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
   BASIC HELPERS
============================================================ */

function positiveId(
  value
) {
  const id =
    Number(value);

  return (
    Number.isSafeInteger(id) &&
    id > 0
  )
    ? id
    : null;
}


function displayId(
  prefix,
  id
) {
  return `${prefix}-${String(
    id
  ).padStart(
    4,
    "0"
  )}`;
}


function optionalText(
  value,
  maxLength
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }


  const text =
    String(value)
      .trim();


  if (!text) {
    return null;
  }


  return text.slice(
    0,
    maxLength
  );
}


function parseJson(
  value,
  label =
    "setting"
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }


  if (
    typeof value !==
    "string"
  ) {
    return value;
  }


  try {
    return JSON.parse(
      value
    );
  } catch {
    throw serviceError(
      500,
      "INVALID_SETTING_JSON",
      `Stored ${label} data is invalid JSON.`
    );
  }
}


function stableValue(
  value
) {
  if (
    Array.isArray(value)
  ) {
    return value.map(
      stableValue
    );
  }


  if (
    value &&
    typeof value ===
      "object"
  ) {
    return Object
      .keys(value)
      .sort()
      .reduce(
        (
          result,
          key
        ) => {
          result[key] =
            stableValue(
              value[key]
            );

          return result;
        },
        {}
      );
  }


  return value;
}


function sameValue(
  first,
  second
) {
  return (
    JSON.stringify(
      stableValue(
        first
      )
    ) ===
    JSON.stringify(
      stableValue(
        second
      )
    )
  );
}


/* ============================================================
   ACTOR

   Tracks:
   - Admin
   - Super Admin

   System actor is only for automatic initialization.
============================================================ */

function buildActorFromDbUser(
  dbUser
) {
  if (
    dbUser?.role ===
    "admin"
  ) {
    const adminId =
      positiveId(
        dbUser.adminId
      );

    const hotelId =
      positiveId(
        dbUser.hotelId
      );


    if (
      !adminId ||
      !hotelId
    ) {
      throw serviceError(
        403,
        "ADMIN_CONTEXT_MISSING",
        "The Hotel Admin account context is incomplete."
      );
    }


    return {
      type:
        "admin",

      id:
        adminId,

      displayId:
        displayId(
          "ADM",
          adminId
        ),

      name:
        optionalText(
          dbUser.fullName,
          150
        ) ||
        `Admin ${adminId}`,

      hotelId,

      superadminId:
        null,
    };
  }


  if (
    dbUser?.role ===
    "super_admin"
  ) {
    const superadminId =
      positiveId(
        dbUser.superadminId
      );


    if (!superadminId) {
      throw serviceError(
        403,
        "SUPER_ADMIN_CONTEXT_MISSING",
        "The Super Admin account context is incomplete."
      );
    }


    return {
      type:
        "super_admin",

      id:
        superadminId,

      displayId:
        displayId(
          "SA",
          superadminId
        ),

      name:
        optionalText(
          dbUser.fullName,
          150
        ) ||
        `Super Admin ${superadminId}`,

      hotelId:
        null,

      superadminId,
    };
  }


  throw serviceError(
    403,
    "SETTINGS_ROLE_NOT_ALLOWED",
    "This account cannot manage hotel settings."
  );
}


function systemActor() {
  return {
    type:
      "system",

    id:
      null,

    displayId:
      null,

    name:
      "HMS System",

    hotelId:
      null,

    superadminId:
      null,
  };
}


/* ============================================================
   REQUEST META

   Helps audit:
   - request id
   - IP
   - browser/device information
============================================================ */

function requestMeta(
  meta = {}
) {
  return {
    requestId:
      optionalText(
        meta.requestId,
        100
      ),

    ipAddress:
      optionalText(
        meta.ipAddress,
        45
      ),

    userAgent:
      optionalText(
        meta.userAgent,
        500
      ),
  };
}


/* ============================================================
   HOTEL ACCESS

   Admin:
   hotel comes from authenticated Admin context.

   Super Admin:
   ownership is verified using superadmin_id.
============================================================ */

async function getHotelForActor(
  connection,
  hotelId,
  actor,
  forUpdate =
    false
) {
  const id =
    positiveId(
      hotelId
    );


  if (!id) {
    throw serviceError(
      400,
      "INVALID_HOTEL_ID",
      "A valid hotel ID is required."
    );
  }


  let sql = `
    SELECT
      hotel_id,
      superadmin_id,
      hotel_name,
      status
    FROM hotels
    WHERE hotel_id = ?
  `;


  const params = [
    id,
  ];


  if (
    actor.type ===
    "admin"
  ) {
    if (
      actor.hotelId !==
      id
    ) {
      throw serviceError(
        403,
        "HOTEL_ACCESS_DENIED",
        "Hotel Admins can manage settings only for their assigned hotel."
      );
    }


    sql += `
      AND hotel_id = ?
    `;


    params.push(
      actor.hotelId
    );
  } else if (
    actor.type ===
    "super_admin"
  ) {
    sql += `
      AND superadmin_id = ?
    `;


    params.push(
      actor.superadminId
    );
  } else {
    throw serviceError(
      403,
      "INVALID_SETTINGS_ACTOR",
      "The settings actor could not be identified."
    );
  }


  sql += `
    LIMIT 1
  `;


  if (forUpdate) {
    sql += `
      FOR UPDATE
    `;
  }


  const [[hotel]] =
    await connection.query(
      sql,
      params
    );


  if (!hotel) {
    throw serviceError(
      404,
      "HOTEL_NOT_FOUND",
      "The hotel was not found or does not belong to this account."
    );
  }


  return {
    hotelId:
      Number(
        hotel.hotel_id
      ),

    superadminId:
      Number(
        hotel.superadmin_id
      ),

    displayId:
      displayId(
        "HT",
        hotel.hotel_id
      ),

    name:
      hotel.hotel_name,

    status:
      hotel.status,
  };
}


/* ============================================================
   SYSTEM HOTEL LOOKUP

   Used only when HMS initializes default settings.
============================================================ */

async function getHotelForSystem(
  connection,
  hotelId,
  forUpdate =
    false
) {
  const id =
    positiveId(
      hotelId
    );


  if (!id) {
    throw serviceError(
      400,
      "INVALID_HOTEL_ID",
      "A valid hotel ID is required."
    );
  }


  let sql = `
    SELECT
      hotel_id,
      superadmin_id,
      hotel_name,
      status
    FROM hotels
    WHERE hotel_id = ?
    LIMIT 1
  `;


  if (forUpdate) {
    sql += `
      FOR UPDATE
    `;
  }


  const [[hotel]] =
    await connection.query(
      sql,
      [
        id,
      ]
    );


  if (!hotel) {
    throw serviceError(
      404,
      "HOTEL_NOT_FOUND",
      "The hotel was not found."
    );
  }


  return {
    hotelId:
      Number(
        hotel.hotel_id
      ),

    superadminId:
      Number(
        hotel.superadmin_id
      ),

    displayId:
      displayId(
        "HT",
        hotel.hotel_id
      ),

    name:
      hotel.hotel_name,

    status:
      hotel.status,
  };
}


/* ============================================================
   DATA TYPE VALIDATION
============================================================ */

function validDataType(
  value,
  type
) {
  if (
    type ===
    "boolean"
  ) {
    return (
      typeof value ===
      "boolean"
    );
  }


  if (
    type ===
    "number"
  ) {
    return (
      typeof value ===
        "number" &&
      Number.isFinite(
        value
      ) &&
      value >= 0
    );
  }


  if (
    type ===
    "string"
  ) {
    return (
      typeof value ===
      "string"
    );
  }


  if (
    type ===
    "time"
  ) {
    return (
      typeof value ===
        "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/
        .test(value)
    );
  }


  if (
    type ===
    "object"
  ) {
    return (
      value !== null &&
      typeof value ===
        "object" &&
      !Array.isArray(
        value
      )
    );
  }


  if (
    type ===
    "array"
  ) {
    return Array.isArray(
      value
    );
  }


  return false;
}


/* ============================================================
   CHARGE RULE VALIDATION
============================================================ */

function validateChargeRule(
  value,
  label
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw serviceError(
      400,
      "INVALID_CHARGE_RULE",
      `${label} is invalid.`
    );
  }


  if (
    !CHARGE_METHODS
      .includes(
        String(
          value.method ||
          ""
        )
      )
  ) {
    throw serviceError(
      400,
      "INVALID_CHARGE_METHOD",
      `${label} contains an unsupported charge method.`
    );
  }


  if (
    value.value !==
      undefined &&
    value.value !==
      null
  ) {
    const amount =
      Number(
        value.value
      );


    if (
      !Number.isFinite(
        amount
      ) ||
      amount < 0
    ) {
      throw serviceError(
        400,
        "INVALID_CHARGE_VALUE",
        `${label} contains an invalid charge value.`
      );
    }
  }
}


/* ============================================================
   ROOM PRICE RULE VALIDATION
============================================================ */

function validatePriceRule(
  value,
  label
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw serviceError(
      400,
      "INVALID_PRICING_RULE",
      `${label} is invalid.`
    );
  }


  if (
    !PRICE_METHODS
      .includes(
        String(
          value.pricing_method ||
          ""
        )
      )
  ) {
    throw serviceError(
      400,
      "INVALID_PRICE_METHOD",
      `${label} contains an unsupported pricing method.`
    );
  }


  if (
    value.custom_rate !==
      undefined &&
    value.custom_rate !==
      null
  ) {
    const rate =
      Number(
        value.custom_rate
      );


    if (
      !Number.isFinite(
        rate
      ) ||
      rate < 0
    ) {
      throw serviceError(
        400,
        "INVALID_CUSTOM_RATE",
        `${label} contains an invalid custom rate.`
      );
    }
  }


  if (
    value.effective_from !==
      undefined &&
    value.effective_from !==
      null &&
    !EFFECTIVE_FROM_OPTIONS
      .includes(
        String(
          value.effective_from
        )
      )
  ) {
    throw serviceError(
      400,
      "INVALID_RATE_EFFECTIVE_TIME",
      `${label} contains an invalid effective-from option.`
    );
  }
}


/* ============================================================
   CANCELLATION SLABS
============================================================ */

function validateCancellationRules(
  rules
) {
  if (
    !Array.isArray(
      rules
    )
  ) {
    throw serviceError(
      400,
      "INVALID_CANCELLATION_RULES",
      "Cancellation rules must be an array."
    );
  }


  rules.forEach(
    (
      rule,
      index
    ) => {
      if (
        !rule ||
        typeof rule !==
          "object" ||
        Array.isArray(
          rule
        )
      ) {
        throw serviceError(
          400,
          "INVALID_CANCELLATION_RULE",
          `Cancellation rule ${index + 1} is invalid.`
        );
      }


      for (
        const field of [
          "from_hours_before",
          "to_hours_before",
        ]
      ) {
        if (
          rule[field] ===
            undefined ||
          rule[field] ===
            null
        ) {
          continue;
        }


        const hours =
          Number(
            rule[field]
          );


        if (
          !Number.isFinite(
            hours
          ) ||
          hours < 0
        ) {
          throw serviceError(
            400,
            "INVALID_CANCELLATION_HOURS",
            `Cancellation rule ${index + 1} contains invalid hours.`
          );
        }
      }


      validateChargeRule(
        rule.charge,
        `Cancellation rule ${index + 1}`
      );
    }
  );
}


/* ============================================================
   CHILD AGE / PRICING RULE VALIDATION

   Rules must remain continuous:

   0-5
   6-11
   12-17

   Overlap:
   0-5
   3-10
   is rejected.

   Gap:
   0-5
   7-10
   is also rejected.
============================================================ */

function validateChildAgeRules(
  rules,
  adultAgeFrom =
    null
) {
  if (
    !Array.isArray(
      rules
    )
  ) {
    throw serviceError(
      400,
      "INVALID_CHILD_AGE_RULES",
      "Child age rules must be an array."
    );
  }


  const adultAge =
    adultAgeFrom ===
      null
      ? null
      : Number(
          adultAgeFrom
        );


  if (
    adultAge !== null &&
    (
      !Number.isSafeInteger(
        adultAge
      ) ||
      adultAge < 1 ||
      adultAge >
        MAX_GUEST_AGE
    )
  ) {
    throw serviceError(
      400,
      "INVALID_ADULT_AGE",
      `Adult age must be a whole number between 1 and ${MAX_GUEST_AGE}.`
    );
  }


  if (
    rules.length >
    MAX_GUEST_AGE
  ) {
    throw serviceError(
      400,
      "TOO_MANY_CHILD_AGE_RULES",
      "Too many child age rules were provided."
    );
  }


  let expectedMinimumAge =
    0;


  rules.forEach(
    (
      rule,
      index
    ) => {
      const ruleNumber =
        index + 1;


      if (
        !rule ||
        typeof rule !==
          "object" ||
        Array.isArray(
          rule
        )
      ) {
        throw serviceError(
          400,
          "INVALID_CHILD_AGE_RULE",
          `Child age rule ${ruleNumber} is invalid.`
        );
      }


      const minimumAge =
        Number(
          rule.min_age
        );


      const maximumAge =
        Number(
          rule.max_age
        );


      if (
        !Number.isSafeInteger(
          minimumAge
        ) ||
        !Number.isSafeInteger(
          maximumAge
        ) ||
        minimumAge < 0 ||
        maximumAge < 0
      ) {
        throw serviceError(
          400,
          "INVALID_CHILD_AGE_RANGE",
          `Child age rule ${ruleNumber} must use valid whole-number ages.`
        );
      }


      if (
        minimumAge !==
        expectedMinimumAge
      ) {
        throw serviceError(
          400,
          "CHILD_AGE_RULES_NOT_CONTINUOUS",
          `Child age rule ${ruleNumber} must start at age ${expectedMinimumAge}.`
        );
      }


      if (
        maximumAge <
        minimumAge
      ) {
        throw serviceError(
          400,
          "INVALID_CHILD_AGE_RANGE",
          `Child age rule ${ruleNumber} cannot end before it starts.`
        );
      }


      if (
        adultAge !==
          null &&
        maximumAge >=
          adultAge
      ) {
        throw serviceError(
          400,
          "CHILD_AGE_EXCEEDS_ADULT_AGE",
          `Child age rule ${ruleNumber} must end before the configured adult age of ${adultAge}.`
        );
      }


      if (
        adultAge ===
          null &&
        maximumAge >
          MAX_GUEST_AGE
      ) {
        throw serviceError(
          400,
          "INVALID_CHILD_AGE_RANGE",
          `Child age rule ${ruleNumber} exceeds the supported age range.`
        );
      }


      const charge =
        rule.charge;


      if (
        !charge ||
        typeof charge !==
          "object" ||
        Array.isArray(
          charge
        )
      ) {
        throw serviceError(
          400,
          "INVALID_CHILD_CHARGE",
          `Child age rule ${ruleNumber} has an invalid charge configuration.`
        );
      }


      const chargeMethod =
        String(
          charge.method ||
          ""
        );


      if (
        !CHILD_CHARGE_METHODS
          .has(
            chargeMethod
          )
      ) {
        throw serviceError(
          400,
          "INVALID_CHILD_CHARGE_METHOD",
          `Child age rule ${ruleNumber} has an unsupported charge method.`
        );
      }


      const chargeValue =
        Number(
          charge.value ??
          0
        );


      if (
        !Number.isFinite(
          chargeValue
        ) ||
        chargeValue < 0
      ) {
        throw serviceError(
          400,
          "INVALID_CHILD_CHARGE_VALUE",
          `Child age rule ${ruleNumber} has an invalid charge value.`
        );
      }


      if (
        chargeMethod ===
          "percentage" &&
        chargeValue >
          100
      ) {
        throw serviceError(
          400,
          "INVALID_CHILD_PERCENTAGE",
          `Child age rule ${ruleNumber} percentage cannot exceed 100%.`
        );
      }


      if (
        chargeMethod ===
          "none" &&
        chargeValue !==
          0
      ) {
        throw serviceError(
          400,
          "INVALID_CHILD_NO_CHARGE_VALUE",
          `Child age rule ${ruleNumber} must use 0 when no extra charge is selected.`
        );
      }


      const bedPolicy =
        String(
          rule.bed_policy ||
          ""
        );


      if (
        !CHILD_BED_POLICIES
          .has(
            bedPolicy
          )
      ) {
        throw serviceError(
          400,
          "INVALID_CHILD_BED_POLICY",
          `Child age rule ${ruleNumber} has an invalid bed requirement.`
        );
      }


      expectedMinimumAge =
        maximumAge + 1;
    }
  );
}


/* ============================================================
   GUEST / OCCUPANCY POLICY VALIDATION

   Validates related settings together so changing adult age
   cannot leave existing child age rules in an invalid state.
============================================================ */

function validateGuestRequirementPolicy(
  settings
) {
  const adultAge =
    Number(
      settings
        ?.adult_age_from
    );


  if (
    !Number.isSafeInteger(
      adultAge
    ) ||
    adultAge < 1 ||
    adultAge >
      MAX_GUEST_AGE
  ) {
    throw serviceError(
      400,
      "INVALID_ADULT_AGE",
      `Adult age must be a whole number between 1 and ${MAX_GUEST_AGE}.`
    );
  }


  const childRules =
    Array.isArray(
      settings
        ?.child_age_rules
    )
      ? settings
          .child_age_rules
      : [];


  validateChildAgeRules(
    childRules,
    adultAge
  );


  const extraBedEnabled =
    settings
      ?.extra_bed_enabled ===
    true;


  /*
   * Child rules cannot require or suggest
   * an extra bed when the hotel-level
   * Extra Bed facility is disabled.
   */
  if (
    !extraBedEnabled
  ) {
    const invalidRuleIndex =
      childRules
        .findIndex(
          (rule) =>
            [
              "extra_bed_optional",
              "extra_bed_required",
            ].includes(
              rule
                ?.bed_policy
            )
        );


    if (
      invalidRuleIndex !==
      -1
    ) {
      throw serviceError(
        400,
        "EXTRA_BED_POLICY_DISABLED",
        `Child age rule ${invalidRuleIndex + 1} cannot use an extra-bed requirement while Extra Beds are disabled.`
      );
    }
  }
}

/* ============================================================
   EARLY CHECK-IN RULE VALIDATION
============================================================ */

function validateEarlyCheckinChargeRule(
  rule
) {
  if (
    !rule ||
    typeof rule !==
      "object" ||
    Array.isArray(rule)
  ) {
    throw serviceError(
      400,
      "INVALID_EARLY_CHECKIN_RULE",
      "Early check-in charge rule is invalid."
    );
  }


  const method =
    String(
      rule.method || ""
    );


  if (
    !EARLY_CHECKIN_CHARGE_METHODS
      .has(method)
  ) {
    throw serviceError(
      400,
      "INVALID_EARLY_CHECKIN_METHOD",
      "The early check-in charge method is invalid."
    );
  }


  const value =
    Number(
      rule.value ?? 0
    );


  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw serviceError(
      400,
      "INVALID_EARLY_CHECKIN_VALUE",
      "The early check-in charge value is invalid."
    );
  }


  if (
    method ===
      "percentage_per_hour" &&
    value > 100
  ) {
    throw serviceError(
      400,
      "INVALID_EARLY_CHECKIN_PERCENTAGE",
      "Early check-in percentage per hour cannot exceed 100%."
    );
  }


  if (
    [
      "none",
      "manual",
    ].includes(method) &&
    value !== 0
  ) {
    throw serviceError(
      400,
      "INVALID_EARLY_CHECKIN_UNUSED_VALUE",
      "No-charge and manual early check-in methods must use a value of 0."
    );
  }


  const maximumPercentage =
    Number(
      rule
        .maximum_percentage_of_night ??
      100
    );


  if (
    !Number.isFinite(
      maximumPercentage
    ) ||
    maximumPercentage < 0 ||
    maximumPercentage > 100
  ) {
    throw serviceError(
      400,
      "INVALID_EARLY_CHECKIN_CAP",
      "The early check-in maximum charge cap must be between 0% and 100% of the night rate."
    );
  }
}


/* ============================================================
   DAY USE SLABS
============================================================ */

function validateDayUseSlabs(
  slabs,
  pricingMode,
  maximumHours
) {
  if (
    !Array.isArray(slabs)
  ) {
    throw serviceError(
      400,
      "INVALID_DAY_USE_SLABS",
      "Day-use pricing slabs must be an array."
    );
  }

  if (
    pricingMode ===
    "hourly"
  ) {
    return;
  }


  if (
    slabs.length === 0
  ) {
    throw serviceError(
      400,
      "DAY_USE_SLABS_REQUIRED",
      "At least one Day Use pricing slab is required."
    );
  }


  let previousHours =
    0;

  let previousValue =
    null;

  slabs.forEach(
    (
      slab,
      index
    ) => {
      const ruleNumber =
        index + 1;


      if (
        !slab ||
        typeof slab !==
          "object" ||
        Array.isArray(slab)
      ) {
        throw serviceError(
          400,
          "INVALID_DAY_USE_SLAB",
          `Day Use pricing slab ${ruleNumber} is invalid.`
        );
      }


      const hours =
        Number(
          slab.up_to_hours
        );


      const value =
        Number(
          slab.value
        );


      if (
        !Number.isSafeInteger(
          hours
        ) ||
        hours <= 0
      ) {
        throw serviceError(
          400,
          "INVALID_DAY_USE_HOURS",
          `Day Use pricing slab ${ruleNumber} must use a valid whole-hour duration.`
        );
      }


      if (
        hours <=
        previousHours
      ) {
        throw serviceError(
          400,
          "DAY_USE_SLAB_ORDER_INVALID",
          "Day Use pricing durations must increase from one slab to the next."
        );
      }


      if (
        hours >
        maximumHours
      ) {
        throw serviceError(
          400,
          "DAY_USE_SLAB_EXCEEDS_LIMIT",
          `Day Use pricing slab ${ruleNumber} exceeds the configured maximum Day Use duration.`
        );
      }


      if (
        !Number.isFinite(
          value
        ) ||
        value < 0
      ) {
        throw serviceError(
          400,
          "INVALID_DAY_USE_SLAB_VALUE",
          `Day Use pricing slab ${ruleNumber} has an invalid price value.`
        );
      }


      if (
        pricingMode ===
          "percentage_slabs" &&
        value > 100
      ) {
        throw serviceError(
          400,
          "INVALID_DAY_USE_PERCENTAGE",
          `Day Use pricing slab ${ruleNumber} percentage cannot exceed 100%.`
        );
      }


      /*
      * A longer Day Use duration must never
      * become cheaper than a shorter duration.
      *
      * Valid:
      * 3h  -> 40%
      * 6h  -> 55%
      * 9h  -> 70%
      *
      * Invalid:
      * 3h  -> 40%
      * 6h  -> 55%
      * 9h  -> 30%
      *
      * Same rule applies to Fixed Slot prices.
      */
      if (
        pricingMode !==
          "hourly" &&
        previousValue !==
          null &&
        value <
          previousValue
      ) {
        throw serviceError(
          400,
          "DAY_USE_SLAB_PRICE_DECREASE",
          `Day Use pricing slab ${ruleNumber} cannot be cheaper than the previous shorter-duration slab.`
        );
      }


      previousHours =
        hours;


      previousValue =
        value;
    }
  );

  const finalSlabHours =
    Number(
      slabs[
        slabs.length - 1
      ]?.up_to_hours
    );


  if (
    finalSlabHours !==
    maximumHours
  ) {
    throw serviceError(
      400,
      "DAY_USE_DURATION_MISMATCH",
      "The final Day Use pricing slab must match the maximum Day Use duration."
    );
  }

}


/* ============================================================
   DAY USE POLICY
============================================================ */

function validateDayUsePolicy(
  settings
) {
  const pricingMode =
    String(
      settings
        ?.pricing_mode ||
      ""
    );


  if (
    !DAY_USE_PRICING_MODES
      .has(
        pricingMode
      )
  ) {
    throw serviceError(
      400,
      "INVALID_DAY_USE_PRICING_MODE",
      "The Day Use pricing mode is invalid."
    );
  }


  const maximumHours =
    Number(
      settings
        ?.maximum_day_use_hours
    );


  /*
   * Day Use is intentionally a same-day / short-stay product.
   * 24+ hour stays belong to normal overnight booking.
   */
  if (
    !Number.isSafeInteger(
      maximumHours
    ) ||
    maximumHours < 1 ||
    maximumHours > 23
  ) {
    throw serviceError(
      400,
      "INVALID_DAY_USE_MAXIMUM_HOURS",
      "Maximum Day Use duration must be between 1 and 23 hours."
    );
  }


  validateDayUseSlabs(
    settings
      ?.pricing_slabs ||
      [],
    pricingMode,
    maximumHours
  );


  const hourlyRateType =
    String(
      settings
        ?.hourly_rate_type ||
      ""
    );


  if (
    !DAY_USE_HOURLY_RATE_TYPES
      .has(
        hourlyRateType
      )
  ) {
    throw serviceError(
      400,
      "INVALID_DAY_USE_HOURLY_TYPE",
      "The Day Use hourly-rate type is invalid."
    );
  }


  const hourlyRate =
    Number(
      settings
        ?.hourly_rate_value
    );


  if (
    !Number.isFinite(
      hourlyRate
    ) ||
    hourlyRate < 0
  ) {
    throw serviceError(
      400,
      "INVALID_DAY_USE_HOURLY_RATE",
      "The Day Use hourly rate is invalid."
    );
  }


  if (
    hourlyRateType ===
      "percentage_of_night" &&
    hourlyRate > 100
  ) {
    throw serviceError(
      400,
      "INVALID_DAY_USE_HOURLY_PERCENTAGE",
      "The Day Use hourly percentage cannot exceed 100% of the night rate per hour."
    );
  }


  const maximumChargePercent =
    Number(
      settings
        ?.maximum_day_use_charge_percent
    );


  if (
    !Number.isFinite(
      maximumChargePercent
    ) ||
    maximumChargePercent <= 0 ||
    maximumChargePercent > 100
  ) {
    throw serviceError(
      400,
      "INVALID_DAY_USE_CHARGE_CAP",
      "Maximum Day Use charge must be greater than 0% and cannot exceed 100% of the normal room rate."
    );
  }


  const conversionMode =
    String(
      settings
        ?.overnight_conversion_mode ||
      ""
    );


  if (
    !DAY_USE_OVERNIGHT_MODES
      .has(
        conversionMode
      )
  ) {
    throw serviceError(
      400,
      "INVALID_DAY_USE_CONVERSION_MODE",
      "The Day Use to Overnight conversion rule is invalid."
    );
  }
}


/* ============================================================
   CHECK-IN / ARRIVAL POLICY

   Actual check-in remains an Admin action.
   These settings only determine how early arrival is priced.
============================================================ */

function validateCheckinCheckoutPolicy(
  settings,
  dayUseSettings
) {
  const graceMinutes =
    Number(
      settings
        ?.early_checkin_free_grace_minutes
    );


  if (
    !Number.isSafeInteger(
      graceMinutes
    ) ||
    graceMinutes < 0 ||
    graceMinutes > 720
  ) {
    throw serviceError(
      400,
      "INVALID_EARLY_CHECKIN_GRACE",
      "Early check-in free grace must be between 0 and 720 minutes."
    );
  }


  validateEarlyCheckinChargeRule(
    settings
      ?.early_checkin_charge_rule
  );


  const veryEarlyAction =
    String(
      settings
        ?.very_early_arrival_action ||
      ""
    );


  if (
    !VERY_EARLY_ARRIVAL_ACTIONS
      .has(
        veryEarlyAction
      )
  ) {
    throw serviceError(
      400,
      "INVALID_VERY_EARLY_ARRIVAL_ACTION",
      "The very-early-arrival action is invalid."
    );
  }


  /*
   * Day Use can be selected as the very-early-arrival
   * treatment only when Day Use itself is enabled.
   */
  if (
    veryEarlyAction ===
      "day_use" &&
    dayUseSettings
      ?.enabled !==
      true
  ) {
    throw serviceError(
      400,
      "DAY_USE_NOT_ENABLED",
      "Day Use must be enabled before it can be used for very early arrivals."
    );
  }
}

/* ============================================================
   SETTING VALIDATION
============================================================ */

function validateSetting(
  section,
  key,
  value
) {
  const definition =
    getDefaultSetting(
      section,
      key
    );


  if (!definition) {
    throw serviceError(
      400,
      "UNKNOWN_SETTING",
      `Setting ${section}.${key} is not supported.`
    );
  }


  if (
    !validDataType(
      value,
      definition.dataType
    )
  ) {
    throw serviceError(
      400,
      "INVALID_SETTING_VALUE",
      `The value for ${section}.${key} is invalid.`
    );
  }

  if (
    section ===
      "guest_requirements" &&
    key ===
      "adult_age_from"
  ) {
    if (
      !Number.isSafeInteger(
        value
      ) ||
      value < 1 ||
      value >
        MAX_GUEST_AGE
    ) {
      throw serviceError(
        400,
        "INVALID_ADULT_AGE",
        `Adult age must be a whole number between 1 and ${MAX_GUEST_AGE}.`
      );
    }
  }


  if (
    section ===
      "guest_requirements" &&
    key ===
      "child_age_rules"
  ) {
    validateChildAgeRules(
      value
    );
  }

  if (
    section ===
      "cancellation" &&
    key ===
      "calculation_mode" &&
    !CANCELLATION_MODES
      .has(value)
  ) {
    throw serviceError(
      400,
      "INVALID_CANCELLATION_MODE",
      "Cancellation calculation mode must be manual or rules."
    );
  }


  if (
    section ===
      "cancellation" &&
    key ===
      "rules"
  ) {
    validateCancellationRules(
      value
    );
  }


  if (
    [
      "cancellation",
      "no_show",
      "early_checkout",
      "payment",
    ].includes(
      section
    ) &&
    [
      "same_day_rule",
      "hotel_cancellation_rule",
      "charge_rule",
      "advance_requirement",
    ].includes(
      key
    )
  ) {
    validateChargeRule(
      value,
      `${section}.${key}`
    );
  }


  if (
    section ===
      "room_change" &&
    [
      "hotel_fault_upgrade_pricing",
      "hotel_fault_downgrade_pricing",
      "hotel_fault_same_rate_pricing",
      "if_guest_stays_in_replacement_room",
      "guest_request_upgrade_pricing",
      "guest_request_downgrade_pricing",
    ].includes(
      key
    )
  ) {
    validatePriceRule(
      value,
      `${section}.${key}`
    );
  }


  if (
    section ===
      "room_change" &&
    key ===
      "when_original_room_ready" &&
    !ROOM_READY_ACTIONS
      .has(value)
  ) {
    throw serviceError(
      400,
      "INVALID_ORIGINAL_ROOM_READY_ACTION",
      "The original-room-ready action is invalid."
    );
  }


  if (
    section ===
      "early_checkout" &&
    key ===
      "refund_handling" &&
    !REFUND_HANDLING_OPTIONS
      .includes(value)
  ) {
    throw serviceError(
      400,
      "INVALID_REFUND_HANDLING",
      "The early-checkout refund handling option is invalid."
    );
  }


  if (
    section ===
      "discount" &&
    key ===
      "allowed_methods" &&
    !value.every(
      (method) =>
        [
          "percentage",
          "fixed_amount",
        ].includes(
          method
        )
    )
  ) {
    throw serviceError(
      400,
      "INVALID_DISCOUNT_METHOD",
      "Discount methods can only use percentage or fixed amount."
    );
  }


  if (
    section ===
      "concession" &&
    key ===
      "mode" &&
    !CONCESSION_MODES
      .has(value)
  ) {
    throw serviceError(
      400,
      "INVALID_CONCESSION_MODE",
      "The concession mode is invalid."
    );
  }


  if (
    section ===
      "vip" &&
    key ===
      "default_billing_mode" &&
    !VIP_BILLING_MODES
      .includes(value)
  ) {
    throw serviceError(
      400,
      "INVALID_VIP_BILLING_MODE",
      "The VIP billing mode is invalid."
    );
  }


  if (
    section ===
      "vip" &&
    key ===
      "allowed_billing_modes" &&
    !value.every(
      (mode) =>
        VIP_BILLING_MODES
          .includes(mode)
    )
  ) {
    throw serviceError(
      400,
      "INVALID_VIP_BILLING_MODES",
      "One or more VIP billing modes are invalid."
    );
  }


  if (
    section ===
      "refund" &&
    key ===
      "handling_mode" &&
    !REFUND_MODES
      .has(value)
  ) {
    throw serviceError(
      400,
      "INVALID_REFUND_MODE",
      "The refund handling mode is invalid."
    );
  }


  return definition;
}


/* ============================================================
   READ SETTING ROWS
============================================================ */

async function settingRows(
  connection,
  hotelId
) {
  const [rows] =
    await connection.query(
      `
        SELECT
          setting_id,
          setting_section,
          setting_key,
          setting_value,
          data_type,
          version_no,
          updated_by_type,
          updated_by_id,
          updated_by_display_id,
          updated_by_name,
          created_at,
          updated_at

        FROM hotel_settings

        WHERE hotel_id = ?

        ORDER BY
          setting_section,
          setting_key
      `,
      [
        hotelId,
      ]
    );


  return rows;
}


/* ============================================================
   GROUP SETTINGS FOR FRONTEND
============================================================ */

function groupSettings(
  rows
) {
  const settings = {};
  const metadata = {};


  for (
    const row of
      rows
  ) {
    const section =
      row.setting_section;

    const key =
      row.setting_key;


    if (
      !settings[section]
    ) {
      settings[section] = {};
    }


    if (
      !metadata[section]
    ) {
      metadata[section] = {};
    }


    settings[
      section
    ][
      key
    ] =
      parseJson(
        row.setting_value,
        `${section}.${key}`
      );


    metadata[
      section
    ][
      key
    ] = {
      settingId:
        Number(
          row.setting_id
        ),

      dataType:
        row.data_type,

      versionNo:
        Number(
          row.version_no
        ),

      updatedBy: {
        type:
          row.updated_by_type,

        id:
          row.updated_by_id ===
            null
            ? null
            : Number(
                row.updated_by_id
              ),

        displayId:
          row.updated_by_display_id,

        name:
          row.updated_by_name,
      },

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    };
  }


  return {
    settings,
    metadata,
  };
}


/* ============================================================
   POLICY SECTION SNAPSHOT
============================================================ */

async function sectionSnapshot(
  connection,
  hotelId,
  section
) {
  const [rows] =
    await connection.query(
      `
        SELECT
          setting_key,
          setting_value

        FROM hotel_settings

        WHERE hotel_id = ?
          AND setting_section = ?

        ORDER BY setting_key
      `,
      [
        hotelId,
        section,
      ]
    );


  const snapshot = {};


  for (
    const row of
      rows
  ) {
    snapshot[
      row.setting_key
    ] =
      parseJson(
        row.setting_value,
        `${section}.${row.setting_key}`
      );
  }


  return snapshot;
}

/* ============================================================
   VALIDATE RELATED GUEST REQUIREMENT CHANGES

   Guest age settings are related:

   - adult_age_from
   - child_age_rules

   They must always be validated as one final policy state,
   including normal update, restore and reset actions.
============================================================ */

async function validateGuestRequirementChangesWithConnection(
  connection,
  hotelId,
  changes = []
) {
  const relevantChanges =
    (
      Array.isArray(
        changes
      )
        ? changes
        : []
    ).filter(
      (change) =>
        change?.section ===
          "guest_requirements" &&
        [
          "adult_age_from",
          "child_age_rules",
          "extra_bed_enabled",
        ].includes(
          change?.key
        )
    );


  if (
    !relevantChanges.length
  ) {
    return;
  }


  const currentGuestPolicy =
    await sectionSnapshot(
      connection,
      hotelId,
      "guest_requirements"
    );


  const nextGuestPolicy = {
    ...currentGuestPolicy,
  };


  for (
    const change of
      relevantChanges
  ) {
    nextGuestPolicy[
      change.key
    ] =
      change.value;
  }


  validateGuestRequirementPolicy(
    nextGuestPolicy
  );
}

/* ============================================================
   VALIDATE CHECK-IN + DAY USE TOGETHER

   These sections are related because a very-early arrival
   may optionally be routed into the Day Use policy.
============================================================ */

async function validateArrivalPolicyChangesWithConnection(
  connection,
  hotelId,
  changes = []
) {
  const sourceChanges =
    Array.isArray(
      changes
    )
      ? changes
      : [];


  const relevant =
    sourceChanges.filter(
      (change) =>
        [
          "checkin_checkout",
          "day_use",
        ].includes(
          change?.section
        )
    );


  if (
    !relevant.length
  ) {
    return;
  }


  const [
    currentCheckin,
    currentDayUse,
  ] =
    await Promise.all([
      sectionSnapshot(
        connection,
        hotelId,
        "checkin_checkout"
      ),

      sectionSnapshot(
        connection,
        hotelId,
        "day_use"
      ),
    ]);


  const nextCheckin = {
    ...currentCheckin,
  };


  const nextDayUse = {
    ...currentDayUse,
  };


  for (
    const change of
      relevant
  ) {
    if (
      change.section ===
      "checkin_checkout"
    ) {
      nextCheckin[
        change.key
      ] =
        change.value;
    }


    if (
      change.section ===
      "day_use"
    ) {
      nextDayUse[
        change.key
      ] =
        change.value;
    }
  }


  validateDayUsePolicy(
    nextDayUse
  );


  validateCheckinCheckoutPolicy(
    nextCheckin,
    nextDayUse
  );
}

/* ============================================================
   CREATE POLICY VERSION

   Example:

   cancellation v1
   cancellation v2
   cancellation v3
============================================================ */

async function createPolicyVersion(
  connection,
  {
    hotel,
    section,
    actor,
    changeReason =
      null,
  }
) {
  if (
    !POLICY_SECTIONS
      .has(section)
  ) {
    return null;
  }


  const snapshot =
    await sectionSnapshot(
      connection,
      hotel.hotelId,
      section
    );


  const [[latest]] =
    await connection.query(
      `
        SELECT
          version_no

        FROM hotel_policy_versions

        WHERE hotel_id = ?
          AND policy_group = ?

        ORDER BY
          version_no DESC

        LIMIT 1
      `,
      [
        hotel.hotelId,
        section,
      ]
    );


  const versionNo =
    Number(
      latest?.version_no ||
      0
    ) + 1;


  const [result] =
    await connection.query(
      `
        INSERT INTO hotel_policy_versions (
          hotel_id,
          policy_group,
          version_no,
          policy_snapshot,

          created_by_type,
          created_by_id,
          created_by_display_id,
          created_by_name,

          change_reason
        )

        VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?
        )
      `,
      [
        hotel.hotelId,
        section,
        versionNo,
        JSON.stringify(
          snapshot
        ),

        actor.type,
        actor.id,
        actor.displayId,
        actor.name,

        optionalText(
          changeReason,
          500
        ),
      ]
    );


  return {
    policyVersionId:
      Number(
        result.insertId
      ),

    policyGroup:
      section,

    versionNo,

    snapshot,
  };
}


/* ============================================================
   IMMUTABLE AUDIT INSERT

   Deliberately no update/delete audit function.
============================================================ */

async function addAudit(
  connection,
  {
    hotel,
    section,
    key,
    actionType,

    oldValue,
    newValue,

    oldVersion,
    newVersion,

    actor,

    changeReason =
      null,

    meta =
      {},
  }
) {
  const normalizedMeta =
    requestMeta(
      meta
    );


  const [result] =
    await connection.query(
      `
        INSERT INTO hotel_setting_audit_logs (
          hotel_id,
          hotel_name_snapshot,

          setting_section,
          setting_key,

          action_type,

          old_value,
          new_value,

          old_version,
          new_version,

          actor_type,
          actor_id,
          actor_display_id,
          actor_name,

          change_reason,

          request_id,
          ip_address,
          user_agent
        )

        VALUES (
          ?, ?,
          ?, ?,
          ?,
          ?, ?,
          ?, ?,
          ?, ?, ?, ?,
          ?,
          ?, ?, ?
        )
      `,
      [
        hotel.hotelId,
        hotel.name,

        section,
        key,

        actionType,

        oldValue ===
          null ||
        oldValue ===
          undefined
          ? null
          : serializeSettingValue(
              oldValue
            ),

        serializeSettingValue(
          newValue
        ),

        oldVersion,
        newVersion,

        actor.type,
        actor.id,
        actor.displayId,
        actor.name,

        optionalText(
          changeReason,
          500
        ),

        normalizedMeta.requestId,
        normalizedMeta.ipAddress,
        normalizedMeta.userAgent,
      ]
    );


  return Number(
    result.insertId
  );
}


/* ============================================================
   INITIALIZE DEFAULTS

   First initialization:
   - inserts all defaults
   - creates policy version 1
   - does not flood audit log

   Future application update:
   - new missing setting is added
   - system audit entry created
   - policy section receives new version
============================================================ */

async function ensureDefaults(
  connection,
  hotel
) {
  const defaults =
    flattenHotelSettings();


  const [existingRows] =
    await connection.query(
      `
        SELECT
          setting_section,
          setting_key

        FROM hotel_settings

        WHERE hotel_id = ?
      `,
      [
        hotel.hotelId,
      ]
    );


  const firstInitialization =
    existingRows.length ===
    0;


  const existing =
    new Set(
      existingRows.map(
        (row) =>
          `${row.setting_section}.${row.setting_key}`
      )
    );


  const system =
    systemActor();


  const changedPolicySections =
    new Set();


  let insertedCount = 0;


  for (
    const setting of
      defaults
  ) {
    const compoundKey =
      `${setting.section}.${setting.key}`;


    if (
      existing.has(
        compoundKey
      )
    ) {
      continue;
    }


    await connection.query(
      `
        INSERT INTO hotel_settings (
          hotel_id,

          setting_section,
          setting_key,
          setting_value,
          data_type,

          version_no,

          updated_by_type,
          updated_by_name
        )

        VALUES (
          ?, ?, ?, ?, ?,
          1,
          'system',
          'HMS System'
        )
      `,
      [
        hotel.hotelId,

        setting.section,
        setting.key,

        serializeSettingValue(
          setting.value
        ),

        setting.dataType,
      ]
    );


    insertedCount += 1;


    if (
      setting.isPolicy
    ) {
      changedPolicySections
        .add(
          setting.section
        );
    }


    if (
      !firstInitialization
    ) {
      await addAudit(
        connection,
        {
          hotel,

          section:
            setting.section,

          key:
            setting.key,

          actionType:
            "create",

          oldValue:
            null,

          newValue:
            setting.value,

          oldVersion:
            null,

          newVersion:
            1,

          actor:
            system,

          changeReason:
            "New HMS setting initialized by system update.",
        }
      );
    }
  }


  /* ==========================================================
     INITIAL POLICY VERSION
  ========================================================== */

  if (
    firstInitialization
  ) {
    for (
      const section of
        POLICY_SECTIONS
    ) {
      const [[existingVersion]] =
        await connection.query(
          `
            SELECT
              policy_version_id

            FROM hotel_policy_versions

            WHERE hotel_id = ?
              AND policy_group = ?

            LIMIT 1
          `,
          [
            hotel.hotelId,
            section,
          ]
        );


      if (
        !existingVersion
      ) {
        await createPolicyVersion(
          connection,
          {
            hotel,

            section,

            actor:
              system,

            changeReason:
              "Initial hotel policy version.",
          }
        );
      }
    }
  } else {
    for (
      const section of
        changedPolicySections
    ) {
      await createPolicyVersion(
        connection,
        {
          hotel,

          section,

          actor:
            system,

          changeReason:
            "HMS added a new setting to this policy section.",
        }
      );
    }
  }


  return {
    firstInitialization,
    insertedCount,
  };
}


/* ============================================================
   DOES THIS POLICY CHANGE REQUIRE A REASON?
============================================================ */

async function reasonRequired(
  connection,
  hotelId,
  section
) {
  if (
    !SENSITIVE_SETTING_SECTIONS
      .has(section)
  ) {
    return false;
  }


  const [[row]] =
    await connection.query(
      `
        SELECT
          setting_value

        FROM hotel_settings

        WHERE hotel_id = ?
          AND setting_section = 'audit'
          AND setting_key =
              'require_reason_for_policy_change'

        LIMIT 1
      `,
      [
        hotelId,
      ]
    );


  if (!row) {
    return true;
  }


  return (
    parseJson(
      row.setting_value,
      "audit.require_reason_for_policy_change"
    ) === true
  );
}


/* ============================================================
   APPLY ONE SETTING CHANGE

   Important:
   This creates audit history.

   Policy version is created by the outer save function,
   so saving 5 cancellation fields together creates only ONE
   final cancellation policy version.
============================================================ */

async function applyChange(
  connection,
  {
    hotel,
    actor,

    section,
    key,
    value,

    actionType,

    changeReason,

    meta,
  }
) {
  const definition =
    validateSetting(
      section,
      key,
      value
    );


  const [[current]] =
    await connection.query(
      `
        SELECT
          setting_value,
          data_type,
          version_no

        FROM hotel_settings

        WHERE hotel_id = ?
          AND setting_section = ?
          AND setting_key = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hotel.hotelId,
        section,
        key,
      ]
    );


  if (!current) {
    throw serviceError(
      404,
      "SETTING_NOT_FOUND",
      `Setting ${section}.${key} was not found.`
    );
  }


  const oldValue =
    parseJson(
      current.setting_value,
      `${section}.${key}`
    );


  if (
    sameValue(
      oldValue,
      value
    )
  ) {
    return {
      changed:
        false,

      section,
      key,

      auditId:
        null,

      setting: {
        value:
          oldValue,

        dataType:
          current.data_type,

        versionNo:
          Number(
            current.version_no
          ),
      },
    };
  }


  const reason =
    optionalText(
      changeReason,
      500
    );


  if (
    (
      await reasonRequired(
        connection,
        hotel.hotelId,
        section
      )
    ) &&
    !reason
  ) {
    throw serviceError(
      400,
      "CHANGE_REASON_REQUIRED",
      `A reason is required to change ${section}.${key}.`
    );
  }


  const oldVersion =
    Number(
      current.version_no
    );


  const newVersion =
    oldVersion + 1;


  await connection.query(
    `
      UPDATE hotel_settings

      SET
        setting_value = ?,
        data_type = ?,
        version_no = ?,

        updated_by_type = ?,
        updated_by_id = ?,
        updated_by_display_id = ?,
        updated_by_name = ?

      WHERE hotel_id = ?
        AND setting_section = ?
        AND setting_key = ?
    `,
    [
      serializeSettingValue(
        value
      ),

      definition.dataType,

      newVersion,

      actor.type,
      actor.id,
      actor.displayId,
      actor.name,

      hotel.hotelId,
      section,
      key,
    ]
  );


  const auditId =
    await addAudit(
      connection,
      {
        hotel,

        section,
        key,

        actionType,

        oldValue,

        newValue:
          value,

        oldVersion,
        newVersion,

        actor,

        changeReason:
          reason,

        meta,
      }
    );


  return {
    changed:
      true,

    section,
    key,

    auditId,

    setting: {
      value,

      dataType:
        definition.dataType,

      versionNo:
        newVersion,

      updatedBy: {
        type:
          actor.type,

        id:
          actor.id,

        displayId:
          actor.displayId,

        name:
          actor.name,
      },
    },
  };
}


/* ============================================================
   INITIALIZE HOTEL SETTINGS
============================================================ */

async function initializeHotelSettings(
  hotelId
) {
  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const hotel =
      await getHotelForSystem(
        connection,
        hotelId,
        true
      );


    const result =
      await ensureDefaults(
        connection,
        hotel
      );


    await connection
      .commit();


    return {
      hotel,
      ...result,
    };
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    throw error;
  } finally {
    connection.release();
  }
}


/* ============================================================
   GET HOTEL SETTINGS
============================================================ */

async function getHotelSettings(
  hotelId,
  dbUser
) {
  const actor =
    buildActorFromDbUser(
      dbUser
    );


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const hotel =
      await getHotelForActor(
        connection,
        hotelId,
        actor,
        true
      );


    await ensureDefaults(
      connection,
      hotel
    );


    const rows =
      await settingRows(
        connection,
        hotel.hotelId
      );


    const payload =
      groupSettings(
        rows
      );


    const [versionRows] =
      await connection.query(
        `
          SELECT
            pv.policy_version_id,
            pv.policy_group,
            pv.version_no,

            pv.created_by_type,
            pv.created_by_id,
            pv.created_by_display_id,
            pv.created_by_name,

            pv.change_reason,
            pv.created_at

          FROM hotel_policy_versions pv

          INNER JOIN (
            SELECT
              policy_group,
              MAX(version_no)
                AS max_version

            FROM hotel_policy_versions

            WHERE hotel_id = ?

            GROUP BY
              policy_group
          ) latest

            ON latest.policy_group =
               pv.policy_group

           AND latest.max_version =
               pv.version_no

          WHERE pv.hotel_id = ?

          ORDER BY
            pv.policy_group
        `,
        [
          hotel.hotelId,
          hotel.hotelId,
        ]
      );


    const policyVersions = {};


    for (
      const row of
        versionRows
    ) {
      policyVersions[
        row.policy_group
      ] = {
        policyVersionId:
          Number(
            row.policy_version_id
          ),

        versionNo:
          Number(
            row.version_no
          ),

        createdBy: {
          type:
            row.created_by_type,

          id:
            row.created_by_id ===
              null
              ? null
              : Number(
                  row.created_by_id
                ),

          displayId:
            row.created_by_display_id,

          name:
            row.created_by_name,
        },

        changeReason:
          row.change_reason,

        createdAt:
          row.created_at,
      };
    }


    await connection
      .commit();


    return {
      hotel,

      settings:
        payload.settings,

      metadata:
        payload.metadata,

      policyVersions,
    };
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    throw error;
  } finally {
    connection.release();
  }
}


/* ============================================================
   UPDATE MULTIPLE SETTINGS

   Very important:

   Example Admin changes:
   cancellation.calculation_mode
   cancellation.rules
   cancellation.same_day_rule

   All changes are one transaction.

   If one fails:
   ALL rollback.

   If all pass:
   individual audit rows
   +
   ONE cancellation policy version.
============================================================ */

async function updateHotelSettings({
  hotelId,

  dbUser,

  changes,

  changeReason =
    null,

  requestMeta:
    meta = {},
}) {
  const actor =
    buildActorFromDbUser(
      dbUser
    );


  if (
    !Array.isArray(
      changes
    ) ||
    changes.length ===
      0
  ) {
    throw serviceError(
      400,
      "SETTINGS_CHANGES_REQUIRED",
      "At least one setting change is required."
    );
  }


  if (
    changes.length >
    100
  ) {
    throw serviceError(
      400,
      "TOO_MANY_SETTING_CHANGES",
      "A maximum of 100 settings can be saved at once."
    );
  }


  const normalized =
    changes.map(
      (
        change,
        index
      ) => {
        const section =
          String(
            change?.section ||
            ""
          ).trim();


        const key =
          String(
            change?.key ||
            ""
          ).trim();


        if (
          !section ||
          !key ||
          !Object.prototype
            .hasOwnProperty
            .call(
              change || {},
              "value"
            )
        ) {
          throw serviceError(
            400,
            "INVALID_SETTING_CHANGE",
            `Setting change ${index + 1} is incomplete.`
          );
        }


        return {
          section,

          key,

          value:
            change.value,

          changeReason:
            optionalText(
              change.changeReason,
              500
            ) ||
            optionalText(
              changeReason,
              500
            ),
        };
      }
    );


  /* ==========================================================
     BLOCK DUPLICATE KEYS IN SAME SAVE
  ========================================================== */

  const seen =
    new Set();


  for (
    const change of
      normalized
  ) {
    const compoundKey =
      `${change.section}.${change.key}`;


    if (
      seen.has(
        compoundKey
      )
    ) {
      throw serviceError(
        400,
        "DUPLICATE_SETTING_CHANGE",
        `Setting ${compoundKey} was included more than once.`
      );
    }


    seen.add(
      compoundKey
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const hotel =
      await getHotelForActor(
        connection,
        hotelId,
        actor,
        true
      );


    await ensureDefaults(
      connection,
      hotel
    );


    /* ==========================================================
      PREFLIGHT RELATED GUEST SETTINGS

      Example:
      adult_age_from: 18 -> 16
      child_age_rules: ... -> ending at 15

      Both changes are validated as ONE final policy state before
      any database row is updated.
    ========================================================== */

    await validateGuestRequirementChangesWithConnection(
      connection,
      hotel.hotelId,
      normalized
    );

    await validateArrivalPolicyChangesWithConnection(
      connection,
      hotel.hotelId,
      normalized
    );

    const results = [];


    const policySections =
      new Set();


    for (
      const change of
        normalized
    ) {
      const result =
        await applyChange(
          connection,
          {
            hotel,
            actor,

            section:
              change.section,

            key:
              change.key,

            value:
              change.value,

            actionType:
              "update",

            changeReason:
              change.changeReason,

            meta,
          }
        );


      results.push(
        result
      );


      if (
        result.changed &&
        POLICY_SECTIONS
          .has(
            change.section
          )
      ) {
        policySections
          .add(
            change.section
          );
      }
    }


    /* ========================================================
       CREATE ONE VERSION PER CHANGED POLICY SECTION
    ======================================================== */

    const policyVersions = {};


    for (
      const section of
        policySections
    ) {
      policyVersions[
        section
      ] =
        await createPolicyVersion(
          connection,
          {
            hotel,

            section,

            actor,

            changeReason:
              optionalText(
                changeReason,
                500
              ) ||
              "Hotel policy settings updated.",
          }
        );
    }


    await connection
      .commit();


    return {
      hotel,

      changedCount:
        results.filter(
          (item) =>
            item.changed
        ).length,

      changes:
        results,

      policyVersions,
    };
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    throw error;
  } finally {
    connection.release();
  }
}


/* ============================================================
   UPDATE SINGLE SETTING

   Convenience wrapper.
============================================================ */

async function updateHotelSetting(
  options
) {
  const result =
    await updateHotelSettings({
      hotelId:
        options.hotelId,

      dbUser:
        options.dbUser,

      changes: [
        {
          section:
            options.section,

          key:
            options.key,

          value:
            options.value,

          changeReason:
            options.changeReason,
        },
      ],

      changeReason:
        options.changeReason,

      requestMeta:
        options.requestMeta,
    });


  const section =
    String(
      options.section ||
      ""
    ).trim();


  return {
    hotel:
      result.hotel,

    ...result.changes[0],

    policyVersion:
      result.policyVersions[
        section
      ] ||
      null,
  };
}


/* ============================================================
   SETTINGS ACTIVITY HISTORY

   READ ONLY.

   Filters:
   - Section
   - Actor Type
   - Actor ID
   - From Date
   - To Date
============================================================ */

async function getHotelSettingAuditLogs({
  hotelId,

  dbUser,

  section =
    null,

  actorType =
    null,

  actorId =
    null,

  fromDate =
    null,

  toDate =
    null,

  page =
    1,

  pageSize =
    50,
}) {
  const actor =
    buildActorFromDbUser(
      dbUser
    );


  const safePage =
    Math.max(
      1,
      Number.parseInt(
        page,
        10
      ) || 1
    );


  const safePageSize =
    Math.min(
      100,

      Math.max(
        1,

        Number.parseInt(
          pageSize,
          10
        ) || 50
      )
    );


  const offset =
    (
      safePage - 1
    ) *
    safePageSize;


  const connection =
    await db.getConnection();


  try {
    const hotel =
      await getHotelForActor(
        connection,
        hotelId,
        actor
      );


    const where = [
      "hotel_id = ?",
    ];


    const params = [
      hotel.hotelId,
    ];


    /* ========================================================
       SECTION FILTER
    ======================================================== */

    if (section) {
      where.push(
        "setting_section = ?"
      );


      params.push(
        String(
          section
        ).trim()
      );
    }


    /* ========================================================
       ACTOR TYPE FILTER
    ======================================================== */

    if (actorType) {
      const type =
        String(
          actorType
        ).trim();


      if (
        ![
          "system",
          "admin",
          "super_admin",
        ].includes(
          type
        )
      ) {
        throw serviceError(
          400,
          "INVALID_AUDIT_ACTOR_TYPE",
          "Audit actor type is invalid."
        );
      }


      where.push(
        "actor_type = ?"
      );


      params.push(
        type
      );
    }


    /* ========================================================
       ACTOR ID FILTER
    ======================================================== */

    if (
      actorId !==
        null &&
      actorId !==
        undefined &&
      String(
        actorId
      ).trim() !==
        ""
    ) {
      const id =
        positiveId(
          actorId
        );


      if (!id) {
        throw serviceError(
          400,
          "INVALID_AUDIT_ACTOR_ID",
          "Audit actor ID is invalid."
        );
      }


      where.push(
        "actor_id = ?"
      );


      params.push(
        id
      );
    }


    /* ========================================================
       FROM DATE
    ======================================================== */

    if (fromDate) {
      const date =
        String(
          fromDate
        ).trim();


      if (
        !/^\d{4}-\d{2}-\d{2}$/
          .test(
            date
          )
      ) {
        throw serviceError(
          400,
          "INVALID_AUDIT_FROM_DATE",
          "fromDate must use YYYY-MM-DD."
        );
      }


      where.push(
        "changed_at >= ?"
      );


      params.push(
        `${date} 00:00:00`
      );
    }


    /* ========================================================
       TO DATE
    ======================================================== */

    if (toDate) {
      const date =
        String(
          toDate
        ).trim();


      if (
        !/^\d{4}-\d{2}-\d{2}$/
          .test(
            date
          )
      ) {
        throw serviceError(
          400,
          "INVALID_AUDIT_TO_DATE",
          "toDate must use YYYY-MM-DD."
        );
      }


      where.push(
        `
          changed_at <
          DATE_ADD(
            ?,
            INTERVAL 1 DAY
          )
        `
      );


      params.push(
        `${date} 00:00:00`
      );
    }


    const whereSql =
      where.join(
        " AND "
      );


    const [[countRow]] =
      await connection.query(
        `
          SELECT
            COUNT(*) AS total

          FROM hotel_setting_audit_logs

          WHERE ${whereSql}
        `,
        params
      );


    const [rows] =
      await connection.query(
        `
          SELECT
            audit_id,

            setting_section,
            setting_key,

            action_type,

            old_value,
            new_value,

            old_version,
            new_version,

            actor_type,
            actor_id,
            actor_display_id,
            actor_name,

            change_reason,

            changed_at

          FROM hotel_setting_audit_logs

          WHERE ${whereSql}

          ORDER BY
            changed_at DESC,
            audit_id DESC

          LIMIT ?
          OFFSET ?
        `,
        [
          ...params,

          safePageSize,

          offset,
        ]
      );


    return {
      hotel,

      pagination: {
        page:
          safePage,

        pageSize:
          safePageSize,

        total:
          Number(
            countRow?.total ||
            0
          ),
      },

      logs:
        rows.map(
          (row) => ({
            auditId:
              Number(
                row.audit_id
              ),

            section:
              row.setting_section,

            key:
              row.setting_key,

            actionType:
              row.action_type,

            oldValue:
              row.old_value ===
                null
                ? null
                : parseJson(
                    row.old_value,
                    "audit old value"
                  ),

            newValue:
              parseJson(
                row.new_value,
                "audit new value"
              ),

            oldVersion:
              row.old_version ===
                null
                ? null
                : Number(
                    row.old_version
                  ),

            newVersion:
              Number(
                row.new_version
              ),

            actor: {
              type:
                row.actor_type,

              id:
                row.actor_id ===
                  null
                  ? null
                  : Number(
                      row.actor_id
                    ),

              displayId:
                row.actor_display_id,

              name:
                row.actor_name,
            },

            changeReason:
              row.change_reason,

            changedAt:
              row.changed_at,
          })
        ),
    };
  } finally {
    connection.release();
  }
}


/* ============================================================
   RESTORE PREVIOUS VALUE

   Example:

   48 hours → 24 hours

   Restore:

   24 hours → 48 hours

   Old audit record remains untouched.
   New RESTORE audit record is created.
============================================================ */

async function restoreHotelSetting({
  hotelId,

  dbUser,

  auditId,

  changeReason =
    null,

  requestMeta:
    meta = {},
}) {
  const actor =
    buildActorFromDbUser(
      dbUser
    );


  const id =
    positiveId(
      auditId
    );


  if (!id) {
    throw serviceError(
      400,
      "INVALID_AUDIT_ID",
      "A valid audit history ID is required."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const hotel =
      await getHotelForActor(
        connection,
        hotelId,
        actor,
        true
      );


    await ensureDefaults(
      connection,
      hotel
    );


    const [[audit]] =
      await connection.query(
        `
          SELECT
            setting_section,
            setting_key,
            old_value

          FROM hotel_setting_audit_logs

          WHERE hotel_id = ?
            AND audit_id = ?

          LIMIT 1

          FOR UPDATE
        `,
        [
          hotel.hotelId,
          id,
        ]
      );


    if (!audit) {
      throw serviceError(
        404,
        "AUDIT_ENTRY_NOT_FOUND",
        "The settings history entry was not found."
      );
    }


    if (
      audit.old_value ===
      null
    ) {
      throw serviceError(
        409,
        "AUDIT_ENTRY_NOT_RESTORABLE",
        "This history entry does not contain a previous value."
      );
    }

    const restoreValue =
      parseJson(
        audit.old_value,
        "audit old value"
      );


    await validateGuestRequirementChangesWithConnection(
      connection,
      hotel.hotelId,
      [
        {
          section:
            audit.setting_section,

          key:
            audit.setting_key,

          value:
            restoreValue,
        },
      ]
    );

    await validateArrivalPolicyChangesWithConnection(
      connection,
      hotel.hotelId,
      [
        {
          section:
            audit.setting_section,

          key:
            audit.setting_key,

          value:
            restoreValue,
        },
      ]
    );

    const reason =
      optionalText(
        changeReason,
        500
      ) ||
      `Restored from settings audit #${id}.`;


    const result =
      await applyChange(
        connection,
        {
          hotel,
          actor,

          section:
            audit.setting_section,

          key:
            audit.setting_key,

          value:
            restoreValue,

          actionType:
            "restore",

          changeReason:
            reason,

          meta,
        }
      );


    const policyVersion =
      (
        result.changed &&
        POLICY_SECTIONS
          .has(
            audit.setting_section
          )
      )
        ? await createPolicyVersion(
            connection,
            {
              hotel,

              section:
                audit.setting_section,

              actor,

              changeReason:
                reason,
            }
          )
        : null;


    await connection
      .commit();


    return {
      hotel,

      restoredFromAuditId:
        id,

      ...result,

      policyVersion,
    };
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    throw error;
  } finally {
    connection.release();
  }
}


/* ============================================================
   RESET TO HMS DEFAULT

   Reset is also audited.
============================================================ */

async function resetHotelSetting({
  hotelId,

  dbUser,

  section,

  key,

  changeReason =
    null,

  requestMeta:
    meta = {},
}) {
  const actor =
    buildActorFromDbUser(
      dbUser
    );


  const normalizedSection =
    String(
      section ||
      ""
    ).trim();


  const normalizedKey =
    String(
      key ||
      ""
    ).trim();


  const defaultSetting =
    getDefaultSetting(
      normalizedSection,
      normalizedKey
    );


  if (!defaultSetting) {
    throw serviceError(
      400,
      "UNKNOWN_SETTING",
      "This hotel setting is not supported."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const hotel =
      await getHotelForActor(
        connection,
        hotelId,
        actor,
        true
      );


    await ensureDefaults(
      connection,
      hotel
    );

    await validateGuestRequirementChangesWithConnection(
      connection,
      hotel.hotelId,
      [
        {
          section:
            normalizedSection,

          key:
            normalizedKey,

          value:
            defaultSetting.value,
        },
      ]
    );

    await validateArrivalPolicyChangesWithConnection(
      connection,
      hotel.hotelId,
      [
        {
          section:
            normalizedSection,

          key:
            normalizedKey,

          value:
            defaultSetting.value,
        },
      ]
    );

    const reason =
      optionalText(
        changeReason,
        500
      ) ||
      "Reset to the HMS default setting.";


    const result =
      await applyChange(
        connection,
        {
          hotel,
          actor,

          section:
            normalizedSection,

          key:
            normalizedKey,

          value:
            defaultSetting.value,

          actionType:
            "reset",

          changeReason:
            reason,

          meta,
        }
      );


    const policyVersion =
      (
        result.changed &&
        POLICY_SECTIONS
          .has(
            normalizedSection
          )
      )
        ? await createPolicyVersion(
            connection,
            {
              hotel,

              section:
                normalizedSection,

              actor,

              changeReason:
                reason,
            }
          )
        : null;


    await connection
      .commit();


    return {
      hotel,

      ...result,

      policyVersion,
    };
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    throw error;
  } finally {
    connection.release();
  }
}


/* ============================================================
   BUILD CURRENT POLICY SNAPSHOT

   Later Booking Creation will call this using the SAME
   transaction connection as the booking insert.
============================================================ */

async function buildCurrentPolicySnapshotWithConnection(
  connection,
  hotelId
) {
  const id =
    positiveId(
      hotelId
    );


  if (!id) {
    throw serviceError(
      400,
      "INVALID_HOTEL_ID",
      "A valid hotel ID is required for the policy snapshot."
    );
  }


  const [rows] =
    await connection.query(
      `
        SELECT
          setting_section,
          setting_key,
          setting_value

        FROM hotel_settings

        WHERE hotel_id = ?

        ORDER BY
          setting_section,
          setting_key
      `,
      [
        id,
      ]
    );


  const policySnapshot = {};


  for (
    const row of
      rows
  ) {
    const section =
      row.setting_section;


    if (
      !POLICY_SECTIONS
        .has(section)
    ) {
      continue;
    }


    if (
      !policySnapshot[
        section
      ]
    ) {
      policySnapshot[
        section
      ] = {};
    }


    policySnapshot[
      section
    ][
      row.setting_key
    ] =
      parseJson(
        row.setting_value,
        `${section}.${row.setting_key}`
      );
  }


  const [versionRows] =
    await connection.query(
      `
        SELECT
          pv.policy_version_id,
          pv.policy_group,
          pv.version_no

        FROM hotel_policy_versions pv

        INNER JOIN (
          SELECT
            policy_group,
            MAX(version_no)
              AS max_version

          FROM hotel_policy_versions

          WHERE hotel_id = ?

          GROUP BY
            policy_group
        ) latest

          ON latest.policy_group =
             pv.policy_group

         AND latest.max_version =
             pv.version_no

        WHERE pv.hotel_id = ?
      `,
      [
        id,
        id,
      ]
    );


  const policyVersions = {};


  for (
    const row of
      versionRows
  ) {
    policyVersions[
      row.policy_group
    ] = {
      policyVersionId:
        Number(
          row.policy_version_id
        ),

      versionNo:
        Number(
          row.version_no
        ),
    };
  }


  return {
    policyVersions,
    policySnapshot,
  };
}


/* ============================================================
   SAVE BOOKING POLICY SNAPSHOT

   This will later be connected to booking creation.

   Old booking keeps old policy even when hotel changes Settings.
============================================================ */

async function saveBookingPolicySnapshotWithConnection(
  connection,
  {
    hotelId,
    bookingId,
  }
) {
  const hId =
    positiveId(
      hotelId
    );


  const bId =
    positiveId(
      bookingId
    );


  if (
    !hId ||
    !bId
  ) {
    throw serviceError(
      400,
      "INVALID_BOOKING_POLICY_CONTEXT",
      "A valid hotel and booking are required for the policy snapshot."
    );
  }


  const snapshot =
    await buildCurrentPolicySnapshotWithConnection(
      connection,
      hId
    );


  const [result] =
    await connection.query(
      `
        INSERT INTO booking_policy_snapshots (
          hotel_id,
          booking_id,
          policy_versions,
          policy_snapshot
        )

        VALUES (?, ?, ?, ?)
      `,
      [
        hId,
        bId,

        JSON.stringify(
          snapshot.policyVersions
        ),

        JSON.stringify(
          snapshot.policySnapshot
        ),
      ]
    );


  return {
    snapshotId:
      Number(
        result.insertId
      ),

    ...snapshot,
  };
}

/* ============================================================
   GET BOOKING POLICY SNAPSHOT

   Returns the immutable policy that existed when the booking
   was created.

   Important:
   - Do NOT use current hotel settings for historical repricing.
   - Existing legacy bookings may legitimately have no snapshot.
============================================================ */

async function getBookingPolicySnapshotWithConnection(
  connection,
  {
    hotelId,
    bookingId,
  }
) {
  const hId =
    positiveId(
      hotelId
    );


  const bId =
    positiveId(
      bookingId
    );


  if (
    !hId ||
    !bId
  ) {
    throw serviceError(
      400,
      "INVALID_BOOKING_POLICY_CONTEXT",
      "A valid hotel and booking are required for the policy snapshot."
    );
  }


  const [[row]] =
    await connection.query(
      `
        SELECT
          snapshot_id,
          hotel_id,
          booking_id,
          policy_versions,
          policy_snapshot,
          created_at

        FROM booking_policy_snapshots

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1
      `,
      [
        hId,
        bId,
      ]
    );


  if (!row) {
    return null;
  }


  return {
    snapshotId:
      Number(
        row.snapshot_id
      ),

    hotelId:
      Number(
        row.hotel_id
      ),

    bookingId:
      Number(
        row.booking_id
      ),

    policyVersions:
      parseJson(
        row.policy_versions,
        "booking policy versions"
      ) || {},

    policySnapshot:
      parseJson(
        row.policy_snapshot,
        "booking policy snapshot"
      ) || {},

    createdAt:
      row.created_at,
  };
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  buildActorFromDbUser,

  initializeHotelSettings,

  getHotelSettings,

  updateHotelSettings,

  updateHotelSetting,

  getHotelSettingAuditLogs,

  restoreHotelSetting,

  resetHotelSetting,

  buildCurrentPolicySnapshotWithConnection,

  saveBookingPolicySnapshotWithConnection,

  getBookingPolicySnapshotWithConnection,
};