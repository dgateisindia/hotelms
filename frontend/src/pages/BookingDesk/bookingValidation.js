import {
  buildPhoneNumber,
  normalizeStoredPhone,
} from "./bookingUtils";


/* ============================================================
   BOOKING DESK VALIDATION

   Pure validation only.
   No React state.
   No API calls.
============================================================ */


/* ============================================================
   CONSTANTS
============================================================ */

export const EDITABLE_BOOKING_STATUSES =
  new Set([
    "pending",
    "confirmed",
  ]);


/* ============================================================
   ID PROOF
============================================================ */

export function validateIdProof(
  type,
  number
) {
  const proofType =
    String(
      type || ""
    ).trim();

  const proofNumber =
    String(
      number || ""
    ).trim();


  if (
    !proofType &&
    !proofNumber
  ) {
    return "";
  }


  if (
    !proofType ||
    !proofNumber
  ) {
    return (
      "ID proof type and ID proof number must be entered together."
    );
  }


  if (
    proofType ===
    "Aadhaar"
  ) {
    return /^\d{12}$/.test(
      proofNumber
    )
      ? ""
      : "Aadhaar number must contain exactly 12 digits.";
  }


  if (
    proofType ===
    "Passport"
  ) {
    return /^[A-Za-z0-9]{6,20}$/.test(
      proofNumber
    )
      ? ""
      : "Enter a valid passport number.";
  }


  if (
    proofType ===
    "Driving Licence"
  ) {
    return /^[A-Za-z0-9/-]{5,30}$/.test(
      proofNumber
    )
      ? ""
      : "Enter a valid driving licence number.";
  }


  if (
    proofType ===
    "Voter ID"
  ) {
    return /^[A-Za-z0-9]{8,20}$/.test(
      proofNumber
    )
      ? ""
      : "Enter a valid voter ID number.";
  }


  if (
    proofNumber.length < 4 ||
    proofNumber.length > 50
  ) {
    return (
      "Enter a valid ID proof number."
    );
  }


  return "";
}


/* ============================================================
   CUSTOMER PROFILE
============================================================ */

export function validateCustomerProfile(
  guest
) {
  if (
    !guest.guest_name.trim()
  ) {
    return (
      "Guest name is required."
    );
  }


  if (
    guest.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      guest.email.trim()
    )
  ) {
    return (
      "Enter a valid email address."
    );
  }


  return validateIdProof(
    guest.id_proof_type,
    guest.id_proof_number
  );
}


/* ============================================================
   STEP 1
============================================================ */

export function validateGuestStep({
  isEditMode,
  guest,
  matchedCustomer,
}) {
  if (
    isEditMode
  ) {
    return "";
  }


  const profileError =
    validateCustomerProfile(
      guest
    );


  if (
    profileError
  ) {
    return profileError;
  }


  const phone =
    matchedCustomer
      ? normalizeStoredPhone(
          matchedCustomer.phone
        )
      : buildPhoneNumber(
          guest.phone
        );


  if (!phone) {
    return (
      "Enter a valid 10-digit Indian mobile number."
    );
  }


  return "";
}


/* ============================================================
   STEP 2
============================================================ */

export function validateStayRoomsStep({
  booking,
  nights,
  selectedRooms,
}) {
  if (
    !booking.check_in ||
    !booking.check_out
  ) {
    return (
      "Check-in and expected check-out dates are required."
    );
  }


  if (
    nights <= 0
  ) {
    return (
      "Expected check-out must be later than check-in."
    );
  }


  if (
    selectedRooms.length ===
    0
  ) {
    return (
      "Select at least one available room."
    );
  }


  for (
    const room of
    selectedRooms
  ) {
    const guests =
      Number(
        room.total_guests
      );


    if (
      !Number.isSafeInteger(
        guests
      ) ||
      guests < 1
    ) {
      return (
        `Room ${room.room_number}: guest count is invalid.`
      );
    }


    if (
      guests >
      Number(
        room.capacity
      )
    ) {
      return (
        `Room ${room.room_number} allows maximum ${room.capacity} guest(s).`
      );
    }
  }


  return "";
}


/* ============================================================
   STEP 3
============================================================ */

export function validateReservationPaymentStep({
  booking,
  payment,
  isEditMode,
  grandTotal,
}) {
  if (
    !EDITABLE_BOOKING_STATUSES.has(
      booking.booking_status
    )
  ) {
    return (
      "Select Pending or Confirmed as the reservation status."
    );
  }


  if (
    booking.special_request.length >
    5000
  ) {
    return (
      "Special request is too long."
    );
  }


  if (
    isEditMode
  ) {
    return "";
  }


  if (
    payment.mode ===
    "advance"
  ) {
    const amount =
      Number(
        payment.amount
      );


    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      return (
        "Enter a valid advance payment amount."
      );
    }


    if (
      amount >=
      grandTotal
    ) {
      return (
        "Advance amount must be lower than the booking total. Choose Full Payment when the entire amount is received."
      );
    }
  }


  if (
    payment.mode !==
      "none" &&
    ![
      "cash",
      "card",
      "upi",
      "bank_transfer",
    ].includes(
      payment.payment_method
    )
  ) {
    return (
      "Select a valid payment method."
    );
  }


  if (
    payment.mode !==
      "none" &&
    payment.payment_method !==
      "cash" &&
    !payment.transaction_id.trim()
  ) {
    return (
      "Transaction ID is required for UPI, Card or Bank Transfer payments."
    );
  }


  return "";
}