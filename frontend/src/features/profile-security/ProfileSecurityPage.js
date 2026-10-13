import React from "react";

import {
  useClerk,
  useUser,
} from "@clerk/clerk-react";

import {
  useOutletContext,
} from "react-router-dom";

import SuperAdminLayout from "../../layouts/SuperAdminLayout/SuperAdminLayout";

import SuperAdminSidebar from "../../components/navigation/SuperAdminSidebar/SuperAdminSidebar";

import SuperAdminTopbar from "../../components/navigation/SuperAdminTopbar/SuperAdminTopbar";

import accountProfileService from "../../services/accountProfileService";

import "./ProfileSecurityPage.css";


function safeText(value) {
  const text = String(
    value ?? ""
  ).trim();

  return text || "—";
}


function getUserName(user) {
  if (user?.fullName) {
    return user.fullName;
  }

  const combined = [
    user?.firstName,
    user?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    combined ||
    user?.primaryEmailAddress
      ?.emailAddress ||
    "Account User"
  );
}


function getInitials(name) {
  const parts = String(
    name || ""
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "AU";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}


function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


function InfoRow({
  label,
  value,
}) {
  return (
    <div className="profile-security__row">

      <span>
        {label}
      </span>

      <strong>
        {safeText(value)}
      </strong>

    </div>
  );
}


function ProfileSecurityContent({
  roleLabel,
  accountDisplayId,
  accessItems = [],
  onProfileSaved = null,
}) {
  const {
    isLoaded,
    user,
  } = useUser();


  const clerk =
    useClerk();


  const [
    accountProfile,
    setAccountProfile,
  ] = React.useState(null);


  const [
    phone,
    setPhone,
  ] = React.useState("");


  const fileInputRef =
    React.useRef(null);


  const [
    fullName,
    setFullName,
  ] = React.useState("");


  const [
    profileEditing,
    setProfileEditing,
  ] = React.useState(false);


  const [
    profileSaving,
    setProfileSaving,
  ] = React.useState(false);


  const [
    photoSaving,
    setPhotoSaving,
  ] = React.useState(false);


  const [
    profileMessage,
    setProfileMessage,
  ] = React.useState("");


  const [
    profileError,
    setProfileError,
  ] = React.useState("");


  const [
    passwordOpen,
    setPasswordOpen,
  ] = React.useState(false);


  const [
    currentPassword,
    setCurrentPassword,
  ] = React.useState("");


  const [
    newPassword,
    setNewPassword,
  ] = React.useState("");


  const [
    confirmPassword,
    setConfirmPassword,
  ] = React.useState("");


  const [
    passwordSaving,
    setPasswordSaving,
  ] = React.useState(false);


  const [
    passwordError,
    setPasswordError,
  ] = React.useState("");


  const [
    passwordMessage,
    setPasswordMessage,
  ] = React.useState("");


  const [
    resettingPassword,
    setResettingPassword,
  ] = React.useState(false);


  const getEditableName =
    React.useCallback(
      () => {
        if (!user) {
          return "";
        }


        return [
          user.firstName,
          user.lastName,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
      },
      [
        user,
      ]
    );


  React.useEffect(
    () => {
      let active =
        true;


      const loadProfile =
        async () => {
          try {
            const profile =
              await accountProfileService
                .getProfile();


            if (active) {
              setAccountProfile(
                profile
              );
            }
          }
          catch (error) {
            if (active) {
              setProfileError(
                error?.response
                  ?.data
                  ?.message ||
                error?.message ||
                "Your HMS profile could not be loaded."
              );
            }
          }
        };


      void loadProfile();


      return () => {
        active =
          false;
      };
    },
    []
  );


  React.useEffect(
    () => {
      if (!user) {
        return;
      }


      setFullName(
        String(
          accountProfile?.fullName ||
          getEditableName() ||
          ""
        ).trim()
      );


      setPhone(
        String(
          accountProfile?.phone ||
          ""
        ).trim()
      );
    },
    [
      user,
      accountProfile,
      getEditableName,
    ]
  );


  React.useEffect(
    () => {
      if (!passwordOpen) {
        return undefined;
      }


      const previousOverflow =
        document.body.style.overflow;


      document.body.style.overflow =
        "hidden";


      const handleKeyDown =
        (event) => {
          if (
            event.key ===
            "Escape"
          ) {
            setPasswordOpen(false);
          }
        };


      window.addEventListener(
        "keydown",
        handleKeyDown
      );


      return () => {
        document.body.style.overflow =
          previousOverflow;

        window.removeEventListener(
          "keydown",
          handleKeyDown
        );
      };
    },
    [
      passwordOpen,
    ]
  );


  const getClerkErrorMessage =
    (error) => {
      return (
        error?.errors?.[0]?.longMessage ||
        error?.errors?.[0]?.message ||
        error?.message ||
        "The account update could not be completed."
      );
    };


  const formatDateTime =
    (value) => {
      if (!value) {
        return "—";
      }


      const date =
        value instanceof Date
          ? value
          : new Date(value);


      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return "—";
      }


      return date.toLocaleString(
        "en-IN",
        {
          day:
            "2-digit",

          month:
            "short",

          year:
            "numeric",

          hour:
            "2-digit",

          minute:
            "2-digit",
        }
      );
    };


  const primaryEmail =
    accountProfile?.email ||
    user?.primaryEmailAddress
      ?.emailAddress ||
    "—";


  const primaryPhone =
    accountProfile?.phone ||
    "Not added";


  const emailVerified =
    user?.primaryEmailAddress
      ?.verification
      ?.status ===
    "verified";


  const displayName =
    accountProfile?.fullName ||
    getEditableName() ||
    primaryEmail ||
    "Account User";


  const imageUrl =
    user?.imageUrl ||
    "";


  const clearProfileFeedback =
    () => {
      setProfileMessage("");
      setProfileError("");
    };


  const handleEditProfile =
    () => {
      clearProfileFeedback();


      setFullName(
        String(
          accountProfile?.fullName ||
          getEditableName() ||
          ""
        ).trim()
      );


      setPhone(
        String(
          accountProfile?.phone ||
          ""
        ).trim()
      );


      setProfileEditing(true);
    };


  const handleCancelProfile =
    () => {
      clearProfileFeedback();


      setFullName(
        String(
          accountProfile?.fullName ||
          getEditableName() ||
          ""
        ).trim()
      );


      setPhone(
        String(
          accountProfile?.phone ||
          ""
        ).trim()
      );


      setProfileEditing(false);
    };


  const handleSaveProfile =
    async () => {
      if (
        !user ||
        profileSaving
      ) {
        return;
      }


      clearProfileFeedback();


      const normalizedName =
        String(
          fullName ||
          ""
        )
          .replace(
            /\s+/g,
            " "
          )
          .trim();


      const normalizedPhone =
        String(
          phone ||
          ""
        ).trim();


      if (
        normalizedName.length <
        2
      ) {
        setProfileError(
          "Please enter your full name."
        );

        return;
      }


      if (
        normalizedPhone &&
        (
          normalizedPhone.length <
            7 ||
          normalizedPhone.length >
            30 ||
          !/^[0-9+()\-\s]+$/.test(
            normalizedPhone
          )
        )
      ) {
        setProfileError(
          "Enter a valid phone number."
        );

        return;
      }


      try {
        setProfileSaving(true);


        const updatedProfile =
          await accountProfileService
            .updateProfile({
              fullName:
                normalizedName,

              phone:
                normalizedPhone ||
                null,
            });


        setAccountProfile(
          updatedProfile
        );


        setFullName(
          updatedProfile
            ?.fullName ||
          normalizedName
        );


        setPhone(
          String(
            updatedProfile
              ?.phone ||
            ""
          )
        );


        /*
         * HMS MySQL remains the canonical profile authority.
         *
         * Keep Clerk display metadata synchronized internally
         * so existing avatar/name surfaces remain visually
         * consistent. No Clerk UI is exposed to the user.
         */
        try {
          const nameParts =
            normalizedName
              .split(" ");


          const firstName =
            nameParts.length > 1
              ? nameParts
                  .slice(
                    0,
                    -1
                  )
                  .join(" ")
              : nameParts[0];


          const lastName =
            nameParts.length > 1
              ? nameParts[
                  nameParts.length -
                  1
                ]
              : "";


          await user.update({
            firstName,
            lastName,
          });


          if (
            typeof user.reload ===
            "function"
          ) {
            await user.reload();
          }
        }
        catch (syncError) {
          console.warn(
            "[PROFILE_SECURITY:CLERK_DISPLAY_SYNC]",
            syncError
          );
        }


        if (
          typeof onProfileSaved ===
          "function"
        ) {
          await onProfileSaved();
        }


        setProfileEditing(false);

        setProfileMessage(
          "Profile updated successfully."
        );
      }
      catch (error) {
        setProfileError(
          error?.response
            ?.data
            ?.message ||
          getClerkErrorMessage(
            error
          )
        );
      }
      finally {
        setProfileSaving(false);
      }
    };

  const handlePhotoSelect =
    async (event) => {
      const file =
        event.target
          .files?.[0];


      event.target.value =
        "";


      if (
        !file ||
        !user
      ) {
        return;
      }


      clearProfileFeedback();


      if (
        !String(
          file.type ||
          ""
        ).startsWith(
          "image/"
        )
      ) {
        setProfileError(
          "Please select a valid image file."
        );

        return;
      }


      const maxBytes =
        5 * 1024 * 1024;


      if (
        file.size >
        maxBytes
      ) {
        setProfileError(
          "Profile image must be 5 MB or smaller."
        );

        return;
      }


      try {
        setPhotoSaving(true);


        await user.setProfileImage({
          file,
        });


        if (
          typeof user.reload ===
          "function"
        ) {
          await user.reload();
        }


        setProfileMessage(
          "Profile photo updated successfully."
        );
      }
      catch (error) {
        setProfileError(
          getClerkErrorMessage(
            error
          )
        );
      }
      finally {
        setPhotoSaving(false);
      }
    };


  const handleRemovePhoto =
    async () => {
      if (
        !user ||
        photoSaving
      ) {
        return;
      }


      clearProfileFeedback();


      try {
        setPhotoSaving(true);


        await user.setProfileImage({
          file:
            null,
        });


        if (
          typeof user.reload ===
          "function"
        ) {
          await user.reload();
        }


        setProfileMessage(
          "Profile photo removed."
        );
      }
      catch (error) {
        setProfileError(
          getClerkErrorMessage(
            error
          )
        );
      }
      finally {
        setPhotoSaving(false);
      }
    };


  const openPasswordModal =
    () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
      setPasswordMessage("");
      setPasswordOpen(true);
    };


  const closePasswordModal =
    () => {
      if (
        passwordSaving
      ) {
        return;
      }


      setPasswordOpen(false);
      setPasswordError("");
    };


  const handlePasswordSubmit =
    async (event) => {
      event.preventDefault();


      if (
        !user ||
        passwordSaving
      ) {
        return;
      }


      setPasswordError("");
      setPasswordMessage("");


      if (
        !currentPassword
      ) {
        setPasswordError(
          "Enter your current password."
        );

        return;
      }


      if (
        newPassword.length <
        8
      ) {
        setPasswordError(
          "New password must contain at least 8 characters."
        );

        return;
      }


      if (
        newPassword ===
        currentPassword
      ) {
        setPasswordError(
          "New password must be different from the current password."
        );

        return;
      }


      if (
        newPassword !==
        confirmPassword
      ) {
        setPasswordError(
          "New password and confirmation do not match."
        );

        return;
      }


      try {
        setPasswordSaving(true);


        await user.updatePassword({
          currentPassword,
          newPassword,

          signOutOfOtherSessions:
            true,
        });


        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");

        setPasswordOpen(false);

        setPasswordMessage(
          "Password changed successfully. Other sessions were signed out."
        );
      }
      catch (error) {
        setPasswordError(
          getClerkErrorMessage(
            error
          )
        );
      }
      finally {
        setPasswordSaving(false);
      }
    };


  const handleResetPassword =
    async () => {
      if (
        resettingPassword
      ) {
        return;
      }


      setProfileError("");
      setPasswordMessage("");


      try {
        setResettingPassword(
          true
        );


        /*
         * Reset Password is intentionally a signed-out recovery
         * flow. The HMS /forgot-password page owns OTP recovery.
         */
        await clerk.signOut();


        window.location.assign(
          "/forgot-password"
        );
      }
      catch (error) {
        setProfileError(
          getClerkErrorMessage(
            error
          )
        );

        setResettingPassword(
          false
        );
      }
    };


  if (
    !isLoaded
  ) {
    return (
      <div className="profile-security-v2">
        <div className="profile-security-v2__state">
          Loading account security…
        </div>
      </div>
    );
  }


  if (
    !user
  ) {
    return (
      <div className="profile-security-v2">
        <div className="profile-security-v2__state profile-security-v2__state--error">
          Your signed-in account could not be loaded.
        </div>
      </div>
    );
  }


  return (
    <div className="profile-security-v2">

      <header className="profile-security-v2__header">
        <span className="profile-security-v2__eyebrow">
          ACCOUNT &amp; SECURITY
        </span>

        <h1>
          Profile &amp; Security
        </h1>

        <p>
          Manage your personal profile and sign-in security.
          Hotel access and roles remain controlled by HMS.
        </p>
      </header>


      {profileMessage && (
        <div className="profile-security-v2__notice profile-security-v2__notice--success">
          {profileMessage}
        </div>
      )}


      {profileError && (
        <div className="profile-security-v2__notice profile-security-v2__notice--error">
          {profileError}
        </div>
      )}


      {passwordMessage && (
        <div className="profile-security-v2__notice profile-security-v2__notice--success">
          {passwordMessage}
        </div>
      )}


      <div className="profile-security-v2__primary-grid">

        <section className="profile-security-v2__card">

          <div className="profile-security-v2__card-header">
            <div>
              <h2>
                Account Profile
              </h2>

              <p>
                Your personal identity used for HMS sign-in.
              </p>
            </div>

            <span className="profile-security-v2__role-badge">
              {safeText(
                roleLabel
              )}
            </span>
          </div>


          <div className="profile-security-v2__identity">

            <div className="profile-security-v2__avatar-wrap">

              {imageUrl ? (
                <img
                  className="profile-security-v2__avatar"
                  src={imageUrl}
                  alt=""
                />
              ) : (
                <div className="profile-security-v2__avatar profile-security-v2__avatar--fallback">
                  {String(
                    displayName ||
                    "U"
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}


              <button
                type="button"
                className="profile-security-v2__photo-button"
                onClick={() =>
                  fileInputRef
                    .current
                    ?.click()
                }
                disabled={
                  photoSaving
                }
              >
                {photoSaving
                  ? "Saving…"
                  : "Change Photo"}
              </button>


              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="profile-security-v2__hidden-input"
                onChange={
                  handlePhotoSelect
                }
              />


              {imageUrl && (
                <button
                  type="button"
                  className="profile-security-v2__remove-photo"
                  onClick={
                    handleRemovePhoto
                  }
                  disabled={
                    photoSaving
                  }
                >
                  Remove
                </button>
              )}

            </div>


            <div className="profile-security-v2__identity-copy">
              <strong>
                {displayName}
              </strong>

              <span>
                {primaryEmail}
              </span>

              <small>
                {safeText(
                  accountProfile
                    ?.displayId ||
                  accountDisplayId
                )}
              </small>
            </div>

          </div>


          <div className="profile-security-v2__details">

            <div className="profile-security-v2__detail-row">
              <span className="profile-security-v2__detail-label">
                Full Name
              </span>

              {profileEditing ? (
                <input
                  className="profile-security-v2__input"
                  type="text"
                  value={
                    fullName
                  }
                  onChange={
                    (event) =>
                      setFullName(
                        event.target
                          .value
                      )
                  }
                  maxLength={
                    100
                  }
                  autoComplete="name"
                />
              ) : (
                <strong className="profile-security-v2__detail-value">
                  {safeText(
                    accountProfile
                      ?.fullName ||
                    getEditableName()
                  )}
                </strong>
              )}
            </div>


            <div className="profile-security-v2__detail-row">
              <span className="profile-security-v2__detail-label">
                Email
              </span>

              <strong className="profile-security-v2__detail-value profile-security-v2__detail-value--break">
                {primaryEmail}
              </strong>
            </div>


            <div className="profile-security-v2__detail-row">
              <span className="profile-security-v2__detail-label">
                Phone
              </span>

              {profileEditing ? (
                <input
                  className="profile-security-v2__input"
                  type="tel"
                  value={
                    phone
                  }
                  onChange={
                    (event) =>
                      setPhone(
                        event.target
                          .value
                      )
                  }
                  maxLength={
                    30
                  }
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                />
              ) : (
                <div className="profile-security-v2__editable-value">
                  <strong className="profile-security-v2__detail-value">
                    {primaryPhone}
                  </strong>

                  <span>
                    {accountProfile?.phone
                      ? "Edit from Edit Profile"
                      : "Add from Edit Profile"}
                  </span>
                </div>
              )}
            </div>


            <div className="profile-security-v2__detail-row">
              <span className="profile-security-v2__detail-label">
                Email Verification
              </span>

              <span
                className={
                  emailVerified
                    ? "profile-security-v2__status profile-security-v2__status--success"
                    : "profile-security-v2__status profile-security-v2__status--warning"
                }
              >
                {emailVerified
                  ? "Verified"
                  : "Not Verified"}
              </span>
            </div>

          </div>


          <div className="profile-security-v2__profile-footer">

            <p>
              Email and HMS access permissions are intentionally
              read-only here to prevent account and hotel assignment mismatch.
            </p>


            <div className="profile-security-v2__actions">

              {profileEditing ? (
                <>
                  <button
                    type="button"
                    className="profile-security-v2__button profile-security-v2__button--secondary"
                    onClick={
                      handleCancelProfile
                    }
                    disabled={
                      profileSaving
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="profile-security-v2__button profile-security-v2__button--primary"
                    onClick={
                      handleSaveProfile
                    }
                    disabled={
                      profileSaving
                    }
                  >
                    {profileSaving
                      ? "Saving…"
                      : "Save Changes"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="profile-security-v2__button profile-security-v2__button--secondary"
                  onClick={
                    handleEditProfile
                  }
                >
                  Edit Profile
                </button>
              )}

            </div>

          </div>

        </section>


        <section className="profile-security-v2__card">

          <div className="profile-security-v2__card-header">
            <div>
              <h2>
                Sign-in Security
              </h2>

              <p>
                Password and account authentication are securely
                handled without exposing Clerk controls.
              </p>
            </div>

            <span className="profile-security-v2__security-badge">
              Protected
            </span>
          </div>


          <div className="profile-security-v2__security-list">

            <div className="profile-security-v2__security-row">

              <div>
                <strong>
                  Password
                </strong>

                <span>
                  Change your sign-in password securely.
                </span>
              </div>

              <div className="profile-security-v2__security-action">
                <span className="profile-security-v2__status profile-security-v2__status--success">
                  Protected
                </span>

                <button
                  type="button"
                  className="profile-security-v2__button profile-security-v2__button--primary profile-security-v2__button--security"
                  onClick={
                    openPasswordModal
                  }
                >
                  Change Password
                </button>
              </div>

            </div>


            <div className="profile-security-v2__security-row">

              <div>
                <strong>
                  Email Verification
                </strong>

                <span className="profile-security-v2__break">
                  {primaryEmail}
                </span>
              </div>

              <span
                className={
                  emailVerified
                    ? "profile-security-v2__status profile-security-v2__status--success"
                    : "profile-security-v2__status profile-security-v2__status--warning"
                }
              >
                {emailVerified
                  ? "Verified"
                  : "Not Verified"}
              </span>

            </div>


            <div className="profile-security-v2__security-row">

              <div>
                <strong>
                  Last Sign-in
                </strong>

                <span>
                  Latest authenticated account activity.
                </span>
              </div>

              <strong className="profile-security-v2__security-value">
                {formatDateTime(
                  user.lastSignInAt
                )}
              </strong>

            </div>

          </div>


          <div className="profile-security-v2__security-note">

            <div className="profile-security-v2__security-note-copy">
              <strong>
                Forgot your current password?
              </strong>

              <span>
                Reset Password securely signs you out and opens
                the HMS email verification recovery flow.
              </span>
            </div>


            <button
              type="button"
              className="profile-security-v2__button profile-security-v2__button--secondary profile-security-v2__button--reset"
              onClick={
                handleResetPassword
              }
              disabled={
                resettingPassword
              }
            >
              {resettingPassword
                ? "Opening Recovery…"
                : "Reset Password"}
            </button>

          </div>

        </section>

      </div>


      <section className="profile-security-v2__card profile-security-v2__access-card">

        <div className="profile-security-v2__card-header">
          <div>
            <h2>
              Access Context
            </h2>

            <p>
              Authorization information is controlled by HMS and cannot
              be changed from this page.
            </p>
          </div>
        </div>


        <div className="profile-security-v2__access-grid">

          {accessItems.map(
            (
              item,
              index
            ) => (
              <div
                className="profile-security-v2__access-item"
                key={
                  `${item?.label || "access"}-${index}`
                }
              >
                <span>
                  {safeText(
                    item?.label
                  )}
                </span>

                <strong className="profile-security-v2__break">
                  {safeText(
                    item?.value
                  )}
                </strong>
              </div>
            )
          )}

        </div>

      </section>


      {passwordOpen && (
        <div
          className="profile-security-v2__modal-backdrop"
          role="presentation"
          onMouseDown={
            (event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closePasswordModal();
              }
            }
          }
        >

          <section
            className="profile-security-v2__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
          >

            <div className="profile-security-v2__modal-header">

              <div>
                <span className="profile-security-v2__eyebrow">
                  SIGN-IN SECURITY
                </span>

                <h2 id="change-password-title">
                  Change Password
                </h2>

                <p>
                  Enter your current password and choose a new secure password.
                </p>
              </div>


              <button
                type="button"
                className="profile-security-v2__modal-close"
                onClick={
                  closePasswordModal
                }
                disabled={
                  passwordSaving
                }
                aria-label="Close"
              >
                ×
              </button>

            </div>


            <form
              className="profile-security-v2__password-form"
              onSubmit={
                handlePasswordSubmit
              }
            >

              {passwordError && (
                <div className="profile-security-v2__notice profile-security-v2__notice--error">
                  {passwordError}
                </div>
              )}


              <label className="profile-security-v2__field">
                <span>
                  Current Password
                </span>

                <input
                  type="password"
                  value={
                    currentPassword
                  }
                  onChange={
                    (event) =>
                      setCurrentPassword(
                        event.target
                          .value
                      )
                  }
                  autoComplete="current-password"
                  disabled={
                    passwordSaving
                  }
                />
              </label>


              <label className="profile-security-v2__field">
                <span>
                  New Password
                </span>

                <input
                  type="password"
                  value={
                    newPassword
                  }
                  onChange={
                    (event) =>
                      setNewPassword(
                        event.target
                          .value
                      )
                  }
                  autoComplete="new-password"
                  disabled={
                    passwordSaving
                  }
                />
              </label>


              <label className="profile-security-v2__field">
                <span>
                  Confirm New Password
                </span>

                <input
                  type="password"
                  value={
                    confirmPassword
                  }
                  onChange={
                    (event) =>
                      setConfirmPassword(
                        event.target
                          .value
                      )
                  }
                  autoComplete="new-password"
                  disabled={
                    passwordSaving
                  }
                />
              </label>


              <div className="profile-security-v2__password-rules">
                <strong>
                  Password requirements
                </strong>

                <span>
                  Minimum 8 characters and different from your current password.
                </span>

                <span>
                  Changing the password will sign out your other active sessions.
                </span>
              </div>


              <div className="profile-security-v2__modal-actions">

                <button
                  type="button"
                  className="profile-security-v2__button profile-security-v2__button--secondary"
                  onClick={
                    closePasswordModal
                  }
                  disabled={
                    passwordSaving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="profile-security-v2__button profile-security-v2__button--primary"
                  disabled={
                    passwordSaving
                  }
                >
                  {passwordSaving
                    ? "Changing…"
                    : "Change Password"}
                </button>

              </div>

            </form>

          </section>

        </div>
      )}

    </div>
  );
}

/* ============================================================
   HOTEL ADMIN
============================================================ */

function ProfileSecurityPage() {
  const {
    adminProfile,
    selectedHotel,
    refreshAdminContext,
  } = useOutletContext();


  const adminDisplayId =
    adminProfile?.displayId ||
    adminProfile?.display_id ||
    adminProfile?.adminDisplayId ||
    adminProfile?.admin_display_id ||
    null;


  return (
    <ProfileSecurityContent
      roleLabel="Hotel Admin"
      accountDisplayId={
        adminDisplayId
      }
      onProfileSaved={
        refreshAdminContext
      }
      accessItems={[
        {
          label:
            "Assigned Hotel",

          value:
            selectedHotel?.name,
        },

        {
          label:
            "Hotel Code",

          value:
            selectedHotel?.displayId ||
            selectedHotel?.display_id,
        },

        {
          label:
            "Hotel Status",

          value:
            selectedHotel?.status,
        },

        {
          label:
            "Role",

          value:
            "Hotel Admin",
        },
      ]}
    />
  );
}


/* ============================================================
   SUPER ADMIN
============================================================ */

function SuperAdminProfileSecurityPage() {

  const sidebar = (
    <SuperAdminSidebar
      selectedHotel={null}
    />
  );


  const topbar = (
    <SuperAdminTopbar
      title="Profile & Security"
      selectedHotel={null}
      breadcrumbs={[
        {
          label:
            "Portfolio",

          to:
            "/superadmin-dashboard",
        },

        {
          label:
            "Account",
        },

        {
          label:
            "Profile & Security",
        },
      ]}
    />
  );


  return (
    <SuperAdminLayout
      sidebar={sidebar}
      topbar={topbar}
    >

      <ProfileSecurityContent
        roleLabel="Business Owner"
        accessItems={[
          {
            label:
              "Account Role",

            value:
              "Super Admin",
          },

          {
            label:
              "Portfolio Scope",

            value:
              "Owned Hotels",
          },

          {
            label:
              "Authentication",

            value:
              "Clerk",
          },

          {
            label:
              "Password Storage",

            value:
              "Clerk only",
          },
        ]}
      />

    </SuperAdminLayout>
  );
}


export {
  SuperAdminProfileSecurityPage,
};

export default ProfileSecurityPage;