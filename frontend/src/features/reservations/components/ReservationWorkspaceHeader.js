function ReservationWorkspaceHeader({
  group,
  canAddRoom,
  canGroupCheckIn,
  canGroupPayment,
  canGroupCheckout,
  onBack,
  onGroupCheckIn,
  onGroupPayment,
  onGroupCheckout,
  onAddRoom,
}) {
  return (
<div className="bookings-page-header">

        <div>

          <button
            type="button"
            className="booking-clear-filters"
            onClick={onBack}
          >
            ← Back to Bookings
          </button>


          <h1>
            Reservation Group{" "}
            {group.group_code}
          </h1>


          <p>
            Manage all room reservations created under this
            customer reservation.
          </p>

        </div>

        <div className="booking-actions">

          <button
            type="button"
            className="booking-btn-secondary"
            disabled={!canGroupCheckIn}
            onClick={onGroupCheckIn}
            title={
              canGroupCheckIn
                ? "Manage actual guest arrivals across this reservation group"
                : "No room currently allows guest check-in"
            }
          >
            Group Check-In
          </button>


          <button
            type="button"
            className="booking-btn-secondary"
            disabled={!canGroupPayment}
            onClick={onGroupPayment}
            title={
              canGroupPayment
                ? "Collect payment across this reservation group"
                : "No eligible outstanding payment is currently available"
            }
          >
            Group Payment
          </button>

          <button
            type="button"
            className="booking-btn-secondary"
            disabled={!canGroupCheckout}
            onClick={onGroupCheckout}
            title={
              canGroupCheckout
                ? "Check out all or selected checked-in rooms"
                : "No checked-in room is currently available for checkout"
            }
          >
            Group Check-Out
          </button>

          <button
            type="button"
            className="booking-new-button"
            disabled={!canAddRoom}
            onClick={() => {
              if (!canAddRoom) {
                return;
              }

              onAddRoom();
            }}
            title={
              canAddRoom
                ? "Add another room to this reservation group"
                : "Rooms cannot be added because this reservation group has no active booking."
            }
          >
            + Add Room
          </button>

        </div>

      </div>
  );
}

export default ReservationWorkspaceHeader;
