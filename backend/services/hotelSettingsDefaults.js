/* ============================================================
   HOTEL SETTINGS DEFAULTS

   IMPORTANT DESIGN PRINCIPLE

   HMS does NOT decide hotel business policy.

   HMS provides calculation capabilities.
   Each hotel selects/configures its own rules.

   Examples:
   - Cancellation days/charge
   - Early checkout charge
   - Late checkout charge
   - Room-change pricing
   - Discounts
   - Concessions
   - VIP / complimentary billing
   - Fee waiver
============================================================ */


/* ============================================================
   GENERIC POLICY OPTIONS

   These are calculation CAPABILITIES, not hotel rules.
============================================================ */

const CHARGE_METHODS = [
  "none",
  "fixed_amount",
  "percentage",
  "night_count",
  "actual_nights",
  "full_booking",
  "percentage_of_remaining",
  "manual",
];


const PRICE_METHODS = [
  "original_rate",
  "new_room_rate",
  "lower_of_both",
  "higher_of_both",
  "custom_rate",
  "manual",
];


const EFFECTIVE_FROM_OPTIONS = [
  "immediately",
  "next_billing_night",
  "next_day",
  "custom",
];


const REFUND_HANDLING_OPTIONS = [
  "show_refund_due",
  "manual_process",
  "no_automatic_refund",
];


const VIP_BILLING_MODES = [
  "normal",
  "room_complimentary",
  "stay_complimentary",
  "custom_rate",
  "decide_per_booking",
];


/* ============================================================
   SYSTEM INTEGRITY RULES

   These are NOT editable Hotel Settings.

   They protect data/audit integrity.
============================================================ */

const SYSTEM_INTEGRITY_RULES =
  Object.freeze({

    auditLogsImmutable:
      true,

    hotelIsolationRequired:
      true,

    negativeFinancialAmountBlocked:
      true,

    concessionMustBeBelowPayableAmount:
      true,

    zeroPayableUsesComplimentaryWorkflow:
      true,

    actualCheckInRequiresAdminConfirmation:
      true,

    dayUseOverstayCannotRemainHourlyIndefinitely:
      true,

  });

const {
  DEFAULT_ALLOWED_GUEST_ID_PROOF_TYPES,
} = require(
  "./guestIdProofService"
);


/* ============================================================
   DEFAULT HOTEL SETTINGS

   Defaults are only initial values.

   Hotel Admin / Super Admin may later modify hotel policy.
============================================================ */

const DEFAULT_HOTEL_SETTINGS = {

  /* ==========================================================
     REGIONAL
  ========================================================== */

  regional: {

    timezone: {
      value: "Asia/Kolkata",
      dataType: "string",
    },

    currency: {
      value: "INR",
      dataType: "string",
    },

    date_format: {
      value: "DD-MM-YYYY",
      dataType: "string",
    },

  },


  /* ==========================================================
     BOOKING
  ========================================================== */

  booking: {

    default_booking_status: {
      value: "confirmed",
      dataType: "string",
    },

    minimum_stay_nights: {
      value: 1,
      dataType: "number",
    },

  },


  /* ==========================================================
     CHECK-IN / CHECKOUT TIMES

     Times are hotel-configurable.
  ========================================================== */

  checkin_checkout: {

    /* --------------------------------------------------------
      STANDARD HOTEL TIMES
    -------------------------------------------------------- */

    standard_check_in_time: {
      value: "14:00",
      dataType: "time",
    },

    standard_checkout_time: {
      value: "11:00",
      dataType: "time",
    },


    /* --------------------------------------------------------
      EARLY CHECK-IN

      This applies when an OVERNIGHT booking guest arrives
      before the hotel's standard check-in time.

      It is NOT Day Use.
    -------------------------------------------------------- */

    early_checkin_enabled: {
      value: true,
      dataType: "boolean",
    },

    early_checkin_free_grace_minutes: {
      value: 60,
      dataType: "number",
    },

    early_checkin_charge_rule: {
      /*
      * Supported methods will be validated in the service:
      *
      * none
      * fixed_amount
      * fixed_per_hour
      * percentage_per_hour
      * manual
      */
      value: {
        method: "manual",
        value: 0,

        /*
        * Used mainly for percentage_per_hour.
        * Prevents an early-arrival charge from growing
        * beyond a sensible portion of the night rate.
        */
        maximum_percentage_of_night: 50,
      },

      dataType: "object",
    },


    /* --------------------------------------------------------
      VERY EARLY ARRIVAL

      Example:
      Hotel check-in = 12 PM
      Guest arrives   = 2 AM

      This should not blindly continue normal hourly
      early-check-in calculation.
    -------------------------------------------------------- */

    very_early_arrival_cutoff_time: {
      value: "06:00",
      dataType: "time",
    },

    very_early_arrival_action: {
      /*
      * manual
      * previous_night
      *
      * day_use will be available once Day Use is enabled.
      */
      value: "manual",
      dataType: "string",
    },

  },


  /* ==========================================================
    DAY USE / SHORT STAY

    Same-day short stay is separate from Early Check-In.

    Example:
    08:00 AM → 06:00 PM
    same calendar day

    Hotel can choose:
    - fixed slot prices
    - percentage of nightly room rate
    - hourly rate

    IMPORTANT:
    Once the configured Day Use limit is exceeded,
    HMS transitions toward overnight/full-day pricing.
    It must not continue hourly billing indefinitely.
  ========================================================== */

  day_use: {

    enabled: {
      value: false,
      dataType: "boolean",
    },


    /* --------------------------------------------------------
      PRICING METHOD
    -------------------------------------------------------- */

    pricing_mode: {
      /*
      * fixed_slots
      * percentage_slabs
      * hourly
      */
      value:
        "percentage_slabs",

      dataType:
        "string",
    },


    /* --------------------------------------------------------
      SLOT / SLAB RULES

      Interpretation depends on pricing_mode.

      percentage_slabs example:
      [
        { up_to_hours: 3, value: 40 },
        { up_to_hours: 6, value: 55 },
        { up_to_hours: 9, value: 70 }
      ]

      fixed_slots example:
      [
        { up_to_hours: 3, value: 1200 },
        { up_to_hours: 6, value: 1800 }
      ]
    -------------------------------------------------------- */

    pricing_slabs: {
      value: [
        {
          up_to_hours: 3,
          value: 40,
        },

        {
          up_to_hours: 6,
          value: 55,
        },

        {
          up_to_hours: 9,
          value: 70,
        },
      ],

      dataType:
        "array",
    },


    /* --------------------------------------------------------
      HOURLY MODE

      Used only when pricing_mode = hourly.

      The hotel may choose whether this is:
      - fixed currency amount per hour
      - percentage of night rate per hour
    -------------------------------------------------------- */

    hourly_rate_type: {
      /*
      * fixed_amount
      * percentage_of_night
      */
      value:
        "percentage_of_night",

      dataType:
        "string",
    },

    hourly_rate_value: {
      value: 10,
      dataType: "number",
    },


    /* --------------------------------------------------------
      SAFETY CAP

      Example:
      Night rate = ₹3000

      Hourly calculation reaches ₹3400
      → charge is capped before conversion logic.
    -------------------------------------------------------- */

    maximum_day_use_charge_percent: {
      value: 100,
      dataType: "number",
    },


    /* --------------------------------------------------------
      MAXIMUM SHORT-STAY DURATION

      Beyond this, HMS should recommend/perform transition
      to Overnight Stay according to hotel policy.
    -------------------------------------------------------- */

    maximum_day_use_hours: {
      value: 10,
      dataType: "number",
    },


    /* --------------------------------------------------------
      DAY USE → OVERNIGHT CONVERSION

      adjust_against_night_rate:
        Day-use amount already charged is adjusted against
        the applicable night rate.

      charge_full_night_separately:
        Full night is charged separately.
    -------------------------------------------------------- */

    overnight_conversion_mode: {
      value:
        "adjust_against_night_rate",

      dataType:
        "string",
    },

  },

  /* ==========================================================
     LATE CHECKOUT

     Hotel may create its own time/charge slabs.

     Example rule:
     {
       from_minutes_after_checkout: 30,
       to_minutes_after_checkout: 180,
       charge: {
         method: "percentage",
         value: 50
       }
     }
  ========================================================== */

  late_checkout: {

    enabled: {
      value: true,
      dataType: "boolean",
    },

    grace_minutes: {
      value: 30,
      dataType: "number",
    },

    calculation_mode: {
      value: "manual",
      dataType: "string",
    },

    rules: {
      value: [],
      dataType: "array",
    },

    require_reason: {
      value: true,
      dataType: "boolean",
    },

  },


  /* ==========================================================
     CANCELLATION

     NO fixed 48/24 hour rule.

     Hotel creates its own rule slabs.

     Example:

     [
       {
         from_hours_before: 168,
         to_hours_before: null,
         charge: {
           method: "none",
           value: 0
         }
       },

       {
         from_hours_before: 24,
         to_hours_before: 168,
         charge: {
           method: "percentage",
           value: 25
         }
       }
     ]
  ========================================================== */

  cancellation: {

    enabled: {
      value: true,
      dataType: "boolean",
    },

    calculation_mode: {
      /*
       * manual
       * rules
       */
      value: "manual",
      dataType: "string",
    },

    rules: {
      value: [],
      dataType: "array",
    },

    same_day_rule: {
      value: {
        method: "manual",
        value: 0,
      },
      dataType: "object",
    },

    hotel_cancellation_rule: {
      value: {
        method: "none",
        value: 0,
      },
      dataType: "object",
    },

    require_reason: {
      value: true,
      dataType: "boolean",
    },

  },


  /* ==========================================================
     NO SHOW
  ========================================================== */

  no_show: {

    enabled: {
      value: true,
      dataType: "boolean",
    },

    mark_after_hours: {
      value: 6,
      dataType: "number",
    },

    calculation_mode: {
      value: "manual",
      dataType: "string",
    },

    charge_rule: {
      value: {
        method: "manual",
        value: 0,
      },
      dataType: "object",
    },

  },


  /* ==========================================================
     EARLY CHECKOUT

     Hotel decides calculation.

     Possible methods:
     - actual occupied nights
     - fixed amount
     - percentage
     - percentage remaining
     - full reserved stay
     - manual
  ========================================================== */

  early_checkout: {

    enabled: {
      value: true,
      dataType: "boolean",
    },

    calculation_mode: {
      value: "manual",
      dataType: "string",
    },

    minimum_billable_nights: {
      value: 1,
      dataType: "number",
    },

    charge_rule: {
      value: {
        method: "manual",
        value: 0,
      },
      dataType: "object",
    },

    same_day_rule: {
      value: {
        method: "manual",
        value: 0,
      },
      dataType: "object",
    },

    refund_handling: {
      value: "show_refund_due",
      dataType: "string",
    },

    require_reason: {
      value: true,
      dataType: "boolean",
    },

  },


  /* ==========================================================
     ROOM CHANGE

     Supports:

     HOTEL FAULT
     - temporary
     - permanent

     GUEST REQUEST
     - temporary
     - permanent

     Pricing is configurable.

     HMS does not force original/new/lower rate.
  ========================================================== */

  room_change: {

    enabled: {
      value: true,
      dataType: "boolean",
    },

    allow_temporary_change: {
      value: true,
      dataType: "boolean",
    },

    allow_permanent_change: {
      value: true,
      dataType: "boolean",
    },


    /* --------------------------------------------------------
       HOTEL FAULT
    -------------------------------------------------------- */

    hotel_fault_upgrade_pricing: {
      value: {
        pricing_method:
          "manual",

        custom_rate:
          null,
      },
      dataType: "object",
    },

    hotel_fault_downgrade_pricing: {
      value: {
        pricing_method:
          "manual",

        custom_rate:
          null,
      },
      dataType: "object",
    },

    hotel_fault_same_rate_pricing: {
      value: {
        pricing_method:
          "original_rate",

        custom_rate:
          null,
      },
      dataType: "object",
    },


    /* --------------------------------------------------------
       TEMPORARY ROOM CHANGE

       Original room may later become available again.
    -------------------------------------------------------- */

    when_original_room_ready: {
      /*
       * ask_guest
       * return_original
       * stay_replacement
       * admin_decides
       */
      value: "ask_guest",
      dataType: "string",
    },

    if_guest_stays_in_replacement_room: {
      value: {
        pricing_method:
          "new_room_rate",

        effective_from:
          "next_billing_night",

        custom_rate:
          null,
      },
      dataType: "object",
    },


    /* --------------------------------------------------------
       GUEST REQUEST
    -------------------------------------------------------- */

    guest_request_upgrade_pricing: {
      value: {
        pricing_method:
          "manual",

        effective_from:
          "next_billing_night",

        custom_rate:
          null,
      },
      dataType: "object",
    },

    guest_request_downgrade_pricing: {
      value: {
        pricing_method:
          "manual",

        effective_from:
          "next_billing_night",

        custom_rate:
          null,
      },
      dataType: "object",
    },

    require_reason: {
      value: true,
      dataType: "boolean",
    },

  },


  /* ==========================================================
     PAYMENT
  ========================================================== */

  payment: {

    allow_partial_payment: {
      value: true,
      dataType: "boolean",
    },

    advance_requirement: {
      value: {
        method: "none",
        value: 0,
      },
      dataType: "object",
    },

    full_payment_required_before_checkout: {
      value: true,
      dataType: "boolean",
    },

    allowed_methods: {
      value: [
        "cash",
        "upi",
        "card",
        "bank_transfer",
      ],
      dataType: "array",
    },

  },


  /* ==========================================================
     DISCOUNT

     Commercial price reduction.

     NOT automatically applied to every booking.

     Admin selects/applies it when required.
  ========================================================== */

  discount: {

    enabled: {
      value: true,
      dataType: "boolean",
    },

    allowed_methods: {
      value: [
        "percentage",
        "fixed_amount",
      ],
      dataType: "array",
    },

    default_method: {
      value: "percentage",
      dataType: "string",
    },

    default_value: {
      value: 0,
      dataType: "number",
    },

    allow_multiple_discounts: {
      value: false,
      dataType: "boolean",
    },

    allow_with_concession: {
      value: true,
      dataType: "boolean",
    },

    require_reason: {
      value: true,
      dataType: "boolean",
    },

    presets: {
      /*
       * Hotel may create:
       *
       * [
       *   {
       *     name: "Corporate",
       *     method: "percentage",
       *     value: 10
       *   }
       * ]
       */
      value: [],
      dataType: "array",
    },

  },


  /* ==========================================================
     CONCESSION

     Guest-specific goodwill reduction.

     IMPORTANT:
     - NOT automatic.
     - Can be decided during checkout.
     - Setting may provide suggested value.
     - Admin may override suggested value.
     - Must remain BELOW payable amount.
     - Full ₹0 stay uses VIP/Complimentary workflow.
  ========================================================== */

  concession: {

    enabled: {
      value: true,
      dataType: "boolean",
    },

    mode: {
      /*
       * manual_at_checkout
       * suggested_fixed
       * suggested_percentage
       */
      value:
        "manual_at_checkout",

      dataType:
        "string",
    },

    suggested_method: {
      value:
        "fixed_amount",

      dataType:
        "string",
    },

    suggested_value: {
      value: 0,
      dataType: "number",
    },

    allow_override_at_checkout: {
      value: true,
      dataType: "boolean",
    },

    require_reason: {
      value: true,
      dataType: "boolean",
    },

  },


  /* ==========================================================
     VIP / COMPLIMENTARY

     VIP is NOT treated as 100% concession.

     Hotel decides billing per VIP booking.
  ========================================================== */

  vip: {

    enabled: {
      value: true,
      dataType: "boolean",
    },

    default_billing_mode: {
      value:
        "decide_per_booking",

      dataType:
        "string",
    },

    allowed_billing_modes: {
      value:
        VIP_BILLING_MODES,

      dataType:
        "array",
    },

    complimentary_room_includes_extras: {
      value: false,
      dataType: "boolean",
    },

    complimentary_stay_includes_extras: {
      value: true,
      dataType: "boolean",
    },

    require_reason_for_complimentary: {
      value: true,
      dataType: "boolean",
    },

  },


  /* ==========================================================
     FEE WAIVER

     Separate from concession.

     Example:
     Cancellation charge = ₹2,500
     Fee waiver           = ₹2,500
     Final fee            = ₹0

     Calculated charge remains in audit/history.
  ========================================================== */

  fee_waiver: {

    enabled: {
      value: true,
      dataType: "boolean",
    },

    allowed_fee_types: {
      value: [
        "cancellation",
        "no_show",
        "early_checkout",
        "late_checkout",
        "other",
      ],
      dataType: "array",
    },

    allow_full_waiver: {
      value: true,
      dataType: "boolean",
    },

    allow_partial_waiver: {
      value: true,
      dataType: "boolean",
    },

    require_reason: {
      value: true,
      dataType: "boolean",
    },

  },


  /* ==========================================================
     REFUND

     No approval workflow.

     Front desk may process according to hotel policy.
     Every refund remains audited.
  ========================================================== */

  refund: {

    enabled: {
      value: true,
      dataType: "boolean",
    },

    handling_mode: {
      /*
       * manual_process
       * calculate_and_show
       */
      value:
        "calculate_and_show",

      dataType:
        "string",
    },

    allowed_methods: {
      value: [
        "original_method",
        "cash",
        "bank_transfer",
      ],
      dataType: "array",
    },

    require_reason: {
      value: true,
      dataType: "boolean",
    },

  },


  /* ==========================================================
     TAX / CHARGES

     Configuration must follow applicable tax law.
  ========================================================== */

  tax: {

    gst_enabled: {
      value: false,
      dataType: "boolean",
    },

    gst_percent: {
      value: 0,
      dataType: "number",
    },

    service_charge_enabled: {
      value: false,
      dataType: "boolean",
    },

    service_charge_percent: {
      value: 0,
      dataType: "number",
    },

  },


  /* ==========================================================
     HOUSEKEEPING
  ========================================================== */

  housekeeping: {

    cleaning_required_after_checkout: {
      value: true,
      dataType: "boolean",
    },

    checkout_room_status: {
      value: "cleaning",
      dataType: "string",
    },

    auto_available_after_checkout: {
      value: false,
      dataType: "boolean",
    },

  },


  /* ==========================================================
     GUEST REQUIREMENTS
  ========================================================== */

  guest_requirements: {

    /*
    * Primary booking customer.
    */
    phone_required: {
      value: true,
      dataType: "boolean",
    },

    email_required: {
      value: false,
      dataType: "boolean",
    },

    /*
    * Existing key retained intentionally.
    * This represents ID proof requirement
    * for the primary booking guest.
    */
    id_proof_required: {
      value: false,
      dataType: "boolean",
    },

    /*
    * ID proof types accepted by this hotel.
    *
    * This setting is included in the booking policy snapshot,
    * so existing bookings retain the list that applied when
    * they were created.
    */
    allowed_id_proof_types: {
      value: [
        ...DEFAULT_ALLOWED_GUEST_ID_PROOF_TYPES,
      ],
      dataType: "array",
    },

    /* --------------------------------------------------------
      STAYING GUEST DETAILS
    -------------------------------------------------------- */

    all_guest_names_required: {
      value: true,
      dataType: "boolean",
    },

    other_adult_id_required: {
      value: false,
      dataType: "boolean",
    },

    child_age_required: {
      value: true,
      dataType: "boolean",
    },

    child_id_required: {
      value: false,
      dataType: "boolean",
    },


    /* --------------------------------------------------------
      AGE CLASSIFICATION

      This is only the initial hotel default.
      Hotel may change it from Settings.
    -------------------------------------------------------- */

    adult_age_from: {
      value: 18,
      dataType: "number",
    },

    /* --------------------------------------------------------
      CHILD AGE / PRICING RULES

      Optional hotel-configured rules.

      If no rules are configured:
      - Guest below adult_age_from is treated as a child.
      - No automatic child surcharge is added.
      - Extra-bed charge applies only when an extra bed is used.

      Example hotel rule:
      {
        label: "Child 6-12",
        min_age: 6,
        max_age: 12,
        charge: {
          method: "percentage",
          value: 25
        },
        bed_policy: "extra_bed_optional"
      }
    -------------------------------------------------------- */

    child_age_rules: {
      value: [],
      dataType: "array",
    },

    /* --------------------------------------------------------
      EXTRA BED POLICY

      Actual room support/capacity enforcement
      will later be connected to booking workflow.
    -------------------------------------------------------- */

    extra_bed_enabled: {
      value: false,
      dataType: "boolean",
    },

    adult_extra_bed_charge_per_night: {
      value: 0,
      dataType: "number",
    },

    child_extra_bed_charge_per_night: {
      value: 0,
      dataType: "number",
    },

  },


  /* ==========================================================
     INVOICE
  ========================================================== */

  invoice: {

    invoice_prefix: {
      value: "INV-",
      dataType: "string",
    },

    show_hotel_logo: {
      value: true,
      dataType: "boolean",
    },

    show_tax_details: {
      value: true,
      dataType: "boolean",
    },

    show_payment_history: {
      value: true,
      dataType: "boolean",
    },

    show_discounts: {
      value: true,
      dataType: "boolean",
    },

    show_concessions: {
      value: true,
      dataType: "boolean",
    },

    show_fee_waivers: {
      value: true,
      dataType: "boolean",
    },

  },


  /* ==========================================================
     AUDIT

     Audit itself can NOT be disabled.

     Only reason requirements are configurable.
  ========================================================== */

  audit: {

    require_reason_for_policy_change: {
      value: true,
      dataType: "boolean",
    },

    require_reason_for_financial_action: {
      value: true,
      dataType: "boolean",
    },

    require_reason_for_room_change: {
      value: true,
      dataType: "boolean",
    },

  },

};


/* ============================================================
   POLICY SECTIONS

   Changes here create new policy versions.

   Old bookings retain their policy snapshot.
============================================================ */

const POLICY_SECTIONS =
  new Set([
    "booking",
    "checkin_checkout",
    "day_use",
    "late_checkout",
    "cancellation",
    "no_show",
    "early_checkout",
    "room_change",
    "payment",
    "discount",
    "concession",
    "vip",
    "fee_waiver",
    "refund",
    "tax",
    "housekeeping",
    "guest_requirements",
  ]);


/* ============================================================
   SENSITIVE SECTIONS

   Changes must be clearly audited.
============================================================ */

const SENSITIVE_SETTING_SECTIONS =
  new Set([
    "cancellation",
    "no_show",
    "early_checkout",
    "late_checkout",
    "room_change",
    "payment",
    "discount",
    "concession",
    "vip",
    "fee_waiver",
    "refund",
    "tax",
  ]);


/* ============================================================
   DEEP CLONE
============================================================ */

function deepClone(
  value
) {
  return JSON.parse(
    JSON.stringify(
      value
    )
  );
}


/* ============================================================
   GET ALL DEFAULTS
============================================================ */

function getDefaultHotelSettings() {
  return deepClone(
    DEFAULT_HOTEL_SETTINGS
  );
}


/* ============================================================
   GET ONE DEFAULT SETTING
============================================================ */

function getDefaultSetting(
  section,
  key
) {
  const setting =
    DEFAULT_HOTEL_SETTINGS
      ?.[section]
      ?.[key];


  if (!setting) {
    return null;
  }


  return deepClone(
    setting
  );
}


/* ============================================================
   FLATTEN SETTINGS

   Database stores one setting per row.
============================================================ */

function flattenHotelSettings(
  settings =
    DEFAULT_HOTEL_SETTINGS
) {
  const rows = [];


  for (
    const [
      section,
      sectionSettings,
    ] of Object.entries(
      settings
    )
  ) {

    for (
      const [
        key,
        definition,
      ] of Object.entries(
        sectionSettings
      )
    ) {

      rows.push({
        section,
        key,

        value:
          deepClone(
            definition.value
          ),

        dataType:
          definition.dataType,

        isPolicy:
          POLICY_SECTIONS.has(
            section
          ),

        sensitive:
          SENSITIVE_SETTING_SECTIONS.has(
            section
          ),
      });

    }

  }


  return rows;
}


/* ============================================================
   DEFAULT POLICY SNAPSHOT
============================================================ */

function buildDefaultPolicySnapshot() {
  const snapshot = {};


  for (
    const section of
      POLICY_SECTIONS
  ) {

    const sectionSettings =
      DEFAULT_HOTEL_SETTINGS[
        section
      ];


    if (
      !sectionSettings
    ) {
      continue;
    }


    snapshot[
      section
    ] = {};


    for (
      const [
        key,
        definition,
      ] of Object.entries(
        sectionSettings
      )
    ) {

      snapshot[
        section
      ][key] =
        deepClone(
          definition.value
        );

    }

  }


  return snapshot;
}


/* ============================================================
   SERIALIZE VALUE
============================================================ */

function serializeSettingValue(
  value
) {
  return JSON.stringify(
    value
  );
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  CHARGE_METHODS,
  PRICE_METHODS,
  EFFECTIVE_FROM_OPTIONS,
  REFUND_HANDLING_OPTIONS,
  VIP_BILLING_MODES,

  SYSTEM_INTEGRITY_RULES,

  DEFAULT_HOTEL_SETTINGS,

  POLICY_SECTIONS,

  SENSITIVE_SETTING_SECTIONS,

  getDefaultHotelSettings,

  getDefaultSetting,

  flattenHotelSettings,

  buildDefaultPolicySnapshot,

  serializeSettingValue,
};