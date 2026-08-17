/* ============================================================
   BOOKING DESK UTILITIES

   Pure helper functions only.
   No React state.
   No API calls.
   No DOM logic.
============================================================ */


/* ============================================================
   PHONE
============================================================ */

export function digitsOnly(value) {
  return String(
    value || ""
  ).replace(
    /\D/g,
    ""
  );
}


export function normalizeStoredPhone(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /[\s()\-]/g,
      ""
    );
}


export function buildPhoneNumber(
  localNumber
) {
  const local =
    digitsOnly(
      localNumber
    );


  if (
    !/^[6-9]\d{9}$/.test(
      local
    )
  ) {
    return null;
  }


  return `+91${local}`;
}


export function splitStoredPhone(
  value
) {
  const phone =
    normalizeStoredPhone(
      value
    );


  if (
    /^\+91[6-9]\d{9}$/.test(
      phone
    )
  ) {
    return phone.slice(3);
  }


  if (
    /^[6-9]\d{9}$/.test(
      phone
    )
  ) {
    return phone;
  }


  const digits =
    digitsOnly(
      phone
    );


  if (
    digits.length >= 10
  ) {
    return digits.slice(-10);
  }


  return digits;
}


/* ============================================================
   MONEY
============================================================ */

export function formatCurrency(
  value
) {
  const amount =
    Number(value);


  if (
    !Number.isFinite(
      amount
    )
  ) {
    return "₹0.00";
  }


  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(amount);
}


/* ============================================================
   DATE
============================================================ */

export function formatDate(value) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


export function calculateNights(
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
      `${checkIn}T00:00:00`
    );


  const end =
    new Date(
      `${checkOut}T00:00:00`
    );


  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return 0;
  }


  const difference =
    end.getTime() -
    start.getTime();


  if (
    difference <= 0
  ) {
    return 0;
  }


  return Math.ceil(
    difference /
      (
        1000 *
        60 *
        60 *
        24
      )
  );
}


export function getTodayValue() {
  const today =
    new Date();


  const year =
    today.getFullYear();


  const month =
    String(
      today.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      today.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;
}


/* ============================================================
   API ERROR
============================================================ */

export function getApiMessage(
  error,
  fallback
) {
  return (
    error?.message ||
    fallback
  );
}


/* ============================================================
   ID DISPLAY
============================================================ */

export function maskIdNumber(value) {
  const text =
    String(
      value || ""
    ).trim();


  if (!text) {
    return "—";
  }


  if (
    text.length <= 4
  ) {
    return text;
  }


  return (
    `${"•".repeat(
      Math.min(
        8,
        text.length - 4
      )
    )}${text.slice(-4)}`
  );
}


/* ============================================================
   PAYMENT DISPLAY
============================================================ */

export function getPaymentDisplayStatus(
  paidAmount,
  totalAmount
) {
  const paid =
    Number(
      paidAmount || 0
    );


  const total =
    Number(
      totalAmount || 0
    );


  if (
    paid <= 0
  ) {
    return "Unpaid";
  }


  if (
    paid < total
  ) {
    return "Partial";
  }


  return "Paid";
}