const STEPS = [
  {
    id: 1,
    label: "Guest",
  },
  {
    id: 2,
    label: "Stay & Rooms",
  },
  {
    id: 3,
    label: "Booking Details",
  },
  {
    id: 4,
    label: "Review",
  },
];


function BookingDeskStepper({
  step,
  completeIcon,
}) {
  return (
<div className="booking-desk-steps">

        {STEPS.map(
          (
            item
          ) => (
            <div
              key={
                item.id
              }
              className={
                [
                  "booking-desk-step",

                  item.id ===
                  step
                    ? "booking-desk-step--active"
                    : "",

                  item.id <
                  step
                    ? "booking-desk-step--complete"
                    : "",
                ]
                  .filter(
                    Boolean
                  )
                  .join(" ")
              }
            >

              <span className="booking-desk-step__number">

                {item.id <
                step ? (
                  completeIcon
                ) : (
                  item.id
                )}

              </span>


              <span className="booking-desk-step__label">
                {item.label}
              </span>

            </div>
          )
        )}

      </div>
  );
}

export default BookingDeskStepper;
