import { formatDateTime } from "../../../shared/utils/dates";
import { formatStatus } from "../../../shared/utils/status";

function ReservationGuestDetails({
  guest,
  guestIndex,
  bookingId,
}) {
                                  const guestType =
                                    String(
                                      guest.guest_type ||
                                      "adult"
                                    )
                                      .trim()
                                      .toLowerCase();

                                  return (
                                    <section
                                      className="booking-detail-section"
                                      key={
                                        guest.booking_guest_id ||
                                        `${bookingId}-${guestIndex}`
                                      }
                                    >

                                      <h4>
                                        {guest.full_name ||
                                          `Guest ${guestIndex + 1}`}
                                      </h4>


                                      <div className="booking-detail-row">

                                        <span>
                                          Type / Role
                                        </span>

                                        <strong>
                                          {guestType === "child"
                                            ? "Child"
                                            : "Adult"}
                                          {" · "}
                                          {String(
                                            guest.guest_role ||
                                            ""
                                          )
                                            .replaceAll(
                                              "_",
                                              " "
                                            )
                                            .replace(
                                              /\b\w/g,
                                              (character) =>
                                                character.toUpperCase()
                                            ) ||
                                            "—"}
                                        </strong>

                                      </div>


                                      {guest.phone && (
                                        <div className="booking-detail-row">

                                          <span>
                                            Mobile
                                          </span>

                                          <strong>
                                            {guest.phone}
                                          </strong>

                                        </div>
                                      )}


                                      <div className="booking-detail-row">

                                        <span>
                                          Status
                                        </span>

                                        <strong>
                                          {formatStatus(
                                            guest.guest_status
                                          )}
                                        </strong>

                                      </div>


                                      {guestType === "child" && (
                                        <div className="booking-detail-row">

                                          <span>
                                            Age
                                          </span>

                                          <strong>
                                            {guest.age ?? "—"}
                                          </strong>

                                        </div>
                                      )}


                                      <div className="booking-detail-row">

                                        <span>
                                          ID
                                        </span>

                                        <strong>
                                          {guest.id_proof_type &&
                                          guest.id_proof_number
                                            ? `${guest.id_proof_type} · ${guest.id_proof_number}`
                                            : "Not recorded"}
                                        </strong>

                                      </div>


                                      <div className="booking-detail-row">

                                        <span>
                                          Extra Bed
                                        </span>

                                        <strong>
                                          {guest.extra_bed_used === true ||
                                          Number(
                                            guest.extra_bed_used
                                          ) === 1
                                            ? "Used"
                                            : "No"}
                                        </strong>

                                      </div>


                                      {guest.actual_check_in && (
                                        <div className="booking-detail-row">

                                          <span>
                                            Checked In
                                          </span>

                                          <strong>
                                            {formatDateTime(
                                              guest.actual_check_in
                                            )}
                                          </strong>

                                        </div>
                                      )}


                                      {guest.actual_check_out && (
                                        <div className="booking-detail-row">

                                          <span>
                                            Checked Out
                                          </span>

                                          <strong>
                                            {formatDateTime(
                                              guest.actual_check_out
                                            )}
                                          </strong>

                                        </div>
                                      )}

                                    </section>
                                  );
}

export default ReservationGuestDetails;
