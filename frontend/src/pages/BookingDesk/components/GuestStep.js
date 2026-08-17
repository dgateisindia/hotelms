import React from "react";

import {
  IcoCheck,
} from "../../../utils/icons/BookingIcons";


function GuestStep({
  guest,
  matchedCustomer,
  editingCustomer,
  savingCustomer,
  isEditMode,
  profileLocked,
  updateGuest,
  startCustomerEdit,
  cancelCustomerEdit,
  saveCustomerDetails,
}) {
  return (
    <div className="booking-desk-section">

      <div className="booking-desk-section__header">

        <div>

          <span className="booking-desk-eyebrow">
            Step 1
          </span>

          <h2>
            Guest & Identity
          </h2>

          <p>
            Search the guest by phone number and record
            the identity details required for the stay.
          </p>

        </div>

      </div>


      {matchedCustomer && (
        <div className="booking-desk-customer-found">

          <IcoCheck />

          <div>
            <strong>
              Existing Customer Found
            </strong>

            <span>
              {
                matchedCustomer.full_name
              }
              {" · "}
              {
                matchedCustomer.phone
              }
            </span>
          </div>


          {editingCustomer ? (
            <div>

              <button
                type="button"
                className="booking-desk-btn booking-desk-btn--secondary"
                disabled={
                  savingCustomer
                }
                onClick={
                  cancelCustomerEdit
                }
              >
                Cancel Edit
              </button>


              <button
                type="button"
                className="booking-desk-btn booking-desk-btn--primary"
                disabled={
                  savingCustomer
                }
                onClick={() =>
                  void saveCustomerDetails()
                }
              >
                {savingCustomer
                  ? "Saving..."
                  : "Save Customer"}
              </button>

            </div>
          ) : (
            <button
              type="button"
              className="booking-desk-btn booking-desk-btn--secondary"
              onClick={
                startCustomerEdit
              }
            >
              Edit Customer Details
            </button>
          )}

        </div>
      )}


      <div className="booking-desk-form-grid">


        <div className="booking-desk-field booking-desk-field--full">

          <label htmlFor="booking-phone">
            Mobile Number
            <span>*</span>
          </label>


          <input
            id="booking-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={
              guest.phone
            }
            placeholder="Enter 10-digit mobile number"
            maxLength={10}
            disabled={
              isEditMode ||
              editingCustomer
            }
            onChange={(
              event
            ) =>
              updateGuest(
                "phone",
                event.target.value
              )
            }
          />


          {!isEditMode && (
            <small>
              Enter a 10-digit Indian mobile number.
            </small>
          )}

        </div>


        <div className="booking-desk-field">

          <label htmlFor="booking-name">
            Guest Name
            <span>*</span>
          </label>

          <input
            id="booking-name"
            type="text"
            value={
              guest.guest_name
            }
            placeholder="Enter full name"
            maxLength={150}
            disabled={
              profileLocked
            }
            onChange={(
              event
            ) =>
              updateGuest(
                "guest_name",
                event.target.value
              )
            }
          />

        </div>


        <div className="booking-desk-field">

          <label htmlFor="booking-email">
            Email
          </label>

          <input
            id="booking-email"
            type="email"
            value={
              guest.email
            }
            placeholder="guest@example.com"
            maxLength={191}
            disabled={
              profileLocked
            }
            onChange={(
              event
            ) =>
              updateGuest(
                "email",
                event.target.value
              )
            }
          />

        </div>


        <div className="booking-desk-field">

          <label htmlFor="booking-gender">
            Gender
          </label>

          <select
            id="booking-gender"
            value={
              guest.gender
            }
            disabled={
              profileLocked
            }
            onChange={(
              event
            ) =>
              updateGuest(
                "gender",
                event.target.value
              )
            }
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

        </div>


        <div className="booking-desk-field">

          <label htmlFor="booking-nationality">
            Nationality
          </label>

          <input
            id="booking-nationality"
            type="text"
            value={
              guest.nationality
            }
            placeholder="Indian"
            maxLength={100}
            disabled={
              profileLocked
            }
            onChange={(
              event
            ) =>
              updateGuest(
                "nationality",
                event.target.value
              )
            }
          />

        </div>


        <div className="booking-desk-field booking-desk-field--full">

          <label htmlFor="booking-address">
            Address
          </label>

          <textarea
            id="booking-address"
            rows="3"
            value={
              guest.address
            }
            placeholder="Guest address"
            maxLength={5000}
            disabled={
              profileLocked
            }
            onChange={(
              event
            ) =>
              updateGuest(
                "address",
                event.target.value
              )
            }
          />

        </div>


        <div className="booking-desk-field">

          <label htmlFor="booking-id-type">
            ID Proof Type
          </label>

          <select
            id="booking-id-type"
            value={
              guest.id_proof_type
            }
            disabled={
              profileLocked
            }
            onChange={(
              event
            ) =>
              updateGuest(
                "id_proof_type",
                event.target.value
              )
            }
          >

            <option value="">
              Select ID proof
            </option>

            <option value="Aadhaar">
              Aadhaar
            </option>

            <option value="Passport">
              Passport
            </option>

            <option value="Driving Licence">
              Driving Licence
            </option>

            <option value="Voter ID">
              Voter ID
            </option>

            <option value="Other">
              Other
            </option>

          </select>

        </div>


        <div className="booking-desk-field">

          <label htmlFor="booking-id-number">
            ID Proof Number
          </label>

          <input
            id="booking-id-number"
            type="text"
            value={
              guest.id_proof_number
            }
            placeholder="Enter ID number"
            maxLength={100}
            disabled={
              profileLocked
            }
            onChange={(
              event
            ) =>
              updateGuest(
                "id_proof_number",
                event.target.value
              )
            }
          />

        </div>

      </div>

    </div>
  );
}


export default GuestStep;