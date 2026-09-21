import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import roomsApi from "../api/roomsApi";

import "./RoomDetailsPage.css";

import {
  formatCurrency,
} from "../../../shared/utils/money";

import {
  formatDate,
  formatDateTime,
} from "../../../shared/utils/dates";

/* ============================================================
   HELPERS
============================================================ */

function getApiErrorMessage(
  error,
  fallbackMessage
) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage
  );
}

function parseRoomId(value) {
  const roomId =
    Number(value);

  if (
    !Number.isInteger(roomId) ||
    roomId <= 0
  ) {
    return null;
  }

  return roomId;
}

function asArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function displayText(
  value,
  fallback = "—"
) {
  const text =
    String(
      value ?? ""
    ).trim();

  return text || fallback;
}

function formatStatus(value) {
  const text =
    String(
      value || ""
    )
      .trim()
      .replace(
        /[_-]+/g,
        " "
      );

  if (!text) {
    return "—";
  }

  return text
    .split(/\s+/)
    .map(
      (word) =>
        word.charAt(0)
          .toUpperCase() +
        word.slice(1)
          .toLowerCase()
    )
    .join(" ");
}

function formatCount(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatNights(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2,
    }
  );
}

/* ============================================================
   INFO ITEM
============================================================ */

function InfoItem({
  label,
  value,
}) {
  return (
    <div className="room-detail-info-item">
      <span className="room-detail-info-label">
        {label}
      </span>

      <strong className="room-detail-info-value">
        {value}
      </strong>
    </div>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  label,
  value,
  helper,
}) {
  return (
    <article className="room-detail-stat-card">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      {helper && (
        <small>
          {helper}
        </small>
      )}
    </article>
  );
}

/* ============================================================
   BOOKING ASSIGNMENT CARD
============================================================ */

function BookingAssignmentCard({
  title,
  booking,
  emptyMessage,
}) {
  return (
    <article className="room-detail-booking-card">
      <div className="room-detail-section-heading">
        <div>
          <h2>
            {title}
          </h2>

          {booking && (
            <p>
              {displayText(
                booking.bookingCode,
                "Booking"
              )}
            </p>
          )}
        </div>

        {booking && (
          <span
            className={`room-detail-status room-detail-status-${String(
              booking.bookingStatus ||
                "unknown"
            )
              .trim()
              .toLowerCase()}`}
          >
            {formatStatus(
              booking.bookingStatus
            )}
          </span>
        )}
      </div>

      {!booking ? (
        <div className="room-detail-empty">
          {emptyMessage}
        </div>
      ) : (
        <div className="room-detail-info-grid">
          <InfoItem
            label="Booking Code"
            value={
              displayText(
                booking.bookingCode
              )
            }
          />

          <InfoItem
            label="Guest"
            value={
              displayText(
                booking.customer
                  ?.fullName,
                "Guest details unavailable"
              )
            }
          />

          <InfoItem
            label="Phone"
            value={
              displayText(
                booking.customer
                  ?.phone
              )
            }
          />

          <InfoItem
            label="Booking Source"
            value={
              formatStatus(
                booking.bookingSource
              )
            }
          />

          <InfoItem
            label="Stay Type"
            value={
              formatStatus(
                booking.stayType
              )
            }
          />

          <InfoItem
            label="Payment"
            value={
              formatStatus(
                booking.paymentStatus
              )
            }
          />

          <InfoItem
            label="Assignment"
            value={
              formatStatus(
                booking.assignmentStatus
              )
            }
          />

          <InfoItem
            label="Assignment Start"
            value={
              formatDateTime(
                booking.assignmentStart
              )
            }
          />

          <InfoItem
            label="Assignment End"
            value={
              formatDateTime(
                booking.assignmentEnd
              )
            }
          />

          <InfoItem
            label="Rate / Night"
            value={
              formatCurrency(
                booking.ratePerNight
              )
            }
          />

          <InfoItem
            label="Scheduled Check-in"
            value={
              formatDateTime(
                booking.scheduledCheckIn
              )
            }
          />

          <InfoItem
            label="Scheduled Check-out"
            value={
              formatDateTime(
                booking.scheduledCheckOut
              )
            }
          />

          <InfoItem
            label="Actual Check-in"
            value={
              formatDateTime(
                booking.actualCheckIn
              )
            }
          />

          <InfoItem
            label="Actual Check-out"
            value={
              formatDateTime(
                booking.actualCheckOut
              )
            }
          />

          {booking.changeReason && (
            <InfoItem
              label="Change Reason"
              value={
                displayText(
                  booking.changeReason
                )
              }
            />
          )}

          {booking.notes && (
            <InfoItem
              label="Notes"
              value={
                displayText(
                  booking.notes
                )
              }
            />
          )}
        </div>
      )}
    </article>
  );
}

/* ============================================================
   MAIN PAGE
============================================================ */

function RoomDetailsPage() {
  const navigate =
    useNavigate();

  const {
    roomId: routeRoomId,
  } = useParams();

  const roomId =
    parseRoomId(
      routeRoomId
    );

  const [
    roomDetails,
    setRoomDetails,
  ] = useState(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const loadRoomDetails =
    useCallback(async () => {
      if (!roomId) {
        setRoomDetails(null);

        setErrorMessage(
          "The room ID in this page URL is invalid."
        );

        setIsLoading(false);

        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const response =
          await roomsApi.getRoomDetails(
            roomId
          );

        const details =
          response?.data?.data;

        if (
          !details ||
          !details.profile
        ) {
          throw new Error(
            "Room details response is incomplete."
          );
        }

        setRoomDetails(
          details
        );
      } catch (error) {
        console.error(
          "[ROOM-DETAILS:FETCH]",
          error
        );

        setRoomDetails(null);

        setErrorMessage(
          getApiErrorMessage(
            error,
            "Room details could not be loaded. Please try again."
          )
        );
      } finally {
        setIsLoading(false);
      }
    }, [
      roomId,
    ]);

  useEffect(() => {
    void loadRoomDetails();
  }, [
    loadRoomDetails,
  ]);

  const handleBack =
    () => {
      navigate(
        "/rooms"
      );
    };

  if (isLoading) {
    return (
      <section
        className="room-details-page"
        aria-busy="true"
      >
        <div className="room-details-state">
          <h1>
            Room Details
          </h1>

          <p>
            Loading room details...
          </p>
        </div>
      </section>
    );
  }

  if (
    errorMessage ||
    !roomDetails
  ) {
    return (
      <section className="room-details-page">
        <div
          className="room-details-state"
          role="alert"
        >
          <h1>
            Room Details
          </h1>

          <p>
            {errorMessage ||
              "Room details are unavailable."}
          </p>

          <div className="room-details-state-actions">
            {roomId && (
              <button
                type="button"
                onClick={
                  loadRoomDetails
                }
              >
                Try Again
              </button>
            )}

            <button
              type="button"
              onClick={
                handleBack
              }
            >
              Back to Rooms
            </button>
          </div>
        </div>
      </section>
    );
  }

  const profile =
    roomDetails.profile || {};

  const stats =
    roomDetails.stats || {};

  const currentBooking =
    roomDetails.currentBooking ||
    null;

  const nextBooking =
    roomDetails.nextBooking ||
    null;

  const history =
    asArray(
      roomDetails.history
    );

  const integrityWarnings =
    asArray(
      roomDetails.integrityWarnings
    );

  const financials =
    roomDetails.financials || {};

  const finalized =
    financials.finalized || {};

  const provisional =
    financials.provisional || {};

  const deferred =
    financials.deferred || {};

  const allocation =
    financials.allocation || {};

  const financialWarnings =
    asArray(
      financials.warnings
    );

  return (
    <section className="room-details-page">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="room-details-header">
        <div>
          <p className="room-details-eyebrow">
            Room Management
          </p>

          <div className="room-details-title-row">
            <h1>
              Room{" "}
              {displayText(
                profile.roomNumber,
                routeRoomId
              )}
            </h1>

            <span
              className={`room-detail-status room-detail-status-${String(
                profile.status ||
                  "unknown"
              )
                .trim()
                .toLowerCase()}`}
            >
              {formatStatus(
                profile.status
              )}
            </span>
          </div>

          <p>
            {displayText(
              profile.roomType,
              "Room details"
            )}
          </p>
        </div>

        <button
          type="button"
          className="room-details-back"
          onClick={
            handleBack
          }
        >
          Back to Rooms
        </button>
      </header>

      {/* ======================================================
          INTEGRITY WARNINGS
      ====================================================== */}

      {integrityWarnings.length >
        0 && (
        <section className="room-detail-alert-section">
          <div className="room-detail-section-heading">
            <div>
              <h2>
                Data Integrity Attention
              </h2>

              <p>
                These warnings come from
                the current operational
                room state.
              </p>
            </div>
          </div>

          <div className="room-detail-alert-list">
            {integrityWarnings.map(
              (
                warning,
                index
              ) => (
                <div
                  className="room-detail-alert room-detail-alert-warning"
                  key={
                    warning.code ||
                    `integrity-${index}`
                  }
                >
                  <strong>
                    {formatStatus(
                      warning.code
                    )}
                  </strong>

                  <span>
                    {displayText(
                      warning.message
                    )}
                  </span>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* ======================================================
          ROOM PROFILE
      ====================================================== */}

      <section className="room-detail-panel">
        <div className="room-detail-section-heading">
          <div>
            <h2>
              Room Profile
            </h2>

            <p>
              Permanent room information.
            </p>
          </div>
        </div>

        <div className="room-detail-info-grid">
          <InfoItem
            label="Room Number"
            value={
              displayText(
                profile.roomNumber
              )
            }
          />

          <InfoItem
            label="Room Type"
            value={
              displayText(
                profile.roomType
              )
            }
          />

          <InfoItem
            label="Floor"
            value={
              profile.floor ===
                null ||
              profile.floor ===
                undefined
                ? "—"
                : profile.floor
            }
          />

          <InfoItem
            label="Capacity"
            value={`${formatCount(
              profile.capacity
            )} ${
              formatCount(
                profile.capacity
              ) === 1
                ? "Guest"
                : "Guests"
            }`}
          />

          <InfoItem
            label="Maximum Extra Beds"
            value={
              formatCount(
                profile.maxExtraBeds
              )
            }
          />

          <InfoItem
            label="Standard Rate"
            value={
              formatCurrency(
                profile.pricePerNight
              )
            }
          />

          <InfoItem
            label="Status"
            value={
              formatStatus(
                profile.status
              )
            }
          />

          <InfoItem
            label="Room Added"
            value={
              formatDate(
                profile.createdAt
              )
            }
          />
        </div>
      </section>

      {/* ======================================================
          LIFETIME STATISTICS
      ====================================================== */}

      <section className="room-detail-panel">
        <div className="room-detail-section-heading">
          <div>
            <h2>
              Lifetime Room Statistics
            </h2>

            <p>
              Derived from canonical room
              assignment and guest-stay
              history.
            </p>
          </div>
        </div>

        <div className="room-detail-stats-grid">
          <StatCard
            label="Lifetime Bookings"
            value={
              formatCount(
                stats.lifetimeBookings
              )
            }
          />

          <StatCard
            label="Stayed Bookings"
            value={
              formatCount(
                stats.stayedBookings
              )
            }
          />

          <StatCard
            label="Assigned Nights"
            value={
              formatNights(
                stats.totalNights
              )
            }
            helper="Canonical assigned-room duration"
          />

          <StatCard
            label="Average Stay"
            value={`${formatNights(
              stats.averageStayNights
            )} nights`}
          />

          <StatCard
            label="Unique Guests"
            value={
              formatCount(
                stats.uniqueGuests
              )
            }
          />

          <StatCard
            label="Cancellations"
            value={
              formatCount(
                stats.cancellations
              )
            }
          />

          <StatCard
            label="No-shows"
            value={
              formatCount(
                stats.noShows
              )
            }
          />
        </div>
      </section>

      {/* ======================================================
          CURRENT / NEXT BOOKING
      ====================================================== */}

      <div className="room-detail-booking-grid">
        <BookingAssignmentCard
          title="Current Booking"
          booking={
            currentBooking
          }
          emptyMessage="No active checked-in assignment is currently linked to this room."
        />

        <BookingAssignmentCard
          title="Next Booking"
          booking={
            nextBooking
          }
          emptyMessage="No upcoming planned assignment is currently linked to this room."
        />
      </div>

      {/* ======================================================
          FINANCIAL ATTRIBUTION
      ====================================================== */}

      <section className="room-detail-panel">
        <div className="room-detail-section-heading">
          <div>
            <h2>
              Room Financial Attribution
            </h2>

            <p>
              Finalized, provisional and
              deferred values are kept
              separate so historical and
              current amounts are not
              mixed.
            </p>
          </div>

          <span className="room-detail-allocation-quality">
            Allocation:{" "}
            {formatStatus(
              allocation.quality ||
                "none"
            )}
          </span>
        </div>

        <div className="room-detail-financial-grid">
          <article className="room-detail-financial-card">
            <h3>
              Finalized
            </h3>

            <InfoItem
              label="Stay Revenue"
              value={
                formatCurrency(
                  finalized.stayRevenue
                )
              }
            />

            <InfoItem
              label="Reservation Fees"
              value={
                formatCurrency(
                  finalized.reservationFees
                )
              }
            />

            <InfoItem
              label="Total Revenue"
              value={
                formatCurrency(
                  finalized.revenue
                )
              }
            />

            <InfoItem
              label="Applied Paid"
              value={
                formatCurrency(
                  finalized.appliedPaid
                )
              }
            />

            <InfoItem
              label="Outstanding"
              value={
                formatCurrency(
                  finalized.outstanding
                )
              }
            />

            <InfoItem
              label="Refund Due"
              value={
                formatCurrency(
                  finalized.refundDue
                )
              }
            />
          </article>

          <article className="room-detail-financial-card">
            <h3>
              Current Stay
            </h3>

            <InfoItem
              label="Provisional Value"
              value={
                formatCurrency(
                  provisional.currentStayValue
                )
              }
            />

            <InfoItem
              label="Applied Paid"
              value={
                formatCurrency(
                  provisional.appliedPaid
                )
              }
            />

            <InfoItem
              label="Outstanding"
              value={
                formatCurrency(
                  provisional.outstanding
                )
              }
            />

            <p className="room-detail-card-note">
              Current checked-in values
              remain provisional until
              checkout settlement and
              invoice finalization.
            </p>
          </article>

          <article className="room-detail-financial-card">
            <h3>
              Deferred History
            </h3>

            <InfoItem
              label="Historical Value"
              value={
                formatCurrency(
                  deferred.historicalValue
                )
              }
            />

            <InfoItem
              label="Historical Net Paid"
              value={
                formatCurrency(
                  deferred.netPaid
                )
              }
            />

            <p className="room-detail-card-note">
              Deferred checked-out stays
              are not treated as
              finalized room revenue
              without canonical
              settlement or invoice
              records.
            </p>
          </article>
        </div>

        <div className="room-detail-allocation-grid">
          <InfoItem
            label="Exact Allocations"
            value={
              formatCount(
                allocation.exactAllocations
              )
            }
          />

          <InfoItem
            label="Estimated Allocations"
            value={
              formatCount(
                allocation.estimatedAllocations
              )
            }
          />

          <InfoItem
            label="Unresolved Allocations"
            value={
              formatCount(
                allocation.unresolvedAllocations
              )
            }
          />
        </div>

        {financialWarnings.length >
          0 && (
          <div className="room-detail-alert-list room-detail-financial-warnings">
            {financialWarnings.map(
              (
                warning,
                index
              ) => (
                <div
                  className="room-detail-alert room-detail-alert-info"
                  key={
                    warning.code ||
                    `financial-${index}`
                  }
                >
                  <strong>
                    {formatStatus(
                      warning.code
                    )}
                  </strong>

                  <span>
                    {displayText(
                      warning.message
                    )}
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* ======================================================
          CANONICAL ROOM HISTORY
      ====================================================== */}

      <section className="room-detail-panel">
        <div className="room-detail-section-heading">
          <div>
            <h2>
              Complete Room History
            </h2>

            <p>
              Physical room assignment
              history from
              booking_room_history.
            </p>
          </div>

          <span>
            {history.length}{" "}
            {history.length === 1
              ? "record"
              : "records"}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="room-detail-empty">
            No room assignment history
            exists for this room yet.
          </div>
        ) : (
          <div className="room-detail-table-wrap">
            <table className="room-detail-history-table">
              <thead>
                <tr>
                  <th>
                    Booking
                  </th>

                  <th>
                    Guest
                  </th>

                  <th>
                    Assignment
                  </th>

                  <th>
                    Assigned Period
                  </th>

                  <th>
                    Rate
                  </th>

                  <th>
                    Booking Status
                  </th>

                  <th>
                    Payment
                  </th>

                  <th>
                    Reason
                  </th>
                </tr>
              </thead>

              <tbody>
                {history.map(
                  (
                    item,
                    index
                  ) => (
                    <tr
                      key={
                        item.roomHistoryId ||
                        `${item.bookingId}-${index}`
                      }
                    >
                      <td>
                        <strong>
                          {displayText(
                            item.bookingCode,
                            `Booking #${item.bookingId}`
                          )}
                        </strong>

                        <small>
                          {formatStatus(
                            item.bookingSource
                          )}
                        </small>
                      </td>

                      <td>
                        <strong>
                          {displayText(
                            item.customer
                              ?.fullName,
                            "—"
                          )}
                        </strong>

                        <small>
                          {displayText(
                            item.customer
                              ?.phone,
                            ""
                          )}
                        </small>
                      </td>

                      <td>
                        <span
                          className={`room-detail-status room-detail-status-${String(
                            item.assignmentStatus ||
                              "unknown"
                          )
                            .trim()
                            .toLowerCase()}`}
                        >
                          {formatStatus(
                            item.assignmentStatus
                          )}
                        </span>
                      </td>

                      <td>
                        <span>
                          {formatDateTime(
                            item.assignmentStart
                          )}
                        </span>

                        <small>
                          to{" "}
                          {formatDateTime(
                            item.assignmentEnd
                          )}
                        </small>
                      </td>

                      <td>
                        {formatCurrency(
                          item.ratePerNight
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          item.bookingStatus
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          item.paymentStatus
                        )}
                      </td>

                      <td>
                        {displayText(
                          item.changeReason,
                          "—"
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default RoomDetailsPage;