import { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import apiClient from "../../../shared/api/apiClient";



import GroupCheckInDialog from "../actions/GroupCheckInDialog";
import GroupCheckoutDialog from "../actions/GroupCheckoutDialog";
import GroupPaymentDialog from "../actions/GroupPaymentDialog";
import ManageGuestsDialog from "../guests/ManageGuestsDialog";
import ReservationWorkspaceHeader from "../components/ReservationWorkspaceHeader";
import ReservationGroupSummary from "../components/ReservationGroupSummary";
import ReservationOverviewDetails from "../components/ReservationOverviewDetails";
import ReservationFinancialSummary from "../components/ReservationFinancialSummary";
import ReservationRoomBookings from "../components/ReservationRoomBookings";



import "../../../styles/Bookings.css";



function ReservationWorkspace() {
  const navigate =
    useNavigate();


  const {
    groupId,
  } =
    useParams();


  const [
    group,
    setGroup,
  ] = useState(
    null
  );


  const [
    loading,
    setLoading,
  ] = useState(
    true
  );


  const [
    error,
    setError,
  ] = useState(
    ""
  );

  const [
    expandedBookingId,
    setExpandedBookingId,
  ] = useState(
    null
  );

  const [
    manageGuestsBooking,
    setManageGuestsBooking,
  ] = useState(
    null
  );

  const [showGroupCheckIn, setShowGroupCheckIn] = useState(false);
  const [showGroupPayment, setShowGroupPayment] = useState(false);
  const [showGroupCheckout, setShowGroupCheckout] = useState(false);


  useEffect(
    () => {
      let active =
        true;


      async function loadGroup() {
        setLoading(
          true
        );

        setError(
          ""
        );


        try {
          const response =
            await apiClient.get(
              `/bookings/groups/${groupId}`
            );


          if (!active) {
            return;
          }


          setGroup(
            response.data
              ?.data ||
            null
          );
        } catch (
          loadError
        ) {
          if (!active) {
            return;
          }


          setError(
            loadError
              ?.message ||
            "Reservation group could not be loaded."
          );
        } finally {
          if (active) {
            setLoading(
              false
            );
          }
        }
      }


      void loadGroup();


      return () => {
        active =
          false;
      };
    },
    [
      groupId,
    ]
  );

  async function refreshGroup() {
    try {
      const response =
        await apiClient.get(
          `/bookings/groups/${groupId}`
        );

      setGroup(
        response.data?.data ||
        null
      );
    } catch {
      /*
      * ManageGuestsDialog already shows the operation result.
      * Do not destroy the current group page only because
      * this lightweight parent refresh failed.
      */
    }
  }


  if (
    loading
  ) {
    return (
      <div className="bookings-page">

        <div className="bookings-card">

          <div className="bookings-loading">
            Loading reservation group...
          </div>

        </div>

      </div>
    );
  }


  if (
    error ||
    !group
  ) {
    return (
      <div className="bookings-page">

        <div className="bookings-error-banner">

          <span>
            {error ||
              "Reservation group was not found."}
          </span>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/bookings"
              )
            }
          >
            Back to Bookings
          </button>

        </div>

      </div>
    );
  }


  const summary =
    group.summary ||
    {};


  const customer =
    group.customer ||
    {};


  const bookings =
    Array.isArray(
      group.bookings
    )
      ? group.bookings
      : [];

  const canAddRoom =
    bookings.some(
      (booking) =>
        [
          "pending",
          "confirmed",
          "checked_in",
        ].includes(
          String(
            booking.booking_status ||
            ""
          ).toLowerCase()
        )
    );

  const canGroupCheckIn =
    bookings.some(
      (booking) =>
        [
          "confirmed",
          "checked_in",
        ].includes(
          String(
            booking.booking_status ||
            ""
          )
            .trim()
            .toLowerCase()
        )
    );

  const canGroupPayment =
    bookings.some((booking) => {
      const status =
        String(
          booking.booking_status || ""
        )
          .trim()
          .toLowerCase();

      return (
        [
          "confirmed",
          "checked_in",
          "no_show",
        ].includes(status) &&
        Number(
          booking.outstanding_amount || 0
        ) > 0.009 &&
        Number(
          booking.financial_review_required || 0
        ) !== 1
      );
    });

  const canGroupCheckout =
    bookings.some(
      (booking) =>
        String(
          booking.booking_status || ""
        )
          .trim()
          .toLowerCase() ===
        "checked_in"
    );

  return (
    <div className="bookings-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

        <ReservationWorkspaceHeader
          group={group}
          canAddRoom={canAddRoom}
          canGroupCheckIn={canGroupCheckIn}
          canGroupPayment={canGroupPayment}
          canGroupCheckout={canGroupCheckout}
          onBack={() =>
            navigate("/bookings")
          }
          onGroupCheckIn={() =>
            setShowGroupCheckIn(true)
          }
          onGroupPayment={() =>
            setShowGroupPayment(true)
          }
          onGroupCheckout={() =>
            setShowGroupCheckout(true)
          }
          onAddRoom={() =>
            navigate(
              `/booking-desk?group=${group.reservation_group_id}&mode=add-room`
            )
          }
        />

{/* ======================================================
          SUMMARY
      ====================================================== */}

        <ReservationGroupSummary
          summary={summary}
        />

{/* ======================================================
          CUSTOMER
      ====================================================== */}

        <ReservationOverviewDetails
          customer={customer}
          group={group}
          summary={summary}
        />


      {/* ======================================================
          FINANCIAL SUMMARY
      ====================================================== */}

        <ReservationFinancialSummary
          summary={summary}
        />


      {/* ======================================================
          ROOM BOOKINGS
      ====================================================== */}

        <ReservationRoomBookings
          bookings={bookings}
          expandedBookingId={expandedBookingId}
          onToggleExpanded={(bookingId) =>
            setExpandedBookingId(
              expandedBookingId === bookingId
                ? null
                : bookingId
            )
          }
          onManageGuests={(booking) =>
            setManageGuestsBooking(booking)
          }
          onEdit={(bookingId) =>
            navigate(
              `/booking-desk?edit=${bookingId}`
            )
          }
        />

{showGroupPayment && (
        <GroupPaymentDialog
          group={group}
          onClose={() =>
            setShowGroupPayment(false)
          }
          onChanged={refreshGroup}
        />
      )}

      {showGroupCheckout && (
        <GroupCheckoutDialog
          group={group}
          onClose={() =>
            setShowGroupCheckout(false)
          }
          onChanged={refreshGroup}
        />
      )}

      {showGroupCheckIn && (
        <GroupCheckInDialog
          group={
            group
          }
          onClose={() =>
            setShowGroupCheckIn(
              false
            )
          }
          onChanged={() =>
            void refreshGroup()
          }
          onManageRoom={(
            booking
          ) => {
            /*
            * Never stack two operational modals.
            * Close Group Check-In first,
            * then open the canonical room guest manager.
            */
            setShowGroupCheckIn(
              false
            );

            setManageGuestsBooking(
              booking
            );
          }}
        />
      )}

      <ManageGuestsDialog
        booking={
          manageGuestsBooking
        }
        onClose={() =>
          setManageGuestsBooking(
            null
          )
        }
        onChanged={() =>
          void refreshGroup()
        }
      />

    </div>
  );
}


export default ReservationWorkspace;