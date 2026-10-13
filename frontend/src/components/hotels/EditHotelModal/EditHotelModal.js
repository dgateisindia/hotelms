import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";

import hotelService from "../../../services/hotelService";

import "../CreateHotelModal/CreateHotelModal.css";


const CURRENT_YEAR =
  new Date().getFullYear();


const HOTEL_TYPES = [
  "Hotel",
  "Resort",
  "Boutique Hotel",
  "Business Hotel",
  "Budget Hotel",
  "Luxury Hotel",
  "Serviced Apartment",
  "Guest House",
  "Hostel",
  "Other",
];


function textValue(
  value
) {
  return value === null ||
    value === undefined
    ? ""
    : String(value);
}


function createForm(
  hotel
) {
  return {
    hotelName:
      textValue(
        hotel?.name
      ),

    hotelType:
      textValue(
        hotel?.type
      ),

    hotelDescription:
      textValue(
        hotel?.description
      ),

    starRating:
      textValue(
        hotel?.starRating
      ),

    yearEstablished:
      textValue(
        hotel?.yearEstablished
      ),

    gstNumber:
      textValue(
        hotel?.gstNumber
      ),

    panNumber:
      textValue(
        hotel?.panNumber
      ),

    businessRegistrationNumber:
      textValue(
        hotel?.businessRegistrationNumber
      ),

    hotelLogo:
      textValue(
        hotel?.logo
      ),

    status:
      String(
        hotel?.status ||
        "active"
      )
        .trim()
        .toLowerCase() ===
      "inactive"
        ? "inactive"
        : "active",
  };
}


function getErrorMessage(
  error
) {
  return (
    error?.response?.data
      ?.message ||
    error?.response?.data
      ?.error ||
    error?.message ||
    "Hotel could not be updated."
  );
}


function validateForm(
  form
) {
  const errors = {};


  const hotelName =
    String(
      form.hotelName || ""
    ).trim();


  if (!hotelName) {

    errors.hotelName =
      "Hotel name is required.";
  }


  if (
    hotelName.length > 255
  ) {

    errors.hotelName =
      "Hotel name must not exceed 255 characters.";
  }


  if (
    String(
      form.hotelDescription ||
      ""
    ).length > 5000
  ) {

    errors.hotelDescription =
      "Description must not exceed 5000 characters.";
  }


  if (
    String(
      form.starRating || ""
    ).trim()
  ) {

    const rating =
      Number(
        form.starRating
      );


    if (
      !Number.isInteger(
        rating
      ) ||
      rating < 1 ||
      rating > 5
    ) {

      errors.starRating =
        "Star rating must be between 1 and 5.";
    }
  }


  if (
    String(
      form.yearEstablished ||
      ""
    ).trim()
  ) {

    const year =
      Number(
        form.yearEstablished
      );


    if (
      !Number.isInteger(
        year
      ) ||
      year < 1800 ||
      year >
        CURRENT_YEAR + 1
    ) {

      errors.yearEstablished =
        `Year must be between 1800 and ${CURRENT_YEAR + 1}.`;
    }
  }


  if (
    String(
      form.gstNumber || ""
    ).length > 20
  ) {

    errors.gstNumber =
      "GST number must not exceed 20 characters.";
  }


  if (
    String(
      form.panNumber || ""
    ).length > 20
  ) {

    errors.panNumber =
      "PAN number must not exceed 20 characters.";
  }


  if (
    String(
      form.businessRegistrationNumber ||
      ""
    ).length > 100
  ) {

    errors.businessRegistrationNumber =
      "Business registration number must not exceed 100 characters.";
  }


  if (
    String(
      form.hotelLogo || ""
    ).length > 255
  ) {

    errors.hotelLogo =
      "Hotel logo URL must not exceed 255 characters.";
  }


  if (
    ![
      "active",
      "inactive",
    ].includes(
      form.status
    )
  ) {

    errors.status =
      "Hotel status must be active or inactive.";
  }


  return errors;
}


function EditHotelModal({
  isOpen,
  hotel,
  onClose,
  onUpdated,
}) {
  const modalRef =
    useRef(null);

  const firstInputRef =
    useRef(null);


  const [
    formData,
    setFormData,
  ] =
    useState(
      createForm(
        hotel
      )
    );


  const [
    errors,
    setErrors,
  ] =
    useState({});


  const [
    submitError,
    setSubmitError,
  ] =
    useState("");


  const [
    saving,
    setSaving,
  ] =
    useState(false);


  useEffect(() => {

    if (!isOpen) {
      return undefined;
    }


    const previousOverflow =
      document.body.style.overflow;


    document.body.style.overflow =
      "hidden";


    setFormData(
      createForm(
        hotel
      )
    );

    setErrors({});
    setSubmitError("");
    setSaving(false);


    const timer =
      window.setTimeout(
        () => {
          firstInputRef.current
            ?.focus();
        },
        50
      );


    return () => {

      window.clearTimeout(
        timer
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    isOpen,
    hotel,
  ]);


  useEffect(() => {

    if (!isOpen) {
      return undefined;
    }


    const handleKeyDown =
      (event) => {

        if (
          event.key ===
            "Escape" &&
          !saving
        ) {

          event.preventDefault();

          onClose?.();

          return;
        }


        if (
          event.key !==
            "Tab" ||
          !modalRef.current
        ) {

          return;
        }


        const elements =
          modalRef.current
            .querySelectorAll(
              [
                "button:not([disabled])",
                "input:not([disabled])",
                "select:not([disabled])",
                "textarea:not([disabled])",
              ].join(",")
            );


        if (
          elements.length ===
          0
        ) {

          return;
        }


        const first =
          elements[0];

        const last =
          elements[
            elements.length - 1
          ];


        if (
          event.shiftKey &&
          document.activeElement ===
            first
        ) {

          event.preventDefault();

          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement ===
            last
        ) {

          event.preventDefault();

          first.focus();
        }
      };


    document.addEventListener(
      "keydown",
      handleKeyDown
    );


    return () => {

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    isOpen,
    saving,
    onClose,
  ]);


  if (
    !isOpen ||
    !hotel
  ) {

    return null;
  }


  const handleChange =
    (event) => {

      const {
        name,
        value,
      } =
        event.target;


      const nextValue =
        name ===
          "gstNumber" ||
        name ===
          "panNumber"
          ? value.toUpperCase()
          : value;


      setFormData(
        (current) => ({
          ...current,

          [name]:
            nextValue,
        })
      );


      if (
        errors[name]
      ) {

        setErrors(
          (current) => {

            const next = {
              ...current,
            };


            delete next[name];


            return next;
          }
        );
      }


      if (submitError) {
        setSubmitError("");
      }
    };


  const handleClose =
    () => {

      if (!saving) {
        onClose?.();
      }
    };


  const handleSubmit =
    async (event) => {

      event.preventDefault();


      if (saving) {
        return;
      }


      const validationErrors =
        validateForm(
          formData
        );


      if (
        Object.keys(
          validationErrors
        ).length > 0
      ) {

        setErrors(
          validationErrors
        );

        setSubmitError(
          "Please correct the highlighted fields."
        );

        return;
      }


      setErrors({});
      setSubmitError("");
      setSaving(true);


      try {

        const result =
          await hotelService
            .updateHotel(
              hotel.displayId,
              formData
            );


        if (
          result?.success !==
            true ||
          !result?.hotel
        ) {

          throw new Error(
            result?.message ||
            "Hotel update failed."
          );
        }


        await Promise.resolve(
          onUpdated?.(
            result.hotel,
            result.message
          )
        );


        onClose?.();
      } catch (
        error
      ) {

        setSubmitError(
          getErrorMessage(
            error
          )
        );
      } finally {

        setSaving(false);
      }
    };


  const fieldClass =
    (
      base,
      name
    ) =>
      [
        base,

        errors[name]
          ? `${base}--error`
          : "",
      ]
        .filter(Boolean)
        .join(" ");


  const content = (
    <div
      className="create-hotel-modal__overlay"
      onMouseDown={
        (event) => {

          if (
            event.target ===
            event.currentTarget
          ) {

            handleClose();
          }
        }
      }
    >
      <section
        ref={modalRef}
        className="create-hotel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-hotel-title"
      >
        <header className="create-hotel-modal__header">
          <div className="create-hotel-modal__heading">
            <div className="create-hotel-modal__heading-content">
              <h2
                id="edit-hotel-title"
                className="create-hotel-modal__title"
              >
                Edit Hotel
              </h2>

              <p className="create-hotel-modal__subtitle">
                Update property details
                or change operational
                status.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="create-hotel-modal__close"
            onClick={
              handleClose
            }
            disabled={saving}
            aria-label="Close edit hotel form"
          >
            ×
          </button>
        </header>


        <div className="create-hotel-modal__body">
          <form
            id="edit-hotel-form"
            className="create-hotel-form"
            onSubmit={
              handleSubmit
            }
            noValidate
          >
            {submitError && (
              <div
                className="create-hotel-form__error-summary"
                role="alert"
              >
                <div>
                  <div className="create-hotel-form__error-summary-title">
                    Hotel could not be
                    updated
                  </div>

                  <p className="create-hotel-form__error-summary-message">
                    {submitError}
                  </p>
                </div>
              </div>
            )}


            <section className="create-hotel-form__section">
              <div className="create-hotel-form__section-header">
                <h3 className="create-hotel-form__section-title">
                  Property Details
                </h3>

                <p className="create-hotel-form__section-description">
                  Update hotel identity
                  and profile.
                </p>
              </div>


              <div className="create-hotel-form__grid">

                <div className="create-hotel-form__field create-hotel-form__field--full">
                  <label
                    className="form-label"
                    htmlFor="edit-hotel-name"
                  >
                    Hotel Name *
                  </label>

                  <input
                    ref={
                      firstInputRef
                    }
                    id="edit-hotel-name"
                    name="hotelName"
                    type="text"
                    value={
                      formData.hotelName
                    }
                    onChange={
                      handleChange
                    }
                    className={
                      fieldClass(
                        "create-hotel-form__input",
                        "hotelName"
                      )
                    }
                    maxLength={255}
                    disabled={saving}
                  />

                  {errors.hotelName && (
                    <span className="create-hotel-form__field-error">
                      {
                        errors.hotelName
                      }
                    </span>
                  )}
                </div>


                <div className="create-hotel-form__field">
                  <label
                    className="form-label"
                    htmlFor="edit-hotel-type"
                  >
                    Hotel Type
                  </label>

                  <select
                    id="edit-hotel-type"
                    name="hotelType"
                    value={
                      formData.hotelType
                    }
                    onChange={
                      handleChange
                    }
                    className={
                      fieldClass(
                        "create-hotel-form__select",
                        "hotelType"
                      )
                    }
                    disabled={saving}
                  >
                    <option value="">
                      Select hotel type
                    </option>

                    {HOTEL_TYPES.map(
                      (type) => (
                        <option
                          key={type}
                          value={type}
                        >
                          {type}
                        </option>
                      )
                    )}
                  </select>
                </div>


                <div className="create-hotel-form__field">
                  <label
                    className="form-label"
                    htmlFor="edit-hotel-year"
                  >
                    Year Established
                  </label>

                  <input
                    id="edit-hotel-year"
                    name="yearEstablished"
                    type="number"
                    min="1800"
                    max={
                      CURRENT_YEAR + 1
                    }
                    value={
                      formData.yearEstablished
                    }
                    onChange={
                      handleChange
                    }
                    className={
                      fieldClass(
                        "create-hotel-form__input",
                        "yearEstablished"
                      )
                    }
                    disabled={saving}
                  />

                  {errors.yearEstablished && (
                    <span className="create-hotel-form__field-error">
                      {
                        errors.yearEstablished
                      }
                    </span>
                  )}
                </div>


                <div className="create-hotel-form__field create-hotel-form__field--full">
                  <label
                    className="form-label"
                    htmlFor="edit-hotel-description"
                  >
                    Description
                  </label>

                  <textarea
                    id="edit-hotel-description"
                    name="hotelDescription"
                    value={
                      formData.hotelDescription
                    }
                    onChange={
                      handleChange
                    }
                    className={
                      fieldClass(
                        "create-hotel-form__textarea",
                        "hotelDescription"
                      )
                    }
                    maxLength={5000}
                    disabled={saving}
                  />

                  {errors.hotelDescription && (
                    <span className="create-hotel-form__field-error">
                      {
                        errors.hotelDescription
                      }
                    </span>
                  )}
                </div>

              </div>
            </section>


            <section className="create-hotel-form__section">
              <div className="create-hotel-form__section-header">
                <h3 className="create-hotel-form__section-title">
                  Classification & Status
                </h3>
              </div>


              <div className="create-hotel-form__grid">

                <div className="create-hotel-form__field">
                  <label
                    className="form-label"
                    htmlFor="edit-hotel-rating"
                  >
                    Star Rating
                  </label>

                  <select
                    id="edit-hotel-rating"
                    name="starRating"
                    value={
                      formData.starRating
                    }
                    onChange={
                      handleChange
                    }
                    className={
                      fieldClass(
                        "create-hotel-form__select",
                        "starRating"
                      )
                    }
                    disabled={saving}
                  >
                    <option value="">
                      Not specified
                    </option>

                    {[1,2,3,4,5].map(
                      (rating) => (
                        <option
                          key={rating}
                          value={rating}
                        >
                          {rating} Star
                        </option>
                      )
                    )}
                  </select>

                  {errors.starRating && (
                    <span className="create-hotel-form__field-error">
                      {
                        errors.starRating
                      }
                    </span>
                  )}
                </div>


                <div className="create-hotel-form__field">
                  <label
                    className="form-label"
                    htmlFor="edit-hotel-status"
                  >
                    Hotel Status
                  </label>

                  <select
                    id="edit-hotel-status"
                    name="status"
                    value={
                      formData.status
                    }
                    onChange={
                      handleChange
                    }
                    className={
                      fieldClass(
                        "create-hotel-form__select",
                        "status"
                      )
                    }
                    disabled={saving}
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </div>

              </div>


              {formData.status ===
                "inactive" && (
                <div className="create-hotel-form__info">
                  <div className="create-hotel-form__info-content">
                    <div className="create-hotel-form__info-title">
                      Hotel will be deactivated
                    </div>

                    <p className="create-hotel-form__info-text">
                      Hotel Admin access
                      to operational APIs
                      will be blocked.
                      Existing hotel data
                      remains preserved.
                    </p>
                  </div>
                </div>
              )}
            </section>


            <section className="create-hotel-form__section">
              <div className="create-hotel-form__section-header">
                <h3 className="create-hotel-form__section-title">
                  Business Details
                </h3>
              </div>


              <div className="create-hotel-form__grid">

                <div className="create-hotel-form__field">
                  <label
                    className="form-label"
                    htmlFor="edit-hotel-gst"
                  >
                    GST Number
                  </label>

                  <input
                    id="edit-hotel-gst"
                    name="gstNumber"
                    type="text"
                    value={
                      formData.gstNumber
                    }
                    onChange={
                      handleChange
                    }
                    className="create-hotel-form__input"
                    maxLength={20}
                    disabled={saving}
                  />
                </div>


                <div className="create-hotel-form__field">
                  <label
                    className="form-label"
                    htmlFor="edit-hotel-pan"
                  >
                    PAN Number
                  </label>

                  <input
                    id="edit-hotel-pan"
                    name="panNumber"
                    type="text"
                    value={
                      formData.panNumber
                    }
                    onChange={
                      handleChange
                    }
                    className="create-hotel-form__input"
                    maxLength={20}
                    disabled={saving}
                  />
                </div>


                <div className="create-hotel-form__field create-hotel-form__field--full">
                  <label
                    className="form-label"
                    htmlFor="edit-hotel-registration"
                  >
                    Business Registration
                  </label>

                  <input
                    id="edit-hotel-registration"
                    name="businessRegistrationNumber"
                    type="text"
                    value={
                      formData.businessRegistrationNumber
                    }
                    onChange={
                      handleChange
                    }
                    className="create-hotel-form__input"
                    maxLength={100}
                    disabled={saving}
                  />
                </div>


                <div className="create-hotel-form__field create-hotel-form__field--full">
                  <label
                    className="form-label"
                    htmlFor="edit-hotel-logo"
                  >
                    Hotel Logo URL
                  </label>

                  <input
                    id="edit-hotel-logo"
                    name="hotelLogo"
                    type="text"
                    value={
                      formData.hotelLogo
                    }
                    onChange={
                      handleChange
                    }
                    className="create-hotel-form__input"
                    maxLength={255}
                    disabled={saving}
                  />
                </div>

              </div>
            </section>
          </form>
        </div>


        <footer className="create-hotel-modal__footer">
          <p className="create-hotel-modal__footer-note">
            Hotel ID and ownership
            cannot be changed.
          </p>


          <div className="create-hotel-modal__actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={
                handleClose
              }
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="edit-hotel-form"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );


  return createPortal(
    content,
    document.body
  );
}


export default EditHotelModal;