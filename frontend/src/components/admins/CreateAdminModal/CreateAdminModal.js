import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import ReactDOM from "react-dom";

import superAdminAdminService from "../../../services/superAdminAdminService";

import "./CreateAdminModal.css";


/* ============================================================
   CONSTANTS
============================================================ */

const EMPTY_FORM = {
  fullName: "",
  email: "",
  phone: "",
  temporaryPassword: "",
};


const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


/* ============================================================
   ICON BASE
============================================================ */

function IconBase({
  children,
}) {
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


function AdminIcon() {
  return (
    <IconBase>
      <circle
        cx="9"
        cy="8"
        r="3"
      />

      <path d="M3 20c0-4 2.5-6 6-6s6 2 6 6" />

      <path d="M17 8h4" />

      <path d="M19 6v4" />
    </IconBase>
  );
}


function CloseIcon() {
  return (
    <IconBase>
      <path d="M6 6l12 12" />

      <path d="M18 6 6 18" />
    </IconBase>
  );
}


function EyeIcon() {
  return (
    <IconBase>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />

      <circle
        cx="12"
        cy="12"
        r="2.5"
      />
    </IconBase>
  );
}


function EyeOffIcon() {
  return (
    <IconBase>
      <path d="M3 3l18 18" />

      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />

      <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6 0 9.5 7 9.5 7a15.1 15.1 0 0 1-2.1 3" />

      <path d="M6.6 6.6C4 8.4 2.5 12 2.5 12S6 19 12 19a10.8 10.8 0 0 0 3.3-.5" />
    </IconBase>
  );
}


function SecurityIcon() {
  return (
    <IconBase>
      <path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z" />

      <path d="m9 12 2 2 4-4" />
    </IconBase>
  );
}


/* ============================================================
   HELPERS
============================================================ */

function getErrorMessage(
  error
) {
  return (
    error?.response?.data
      ?.message ||
    error?.data
      ?.message ||
    error?.message ||
    "The Hotel Admin account could not be created."
  );
}


function validateForm(
  form
) {
  const fullName =
    String(
      form.fullName || ""
    ).trim();


  const email =
    String(
      form.email || ""
    )
      .trim()
      .toLowerCase();


  const phone =
    String(
      form.phone || ""
    ).trim();


  const password =
    String(
      form.temporaryPassword ||
      ""
    );


  if (!fullName) {
    return "Admin full name is required.";
  }


  if (
    fullName.length > 150
  ) {
    return "Admin full name must not exceed 150 characters.";
  }


  if (!email) {
    return "Admin email address is required.";
  }


  if (
    email.length > 150 ||
    !EMAIL_PATTERN.test(
      email
    )
  ) {
    return "Enter a valid Admin email address.";
  }


  if (
    phone.length > 30
  ) {
    return "Phone number must not exceed 30 characters.";
  }


  if (!password) {
    return "Temporary password is required.";
  }


  if (
    password.length < 8
  ) {
    return "Temporary password must contain at least 8 characters.";
  }


  return "";
}


/* ============================================================
   CREATE ADMIN MODAL
============================================================ */

function CreateAdminModal({
  selectedHotel,
  onClose,
  onCreated,
}) {
  const [
    form,
    setForm,
  ] = useState(
    EMPTY_FORM
  );


  const [
    showPassword,
    setShowPassword,
  ] = useState(false);


  const [
    submitting,
    setSubmitting,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState("");


  const modalRef =
    useRef(null);


  const firstInputRef =
    useRef(null);


  /* ==========================================================
     BODY SCROLL + INITIAL FOCUS
  ========================================================== */

  useEffect(() => {
    const previousOverflow =
      document.body.style
        .overflow;


    document.body.style
      .overflow =
      "hidden";


    const focusTimer =
      window.setTimeout(
        () => {
          firstInputRef.current
            ?.focus();
        },
        0
      );


    return () => {
      window.clearTimeout(
        focusTimer
      );


      document.body.style
        .overflow =
        previousOverflow;
    };
  }, []);


  /* ==========================================================
     ESCAPE + FOCUS TRAP
  ========================================================== */

  useEffect(() => {
    const handleKeyDown = (
      event
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        if (!submitting) {
          onClose?.();
        }

        return;
      }


      if (
        event.key !== "Tab"
      ) {
        return;
      }


      const modal =
        modalRef.current;


      if (!modal) {
        return;
      }


      const focusable =
        modal.querySelectorAll(
          [
            "button:not([disabled])",
            "input:not([disabled])",
            "select:not([disabled])",
            "textarea:not([disabled])",
            "[tabindex]:not([tabindex='-1'])",
          ].join(",")
        );


      if (
        focusable.length === 0
      ) {
        return;
      }


      const first =
        focusable[0];


      const last =
        focusable[
          focusable.length - 1
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
    onClose,
    submitting,
  ]);


  /* ==========================================================
     FIELD CHANGE
  ========================================================== */

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;


    setForm(
      (current) => ({
        ...current,

        [name]:
          value,
      })
    );


    if (error) {
      setError("");
    }
  };


  /* ==========================================================
     CLOSE
  ========================================================== */

  const handleClose = () => {
    if (submitting) {
      return;
    }


    onClose?.();
  };


  /* ==========================================================
     OVERLAY CLICK
  ========================================================== */

  const handleOverlayClick = (
    event
  ) => {
    if (
      event.target ===
        event.currentTarget &&
      !submitting
    ) {
      onClose?.();
    }
  };


  /* ==========================================================
     SUBMIT
  ========================================================== */

  const handleSubmit =
    async (event) => {
      event.preventDefault();


      if (
        submitting
      ) {
        return;
      }


      const validationError =
        validateForm(
          form
        );


      if (
        validationError
      ) {
        setError(
          validationError
        );

        return;
      }


      if (
        !selectedHotel
          ?.displayId
      ) {
        setError(
          "The selected hotel could not be identified."
        );

        return;
      }


      setSubmitting(true);
      setError("");


      try {
        const result =
          await superAdminAdminService
            .createHotelAdmin(
              selectedHotel
                .displayId,
              {
                fullName:
                  form.fullName,

                email:
                  form.email,

                phone:
                  form.phone,

                temporaryPassword:
                  form.temporaryPassword,
              }
            );


        if (
          result?.success !== true ||
          !result?.admin
        ) {
          throw new Error(
            result?.message ||
            "The Hotel Admin account could not be created."
          );
        }


        /*
         * Remove password from local component state
         * immediately after successful creation.
         */
        setForm(
          EMPTY_FORM
        );


        setShowPassword(
          false
        );


        /*
         * Parent refresh failure must not be shown as
         * an Admin creation failure because the backend
         * operation has already succeeded.
         */
        try {
          await onCreated?.(
            result
          );
        } catch (
          callbackError
        ) {
          console.error(
            "[CREATE_ADMIN_MODAL:ON_CREATED]",
            callbackError
          );
        }


        onClose?.();
      } catch (
        submitError
      ) {
        console.error(
          "[CREATE_ADMIN_MODAL:SUBMIT]",
          submitError
        );


        setError(
          getErrorMessage(
            submitError
          )
        );
      } finally {
        setSubmitting(false);
      }
    };


  if (
    !selectedHotel
  ) {
    return null;
  }


  /* ==========================================================
     PORTAL
  ========================================================== */

  return ReactDOM.createPortal(
    <div
      className="create-admin-modal__overlay"
      onMouseDown={
        handleOverlayClick
      }
    >
      <section
        ref={modalRef}
        className="create-admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-admin-modal-title"
      >

        {/* ====================================================
            HEADER
        ==================================================== */}

        <header className="create-admin-modal__header">

          <div className="create-admin-modal__header-content">

            <div className="create-admin-modal__header-icon">
              <AdminIcon />
            </div>


            <div>
              <h2
                id="create-admin-modal-title"
                className="create-admin-modal__title"
              >
                Add Hotel Admin
              </h2>


              <p className="create-admin-modal__subtitle">
                Create a login account
                for an Admin of this
                hotel.
              </p>
            </div>

          </div>


          <button
            type="button"
            className="create-admin-modal__close"
            aria-label="Close Add Admin"
            disabled={
              submitting
            }
            onClick={
              handleClose
            }
          >
            <CloseIcon />
          </button>

        </header>


        {/* ====================================================
            FORM
        ==================================================== */}

        <form
          className="create-admin-modal__form"
          onSubmit={
            handleSubmit
          }
          noValidate
        >

          <div className="create-admin-modal__body">

            {/* =================================================
                HOTEL CONTEXT
            ================================================= */}

            <div className="create-admin-modal__hotel">

              <div>
                <span className="create-admin-modal__hotel-label">
                  Selected Hotel
                </span>

                <strong className="create-admin-modal__hotel-name">
                  {selectedHotel.name}
                </strong>
              </div>


              <span className="create-admin-modal__hotel-id">
                {
                  selectedHotel
                    .displayId
                }
              </span>

            </div>


            {/* =================================================
                ERROR
            ================================================= */}

            {error && (
              <div className="create-admin-modal__error">

                <div
                  className="alert alert-error"
                  role="alert"
                >
                  {error}
                </div>

              </div>
            )}


            {/* =================================================
                FULL NAME
            ================================================= */}

            <div className="create-admin-modal__field">

              <label
                className="create-admin-modal__label"
                htmlFor="create-admin-full-name"
              >
                Full Name{" "}

                <span className="create-admin-modal__required">
                  *
                </span>
              </label>


              <input
                ref={
                  firstInputRef
                }
                id="create-admin-full-name"
                name="fullName"
                type="text"
                className="form-control"
                value={
                  form.fullName
                }
                onChange={
                  handleChange
                }
                placeholder="Example: Rahul Sharma"
                maxLength={150}
                autoComplete="name"
                disabled={
                  submitting
                }
              />

            </div>


            {/* =================================================
                EMAIL
            ================================================= */}

            <div className="create-admin-modal__field">

              <label
                className="create-admin-modal__label"
                htmlFor="create-admin-email"
              >
                Email Address{" "}

                <span className="create-admin-modal__required">
                  *
                </span>
              </label>


              <input
                id="create-admin-email"
                name="email"
                type="email"
                className="form-control"
                value={
                  form.email
                }
                onChange={
                  handleChange
                }
                placeholder="admin@example.com"
                maxLength={150}
                autoComplete="email"
                inputMode="email"
                disabled={
                  submitting
                }
              />


              <span className="create-admin-modal__help">
                This email will be used
                by the Admin to sign in.
              </span>

            </div>


            {/* =================================================
                PHONE
            ================================================= */}

            <div className="create-admin-modal__field">

              <label
                className="create-admin-modal__label"
                htmlFor="create-admin-phone"
              >
                Phone Number
              </label>


              <input
                id="create-admin-phone"
                name="phone"
                type="tel"
                className="form-control"
                value={
                  form.phone
                }
                onChange={
                  handleChange
                }
                placeholder="Example: 9876543210"
                maxLength={30}
                autoComplete="tel"
                inputMode="tel"
                disabled={
                  submitting
                }
              />

            </div>


            {/* =================================================
                TEMPORARY PASSWORD
            ================================================= */}

            <div className="create-admin-modal__field">

              <label
                className="create-admin-modal__label"
                htmlFor="create-admin-password"
              >
                Temporary Password{" "}

                <span className="create-admin-modal__required">
                  *
                </span>
              </label>


              <div className="create-admin-modal__input-wrap">

                <input
                  id="create-admin-password"
                  name="temporaryPassword"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  className="form-control create-admin-modal__password-input"
                  value={
                    form.temporaryPassword
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  autoComplete="new-password"
                  disabled={
                    submitting
                  }
                />


                <button
                  type="button"
                  className="create-admin-modal__password-toggle"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  disabled={
                    submitting
                  }
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current
                    )
                  }
                >
                  {showPassword ? (
                    <EyeOffIcon />
                  ) : (
                    <EyeIcon />
                  )}
                </button>

              </div>


              <span className="create-admin-modal__help">
                Minimum 8 characters.
                Share this password
                securely with the Admin.
              </span>

            </div>


            {/* =================================================
                SECURITY NOTE
            ================================================= */}

            <div className="create-admin-modal__security">

              <SecurityIcon />


              <p>
                The password is used only
                to create the Admin's
                Clerk authentication
                account. HMS does not
                store the password in
                MySQL.
              </p>

            </div>

          </div>


          {/* ===================================================
              FOOTER
          =================================================== */}

          <footer className="create-admin-modal__footer">

            <button
              type="button"
              className="btn btn-secondary"
              disabled={
                submitting
              }
              onClick={
                handleClose
              }
            >
              Cancel
            </button>


            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                submitting
              }
            >
              {submitting
                ? "Creating..."
                : "Create Admin"}
            </button>

          </footer>

        </form>

      </section>
    </div>,
    document.body
  );
}


export default CreateAdminModal;