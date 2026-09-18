import React, { useCallback, useEffect, useMemo, useState } from "react";
import hotelSettingsService, {
  HOTEL_SETTINGS_SCOPE,
} from "../../services/hotelSettingsService";

import Control from "./components/SettingsControls";
import {
  chargeLabel,
  equal,
  humanize,
  priceLabel,
} from "./settingsShared";
import "./Settings.css";


const GROUPS = [
  [
    "General",
    [
      "regional",
      "booking",
      "checkin_checkout",
      "day_use",
    ],
  ],

  [
    "Stay Policies",
    [
      "cancellation",
      "no_show",
      "early_checkout",
      "late_checkout",
      "room_change",
    ],
  ],

  [
    "Finance",
    [
      "payment",
      "discount",
      "concession",
      "vip",
      "fee_waiver",
      "refund",
      "tax",
    ],
  ],

  [
    "Operations",
    [
      "housekeeping",
      "guest_requirements",
      "invoice",
    ],
  ],

  [
    "Governance",
    [
      "audit",
      "audit_history",
    ],
  ],
];

const getGroupForSection = (
  section
) => {
  const match =
    GROUPS.find(
      ([
        ,
        sections,
      ]) =>
        sections.includes(
          section
        )
    );


  return (
    match?.[0] ||
    "General"
  );
};


const SECTION_LABELS = {
  regional: "Regional",
  booking: "Booking Rules",
  checkin_checkout: "Check-In & Checkout",
  day_use: "Day Use & Short Stay",

  cancellation: "Cancellation",
  no_show: "No Show",
  early_checkout: "Early Checkout",
  late_checkout: "Late Checkout",
  room_change: "Room Change",

  payment: "Payments",
  discount: "Discounts",
  concession: "Concessions",
  vip: "VIP & Complimentary",
  fee_waiver: "Fee Waiver",
  refund: "Refunds",
  tax: "Taxes & Charges",

  housekeeping: "Housekeeping",
  guest_requirements: "Guest & Occupancy",
  invoice: "Invoice",

  audit: "Audit Rules",
  audit_history: "Activity History",
};


const SECTION_HELP = {
  regional:
    "Choose the hotel timezone, currency and date format used by operational screens.",

  booking:
    "Set the basic rules used when a new reservation is created.",

  checkin_checkout:
    "Set standard hotel timings and define how early arrivals are handled. Actual guest check-in is always confirmed by the Admin.",

  day_use:
    "Configure same-day short stays. HMS calculates the price automatically and switches to overnight pricing when the Day Use limit is exceeded.",

  cancellation:
    "Create hotel-specific cancellation slabs. The HMS does not force fixed 24-hour or 48-hour rules.",

  no_show:
    "Choose when a guest can be marked as no-show and how the charge is handled.",

  early_checkout:
    "Decide how the hotel settles a stay when the guest leaves early.",

  late_checkout:
    "Set grace time and optional charge slabs after the standard checkout time.",

  room_change:
    "Control temporary/permanent room changes for hotel faults and guest requests.",

  payment:
    "Set advance, partial-payment and allowed payment-method rules.",

  discount:
    "Configure commercial discounts. They apply only when an Admin chooses them.",

  concession:
    "Configure guest-specific goodwill concessions. They are never automatic on every bill.",

  vip:
    "Choose how VIP or complimentary stays are billed without treating them as a 100% concession.",

  fee_waiver:
    "Allow full or partial fee waiver while preserving the original calculated fee in history.",

  refund:
    "Choose how refunds are shown and which refund methods the hotel accepts.",

  tax:
    "Configure tax/service-charge values according to applicable requirements.",

  housekeeping:
    "Define the room status workflow after checkout.",

  guest_requirements:
    "Configure primary guest details, accompanying guests, child information and extra-bed rules.",

  invoice:
    "Control invoice prefix and display preferences.",

  audit:
    "Choose where a change reason is required. Audit history itself remains immutable.",

  audit_history:
    "See who changed a setting, what changed, when it changed and restore a previous value.",
};


const LABELS = {
  timezone: "Timezone",
  currency: "Currency",
  date_format: "Date Format",

  default_booking_status: "Default Booking Status",
  minimum_stay_nights: "Minimum Stay Nights",

  standard_check_in_time: "Standard Check-In Time",
  standard_checkout_time: "Standard Checkout Time",
  early_checkin_enabled: "Allow Early Check-In",

  enabled: "Policy Enabled",
  calculation_mode:
    "How Charges Are Calculated",
  rules: "Rules",

  same_day_rule: "Same-Day Checkout Rule",
  hotel_cancellation_rule: "Hotel Cancellation Rule",
  require_reason: "Require A Reason",

  mark_after_hours: "Mark As No-Show After Hours",
  charge_rule: "Charge If Applicable",

  minimum_billable_nights: "Minimum Nights To Charge",
  refund_handling: "If Refund Is Due",

  grace_minutes: "Grace Time (Minutes)",

  allow_temporary_change: "Allow Temporary Room Change",
  allow_permanent_change: "Allow Permanent Room Change",

  hotel_fault_upgrade_pricing:
    "Hotel-Fault Upgrade Pricing",

  hotel_fault_downgrade_pricing:
    "Hotel-Fault Downgrade Pricing",

  hotel_fault_same_rate_pricing:
    "Hotel-Fault Same-Rate Pricing",

  when_original_room_ready:
    "When Original Room Is Ready",

  if_guest_stays_in_replacement_room:
    "If Guest Stays In Replacement Room",

  guest_request_upgrade_pricing:
    "Guest-Requested Upgrade Pricing",

  guest_request_downgrade_pricing:
    "Guest-Requested Downgrade Pricing",

  allow_partial_payment: "Allow Partial Payment",

  advance_requirement:
    "Advance Payment Requirement",

  full_payment_required_before_checkout:
    "Require Full Payment Before Checkout",

  allowed_methods:
    "Allowed Methods",

  default_method:
    "Default Discount Method",

  default_value:
    "Default Discount Value",

  allow_multiple_discounts:
    "Allow Multiple Discounts",

  allow_with_concession:
    "Allow Discount With Concession",

  presets:
    "Discount Presets",

  mode:
    "Concession Mode",

  suggested_method:
    "Suggested Concession Method",

  suggested_value:
    "Suggested Concession Value",

  allow_override_at_checkout:
    "Allow Checkout Override",

  default_billing_mode:
    "Default VIP Billing Mode",

  allowed_billing_modes:
    "Allowed VIP Billing Modes",

  complimentary_room_includes_extras:
    "Complimentary Room Includes Extras",

  complimentary_stay_includes_extras:
    "Complimentary Stay Includes Extras",

  require_reason_for_complimentary:
    "Reason Required For Complimentary Stay",

  allowed_fee_types:
    "Waivable Fee Types",

  allow_full_waiver:
    "Allow Full Waiver",

  allow_partial_waiver:
    "Allow Partial Waiver",

  handling_mode:
    "Refund Handling Mode",

  gst_enabled:
    "GST Enabled",

  gst_percent:
    "GST Percentage",

  service_charge_enabled:
    "Service Charge Enabled",

  service_charge_percent:
    "Service Charge Percentage",

  cleaning_required_after_checkout:
    "Cleaning Required After Checkout",

  checkout_room_status:
    "Room Status After Checkout",

  auto_available_after_checkout:
    "Automatically Make Room Available After Checkout",

  phone_required:
    "Phone Required",

  email_required:
    "Email Required",

  id_proof_required:
    "ID Proof Required",

  invoice_prefix:
    "Invoice Prefix",

  show_hotel_logo:
    "Show Hotel Logo",

  show_tax_details:
    "Show Tax Details",

  show_payment_history:
    "Show Payment History",

  show_discounts:
    "Show Discounts",

  show_concessions:
    "Show Concessions",

  show_fee_waivers:
    "Show Fee Waivers",

  require_reason_for_policy_change:
    "Reason Required For Policy Changes",

  require_reason_for_financial_action:
    "Reason Required For Financial Actions",

  require_reason_for_room_change:
    "Reason Required For Room Changes",
};

const SECTION_FIELD_LABELS = {

  checkin_checkout: {
    standard_check_in_time:
      "Standard Check-In Time",

    standard_checkout_time:
      "Standard Checkout Time",

    early_checkin_enabled:
      "Allow Early Check-In",

    early_checkin_free_grace_minutes:
      "Free Early Check-In Grace (Minutes)",

    early_checkin_charge_rule:
      "Early Check-In Charge",

    very_early_arrival_cutoff_time:
      "Very Early Arrival Before",

    very_early_arrival_action:
      "Very Early Arrival Treatment",
  },

  day_use: {
    enabled:
      "Allow Day Use / Short Stay",

    pricing_mode:
      "How Day Use Is Priced",

    pricing_slabs:
      "Day Use Pricing Slabs",

    hourly_rate_type:
      "Hourly Rate Type",

    hourly_rate_value:
      "Hourly Rate",

    maximum_day_use_charge_percent:
      "Maximum Day Use Charge (% Of Room Rate)",

    maximum_day_use_hours:
      "Maximum Day Use Duration (Hours)",

    overnight_conversion_mode:
      "When Day Use Becomes Overnight",
  },

  cancellation: {
    enabled:
      "Allow Booking Cancellation",

    calculation_mode:
      "How Cancellation Charges Are Calculated",

    rules:
      "Cancellation Charge Rules",

    same_day_rule:
      "If Cancelled On Check-In Day",

    hotel_cancellation_rule:
      "If Hotel Cancels The Booking",

    require_reason:
      "Require Cancellation Reason",
  },


  no_show: {
    enabled:
      "Enable No-Show Handling",

    calculation_mode:
      "How No-Show Charges Are Calculated",

    mark_after_hours:
      "Mark Guest As No-Show After",

    charge_rule:
      "No-Show Charge",

    require_reason:
      "Require No-Show Reason",
  },


  early_checkout: {
    enabled:
      "Allow Early Checkout",

    calculation_mode:
      "How Early Checkout Charges Are Calculated",

    minimum_billable_nights:
      "Minimum Nights To Charge",

    charge_rule:
      "Early Checkout Charge",

    same_day_rule:
      "If Guest Leaves On Check-In Day",

    refund_handling:
      "If A Refund Is Due",

    require_reason:
      "Require Early Checkout Reason",
  },


  late_checkout: {
    enabled:
      "Allow Late Checkout",

    grace_minutes:
      "Free Grace Period (Minutes)",

    calculation_mode:
      "How Late Checkout Charges Are Calculated",

    rules:
      "Late Checkout Charge Rules",

    require_reason:
      "Require Late Checkout Reason",
  },


  payment: {
    advance_requirement:
      "Advance Payment",

    allow_partial_payment:
      "Allow Partial Payment",

    full_payment_required_before_checkout:
      "Require Full Payment Before Checkout",

    allowed_methods:
      "Accepted Payment Methods",
  },


  room_change: {
    allow_temporary_change:
      "Allow Temporary Room Change",

    allow_permanent_change:
      "Allow Permanent Room Change",

    hotel_fault_upgrade_pricing:
      "If Hotel Gives An Upgrade",

    hotel_fault_downgrade_pricing:
      "If Hotel Gives A Downgrade",

    hotel_fault_same_rate_pricing:
      "If Replacement Room Has Same Rate",

    when_original_room_ready:
      "When Original Room Becomes Available",

    if_guest_stays_in_replacement_room:
      "If Guest Keeps Replacement Room",

    guest_request_upgrade_pricing:
      "Guest-Requested Upgrade",

    guest_request_downgrade_pricing:
      "Guest-Requested Downgrade",
  },

  guest_requirements: {
    phone_required:
      "Primary Guest Phone Required",

    email_required:
      "Primary Guest Email Required",

    id_proof_required:
      "Primary Guest ID Proof Required",

    allowed_id_proof_types:
      "Allowed Guest ID Proof Types",

    all_guest_names_required:
      "Record Names Of All Staying Guests",

    other_adult_id_required:
      "ID Proof Required For Other Adults",

    child_age_required:
      "Record Age For Children",

    child_id_required:
      "ID Proof Required For Children",

    adult_age_from:
      "Treat Guest As Adult From Age",

    child_age_rules:
      "Child Age & Pricing Rules",

    extra_bed_enabled:
      "Allow Extra Beds",

    adult_extra_bed_charge_per_night:
      "Adult Extra Bed Charge Per Night",

    child_extra_bed_charge_per_night:
      "Child Extra Bed Charge Per Night",
  },

};


const SECTION_FIELD_ORDER = {

  checkin_checkout: [
    "standard_check_in_time",
    "standard_checkout_time",

    "early_checkin_enabled",
    "early_checkin_free_grace_minutes",
    "early_checkin_charge_rule",

    "very_early_arrival_cutoff_time",
    "very_early_arrival_action",
  ],

  day_use: [
    "enabled",

    "pricing_mode",

    "pricing_slabs",

    "hourly_rate_type",
    "hourly_rate_value",

    "maximum_day_use_hours",
    "maximum_day_use_charge_percent",

    "overnight_conversion_mode",
  ],

  cancellation: [
    "enabled",
    "calculation_mode",
    "rules",
    "same_day_rule",
    "hotel_cancellation_rule",
    "require_reason",
  ],

  no_show: [
    "enabled",
    "mark_after_hours",
    "calculation_mode",
    "charge_rule",
    "require_reason",
  ],

  early_checkout: [
    "enabled",
    "calculation_mode",
    "minimum_billable_nights",
    "charge_rule",
    "same_day_rule",
    "refund_handling",
    "require_reason",
  ],

  late_checkout: [
    "enabled",
    "grace_minutes",
    "calculation_mode",
    "rules",
    "require_reason",
  ],

  payment: [
    "advance_requirement",
    "allow_partial_payment",
    "full_payment_required_before_checkout",
    "allowed_methods",
  ],

  room_change: [
    "allow_temporary_change",
    "allow_permanent_change",
    "hotel_fault_upgrade_pricing",
    "hotel_fault_downgrade_pricing",
    "hotel_fault_same_rate_pricing",
    "when_original_room_ready",
    "if_guest_stays_in_replacement_room",
    "guest_request_upgrade_pricing",
    "guest_request_downgrade_pricing",
  ],

  guest_requirements: [
    "phone_required",
    "email_required",
    "id_proof_required",
    "allowed_id_proof_types",

    "all_guest_names_required",
    "other_adult_id_required",
    "child_age_required",
    "child_id_required",

    "adult_age_from",

    "extra_bed_enabled",
    "adult_extra_bed_charge_per_night",
    "child_extra_bed_charge_per_night",

    "child_age_rules",
  ],
};


const POLICY_TOGGLE_SECTIONS =
  new Set([
    "cancellation",
    "no_show",
    "early_checkout",
    "late_checkout",
  ]);

const SENSITIVE =
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

















const label = (key) =>
  LABELS[key] ||
  humanize(key);

const settingLabel = (
  section,
  key
) =>
  SECTION_FIELD_LABELS[
    section
  ]?.[key] ||
  label(key);


function orderedSettingKeys(
  section,
  values
) {
  const keys =
    Object.keys(
      values || {}
    );


  const preferred =
    SECTION_FIELD_ORDER[
      section
    ] || [];


  return [
    ...preferred.filter(
      (key) =>
        keys.includes(
          key
        )
    ),

    ...keys.filter(
      (key) =>
        !preferred.includes(
          key
        )
    ),
  ];
}


function shouldShowSetting(
  section,
  key,
  values
) {
  const currentValues =
    values || {};


  /*
   * If the complete policy is disabled,
   * only its main enable/disable switch
   * needs to remain visible.
   */
  if (
    POLICY_TOGGLE_SECTIONS.has(
      section
    ) &&
    currentValues.enabled ===
      false &&
    key !== "enabled"
  ) {
    return false;
  }


  /*
   * Automatic rule builders are useful
   * only when the hotel chooses rule-based
   * calculation.
   */
  if (
    section ===
      "cancellation" &&
    key === "rules" &&
    currentValues
      .calculation_mode !==
      "rules"
  ) {
    return false;
  }


  if (
    section ===
      "no_show" &&
    key ===
      "charge_rule" &&
    currentValues
      .calculation_mode !==
      "rules"
  ) {
    return false;
  }


  if (
    section ===
      "early_checkout" &&
    [
      "minimum_billable_nights",
      "charge_rule",
    ].includes(
      key
    ) &&
    currentValues
      .calculation_mode !==
      "rules"
  ) {
    return false;
  }


  if (
    section ===
      "late_checkout" &&
    key === "rules" &&
    currentValues
      .calculation_mode !==
      "rules"
  ) {
    return false;
  }

  if (
    section ===
      "guest_requirements" &&
    key ===
      "child_age_rules" &&
    currentValues
      .child_age_required !==
      true
  ) {
    return false;
  }

  if (
    section ===
      "guest_requirements" &&
    [
      "adult_extra_bed_charge_per_night",
      "child_extra_bed_charge_per_night",
    ].includes(
      key
    ) &&
    currentValues
      .extra_bed_enabled !==
      true
  ) {
    return false;
  }

  if (
    section ===
      "checkin_checkout" &&
    [
      "early_checkin_free_grace_minutes",
      "early_checkin_charge_rule",
      "very_early_arrival_cutoff_time",
      "very_early_arrival_action",
    ].includes(
      key
    ) &&
    currentValues
      .early_checkin_enabled !==
      true
  ) {
    return false;
  }

  if (
    section ===
      "day_use" &&
    currentValues.enabled !==
      true &&
    key !== "enabled"
  ) {
    return false;
  }


  if (
    section ===
      "day_use" &&
    key ===
      "pricing_slabs" &&
    ![
      "fixed_slots",
      "percentage_slabs",
    ].includes(
      currentValues
        .pricing_mode
    )
  ) {
    return false;
  }


  if (
    section ===
      "day_use" &&
    [
      "hourly_rate_type",
      "hourly_rate_value",
      "maximum_day_use_charge_percent",
    ].includes(
      key
    ) &&
    currentValues
      .pricing_mode !==
      "hourly"
  ) {
    return false;
  }

  if (
    section ===
      "day_use" &&
    key ===
      "maximum_day_use_hours" &&
    [
      "fixed_slots",
      "percentage_slabs",
    ].includes(
      currentValues
        .pricing_mode
    )
  ) {
    return false;
  }

  return true;
}

const clone = (value) =>
  JSON.parse(
    JSON.stringify(value)
  );




















function summary(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  if (
    typeof value ===
    "boolean"
  ) {
    return value
      ? "Yes"
      : "No";
  }

  if (
    [
      "string",
      "number",
    ].includes(
      typeof value
    )
  ) {
    return String(value);
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value.length
      ? value
          .map(summary)
          .join(", ")
      : "None";
  }

  if (value.method) {
    if (
      [
        "none",
        "manual",
        "full_booking",
        "actual_nights",
      ].includes(
        value.method
      )
    ) {
      return chargeLabel(
        value.method
      );
    }

    return `${chargeLabel(
      value.method
    )}: ${value.value ?? 0}`;
  }

  if (
    value.pricing_method
  ) {
    return priceLabel(
      value.pricing_method
    );
  }

  return "Policy value changed";
}





































function Settings({
  scope =
    HOTEL_SETTINGS_SCOPE.ADMIN,

  hotelDisplayId =
    null,
}) {
  const context =
    useMemo(
      () => ({
        scope,
        hotelDisplayId,
      }),
      [
        scope,
        hotelDisplayId,
      ]
    );


  const [
    active,
    setActive,
  ] =
    useState(
      "regional"
    );

  const [
    openGroup,
    setOpenGroup,
  ] =
    useState(
      "General"
    );

  const [
    hotel,
    setHotel,
  ] =
    useState(null);


  const [
    settings,
    setSettings,
  ] =
    useState({});


  const [
    original,
    setOriginal,
  ] =
    useState({});


  const [
    metadata,
    setMetadata,
  ] =
    useState({});


  const [
    policyVersions,
    setPolicyVersions,
  ] =
    useState({});


  const [
    capabilities,
    setCapabilities,
  ] =
    useState({});


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    saving,
    setSaving,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState("");


  const [
    success,
    setSuccess,
  ] =
    useState("");


  const [
    reason,
    setReason,
  ] =
    useState("");


  const [
    audit,
    setAudit,
  ] =
    useState({
      logs: [],

      pagination: {
        page: 1,
        pageSize: 50,
        total: 0,
      },
    });


  const [
    auditLoading,
    setAuditLoading,
  ] =
    useState(false);


  const [
    auditFilters,
    setAuditFilters,
  ] =
    useState({
      section: "",
      actorType: "",
      fromDate: "",
      toDate: "",
      page: 1,
      pageSize: 50,
    });


  const [
    dialog,
    setDialog,
  ] =
    useState(null);


  const [
    dialogReason,
    setDialogReason,
  ] =
    useState("");


  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            data,
            caps,
          ] =
            await Promise.all([
              hotelSettingsService
                .getSettings(
                  context
                ),

              hotelSettingsService
                .getCapabilities(
                  context
                ),
            ]);


          setHotel(
            data.hotel ||
            null
          );


          setSettings(
            clone(
              data.settings ||
              {}
            )
          );


          setOriginal(
            clone(
              data.settings ||
              {}
            )
          );


          setMetadata(
            data.metadata ||
            {}
          );


          setPolicyVersions(
            data
              .policyVersions ||
            {}
          );


          setCapabilities(
            caps ||
            {}
          );
        } catch (
          requestError
        ) {
          setError(
            requestError
              ?.message ||
            "Hotel settings could not be loaded."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        context,
      ]
    );


  const loadAudit =
    useCallback(
      async (
        filters
      ) => {
        setAuditLoading(
          true
        );

        setError("");

        try {
          const data =
            await hotelSettingsService
              .getAuditHistory({
                ...context,
                filters,
              });


          setAudit({
            logs:
              data.logs ||
              [],

            pagination:
              data
                .pagination ||
              {
                page: 1,
                pageSize: 50,
                total: 0,
              },
          });
        } catch (
          requestError
        ) {
          setError(
            requestError
              ?.message ||
            "Settings history could not be loaded."
          );
        } finally {
          setAuditLoading(
            false
          );
        }
      },
      [
        context,
      ]
    );


  useEffect(() => {
    load();
  }, [
    load,
  ]);


  const current =
    settings[active] ||
    {};


  const currentMeta =
    metadata[active] ||
    {};


  const changedKeys =
    useMemo(
      () => {
        if (
          active ===
          "audit_history"
        ) {
          return [];
        }

        return Object
          .keys(
            settings[
              active
            ] || {}
          )
          .filter(
            (key) =>
              !equal(
                settings[
                  active
                ]?.[key],

                original[
                  active
                ]?.[key]
              )
          );
      },
      [
        active,
        settings,
        original,
      ]
    );


  const reasonRequired =
    SENSITIVE.has(
      active
    ) &&
    settings.audit
      ?.require_reason_for_policy_change !==
      false;


  const setValue = (
    key,
    value
  ) => {
    setSettings(
      (previous) => {
        const currentSection =
          previous[
            active
          ] || {};


        const nextSection = {
          ...currentSection,

          [key]:
            value,
        };


        /*
        * If Extra Beds are disabled,
        * child age slabs cannot keep an
        * Extra Bed Optional / Required rule.
        *
        * Normalize them automatically instead
        * of forcing the Admin to manually edit
        * hidden controls.
        */
        if (
          active ===
            "guest_requirements" &&
          key ===
            "extra_bed_enabled" &&
          value ===
            false &&
          Array.isArray(
            currentSection
              .child_age_rules
          )
        ) {
          nextSection
            .child_age_rules =
              currentSection
                .child_age_rules
                .map(
                  (rule) => ({
                    ...rule,

                    bed_policy:
                      "share_existing_bed",
                  })
                );
        }

        /*
        * For slab-based Day Use pricing,
        * the final slab automatically defines
        * the maximum Day Use duration.
        *
        * Example:
        * 3h → 40%
        * 6h → 55%
        * 9h → 70%
        *
        * Maximum Day Use Duration = 9 hours.
        *
        * Admin does not need to maintain the
        * same duration in two different places.
        */
        if (
          active ===
            "day_use" &&
          key ===
            "pricing_slabs" &&
          Array.isArray(value) &&
          [
            "fixed_slots",
            "percentage_slabs",
          ].includes(
            currentSection
              .pricing_mode
          )
        ) {
          const lastSlab =
            value[
              value.length - 1
            ];


          if (
            lastSlab &&
            Number(
              lastSlab
                .up_to_hours
            ) > 0
          ) {
            nextSection
              .maximum_day_use_hours =
                Number(
                  lastSlab
                    .up_to_hours
                );
          }
        }

        /*
        * When switching back to a slab-based mode,
        * derive the maximum duration from the
        * existing final slab.
        */
        if (
          active ===
            "day_use" &&
          key ===
            "pricing_mode" &&
          [
            "fixed_slots",
            "percentage_slabs",
          ].includes(
            value
          ) &&
          Array.isArray(
            currentSection
              .pricing_slabs
          ) &&
          currentSection
            .pricing_slabs
            .length
        ) {
          const lastSlab =
            currentSection
              .pricing_slabs[
                currentSection
                  .pricing_slabs
                  .length - 1
              ];


          if (
            Number(
              lastSlab
                ?.up_to_hours
            ) > 0
          ) {
            nextSection
              .maximum_day_use_hours =
                Number(
                  lastSlab
                    .up_to_hours
                );
          }
        }

        return {
          ...previous,

          [active]:
            nextSection,
        };
      }
    );


    setSuccess("");
  };


  const discard = () => {
    setSettings(
      (previous) => ({
        ...previous,

        [active]:
          clone(
            original[
              active
            ] || {}
          ),
      })
    );

    setReason("");
    setSuccess("");
  };


  const save =
    async () => {
      if (
        !changedKeys.length ||
        saving
      ) {
        return;
      }


      if (
        reasonRequired &&
        !reason.trim()
      ) {
        setError(
          "Please enter a reason for this policy change."
        );

        return;
      }


      setSaving(true);
      setError("");
      setSuccess("");


      try {
        const changes =
          changedKeys.map(
            (key) => ({
              section:
                active,

              key,

              value:
                settings[
                  active
                ][key],
            })
          );


        /*
        * Day Use dependency:
        *
        * If Very Early Arrival currently uses
        * Day Use and the Admin disables Day Use,
        * automatically fall back to Admin Decides.
        *
        * Both settings are saved atomically by
        * the backend in the same transaction.
        */
        if (
          active ===
            "day_use" &&
          changedKeys.includes(
            "enabled"
          ) &&
          settings
            .day_use
            ?.enabled ===
            false &&
          settings
            .checkin_checkout
            ?.very_early_arrival_action ===
            "day_use"
        ) {
          changes.push({
            section:
              "checkin_checkout",

            key:
              "very_early_arrival_action",

            value:
              "manual",
          });
        }

        const result =
          await hotelSettingsService
            .updateSettings({
              ...context,
              changes,
              changeReason:
                reason,
            });


        const count =
          result
            .changedCount ||
          changedKeys.length;


        setSuccess(
          `${count} setting${
            count === 1
              ? ""
              : "s"
          } saved successfully.`
        );


        setReason("");

        await load();
      } catch (
        requestError
      ) {
        setError(
          requestError
            ?.message ||
          "Hotel settings could not be saved."
        );
      } finally {
        setSaving(false);
      }
    };


  const switchSection = (
    next
  ) => {
    if (
      changedKeys.length &&
      next !== active
    ) {
      const proceed =
        window.confirm(
          "You have unsaved changes. Discard them and continue?"
        );


      if (!proceed) {
        return;
      }
    }


    if (
      changedKeys.length
    ) {
      discard();
    }


    setActive(next);
    setOpenGroup(
      getGroupForSection(
        next
      )
    );
    setError("");
    setSuccess("");


    if (
      next ===
      "audit_history"
    ) {
      loadAudit(
        auditFilters
      );
    }
  };


  const runDialog =
    async () => {
      if (
        !dialog ||
        saving
      ) {
        return;
      }


      setSaving(true);
      setError("");
      setSuccess("");


      try {
        if (
          dialog.type ===
          "restore"
        ) {
          await hotelSettingsService
            .restoreSetting({
              ...context,

              auditId:
                dialog.log
                  .auditId,

              changeReason:
                dialogReason,
            });


          setSuccess(
            "Previous setting value restored successfully."
          );
        } else {
          await hotelSettingsService
            .resetSetting({
              ...context,

              section:
                dialog.section,

              key:
                dialog.key,

              changeReason:
                dialogReason,
            });


          setSuccess(
            "Setting reset to the HMS default successfully."
          );
        }


        setDialog(null);
        setDialogReason("");

        await load();


        if (
          active ===
          "audit_history"
        ) {
          await loadAudit(
            auditFilters
          );
        }
      } catch (
        requestError
      ) {
        setError(
          requestError
            ?.message ||
          "The settings action could not be completed."
        );
      } finally {
        setSaving(false);
      }
    };


  if (loading) {
    return (
      <div className="hotel-settings-page">
        <div className="hotel-settings-loading-card">
          <div className="hotel-settings-spinner" />

          <div>
            <strong>
              Loading Hotel Settings
            </strong>

            <span>
              Reading current policies and versions...
            </span>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="hotel-settings-page">

      <div className="hotel-settings-hero">
        <div>
          <div className="hotel-settings-eyebrow">
            Hotel Policy Engine
          </div>

          <h1>
            Hotel Settings
          </h1>

          <p>
            Configure how this hotel handles bookings,
            cancellations, room changes, payments,
            discounts, concessions and other operational rules.
          </p>
        </div>


        <div className="hotel-settings-hotel-card">
          <span>
            Current Hotel
          </span>

          <strong>
            {hotel?.name ||
              "Hotel"}
          </strong>

          <small>
            {hotel?.displayId ||
              hotelDisplayId ||
              "—"}
          </small>
        </div>
      </div>


      {error && (
        <div className="hotel-settings-alert is-error">
          {error}
        </div>
      )}


      {success && (
        <div className="hotel-settings-alert is-success">
          {success}
        </div>
      )}


      <div className="hotel-settings-shell">

        <aside className="hotel-settings-nav">
          {GROUPS.map(
            ([
              group,
              sections,
            ]) => {
              const isOpen =
                openGroup ===
                group;


              return (
                <div
                  className="hotel-settings-nav-group"
                  key={group}
                >

                  <button
                    type="button"
                    className="hotel-settings-nav-heading hotel-settings-nav-heading-button"
                    onClick={() =>
                      setOpenGroup(
                        (
                          currentGroup
                        ) =>
                          currentGroup ===
                          group
                            ? ""
                            : group
                      )
                    }
                    aria-expanded={
                      isOpen
                    }
                  >
                    <span>
                      {group}
                    </span>

                    <span className="hotel-settings-nav-chevron">
                      {isOpen
                        ? "−"
                        : "+"}
                    </span>
                  </button>


                  {isOpen && (
                    <div className="hotel-settings-nav-group-list">

                      {sections.map(
                        (
                          section
                        ) => (
                          <button
                            type="button"
                            className={`hotel-settings-nav-item ${
                              active ===
                              section
                                ? "is-active"
                                : ""
                            }`}
                            onClick={() =>
                              switchSection(
                                section
                              )
                            }
                            key={
                              section
                            }
                          >
                            <span>
                              {
                                SECTION_LABELS[
                                  section
                                ]
                              }
                            </span>
                          </button>
                        )
                      )}

                    </div>
                  )}

                </div>
              );
            }
          )}
        </aside>


        <main className="hotel-settings-content">

          <div className="hotel-settings-section-header">
            <div>
              <h2>
                {SECTION_LABELS[
                  active
                ]}
              </h2>

              <p>
                {SECTION_HELP[
                  active
                ]}
              </p>
            </div>


            {/* {policyVersions[
              active
            ] && (
              <div className="hotel-settings-policy-version">
                <span>
                  Current Policy
                </span>

                <strong>
                  v{
                    policyVersions[
                      active
                    ].versionNo
                  }
                </strong>
              </div>
            )} */}
          </div>


          {active ===
          "audit_history" ? (

            <div className="hotel-settings-audit-block">

              <div className="hotel-settings-audit-filters">

                <select
                  className="hotel-settings-select"
                  value={
                    auditFilters
                      .section
                  }
                  onChange={(event) =>
                    setAuditFilters(
                      (previous) => ({
                        ...previous,

                        section:
                          event.target
                            .value,
                      })
                    )
                  }
                >
                  <option value="">
                    All Sections
                  </option>


                  {Object
                    .keys(
                      settings
                    )
                    .map(
                      (section) => (
                        <option
                          key={section}
                          value={section}
                        >
                          {SECTION_LABELS[
                            section
                          ] ||
                            humanize(
                              section
                            )}
                        </option>
                      )
                    )}
                </select>


                <select
                  className="hotel-settings-select"
                  value={
                    auditFilters
                      .actorType
                  }
                  onChange={(event) =>
                    setAuditFilters(
                      (previous) => ({
                        ...previous,

                        actorType:
                          event.target
                            .value,
                      })
                    )
                  }
                >
                  <option value="">
                    All Actors
                  </option>

                  <option value="admin">
                    Admin
                  </option>

                  <option value="super_admin">
                    Super Admin
                  </option>

                  <option value="system">
                    System
                  </option>
                </select>


                <input
                  className="hotel-settings-input"
                  type="date"
                  value={
                    auditFilters
                      .fromDate
                  }
                  onChange={(event) =>
                    setAuditFilters(
                      (previous) => ({
                        ...previous,

                        fromDate:
                          event.target
                            .value,
                      })
                    )
                  }
                />


                <input
                  className="hotel-settings-input"
                  type="date"
                  value={
                    auditFilters
                      .toDate
                  }
                  onChange={(event) =>
                    setAuditFilters(
                      (previous) => ({
                        ...previous,

                        toDate:
                          event.target
                            .value,
                      })
                    )
                  }
                />


                <button
                  type="button"
                  className="hotel-settings-primary-button"
                  onClick={() =>
                    loadAudit({
                      ...auditFilters,
                      page: 1,
                    })
                  }
                  disabled={
                    auditLoading
                  }
                >
                  Apply Filters
                </button>
              </div>


              {auditLoading ? (

                <div className="hotel-settings-empty-state">
                  Loading activity history...
                </div>

              ) : !audit.logs.length ? (

                <div className="hotel-settings-empty-state">
                  No setting changes match the selected filters.
                </div>

              ) : (

                <div className="hotel-settings-table-wrap">
                  <table className="hotel-settings-audit-table">
                    <thead>
                      <tr>
                        <th>
                          Date & Time
                        </th>

                        <th>
                          Changed By
                        </th>

                        <th>
                          Section
                        </th>

                        <th>
                          Setting
                        </th>

                        <th>
                          Change
                        </th>

                        <th>
                          Reason
                        </th>

                        <th />
                      </tr>
                    </thead>


                    <tbody>
                      {audit.logs.map(
                        (log) => (
                          <tr
                            key={
                              log.auditId
                            }
                          >
                            <td>
                              {new Date(
                                log.changedAt
                              ).toLocaleString()}
                            </td>


                            <td>
                              <strong>
                                {log.actor
                                  ?.name ||
                                  "System"}
                              </strong>

                              <span className="hotel-settings-table-subtext">
                                {log.actor
                                  ?.displayId ||
                                  humanize(
                                    log.actor
                                      ?.type
                                  )}
                              </span>
                            </td>


                            <td>
                              {SECTION_LABELS[
                                log.section
                              ] ||
                                humanize(
                                  log.section
                                )}
                            </td>


                            <td>
                              {label(
                                log.key
                              )}

                              <span className="hotel-settings-table-subtext">
                                {humanize(
                                  log.actionType
                                )}
                                {" · "}
                                v{
                                  log.oldVersion ??
                                  "—"
                                }
                                {" → "}
                                v{
                                  log.newVersion
                                }
                              </span>
                            </td>


                            <td>
                              <span className="hotel-settings-change-old">
                                {summary(
                                  log.oldValue
                                )}
                              </span>

                              <span className="hotel-settings-change-arrow">
                                →
                              </span>

                              <span className="hotel-settings-change-new">
                                {summary(
                                  log.newValue
                                )}
                              </span>
                            </td>


                            <td>
                              {log.changeReason ||
                                "—"}
                            </td>


                            <td>
                              {log.oldValue !==
                                null && (
                                <button
                                  type="button"
                                  className="hotel-settings-link-button"
                                  onClick={() => {
                                    setDialog({
                                      type:
                                        "restore",

                                      log,
                                    });

                                    setDialogReason(
                                      ""
                                    );
                                  }}
                                >
                                  Restore
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}


              <div className="hotel-settings-audit-footer">
                Total changes: {
                  audit
                    .pagination
                    .total || 0
                }
              </div>
            </div>

          ) : (

            <>

              <div className="hotel-settings-fields">

                {orderedSettingKeys(
                  active,
                  current
                )
                  .filter(
                    (key) =>
                      shouldShowSetting(
                        active,
                        key,
                        current
                      )
                  )
                  .map(
                    (key) => {
                      const meta =
                        currentMeta[
                          key
                        ] || {};


                      return (
                        <div
                          className={`hotel-settings-field ${
                            changedKeys.includes(
                              key
                            )
                              ? "is-changed"
                              : ""
                          } ${
                            [
                              "rules",
                              "presets",
                              "child_age_rules",
                              "allowed_id_proof_types",
                              "pricing_slabs",
                            ].includes(key)
                              ? "is-wide"
                              : ""
                          }`}
                          key={key}
                        >

                          <div className="hotel-settings-field-header">
                            <div>
                              <label className="hotel-settings-label">
                                {settingLabel(
                                  active,
                                  key
                                )}
                              </label>


                              <div className="hotel-settings-field-meta">
                                {meta.updatedBy
                                  ?.name
                                  ? `Last updated by ${meta.updatedBy.name}`
                                  : "Hotel setting"}
                              </div>
                            </div>


                            <button
                              type="button"
                              className="hotel-settings-reset-button"
                              onClick={() => {
                                setDialog({
                                  type:
                                    "reset",

                                  section:
                                    active,

                                  key,
                                });

                                setDialogReason(
                                  ""
                                );
                              }}
                              disabled={
                                saving
                              }
                            >
                              Reset
                            </button>
                          </div>


                          <Control
                            section={
                              active
                            }
                            settingKey={
                              key
                            }
                            value={
                              current[key]
                            }
                            dataType={
                              meta.dataType
                            }
                            sectionValues={
                              current
                            }
                            dayUseEnabled={
                              settings
                                .day_use
                                ?.enabled ===
                              true
                            }
                            onChange={(value) =>
                              setValue(
                                key,
                                value
                              )
                            }
                            capabilities={
                              capabilities
                            }
                            disabled={
                              saving
                            }
                          />
                        </div>
                      );
                    }
                  )}
              </div>


              <div className="hotel-settings-save-panel">

                <div className="hotel-settings-reason-block">
                  <label className="hotel-settings-label">
                    Change Reason

                    {reasonRequired && (
                      <span className="hotel-settings-required">
                        *
                      </span>
                    )}
                  </label>


                  <textarea
                    className="hotel-settings-textarea"
                    rows="3"
                    placeholder={
                      reasonRequired
                        ? "Explain why this policy is being changed."
                        : "Optional note for settings history."
                    }
                    value={reason}
                    onChange={(event) =>
                      setReason(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving
                    }
                  />
                </div>


                <div className="hotel-settings-save-summary">
                  <span>
                    {changedKeys.length} unsaved change{
                      changedKeys.length ===
                      1
                        ? ""
                        : "s"
                    }
                  </span>


                  <div className="hotel-settings-save-actions">

                    <button
                      type="button"
                      className="hotel-settings-secondary-button"
                      onClick={
                        discard
                      }
                      disabled={
                        !changedKeys.length ||
                        saving
                      }
                    >
                      Discard
                    </button>


                    <button
                      type="button"
                      className="hotel-settings-primary-button"
                      onClick={
                        save
                      }
                      disabled={
                        !changedKeys.length ||
                        saving
                      }
                    >
                      {saving
                        ? "Saving..."
                        : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>


      {dialog && (
        <div className="hotel-settings-modal-backdrop">

          <div
            className="hotel-settings-modal"
            role="dialog"
            aria-modal="true"
          >
            <h3>
              {dialog.type ===
              "restore"
                ? "Restore Previous Setting"
                : "Reset Setting"}
            </h3>


            <p>
              {dialog.type ===
              "restore"
                ? "The existing audit history will remain. A new restore record and policy version will be created when applicable."
                : "This will restore the selected value to the HMS default and record the action in history."}
            </p>


            <label className="hotel-settings-label">
              Reason
            </label>


            <textarea
              className="hotel-settings-textarea"
              rows="3"
              value={
                dialogReason
              }
              onChange={(event) =>
                setDialogReason(
                  event.target
                    .value
                )
              }
              placeholder="Optional note for this action"
              disabled={
                saving
              }
            />


            <div className="hotel-settings-modal-actions">

              <button
                type="button"
                className="hotel-settings-secondary-button"
                onClick={() => {
                  if (!saving) {
                    setDialog(
                      null
                    );

                    setDialogReason(
                      ""
                    );
                  }
                }}
                disabled={
                  saving
                }
              >
                Cancel
              </button>


              <button
                type="button"
                className="hotel-settings-primary-button"
                onClick={
                  runDialog
                }
                disabled={
                  saving
                }
              >
                {saving
                  ? "Processing..."
                  : dialog.type ===
                      "restore"
                    ? "Restore"
                    : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default Settings;