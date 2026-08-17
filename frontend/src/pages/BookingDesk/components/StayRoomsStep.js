import React from "react";

import {
  IcoCalendar,
  IcoTrash,
} from "../../../utils/icons/BookingIcons";

import {
  formatCurrency,
} from "../bookingUtils";


function StayRoomsStep({
  booking,
  isEditMode,
  today,
  nights,
  updateBooking,

  selectedRooms,
  availableRooms,
  roomsLoading,
  roomsError,

  isRoomSelected,
  addRoom,
  removeRoom,
  updateRoomGuests,

  roomTotals,
}) {
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
            Choose the planned stay dates and select rooms
            that are genuinely available.
          </p>

        </div>

      </div>


      {/* ======================================================
          STAY DATES
      ====================================================== */}

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
          Select check-in and expected check-out dates to
          see available rooms.
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
          No rooms are available for the selected dates.
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
                      / night
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
                    {nights} night
                    {nights === 1
                      ? ""
                      : "s"}
                  </span>

                  <strong>
                    {formatCurrency(
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