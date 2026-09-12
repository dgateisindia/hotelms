import React, { useMemo, useState } from "react";
import apiClient, { getApiErrorMessage } from "../../../shared/api/apiClient";
import AppAlert from "../../../shared/components/ui/AppAlert";
import { formatCurrency } from "../../../shared/utils/money";

const normalizeStatus = (value) =>
  String(value || "").trim().toLowerCase();

const guestCount = (booking, status) => {
  const guests = Array.isArray(
    booking?.occupancy?.guests
  )
    ? booking.occupancy.guests
    : [];

  return guests.filter(
    (guest) =>
      normalizeStatus(
        guest?.guest_status
      ) === status
  ).length;
};

function GroupCheckoutDialog({
  group,
  onClose,
  onChanged,
}) {
  const [mode, setMode] =
    useState("all");

  const [
    selectedIds,
    setSelectedIds,
  ] = useState([]);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [result, setResult] =
    useState(null);

  const bookings =
    useMemo(
      () =>
        Array.isArray(
          group?.bookings
        )
          ? group.bookings
          : [],
      [group]
    );

  const checkedInBookings =
    useMemo(
      () =>
        bookings.filter(
          (booking) =>
            normalizeStatus(
              booking
                ?.booking_status
            ) ===
            "checked_in"
        ),
      [bookings]
    );

  const readyBookings =
    useMemo(
      () =>
        checkedInBookings.filter(
          (booking) =>
            Number(
              booking
                ?.outstanding_amount ||
                0
            ) <= 0.009
        ),
      [checkedInBookings]
    );

  const blockedBookings =
    useMemo(
      () =>
        checkedInBookings.filter(
          (booking) =>
            Number(
              booking
                ?.outstanding_amount ||
                0
            ) > 0.009
        ),
      [checkedInBookings]
    );

  if (!group) {
    return null;
  }

  const selectedBookings =
    readyBookings.filter(
      (booking) =>
        selectedIds.includes(
          Number(
            booking.booking_id
          )
        )
    );

  const wholeGroupBlocked =
    blockedBookings.length > 0;

  const canSubmit =
    !submitting &&
    (
      mode === "all"
        ? checkedInBookings.length >
            0 &&
          !wholeGroupBlocked
        : selectedBookings.length >
          0
    );

  const chooseMode =
    (nextMode) => {
      setMode(nextMode);
      setError("");
      setResult(null);
    };

  const toggleBooking =
    (booking) => {
      const bookingId =
        Number(
          booking
            ?.booking_id ||
            0
        );

      if (
        !bookingId ||
        Number(
          booking
            ?.outstanding_amount ||
            0
        ) > 0.009 ||
        submitting
      ) {
        return;
      }

      setSelectedIds(
        (current) =>
          current.includes(
            bookingId
          )
            ? current.filter(
                (id) =>
                  id !==
                  bookingId
              )
            : [
                ...current,
                bookingId,
              ].sort(
                (a, b) =>
                  a - b
              )
      );

      setError("");
      setResult(null);
    };

  const toggleAllReady =
    () => {
      if (submitting) {
        return;
      }

      const ids =
        readyBookings.map(
          (booking) =>
            Number(
              booking
                .booking_id
            )
        );

      const allSelected =
        ids.length > 0 &&
        ids.every(
          (id) =>
            selectedIds.includes(
              id
            )
        );

      setSelectedIds(
        allSelected
          ? []
          : ids
      );

      setError("");
      setResult(null);
    };

  const submitCheckout =
    async () => {
      const groupId =
        Number(
          group
            ?.reservation_group_id ||
            0
        );

      if (!groupId) {
        setError(
          "Reservation group ID is missing."
        );
        return;
      }

      if (
        mode === "all" &&
        wholeGroupBlocked
      ) {
        setError(
          "Clear the outstanding payment for every checked-in room before full group checkout."
        );
        return;
      }

      if (
        mode === "selected" &&
        selectedBookings.length ===
          0
      ) {
        setError(
          "Select at least one fully-paid checked-in room."
        );
        return;
      }

      setSubmitting(true);
      setError("");
      setResult(null);

      try {
        const payload =
          mode === "selected"
            ? {
                booking_ids:
                  selectedIds,
              }
            : {};

        const response =
          await apiClient.post(
            `/bookings/groups/${groupId}/checkout`,
            payload
          );

        setResult(
          response.data?.data ||
            null
        );

        setSelectedIds([]);

        if (
          typeof onChanged ===
          "function"
        ) {
          await onChanged();
        }
      } catch (
        requestError
      ) {
        setError(getApiErrorMessage(requestError));
      } finally {
        setSubmitting(false);
      }
    };

  return (
    <div
      className="booking-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
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
        aria-labelledby="group-checkout-title"
      >
        <div className="booking-modal-header">
          <div>
            <h3 id="group-checkout-title">
              Group Check-Out
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
            aria-label="Close group checkout"
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
            setError("")
          }
        />

        <div className="booking-view-body">
          <section className="booking-detail-section">
            <h4>
              Checkout Scope
            </h4>

            <div className="booking-detail-row">
              <span>
                All Checked-In Rooms
              </span>

              <button
                type="button"
                className={
                  mode === "all"
                    ? "booking-btn-primary"
                    : "booking-btn-secondary"
                }
                disabled={
                  submitting
                }
                onClick={() =>
                  chooseMode(
                    "all"
                  )
                }
              >
                {mode === "all"
                  ? "Selected"
                  : "Choose"}
              </button>
            </div>

            <div className="booking-detail-row">
              <span>
                Selected Rooms Only
              </span>

              <button
                type="button"
                className={
                  mode ===
                  "selected"
                    ? "booking-btn-primary"
                    : "booking-btn-secondary"
                }
                disabled={
                  submitting
                }
                onClick={() =>
                  chooseMode(
                    "selected"
                  )
                }
              >
                {mode ===
                "selected"
                  ? "Selected"
                  : "Choose"}
              </button>
            </div>
          </section>

          <section className="booking-detail-section">
            <h4>
              Current Stay
            </h4>

            <div className="booking-detail-row">
              <span>
                Checked-In Rooms
              </span>

              <strong>
                {
                  checkedInBookings.length
                }
              </strong>
            </div>

            <div className="booking-detail-row">
              <span>
                Ready for Checkout
              </span>

              <strong>
                {
                  readyBookings.length
                }
              </strong>
            </div>

            <div className="booking-detail-row">
              <span>
                Payment Blocked
              </span>

              <strong>
                {
                  blockedBookings.length
                }
              </strong>
            </div>
          </section>

          {wholeGroupBlocked &&
            mode ===
              "all" && (
              <div className="booking-special-request">
                Full group checkout is blocked because one or more checked-in rooms still have an outstanding balance. Collect payment first, or switch to Selected Rooms Only.
              </div>
            )}

          <div className="booking-special-request">
            Formal room checkout checks out all currently checked-in guests, cancels remaining expected guest allocations, and moves the room to Cleaning.
          </div>

          {mode ===
            "selected" &&
            readyBookings.length >
              0 && (
              <div className="booking-confirm-actions">
                <button
                  type="button"
                  className="booking-btn-secondary"
                  disabled={
                    submitting
                  }
                  onClick={
                    toggleAllReady
                  }
                >
                  {readyBookings.every(
                    (
                      booking
                    ) =>
                      selectedIds.includes(
                        Number(
                          booking
                            .booking_id
                        )
                      )
                  )
                    ? "Clear Selection"
                    : "Select All Ready Rooms"}
                </button>
              </div>
            )}

          {checkedInBookings.length ===
          0 ? (
            <div className="booking-special-request">
              No checked-in rooms are currently available for checkout.
            </div>
          ) : (
            checkedInBookings.map(
              (booking) => {
                const bookingId =
                  Number(
                    booking
                      .booking_id
                  );

                const outstanding =
                  Number(
                    booking
                      .outstanding_amount ||
                      0
                  );

                const blocked =
                  outstanding >
                  0.009;

                const selected =
                  selectedIds.includes(
                    bookingId
                  );

                return (
                  <section
                    className="booking-detail-section"
                    key={
                      bookingId
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
                          `#${bookingId}`}
                      </strong>
                    </div>

                    <div className="booking-detail-row">
                      <span>
                        Checked-In Guests
                      </span>

                      <strong>
                        {guestCount(
                          booking,
                          "checked_in"
                        )}
                      </strong>
                    </div>

                    <div className="booking-detail-row">
                      <span>
                        Expected Guests
                      </span>

                      <strong>
                        {guestCount(
                          booking,
                          "expected"
                        )}
                      </strong>
                    </div>

                    <div className="booking-detail-row">
                      <span>
                        Outstanding
                      </span>

                      <strong>
                        {formatCurrency(
                          outstanding
                        )}
                      </strong>
                    </div>

                    <div className="booking-detail-row">
                      <span>
                        Checkout State
                      </span>

                      <strong>
                        {blocked
                          ? "Payment Required"
                          : "Ready"}
                      </strong>
                    </div>

                    {mode ===
                      "selected" && (
                      <div className="booking-detail-row">
                        <span>
                          Selection
                        </span>

                        <button
                          type="button"
                          className={
                            selected
                              ? "booking-btn-primary"
                              : "booking-btn-secondary"
                          }
                          disabled={
                            submitting ||
                            blocked
                          }
                          onClick={() =>
                            toggleBooking(
                              booking
                            )
                          }
                        >
                          {blocked
                            ? "Clear Payment First"
                            : selected
                              ? "Selected"
                              : "Select Room"}
                        </button>
                      </div>
                    )}
                  </section>
                );
              }
            )
          )}

          {result && (
            <section className="booking-detail-section">
              <h4>
                Checkout Completed
              </h4>

              <div className="booking-detail-row">
                <span>
                  Rooms Checked Out
                </span>

                <strong>
                  {Number(
                    result
                      .checkedOutBookingCount ||
                      0
                  )}
                </strong>
              </div>

              {Array.isArray(
                result.bookings
              ) &&
                result.bookings.map(
                  (
                    booking
                  ) => (
                    <div
                      className="booking-detail-row"
                      key={
                        booking.bookingId
                      }
                    >
                      <span>
                        Room{" "}
                        {booking.roomNumber ||
                          "—"}
                        {" · "}
                        {booking.bookingCode ||
                          `#${booking.bookingId}`}
                      </span>

                      <strong>
                        Checked Out
                      </strong>
                    </div>
                  )
                )}
            </section>
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
              !canSubmit
            }
            onClick={() =>
              void submitCheckout()
            }
          >
            {submitting
              ? "Checking Out..."
              : mode ===
                  "selected"
                ? `Check Out Selected (${selectedBookings.length})`
                : `Check Out Group (${checkedInBookings.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupCheckoutDialog;