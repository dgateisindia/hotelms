import { formatCurrency } from "../../../shared/utils/money";

function ReservationGroupSummary({
  summary,
}) {
  return (
<div className="booking-stats">

        <div className="bstat-card">

          <div className="bstat-info">

            <span className="bstat-label">
              Rooms
            </span>

            <strong className="bstat-value">
              {Number(
                summary.total_rooms ||
                0
              )}
            </strong>

            <span className="bstat-change">
              Reservation bookings
            </span>

          </div>

        </div>


        <div className="bstat-card">

          <div className="bstat-info">

            <span className="bstat-label">
               Active Guests
            </span>

            <strong className="bstat-value">
              {Number(
                summary.total_guests ||
                0
              )}
            </strong>

            <span className="bstat-change">
              Expected + checked-in allocations
            </span>

          </div>

        </div>


        <div className="bstat-card">

          <div className="bstat-info">

            <span className="bstat-label">
              Final Payable
            </span>

            <strong className="bstat-value">
              {formatCurrency(
                summary.financial_payable_total
              )}
            </strong>

            <span className="bstat-change">
              Finalized reservation payable
            </span>

          </div>

        </div>


        <div className="bstat-card">

          <div className="bstat-info">

            <span className="bstat-label">
              Balance Due
            </span>

            <strong className="bstat-value">
              {formatCurrency(
                summary.outstanding_amount
              )}
            </strong>

            <span className="bstat-change">
              Net paid{" "}
              {formatCurrency(
                summary.net_paid
              )}
            </span>

          </div>

        </div>

      </div>
  );
}

export default ReservationGroupSummary;
