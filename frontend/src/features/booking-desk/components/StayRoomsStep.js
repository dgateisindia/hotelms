import React, {
  useEffect,
  useState,
} from "react";

import {
  IcoCalendar,
  IcoTrash,
} from "../../../utils/icons/BookingIcons";

import { formatCurrency } from "../../../shared/utils/money";


/* ============================================================
   DAY USE HELPERS
============================================================ */

function getDatePart(
  value
) {
  const text =
    String(
      value || ""
    );


  return /^\d{4}-\d{2}-\d{2}/
    .test(text)
      ? text.slice(
          0,
          10
        )
      : "";
}


function getTimePart(
  value
) {
  const match =
    /[ T](\d{2}):(\d{2})/
      .exec(
        String(
          value || ""
        )
      );


  return match
    ? `${match[1]}:${match[2]}`
    : "";
}


function buildDateTime(
  date,
  time
) {
  if (
    !date ||
    !time
  ) {
    return "";
  }


  return (
    `${date}T${time}:00`
  );
}


function formatDuration(
  minutes
) {
  const total =
    Number(
      minutes || 0
    );


  if (
    !Number.isFinite(
      total
    ) ||
    total <= 0
  ) {
    return "—";
  }


  const hours =
    Math.floor(
      total / 60
    );


  const remaining =
    Math.round(
      total % 60
    );


  if (
    remaining === 0
  ) {
    return `${hours} hr${
      hours === 1
        ? ""
        : "s"
    }`;
  }


  return (
    `${hours} hr${
      hours === 1
        ? ""
        : "s"
    } ${remaining} min`
  );
}

/* ============================================================
   GUEST & OCCUPANCY HELPERS
============================================================ */

function getChildAgeRule(
  policy,
  value
) {
  const age =
    Number(
      value
    );


  if (
    !Number.isInteger(
      age
    ) ||
    age < 0
  ) {
    return null;
  }


  const rules =
    Array.isArray(
      policy?.child_age_rules
    )
      ? policy.child_age_rules
      : [];


  return (
    rules.find(
      (rule) =>
        age >=
          Number(
            rule.min_age
          ) &&
        age <=
          Number(
            rule.max_age
          )
    ) ||
    null
  );
}


function formatChildChargePolicy(
  rule
) {
  const charge =
    rule?.charge ||
    {};


  if (
    charge.method ===
    "fixed_amount"
  ) {
    return `${formatCurrency(
      Number(
        charge.value ||
        0
      )
    )} / night`;
  }


  if (
    charge.method ===
    "percentage"
  ) {
    return `${Number(
      charge.value ||
      0
    )}% of room rate / night`;
  }


  return "No child occupancy charge";
}


function formatChildBedPolicy(
  value
) {
  if (
    value ===
    "extra_bed_required"
  ) {
    return "Extra bed required";
  }


  if (
    value ===
    "extra_bed_optional"
  ) {
    return "Extra bed optional";
  }


  return "Share existing bed";
}


function guestCountForRoom(
  room
) {
  if (
    room?.roster_captured ===
    true
  ) {
    return (
      (
        room
          .primary_guest_staying ===
        true
          ? 1
          : 0
      ) +
      (
        Array.isArray(
          room.guests
        )
          ? room.guests.length
          : 0
      )
    );
  }


  return Number(
    room?.total_guests ||
    0
  );
}


function guestUsesExtraBed(
  guest,
  policy
) {
  if (!guest) {
    return false;
  }


  if (
    guest.guest_type !==
    "child"
  ) {
    return (
      guest.extra_bed_used ===
      true
    );
  }


  const rule =
    getChildAgeRule(
      policy,
      guest.age
    );


  if (
    rule?.bed_policy ===
    "extra_bed_required"
  ) {
    return true;
  }


  if (
    rule?.bed_policy ===
    "share_existing_bed"
  ) {
    return false;
  }


  return (
    guest.extra_bed_used ===
    true
  );
}


function getRoomExtraBedUsage(
  room,
  policy
) {
  const guests =
    Array.isArray(
      room?.guests
    )
      ? room.guests
      : [];


  return guests.reduce(
    (
      total,
      guest
    ) =>
      total +
      (
        guestUsesExtraBed(
          guest,
          policy
        )
          ? 1
          : 0
      ),
    0
  );
}

const LEGACY_ALLOWED_ID_PROOF_TYPES = [
  "Aadhaar",
  "Passport",
  "Driving Licence",
  "Voter ID",
  "Other",
];

function getIdProofNumberPlaceholder(
  type
) {
  switch (type) {
    case "Aadhaar":
      return "12-digit Aadhaar number";

    case "Passport":
      return "Passport number";

    case "Driving Licence":
      return "Driving Licence number";

    case "Voter ID":
      return "Voter ID number";

    case "Other":
      return "ID proof number";

    default:
      return "Select ID proof type first";
  }
}

/* ============================================================
   COMPONENT
============================================================ */

function StayRoomsStep({
  booking,
  isEditMode,
  today,
  nights,
  updateBooking,

  stayTypeLocked,

  selectedRooms,
  availableRooms,
  roomsLoading,
  roomsError,

  isRoomSelected,
  addRoom,
  removeRoom,
  updateRoomTiming,
  updateRoomGuests,

  guestRequirementsPolicy,
  primaryGuestName,
  isAddRoomMode,
  groupPrimaryGuestAllocated,
  editPrimaryGuestAllocatedElsewhere,

  updateRoomPrimaryGuest,
  addAccompanyingGuest,
  removeAccompanyingGuest,
  updateAccompanyingGuest,

  roomTotals,

  dayUseEnabled,
  dayUsePolicy,
  policyLoading,
  policyError,

  dayUseDurationMinutes,

  pricingQuote,
  quoteLoading,
  quoteError,
}) {
  const isDayUse =
    booking.stay_type ===
    "day_use";

  const guestPolicy =
    guestRequirementsPolicy ||
    {};

  const policyIdProofTypes =
    guestPolicy
      .allowed_id_proof_types;

  const allowedIdProofTypes =
    policyIdProofTypes === undefined ||
    policyIdProofTypes === null
      ? LEGACY_ALLOWED_ID_PROOF_TYPES
      : Array.isArray(
          policyIdProofTypes
        )
        ? policyIdProofTypes
        : [];


  const allGuestNamesRequired =
    guestPolicy
      .all_guest_names_required ===
    true;


  const childAgeRequired =
    guestPolicy
      .child_age_required ===
    true;


  const otherAdultIdRequired =
    guestPolicy
      .other_adult_id_required ===
    true;


  const childIdRequired =
    guestPolicy
      .child_id_required ===
    true;


  const extraBedEnabled =
    guestPolicy
      .extra_bed_enabled ===
    true;


  const adultAgeFrom =
    Number(
      guestPolicy
        .adult_age_from ||
      18
    );


  const adultExtraBedRate =
    Number(
      guestPolicy
        .adult_extra_bed_charge_per_night ||
      0
    );


  const childExtraBedRate =
    Number(
      guestPolicy
        .child_extra_bed_charge_per_night ||
      0
    );

  /*
   * Local UI values are used so selecting only
   * the Day Use date does not accidentally create
   * a fake midnight booking.
   */
  const [
    dayUseDate,
    setDayUseDate,
  ] = useState("");


  const [
    dayUseCheckInTime,
    setDayUseCheckInTime,
  ] = useState("");


  const [
    dayUseCheckOutTime,
    setDayUseCheckOutTime,
  ] = useState("");


  /* ==========================================================
     SYNC DAY USE UI FROM BOOKING

     Important for:
     - returning to Step 2
     - future Day Use edit mode
  ========================================================== */

  useEffect(() => {
    if (
      !isDayUse
    ) {
      return;
    }


    setDayUseDate(
      getDatePart(
        booking.check_in
      ) ||
      getDatePart(
        booking.check_out
      )
    );


    setDayUseCheckInTime(
      getTimePart(
        booking.check_in
      )
    );


    setDayUseCheckOutTime(
      getTimePart(
        booking.check_out
      )
    );
  }, [
    isDayUse,
    booking.check_in,
    booking.check_out,
  ]);


  /* ==========================================================
     DAY USE INPUT HANDLERS
  ========================================================== */

  function applyDayUseValues(
    date,
    checkInTime,
    checkOutTime
  ) {
    updateBooking(
      "check_in",
      buildDateTime(
        date,
        checkInTime
      )
    );


    updateBooking(
      "check_out",
      buildDateTime(
        date,
        checkOutTime
      )
    );
  }


  function changeDayUseDate(
    value
  ) {
    setDayUseDate(
      value
    );


    applyDayUseValues(
      value,
      dayUseCheckInTime,
      dayUseCheckOutTime
    );
  }


  function changeDayUseCheckInTime(
    value
  ) {
    setDayUseCheckInTime(
      value
    );


    applyDayUseValues(
      dayUseDate,
      value,
      dayUseCheckOutTime
    );
  }


  function changeDayUseCheckOutTime(
    value
  ) {
    setDayUseCheckOutTime(
      value
    );


    applyDayUseValues(
      dayUseDate,
      dayUseCheckInTime,
      value
    );
  }


  const durationLabel =
    formatDuration(
      dayUseDurationMinutes
    );


  const quoteTotal =
    Number(
      pricingQuote
        ?.total_amount ||
      0
    );

  const editPreviousTotal =
    Number(
      pricingQuote
        ?.previous_total_amount ||
      0
    );


  const editUpdatedTotal =
    Number(
      pricingQuote
        ?.total_amount ||
      0
    );


  const editDifference =
    Number(
      pricingQuote
        ?.difference_amount ||
      0
    );


  const editAmountPaid =
    Number(
      pricingQuote
        ?.amount_paid ||
      0
    );


  const editBalanceDue =
    Number(
      pricingQuote
        ?.outstanding_amount ||
      0
    );


  const editPaymentConflict =
    pricingQuote
      ?.payment_conflict ===
    true;


  const editRefundRequired =
    Math.max(
      0,
      Number(
        (
          editAmountPaid -
          editUpdatedTotal
        ).toFixed(2)
      )
    );


  const editQuoteReady =
    isEditMode &&
    pricingQuote &&
    selectedRooms.length === 1 &&
    Number(
      pricingQuote.room_id
    ) ===
      Number(
        selectedRooms[0]
          ?.room_id
      );


  return (
    <div className="booking-desk-section">

      <div className="booking-desk-section__header">

        <div>

          <span className="booking-desk-eyebrow">
            Step 2
          </span>

          <h2>
            Stay & Rooms
          </h2>

          <p>
            Choose the planned stay and select rooms
            that are genuinely available.
          </p>

        </div>

      </div>


      {/* ======================================================
          STAY TYPE
      ====================================================== */}

      <div className="booking-desk-field">

        <label htmlFor="booking-stay-type">
          Stay Type
          <span>*</span>
        </label>

        <select
          id="booking-stay-type"
          value={
            booking.stay_type
          }
          disabled={
            isEditMode ||
            stayTypeLocked ||
            policyLoading
          }
          onChange={(
            event
          ) =>
            updateBooking(
              "stay_type",
              event.target.value
            )
          }
        >
          <option value="overnight">
            Overnight Stay
          </option>

          {(
            dayUseEnabled ||
            booking.stay_type ===
              "day_use"
          ) && (
            <option value="day_use">
              Day Use / Short Stay
            </option>
          )}
        </select>

        {stayTypeLocked ? (
          <small>
            Stay type is inherited from the reservation group
            and cannot be changed while adding rooms.
          </small>
        ) : (
          <>
            {!isEditMode &&
              policyLoading && (
                <small>
                  Checking hotel stay policy...
                </small>
              )}

            {!isEditMode &&
              !policyLoading &&
              policyError && (
                <small>
                  {policyError}
                </small>
              )}

            {!isEditMode &&
              !policyLoading &&
              !policyError &&
              !dayUseEnabled && (
                <small>
                  Day Use / Short Stay is currently disabled
                  in Hotel Settings.
                </small>
              )}

            {!isEditMode &&
              isDayUse &&
              dayUseEnabled && (
                <small>
                  Day Use pricing is calculated automatically
                  from the hotel policy.
                </small>
              )}
          </>
        )}

      </div>


      {/* ======================================================
          OVERNIGHT STAY
      ====================================================== */}

      {!isDayUse && (
        <div className="booking-desk-stay-grid">


          <div className="booking-desk-field">

            <label htmlFor="booking-check-in">
              Check In
              <span>*</span>
            </label>

            <div className="booking-desk-input-icon">

              <IcoCalendar />

              <input
                id="booking-check-in"
                type="date"
                min={
                  isEditMode
                    ? undefined
                    : today
                }
                value={
                  booking.check_in
                }
                onChange={(
                  event
                ) =>
                  updateBooking(
                    "check_in",
                    event.target.value
                  )
                }
              />

            </div>

          </div>


          <div className="booking-desk-field">

            <label htmlFor="booking-check-out">
              Expected Check Out
              <span>*</span>
            </label>

            <div className="booking-desk-input-icon">

              <IcoCalendar />

              <input
                id="booking-check-out"
                type="date"
                min={
                  booking.check_in ||
                  today
                }
                value={
                  booking.check_out
                }
                onChange={(
                  event
                ) =>
                  updateBooking(
                    "check_out",
                    event.target.value
                  )
                }
              />

            </div>

          </div>


          <div className="booking-desk-stay-summary">

            <span>
              Total Nights
            </span>

            <strong>
              {nights}
            </strong>

          </div>

        </div>
      )}


      {/* ======================================================
          DAY USE / SHORT STAY
      ====================================================== */}

      {isDayUse && (
        <div className="booking-desk-stay-grid">


          <div className="booking-desk-field">

            <label htmlFor="day-use-date">
              Stay Date
              <span>*</span>
            </label>

            <div className="booking-desk-input-icon">

              <IcoCalendar />

              <input
                id="day-use-date"
                type="date"
                min={
                  isEditMode
                    ? undefined
                    : today
                }
                value={
                  dayUseDate
                }
                onChange={(
                  event
                ) =>
                  changeDayUseDate(
                    event.target.value
                  )
                }
              />

            </div>

          </div>


          <div className="booking-desk-field">

            <label htmlFor="day-use-check-in-time">
              Check-In Time
              <span>*</span>
            </label>

            <input
              id="day-use-check-in-time"
              type="time"
              value={
                dayUseCheckInTime
              }
              disabled={
                !dayUseDate
              }
              onChange={(
                event
              ) =>
                changeDayUseCheckInTime(
                  event.target.value
                )
              }
            />

          </div>


          <div className="booking-desk-field">

            <label htmlFor="day-use-check-out-time">
              Check-Out Time
              <span>*</span>
            </label>

            <input
              id="day-use-check-out-time"
              type="time"
              value={
                dayUseCheckOutTime
              }
              disabled={
                !dayUseDate
              }
              onChange={(
                event
              ) =>
                changeDayUseCheckOutTime(
                  event.target.value
                )
              }
            />

          </div>


          <div className="booking-desk-stay-summary">

            <span>
              Stay Duration
            </span>

            <strong>
              {durationLabel}
            </strong>

          </div>

        </div>
      )}


      {/* ======================================================
          DAY USE QUOTE STATUS
      ====================================================== */}

      {isDayUse &&
        !isEditMode &&
        selectedRooms.length >
          0 && (
          <div
            className={
              quoteError
                ? "booking-desk-room-state booking-desk-room-state--error"
                : "booking-desk-room-state"
            }
          >
            {quoteLoading
              ? "Calculating Day Use price..."
              : quoteError
                ? quoteError
                : pricingQuote
                  ? `Day Use price confirmed: ${formatCurrency(
                      quoteTotal
                    )}`
                  : "Select a valid Day Use time range to calculate the price."}
          </div>
        )}

      {/* ======================================================
          EDIT PRICE PREVIEW
      ====================================================== */}

      {isEditMode &&
        selectedRooms.length >
          0 && (
          <section className="booking-desk-review-card">

            <h3>
              Price Update
            </h3>


            {quoteLoading ? (
              <div>
                <span>
                  Status
                </span>

                <strong>
                  Recalculating...
                </strong>
              </div>
            ) : quoteError ? (
              <div>
                <span>
                  Pricing
                </span>

                <strong>
                  {quoteError}
                </strong>
              </div>
            ) : editQuoteReady ? (
              <>

                <div>
                  <span>
                    Previous Total
                  </span>

                  <strong>
                    {formatCurrency(
                      editPreviousTotal
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Updated Total
                  </span>

                  <strong>
                    {formatCurrency(
                      editUpdatedTotal
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    {editDifference > 0
                      ? "Additional Amount"
                      : editDifference < 0
                        ? "Reduction"
                        : "Price Change"}
                  </span>

                  <strong>
                    {editDifference > 0
                      ? `+${formatCurrency(
                          editDifference
                        )}`
                      : editDifference < 0
                        ? `-${formatCurrency(
                            Math.abs(
                              editDifference
                            )
                          )}`
                        : formatCurrency(
                            0
                          )}
                  </strong>
                </div>


                <div>
                  <span>
                    Already Paid
                  </span>

                  <strong>
                    {formatCurrency(
                      editAmountPaid
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Updated Balance Due
                  </span>

                  <strong>
                    {formatCurrency(
                      editBalanceDue
                    )}
                  </strong>
                </div>


                {editPaymentConflict && (
                  <div className="booking-desk-room-state booking-desk-room-state--error">

                    <div>
                      <strong>
                        Payment adjustment required
                      </strong>

                      <p>
                        The updated reservation total is lower than
                        the amount already paid.
                      </p>

                      <p>
                        <strong>
                          {formatCurrency(
                            editRefundRequired
                          )}
                        </strong>{" "}
                        must be refunded or adjusted before this
                        reservation can continue.
                      </p>
                    </div>

                  </div>
                )}

              </>
            ) : (
              <div>
                <span>
                  Pricing
                </span>

                <strong>
                  Waiting for a valid reservation price...
                </strong>
              </div>
            )}


            {editQuoteReady &&
              isDayUse && (
                <small>
                  Day Use pricing is recalculated using the
                  original booking-time hotel policy.
                </small>
              )}

          </section>
        )}


      {/* ======================================================
          AVAILABLE ROOMS HEADING
      ====================================================== */}

      <div className="booking-desk-room-heading">

        <div>

          <h3>
            Available Rooms
          </h3>

          <p>
            {isEditMode
              ? "Choose one available room for this reservation."
              : "Multiple rooms can be reserved in one transaction."}
          </p>

        </div>


        <span>
          {selectedRooms.length} selected
        </span>

      </div>


      {/* ======================================================
          AVAILABLE ROOMS STATE
      ====================================================== */}

      {!booking.check_in ||
      !booking.check_out ? (

        <div className="booking-desk-room-state">
          {isDayUse
            ? "Select the stay date, check-in time and check-out time to see available rooms."
            : "Select check-in and expected check-out dates to see available rooms."}
        </div>

      ) : roomsLoading ? (

        <div className="booking-desk-room-state">
          Checking room availability...
        </div>

      ) : roomsError ? (

        <div className="booking-desk-room-state booking-desk-room-state--error">
          {roomsError}
        </div>

      ) : availableRooms.length ===
        0 ? (

        <div className="booking-desk-room-state">
          No rooms are available for the selected stay.
        </div>

      ) : (

        <div className="booking-desk-room-grid">

          {availableRooms.map(
            (
              room
            ) => {
              const selected =
                isRoomSelected(
                  room.room_id
                );


              return (
                <article
                  key={
                    room.room_id
                  }
                  className={
                    selected
                      ? "booking-desk-room booking-desk-room--selected"
                      : "booking-desk-room"
                  }
                >

                  <div className="booking-desk-room__top">

                    <div>

                      <strong>
                        Room{" "}
                        {
                          room.room_number
                        }
                      </strong>

                      <span>
                        {
                          room.room_type
                        }
                      </span>

                    </div>


                    <span className="booking-desk-room__status">
                      Available
                    </span>

                  </div>


                  <div className="booking-desk-room__meta">

                    <span>
                      Floor{" "}
                      {
                        room.floor_number ??
                        "—"
                      }
                    </span>

                    <span>
                      Up to{" "}
                      {
                        room.capacity
                      }{" "}
                      guests
                    </span>

                    {extraBedEnabled && (
                      <span>
                        Up to{" "}
                        {Number(
                          room.max_extra_beds ??
                          0
                        )}{" "}
                        extra bed{
                          Number(
                            room.max_extra_beds ??
                            0
                          ) === 1
                            ? ""
                            : "s"
                        }
                      </span>
                    )}

                  </div>


                  <div className="booking-desk-room__price">

                    <strong>
                      {formatCurrency(
                        room.price_per_night
                      )}
                    </strong>

                    <span>
                      {isDayUse
                        ? " standard nightly rate"
                        : " / night"}
                    </span>

                  </div>


                  <button
                    type="button"
                    className={
                      selected
                        ? "booking-desk-room__button booking-desk-room__button--selected"
                        : "booking-desk-room__button"
                    }
                    onClick={() => {
                      if (
                        selected &&
                        !isEditMode
                      ) {
                        removeRoom(
                          room.room_id
                        );
                      } else {
                        addRoom(
                          room
                        );
                      }
                    }}
                  >
                    {selected
                      ? "Selected"
                      : isEditMode
                        ? "Choose Room"
                        : "Add Room"}
                  </button>

                </article>
              );
            }
          )}

        </div>
      )}


      {/* ======================================================
          SELECTED ROOMS & OCCUPANTS
      ====================================================== */}

      {selectedRooms.length >
        0 && (
        <div className="booking-desk-selected">

          <h3>
            Selected Rooms & Occupants
          </h3>


          {roomTotals.map(
            (
              room
            ) => {
              const rosterCaptured =
                room
                  .roster_captured ===
                true;


              const occupancyCount =
                guestCountForRoom(
                  room
                );


              const capacity =
                Number(
                  room.capacity ||
                  1
                );

              const maxExtraBeds =
                Math.max(
                  0,
                  Number(
                    room.max_extra_beds ??
                    0
                  )
                );


              const localExtraBedsUsed =
                getRoomExtraBedUsage(
                  room,
                  guestPolicy
                );


              const quotedExtraBedsUsed =
                room.extra_beds_used !==
                  null &&
                room.extra_beds_used !==
                  undefined
                  ? Number(
                      room.extra_beds_used
                    )
                  : null;


              const displayedExtraBedsUsed =
                Number.isFinite(
                  quotedExtraBedsUsed
                )
                  ? quotedExtraBedsUsed
                  : localExtraBedsUsed;


              const extraBedLimitReached =
                localExtraBedsUsed >=
                maxExtraBeds;


              const extraBedLimitExceeded =
                localExtraBedsUsed >
                maxExtraBeds;


              const canAddGuest =
                occupancyCount <
                capacity;


              const primaryLocked =
                (
                  isAddRoomMode &&
                  groupPrimaryGuestAllocated
                ) ||
                (
                  isEditMode &&
                  editPrimaryGuestAllocatedElsewhere &&
                  room.primary_guest_staying !== true
                );


              const accompanyingGuests =
                Array.isArray(
                  room.guests
                )
                  ? room.guests
                  : [];


              const childCharge =
                Number(
                  room
                    .child_charge_amount ||
                  0
                );


              const extraBedCharge =
                Number(
                  room
                    .extra_bed_charge_amount ||
                  0
                );


              const guestCharge =
                Number(
                  room
                    .guest_charge_amount ||
                  0
                );


              return (
                <section
                  className="booking-desk-occupancy-card"
                  key={
                    room.room_id
                  }
                >

                  {/* ==========================================
                      ROOM HEADER
                  ========================================== */}

                  <div className="booking-desk-occupancy-card__header">

                    <div>

                      <strong>
                        Room{" "}
                        {
                          room.room_number
                        }
                      </strong>

                      <span>
                        {
                          room.room_type
                        }
                      </span>

                    </div>


                    <div className="booking-desk-occupancy-card__summary">

                      <span>
                        {occupancyCount} /{" "}
                        {capacity} guests
                      </span>

                      {extraBedEnabled && (
                        <span>
                          Extra Beds{" "}
                          {displayedExtraBedsUsed} /{" "}
                          {maxExtraBeds}
                        </span>
                      )}

                      <strong>
                        {quoteLoading
                          ? "Calculating..."
                          : formatCurrency(
                              room.total_amount
                            )}
                      </strong>

                    </div>


                    {!isEditMode && (
                      <button
                        type="button"
                        className="booking-desk-selected__remove"
                        aria-label={`Remove room ${room.room_number}`}
                        onClick={() =>
                          removeRoom(
                            room.room_id
                          )
                        }
                      >
                        <IcoTrash />
                      </button>
                    )}

                  </div>

                  {/* ==========================================
                      ROOM-SPECIFIC STAY TIMING
                  ========================================== */}

                  <div className="booking-desk-occupancy-primary">

                    <div
                      style={{
                        width: "100%",
                      }}
                    >

                      <div className="booking-desk-occupancy-guests__heading">

                        <div>
                          <strong>
                            Room Stay Timing
                          </strong>

                          <span>
                            Reservation timing is used as the default.
                            This room can have its own check-in and check-out.
                          </span>
                        </div>

                      </div>

                      <div className="booking-desk-occupant__grid">

                        <div className="booking-desk-field">

                          <label
                            htmlFor={`room-check-in-${room.room_id}`}
                          >
                            Check In
                          </label>

                          <div className="booking-desk-input-icon">

                            <IcoCalendar />

                            <input
                              id={`room-check-in-${room.room_id}`}
                              type={
                                isDayUse
                                  ? "datetime-local"
                                  : "date"
                              }
                              min={
                                !isEditMode &&
                                !isDayUse
                                  ? today
                                  : undefined
                              }
                              value={
                                room.check_in ||
                                booking.check_in ||
                                ""
                              }
                              onChange={(
                                event
                              ) =>
                                updateRoomTiming(
                                  room.room_id,
                                  "check_in",
                                  event.target.value
                                )
                              }
                            />

                          </div>

                        </div>


                        <div className="booking-desk-field">

                          <label
                            htmlFor={`room-check-out-${room.room_id}`}
                          >
                            Check Out
                          </label>

                          <div className="booking-desk-input-icon">

                            <IcoCalendar />

                            <input
                              id={`room-check-out-${room.room_id}`}
                              type={
                                isDayUse
                                  ? "datetime-local"
                                  : "date"
                              }
                              min={
                                room.check_in ||
                                booking.check_in ||
                                undefined
                              }
                              value={
                                room.check_out ||
                                booking.check_out ||
                                ""
                              }
                              onChange={(
                                event
                              ) =>
                                updateRoomTiming(
                                  room.room_id,
                                  "check_out",
                                  event.target.value
                                )
                              }
                            />

                          </div>

                        </div>

                      </div>

                    </div>

                  </div>

                  {extraBedEnabled &&
                    extraBedLimitExceeded && (
                      
                      <div className="booking-desk-room-state booking-desk-room-state--error">

                        Room{" "}
                        {room.room_number} allows
                        maximum{" "}
                        {maxExtraBeds} extra bed{
                          maxExtraBeds === 1
                            ? ""
                            : "s"
                        }.

                        The current guest allocation
                        requires{" "}
                        {localExtraBedsUsed}.

                      </div>
                    )}

                  {!rosterCaptured ? (

                    /* ========================================
                       LEGACY BOOKING
                    ======================================== */

                    <div className="booking-desk-occupancy-legacy">

                      <p>
                        Detailed occupant names were not recorded
                        when this reservation was originally created.
                        The existing guest count is preserved without
                        creating fake historical guest records.
                      </p>


                      <div className="booking-desk-selected__guests">

                        <label
                          htmlFor={`room-guests-${room.room_id}`}
                        >
                          Total Guests
                        </label>

                        <input
                          id={`room-guests-${room.room_id}`}
                          type="number"
                          min="1"
                          max={
                            capacity
                          }
                          value={
                            room.total_guests
                          }
                          onChange={(
                            event
                          ) =>
                            updateRoomGuests(
                              room.room_id,
                              event.target.value
                            )
                          }
                        />

                        <span>
                          max{" "}
                          {capacity}
                        </span>

                      </div>

                    </div>

                  ) : (

                    <>
                      {/* ======================================
                          PRIMARY GUEST
                      ====================================== */}

                      <div className="booking-desk-occupancy-primary">

                        <div>

                          <label className="booking-desk-occupancy-check">

                            <input
                              type="checkbox"
                              checked={
                                room
                                  .primary_guest_staying ===
                                true
                              }
                              disabled={
                                primaryLocked
                              }
                              onChange={(
                                event
                              ) =>
                                updateRoomPrimaryGuest(
                                  room.room_id,
                                  event.target.checked
                                )
                              }
                            />

                            <span>
                              Primary Guest stays in this room
                            </span>

                          </label>


                          {room
                            .primary_guest_staying ===
                            true && (
                            <strong>
                              {primaryGuestName ||
                                "Primary Guest"}
                            </strong>
                          )}

                        </div>


                        {isAddRoomMode &&
                          groupPrimaryGuestAllocated && (
                            <small>
                              Primary Guest is already allocated
                              to another room in this reservation.
                            </small>
                          )}


                        {isEditMode &&
                          editPrimaryGuestAllocatedElsewhere && (
                            <small>
                              Primary Guest belongs to another
                              room in this reservation group.
                            </small>
                          )}


                        {!isEditMode &&
                          !isAddRoomMode && (
                            <small>
                              A reservation group can have only
                              one Primary Guest allocation.
                            </small>
                          )}

                      </div>


                      {/* ======================================
                          ACCOMPANYING GUESTS
                      ====================================== */}

                      <div className="booking-desk-occupancy-guests">

                        <div className="booking-desk-occupancy-guests__heading">

                          <div>

                            <strong>
                              Accompanying Guests
                            </strong>

                            <span>
                              Adult / Child details are stored
                              against this room reservation.
                            </span>

                          </div>


                          <button
                            type="button"
                            className="booking-desk-btn booking-desk-btn--secondary"
                            disabled={
                              !canAddGuest
                            }
                            onClick={() =>
                              addAccompanyingGuest(
                                room.room_id
                              )
                            }
                          >
                            + Add Guest
                          </button>

                        </div>


                        {accompanyingGuests.length ===
                          0 ? (
                          <div className="booking-desk-room-state">
                            No accompanying guests in this room.
                          </div>
                        ) : (
                          accompanyingGuests.map(
                            (
                              occupant,
                              guestIndex
                            ) => {
                              const isChild =
                                occupant
                                  .guest_type ===
                                "child";


                              const childRule =
                                isChild
                                  ? getChildAgeRule(
                                      guestPolicy,
                                      occupant.age
                                    )
                                  : null;


                              const bedPolicy =
                                childRule
                                  ?.bed_policy ||
                                null;


                              const childRequiresExtraBed =
                                isChild &&
                                bedPolicy ===
                                  "extra_bed_required";


                              const childSharesExistingBed =
                                isChild &&
                                bedPolicy ===
                                  "share_existing_bed";

                              const occupantUsesExtraBed =
                                guestUsesExtraBed(
                                  occupant,
                                  guestPolicy
                                );


                              const optionalExtraBedBlocked =
                                !occupantUsesExtraBed &&
                                extraBedLimitReached;


                              const idRequired =
                                isChild
                                  ? childIdRequired
                                  : otherAdultIdRequired;


                              const showIdFields =
                                idRequired ||
                                Boolean(
                                  occupant
                                    .id_proof_type
                                ) ||
                                Boolean(
                                  occupant
                                    .id_proof_number
                                );


                              return (
                                <div
                                  className="booking-desk-occupant"
                                  key={
                                    occupant
                                      .booking_guest_id ||
                                    `${room.room_id}-${guestIndex}`
                                  }
                                >

                                  <div className="booking-desk-occupant__header">

                                    <strong>
                                      Guest{" "}
                                      {guestIndex +
                                        1}
                                    </strong>


                                    <button
                                      type="button"
                                      className="booking-desk-selected__remove"
                                      aria-label={`Remove guest ${guestIndex + 1}`}
                                      onClick={() =>
                                        removeAccompanyingGuest(
                                          room.room_id,
                                          guestIndex
                                        )
                                      }
                                    >
                                      <IcoTrash />
                                    </button>

                                  </div>


                                  <div className="booking-desk-occupant__grid">

                                    {/* ========================
                                        TYPE
                                    ======================== */}

                                    <div className="booking-desk-field">

                                      <label>
                                        Guest Type
                                        <span>*</span>
                                      </label>

                                      <select
                                        value={
                                          occupant
                                            .guest_type
                                        }
                                        onChange={(
                                          event
                                        ) => {
                                          const nextType =
                                            event
                                              .target
                                              .value;


                                          updateAccompanyingGuest(
                                            room.room_id,
                                            guestIndex,
                                            "guest_type",
                                            nextType
                                          );


                                          if (
                                            nextType ===
                                            "child"
                                          ) {
                                            updateAccompanyingGuest(
                                              room.room_id,
                                              guestIndex,
                                              "extra_bed_used",
                                              false
                                            );
                                          }
                                        }}
                                      >
                                        <option value="adult">
                                          Adult ({adultAgeFrom}+)
                                        </option>

                                        <option value="child">
                                          Child
                                        </option>
                                      </select>

                                    </div>


                                    {/* ========================
                                        NAME
                                    ======================== */}

                                    <div className="booking-desk-field">

                                      <label>
                                        Full Name

                                        {allGuestNamesRequired && (
                                          <span>*</span>
                                        )}
                                      </label>

                                      <input
                                        type="text"
                                        maxLength="150"
                                        value={
                                          occupant
                                            .full_name ||
                                          ""
                                        }
                                        placeholder={
                                          allGuestNamesRequired
                                            ? "Guest full name"
                                            : "Guest name (optional)"
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateAccompanyingGuest(
                                            room.room_id,
                                            guestIndex,
                                            "full_name",
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                      />

                                    </div>

                                    <div className="booking-desk-field">

                                      <label>
                                        Mobile Number
                                      </label>

                                      <input
                                        type="tel"
                                        maxLength="30"
                                        placeholder="Guest mobile number (optional)"
                                        value={
                                          occupant.phone ||
                                          ""
                                        }
                                        onChange={(event) =>
                                          updateAccompanyingGuest(
                                            room.room_id,
                                            guestIndex,
                                            "phone",
                                            event.target.value
                                          )
                                        }
                                      />

                                    </div>


                                    {/* ========================
                                        CHILD AGE
                                    ======================== */}

                                    {isChild &&
                                      childAgeRequired && (
                                        <div className="booking-desk-field">

                                          <label>
                                            Child Age
                                            <span>*</span>
                                          </label>

                                          <input
                                            type="number"
                                            min="0"
                                            max={
                                              Math.max(
                                                0,
                                                adultAgeFrom -
                                                  1
                                              )
                                            }
                                            step="1"
                                            value={
                                              occupant.age
                                            }
                                            onChange={(
                                              event
                                            ) => {
                                              const nextAge =
                                                event
                                                  .target
                                                  .value;


                                              updateAccompanyingGuest(
                                                room.room_id,
                                                guestIndex,
                                                "age",
                                                nextAge
                                              );


                                              const nextRule =
                                                getChildAgeRule(
                                                  guestPolicy,
                                                  nextAge
                                                );


                                              if (
                                                nextRule
                                                  ?.bed_policy ===
                                                "extra_bed_required"
                                              ) {
                                                updateAccompanyingGuest(
                                                  room.room_id,
                                                  guestIndex,
                                                  "extra_bed_used",
                                                  true
                                                );
                                              }


                                              if (
                                                nextRule
                                                  ?.bed_policy ===
                                                "share_existing_bed"
                                              ) {
                                                updateAccompanyingGuest(
                                                  room.room_id,
                                                  guestIndex,
                                                  "extra_bed_used",
                                                  false
                                                );
                                              }
                                            }}
                                          />

                                        </div>
                                      )}


                                    {/* ========================
                                        ID
                                    ======================== */}

                                    {showIdFields && (
                                      <>
                                        <div className="booking-desk-field">

                                          <label>
                                            ID Proof Type

                                            {idRequired && (
                                              <span>*</span>
                                            )}
                                          </label>

                                          <select
                                            value={
                                              occupant.id_proof_type ||
                                              ""
                                            }
                                            onChange={(event) => {
                                              const nextType =
                                                event.target.value;

                                              updateAccompanyingGuest(
                                                room.room_id,
                                                guestIndex,
                                                "id_proof_type",
                                                nextType
                                              );

                                              updateAccompanyingGuest(
                                                room.room_id,
                                                guestIndex,
                                                "id_proof_number",
                                                ""
                                              );
                                            }}
                                          >
                                            <option value="">
                                              Select ID proof type
                                            </option>

                                            {allowedIdProofTypes.map(
                                              (type) => (
                                                <option
                                                  key={type}
                                                  value={type}
                                                >
                                                  {type}
                                                </option>
                                              )
                                            )}
                                          </select>

                                        </div>


                                        <div className="booking-desk-field">

                                          <label>
                                            ID Proof Number

                                            {idRequired && (
                                              <span>*</span>
                                            )}
                                          </label>

                                          <input
                                            type="text"
                                            maxLength="100"
                                            value={
                                              occupant.id_proof_number ||
                                              ""
                                            }
                                            disabled={
                                              !occupant.id_proof_type
                                            }
                                            inputMode={
                                              occupant.id_proof_type ===
                                              "Aadhaar"
                                                ? "numeric"
                                                : "text"
                                            }
                                            placeholder={
                                              getIdProofNumberPlaceholder(
                                                occupant.id_proof_type
                                              )
                                            }
                                            onChange={(event) =>
                                              updateAccompanyingGuest(
                                                room.room_id,
                                                guestIndex,
                                                "id_proof_number",
                                                event.target.value
                                              )
                                            }
                                          />

                                        </div>
                                      </>
                                    )}

                                  </div>


                                  {/* ==========================
                                      CHILD POLICY INFO
                                  ========================== */}

                                  {isChild &&
                                    childAgeRequired && (
                                      <div className="booking-desk-occupant__policy">

                                        {!childRule ? (
                                          <span>
                                            Enter the child age to apply
                                            the correct occupancy and bed policy.
                                          </span>
                                        ) : (
                                          <>
                                            <span>
                                              Age{" "}
                                              {
                                                childRule.min_age
                                              }
                                              –
                                              {
                                                childRule.max_age
                                              }
                                            </span>

                                            <span>
                                              {formatChildChargePolicy(
                                                childRule
                                              )}
                                            </span>

                                            <span>
                                              {formatChildBedPolicy(
                                                childRule
                                                  .bed_policy
                                              )}
                                            </span>
                                          </>
                                        )}

                                      </div>
                                    )}


                                  {/* ==========================
                                      EXTRA BED
                                  ========================== */}

                                  {extraBedEnabled && (
                                    <div className="booking-desk-extra-bed">

                                      {isChild &&
                                      childAgeRequired &&
                                      !childRule ? (
                                        <small>
                                          Extra-bed selection becomes available
                                          after the child age is entered.
                                        </small>
                                      ) : childSharesExistingBed ? (
                                        <small>
                                          This child shares the existing bed
                                          under the hotel policy.
                                        </small>
                                      ) : (
                                        <label className="booking-desk-occupancy-check">

                                          <input
                                            type="checkbox"
                                            checked={
                                              childRequiresExtraBed
                                                ? true
                                                : occupant
                                                    .extra_bed_used ===
                                                  true
                                            }
                                            disabled={
                                              childRequiresExtraBed ||
                                              optionalExtraBedBlocked
                                            }
                                            onChange={(
                                              event
                                            ) =>
                                              updateAccompanyingGuest(
                                                room.room_id,
                                                guestIndex,
                                                "extra_bed_used",
                                                event
                                                  .target
                                                  .checked
                                              )
                                            }
                                          />

                                          <span>
                                            {childRequiresExtraBed
                                              ? "Extra bed required"
                                              : "Extra bed used"}
                                          </span>

                                        </label>
                                      )}

                                      {optionalExtraBedBlocked &&
                                        !childSharesExistingBed &&
                                        !(
                                          isChild &&
                                          childAgeRequired &&
                                          !childRule
                                        ) && (
                                          <small>
                                            Room extra-bed limit reached
                                            ({localExtraBedsUsed} / {maxExtraBeds}).
                                          </small>
                                        )}

                                      {!isChild && (
                                        <small>
                                          Adult extra bed:{" "}
                                          {formatCurrency(
                                            adultExtraBedRate
                                          )}{" "}
                                          / night when actually used.
                                        </small>
                                      )}


                                      {isChild &&
                                        childRule &&
                                        !childSharesExistingBed && (
                                          <small>
                                            Child extra bed:{" "}
                                            {formatCurrency(
                                              childExtraBedRate
                                            )}{" "}
                                            / night when applicable.
                                          </small>
                                        )}

                                    </div>
                                  )}

                                </div>
                              );
                            }
                          )
                        )}

                      </div>

                    </>
                  )}


                  {/* ==========================================
                      BACKEND PRICE BREAKDOWN
                  ========================================== */}

                  <div className="booking-desk-occupancy-price">

                    <div>

                      <span>
                        {isDayUse
                          ? dayUseDurationMinutes >
                            0
                            ? `Day Use · ${durationLabel}`
                            : "Day Use"
                          : `${nights} night${
                              nights ===
                              1
                                ? ""
                                : "s"
                            }`}
                      </span>

                    </div>


                    {!quoteLoading &&
                      Number(
                        room.room_charge ||
                        0
                      ) >
                        0 && (
                        <div>

                          <span>
                            Room Charge
                          </span>

                          <strong>
                            {formatCurrency(
                              room.room_charge
                            )}
                          </strong>

                        </div>
                      )}


                    {!quoteLoading &&
                      childCharge >
                        0 && (
                        <div>

                          <span>
                            Child Occupancy
                          </span>

                          <strong>
                            +{formatCurrency(
                              childCharge
                            )}
                          </strong>

                        </div>
                      )}


                    {!quoteLoading &&
                      extraBedCharge >
                        0 && (
                        <div>

                          <span>
                            Extra Bed
                          </span>

                          <strong>
                            +{formatCurrency(
                              extraBedCharge
                            )}
                          </strong>

                        </div>
                      )}


                    {!quoteLoading &&
                      guestCharge >
                        0 && (
                        <div>

                          <span>
                            Total Guest Charges
                          </span>

                          <strong>
                            {formatCurrency(
                              guestCharge
                            )}
                          </strong>

                        </div>
                      )}


                    <div className="booking-desk-occupancy-price__total">

                      <span>
                        Room Total
                      </span>

                      <strong>
                        {quoteLoading
                          ? "Calculating..."
                          : formatCurrency(
                              room.total_amount
                            )}
                      </strong>

                    </div>

                  </div>

                </section>
              );
            }
          )}

        </div>
      )}

    </div>
  );
}


export default StayRoomsStep;