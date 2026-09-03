import React, {
  useMemo,
  useState,
} from "react";

import apiClient from "../../../services/apiClient";

import AppAlert from "../../../components/common/AppAlert";


function normalizeValue(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}


function guestKey(
  bookingId,
  guestId
) {
  return `${Number(
    bookingId
  )}:${Number(
    guestId
  )}`;
}


function formatGuestType(
  guest
) {
  const type =
    normalizeValue(
      guest?.guest_type
    );

  const role =
    normalizeValue(
      guest?.guest_role
    );

  const typeLabel =
    type === "child"
      ? "Child"
      : "Adult";

  const roleLabel =
    role === "primary"
      ? "Primary"
      : "Accompanying";

  return `${typeLabel} · ${roleLabel}`;
}


function GroupCheckInDialog({
  group,
  onClose,
  onChanged,
  onManageRoom,
}) {
  const [
    selectedKeys,
    setSelectedKeys,
  ] = useState(
    []
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(
    false
  );

  const [
    error,
    setError,
  ] = useState(
    ""
  );

  const [
    success,
    setSuccess,
  ] = useState(
    ""
  );


  const bookings =
    useMemo(
      () =>
        Array.isArray(
          group?.bookings
        )
          ? group.bookings
          : [],
      [
        group,
      ]
    );


  const manageableBookings =
    useMemo(
      () =>
        bookings.filter(
          (booking) => {
            const status =
              normalizeValue(
                booking
                  ?.booking_status
              );

            return (
              status ===
                "confirmed" ||
              status ===
                "checked_in"
            );
          }
        ),
      [
        bookings,
      ]
    );


  const expectedEntries =
    useMemo(
      () =>
        manageableBookings.flatMap(
          (booking) => {
            const guests =
              Array.isArray(
                booking
                  ?.occupancy
                  ?.guests
              )
                ? booking
                    .occupancy
                    .guests
                : [];

            return guests
              .filter(
                (guest) =>
                  normalizeValue(
                    guest
                      ?.guest_status
                  ) ===
                  "expected"
              )
              .map(
                (guest) => ({
                  key:
                    guestKey(
                      booking
                        .booking_id,
                      guest
                        .booking_guest_id
                    ),

                  bookingId:
                    Number(
                      booking
                        .booking_id
                    ),

                  bookingCode:
                    booking
                      .booking_code,

                  roomNumber:
                    booking
                      .room_number,

                  guestId:
                    Number(
                      guest
                        .booking_guest_id
                    ),

                  guest,
                })
              );
          }
        ),
      [
        manageableBookings,
      ]
    );


  if (!group) {
    return null;
  }


  const selectedEntries =
    expectedEntries.filter(
      (entry) =>
        selectedKeys.includes(
          entry.key
        )
    );


  function toggleGuest(
    key
  ) {
    setError(
      ""
    );

    setSuccess(
      ""
    );

    setSelectedKeys(
      (current) =>
        current.includes(
          key
        )
          ? current.filter(
              (item) =>
                item !== key
            )
          : [
              ...current,
              key,
            ]
    );
  }


  function toggleAllExpected() {
    setError(
      ""
    );

    setSuccess(
      ""
    );

    if (
      selectedKeys.length ===
        expectedEntries.length &&
      expectedEntries.length >
        0
    ) {
      setSelectedKeys(
        []
      );

      return;
    }

    setSelectedKeys(
      expectedEntries.map(
        (entry) =>
          entry.key
      )
    );
  }


  async function checkInSelected() {
    if (
      selectedEntries.length ===
      0
    ) {
      setError(
        "Select at least one actually arrived expected guest."
      );

      return;
    }

    setSubmitting(
      true
    );

    setError(
      ""
    );

    setSuccess(
      ""
    );


    const succeeded =
      [];

    const failed =
      [];


    /*
     * Intentionally sequential.
     *
     * First arriving guest may activate the room.
     * Later guests of the same room then join the
     * already-active stay.
     *
     * Backend remains authoritative for:
     * - room readiness
     * - booking lifecycle
     * - capacity
     * - guest status
     * - room activation
     */
    for (
      const entry of
      selectedEntries
    ) {
      try {
        await apiClient.post(
          `/bookings/${entry.bookingId}/guests/check-in`,
          {
            booking_guest_id:
              entry.guestId,
          }
        );

        succeeded.push(
          entry
        );
      } catch (
        requestError
      ) {
        failed.push({
          ...entry,

          message:
            requestError
              ?.message ||
            "Guest check-in failed.",
        });
      }
    }


    if (
      succeeded.length >
      0
    ) {
      setSelectedKeys(
        (current) =>
          current.filter(
            (key) =>
              !succeeded.some(
                (entry) =>
                  entry.key ===
                  key
              )
          )
      );

      if (
        typeof onChanged ===
        "function"
      ) {
        onChanged();
      }
    }


    if (
      failed.length >
      0
    ) {
      const firstFailure =
        failed[0];

      setError(
        `${failed.length} guest${
          failed.length === 1
            ? ""
            : "s"
        } could not be checked in. ${
          firstFailure
            .roomNumber
            ? `Room ${firstFailure.roomNumber}: `
            : ""
        }${firstFailure.message}`
      );
    }


    if (
      succeeded.length >
      0
    ) {
      setSuccess(
        `${succeeded.length} guest${
          succeeded.length === 1
            ? ""
            : "s"
        } checked in successfully.`
      );
    }


    setSubmitting(
      false
    );
  }


  return (
    <div
      className="booking-modal-overlay"
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !submitting
        ) {
          onClose();
        }
      }}
    >

      <div
        className="booking-view-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-check-in-title"
      >

        <div className="booking-modal-header">

          <div>

            <h3 id="group-check-in-title">
              Group Check-In
            </h3>

            <p>
              {group.group_code ||
                "Reservation Group"}
            </p>

          </div>


          <button
            type="button"
            className="booking-modal-close"
            disabled={
              submitting
            }
            onClick={
              onClose
            }
            aria-label="Close group check-in"
          >
            ×
          </button>

        </div>


        <AppAlert
          type="error"
          message={
            error
          }
          onClose={() =>
            setError(
              ""
            )
          }
        />


        <AppAlert
          type="success"
          message={
            success
          }
          onClose={() =>
            setSuccess(
              ""
            )
          }
        />


        <div className="booking-view-body">

          <section className="booking-detail-section">

            <h4>
              Actual Arrivals
            </h4>

            <div className="booking-detail-row">

              <span>
                Rooms Available for Guest Check-In
              </span>

              <strong>
                {
                  manageableBookings.length
                }
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Expected Guests
              </span>

              <strong>
                {
                  expectedEntries.length
                }
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Selected Arrivals
              </span>

              <strong>
                {
                  selectedEntries.length
                }
              </strong>

            </div>

          </section>


          {expectedEntries.length >
          0 ? (
            <div className="booking-confirm-actions">

              <button
                type="button"
                className="booking-btn-secondary"
                disabled={
                  submitting
                }
                onClick={
                  toggleAllExpected
                }
              >
                {selectedKeys.length ===
                  expectedEntries.length
                  ? "Clear Selection"
                  : "Select All Expected"}
              </button>

            </div>
          ) : null}


          {manageableBookings.map(
            (
              booking
            ) => {
              const guests =
                Array.isArray(
                  booking
                    ?.occupancy
                    ?.guests
                )
                  ? booking
                      .occupancy
                      .guests
                  : [];


              const expectedGuests =
                guests.filter(
                  (guest) =>
                    normalizeValue(
                      guest
                        ?.guest_status
                    ) ===
                    "expected"
                );


              const checkedInGuests =
                guests.filter(
                  (guest) =>
                    normalizeValue(
                      guest
                        ?.guest_status
                    ) ===
                    "checked_in"
                );


              const capacity =
                Number(
                  booking.capacity ||
                  0
                );


              return (
                <section
                  className="booking-detail-section"
                  key={
                    booking.booking_id
                  }
                >

                  <h4>
                    Room{" "}
                    {booking.room_number ||
                      "—"}
                    {booking.room_type
                      ? ` · ${booking.room_type}`
                      : ""}
                  </h4>


                  <div className="booking-detail-row">

                    <span>
                      Booking
                    </span>

                    <strong>
                      {booking.booking_code ||
                        `#${booking.booking_id}`}
                    </strong>

                  </div>


                  <div className="booking-detail-row">

                    <span>
                      Occupancy
                    </span>

                    <strong>
                      {
                        checkedInGuests.length
                      }
                      {" / "}
                      {capacity ||
                        "—"}
                      {" staying"}
                    </strong>

                  </div>


                  {expectedGuests.length ===
                  0 ? (
                    <div className="booking-special-request">
                      No expected guest is waiting for check-in in this room.
                    </div>
                  ) : (
                    expectedGuests.map(
                      (
                        guest,
                        guestIndex
                      ) => {
                        const key =
                          guestKey(
                            booking.booking_id,
                            guest.booking_guest_id
                          );


                        return (
                          <div
                            className="booking-detail-row"
                            key={
                              key
                            }
                          >

                            <span>

                              <input
                                type="checkbox"
                                checked={
                                  selectedKeys.includes(
                                    key
                                  )
                                }
                                disabled={
                                  submitting
                                }
                                onChange={() =>
                                  toggleGuest(
                                    key
                                  )
                                }
                                aria-label={`Select ${
                                  guest.full_name ||
                                  `Guest ${guestIndex + 1}`
                                } for check-in`}
                              />

                              {" "}

                              {guest.full_name ||
                                `Guest ${guestIndex + 1}`}

                            </span>


                            <strong>
                              {formatGuestType(
                                guest
                              )}
                            </strong>

                          </div>
                        );
                      }
                    )
                  )}


                  {checkedInGuests.map(
                    (
                      guest,
                      guestIndex
                    ) => (
                      <div
                        className="booking-detail-row"
                        key={
                          guest.booking_guest_id ||
                          `checked-in-${booking.booking_id}-${guestIndex}`
                        }
                      >

                        <span>
                          {guest.full_name ||
                            `Guest ${guestIndex + 1}`}
                        </span>

                        <strong>
                          Checked In
                        </strong>

                      </div>
                    )
                  )}


                  <div className="booking-confirm-actions">

                    <button
                      type="button"
                      className="booking-btn-secondary"
                      disabled={
                        submitting
                      }
                      onClick={() => {
                        if (
                          typeof onManageRoom ===
                          "function"
                        ) {
                          onManageRoom(
                            booking
                          );
                        }
                      }}
                    >
                      Manage Room Guests
                    </button>

                  </div>

                </section>
              );
            }
          )}


          {manageableBookings.length ===
          0 && (
            <div className="booking-view-error">
              No room in this reservation group currently allows guest check-in.
            </div>
          )}

        </div>


        <div className="booking-confirm-actions">

          <button
            type="button"
            className="booking-btn-secondary"
            disabled={
              submitting
            }
            onClick={
              onClose
            }
          >
            Close
          </button>


          <button
            type="button"
            className="booking-btn-primary"
            disabled={
              submitting ||
              selectedEntries.length ===
                0
            }
            onClick={() =>
              void checkInSelected()
            }
          >
            {submitting
              ? "Checking In..."
              : `Check In Selected (${selectedEntries.length})`}
          </button>

        </div>

      </div>

    </div>
  );
}


export default GroupCheckInDialog;