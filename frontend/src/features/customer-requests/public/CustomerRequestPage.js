import React, {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "react-router-dom";

import axios from "axios";

import "./CustomerRequestPage.css";


const PUBLIC_API_URL =
  (
    process.env
      .REACT_APP_PUBLIC_API_URL ||
    `${window.location.protocol}//${window.location.hostname}:5000`
  ).replace(
    /\/+$/,
    ""
  );


function createInitialForm() {
  return {
    full_name: "",
    email: "",
    phone: "",
    gender: "",
    nationality: "",
    address: "",
    check_in: "",
    check_out: "",
    guests: 1,
    room_type: "",
    special_request: "",
  };
}


function localDateValue() {
  const now =
    new Date();

  const local =
    new Date(
      now.getTime() -
      now.getTimezoneOffset() *
        60000
    );

  return local
    .toISOString()
    .slice(
      0,
      10
    );
}


function getApiMessage(
  error,
  fallback
) {
  return (
    error?.response?.data
      ?.message ||
    error?.message ||
    fallback
  );
}


const CustomerRequestPage = () => {
  const {
    publicToken,
  } =
    useParams();

  const [
    hotel,
    setHotel,
  ] =
    useState(null);

  const [
    contextLoading,
    setContextLoading,
  ] =
    useState(true);

  const [
    contextError,
    setContextError,
  ] =
    useState("");

  const [
    form,
    setForm,
  ] =
    useState(
      createInitialForm
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    submitError,
    setSubmitError,
  ] =
    useState("");

  const [
    submitted,
    setSubmitted,
  ] =
    useState(false);

  const [
    requestId,
    setRequestId,
  ] =
    useState(null);


  const today =
    localDateValue();


  /* ==========================================================
     LOAD PUBLIC HOTEL CONTEXT
  ========================================================== */

  useEffect(() => {
    let active =
      true;

    const loadContext =
      async () => {
        setContextLoading(
          true
        );

        setContextError(
          ""
        );

        if (!publicToken) {
          setContextError(
            "This room request link is invalid."
          );

          setContextLoading(
            false
          );

          return;
        }

        try {
          const response =
            await axios.get(
              `${PUBLIC_API_URL}/api/customer-requests/public/${encodeURIComponent(
                publicToken
              )}`
            );

          if (!active) {
            return;
          }

          setHotel(
            response.data?.data ||
            null
          );
        } catch (
          error
        ) {
          if (!active) {
            return;
          }

          setContextError(
            getApiMessage(
              error,
              "Unable to load this room request form."
            )
          );
        } finally {
          if (active) {
            setContextLoading(
              false
            );
          }
        }
      };

    void loadContext();

    return () => {
      active =
        false;
    };
  }, [
    publicToken,
  ]);


  /* ==========================================================
     FORM
  ========================================================== */

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } =
      event.target;

    setSubmitError(
      ""
    );

    setForm(
      (previous) => {
        const next = {
          ...previous,
          [name]:
            value,
        };

        if (
          name ===
            "check_in" &&
          next.check_out &&
          next.check_out <=
            value
        ) {
          next.check_out =
            "";
        }

        return next;
      }
    );
  };


  const validate = () => {
    if (
      !form.full_name.trim() ||
      !form.phone.trim() ||
      !form.gender ||
      !form.nationality.trim() ||
      !form.room_type ||
      !form.check_in ||
      !form.check_out
    ) {
      setSubmitError(
        "Please complete all required fields."
      );

      return false;
    }

    if (
      form.check_out <=
      form.check_in
    ) {
      setSubmitError(
        "Check-out date must be after check-in date."
      );

      return false;
    }

    const guestCount =
      Number(
        form.guests
      );

    if (
      !Number.isInteger(
        guestCount
      ) ||
      guestCount < 1
    ) {
      setSubmitError(
        "Guests must be at least 1."
      );

      return false;
    }

    return true;
  };


  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        submitting ||
        !validate()
      ) {
        return;
      }

      if (!publicToken) {
        setSubmitError(
          "This room request link is invalid."
        );

        return;
      }

      setSubmitting(
        true
      );

      setSubmitError(
        ""
      );

      try {
        const response =
          await axios.post(
            `${PUBLIC_API_URL}/api/customer-requests/public/${encodeURIComponent(
              publicToken
            )}`,
            {
              ...form,

              full_name:
                form.full_name.trim(),

              phone:
                form.phone.trim(),

              email:
                form.email.trim() ||
                null,

              gender:
                form.gender,

              nationality:
                form.nationality.trim(),

              address:
                form.address.trim() ||
                null,

              room_type:
                form.room_type,

              guests:
                Number(
                  form.guests
                ),

              special_request:
                form.special_request
                  .trim() ||
                null,
            }
          );

        setRequestId(
          response.data
            ?.requestId ??
          null
        );

        setSubmitted(
          true
        );

        setForm(
          createInitialForm()
        );
      } catch (
        error
      ) {
        setSubmitError(
          getApiMessage(
            error,
            "Unable to submit your room request."
          )
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };


  const startAnotherRequest =
    () => {
      setSubmitted(
        false
      );

      setRequestId(
        null
      );

      setSubmitError(
        ""
      );

      setForm(
        createInitialForm()
      );

      window.scrollTo({
        top: 0,
        behavior:
          "smooth",
      });
    };


  /* ==========================================================
     LOADING
  ========================================================== */

  if (contextLoading) {
    return (
      <main className="guest-request-page">

        <section className="guest-request-state">

          <div
            className="guest-request-spinner"
            aria-hidden="true"
          />

          <h1>
            Loading Room Request
          </h1>

          <p>
            Verifying the hotel QR link.
          </p>

        </section>

      </main>
    );
  }


  /* ==========================================================
     INVALID / INACTIVE QR
  ========================================================== */

  if (
    contextError ||
    !hotel
  ) {
    return (
      <main className="guest-request-page">

        <section className="guest-request-state guest-request-state--error">

          <div className="guest-request-state-icon">
            !
          </div>

          <h1>
            Request Link Unavailable
          </h1>

          <p>
            {contextError ||
              "This room request link is unavailable."}
          </p>

          <span>
            Please contact the hotel directly for assistance.
          </span>

        </section>

      </main>
    );
  }


  /* ==========================================================
     SUCCESS
  ========================================================== */

  if (submitted) {
    return (
      <main className="guest-request-page">

        <section className="guest-request-success">

          <div className="guest-request-success-mark">
            ✓
          </div>

          <span className="guest-request-kicker">
            {hotel.hotelName}
          </span>

          <h1>
            Request Received
          </h1>

          <p>
            Your room request has been sent to the hotel team for review.
          </p>

          {requestId && (
            <div className="guest-request-reference">
              Request reference
              <strong>
                #{requestId}
              </strong>
            </div>
          )}

          <div className="guest-request-success-note">
            This request is not a confirmed booking yet. The hotel team will review availability and contact you.
          </div>

          <button
            type="button"
            className="guest-request-primary-button"
            onClick={
              startAnotherRequest
            }
          >
            Submit Another Request
          </button>

        </section>

      </main>
    );
  }


  const roomTypes =
    Array.isArray(
      hotel.roomTypes
    )
      ? hotel.roomTypes
      : [];


  /* ==========================================================
     FORM
  ========================================================== */

  return (
    <main className="guest-request-page">

      <section className="guest-request-shell">

        <header className="guest-request-hero">

          <div className="guest-request-brand-mark">
            H
          </div>

          <div className="guest-request-hotel-copy">

            <span>
              Room Request
            </span>

            <h1>
              {hotel.hotelName}
            </h1>

            <p>
              {[
                hotel.hotelType,

                hotel.starRating
                  ? `${hotel.starRating}-star property`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>

          </div>

        </header>


        <div className="guest-request-intro">

          <h2>
            Request Your Stay
          </h2>

          <p>
            Share your preferred stay details. The hotel team will review availability and contact you.
          </p>

        </div>


        {submitError && (
          <div
            className="guest-request-alert"
            role="alert"
          >
            {submitError}
          </div>
        )}


        <form
          className="guest-request-form"
          onSubmit={
            handleSubmit
          }
        >

          <div className="guest-request-grid">

            <label className="guest-request-field">
              <span>
                Full Name
                <b>*</b>
              </span>

              <input
                type="text"
                name="full_name"
                value={
                  form.full_name
                }
                onChange={
                  handleChange
                }
                autoComplete="name"
                placeholder="Enter your full name"
                required
              />
            </label>


            <label className="guest-request-field">
              <span>
                Phone Number
                <b>*</b>
              </span>

              <input
                type="tel"
                name="phone"
                value={
                  form.phone
                }
                onChange={
                  handleChange
                }
                autoComplete="tel"
                placeholder="Enter your phone number"
                required
              />
            </label>


            <label className="guest-request-field">
              <span>
                Email
              </span>

              <input
                type="email"
                name="email"
                value={
                  form.email
                }
                onChange={
                  handleChange
                }
                autoComplete="email"
                placeholder="Enter your email"
              />
            </label>


            <label className="guest-request-field">
              <span>
                Gender
                <b>*</b>
              </span>

              <select
                name="gender"
                value={
                  form.gender
                }
                onChange={
                  handleChange
                }
                required
              >
                <option value="">
                  Select gender
                </option>

                <option value="Male">
                  Male
                </option>

                <option value="Female">
                  Female
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </label>


            <label className="guest-request-field">
              <span>
                Nationality
                <b>*</b>
              </span>

              <input
                type="text"
                name="nationality"
                value={
                  form.nationality
                }
                onChange={
                  handleChange
                }
                autoComplete="country-name"
                placeholder="Enter your nationality"
                required
              />
            </label>


            <label className="guest-request-field">
              <span>
                Guests
                <b>*</b>
              </span>

              <input
                type="number"
                name="guests"
                min="1"
                step="1"
                value={
                  form.guests
                }
                onChange={
                  handleChange
                }
                required
              />
            </label>


            <label className="guest-request-field">
              <span>
                Check-In
                <b>*</b>
              </span>

              <input
                type="date"
                name="check_in"
                min={
                  today
                }
                value={
                  form.check_in
                }
                onChange={
                  handleChange
                }
                required
              />
            </label>


            <label className="guest-request-field">
              <span>
                Check-Out
                <b>*</b>
              </span>

              <input
                type="date"
                name="check_out"
                min={
                  form.check_in ||
                  today
                }
                value={
                  form.check_out
                }
                onChange={
                  handleChange
                }
                required
              />
            </label>


            <label className="guest-request-field guest-request-field--full">
              <span>
                Preferred Room Type
                <b>*</b>
              </span>

              <select
                name="room_type"
                value={
                  form.room_type
                }
                onChange={
                  handleChange
                }
                required
                disabled={
                  roomTypes.length ===
                  0
                }
              >
                <option value="">
                  {roomTypes.length
                    ? "Select a room type"
                    : "No room types are currently configured"}
                </option>

                {roomTypes.map(
                  (roomType) => (
                    <option
                      key={
                        roomType
                      }
                      value={
                        roomType
                      }
                    >
                      {roomType}
                    </option>
                  )
                )}
              </select>
            </label>


            <label className="guest-request-field guest-request-field--full">
              <span>
                Address
              </span>

              <textarea
                name="address"
                value={
                  form.address
                }
                onChange={
                  handleChange
                }
                autoComplete="street-address"
                placeholder="Enter your address"
                rows="3"
              />
            </label>


            <label className="guest-request-field guest-request-field--full">
              <span>
                Special Request
              </span>

              <textarea
                name="special_request"
                value={
                  form.special_request
                }
                onChange={
                  handleChange
                }
                placeholder="Anything the hotel should know before reviewing your request?"
                rows="4"
              />
            </label>

          </div>


          <div className="guest-request-disclaimer">
            Submitting this form sends a room request only. Your stay becomes confirmed after the hotel reviews availability and approves the booking.
          </div>


          <button
            type="submit"
            className="guest-request-primary-button guest-request-submit"
            disabled={
              submitting ||
              roomTypes.length ===
                0
            }
          >
            {submitting
              ? "Submitting Request..."
              : "Submit Room Request"}
          </button>

        </form>

      </section>

    </main>
  );
};


export default CustomerRequestPage;