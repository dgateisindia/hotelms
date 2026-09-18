function BookingDeskHeader({
  isEditMode,
  isAddRoomMode,
  reservationGroup,
  guest,
  backIcon,
  onBack,
}) {
  return (
<div className="booking-desk-header">

        <div>
          <h1>
            {isEditMode
              ? "Edit Reservation"
              : isAddRoomMode
                ? `Add Room to ${reservationGroup?.group_code || "Reservation"}`
                : "Booking Desk"}
          </h1>

          <p>
            {isEditMode
              ? "Update this reservation before the guest checks in."
              : isAddRoomMode
                ? `Add additional room reservations for ${guest.guest_name || "this guest"}.`
                : "Create a hotel reservation using the guided front-desk flow."}
          </p>
        </div>


        <button
          type="button"
          className="booking-desk-back-link"
          onClick={onBack}
        >
          {backIcon}

          {isAddRoomMode
            ? "Back to Reservation Group"
            : "Back to Bookings"}
        </button>

      </div>
  );
}

export default BookingDeskHeader;
