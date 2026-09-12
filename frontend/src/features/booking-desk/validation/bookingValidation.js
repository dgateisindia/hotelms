import {
  buildPhoneNumber,
  normalizeStoredPhone,
} from "../utils/bookingUtils";


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

const LEGACY_ALLOWED_ID_PROOF_TYPES = [
  "Aadhaar",
  "Passport",
  "Driving Licence",
  "Voter ID",
  "Other",
];


const ID_PROOF_TYPE_ALIASES = {
  aadhaar: "Aadhaar",
  aadhar: "Aadhaar",

  passport: "Passport",

  "driving licence":
    "Driving Licence",

  "driving license":
    "Driving Licence",

  dl: "Driving Licence",

  "voter id": "Voter ID",
  voterid: "Voter ID",
  epic: "Voter ID",

  other: "Other",
};


function normalizeIdProofType(
  value
) {
  const key =
    String(
      value || ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        " "
      );

  if (!key) {
    return null;
  }

  return (
    ID_PROOF_TYPE_ALIASES[
      key
    ] ||
    null
  );
}


function getAllowedIdProofTypes(
  policy
) {
  const configured =
    policy
      ?.allowed_id_proof_types;

  /*
   * Old booking snapshot:
   * fixed compatibility list.
   *
   * Never use today's hotel settings
   * for an old immutable snapshot.
   */
  if (
    configured ===
      undefined ||
    configured ===
      null
  ) {
    return [
      ...LEGACY_ALLOWED_ID_PROOF_TYPES,
    ];
  }

  return Array.isArray(
    configured
  )
    ? configured
    : [];
}


function validateOptionalGuestPhone(
  value
) {
  const phone =
    String(
      value || ""
    ).trim();

  if (!phone) {
    return "";
  }

  if (
    phone.length > 30
  ) {
    return (
      "Guest mobile number is too long."
    );
  }

  if (
    !/^[+\d\s().-]+$/.test(
      phone
    )
  ) {
    return (
      "Guest mobile number contains invalid characters."
    );
  }

  const digitCount =
    phone.replace(
      /\D/g,
      ""
    ).length;

  if (
    digitCount < 7 ||
    digitCount > 15
  ) {
    return (
      "Guest mobile number must contain between 7 and 15 digits."
    );
  }

  return "";
}

/* ============================================================
   ID PROOF
============================================================ */

export function validateIdProof(
  type,
  number,
  allowedTypes =
    LEGACY_ALLOWED_ID_PROOF_TYPES
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


  const canonicalType =
    normalizeIdProofType(
      proofType
    );

  if (!canonicalType) {
    return (
      "ID proof type is not supported."
    );
  }


  const resolvedAllowedTypes =
    Array.isArray(
      allowedTypes
    )
      ? allowedTypes
      : LEGACY_ALLOWED_ID_PROOF_TYPES;


  if (
    !resolvedAllowedTypes
      .includes(
        canonicalType
      )
  ) {
    return (
      `${canonicalType} is not allowed by this booking's guest ID policy.`
    );
  }


  if (
    canonicalType ===
    "Aadhaar"
  ) {
    if (
      !/^[0-9\s-]+$/.test(
        proofNumber
      )
    ) {
      return (
        "Aadhaar number must contain only digits, spaces or hyphens."
      );
    }

    const normalized =
      proofNumber.replace(
        /[\s-]/g,
        ""
      );

    return /^\d{12}$/.test(
      normalized
    )
      ? ""
      : "Aadhaar number must contain exactly 12 digits.";
  }


  if (
    canonicalType ===
    "Passport"
  ) {
    const normalized =
      proofNumber
        .replace(
          /\s+/g,
          ""
        )
        .toUpperCase();

    return /^[A-Z0-9]{5,20}$/.test(
      normalized
    )
      ? ""
      : "Passport number must contain 5 to 20 letters or digits.";
  }


  if (
    canonicalType ===
    "Driving Licence"
  ) {
    const normalized =
      proofNumber
        .toUpperCase()
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    return /^[A-Z0-9 /-]{5,30}$/.test(
      normalized
    )
      ? ""
      : "Enter a valid Driving Licence number.";
  }


  if (
    canonicalType ===
    "Voter ID"
  ) {
    const normalized =
      proofNumber
        .replace(
          /\s+/g,
          ""
        )
        .toUpperCase();

    return /^[A-Z0-9]{8,20}$/.test(
      normalized
    )
      ? ""
      : "Voter ID number must contain 8 to 20 letters or digits.";
  }


  /*
   * Other
   */
  if (
    proofNumber.length < 4 ||
    proofNumber.length > 50
  ) {
    return (
      "ID proof number must contain 4 to 50 characters."
    );
  }


  if (
    /[\u0000-\u001F\u007F]/.test(
      proofNumber
    )
  ) {
    return (
      "ID proof number contains invalid characters."
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
      "Reservation contact name is required."
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
  guestRequirementsPolicy,
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


  const policy =
    guestRequirementsPolicy ||
    {};


  const email =
    String(
      guest?.email ||
      ""
    ).trim();


  if (
    policy.email_required ===
      true &&
    !email
  ) {
    return (
      "Email address is required by the hotel guest policy."
    );
  }


  const phone =
    matchedCustomer
      ? normalizeStoredPhone(
          matchedCustomer.phone
        )
      : buildPhoneNumber(
          guest.phone
        );


  /*
  * Booking Desk uses the Reservation Contact phone
  * as the customer identity / lookup key.
  *
  * This is separate from optional room-wise guest phones.
  */
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

function validateRoomStayRange({
  room,
  roomNumber,
  stayType,
  booking,
}) {
  const checkIn =
    room?.check_in ||
    booking?.check_in ||
    "";

  const checkOut =
    room?.check_out ||
    booking?.check_out ||
    "";

  if (
    !checkIn ||
    !checkOut
  ) {
    return stayType ===
      "day_use"
      ? `Room ${roomNumber}: check-in and check-out date/time are required.`
      : `Room ${roomNumber}: check-in and expected check-out dates are required.`;
  }

  if (
    stayType ===
    "day_use"
  ) {
    const checkInDate =
      String(
        checkIn
      ).slice(
        0,
        10
      );

    const checkOutDate =
      String(
        checkOut
      ).slice(
        0,
        10
      );

    if (
      checkInDate !==
      checkOutDate
    ) {
      return (
        `Room ${roomNumber}: Day Use must start and end on the same calendar date.`
      );
    }

    if (
      calculateStayMinutes(
        checkIn,
        checkOut
      ) <= 0
    ) {
      return (
        `Room ${roomNumber}: check-out time must be later than check-in time.`
      );
    }

    return "";
  }

  if (
    calculateStayMinutes(
      checkIn,
      checkOut
    ) <= 0
  ) {
    return (
      `Room ${roomNumber}: expected check-out date must be after the check-in date.`
    );
  }

  return "";
}

/* ============================================================
   GUEST & OCCUPANCY HELPERS
============================================================ */

function getRoomRosterCount(
  room
) {
  if (
    room?.roster_captured ===
    true
  ) {
    return (
      (
        room
          .primary_guest_staying ===
        true
          ? 1
          : 0
      ) +
      (
        Array.isArray(
          room.guests
        )
          ? room.guests.length
          : 0
      )
    );
  }


  return Number(
    room?.total_guests ||
    0
  );
}


function getChildAgeRule(
  policy,
  value
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }


  const age =
    Number(
      value
    );


  if (
    !Number.isInteger(
      age
    ) ||
    age < 0
  ) {
    return null;
  }


  const rules =
    Array.isArray(
      policy?.child_age_rules
    )
      ? policy.child_age_rules
      : [];


  return (
    rules.find(
      (rule) =>
        age >=
          Number(
            rule.min_age
          ) &&
        age <=
          Number(
            rule.max_age
          )
    ) ||
    null
  );
}


function guestUsesExtraBed(
  guest,
  policy
) {
  if (!guest) {
    return false;
  }


  if (
    guest.guest_type !==
    "child"
  ) {
    return (
      guest.extra_bed_used ===
      true
    );
  }


  const rule =
    getChildAgeRule(
      policy,
      guest.age
    );


  /*
   * Required bed is authoritative from policy,
   * even if UI checkbox state is stale.
   */
  if (
    rule?.bed_policy ===
    "extra_bed_required"
  ) {
    return true;
  }


  if (
    rule?.bed_policy ===
    "share_existing_bed"
  ) {
    return false;
  }


  return (
    guest.extra_bed_used ===
    true
  );
}


function getRoomExtraBedUsage(
  room,
  policy
) {
  const guests =
    Array.isArray(
      room?.guests
    )
      ? room.guests
      : [];


  return guests.reduce(
    (
      total,
      guest
    ) =>
      total +
      (
        guestUsesExtraBed(
          guest,
          policy
        )
          ? 1
          : 0
      ),
    0
  );
}

function validateAccompanyingGuest({
  guest,
  guestIndex,
  roomNumber,
  policy,
}) {
  const label =
    `Room ${roomNumber}, Guest ${guestIndex + 1}`;


  const guestType =
    String(
      guest?.guest_type ||
      ""
    ).trim();


  if (
    ![
      "adult",
      "child",
    ].includes(
      guestType
    )
  ) {
    return (
      `${label}: select Adult or Child.`
    );
  }


  const fullName =
    String(
      guest?.full_name ||
      ""
    ).trim();


  if (
    policy
      .all_guest_names_required ===
      true &&
    !fullName
  ) {
    return (
      `${label}: full name is required by the hotel guest policy.`
    );
  }


  if (
    fullName.length >
    150
  ) {
    return (
      `${label}: full name cannot exceed 150 characters.`
    );
  }

  const phoneError =
    validateOptionalGuestPhone(
      guest?.phone
    );

  if (phoneError) {
    return (
      `${label}: ${phoneError}`
    );
  }

  const isChild =
    guestType ===
    "child";


  const idRequired =
    isChild
      ? policy
          .child_id_required ===
        true
      : policy
          .other_adult_id_required ===
        true;


  const proofType =
    String(
      guest?.id_proof_type ||
      ""
    ).trim();


  const proofNumber =
    String(
      guest?.id_proof_number ||
      ""
    ).trim();


  if (
    idRequired &&
    (
      !proofType ||
      !proofNumber
    )
  ) {
    return (
      `${label}: ID proof type and number are required.`
    );
  }


  const idError =
    validateIdProof(
      proofType,
      proofNumber,
      getAllowedIdProofTypes(
        policy
      )
    );


  if (
    idError
  ) {
    return (
      `${label}: ${idError}`
    );
  }


  if (
    guest?.extra_bed_used ===
      true &&
    policy.extra_bed_enabled !==
      true
  ) {
    return (
      `${label}: extra bed cannot be used because Extra Beds are disabled in the hotel policy.`
    );
  }


  if (
    !isChild
  ) {
    return "";
  }


  const ageValue =
    guest?.age;


  const ageMissing =
    ageValue === "" ||
    ageValue === null ||
    ageValue === undefined;


  if (
    policy
      .child_age_required ===
      true &&
    ageMissing
  ) {
    return (
      `${label}: child age is required.`
    );
  }


  let age =
    null;


  if (
    !ageMissing
  ) {
    age =
      Number(
        ageValue
      );


    const adultAgeFrom =
      Number.isInteger(
        Number(
          policy
            .adult_age_from
        )
      ) &&
      Number(
        policy
          .adult_age_from
      ) > 0
        ? Number(
            policy
              .adult_age_from
          )
        : 18;


    if (
      !Number.isInteger(
        age
      ) ||
      age < 0 ||
      age >=
        adultAgeFrom
    ) {
      return (
        `${label}: enter a valid child age below ${adultAgeFrom}.`
      );
    }
  }


  const childRules =
    Array.isArray(
      policy
        .child_age_rules
    )
      ? policy.child_age_rules
      : [];


  const childRule =
    age === null
      ? null
      : getChildAgeRule(
          policy,
          age
        );


  if (
    age !== null &&
    childRules.length >
      0 &&
    !childRule
  ) {
    return (
      `${label}: child age does not match any configured hotel age slab.`
    );
  }


  if (
    childRule &&
    policy.extra_bed_enabled ===
      true
  ) {
    if (
      childRule
        .bed_policy ===
        "extra_bed_required" &&
      guest
        ?.extra_bed_used !==
        true
    ) {
      return (
        `${label}: an extra bed is required for this child age slab.`
      );
    }


    if (
      childRule
        .bed_policy ===
        "share_existing_bed" &&
      guest
        ?.extra_bed_used ===
        true
    ) {
      return (
        `${label}: this child age slab must share the existing bed.`
      );
    }
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

  guestRequirementsPolicy,

  reservationContact = null,

  isEditMode,
  isAddRoomMode,
  groupPrimaryGuestAllocated,
  editPrimaryGuestAllocatedElsewhere,
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


  if (
    stayType ===
      "overnight" &&
    nights <= 0
  ) {
    return (
      "Expected check-out date must be after the check-in date."
    );
  }


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


  const policy =
    guestRequirementsPolicy ||
    {};


  let selectedPrimaryCount =
    0;


  for (
    const room of
      selectedRooms
  ) {
    const roomNumber =
      room?.room_number ||
      room?.room_id ||
      "—";


    const roomTimingError =
      validateRoomStayRange({
        room,
        roomNumber,
        stayType,
        booking,
      });


    if (
      roomTimingError
    ) {
      return roomTimingError;
    }


    const capacity =
      Number(
        room?.capacity
      );


    /*
     * Legacy booking:
     * historical guest count preserve karo.
     * Fake guest names create nahi karne.
     */
    if (
      room?.roster_captured !==
      true
    ) {
      const legacyGuests =
        Number(
          room?.total_guests
        );


      if (
        !Number.isSafeInteger(
          legacyGuests
        ) ||
        legacyGuests < 1
      ) {
        return (
          `Room ${roomNumber}: guest count is invalid.`
        );
      }


      if (
        legacyGuests >
        capacity
      ) {
        return (
          `Room ${roomNumber} allows maximum ${capacity} guest(s).`
        );
      }


      continue;
    }


    const accompanyingGuests =
      Array.isArray(
        room.guests
      )
        ? room.guests
        : [];


    const primaryGuestStaying =
      room
        .primary_guest_staying ===
      true;


    if (
      primaryGuestStaying
    ) {
      selectedPrimaryCount +=
        1;
    }


    const rosterCount =
      getRoomRosterCount(
        room
      );


    if (
      !Number.isSafeInteger(
        rosterCount
      ) ||
      rosterCount < 0
    ) {
      return (
        `Room ${roomNumber}: guest count is invalid.`
      );
    }


    if (
      rosterCount >
      capacity
    ) {
      return (
        `Room ${roomNumber} allows maximum ${capacity} guest(s).`
      );
    }


    for (
      let index = 0;
      index <
      accompanyingGuests.length;
      index += 1
    ) {
      const guestError =
        validateAccompanyingGuest({
          guest:
            accompanyingGuests[
              index
            ],

          guestIndex:
            index,

          roomNumber,

          policy,
        });


      if (
        guestError
      ) {
        return guestError;
      }
    }

    /* ========================================================
       PHYSICAL EXTRA-BED LIMIT

       Room capacity and extra-bed capacity are different
       constraints.

       Examples:
       - Adult explicitly uses extra bed
       - Child slab requires extra bed
       Both consume one physical extra bed.
    ======================================================== */

    const maxExtraBeds =
      Number(
        room?.max_extra_beds ??
        0
      );


    if (
      !Number.isSafeInteger(
        maxExtraBeds
      ) ||
      maxExtraBeds < 0
    ) {
      return (
        `Room ${roomNumber}: extra-bed limit is invalid.`
      );
    }


    const extraBedsUsed =
      getRoomExtraBedUsage(
        room,
        policy
      );


    if (
      extraBedsUsed >
      maxExtraBeds
    ) {
      return (
        `Room ${roomNumber} allows maximum ${maxExtraBeds} extra bed${
          maxExtraBeds === 1
            ? ""
            : "s"
        }, but the current guest allocation requires ${extraBedsUsed}.`
      );
    }

  }

  /* ============================================================
    PRIMARY GUEST ID

    Reservation Contact becomes the Primary Guest only when
    explicitly allocated to one of the selected rooms.

    Therefore:
    - Contact ID is not mandatory merely for creating a booking.
    - Primary ID policy applies only after Primary allocation.
  ============================================================ */

  if (
    selectedPrimaryCount > 0 &&
    reservationContact
  ) {
    const primaryProofType =
      String(
        reservationContact
          ?.id_proof_type ||
        ""
      ).trim();

    const primaryProofNumber =
      String(
        reservationContact
          ?.id_proof_number ||
        ""
      ).trim();


    if (
      policy.id_proof_required ===
        true &&
      (
        !primaryProofType ||
        !primaryProofNumber
      )
    ) {
      return (
        "Primary Guest ID proof type and number are required by the hotel guest policy."
      );
    }


    const primaryIdError =
      validateIdProof(
        primaryProofType,
        primaryProofNumber,
        getAllowedIdProofTypes(
          policy
        )
      );


    if (primaryIdError) {
      return (
        `Primary Guest: ${primaryIdError}`
      );
    }
  }

  /*
   * Across newly-selected rooms there can never be
   * more than one Primary Guest.
   */
  if (
    selectedPrimaryCount >
    1
  ) {
    return (
      "The Primary Guest can be allocated to only one room in the reservation."
    );
  }


  /*
   * Add Room:
   * existing group already owns Primary.
   */
  if (
    isAddRoomMode &&
    groupPrimaryGuestAllocated ===
      true &&
    selectedPrimaryCount >
      0
  ) {
    return (
      "The Primary Guest is already allocated to another room in this reservation."
    );
  }


  /*
   * Single room Edit:
   * another room owns Primary.
   */
  if (
    isEditMode &&
    editPrimaryGuestAllocatedElsewhere ===
      true &&
    selectedPrimaryCount >
      0
  ) {
    return (
      "The Primary Guest already belongs to another room in this reservation group."
    );
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