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

export const BOOKING_STAY_TYPES =
  new Set([
    "overnight",
    "day_use",
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
   STAY DURATION
============================================================ */

function calculateStayMinutes(
  checkIn,
  checkOut
) {
  if (
    !checkIn ||
    !checkOut
  ) {
    return 0;
  }


  const start =
    new Date(
      checkIn
    );


  const end =
    new Date(
      checkOut
    );


  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    ) ||
    end <= start
  ) {
    return 0;
  }


  return (
    end.getTime() -
    start.getTime()
  ) / (
    60 *
    1000
  );
}

/* ============================================================
   STEP 2
============================================================ */

export function validateStayRoomsStep({
  booking,
  nights,
  selectedRooms,
}) {
  const stayType =
    String(
      booking?.stay_type ||
      ""
    ).trim();


  if (
    !BOOKING_STAY_TYPES.has(
      stayType
    )
  ) {
    return (
      "Select a valid stay type."
    );
  }


  if (
    !booking.check_in ||
    !booking.check_out
  ) {
    return stayType ===
      "day_use"
      ? "Day Use check-in and check-out date/time are required."
      : "Check-in and expected check-out dates are required.";
  }


  /* ==========================================================
     OVERNIGHT
  ========================================================== */

  if (
    stayType ===
    "overnight"
  ) {
    if (
      nights <= 0
    ) {
      return (
        "Expected check-out date must be after the check-in date."
      );
    }
  }


  /* ==========================================================
     DAY USE / SHORT STAY

     Initial Day Use booking must:
     - start and end on same calendar date
     - checkout later than check-in
  ========================================================== */

  if (
    stayType ===
    "day_use"
  ) {
    const checkInDate =
      String(
        booking.check_in
      ).slice(
        0,
        10
      );


    const checkOutDate =
      String(
        booking.check_out
      ).slice(
        0,
        10
      );


    if (
      checkInDate !==
      checkOutDate
    ) {
      return (
        "Day Use / Short Stay must start and end on the same calendar date."
      );
    }


    const durationMinutes =
      calculateStayMinutes(
        booking.check_in,
        booking.check_out
      );


    if (
      durationMinutes <= 0
    ) {
      return (
        "Day Use check-out time must be later than check-in time."
      );
    }
  }


  if (
    !Array.isArray(
      selectedRooms
    ) ||
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

  refund,
  pricingQuote,
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


  /* ==========================================================
     EDIT MODE REFUND

     A cheaper edited booking may require an exact backend-
     calculated refund before it can be saved.
  ========================================================== */

  if (
    isEditMode
  ) {
    const refundRequired =
      pricingQuote
        ?.refund_required ===
        true &&
      Number(
        pricingQuote
          ?.refund_required_amount ||
        0
      ) >
        0.009;


    if (
      !refundRequired
    ) {
      return "";
    }


    const refundMethod =
      String(
        refund
          ?.payment_method ||
        ""
      )
        .trim()
        .toLowerCase();


    if (
      ![
        "cash",
        "card",
        "upi",
        "bank_transfer",
      ].includes(
        refundMethod
      )
    ) {
      return (
        "Select a valid refund method."
      );
    }


    const transactionId =
      String(
        refund
          ?.transaction_id ||
        ""
      ).trim();


    if (
      refundMethod !==
        "cash" &&
      !transactionId
    ) {
      return (
        "Transaction ID is required for UPI, Card or Bank Transfer refunds."
      );
    }


    if (
      transactionId.length >
      255
    ) {
      return (
        "Refund transaction ID is too long."
      );
    }


    const notes =
      String(
        refund
          ?.notes ||
        ""
      ).trim();


    if (!notes) {
      return (
        "Enter a reason for the refund."
      );
    }


    if (
      notes.length >
      500
    ) {
      return (
        "Refund reason cannot exceed 500 characters."
      );
    }


    return "";
  }


  /* ==========================================================
     NEW BOOKING PAYMENT
  ========================================================== */

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