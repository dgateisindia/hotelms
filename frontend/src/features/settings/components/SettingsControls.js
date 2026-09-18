import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  chargeLabel,
  equal,
  humanize,
  priceLabel,
  supportedValues,
} from "../settingsShared";

const STATIC_SELECTS = {
  "regional.date_format": [
    ["DD-MM-YYYY", "DD-MM-YYYY"],
    ["DD/MM/YYYY", "DD/MM/YYYY"],
    ["MM/DD/YYYY", "MM/DD/YYYY"],
    ["YYYY-MM-DD", "YYYY-MM-DD"],
  ],

  "booking.default_booking_status": [
    ["confirmed", "Confirmed"],
    ["pending", "Pending"],
  ],

  "day_use.pricing_mode": [
    [
      "fixed_slots",
      "Fixed Slot Price",
    ],

    [
      "percentage_slabs",
      "% Of Room Rate",
    ],

    [
      "hourly",
      "Hourly Rate",
    ],
  ],


  "day_use.hourly_rate_type": [
    [
      "fixed_amount",
      "Fixed Amount Per Hour",
    ],

    [
      "percentage_of_night",
      "% Of Room Rate Per Hour",
    ],
  ],


  "day_use.overnight_conversion_mode": [
    [
      "adjust_against_night_rate",
      "Adjust Day Use Amount Against Night Rate",
    ],

    [
      "charge_full_night_separately",
      "Charge Full Night Separately",
    ],
  ],

  "cancellation.calculation_mode": [
    ["manual", "Manual Settlement"],
    ["rules", "Use Cancellation Rules"],
  ],

  "no_show.calculation_mode": [
    ["manual", "Manual Settlement"],
    ["rules", "Use Configured Rule"],
  ],

  "early_checkout.calculation_mode": [
    ["manual", "Manual Settlement"],
    ["rules", "Use Configured Rule"],
  ],

  "late_checkout.calculation_mode": [
    ["manual", "Manual Settlement"],
    ["rules", "Use Late Checkout Rules"],
  ],

  "room_change.when_original_room_ready": [
    ["ask_guest", "Ask Guest"],
    ["return_original", "Return To Original Room"],
    ["stay_replacement", "Keep Replacement Room"],
    ["admin_decides", "Admin Decides"],
  ],

  "discount.default_method": [
    ["percentage", "Percentage"],
    ["fixed_amount", "Fixed Amount"],
  ],

  "concession.mode": [
    [
      "manual_at_checkout",
      "Decide Manually At Checkout",
    ],
    [
      "suggested_fixed",
      "Suggest Fixed Amount",
    ],
    [
      "suggested_percentage",
      "Suggest Percentage",
    ],
  ],

  "concession.suggested_method": [
    ["fixed_amount", "Fixed Amount"],
    ["percentage", "Percentage"],
  ],

  "refund.handling_mode": [
    [
      "calculate_and_show",
      "Calculate And Show Refund Due",
    ],
    [
      "manual_process",
      "Manual Refund Processing",
    ],
  ],

  "housekeeping.checkout_room_status": [
    ["cleaning", "Cleaning"],
    ["available", "Available"],
    ["maintenance", "Maintenance"],
  ],
};

const ARRAY_OPTIONS = {
  "guest_requirements.allowed_id_proof_types": [
    ["Aadhaar", "Aadhaar"],
    ["Passport", "Passport"],
    [
      "Driving Licence",
      "Driving Licence",
    ],
    ["Voter ID", "Voter ID"],
    ["Other", "Other"],
  ],

  "payment.allowed_methods": [
    ["cash", "Cash"],
    ["upi", "UPI"],
    ["card", "Card"],
    ["bank_transfer", "Bank Transfer"],
  ],

  "discount.allowed_methods": [
    ["percentage", "Percentage"],
    ["fixed_amount", "Fixed Amount"],
  ],

  "fee_waiver.allowed_fee_types": [
    ["cancellation", "Cancellation"],
    ["no_show", "No Show"],
    ["early_checkout", "Early Checkout"],
    ["late_checkout", "Late Checkout"],
    ["other", "Other"],
  ],

  "refund.allowed_methods": [
    [
      "original_method",
      "Original Payment Method",
    ],
    ["cash", "Cash"],
    ["bank_transfer", "Bank Transfer"],
  ],
};

const CHILD_CHARGE_OPTIONS = [
  [
    "none",
    "No Extra Charge",
  ],

  [
    "fixed_amount",
    "Fixed Amount / Night",
  ],

  [
    "percentage",
    "% Of Room Rate / Night",
  ],
];

const CHILD_BED_OPTIONS = [
  [
    "share_existing_bed",
    "Share Existing Bed",
  ],

  [
    "extra_bed_optional",
    "Extra Bed Optional",
  ],

  [
    "extra_bed_required",
    "Extra Bed Required",
  ],
];

const EARLY_CHECKIN_CHARGE_OPTIONS = [
  [
    "none",
    "No Charge",
  ],

  [
    "fixed_amount",
    "Fixed Amount",
  ],

  [
    "fixed_per_hour",
    "Fixed Amount / Early Hour",
  ],

  [
    "percentage_per_hour",
    "% Of Room Rate / Early Hour",
  ],

  [
    "manual",
    "Admin Decides",
  ],
];

const TIMEZONE_OPTIONS =
  supportedValues(
    "timeZone",
    [
      "Asia/Kolkata",
      "UTC",
    ]
  ).map(
    (value) => [
      value,
      value,
    ]
  );

const CURRENCY_OPTIONS =
  supportedValues(
    "currency",
    [
      "INR",
      "USD",
      "EUR",
      "GBP",
      "AED",
    ]
  ).map(
    (value) => [
      value,
      value,
    ]
  );

function Select({
  value,
  options,
  onChange,
  disabled,
}) {
  const safeOptions =
    value &&
    !options.some(
      ([optionValue]) =>
        optionValue ===
        value
    )
      ? [
          [
            value,
            humanize(value),
          ],
          ...options,
        ]
      : options;

  return (
    <select
      className="hotel-settings-select"
      value={value ?? ""}
      onChange={(event) =>
        onChange(
          event.target.value
        )
      }
      disabled={disabled}
    >
      {safeOptions.map(
        ([
          optionValue,
          text,
        ]) => (
          <option
            key={optionValue}
            value={optionValue}
          >
            {text}
          </option>
        )
      )}
    </select>
  );
}

function Toggle({
  value,
  onChange,
  disabled,
}) {
  return (
    <button
      type="button"
      className={`hotel-settings-toggle ${
        value
          ? "is-on"
          : ""
      }`}
      onClick={() =>
        onChange(!value)
      }
      disabled={disabled}
      aria-pressed={
        Boolean(value)
      }
    >
      <span className="hotel-settings-toggle-knob" />

      <span>
        {value
          ? "On"
          : "Off"}
      </span>
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  disabled,
  min = 0,
  max,
  step = "0.01",
  placeholder = "",
}) {
  const [
    inputValue,
    setInputValue,
  ] =
    useState(
      value === null ||
      value === undefined
        ? ""
        : String(value)
    );


  useEffect(() => {
    setInputValue(
      value === null ||
      value === undefined
        ? ""
        : String(value)
    );
  }, [
    value,
  ]);


  const handleChange = (
    event
  ) => {
    const nextValue =
      event.target.value;


    /*
     * Important UX rule:
     *
     * Allow the field to become temporarily empty.
     * Do NOT immediately force empty text back to 0.
     */
    setInputValue(
      nextValue
    );


    if (
      nextValue === "" ||
      nextValue === "-" ||
      nextValue === "." ||
      nextValue === "-."
    ) {
      return;
    }


    const numericValue =
      Number(
        nextValue
      );


    if (
      Number.isNaN(
        numericValue
      )
    ) {
      return;
    }


    onChange(
      numericValue
    );
  };


  const handleBlur = () => {
    /*
     * If the user leaves the field empty,
     * normalize it to zero.
     *
     * Later section-specific validation may
     * require a value greater than zero.
     */
    if (
      inputValue === ""
    ) {
      setInputValue(
        "0"
      );

      onChange(0);

      return;
    }


    let numericValue =
      Number(
        inputValue
      );


    if (
      Number.isNaN(
        numericValue
      )
    ) {
      numericValue = 0;
    }


    if (
      min !== undefined &&
      min !== null
    ) {
      numericValue =
        Math.max(
          Number(min),
          numericValue
        );
    }


    if (
      max !== undefined &&
      max !== null
    ) {
      numericValue =
        Math.min(
          Number(max),
          numericValue
        );
    }


    setInputValue(
      String(
        numericValue
      )
    );

    onChange(
      numericValue
    );
  };


  const handleFocus = (
    event
  ) => {
    /*
     * If current value is zero, selecting it
     * means typing "5" immediately produces 5,
     * not 05.
     */
    if (
      inputValue ===
      "0"
    ) {
      event.currentTarget
        .select();
    }
  };


  return (
    <input
      className="hotel-settings-input"
      type="number"
      min={min}
      max={max}
      step={step}
      placeholder={
        placeholder
      }
      value={
        inputValue
      }
      onChange={
        handleChange
      }
      onBlur={
        handleBlur
      }
      onFocus={
        handleFocus
      }
      disabled={
        disabled
      }
    />
  );
}

function MultiSelect({
  value,
  options,
  onChange,
  disabled,
}) {
  const selected =
    Array.isArray(value)
      ? value
      : [];

  const toggle = (
    item
  ) => {
    if (
      selected.includes(
        item
      )
    ) {
      onChange(
        selected.filter(
          (valueItem) =>
            valueItem !== item
        )
      );

      return;
    }

    onChange([
      ...selected,
      item,
    ]);
  };

  return (
    <div className="hotel-settings-check-grid">
      {options.map(
        ([
          optionValue,
          text,
        ]) => (
          <label
            className="hotel-settings-check-option"
            key={optionValue}
          >
            <input
              type="checkbox"
              checked={
                selected.includes(
                  optionValue
                )
              }
              onChange={() =>
                toggle(
                  optionValue
                )
              }
              disabled={disabled}
            />

            <span>
              {text}
            </span>
          </label>
        )
      )}
    </div>
  );
}

function EarlyCheckinChargeRule({
  value,
  onChange,
  disabled,
}) {
  const rule = {
    method:
      value?.method ||
      "manual",

    value:
      value?.value ??
      0,

    maximum_percentage_of_night:
      value
        ?.maximum_percentage_of_night ??
      50,
  };


  const needsValue =
    [
      "fixed_amount",
      "fixed_per_hour",
      "percentage_per_hour",
    ].includes(
      rule.method
    );


  let valueLabel =
    "Amount";


  if (
    rule.method ===
      "fixed_per_hour"
  ) {
    valueLabel =
      "Amount Per Early Hour";
  }


  if (
    rule.method ===
      "percentage_per_hour"
  ) {
    valueLabel =
      "% Per Early Hour";
  }


  return (
    <div className="hotel-settings-rule-editor">

      <div>
        <label className="hotel-settings-mini-label">
          Pricing Method
        </label>

        <select
          className="hotel-settings-select"
          value={
            rule.method
          }
          onChange={(event) =>
            onChange({
              ...rule,

              method:
                event.target
                  .value,

              value: 0,
            })
          }
          disabled={
            disabled
          }
        >
          {EARLY_CHECKIN_CHARGE_OPTIONS.map(
            ([
              optionValue,
              text,
            ]) => (
              <option
                key={
                  optionValue
                }
                value={
                  optionValue
                }
              >
                {text}
              </option>
            )
          )}
        </select>
      </div>


      {needsValue && (
        <div>
          <label className="hotel-settings-mini-label">
            {valueLabel}
          </label>

          <NumberInput
            value={
              rule.value
            }
            min={0}
            max={
              rule.method ===
                "percentage_per_hour"
                ? 100
                : undefined
            }
            step="0.01"
            onChange={(
              nextValue
            ) =>
              onChange({
                ...rule,

                value:
                  nextValue,
              })
            }
            disabled={
              disabled
            }
          />
        </div>
      )}


      {rule.method ===
        "percentage_per_hour" && (
        <div>
          <label className="hotel-settings-mini-label">
            Maximum Charge (% Of Night Rate)
          </label>

          <NumberInput
            value={
              rule
                .maximum_percentage_of_night
            }
            min={0}
            max={100}
            step="1"
            onChange={(
              nextValue
            ) =>
              onChange({
                ...rule,

                maximum_percentage_of_night:
                  nextValue,
              })
            }
            disabled={
              disabled
            }
          />
        </div>
      )}

    </div>
  );
}

function DayUsePricingSlabs({
  value,
  pricingMode,
  maximumHours,
  onChange,
  disabled,
}) {
  const slabs =
    Array.isArray(value)
      ? value
      : [];

  const isSlabMode =
    [
      "fixed_slots",
      "percentage_slabs",
    ].includes(
      pricingMode
    );


  const maxHours =
    isSlabMode
      ? 23
      : Math.max(
          1,
          Number(
            maximumHours
          ) || 10
        );


  const update = (
    index,
    next
  ) => {
    onChange(
      slabs.map(
        (
          slab,
          slabIndex
        ) =>
          slabIndex ===
          index
            ? next
            : slab
      )
    );
  };


  const nextHours =
    slabs.length
      ? Math.min(
          maxHours,
          Number(
            slabs[
              slabs.length - 1
            ]?.up_to_hours ||
            0
          ) + 3
        )
      : Math.min(
          3,
          maxHours
        );


  const canAdd =
    !slabs.length ||
    Number(
      slabs[
        slabs.length - 1
      ]?.up_to_hours ||
      0
    ) < maxHours;


  return (
    <div className="hotel-settings-list-editor">

      {!slabs.length && (
        <div className="hotel-settings-empty-inline">
          No Day Use pricing slabs configured.
        </div>
      )}


      {slabs.map(
        (
          slab,
          index
        ) => {
          const previousHours =
            index > 0
              ? Number(
                  slabs[
                    index - 1
                  ]?.up_to_hours
                ) || 0
              : 0;

          const previousPrice =
            index > 0
              ? Number(
                  slabs[
                    index - 1
                  ]?.value
                ) || 0
              : 0;

          const nextSlabHours =
            index <
            slabs.length - 1
              ? Number(
                  slabs[
                    index + 1
                  ]?.up_to_hours
                ) || null
              : null;
          
          return (

            <div
              className="hotel-settings-preset-row"
              key={index}
            >

              <div>
                <label className="hotel-settings-mini-label">
                  Up To Hours
                </label>
                
                <NumberInput
                  value={
                    slab.up_to_hours
                  }
                  min={
                    previousHours + 1
                  }
                  max={
                    nextSlabHours !==
                    null
                      ? nextSlabHours - 1
                      : maxHours
                  }
                  step="1"
                  onChange={(
                    nextValue
                  ) =>
                    update(
                      index,
                      {
                        ...slab,

                        up_to_hours:
                          nextValue,
                      }
                    )
                  }
                  disabled={
                    disabled
                  }
                />
              </div>


              <div>
                <label className="hotel-settings-mini-label">
                  {pricingMode ===
                  "percentage_slabs"
                    ? "% Of Room Rate"
                    : "Fixed Price (Hotel Currency)"}
                </label>

                <NumberInput
                  value={
                    slab.value
                  }
                  min={
                    previousPrice
                  }
                  max={
                    pricingMode ===
                    "percentage_slabs"
                      ? 100
                      : undefined
                  }
                  step="0.01"
                  onChange={(
                    nextValue
                  ) =>
                    update(
                      index,
                      {
                        ...slab,

                        value:
                          nextValue,
                      }
                    )
                  }
                  disabled={
                    disabled
                  }
                />
              </div>


              <div>
                <strong>
                  Up to {
                    slab
                      .up_to_hours
                  } hour{
                    Number(
                      slab
                        .up_to_hours
                    ) === 1
                      ? ""
                      : "s"
                  }
                </strong>
              </div>


              <button
                type="button"
                className="hotel-settings-icon-button is-danger"
                onClick={() =>
                  onChange(
                    slabs.filter(
                      (
                        _,
                        slabIndex
                      ) =>
                        slabIndex !==
                        index
                    )
                  )
                }
                disabled={
                  disabled
                }
                aria-label={`Remove Day Use slab ${index + 1}`}
              >
                ×
              </button>

            </div>
          );
        }
      )}


      <button
        type="button"
        className="hotel-settings-secondary-button"
        onClick={() =>
          onChange([
            ...slabs,

            {
              up_to_hours:
                nextHours,

              value:
                slabs.length
                  ? Number(
                      slabs[
                        slabs.length - 1
                      ]?.value
                    ) || 0
                  : pricingMode ===
                      "percentage_slabs"
                    ? 40
                    : 0,
            },
          ])
        }
        disabled={
          disabled ||
          !canAdd
        }
      >
        {canAdd
          ? "+ Add Day Use Slab"
          : "Maximum Duration Covered"}
      </button>

    </div>
  );
}

function ChargeRule({
  value,
  onChange,
  capabilities,
  disabled,
  allowedMethods,
}) {
  const rule = {
    method:
      value?.method ||
      "manual",

    value:
      value?.value ??
      0,
  };

  const methods =
    allowedMethods ||
    capabilities
      .chargeMethods ||
    [];

  const needsValue =
    [
      "fixed_amount",
      "percentage",
      "night_count",
      "percentage_of_remaining",
    ].includes(
      rule.method
    );

  let valueLabel =
    "Amount";

  if (
    rule.method ===
      "night_count"
  ) {
    valueLabel =
      "Nights";
  } else if (
    rule.method.includes(
      "percentage"
    )
  ) {
    valueLabel =
      "Percentage";
  }

  return (
    <div className="hotel-settings-rule-editor">
      <div>
        <label className="hotel-settings-mini-label">
          Method
        </label>

        <select
          className="hotel-settings-select"
          value={rule.method}
          onChange={(event) =>
            onChange({
              ...rule,

              method:
                event.target
                  .value,

              value: 0,
            })
          }
          disabled={disabled}
        >
          {methods.map(
            (method) => (
              <option
                key={method}
                value={method}
              >
                {chargeLabel(
                  method
                )}
              </option>
            )
          )}
        </select>
      </div>

      {needsValue && (
        <div>
          <label className="hotel-settings-mini-label">
            {valueLabel}
          </label>

          <NumberInput
            value={
              rule.value
            }
            min={0}
            max={
              rule.method.includes(
                "percentage"
              )
                ? 100
                : undefined
            }
            step="0.01"
            onChange={(
              nextValue
            ) =>
              onChange({
                ...rule,

                value:
                  nextValue,
              })
            }
            disabled={
              disabled
            }
          />
        </div>
      )}
    </div>
  );
}

function PriceRule({
  value,
  onChange,
  capabilities,
  disabled,
}) {
  const rule = {
    pricing_method:
      value
        ?.pricing_method ||
      "manual",

    custom_rate:
      value
        ?.custom_rate ??
      null,

    ...(
      Object.prototype
        .hasOwnProperty
        .call(
          value || {},
          "effective_from"
        )
        ? {
            effective_from:
              value
                .effective_from,
          }
        : {}
    ),
  };

  return (
    <div className="hotel-settings-rule-editor">
      <div>
        <label className="hotel-settings-mini-label">
          Pricing
        </label>

        <select
          className="hotel-settings-select"
          value={
            rule.pricing_method
          }
          onChange={(event) =>
            onChange({
              ...rule,

              pricing_method:
                event.target
                  .value,
            })
          }
          disabled={disabled}
        >
          {(
            capabilities
              .priceMethods ||
            []
          ).map(
            (method) => (
              <option
                key={method}
                value={method}
              >
                {priceLabel(
                  method
                )}
              </option>
            )
          )}
        </select>
      </div>

      {rule.pricing_method ===
        "custom_rate" && (
        <div>
          <label className="hotel-settings-mini-label">
            Custom Rate
          </label>

          <NumberInput
            value={
              rule.custom_rate ??
              0
            }
            min={0}
            step="0.01"
            onChange={(
              nextValue
            ) =>
              onChange({
                ...rule,

                custom_rate:
                  nextValue,
              })
            }
            disabled={
              disabled
            }
          />
        </div>
      )}

      {Object.prototype
        .hasOwnProperty
        .call(
          rule,
          "effective_from"
        ) && (
        <div>
          <label className="hotel-settings-mini-label">
            Effective From
          </label>

          <select
            className="hotel-settings-select"
            value={
              rule
                .effective_from ||
              "next_billing_night"
            }
            onChange={(event) =>
              onChange({
                ...rule,

                effective_from:
                  event.target
                    .value,
              })
            }
            disabled={disabled}
          >
            {(
              capabilities
                .effectiveFromOptions ||
              []
            ).map(
              (option) => (
                <option
                  key={option}
                  value={option}
                >
                  {humanize(
                    option
                  )}
                </option>
              )
            )}
          </select>
        </div>
      )}
    </div>
  );
}

function CancellationRules({
  value,
  onChange,
  capabilities,
  disabled,
}) {
  const rules =
    Array.isArray(value)
      ? value
      : [];

  const update = (
    index,
    next
  ) => {
    onChange(
      rules.map(
        (
          rule,
          ruleIndex
        ) =>
          ruleIndex ===
          index
            ? next
            : rule
      )
    );
  };

  return (
    <div className="hotel-settings-list-editor">
      {!rules.length && (
        <div className="hotel-settings-empty-inline">
          No automatic cancellation slabs configured.
        </div>
      )}

      {rules.map(
        (
          rule,
          index
        ) => (
          <div
            className="hotel-settings-rule-row"
            key={index}
          >
            <strong>
              Rule {index + 1}
            </strong>

            <div>
              <label className="hotel-settings-mini-label">
                From Days Before
              </label>

              <input
                className="hotel-settings-input"
                type="number"
                min="0"
                step="0.5"
                value={
                  rule
                    .from_hours_before ==
                  null
                    ? ""
                    : Number(
                        rule
                          .from_hours_before
                      ) / 24
                }
                onChange={(event) =>
                  update(
                    index,
                    {
                      ...rule,

                      from_hours_before:
                        event.target
                          .value ===
                        ""
                          ? null
                          : Number(
                              event
                                .target
                                .value
                            ) *
                            24,
                    }
                  )
                }
                disabled={disabled}
              />
            </div>

            <div>
              <label className="hotel-settings-mini-label">
                To Days Before
              </label>

              <input
                className="hotel-settings-input"
                type="number"
                min="0"
                step="0.5"
                placeholder="No upper limit"
                value={
                  rule
                    .to_hours_before ==
                  null
                    ? ""
                    : Number(
                        rule
                          .to_hours_before
                      ) / 24
                }
                onChange={(event) =>
                  update(
                    index,
                    {
                      ...rule,

                      to_hours_before:
                        event.target
                          .value ===
                        ""
                          ? null
                          : Number(
                              event
                                .target
                                .value
                            ) *
                            24,
                    }
                  )
                }
                disabled={disabled}
              />
            </div>

            <ChargeRule
              value={
                rule.charge
              }
              onChange={(
                charge
              ) =>
                update(
                  index,
                  {
                    ...rule,
                    charge,
                  }
                )
              }
              capabilities={
                capabilities
              }
              disabled={disabled}
            />

            <button
              type="button"
              className="hotel-settings-icon-button is-danger"
              onClick={() =>
                onChange(
                  rules.filter(
                    (
                      _,
                      ruleIndex
                    ) =>
                      ruleIndex !==
                      index
                  )
                )
              }
              disabled={disabled}
            >
              ×
            </button>
          </div>
        )
      )}

      <button
        type="button"
        className="hotel-settings-secondary-button"
        onClick={() =>
          onChange([
            ...rules,

            {
              from_hours_before:
                24,

              to_hours_before:
                null,

              charge: {
                method:
                  "none",

                value: 0,
              },
            },
          ])
        }
        disabled={disabled}
      >
        + Add Cancellation Rule
      </button>
    </div>
  );
}

function LateRules({
  value,
  onChange,
  capabilities,
  disabled,
}) {
  const rules =
    Array.isArray(value)
      ? value
      : [];

  const update = (
    index,
    next
  ) => {
    onChange(
      rules.map(
        (
          rule,
          ruleIndex
        ) =>
          ruleIndex ===
          index
            ? next
            : rule
      )
    );
  };

  return (
    <div className="hotel-settings-list-editor">
      {!rules.length && (
        <div className="hotel-settings-empty-inline">
          No automatic late-checkout slabs configured.
        </div>
      )}

      {rules.map(
        (
          rule,
          index
        ) => (
          <div
            className="hotel-settings-rule-row"
            key={index}
          >
            <strong>
              Rule {index + 1}
            </strong>

            <div>
              <label className="hotel-settings-mini-label">
                From Minutes Late
              </label>

              <NumberInput
                value={
                  rule
                    .from_minutes_after_checkout ??
                  0
                }
                min={0}
                step="1"
                onChange={(
                  nextValue
                ) =>
                  update(
                    index,
                    {
                      ...rule,

                      from_minutes_after_checkout:
                        nextValue,
                    }
                  )
                }
                disabled={
                  disabled
                }
              />
            </div>

            <div>
              <label className="hotel-settings-mini-label">
                To Minutes Late
              </label>

              <NumberInput
                value={
                  rule
                    .to_minutes_after_checkout ??
                  0
                }
                min={0}
                step="1"
                onChange={(
                  nextValue
                ) =>
                  update(
                    index,
                    {
                      ...rule,

                      to_minutes_after_checkout:
                        nextValue,
                    }
                  )
                }
                disabled={
                  disabled
                }
              />
            </div>

            <ChargeRule
              value={
                rule.charge
              }
              onChange={(
                charge
              ) =>
                update(
                  index,
                  {
                    ...rule,
                    charge,
                  }
                )
              }
              capabilities={
                capabilities
              }
              disabled={disabled}
            />

            <button
              type="button"
              className="hotel-settings-icon-button is-danger"
              onClick={() =>
                onChange(
                  rules.filter(
                    (
                      _,
                      ruleIndex
                    ) =>
                      ruleIndex !==
                      index
                  )
                )
              }
              disabled={disabled}
            >
              ×
            </button>
          </div>
        )
      )}

      <button
        type="button"
        className="hotel-settings-secondary-button"
        onClick={() =>
          onChange([
            ...rules,

            {
              from_minutes_after_checkout:
                30,

              to_minutes_after_checkout:
                null,

              charge: {
                method:
                  "manual",

                value: 0,
              },
            },
          ])
        }
        disabled={disabled}
      >
        + Add Late Checkout Rule
      </button>
    </div>
  );
}

function ChildAgeRules({
  value,
  onChange,
  disabled,
  adultAgeFrom,
  extraBedEnabled,
}) {
  const rawRules =
    Array.isArray(value)
      ? value
      : [];


  const adultAge =
    Math.max(
      1,
      Number(
        adultAgeFrom
      ) || 18
    );


  const maximumChildAge =
    adultAge - 1;


  /*
   * Child slabs are kept continuous automatically.
   *
   * Example:
   * 0-5
   * 6-11
   * 12-17
   *
   * Admin chooses only the ending age.
   * HMS calculates the starting age.
   */
  const normalizeRules = (
    sourceRules
  ) => {
    let nextMinimumAge =
      0;


    const normalized =
      [];


    for (
      const sourceRule of
        sourceRules
    ) {
      if (
        nextMinimumAge >
        maximumChildAge
      ) {
        break;
      }


      const sourceMaximum =
        Number(
          sourceRule
            ?.max_age
        );


      const maximumAge =
        Math.min(
          maximumChildAge,

          Math.max(
            nextMinimumAge,

            Number.isFinite(
              sourceMaximum
            )
              ? sourceMaximum
              : nextMinimumAge
          )
        );


      normalized.push({
        ...sourceRule,

        min_age:
          nextMinimumAge,

        max_age:
          maximumAge,

        charge:
          sourceRule?.charge ||
          {
            method:
              "none",

            value: 0,
          },

        bed_policy:
          sourceRule
            ?.bed_policy ||
          "share_existing_bed",
      });


      nextMinimumAge =
        maximumAge + 1;
    }


    return normalized;
  };


  const rules =
    useMemo(
      () =>
        normalizeRules(
          rawRules
        ),
      [
        rawRules,
        maximumChildAge,
      ]
    );


  /*
   * Repair old overlapping test data automatically.
   *
   * Example old data:
   * 0-5, 3-11, 8-17
   *
   * becomes:
   * 0-5, 6-11, 12-17
   */
  useEffect(() => {
    if (
      !equal(
        rawRules,
        rules
      )
    ) {
      onChange(
        rules
      );
    }
  }, [
    rawRules,
    rules,
    onChange,
  ]);


  const updateRule = (
    index,
    nextRule
  ) => {
    const nextRules =
      rules.map(
        (
          rule,
          ruleIndex
        ) =>
          ruleIndex ===
          index
            ? nextRule
            : rule
      );


    onChange(
      normalizeRules(
        nextRules
      )
    );
  };


  const removeRule = (
    index
  ) => {
    const remaining =
      rules.filter(
        (
          _,
          ruleIndex
        ) =>
          ruleIndex !==
          index
      );


    onChange(
      normalizeRules(
        remaining
      )
    );
  };


  const lastRule =
    rules[
      rules.length - 1
    ];


  const nextMinimumAge =
    lastRule
      ? Number(
          lastRule.max_age
        ) + 1
      : 0;


  const canAddRule =
    nextMinimumAge <=
    maximumChildAge;


  const addRule = () => {
    if (!canAddRule) {
      return;
    }


    const maxAge =
      Math.min(
        nextMinimumAge +
          5,

        maximumChildAge
      );


    onChange([
      ...rules,

      {
        min_age:
          nextMinimumAge,

        max_age:
          maxAge,

        charge: {
          method:
            "none",

          value: 0,
        },

        bed_policy:
          "share_existing_bed",
      },
    ]);
  };


  return (
    <div className="hotel-settings-list-editor">

      {!rules.length && (
        <div className="hotel-settings-empty-inline">
          No child pricing rules configured. Children below the adult age will have no automatic child surcharge unless an extra bed is used.
        </div>
      )}


      {rules.map(
        (
          rule,
          index
        ) => {
          const charge =
            rule.charge || {
              method:
                "none",

              value: 0,
            };


          const chargeNeedsValue =
            [
              "fixed_amount",
              "percentage",
            ].includes(
              charge.method
            );


          const fromAge =
            Number(
              rule.min_age
            ) || 0;


          /*
           * Each remaining rule needs at least
           * one age value.
           *
           * This prevents an earlier slab from
           * swallowing later slabs.
           */
          const remainingRules =
            rules.length -
            index -
            1;


          const maximumAllowedEnd =
            maximumChildAge -
            remainingRules;


          const toAgeOptions =
            Array.from(
              {
                length:
                  maximumAllowedEnd -
                  fromAge +
                  1,
              },

              (
                _,
                offset
              ) =>
                fromAge +
                offset
            );


          return (
            <div
              className="hotel-settings-rule-row hotel-settings-child-rule-row"
              key={index}
            >

              <strong>
                Age {
                  fromAge
                }–{
                  rule.max_age
                }
              </strong>


              <div>
                <label className="hotel-settings-mini-label">
                  From Age
                </label>

                <input
                  className="hotel-settings-input"
                  value={
                    fromAge
                  }
                  readOnly
                  title="Calculated automatically from the previous child age rule."
                />
              </div>


              <div>
                <label className="hotel-settings-mini-label">
                  To Age
                </label>

                <select
                  className="hotel-settings-select"
                  value={
                    rule.max_age
                  }
                  onChange={(event) =>
                    updateRule(
                      index,
                      {
                        ...rule,

                        max_age:
                          Number(
                            event
                              .target
                              .value
                          ),
                      }
                    )
                  }
                  disabled={
                    disabled
                  }
                >
                  {toAgeOptions.map(
                    (age) => (
                      <option
                        key={age}
                        value={age}
                      >
                        {age}
                      </option>
                    )
                  )}
                </select>
              </div>


              <div className="hotel-settings-child-rule-control">
                <label className="hotel-settings-mini-label">
                  Child Charge
                </label>

                <select
                  className="hotel-settings-select"
                  value={
                    charge.method ||
                    "none"
                  }
                  onChange={(event) =>
                    updateRule(
                      index,
                      {
                        ...rule,

                        charge: {
                          method:
                            event.target
                              .value,

                          value: 0,
                        },
                      }
                    )
                  }
                  disabled={
                    disabled
                  }
                >
                  {CHILD_CHARGE_OPTIONS.map(
                    ([
                      optionValue,
                      text,
                    ]) => (
                      <option
                        key={optionValue}
                        value={optionValue}
                      >
                        {text}
                      </option>
                    )
                  )}
                </select>
              </div>


              {chargeNeedsValue && (
                <div className="hotel-settings-child-rule-control">
                  <label className="hotel-settings-mini-label">
                    {charge.method ===
                    "percentage"
                      ? "Percentage"
                      : "Amount"}
                  </label>

                  <NumberInput
                    value={
                      charge.value
                    }
                    min={0}
                    max={
                      charge.method ===
                      "percentage"
                        ? 100
                        : undefined
                    }
                    step="0.01"
                    onChange={(
                      nextValue
                    ) =>
                      updateRule(
                        index,
                        {
                          ...rule,

                          charge: {
                            ...charge,

                            value:
                              nextValue,
                          },
                        }
                      )
                    }
                    disabled={
                      disabled
                    }
                  />
                </div>
              )}


              {extraBedEnabled && (
                <div className="hotel-settings-child-rule-control">
                  <label className="hotel-settings-mini-label">
                    Bed Requirement
                  </label>

                  <select
                    className="hotel-settings-select"
                    value={
                      CHILD_BED_OPTIONS.some(
                        ([
                          optionValue,
                        ]) =>
                          optionValue ===
                          rule.bed_policy
                      )
                        ? rule.bed_policy
                        : "share_existing_bed"
                    }
                    onChange={(event) =>
                      updateRule(
                        index,
                        {
                          ...rule,

                          bed_policy:
                            event.target
                              .value,
                        }
                      )
                    }
                    disabled={
                      disabled
                    }
                  >
                    {CHILD_BED_OPTIONS.map(
                      ([
                        optionValue,
                        text,
                      ]) => (
                        <option
                          key={
                            optionValue
                          }
                          value={
                            optionValue
                          }
                        >
                          {text}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}


              <button
                type="button"
                className="hotel-settings-icon-button is-danger"
                onClick={() =>
                  removeRule(
                    index
                  )
                }
                disabled={
                  disabled
                }
                aria-label={`Remove child age rule ${index + 1}`}
              >
                ×
              </button>

            </div>
          );
        }
      )}


      <button
        type="button"
        className="hotel-settings-secondary-button"
        onClick={
          addRule
        }
        disabled={
          disabled ||
          !canAddRule
        }
      >
        {canAddRule
          ? "+ Add Child Age Rule"
          : "All Child Ages Covered"}
      </button>

    </div>
  );
}

function DiscountPresets({
  value,
  onChange,
  disabled,
}) {
  const presets =
    Array.isArray(value)
      ? value
      : [];

  const update = (
    index,
    next
  ) => {
    onChange(
      presets.map(
        (
          preset,
          presetIndex
        ) =>
          presetIndex ===
          index
            ? next
            : preset
      )
    );
  };

  return (
    <div className="hotel-settings-list-editor">
      {!presets.length && (
        <div className="hotel-settings-empty-inline">
          No quick discount presets configured.
        </div>
      )}

      {presets.map(
        (
          preset,
          index
        ) => (
          <div
            className="hotel-settings-preset-row"
            key={index}
          >
            <input
              className="hotel-settings-input"
              placeholder="Preset name"
              value={
                preset.name ||
                ""
              }
              onChange={(event) =>
                update(
                  index,
                  {
                    ...preset,

                    name:
                      event.target
                        .value,
                  }
                )
              }
              disabled={disabled}
            />

            <select
              className="hotel-settings-select"
              value={
                preset.method ||
                "percentage"
              }
              onChange={(event) =>
                update(
                  index,
                  {
                    ...preset,

                    method:
                      event.target
                        .value,
                  }
                )
              }
              disabled={disabled}
            >
              <option value="percentage">
                Percentage
              </option>

              <option value="fixed_amount">
                Fixed Amount
              </option>
            </select>

            <NumberInput
              value={
                preset.value ??
                0
              }
              min={0}
              step="0.01"
              onChange={(
                nextValue
              ) =>
                update(
                  index,
                  {
                    ...preset,

                    value:
                      nextValue,
                  }
                )
              }
              disabled={
                disabled
              }
            />

            <button
              type="button"
              className="hotel-settings-icon-button is-danger"
              onClick={() =>
                onChange(
                  presets.filter(
                    (
                      _,
                      presetIndex
                    ) =>
                      presetIndex !==
                      index
                  )
                )
              }
              disabled={disabled}
            >
              ×
            </button>
          </div>
        )
      )}

      <button
        type="button"
        className="hotel-settings-secondary-button"
        onClick={() =>
          onChange([
            ...presets,

            {
              name: "",
              method:
                "percentage",
              value: 0,
            },
          ])
        }
        disabled={disabled}
      >
        + Add Discount Preset
      </button>
    </div>
  );
}

function Control({
  section,
  settingKey,
  value,
  dataType,
  onChange,
  capabilities,
  disabled,
  sectionValues,
  dayUseEnabled,
}) {
  const id =
    `${section}.${settingKey}`;

  if (
    id ===
    "cancellation.rules"
  ) {
    return (
      <CancellationRules
        value={value}
        onChange={onChange}
        capabilities={
          capabilities
        }
        disabled={disabled}
      />
    );
  }

  if (
    id ===
    "late_checkout.rules"
  ) {
    return (
      <LateRules
        value={value}
        onChange={onChange}
        capabilities={
          capabilities
        }
        disabled={disabled}
      />
    );
  }

  if (
    id ===
    "discount.presets"
  ) {
    return (
      <DiscountPresets
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (
    id ===
    "day_use.pricing_slabs"
  ) {
    return (
      <DayUsePricingSlabs
        value={
          value
        }
        pricingMode={
          sectionValues
            ?.pricing_mode
        }
        maximumHours={
          sectionValues
            ?.maximum_day_use_hours
        }
        onChange={
          onChange
        }
        disabled={
          disabled
        }
      />
    );
  }

  if (
    id ===
    "guest_requirements.child_age_rules"
  ) {
    return (
      <ChildAgeRules
        value={value}
        onChange={
          onChange
        }
        disabled={
          disabled
        }
        adultAgeFrom={
          sectionValues
            ?.adult_age_from
        }
        extraBedEnabled={
          sectionValues
            ?.extra_bed_enabled ===
          true
        }
      />
    );
  }

  if (
    id ===
    "checkin_checkout.early_checkin_charge_rule"
  ) {
    return (
      <EarlyCheckinChargeRule
        value={
          value
        }
        onChange={
          onChange
        }
        disabled={
          disabled
        }
      />
    );
  }

  const chargeKeys =
    new Set([
      "cancellation.same_day_rule",
      "cancellation.hotel_cancellation_rule",
      "no_show.charge_rule",
      "early_checkout.charge_rule",
      "early_checkout.same_day_rule",
      "payment.advance_requirement",
    ]);

  if (
    chargeKeys.has(id)
  ) {
    return (
      <ChargeRule
        value={value}
        onChange={onChange}
        capabilities={
          capabilities
        }
        disabled={disabled}
        allowedMethods={
          id ===
          "payment.advance_requirement"
            ? [
                "none",
                "fixed_amount",
                "percentage",
                "manual",
              ]
            : null
        }
      />
    );
  }

  const priceKeys = [
    "hotel_fault_upgrade_pricing",
    "hotel_fault_downgrade_pricing",
    "hotel_fault_same_rate_pricing",
    "if_guest_stays_in_replacement_room",
    "guest_request_upgrade_pricing",
    "guest_request_downgrade_pricing",
  ];

  if (
    section ===
      "room_change" &&
    priceKeys.includes(
      settingKey
    )
  ) {
    return (
      <PriceRule
        value={value}
        onChange={onChange}
        capabilities={
          capabilities
        }
        disabled={disabled}
      />
    );
  }

  if (
    id ===
    "regional.timezone"
  ) {
    return (
      <Select
        value={value}
        options={
          TIMEZONE_OPTIONS
        }
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (
    id ===
    "regional.currency"
  ) {
    return (
      <Select
        value={value}
        options={
          CURRENCY_OPTIONS
        }
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (
    id ===
    "vip.allowed_billing_modes"
  ) {
    return (
      <MultiSelect
        value={value}
        options={(
          capabilities
            .vipBillingModes ||
          []
        ).map(
          (option) => [
            option,
            humanize(option),
          ]
        )}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (
    ARRAY_OPTIONS[id]
  ) {
    return (
      <MultiSelect
        value={value}
        options={
          ARRAY_OPTIONS[id]
        }
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (
    id ===
    "early_checkout.refund_handling"
  ) {
    return (
      <Select
        value={value}
        options={(
          capabilities
            .refundHandlingOptions ||
          []
        ).map(
          (option) => [
            option,
            humanize(option),
          ]
        )}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (
    id ===
    "vip.default_billing_mode"
  ) {
    return (
      <Select
        value={value}
        options={(
          capabilities
            .vipBillingModes ||
          []
        ).map(
          (option) => [
            option,
            humanize(option),
          ]
        )}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (
    id ===
      "day_use.hourly_rate_value"
  ) {
    const isPercentage =
      sectionValues
        ?.hourly_rate_type ===
      "percentage_of_night";


    return (
      <div>
        <label className="hotel-settings-mini-label">
          {isPercentage
            ? "% Of Room Rate Per Hour"
            : "Amount Per Hour"}
        </label>

        <NumberInput
          value={value}
          min={0}
          max={
            isPercentage
              ? 100
              : undefined
          }
          step="0.01"
          onChange={
            onChange
          }
          disabled={
            disabled
          }
        />
      </div>
    );
  }

  if (
    id ===
    "checkin_checkout.very_early_arrival_action"
  ) {
    const options = [
      [
        "manual",
        "Admin Decides",
      ],

      [
        "previous_night",
        "Treat As Previous Night",
      ],
    ];


    if (
      dayUseEnabled
    ) {
      options.push([
        "day_use",
        "Use Day Use Policy",
      ]);
    }


    return (
      <Select
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (
    STATIC_SELECTS[id]
  ) {
    return (
      <Select
        value={value}
        options={
          STATIC_SELECTS[id]
        }
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (
    dataType ===
    "boolean"
  ) {
    return (
      <Toggle
        value={
          Boolean(value)
        }
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (
    dataType ===
    "number"
  ) {
    return (
      <NumberInput
        value={value}
        onChange={
          onChange
        }
        min={0}
        step="0.01"
        disabled={
          disabled
        }
      />
    );
  }

  if (
    dataType ===
    "time"
  ) {
    return (
      <input
        className="hotel-settings-input"
        type="time"
        value={value || ""}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        disabled={disabled}
      />
    );
  }

  return (
    <input
      className="hotel-settings-input"
      value={value ?? ""}
      onChange={(event) =>
        onChange(
          event.target.value
        )
      }
      disabled={disabled}
    />
  );
}

export default Control;
