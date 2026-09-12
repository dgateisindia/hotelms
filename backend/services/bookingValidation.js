/* ============================================================
   BOOKING VALIDATION SERVICE

   Purpose:
   - Request validation
   - Normalization
   - Date calculations
   - Customer input validation
   - Booking item validation
   - Initial payment validation

   No database queries belong in this file.
============================================================ */


/* ============================================================
   CONSTANTS
============================================================ */

const BOOKING_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
]);


const RESERVATION_EDIT_STATUSES = new Set([
  "pending",
  "confirmed",
]);

const STAY_TYPES = new Set([
  "overnight",
  "day_use",
]);

const BOOKING_SOURCES = new Set([
  "walk_in",
  "phone",
  "qr",
  "website",
  "other",
]);


const PAYMENT_METHODS = new Set([
  "cash",
  "card",
  "upi",
  "bank_transfer",
]);


const DAY_MS =
  24 *
  60 *
  60 *
  1000;


/* ============================================================
   BASIC VALIDATION
============================================================ */

function parsePositiveInteger(
  value
) {
  const parsed =
    Number(value);


  if (
    Number.isSafeInteger(
      parsed
    ) &&
    parsed > 0
  ) {
    return parsed;
  }


  return null;
}

function parseNonNegativeInteger(
  value
) {
  const parsed =
    Number(value);


  if (
    Number.isSafeInteger(
      parsed
    ) &&
    parsed >= 0
  ) {
    return parsed;
  }


  return null;
}

function parseMoney(
  value
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }


  const amount =
    Number(value);


  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 9999999999.99
  ) {
    return null;
  }


  return Number(
    amount.toFixed(2)
  );
}


function normalizeEnum(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}


function normalizeOptionalText(
  value,
  maxLength
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }


  const text =
    String(value).trim();


  if (
    text.length > maxLength
  ) {
    return null;
  }


  return text;
}

/* ============================================================
   ROOM GUEST ROSTER INPUT

   This performs only structural request validation.

   Hotel-policy validation such as:
   - Adult / Child age
   - ID requirements
   - Extra-bed rules
   - Child pricing

   belongs to bookingGuestService.
============================================================ */

function normalizeGuestRosterFlag(
  value
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return {
      provided: false,
      value: false,
    };
  }

  if (
    value === true ||
    value === 1 ||
    value === "1"
  ) {
    return {
      provided: true,
      value: true,
    };
  }

  if (
    value === false ||
    value === 0 ||
    value === "0"
  ) {
    return {
      provided: true,
      value: false,
    };
  }

  return null;
}

function normalizeRoomGuestRoster(
  raw,
  label
) {
  const primaryRaw =
    raw?.primary_guest_staying ??
    raw?.primaryGuestStaying;

  /*
   * Legacy bookings currently send only total_guests.
   *
   * During Guest & Occupancy rollout we preserve that flow
   * until controller/frontend integration is complete.
   */
  const guestRosterProvided =
    primaryRaw !== undefined ||
    raw?.guests !== undefined;


  if (
    !guestRosterProvided
  ) {
    return {
      error: "",

      value: {
        guestRosterProvided:
          false,

        primaryGuestStaying:
          false,

        guests:
          null,

        totalGuests:
          null,
      },
    };
  }

  const primaryFlag =
    normalizeGuestRosterFlag(
      primaryRaw
    );

  if (
    primaryFlag === null
  ) {
    return {
      error:
        `${label}: primary_guest_staying must be true or false.`,
    };
  }

  const rawGuests =
    raw?.guests === undefined ||
    raw?.guests === null
      ? []
      : raw.guests;

  if (
    !Array.isArray(
      rawGuests
    )
  ) {
    return {
      error:
        `${label}: guests must be an array.`,
    };
  }

  const guests = [];

  for (
    let guestIndex = 0;
    guestIndex <
      rawGuests.length;
    guestIndex += 1
  ) {
    const guest =
      rawGuests[
        guestIndex
      ];

    if (
      !guest ||
      typeof guest !==
        "object" ||
      Array.isArray(
        guest
      )
    ) {
      return {
        error:
          `${label}: guest ${guestIndex + 1} details are invalid.`,
      };
    }

    guests.push({
      ...guest,
    });
  }

  /*
   * Primary guest is also an actual staying occupant.
   */
  const totalGuests =
    (
      primaryFlag.value
        ? 1
        : 0
    ) +
    guests.length;


  /*
   * If client still supplies total_guests together with
   * the roster, it must exactly match the actual roster.
   *
   * Server never silently trusts a conflicting count.
   */
  if (
    raw?.total_guests !==
      undefined &&
    raw?.total_guests !==
      null &&
    String(
      raw.total_guests
    ).trim() !== ""
  ) {
    const declaredTotal =
      parseNonNegativeInteger(
        raw.total_guests
      );


    if (
      declaredTotal === null
    ) {
      return {
        error:
          `${label}: total_guests must be zero or more.`,
      };
    }

    if (
      declaredTotal !==
      totalGuests
    ) {
      return {
        error:
          `${label}: total_guests must match the room guest roster.`,
      };
    }
  }

  return {
    error: "",

    value: {
      guestRosterProvided:
        true,

      primaryGuestStaying:
        primaryFlag.value,

      guests,

      totalGuests,
    },
  };
}

/* ============================================================
   PHONE
============================================================ */

function normalizeIndianPhone(
  value
) {
  const phone =
    String(
      value || ""
    )
      .trim()
      .replace(
        /[\s()\-]/g,
        ""
      );


  /*
   * UI:
   * 9876543210
   *
   * Canonical database:
   * +919876543210
   */

  if (
    /^[6-9]\d{9}$/.test(
      phone
    )
  ) {
    return `+91${phone}`;
  }


  if (
    /^\+91[6-9]\d{9}$/.test(
      phone
    )
  ) {
    return phone;
  }


  /*
   * Transitional legacy support:
   * 919876543210
   */
  if (
    /^91[6-9]\d{9}$/.test(
      phone
    )
  ) {
    return `+${phone}`;
  }


  return null;
}


function getPhoneCandidates(
  value
) {
  const canonical =
    normalizeIndianPhone(
      value
    );


  if (!canonical) {
    return [];
  }


  return [
    canonical,
    canonical.slice(3),
  ];
}


/* ============================================================
   EMAIL
============================================================ */

function normalizeEmail(
  value
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return {
      value: null,
      error: "",
    };
  }


  const email =
    String(value)
      .trim()
      .toLowerCase();


  if (
    email.length > 191 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    return {
      value: null,
      error:
        "Email address is invalid.",
    };
  }


  return {
    value: email,
    error: "",
  };
}


/* ============================================================
   ID PROOF
============================================================ */

function validateIdProof(
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


  const normalizedType =
    proofType.toLowerCase();


  if (
    normalizedType === "aadhaar"
  ) {
    return /^\d{12}$/.test(
      proofNumber
    )
      ? ""
      : "Aadhaar number must contain exactly 12 digits.";
  }


  if (
    normalizedType === "passport"
  ) {
    return /^[A-Za-z0-9]{6,20}$/.test(
      proofNumber
    )
      ? ""
      : "Enter a valid passport number.";
  }


  if (
    normalizedType ===
    "driving licence"
  ) {
    return /^[A-Za-z0-9/-]{5,30}$/.test(
      proofNumber
    )
      ? ""
      : "Enter a valid driving licence number.";
  }


  if (
    normalizedType === "voter id"
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
   BOOKING ENUMS
============================================================ */

function normalizeBookingStatus(
  value,
  fallback = "pending"
) {
  const status =
    normalizeEnum(
      value ||
      fallback
    );


  if (
    !BOOKING_STATUSES.has(
      status
    )
  ) {
    return null;
  }


  return status;
}


function normalizeBookingSource(
  value,
  sourceRequestId
) {
  /*
   * QR source is accepted only when an actual
   * customer request is linked to the booking.
   */
  if (
    sourceRequestId
  ) {
    return "qr";
  }


  const source =
    normalizeEnum(
      value ||
      "walk_in"
    );


  if (
    source === "qr"
  ) {
    return null;
  }


  if (
    !BOOKING_SOURCES.has(
      source
    )
  ) {
    return null;
  }


  return source;
}

function normalizeStayType(
  value,
  fallback = "overnight"
) {
  const stayType =
    normalizeEnum(
      value ||
      fallback
    );


  if (
    !STAY_TYPES.has(
      stayType
    )
  ) {
    return null;
  }


  return stayType;
}

/* ============================================================
   DATE HELPERS
============================================================ */

function isRealUtcDate(
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0
) {
  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
      )
    );


  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() ===
      minute &&
    date.getUTCSeconds() ===
      second
  );
}


function normalizeDateTime(
  value
) {
  const input =
    String(
      value || ""
    ).trim();


  if (!input) {
    return null;
  }


  const dateOnly =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      input
    );


  if (dateOnly) {
    const [
      ,
      year,
      month,
      day,
    ] = dateOnly;


    if (
      !isRealUtcDate(
        Number(year),
        Number(month),
        Number(day)
      )
    ) {
      return null;
    }


    return (
      `${year}-${month}-${day}` +
      " 00:00:00"
    );
  }


  const dateTime =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
      input
    );


  if (dateTime) {
    const [
      ,
      year,
      month,
      day,
      hour,
      minute,
      rawSecond,
    ] = dateTime;


    const second =
      rawSecond ||
      "00";


    if (
      !isRealUtcDate(
        Number(year),
        Number(month),
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      )
    ) {
      return null;
    }


    return (
      `${year}-${month}-${day} ` +
      `${hour}:${minute}:${second}`
    );
  }


  return null;
}


function toMillis(
  mysqlDateTime
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(
      String(
        mysqlDateTime ||
        ""
      )
    );


  if (!match) {
    return NaN;
  }


  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  );
}

function calculateNights(
  checkIn,
  checkOut
) {
  const start =
    toMillis(checkIn);

  const end =
    toMillis(checkOut);


  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start
  ) {
    return 0;
  }


  const startDate =
    String(
      checkIn
    ).slice(
      0,
      10
    );


  const endDate =
    String(
      checkOut
    ).slice(
      0,
      10
    );


  const startMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      startDate
    );


  const endMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      endDate
    );


  if (
    !startMatch ||
    !endMatch
  ) {
    return 0;
  }


  const startDay =
    Date.UTC(
      Number(
        startMatch[1]
      ),
      Number(
        startMatch[2]
      ) - 1,
      Number(
        startMatch[3]
      )
    );


  const endDay =
    Date.UTC(
      Number(
        endMatch[1]
      ),
      Number(
        endMatch[2]
      ) - 1,
      Number(
        endMatch[3]
      )
    );


  return Math.max(
    0,
    Math.round(
      (
        endDay -
        startDay
      ) /
      DAY_MS
    )
  );
}


function calculateStayMinutes(
  checkIn,
  checkOut
) {
  const start =
    toMillis(
      checkIn
    );


  const end =
    toMillis(
      checkOut
    );


  if (
    !Number.isFinite(
      start
    ) ||
    !Number.isFinite(
      end
    ) ||
    end <= start
  ) {
    return 0;
  }


  return (
    end -
    start
  ) / (
    60 *
    1000
  );
}

function rangesOverlap(
  first,
  second
) {
  return (
    toMillis(
      first.checkIn
    ) <
      toMillis(
        second.checkOut
      ) &&
    toMillis(
      first.checkOut
    ) >
      toMillis(
        second.checkIn
      )
  );
}


/* ============================================================
   CUSTOMER VALIDATION
============================================================ */

function validateCustomer(
  body
) {
  const fullName =
    String(
      body?.guest_name ||
      body?.full_name ||
      ""
    ).trim();


  if (!fullName) {
    return {
      error:
        "Guest name is required.",
    };
  }


  if (
    fullName.length > 150
  ) {
    return {
      error:
        "Guest name must not exceed 150 characters.",
    };
  }


  const phone =
    normalizeIndianPhone(
      body?.phone
    );


  if (!phone) {
    return {
      error:
        "Enter a valid 10-digit Indian mobile number.",
    };
  }


  const emailResult =
    normalizeEmail(
      body?.email
    );


  if (
    emailResult.error
  ) {
    return {
      error:
        emailResult.error,
    };
  }


  const gender =
    normalizeOptionalText(
      body?.gender,
      20
    );


  if (
    body?.gender &&
    !gender
  ) {
    return {
      error:
        "Gender must not exceed 20 characters.",
    };
  }


  const nationality =
    normalizeOptionalText(
      body?.nationality,
      100
    );


  if (
    body?.nationality &&
    !nationality
  ) {
    return {
      error:
        "Nationality must not exceed 100 characters.",
    };
  }


  const address =
    normalizeOptionalText(
      body?.address,
      5000
    );


  if (
    body?.address &&
    !address
  ) {
    return {
      error:
        "Address is too long.",
    };
  }


  const idProofType =
    normalizeOptionalText(
      body?.id_proof_type,
      100
    );


  const idProofNumber =
    normalizeOptionalText(
      body?.id_proof_number,
      100
    );


  if (
    Boolean(idProofType) !==
    Boolean(idProofNumber)
  ) {
    return {
      error:
        "ID proof type and ID proof number must be entered together.",
    };
  }


  const idProofError =
    validateIdProof(
      idProofType,
      idProofNumber
    );


  if (
    idProofError
  ) {
    return {
      error:
        idProofError,
    };
  }


  return {
    error: "",

    value: {
      fullName,
      phone,

      email:
        emailResult.value,

      gender,
      nationality,
      address,
      idProofType,
      idProofNumber,
    },
  };
}


/* ============================================================
   BOOKING ITEM VALIDATION
============================================================ */

function validateBookingItems(
  body,
  options = {}
) {
  const {
    allowedStatuses =
      RESERVATION_EDIT_STATUSES,
  } = options;


  const source =
    body &&
    typeof body === "object"
      ? body
      : {};


  const rawItems =
    Array.isArray(
      source.rooms
    ) &&
    source.rooms.length
      ? source.rooms
      : [source];


  if (
    rawItems.length > 20
  ) {
    return {
      error:
        "A maximum of 20 rooms can be booked at one time.",
    };
  }


  const items = [];


  for (
    let index = 0;
    index < rawItems.length;
    index += 1
  ) {
    const raw =
      rawItems[index] ||
      {};


    const label =
      `Room ${index + 1}`;


    const roomId =
      parsePositiveInteger(
        raw.room_id
      );


    if (!roomId) {
      return {
        error:
          `${label}: valid room_id is required.`,
      };
    }


    const checkIn =
      normalizeDateTime(
        raw.check_in
      );


    const checkOut =
      normalizeDateTime(
        raw.check_out
      );


    if (!checkIn) {
      return {
        error:
          `${label}: valid check-in is required.`,
      };
    }


    if (!checkOut) {
      return {
        error:
          `${label}: valid expected check-out is required.`,
      };
    }


    if (
      toMillis(checkOut) <=
      toMillis(checkIn)
    ) {
      return {
        error:
          `${label}: check-out must be later than check-in.`,
      };
    }

    const stayType =
      normalizeStayType(
        raw.stay_type ??
        source.stay_type
      );


    if (!stayType) {
      return {
        error:
          `${label}: stay type must be overnight or day_use.`,
      };
    }


    const nights =
      calculateNights(
        checkIn,
        checkOut
      );


    const durationMinutes =
      calculateStayMinutes(
        checkIn,
        checkOut
      );

    if (
      stayType ===
        "overnight" &&
      nights < 1
    ) {
      return {
        error:
          `${label}: an overnight stay must have a checkout date after the check-in date. Use Day Use / Short Stay for a same-day booking.`,
      };
    }

    if (
      stayType ===
        "day_use" &&
      String(
        checkIn
      ).slice(
        0,
        10
      ) !==
      String(
        checkOut
      ).slice(
        0,
        10
      )
    ) {
      return {
        error:
          `${label}: Day Use / Short Stay must initially start and end on the same calendar date.`,
      };
    }

    const guestRosterResult =
      normalizeRoomGuestRoster(
        raw,
        label
      );


    if (
      guestRosterResult.error
    ) {
      return {
        error:
          guestRosterResult.error,
      };
    }


    const {
      guestRosterProvided,
      primaryGuestStaying,
      guests,
    } =
      guestRosterResult.value;


    /*
    * Flexible reservation model:
    *
    * A room can be reserved with zero occupants captured.
    * Guests may be added and checked in later.
    *
    * If a detailed roster is supplied, its actual size is
    * authoritative. Legacy total_guests is accepted only as
    * a non-negative compatibility value.
    */
    const totalGuests =
      guestRosterProvided
        ? guestRosterResult
            .value
            .totalGuests
        : raw.total_guests ===
              undefined ||
            raw.total_guests ===
              null ||
            String(
              raw.total_guests
            ).trim() === ""
          ? 0
          : parseNonNegativeInteger(
              raw.total_guests
            );


    if (
      totalGuests === null
    ) {
      return {
        error:
          `${label}: total guests must be zero or more.`,
      };
    }


    const bookingStatus =
      normalizeBookingStatus(
        raw.booking_status ??
        source.booking_status
      );


    if (
      !bookingStatus ||
      !allowedStatuses.has(
        bookingStatus
      )
    ) {
      return {
        error:
          `${label}: invalid booking status for this operation.`,
      };
    }


    const rawSpecialRequest =
      raw.special_request ??
      source.special_request;


    const specialRequest =
      normalizeOptionalText(
        rawSpecialRequest,
        5000
      );


    if (
      rawSpecialRequest &&
      !specialRequest
    ) {
      return {
        error:
          `${label}: special request is too long.`,
      };
    }


    items.push({
      roomId,

      stayType,

      checkIn,
      checkOut,

      nights,
      durationMinutes,

      totalGuests,

      guestRosterProvided,
      primaryGuestStaying,
      guests,

      bookingStatus,
      specialRequest,
    });

  }

  const stayTypes =
    new Set(
      items.map(
        (item) =>
          item.stayType
      )
    );


  if (
    stayTypes.size > 1
  ) {
    return {
      error:
        "All rooms in one reservation must use the same stay type.",
    };
  }

  /*
   * Same room cannot be supplied twice for
   * overlapping dates in one request.
   */
  for (
    let i = 0;
    i < items.length;
    i += 1
  ) {
    for (
      let j = i + 1;
      j < items.length;
      j += 1
    ) {
      if (
        items[i].roomId ===
          items[j].roomId &&
        rangesOverlap(
          items[i],
          items[j]
        )
      ) {
        return {
          error:
            "The same room cannot be booked for overlapping dates in one request.",
        };
      }
    }
  }


  return {
    error: "",
    value: items,
  };
}


/* ============================================================
   INITIAL PAYMENT VALIDATION
============================================================ */

function validateInitialPayment(
  body
) {
  const raw =
    body?.initial_payment;


  if (
    !raw ||
    typeof raw !== "object"
  ) {
    return {
      error: "",
      value: null,
    };
  }


  const mode =
    normalizeEnum(
      raw.mode ||
      "none"
    );


  if (
    mode === "none"
  ) {
    return {
      error: "",
      value: null,
    };
  }


  if (
    ![
      "advance",
      "full",
    ].includes(mode)
  ) {
    return {
      error:
        "Initial payment mode must be none, advance, or full.",
    };
  }


  const method =
    normalizeEnum(
      raw.payment_method
    );


  if (
    !PAYMENT_METHODS.has(
      method
    )
  ) {
    return {
      error:
        "Select a valid payment method.",
    };
  }


  let amount =
    null;


  if (
    mode === "advance"
  ) {
    amount =
      parseMoney(
        raw.amount
      );


    if (
      amount === null ||
      amount <= 0
    ) {
      return {
        error:
          "Advance payment amount must be greater than zero.",
      };
    }
  }


  const transactionId =
    normalizeOptionalText(
      raw.transaction_id,
      255
    );


  if (
    raw.transaction_id &&
    !transactionId
  ) {
    return {
      error:
        "Transaction ID is too long.",
    };
  }


  if (
    method !== "cash" &&
    !transactionId
  ) {
    return {
      error:
        "Transaction ID is required for UPI, Card or Bank Transfer payments.",
    };
  }


  const notes =
    normalizeOptionalText(
      raw.notes,
      450
    );


  if (
    raw.notes &&
    !notes
  ) {
    return {
      error:
        "Payment notes are too long.",
    };
  }


  return {
    error: "",

    value: {
      mode,
      amount,
      method,
      stage:
        "advance",
      transactionId,
      notes,
    },
  };
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  RESERVATION_EDIT_STATUSES,

  parsePositiveInteger,

  normalizeBookingSource,
  normalizeStayType,

  normalizeIndianPhone,
  getPhoneCandidates,

  calculateNights,
  calculateStayMinutes,

  validateCustomer,
  validateBookingItems,
  validateInitialPayment,
};