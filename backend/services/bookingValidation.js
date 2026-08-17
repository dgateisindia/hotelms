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


  return Math.max(
    1,
    Math.ceil(
      (
        end -
        start
      ) /
      DAY_MS
    )
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


    const totalGuests =
      raw.total_guests ===
        undefined ||
      raw.total_guests ===
        null ||
      String(
        raw.total_guests
      ).trim() === ""
        ? 1
        : parsePositiveInteger(
            raw.total_guests
          );


    if (!totalGuests) {
      return {
        error:
          `${label}: total guests must be at least 1.`,
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
      checkIn,
      checkOut,
      totalGuests,
      bookingStatus,
      specialRequest,
    });
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

  normalizeIndianPhone,
  getPhoneCandidates,

  calculateNights,

  validateCustomer,
  validateBookingItems,
  validateInitialPayment,
};