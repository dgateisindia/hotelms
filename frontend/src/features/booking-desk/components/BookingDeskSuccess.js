function BookingDeskSuccess({
  success,
  fallbackNights,
  isEditMode,
  isAddRoomMode,
  successIcon,
  newBookingIcon,
  formatCurrency,
  formatDate,
  formatStayDateTime,
  formatStayDuration,
  getPaymentDisplayStatus,
  onBack,
  onNewBooking,
}) {
    const paid =
      Number(
        success.amountReceived ||
        0
      );


    const total =
      Number(
        success.grandTotal ||
        0
      );


    const due =
      Number(
        success.balanceDue ||
        0
      );


    const status =
      success.paymentStatus
        ? String(
            success.paymentStatus
          )
            .replaceAll(
              "_",
              " "
            )
        : getPaymentDisplayStatus(
            paid,
            total
          );

    const successBookings =
      Array.isArray(
        success.bookings
      )
        ? success.bookings
        : [];


    const hasMultipleSuccessRooms =
      successBookings.length > 1;

    return (
      <div className="booking-desk-page">

        <div className="booking-desk-success">

          <div className="booking-desk-success__icon">
            {successIcon}
          </div>


          <h1>
            {success.title}
          </h1>


          <p>
            {success.message}
          </p>


          <div className="booking-desk-review-grid">

            <section className="booking-desk-review-card">

              <h3>Stay Summary</h3>

              <div>
                <span>
                  Guest
                </span>

                <strong>
                  {success.guestName ||
                    "—"}
                </strong>
              </div>

              {success.addRoomMode && (
                <div>
                  <span>
                    Reservation Group
                  </span>

                  <strong>
                    {success.groupCode ||
                      "—"}
                  </strong>
                </div>
              )}

              <div>
                <span>
                  Stay Type
                </span>

                <strong>
                  {success.stayType ===
                    "day_use"
                    ? "Day Use / Short Stay"
                    : "Overnight Stay"}
                </strong>
              </div>


              {hasMultipleSuccessRooms ? (

                <div>

                  <span>
                    Stay Timing
                  </span>

                  <strong>
                    Room-specific timings shown below
                  </strong>

                </div>

              ) : (
                <>

                  <div>

                    <span>
                      Check In
                    </span>

                    <strong>
                      {success.stayType ===
                      "day_use"
                        ? formatStayDateTime(
                            success.checkIn
                          )
                        : formatDate(
                            success.checkIn
                          )}
                    </strong>

                  </div>


                  <div>

                    <span>
                      {success.stayType ===
                      "day_use"
                        ? "Check Out"
                        : "Expected Check Out"}
                    </span>

                    <strong>
                      {success.stayType ===
                      "day_use"
                        ? formatStayDateTime(
                            success.checkOut
                          )
                        : formatDate(
                            success.checkOut
                          )}
                    </strong>

                  </div>


                  <div>

                    <span>
                      {success.stayType ===
                      "day_use"
                        ? "Stay Duration"
                        : "Nights"}
                    </span>

                    <strong>
                      {success.stayType ===
                      "day_use"
                        ? formatStayDuration(
                            success.durationMinutes
                          )
                        : success.nights ||
                          fallbackNights}
                    </strong>

                  </div>

                </>
              )}

            </section>


            <section className="booking-desk-review-card">

              <h3>
                {success.addRoomMode
                  ? "Added Room Payment Summary"
                  : "Payment Summary"}
              </h3>

              <div>
                <span>
                  {success.addRoomMode
                    ? success.bookings?.length > 1
                      ? "Added Rooms Total"
                      : "Added Room Total"
                    : "Booking Total"}
                </span>

                <strong>
                  {formatCurrency(
                    total
                  )}
                </strong>
              </div>

              {success.refund ? (
                <>
                  <div>
                    <span>
                      Refund Processed
                    </span>

                    <strong>
                      -{formatCurrency(
                        success.refund.amount
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Refund Method
                    </span>

                    <strong className="booking-desk-capitalize">
                      {String(
                        success.refund.payment_method ||
                        ""
                      ).replaceAll(
                        "_",
                        " "
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Net Paid
                    </span>

                    <strong>
                      {formatCurrency(
                        paid
                      )}
                    </strong>
                  </div>
                </>
              ) : (
                <div>
                  <span>
                    Amount Received
                  </span>

                  <strong>
                    {formatCurrency(
                      paid
                    )}
                  </strong>
                </div>
              )}

              <div>
                <span>
                  Balance Due
                </span>

                <strong>
                  {formatCurrency(
                    due
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Payment Status
                </span>

                <strong className="booking-desk-capitalize">
                  {status}
                </strong>
              </div>

            </section>

          </div>


          {successBookings.length >
            0 && (
              <div className="booking-desk-success__bookings">

                {successBookings.map(
                  (
                    created
                  ) => {
                    const roomStayType =
                      created.stayType ||
                      success.stayType;

                    const roomCheckIn =
                      created.checkIn ||
                      created.check_in ||
                      success.checkIn ||
                      "";

                    const roomCheckOut =
                      created.checkOut ||
                      created.check_out ||
                      success.checkOut ||
                      "";

                    const roomNights =
                      Number(
                        created.nights ??
                        calculateNights(
                          roomCheckIn,
                          roomCheckOut
                        )
                      );

                    const roomDurationMinutes =
                      Number(
                        created.durationMinutes ??
                        created.duration_minutes ??
                        0
                      );

                    const roomTotal =
                      Number(
                        created.totalAmount ??
                        created.total_amount ??
                        0
                      );

                    return (
                      <div
                        key={
                          created.bookingId
                        }
                      >

                        <strong>
                          {created.bookingCode}
                          {" · "}
                          Room{" "}
                          {created.roomNumber}
                        </strong>


                        <span>

                          {created.roomType
                            ? `${created.roomType} · `
                            : ""}

                          {roomStayType ===
                          "day_use"
                            ? (
                                `${formatStayDateTime(
                                  roomCheckIn
                                )} → ${formatStayDateTime(
                                  roomCheckOut
                                )} · ${formatStayDuration(
                                  roomDurationMinutes
                                )}`
                              )
                            : (
                                `${formatDate(
                                  roomCheckIn
                                )} → ${formatDate(
                                  roomCheckOut
                                )} · ${roomNights} night${
                                  roomNights === 1
                                    ? ""
                                    : "s"
                                }`
                              )}

                          {" · "}

                          {formatCurrency(
                            roomTotal
                          )}

                        </span>

                      </div>
                    );
                  }
                )}

              </div>
            )}


          <div className="booking-desk-success__actions">

            <button
              type="button"
              className="booking-desk-btn booking-desk-btn--secondary"
              onClick={onBack}
            >
              {isAddRoomMode
                ? "Back to Reservation Group"
                : "View Bookings"}
            </button>


            {!isEditMode &&
              !isAddRoomMode && (
              <button
                type="button"
                className="booking-desk-btn booking-desk-btn--primary"
                onClick={onNewBooking}
              >
                {newBookingIcon}

                New Booking
              </button>
            )}

          </div>

        </div>

      </div>
    );
  
}

export default BookingDeskSuccess;
