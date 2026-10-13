import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import apiClient from "../../shared/api/apiClient";

import "./CustomerDetailsPage.css";


function displayValue(
  value,
  fallback = "—"
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  return String(value);
}


function numberValue(
  value
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


function formatCurrency(
  value
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }
  ).format(
    numberValue(value)
  );
}


function formatDateTime(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}


function formatStatus(
  value
) {
  if (!value) {
    return "—";
  }

  return String(value)
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function formatCustomerId(
  customerId
) {
  const id =
    Number(customerId);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return "—";
  }

  return `CUS-${String(id).padStart(
    4,
    "0"
  )}`;
}


function InfoItem({
  label,
  value,
}) {
  return (
    <div className="customer-details-info-item">
      <span>
        {label}
      </span>

      <strong>
        {displayValue(value)}
      </strong>
    </div>
  );
}


function StatCard({
  label,
  value,
  hint,
}) {
  return (
    <article className="customer-details-stat">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {hint}
      </small>
    </article>
  );
}


function EmptyState({
  children,
}) {
  return (
    <div className="customer-details-empty">
      {children}
    </div>
  );
}


function CustomerDetailsPage() {
  const navigate =
    useNavigate();

  const {
    customerId,
  } =
    useParams();

  const [
    details,
    setDetails,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    showEdit,
    setShowEdit,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    editError,
    setEditError,
  ] =
    useState("");

  const [
    form,
    setForm,
  ] =
    useState({
      full_name: "",
      email: "",
      phone: "",
      gender: "",
      nationality: "",
      address: "",
      id_proof_type: "",
      id_proof_number: "",
      profile_image: "",
    });


  const loadDetails =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await apiClient.get(
              `/customers/${customerId}/details`
            );

          const payload =
            response?.data?.data;

          if (!payload?.profile) {
            throw new Error(
              "Customer details are unavailable."
            );
          }

          setDetails(
            payload
          );
        } catch (requestError) {
          console.error(
            "[CUSTOMER_DETAILS:LOAD]",
            requestError
          );

          setError(
            requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            requestError?.message ||
            "Customer details could not be loaded."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        customerId,
      ]
    );


  useEffect(() => {
    void loadDetails();
  }, [
    loadDetails,
  ]);


  const profile =
    details?.profile || {};

  const stats =
    details?.stats || {};

  const insights =
    details?.insights || {};

  const bookings =
    Array.isArray(
      details?.bookings
    )
      ? details.bookings
      : [];

  const roomHistory =
    Array.isArray(
      details?.roomHistory
    )
      ? details.roomHistory
      : [];


  /*
   * booking_room_history remains the relational source of truth.
   *
   * Initial assignments are already represented by Complete Booking
   * History, so showing them again creates duplicate-looking UI.
   *
   * This derived collection contains only genuine room movements:
   * upgrade, downgrade, maintenance, hotel operational move, etc.
   */
  const meaningfulRoomChanges =
    useMemo(
      () =>
        roomHistory.filter(
          (item) =>
            String(
              item.change_reason || ""
            )
              .trim()
              .toLowerCase() !==
            "initial_booking"
        ),
      [
        roomHistory,
      ]
    );

  const payments =
    Array.isArray(
      details?.payments
    )
      ? details.payments
      : [];

  const reservationPayments =
    Array.isArray(
      details?.reservationPayments
    )
      ? details.reservationPayments
      : [];

  const documents =
    Array.isArray(
      details?.documents
    )
      ? details.documents
      : [];


  const currentBooking =
    details?.currentBooking ||
    null;

  const upcomingBooking =
    details?.upcomingBooking ||
    null;


  const customerDisplayId =
    useMemo(
      () =>
        formatCustomerId(
          profile.customer_id
        ),
      [
        profile.customer_id,
      ]
    );


  const openEdit =
    () => {
      setEditError("");

      setForm({
        full_name:
          profile.full_name || "",

        email:
          profile.email || "",

        phone:
          profile.phone || "",

        gender:
          profile.gender || "",

        nationality:
          profile.nationality || "",

        address:
          profile.address || "",

        id_proof_type:
          profile.id_proof_type || "",

        id_proof_number:
          profile.id_proof_number || "",

        profile_image:
          profile.profile_image || "",
      });

      setShowEdit(true);
    };


  const handleFormChange =
    (
      field,
      value
    ) => {
      setForm(
        (current) => ({
          ...current,
          [field]: value,
        })
      );
    };


  const saveProfile =
    async (
      event
    ) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      if (
        !form.full_name.trim() ||
        !form.phone.trim()
      ) {
        setEditError(
          "Full Name and Phone Number are required."
        );

        return;
      }

      setSaving(true);
      setEditError("");

      try {
        await apiClient.put(
          `/customers/${customerId}`,
          {
            full_name:
              form.full_name.trim(),

            email:
              form.email.trim(),

            phone:
              form.phone.trim(),

            gender:
              form.gender.trim(),

            nationality:
              form.nationality.trim(),

            address:
              form.address.trim(),

            id_proof_type:
              form.id_proof_type.trim(),

            id_proof_number:
              form.id_proof_number.trim(),

            profile_image:
              form.profile_image.trim(),
          }
        );

        await loadDetails();

        setShowEdit(false);
      } catch (requestError) {
        console.error(
          "[CUSTOMER_DETAILS:UPDATE]",
          requestError
        );

        setEditError(
          requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Customer profile could not be updated."
        );
      } finally {
        setSaving(false);
      }
    };


  if (loading) {
    return (
      <div className="customer-details-page">
        <div className="customer-details-state">
          Loading customer details...
        </div>
      </div>
    );
  }


  if (
    error ||
    !details
  ) {
    return (
      <div className="customer-details-page">
        <div className="customer-details-state customer-details-state--error">
          <h2>
            Customer details unavailable
          </h2>

          <p>
            {error}
          </p>

          <div className="customer-details-state-actions">
            <button
              type="button"
              onClick={() =>
                void loadDetails()
              }
            >
              Retry
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/customers"
                )
              }
            >
              Back to Customers
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="customer-details-page">

      <div className="customer-details-breadcrumb">
        <button
          type="button"
          onClick={() =>
            navigate(
              "/customers"
            )
          }
        >
          Customers
        </button>

        <span>
          /
        </span>

        <strong>
          {customerDisplayId}
        </strong>
      </div>


      <div className="customer-details-header">
        <div>
          <span className="customer-details-kicker">
            Customer Profile
          </span>

          <h1>
            {displayValue(
              profile.full_name,
              "Customer"
            )}
          </h1>

          <p>
            {customerDisplayId}
            {" · "}
            {formatStatus(
              insights.currentStatus
            )}
          </p>
        </div>

        <div className="customer-details-header-actions">
          <button
            type="button"
            className="customer-details-secondary-button"
            onClick={() =>
              navigate(
                "/customers"
              )
            }
          >
            Back
          </button>

          <button
            type="button"
            className="customer-details-primary-button"
            onClick={
              openEdit
            }
          >
            Edit Profile
          </button>
        </div>
      </div>


      <section className="customer-details-panel">
        <div className="customer-details-section-heading">
          <div>
            <h2>
              Customer Information
            </h2>

            <p>
              Hotel-scoped customer profile and identity details.
            </p>
          </div>
        </div>

        <div className="customer-details-info-grid">
          <InfoItem
            label="Customer ID"
            value={
              customerDisplayId
            }
          />

          <InfoItem
            label="Phone"
            value={
              profile.phone
            }
          />

          <InfoItem
            label="Email"
            value={
              profile.email
            }
          />

          <InfoItem
            label="Gender"
            value={
              formatStatus(
                profile.gender
              )
            }
          />

          <InfoItem
            label="Nationality"
            value={
              profile.nationality
            }
          />

          <InfoItem
            label="Address"
            value={
              profile.address
            }
          />

          <InfoItem
            label="ID Proof Type"
            value={
              profile.id_proof_type
            }
          />

          <InfoItem
            label="ID Proof Number"
            value={
              profile.id_proof_number
            }
          />

          <InfoItem
            label="Customer Since"
            value={
              formatDateTime(
                profile.created_at
              )
            }
          />
        </div>
      </section>


      <section className="customer-details-panel">
        <div className="customer-details-section-heading">
          <div>
            <h2>
              Lifetime Statistics
            </h2>

            <p>
              Calculated from real booking and payment history.
            </p>
          </div>
        </div>

        <div className="customer-details-stats-grid">
          <StatCard
            label="Lifetime Bookings"
            value={
              numberValue(
                stats.lifetimeBookings
              )
            }
            hint="All bookings"
          />

          <StatCard
            label="Completed / Started Stays"
            value={
              numberValue(
                stats.stayedBookings
              )
            }
            hint="Actual check-in recorded"
          />

          <StatCard
            label="Total Nights"
            value={
              numberValue(
                stats.totalNights
              )
            }
            hint="Actual stay duration"
          />

          <StatCard
            label="Average Stay"
            value={`${numberValue(
              stats.averageStayNights
            )} nights`}
            hint="Per actual stay"
          />

          <StatCard
            label="Total Paid"
            value={
              formatCurrency(
                stats.totalSpent
              )
            }
            hint="Successful payments net of refunds"
          />

          <StatCard
            label="Cancellations"
            value={
              numberValue(
                stats.cancellations
              )
            }
            hint="Cancelled bookings"
          />

          <StatCard
            label="No Shows"
            value={
              numberValue(
                stats.noShows
              )
            }
            hint="No-show bookings"
          />

          <StatCard
            label="Repeat Guest"
            value={
              insights.isRepeatGuest
                ? "Yes"
                : "No"
            }
            hint={`${numberValue(
              insights.completedStays
            )} actual stays`}
          />
        </div>
      </section>


      <section className="customer-details-panel">
        <div className="customer-details-section-heading">
          <div>
            <h2>
              Stay Timeline
            </h2>

            <p>
              First, latest and upcoming stay information.
            </p>
          </div>
        </div>

        <div className="customer-details-info-grid">
          <InfoItem
            label="First Stay"
            value={
              formatDateTime(
                stats.firstStay
              )
            }
          />

          <InfoItem
            label="Last Stay"
            value={
              formatDateTime(
                stats.lastStay
              )
            }
          />

          <InfoItem
            label="Upcoming Stay"
            value={
              formatDateTime(
                stats.upcomingStay
              )
            }
          />

          <InfoItem
            label="Current Booking"
            value={
              currentBooking
                ? displayValue(
                    currentBooking.booking_code,
                    `Booking #${currentBooking.booking_id}`
                  )
                : "None"
            }
          />

          <InfoItem
            label="Next Booking"
            value={
              upcomingBooking
                ? displayValue(
                    upcomingBooking.booking_code,
                    `Booking #${upcomingBooking.booking_id}`
                  )
                : "None"
            }
          />

          <InfoItem
            label="Customer Status"
            value={
              formatStatus(
                insights.currentStatus
              )
            }
          />
        </div>
      </section>


      <section className="customer-details-panel">
        <div className="customer-details-section-heading">
          <div>
            <h2>
              Complete Booking History
            </h2>

            <p>
              Every booking owned by this customer in the current hotel.
            </p>
          </div>

          <span>
            {bookings.length}{" "}
            {bookings.length === 1
              ? "booking"
              : "bookings"}
          </span>
        </div>

        {bookings.length === 0 ? (
          <EmptyState>
            No booking history exists for this customer yet.
          </EmptyState>
        ) : (
          <div className="customer-details-table-wrap">
            <table className="customer-details-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Room</th>
                  <th>Stay</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {bookings.map(
                  (booking) => (
                    <tr
                      key={
                        booking.booking_id
                      }
                    >
                      <td>
                        <strong>
                          {displayValue(
                            booking.booking_code,
                            `Booking #${booking.booking_id}`
                          )}
                        </strong>

                        <small>
                          {formatStatus(
                            booking.booking_source
                          )}
                        </small>
                      </td>

                      <td>
                        <strong>
                          {displayValue(
                            booking.room_number,
                            `Room #${booking.room_id}`
                          )}
                        </strong>

                        <small>
                          {displayValue(
                            booking.room_type
                          )}
                        </small>
                      </td>

                      <td>
                        <strong>
                          {formatDateTime(
                            booking.check_in
                          )}
                        </strong>

                        <small>
                          to{" "}
                          {formatDateTime(
                            booking.check_out
                          )}
                        </small>
                      </td>

                      <td>
                        {formatStatus(
                          booking.booking_status
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          booking.payment_status
                        )}
                      </td>

                      <td>
                        {formatCurrency(
                          booking.total_amount
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


      {meaningfulRoomChanges.length > 0 && (
        <section className="customer-details-panel">
          <div className="customer-details-section-heading">
            <div>
              <h2>
                Room Changes / Upgrades / Downgrades
              </h2>

              <p>
                Only genuine room movements are shown here. Initial room assignments remain in Complete Booking History.
              </p>
            </div>

            <span>
              {meaningfulRoomChanges.length}{" "}
              {meaningfulRoomChanges.length === 1
                ? "change"
                : "changes"}
            </span>
          </div>

          <div className="customer-details-table-wrap">
            <table className="customer-details-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Room</th>
                  <th>Period</th>
                  <th>Assignment</th>
                  <th>Rate</th>
                  <th>Reason</th>
                </tr>
              </thead>

              <tbody>
                {meaningfulRoomChanges.map(
                  (item) => (
                    <tr
                      key={
                        item.room_history_id
                      }
                    >
                      <td>
                        {displayValue(
                          item.booking_code,
                          `Booking #${item.booking_id}`
                        )}
                      </td>

                      <td>
                        <strong>
                          {displayValue(
                            item.room_number,
                            `Room #${item.room_id}`
                          )}
                        </strong>

                        <small>
                          {displayValue(
                            item.room_type
                          )}
                        </small>
                      </td>

                      <td>
                        <strong>
                          {formatDateTime(
                            item.assignment_start
                          )}
                        </strong>

                        <small>
                          to{" "}
                          {formatDateTime(
                            item.assignment_end
                          )}
                        </small>
                      </td>

                      <td>
                        {formatStatus(
                          item.assignment_status
                        )}
                      </td>

                      <td>
                        {formatCurrency(
                          item.rate_per_night
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          item.change_reason
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="customer-details-panel">
        <div className="customer-details-section-heading">
          <div>
            <h2>
              Payment History
            </h2>

            <p>
              Booking payments and refunds recorded for this customer.
            </p>
          </div>

          <span>
            {payments.length} records
          </span>
        </div>

        {payments.length === 0 ? (
          <EmptyState>
            No booking payment history exists for this customer yet.
          </EmptyState>
        ) : (
          <div className="customer-details-table-wrap">
            <table className="customer-details-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Booking</th>
                  <th>Type</th>
                  <th>Stage</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {payments.map(
                  (payment) => (
                    <tr
                      key={
                        payment.payment_id
                      }
                    >
                      <td>
                        {formatDateTime(
                          payment.payment_date
                        )}
                      </td>

                      <td>
                        {displayValue(
                          payment.booking_code,
                          `Booking #${payment.booking_id}`
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          payment.transaction_type
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          payment.payment_stage
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          payment.payment_method
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          payment.payment_status
                        )}
                      </td>

                      <td>
                        {payment.transaction_type ===
                        "refund"
                          ? "-"
                          : ""}
                        {formatCurrency(
                          payment.amount
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


      <section className="customer-details-panel">
        <div className="customer-details-section-heading">
          <div>
            <h2>
              Reservation Payments
            </h2>

            <p>
              Payments recorded at reservation-group level.
            </p>
          </div>

          <span>
            {reservationPayments.length} records
          </span>
        </div>

        {reservationPayments.length === 0 ? (
          <EmptyState>
            No reservation-level payments exist for this customer.
          </EmptyState>
        ) : (
          <div className="customer-details-table-wrap">
            <table className="customer-details-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reservation</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {reservationPayments.map(
                  (payment) => (
                    <tr
                      key={
                        payment.group_payment_id
                      }
                    >
                      <td>
                        {formatDateTime(
                          payment.created_at
                        )}
                      </td>

                      <td>
                        {displayValue(
                          payment.group_code,
                          `Group #${payment.reservation_group_id}`
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          payment.payment_method
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          payment.payment_status
                        )}
                      </td>

                      <td>
                        {formatCurrency(
                          payment.amount
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


      <section className="customer-details-panel">
        <div className="customer-details-section-heading">
          <div>
            <h2>
              Customer Documents
            </h2>

            <p>
              Real document metadata stored for this hotel customer.
            </p>
          </div>

          <span>
            {documents.length}{" "}
            {documents.length === 1
              ? "document"
              : "documents"}
          </span>
        </div>

        {documents.length === 0 ? (
          <EmptyState>
            No customer documents are currently stored.
          </EmptyState>
        ) : (
          <div className="customer-details-document-grid">
            {documents.map(
              (document) => (
                <article
                  className="customer-details-document"
                  key={
                    document.document_id
                  }
                >
                  <div>
                    <strong>
                      {displayValue(
                        document.document_type,
                        "Document"
                      )}
                    </strong>

                    <span>
                      {displayValue(
                        document.original_file_name,
                        "Stored document"
                      )}
                    </span>
                  </div>

                  <div className="customer-details-document-meta">
                    <span>
                      Number:{" "}
                      {displayValue(
                        document.document_number
                      )}
                    </span>

                    <span>
                      {document.is_verified
                        ? "Verified"
                        : "Not Verified"}
                    </span>

                    <span>
                      Added{" "}
                      {formatDateTime(
                        document.created_at
                      )}
                    </span>
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>


      {showEdit && (
        <div
          className="customer-details-modal-overlay"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget &&
              !saving
            ) {
              setShowEdit(false);
            }
          }}
        >
          <form
            className="customer-details-modal"
            onSubmit={
              saveProfile
            }
          >
            <div className="customer-details-modal-header">
              <div>
                <h2>
                  Edit Customer
                </h2>

                <p>
                  Hotel scope is resolved by the authenticated backend.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  setShowEdit(false)
                }
              >
                ×
              </button>
            </div>

            <div className="customer-details-form-grid">
              <label>
                <span>
                  Full Name *
                </span>

                <input
                  value={
                    form.full_name
                  }
                  onChange={(
                    event
                  ) =>
                    handleFormChange(
                      "full_name",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Phone *
                </span>

                <input
                  value={
                    form.phone
                  }
                  onChange={(
                    event
                  ) =>
                    handleFormChange(
                      "phone",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Email
                </span>

                <input
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(
                    event
                  ) =>
                    handleFormChange(
                      "email",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Gender
                </span>

                <input
                  value={
                    form.gender
                  }
                  onChange={(
                    event
                  ) =>
                    handleFormChange(
                      "gender",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Nationality
                </span>

                <input
                  value={
                    form.nationality
                  }
                  onChange={(
                    event
                  ) =>
                    handleFormChange(
                      "nationality",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>
                  ID Proof Type
                </span>

                <input
                  value={
                    form.id_proof_type
                  }
                  onChange={(
                    event
                  ) =>
                    handleFormChange(
                      "id_proof_type",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>
                  ID Proof Number
                </span>

                <input
                  value={
                    form.id_proof_number
                  }
                  onChange={(
                    event
                  ) =>
                    handleFormChange(
                      "id_proof_number",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="customer-details-form-wide">
                <span>
                  Address
                </span>

                <textarea
                  rows="3"
                  value={
                    form.address
                  }
                  onChange={(
                    event
                  ) =>
                    handleFormChange(
                      "address",
                      event.target.value
                    )
                  }
                />
              </label>
            </div>

            {editError && (
              <div className="customer-details-edit-error">
                {editError}
              </div>
            )}

            <div className="customer-details-modal-actions">
              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  setShowEdit(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving
                }
                className="customer-details-primary-button"
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}


export default CustomerDetailsPage;