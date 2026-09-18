function BookingDeskFooter({
  step,
  submitting,
  quoteLoading,
  pricingSaveBlocked,
  pricingMessage,
  isEditMode,
  isAddRoomMode,
  selectedRoomCount,
  backIcon,
  submitIcon,
  onBack,
  onCancel,
  onContinue,
  onSubmit,
}) {
  return (
<div className="booking-desk-footer">

          <div>

            {step > 1 && (
              <button
                type="button"
                className="booking-desk-btn booking-desk-btn--secondary"
                disabled={
                  submitting
                }
                onClick={onBack}
              >
                {backIcon}

                Back
              </button>
            )}

          </div>


          <div className="booking-desk-footer__right">

            <button
              type="button"
              className="booking-desk-btn booking-desk-btn--ghost"
              disabled={
                submitting
              }
              onClick={onCancel}
            >
              Cancel
            </button>


            {step < 4 ? (
              <button
                type="button"
                className="booking-desk-btn booking-desk-btn--primary"
                disabled={
                  submitting ||
                  (
                    step === 2 &&
                    (
                      quoteLoading ||
                      pricingSaveBlocked
                    )
                  )
                }
                title={
                  pricingSaveBlocked
                    ? (
                        pricingMessage ||
                        "Resolve the payment adjustment before continuing."
                      )
                    : undefined
                }
                onClick={onContinue}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="booking-desk-btn booking-desk-btn--primary"
                disabled={
                  submitting ||
                  quoteLoading ||
                  pricingSaveBlocked
                }
                onClick={onSubmit}
              >
                {submitIcon}

                {submitting
                  ? "Saving..."
                  : isEditMode
                    ? "Save Changes"
                    : isAddRoomMode
                      ? selectedRoomCount > 1
                        ? "Add Rooms"
                        : "Add Room"
                      : selectedRoomCount > 1
                        ? "Confirm Reservations"
                        : "Confirm Reservation"}
              </button>
            )}

          </div>

        </div>
  );
}

export default BookingDeskFooter;
