function BookingDeskLoadState({
  loading = false,
  loadError = "",
  isAddRoomMode = false,
  onBack,
}) {
  if (loading) {
    return (
      <div className="booking-desk-page">
        <div className="booking-desk-state">
          Loading booking...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="booking-desk-page">
        <div className="booking-desk-load-error">
          <h2>Reservation Locked</h2>

          <p>{loadError}</p>

          <button
            type="button"
            onClick={onBack}
          >
            {isAddRoomMode
              ? "Back to Reservation Group"
              : "Back to Bookings"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default BookingDeskLoadState;
