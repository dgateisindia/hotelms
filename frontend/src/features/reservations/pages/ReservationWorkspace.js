import { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import apiClient from "../../../shared/api/apiClient";
import AppAlert from "../../../shared/components/ui/AppAlert";



import GroupCheckInDialog from "../actions/GroupCheckInDialog";
import GroupCheckoutDialog from "../actions/GroupCheckoutDialog";
import GroupPaymentDialog from "../actions/GroupPaymentDialog";
import CollectPaymentDialog from "../actions/CollectPaymentDialog";
import FinancialSettlementReviewDialog from "../actions/FinancialSettlementReviewDialog";
import LifecycleRefundDialog from "../actions/LifecycleRefundDialog";
import ManageGuestsDialog from "../guests/ManageGuestsDialog";
import ReservationWorkspaceHeader from "../components/ReservationWorkspaceHeader";
import ReservationGroupSummary from "../components/ReservationGroupSummary";
import ReservationOverviewDetails from "../components/ReservationOverviewDetails";
import ReservationFinancialSummary from "../components/ReservationFinancialSummary";
import ReservationRoomBookings from "../components/ReservationRoomBookings";
import useReservationFinancialActions from "../hooks/useReservationFinancialActions";



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

  const [
    checkoutPaymentBookingIds,
    setCheckoutPaymentBookingIds,
  ] = useState([]);

  const financialActions =
    useReservationFinancialActions({
      group,
      refreshGroup,
    });


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


  const groupInvoice =
    group.group_invoice ||
    null;


  const hasGroupInvoice =
    Number(
      groupInvoice
        ?.invoice_id ||
      0
    ) > 0;

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

      <AppAlert
        type="success"
        message={
          financialActions.operationSuccess
        }
        onClose={
          financialActions.clearOperationSuccess
        }
        autoClose
      />

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
          onGroupPayment={() => {
            setCheckoutPaymentBookingIds([]);
            setShowGroupPayment(true);
          }}
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
          QUICK RESERVATION SUMMARY
      ====================================================== */}

        <ReservationGroupSummary
          summary={summary}
        />



      {/* ======================================================
          PRIMARY ACCESS
          Invoice + room bookings stay near the top because
          they are the most frequently accessed reservation
          records during front-desk operations.
      ====================================================== */}



        {hasGroupInvoice && (
          <div className="bookings-card reservation-group-invoice-card">

            <div className="reservation-group-invoice-main">

              <div className="reservation-group-invoice-copy">

                <span className="reservation-group-invoice-kicker">
                  CONSOLIDATED INVOICE
                </span>

                <strong className="reservation-group-invoice-number">
                  {groupInvoice.invoice_number}
                </strong>

                <div className="reservation-group-invoice-meta">

                  <span>
                    {new Intl.NumberFormat(
                      "en-IN",
                      {
                        style:
                          "currency",

                        currency:
                          "INR",

                        minimumFractionDigits:
                          2,

                        maximumFractionDigits:
                          2,
                      }
                    ).format(
                      Number(
                        groupInvoice
                          .total_amount ||
                        0
                      )
                    )}
                  </span>

                  <span
                    className={`reservation-group-invoice-status reservation-group-invoice-status--${String(
                      groupInvoice
                        .invoice_status ||
                      "unknown"
                    )
                      .trim()
                      .toLowerCase()}`}
                  >
                    {String(
                      groupInvoice
                        .invoice_status ||
                      "unknown"
                    )
                      .replace(
                        /_/g,
                        " "
                      )}
                  </span>

                </div>

              </div>


              <button
                type="button"
                className="reservation-group-invoice-action"
                onClick={() =>
                  navigate(
                    `/billing?invoice=${groupInvoice.invoice_id}`
                  )
                }
              >
                View / Print Invoice
              </button>

            </div>

          </div>
        )}


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
          onReviewSettlement={(booking) =>
            void financialActions.openFinancialSettlementReview(
              booking
            )
          }
          onCollectPayment={
            financialActions.openCollectPayment
          }
          onRefund={
            financialActions.openLifecycleRefund
          }
          hideInvoiceActions={
            hasGroupInvoice
          }
          onViewInvoice={(booking) =>
            navigate(
              `/billing?invoice=${booking.invoice_id}`
            )
          }
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
{showGroupPayment && (
        <GroupPaymentDialog
          group={group}
          initialBookingIds={checkoutPaymentBookingIds}
          onClose={() => {
            setShowGroupPayment(false);
            setCheckoutPaymentBookingIds([]);
          }}
          onChanged={refreshGroup}
          onContinueToCheckout={
            checkoutPaymentBookingIds.length > 0
              ? () => {
                  setShowGroupPayment(false);
                  setCheckoutPaymentBookingIds([]);
                  setShowGroupCheckout(true);
                }
              : undefined
          }
        />
      )}

      {showGroupCheckout && (
        <GroupCheckoutDialog
          group={group}
          onClose={() =>
            setShowGroupCheckout(false)
          }
          onChanged={refreshGroup}
          onCollectPayment={(bookingIds) => {
            setShowGroupCheckout(false);
            setCheckoutPaymentBookingIds(bookingIds);
            setShowGroupPayment(true);
          }}
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

      <FinancialSettlementReviewDialog
        booking={
          financialActions.financialReviewBooking
        }
        review={
          financialActions.financialReviewData
        }
        finalPayable={
          financialActions.financialReviewFinalPayable
        }
        reviewNotes={
          financialActions.financialReviewNotes
        }
        loading={
          financialActions.financialReviewLoading
        }
        processing={
          financialActions.financialReviewProcessing
        }
        error={
          financialActions.financialReviewError
        }
        onChangeFinalPayable={
          financialActions.setFinancialReviewFinalPayable
        }
        onChangeReviewNotes={
          financialActions.setFinancialReviewNotes
        }
        onClose={
          financialActions.closeFinancialSettlementReview
        }
        onConfirm={() =>
          void financialActions.confirmFinancialSettlementReview()
        }
      />

      <CollectPaymentDialog
        booking={
          financialActions.paymentBooking
        }
        amount={
          financialActions.paymentAmount
        }
        method={
          financialActions.paymentMethod
        }
        transactionId={
          financialActions.paymentTransactionId
        }
        notes={
          financialActions.paymentNotes
        }
        processing={
          financialActions.paymentProcessing
        }
        error={
          financialActions.paymentError
        }
        onChangeAmount={
          financialActions.setPaymentAmount
        }
        onChangeMethod={
          financialActions.setPaymentMethod
        }
        onChangeTransactionId={
          financialActions.setPaymentTransactionId
        }
        onChangeNotes={
          financialActions.setPaymentNotes
        }
        onClose={
          financialActions.closeCollectPayment
        }
        onConfirm={() =>
          void financialActions.confirmCollectPayment()
        }
      />

      <LifecycleRefundDialog
        booking={
          financialActions.refundBooking
        }
        method={
          financialActions.refundMethod
        }
        transactionId={
          financialActions.refundTransactionId
        }
        notes={
          financialActions.refundNotes
        }
        processing={
          financialActions.refundProcessing
        }
        error={
          financialActions.refundError
        }
        onChangeMethod={
          financialActions.setRefundMethod
        }
        onChangeTransactionId={
          financialActions.setRefundTransactionId
        }
        onChangeNotes={
          financialActions.setRefundNotes
        }
        onClose={
          financialActions.closeLifecycleRefund
        }
        onConfirm={() =>
          void financialActions.confirmLifecycleRefund()
        }
      />

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