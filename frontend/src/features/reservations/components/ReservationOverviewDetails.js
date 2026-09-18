function ReservationOverviewDetails({
  customer,
  group,
  summary,
}) {
  return (
<div className="bookings-card">

        <div className="reservation-group-info-grid">

          <section className="booking-detail-section">

            <h4>
              Reservation Contact
            </h4>


            <div className="booking-detail-row">

              <span>
                Contact Name
              </span>

              <strong>
                {customer.full_name ||
                  "—"}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Phone
              </span>

              <strong>
                {customer.phone ||
                  "—"}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Email
              </span>

              <strong>
                {customer.email ||
                  "—"}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Nationality
              </span>

              <strong>
                {customer.nationality ||
                  "—"}
              </strong>

            </div>

          </section>


          <section className="booking-detail-section">

            <h4>
              Reservation Summary
            </h4>


            <div className="booking-detail-row">

              <span>
                Group Code
              </span>

              <strong>
                {group.group_code}
              </strong>

            </div>

            <div className="booking-detail-row">
              <span>
                Pending
              </span>

              <strong>
                {Number(
                  summary.pending_bookings ||
                  0
                )}
              </strong>
            </div>


            <div className="booking-detail-row">
              <span>
                Confirmed
              </span>

              <strong>
                {Number(
                  summary.confirmed_bookings ||
                  0
                )}
              </strong>
            </div>


            <div className="booking-detail-row">
              <span>
                Checked In
              </span>

              <strong>
                {Number(
                  summary.checked_in_bookings ||
                  0
                )}
              </strong>
            </div>


            <div className="booking-detail-row">
              <span>
                Checked Out
              </span>

              <strong>
                {Number(
                  summary.checked_out_bookings ||
                  0
                )}
              </strong>
            </div>


            <div className="booking-detail-row">
              <span>
                Cancelled
              </span>

              <strong>
                {Number(
                  summary.cancelled_bookings ||
                  0
                )}
              </strong>
            </div>


            <div className="booking-detail-row">
              <span>
                No Show
              </span>

              <strong>
                {Number(
                  summary.no_show_bookings ||
                  0
                )}
              </strong>
            </div>


            <div className="booking-detail-row">
              <span>
                Expired
              </span>

              <strong>
                {Number(
                  summary.expired_bookings ||
                  0
                )}
              </strong>
            </div>

          </section>

        </div>

      </div>
  );
}

export default ReservationOverviewDetails;
