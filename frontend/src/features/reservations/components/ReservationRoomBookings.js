import ReservationRoomRow from "./ReservationRoomRow";

function ReservationRoomBookings({
  bookings,
  expandedBookingId,
  onToggleExpanded,
  onManageGuests,
  onEdit,
  onReviewSettlement,
  onCollectPayment,
  onRefund,
  hideInvoiceActions = false,
  onViewInvoice,
}) {
  return (
<div className="bookings-card">

        <div className="bookings-table-wrap">

          <table className="bookings-table reservation-group-bookings-table">

            <thead>

              <tr>

                <th>
                  Booking
                </th>

                <th>
                  Room
                </th>

                <th>
                  Stay
                </th>

                <th>
                  Occupancy
                </th>

                <th>
                  Amount
                </th>

                <th>
                  Payment
                </th>

                <th>
                  Status
                </th>

                <th>
                  Actions
                </th>

              </tr>

            </thead>


            <tbody>

              {bookings.map((booking) => (
                <ReservationRoomRow
                  key={booking.booking_id}
                  booking={booking}
                  expanded={
                    expandedBookingId ===
                    Number(booking.booking_id)
                  }
                  onToggleExpanded={() => onToggleExpanded(Number(booking.booking_id))}
                  onManageGuests={() => onManageGuests(booking)}
                  onEdit={() => onEdit(Number(booking.booking_id))}
                  onReviewSettlement={() =>
                    onReviewSettlement(booking)
                  }
                  onCollectPayment={() =>
                    onCollectPayment(booking)
                  }
                  onRefund={() =>
                    onRefund(booking)
                  }
                  hideInvoiceAction={
                    hideInvoiceActions
                  }
                  onViewInvoice={() =>
                    onViewInvoice(booking)
                  }
                />
              ))}

            </tbody>

          </table>

        </div>

      </div>
  );
}

export default ReservationRoomBookings;
