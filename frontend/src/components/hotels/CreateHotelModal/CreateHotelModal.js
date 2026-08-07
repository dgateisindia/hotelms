import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import hotelService from "../../../services/hotelService";

import "./CreateHotelModal.css";

/* ============================================================
   CONSTANTS
============================================================ */

const CURRENT_YEAR =
  new Date().getFullYear();

const INITIAL_FORM_DATA = {
  hotelName: "",
  hotelType: "",
  hotelDescription: "",
  starRating: "",
  yearEstablished: "",
  gstNumber: "",
  panNumber: "",
  businessRegistrationNumber: "",
  hotelLogo: "",
};

const HOTEL_TYPE_OPTIONS = [
  "Hotel",
  "Resort",
  "Hostel",
  "Guest House",
  "Homestay",
  "Service Apartment",
  "Boutique Hotel",
  "Business Hotel",
  "Other",
];

/* ============================================================
   ICONS
============================================================ */

function IconBase({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function HotelIcon() {
  return (
    <IconBase>
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      <path d="M3 21h18" />
      <path d="M9 7h1" />
      <path d="M14 7h1" />
      <path d="M9 11h1" />
      <path d="M14 11h1" />
      <path d="M9 15h1" />
      <path d="M14 15h1" />
      <path d="M10 21v-3h4v3" />
    </IconBase>
  );
}

function CloseIcon() {
  return (
    <IconBase>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  );
}

function InfoIcon() {
  return (
    <IconBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </IconBase>
  );
}

function AlertIcon() {
  return (
    <IconBase>
      <path d="M12 3 2.8 19h18.4L12 3z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </IconBase>
  );
}

/* ============================================================
   VALIDATION
============================================================ */

function validateForm(formData) {
  const errors = {};

  const hotelName =
    String(
      formData.hotelName || ""
    ).trim();

  if (!hotelName) {
    errors.hotelName =
      "Hotel name is required.";
  } else if (
    hotelName.length < 2
  ) {
    errors.hotelName =
      "Hotel name must contain at least 2 characters.";
  } else if (
    hotelName.length > 255
  ) {
    errors.hotelName =
      "Hotel name must not exceed 255 characters.";
  }

  const hotelType =
    String(
      formData.hotelType || ""
    ).trim();

  if (hotelType.length > 100) {
    errors.hotelType =
      "Hotel type must not exceed 100 characters.";
  }

  const description =
    String(
      formData.hotelDescription ||
        ""
    ).trim();

  if (description.length > 5000) {
    errors.hotelDescription =
      "Hotel description must not exceed 5000 characters.";
  }

  if (
    formData.starRating !== ""
  ) {
    const starRating =
      Number(
        formData.starRating
      );

    if (
      !Number.isInteger(
        starRating
      ) ||
      starRating < 1 ||
      starRating > 5
    ) {
      errors.starRating =
        "Star rating must be between 1 and 5.";
    }
  }

  if (
    formData.yearEstablished !==
    ""
  ) {
    const yearEstablished =
      Number(
        formData.yearEstablished
      );

    if (
      !Number.isInteger(
        yearEstablished
      ) ||
      yearEstablished < 1800 ||
      yearEstablished >
        CURRENT_YEAR + 1
    ) {
      errors.yearEstablished =
        `Enter a year between 1800 and ${
          CURRENT_YEAR + 1
        }.`;
    }
  }

  const gstNumber =
    String(
      formData.gstNumber || ""
    ).trim();

  if (gstNumber.length > 20) {
    errors.gstNumber =
      "GST number must not exceed 20 characters.";
  }

  const panNumber =
    String(
      formData.panNumber || ""
    ).trim();

  if (panNumber.length > 20) {
    errors.panNumber =
      "PAN number must not exceed 20 characters.";
  }

  const registrationNumber =
    String(
      formData.businessRegistrationNumber ||
        ""
    ).trim();

  if (
    registrationNumber.length >
    100
  ) {
    errors.businessRegistrationNumber =
      "Business registration number must not exceed 100 characters.";
  }

  const hotelLogo =
    String(
      formData.hotelLogo || ""
    ).trim();

  if (hotelLogo.length > 255) {
    errors.hotelLogo =
      "Hotel logo URL must not exceed 255 characters.";
  }

  return errors;
}

/* ============================================================
   ERROR HELPERS
============================================================ */

function getApiErrorMessage(error) {
  return (
    error?.response?.data
      ?.message ||
    error?.response?.data
      ?.error ||
    error?.message ||
    "The hotel could not be created. Please try again."
  );
}

/* ============================================================
   CREATE HOTEL MODAL
============================================================ */

function CreateHotelModal({
  isOpen,
  onClose,
  onCreated,
}) {
  const modalRef = useRef(null);
  const firstInputRef =
    useRef(null);

  const [
    formData,
    setFormData,
  ] = useState(
    INITIAL_FORM_DATA
  );

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState({});

  const [
    submitError,
    setSubmitError,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  /* ==========================================================
     OPEN / CLOSE EFFECTS
  ========================================================== */

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    setFormData({
      ...INITIAL_FORM_DATA,
    });

    setFieldErrors({});
    setSubmitError("");
    setIsSubmitting(false);

    const focusTimer =
      window.setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);

    return () => {
      window.clearTimeout(
        focusTimer
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [isOpen]);

  /* ==========================================================
     ESCAPE AND FOCUS TRAP
  ========================================================== */

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (
      event
    ) => {
      if (
        event.key === "Escape" &&
        !isSubmitting
      ) {
        event.preventDefault();

        if (
          typeof onClose ===
          "function"
        ) {
          onClose();
        }

        return;
      }

      if (
        event.key !== "Tab" ||
        !modalRef.current
      ) {
        return;
      }

      const focusableElements =
        modalRef.current.querySelectorAll(
          [
            "button:not([disabled])",
            "input:not([disabled])",
            "select:not([disabled])",
            "textarea:not([disabled])",
            '[tabindex]:not([tabindex="-1"])',
          ].join(",")
        );

      if (
        focusableElements.length === 0
      ) {
        return;
      }

      const firstElement =
        focusableElements[0];

      const lastElement =
        focusableElements[
          focusableElements.length -
            1
        ];

      if (
        event.shiftKey &&
        document.activeElement ===
          firstElement
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement ===
          lastElement
      ) {
        event.preventDefault();
        firstElement.focus();
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
    isSubmitting,
    onClose,
  ]);

  if (!isOpen) {
    return null;
  }

  /* ==========================================================
     CHANGE HANDLERS
  ========================================================== */

  const handleInputChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    let nextValue = value;

    if (
      name === "gstNumber" ||
      name === "panNumber"
    ) {
      nextValue =
        value.toUpperCase();
    }

    setFormData(
      (currentData) => ({
        ...currentData,
        [name]: nextValue,
      })
    );

    if (fieldErrors[name]) {
      setFieldErrors(
        (currentErrors) => {
          const nextErrors = {
            ...currentErrors,
          };

          delete nextErrors[name];

          return nextErrors;
        }
      );
    }

    if (submitError) {
      setSubmitError("");
    }
  };

  const handleRatingChange = (
    rating
  ) => {
    if (isSubmitting) {
      return;
    }

    setFormData(
      (currentData) => ({
        ...currentData,

        starRating:
          Number(
            currentData.starRating
          ) === rating
            ? ""
            : String(rating),
      })
    );

    if (
      fieldErrors.starRating
    ) {
      setFieldErrors(
        (currentErrors) => {
          const nextErrors = {
            ...currentErrors,
          };

          delete nextErrors.starRating;

          return nextErrors;
        }
      );
    }
  };

  /* ==========================================================
     CLOSE HANDLERS
  ========================================================== */

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    if (
      typeof onClose ===
      "function"
    ) {
      onClose();
    }
  };

  const handleOverlayMouseDown = (
    event
  ) => {
    if (
      event.target ===
      event.currentTarget
    ) {
      handleClose();
    }
  };

  /* ==========================================================
     SUBMIT
  ========================================================== */

  const focusFirstError = (
    errors
  ) => {
    const firstErrorField =
      Object.keys(errors)[0];

    if (!firstErrorField) {
      return;
    }

    window.setTimeout(() => {
      const fieldElement =
        modalRef.current?.querySelector(
          `[name="${firstErrorField}"]`
        );

      if (fieldElement) {
        fieldElement.focus();
        return;
      }

      if (
        firstErrorField ===
        "starRating"
      ) {
        modalRef.current
          ?.querySelector(
            ".create-hotel-form__rating-option"
          )
          ?.focus();
      }
    }, 0);
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const validationErrors =
      validateForm(formData);

    if (
      Object.keys(
        validationErrors
      ).length > 0
    ) {
      setFieldErrors(
        validationErrors
      );

      setSubmitError(
        "Please correct the highlighted fields before creating the hotel."
      );

      focusFirstError(
        validationErrors
      );

      return;
    }

    setFieldErrors({});
    setSubmitError("");
    setIsSubmitting(true);

    try {
      const result =
        await hotelService.createHotel(
          formData
        );

      if (
        !result?.success ||
        !result?.hotel
      ) {
        throw new Error(
          result?.message ||
            "The hotel could not be created."
        );
      }

      setFormData({
        ...INITIAL_FORM_DATA,
      });

      /*
      * Hotel is already created successfully at this point.
      * A parent UI callback failure must not be shown as an
      * API creation failure or allow accidental duplicate retry.
      */
      if (
        typeof onCreated ===
        "function"
      ) {
        try {
          await Promise.resolve(
            onCreated(
              result.hotel,
              result.message
            )
          );
        } catch (
          callbackError
        ) {
          console.error(
            "[CREATE_HOTEL_MODAL:ON_CREATED]",
            callbackError
          );
        }
      }

      if (
        typeof onClose ===
        "function"
      ) {
        onClose();
      }
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ==========================================================
     FIELD CLASS HELPERS
  ========================================================== */

  const inputClassName = (
    fieldName
  ) =>
    [
      "create-hotel-form__input",

      fieldErrors[fieldName]
        ? "create-hotel-form__input--error"
        : "",
    ]
      .filter(Boolean)
      .join(" ");

  const selectClassName = (
    fieldName
  ) =>
    [
      "create-hotel-form__select",

      fieldErrors[fieldName]
        ? "create-hotel-form__select--error"
        : "",
    ]
      .filter(Boolean)
      .join(" ");

  const textareaClassName = (
    fieldName
  ) =>
    [
      "create-hotel-form__textarea",

      fieldErrors[fieldName]
        ? "create-hotel-form__textarea--error"
        : "",
    ]
      .filter(Boolean)
      .join(" ");

  const modalContent = (
    <div
      className="create-hotel-modal__overlay"
      onMouseDown={
        handleOverlayMouseDown
      }
    >
      <section
        ref={modalRef}
        className="create-hotel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-hotel-modal-title"
        aria-describedby="create-hotel-modal-description"
      >
        <header className="create-hotel-modal__header">
          <div className="create-hotel-modal__heading">
            <div className="create-hotel-modal__heading-icon">
              <HotelIcon />
            </div>

            <div className="create-hotel-modal__heading-content">
              <h2
                id="create-hotel-modal-title"
                className="create-hotel-modal__title"
              >
                Add New Hotel
              </h2>

              <p
                id="create-hotel-modal-description"
                className="create-hotel-modal__subtitle"
              >
                Add a property to your
                business portfolio. You
                can configure rooms,
                Admins and operations
                after creation.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="create-hotel-modal__close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close create hotel form"
            title="Close"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="create-hotel-modal__body">
          <form
            id="create-hotel-form"
            className="create-hotel-form"
            onSubmit={handleSubmit}
            noValidate
          >
            {submitError && (
              <div
                className="create-hotel-form__error-summary"
                role="alert"
              >
                <span className="create-hotel-form__error-summary-icon">
                  <AlertIcon />
                </span>

                <div>
                  <div className="create-hotel-form__error-summary-title">
                    Hotel could not be
                    created
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
                  Basic Information
                </h3>

                <p className="create-hotel-form__section-description">
                  Enter the primary
                  identity and category
                  of the hotel.
                </p>
              </div>

              <div className="create-hotel-form__grid">
                <div className="create-hotel-form__field create-hotel-form__field--full">
                  <label
                    className="form-label"
                    htmlFor="create-hotel-name"
                  >
                    Hotel Name
                    <span aria-hidden="true">
                      {" "}
                      *
                    </span>
                  </label>

                  <input
                    ref={firstInputRef}
                    id="create-hotel-name"
                    name="hotelName"
                    type="text"
                    className={inputClassName(
                      "hotelName"
                    )}
                    value={
                      formData.hotelName
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="Example: Grand Plaza Hotel"
                    maxLength={255}
                    disabled={isSubmitting}
                    autoComplete="organization"
                    aria-invalid={
                      Boolean(
                        fieldErrors.hotelName
                      )
                    }
                    aria-describedby={
                      fieldErrors.hotelName
                        ? "create-hotel-name-error"
                        : undefined
                    }
                  />

                  {fieldErrors.hotelName && (
                    <span
                      id="create-hotel-name-error"
                      className="create-hotel-form__field-error"
                    >
                      {
                        fieldErrors.hotelName
                      }
                    </span>
                  )}
                </div>

                <div className="create-hotel-form__field">
                  <label
                    className="form-label"
                    htmlFor="create-hotel-type"
                  >
                    Hotel Type
                  </label>

                  <select
                    id="create-hotel-type"
                    name="hotelType"
                    className={selectClassName(
                      "hotelType"
                    )}
                    value={
                      formData.hotelType
                    }
                    onChange={
                      handleInputChange
                    }
                    disabled={isSubmitting}
                    aria-invalid={
                      Boolean(
                        fieldErrors.hotelType
                      )
                    }
                    aria-describedby={
                      fieldErrors.hotelType
                        ? "create-hotel-type-error"
                        : undefined
                    }
                  >
                    <option value="">
                      Select hotel type
                    </option>

                    {HOTEL_TYPE_OPTIONS.map(
                      (hotelType) => (
                        <option
                          key={hotelType}
                          value={hotelType}
                        >
                          {hotelType}
                        </option>
                      )
                    )}
                  </select>

                  {fieldErrors.hotelType && (
                    <span
                      id="create-hotel-type-error"
                      className="create-hotel-form__field-error"
                    >
                      {
                        fieldErrors.hotelType
                      }
                    </span>
                  )}
                </div>

                <div className="create-hotel-form__field">
                  <label
                    className="form-label"
                    htmlFor="create-hotel-year"
                  >
                    Year Established
                  </label>

                  <input
                    id="create-hotel-year"
                    name="yearEstablished"
                    type="number"
                    className={inputClassName(
                      "yearEstablished"
                    )}
                    value={
                      formData.yearEstablished
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="Example: 2020"
                    min="1800"
                    max={
                      CURRENT_YEAR + 1
                    }
                    disabled={isSubmitting}
                    inputMode="numeric"
                    aria-invalid={
                      Boolean(
                        fieldErrors.yearEstablished
                      )
                    }
                    aria-describedby={
                      fieldErrors.yearEstablished
                        ? "create-hotel-year-error"
                        : undefined
                    }
                  />

                  {fieldErrors.yearEstablished && (
                    <span
                      id="create-hotel-year-error"
                      className="create-hotel-form__field-error"
                    >
                      {
                        fieldErrors.yearEstablished
                      }
                    </span>
                  )}
                </div>

                <div className="create-hotel-form__field create-hotel-form__field--full">
                  <label
                    className="form-label"
                    htmlFor="create-hotel-description"
                  >
                    Hotel Description
                  </label>

                  <textarea
                    id="create-hotel-description"
                    name="hotelDescription"
                    className={textareaClassName(
                      "hotelDescription"
                    )}
                    value={
                      formData.hotelDescription
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="Briefly describe the property, its location and facilities."
                    maxLength={5000}
                    disabled={isSubmitting}
                    aria-invalid={
                      Boolean(
                        fieldErrors.hotelDescription
                      )
                    }
                    aria-describedby={
                      fieldErrors.hotelDescription
                        ? "create-hotel-description-error"
                        : undefined
                    }
                  />

                  <div
                    className={[
                      "create-hotel-form__counter",

                      formData
                        .hotelDescription
                        .length >= 5000
                        ? "create-hotel-form__counter--limit"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {
                      formData
                        .hotelDescription
                        .length
                    }
                    /5000
                  </div>

                  {fieldErrors.hotelDescription && (
                    <span
                      id="create-hotel-description-error"
                      className="create-hotel-form__field-error"
                    >
                      {
                        fieldErrors.hotelDescription
                      }
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="create-hotel-form__section">
              <div className="create-hotel-form__section-header">
                <h3 className="create-hotel-form__section-title">
                  Hotel Classification
                </h3>

                <p className="create-hotel-form__section-description">
                  Star rating is optional
                  and can be updated later.
                </p>
              </div>

              <div className="create-hotel-form__field">
                <span className="form-label">
                  Star Rating
                </span>

                <div
                  className="create-hotel-form__rating"
                  role="group"
                  aria-label="Hotel star rating"
                >
                  {[1, 2, 3, 4, 5].map(
                    (rating) => {
                      const isActive =
                        Number(
                          formData.starRating
                        ) === rating;

                      return (
                        <button
                          key={rating}
                          type="button"
                          className={[
                            "create-hotel-form__rating-option",

                            isActive
                              ? "create-hotel-form__rating-option--active"
                              : "",
                          ]
                            .filter(
                              Boolean
                            )
                            .join(" ")}
                          onClick={() => {
                            handleRatingChange(
                              rating
                            );
                          }}
                          disabled={
                            isSubmitting
                          }
                          aria-pressed={
                            isActive
                          }
                        >
                          <span className="create-hotel-form__rating-star">
                            ★
                          </span>

                          {rating}
                        </button>
                      );
                    }
                  )}
                </div>

                {fieldErrors.starRating && (
                  <span className="create-hotel-form__field-error">
                    {
                      fieldErrors.starRating
                    }
                  </span>
                )}
              </div>
            </section>

            <section className="create-hotel-form__section">
              <div className="create-hotel-form__section-header">
                <h3 className="create-hotel-form__section-title">
                  Business Details
                </h3>

                <p className="create-hotel-form__section-description">
                  These fields are
                  optional and can be
                  completed later.
                </p>
              </div>

              <div className="create-hotel-form__grid">
                <div className="create-hotel-form__field">
                  <label
                    className="form-label"
                    htmlFor="create-hotel-gst"
                  >
                    GST Number
                  </label>

                  <input
                    id="create-hotel-gst"
                    name="gstNumber"
                    type="text"
                    className={inputClassName(
                      "gstNumber"
                    )}
                    value={
                      formData.gstNumber
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="GST registration number"
                    maxLength={20}
                    disabled={isSubmitting}
                    autoCapitalize="characters"
                    aria-invalid={
                      Boolean(
                        fieldErrors.gstNumber
                      )
                    }
                  />

                  {fieldErrors.gstNumber && (
                    <span className="create-hotel-form__field-error">
                      {
                        fieldErrors.gstNumber
                      }
                    </span>
                  )}
                </div>

                <div className="create-hotel-form__field">
                  <label
                    className="form-label"
                    htmlFor="create-hotel-pan"
                  >
                    PAN Number
                  </label>

                  <input
                    id="create-hotel-pan"
                    name="panNumber"
                    type="text"
                    className={inputClassName(
                      "panNumber"
                    )}
                    value={
                      formData.panNumber
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="PAN number"
                    maxLength={20}
                    disabled={isSubmitting}
                    autoCapitalize="characters"
                    aria-invalid={
                      Boolean(
                        fieldErrors.panNumber
                      )
                    }
                  />

                  {fieldErrors.panNumber && (
                    <span className="create-hotel-form__field-error">
                      {
                        fieldErrors.panNumber
                      }
                    </span>
                  )}
                </div>

                <div className="create-hotel-form__field create-hotel-form__field--full">
                  <label
                    className="form-label"
                    htmlFor="create-hotel-registration"
                  >
                    Business Registration
                    Number
                  </label>

                  <input
                    id="create-hotel-registration"
                    name="businessRegistrationNumber"
                    type="text"
                    className={inputClassName(
                      "businessRegistrationNumber"
                    )}
                    value={
                      formData.businessRegistrationNumber
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="Company or business registration number"
                    maxLength={100}
                    disabled={isSubmitting}
                    aria-invalid={
                      Boolean(
                        fieldErrors.businessRegistrationNumber
                      )
                    }
                  />

                  {fieldErrors.businessRegistrationNumber && (
                    <span className="create-hotel-form__field-error">
                      {
                        fieldErrors.businessRegistrationNumber
                      }
                    </span>
                  )}
                </div>

                <div className="create-hotel-form__field create-hotel-form__field--full">
                  <label
                    className="form-label"
                    htmlFor="create-hotel-logo"
                  >
                    Hotel Logo URL
                  </label>

                  <input
                    id="create-hotel-logo"
                    name="hotelLogo"
                    type="text"
                    className={inputClassName(
                      "hotelLogo"
                    )}
                    value={
                      formData.hotelLogo
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="https://example.com/hotel-logo.png"
                    maxLength={255}
                    disabled={isSubmitting}
                    aria-invalid={
                      Boolean(
                        fieldErrors.hotelLogo
                      )
                    }
                  />

                  {fieldErrors.hotelLogo && (
                    <span className="create-hotel-form__field-error">
                      {
                        fieldErrors.hotelLogo
                      }
                    </span>
                  )}
                </div>
              </div>
            </section>

            <div className="create-hotel-form__info">
              <span className="create-hotel-form__info-icon">
                <InfoIcon />
              </span>

              <div className="create-hotel-form__info-content">
                <div className="create-hotel-form__info-title">
                  Hotel QR setup
                </div>

                <p className="create-hotel-form__info-text">
                  A secure hotel-level QR
                  record will be created
                  automatically with this
                  hotel. Rooms and Admin
                  accounts will be added
                  later from the selected
                  hotel workspace.
                </p>
              </div>
            </div>
          </form>
        </div>

        <footer className="create-hotel-modal__footer">
          <p className="create-hotel-modal__footer-note">
            Only the hotel name is
            required. No Admin account,
            room or booking will be
            created automatically.
          </p>

          <div className="create-hotel-modal__actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="create-hotel-form"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <span className="create-hotel-modal__spinner" />
              )}

              {isSubmitting
                ? "Creating Hotel..."
                : "Create Hotel"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );

  return createPortal(
    modalContent,
    document.body
  );
}

export default CreateHotelModal;