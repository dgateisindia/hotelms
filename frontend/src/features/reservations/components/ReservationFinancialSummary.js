import { formatCurrency } from "../../../shared/utils/money";

function ReservationFinancialSummary({
  summary,
}) {
  return (
<div className="bookings-card">

        <div className="reservation-group-info-grid">

          <section className="booking-detail-section">

            <h4>
              Group Payment Summary
            </h4>


            <div className="booking-detail-row">

              <span>
                Gross Paid
              </span>

              <strong>
                {formatCurrency(
                  summary.gross_paid
                )}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Refunded
              </span>

              <strong>
                {formatCurrency(
                  summary.refunded_amount
                )}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Net Paid
              </span>

              <strong>
                {formatCurrency(
                  summary.net_paid
                )}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Outstanding
              </span>

              <strong>
                {formatCurrency(
                  summary.outstanding_amount
                )}
              </strong>

            </div>

          </section>


          <section className="booking-detail-section">

            <h4>
              Financial Review
            </h4>


            <div className="booking-detail-row">

              <span>
                Overpaid
              </span>

              <strong>
                {formatCurrency(
                  summary.overpaid_amount
                )}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Refund Review
              </span>

              <strong>
                {summary
                  .refund_review_required
                  ? "Required"
                  : "Not Required"}
              </strong>

            </div>

          </section>

        </div>

      </div>
  );
}

export default ReservationFinancialSummary;
