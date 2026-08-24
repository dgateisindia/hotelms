import React, {
  useEffect,
  useState,
} from "react";

import {
  IcoCalendar,
  IcoTrash,
} from "../../../utils/icons/BookingIcons";

import {
  formatCurrency,
} from "../bookingUtils";


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
  updateRoomGuests,

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
          SELECTED ROOMS
      ====================================================== */}

      {selectedRooms.length >
        0 && (
        <div className="booking-desk-selected">

          <h3>
            Selected Rooms
          </h3>


          {roomTotals.map(
            (
              room
            ) => (
              <div
                className="booking-desk-selected__row"
                key={
                  room.room_id
                }
              >

                <div className="booking-desk-selected__room">

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


                <div className="booking-desk-selected__guests">

                  <label
                    htmlFor={`room-guests-${room.room_id}`}
                  >
                    Guests
                  </label>

                  <input
                    id={`room-guests-${room.room_id}`}
                    type="number"
                    min="1"
                    max={
                      room.capacity
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
                    {
                      room.capacity
                    }
                  </span>

                </div>


                <div className="booking-desk-selected__amount">

                  <span>
                    {isDayUse
                      ? (
                          dayUseDurationMinutes >
                          0
                            ? `Day Use · ${durationLabel}`
                            : "Day Use"
                        )
                      : `${nights} night${
                          nights === 1
                            ? ""
                            : "s"
                        }`}
                  </span>

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
            )
          )}

        </div>
      )}

    </div>
  );
}


export default StayRoomsStep;