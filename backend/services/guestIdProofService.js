/* ============================================================
   GUEST ID PROOF SERVICE

   Central authority for:
   - supported guest ID proof types
   - canonical ID type names
   - hotel allowed-ID-type validation
   - guest ID number format validation

   Important:
   - Hotel policy decides which supported types are allowed.
   - Booking-time policy snapshot preserves that decision.
   - Legacy booking snapshots use the fixed HMS default list.
   - Current hotel settings must never be substituted into
     an old booking snapshot.
============================================================ */


/* ============================================================
   SUPPORTED TYPES
============================================================ */

const SUPPORTED_GUEST_ID_PROOF_TYPES =
  Object.freeze([
    "Aadhaar",
    "Passport",
    "Driving Licence",
    "Voter ID",
    "Other",
  ]);


/*
 * Fixed HMS compatibility default.
 *
 * This is intentionally code-defined and immutable.
 * Old booking snapshots that predate allowed_id_proof_types
 * may use this list.
 *
 * Never replace this fallback with today's hotel settings.
 */
const DEFAULT_ALLOWED_GUEST_ID_PROOF_TYPES =
  Object.freeze([
    ...SUPPORTED_GUEST_ID_PROOF_TYPES,
  ]);


/* ============================================================
   TYPE ALIASES

   Guest payloads may use a harmless spelling variation,
   but stored values are always canonical.
============================================================ */

const GUEST_ID_PROOF_TYPE_ALIASES =
  new Map([
    [
      "aadhaar",
      "Aadhaar",
    ],
    [
      "aadhar",
      "Aadhaar",
    ],

    [
      "passport",
      "Passport",
    ],

    [
      "driving licence",
      "Driving Licence",
    ],
    [
      "driving license",
      "Driving Licence",
    ],
    [
      "dl",
      "Driving Licence",
    ],

    [
      "voter id",
      "Voter ID",
    ],
    [
      "voterid",
      "Voter ID",
    ],
    [
      "epic",
      "Voter ID",
    ],

    [
      "other",
      "Other",
    ],
  ]);


/* ============================================================
   ERROR
============================================================ */

function idProofError(
  status,
  code,
  message
) {
  const error =
    new Error(
      message
    );

  error.status =
    status;

  error.code =
    code;

  return error;
}


/* ============================================================
   TEXT
============================================================ */

function optionalText(
  value,
  maxLength,
  label
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(
      value
    ).trim();

  if (!text) {
    return null;
  }

  if (
    text.length >
    maxLength
  ) {
    throw idProofError(
      400,
      "INVALID_GUEST_ID_PROOF",
      `${label} is too long.`
    );
  }

  return text;
}


/* ============================================================
   NORMALIZE TYPE
============================================================ */

function normalizeGuestIdProofType(
  value,
  label =
    "Guest ID proof type"
) {
  const rawType =
    optionalText(
      value,
      100,
      label
    );

  if (!rawType) {
    return null;
  }

  const key =
    rawType
      .toLowerCase()
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  const canonicalType =
    GUEST_ID_PROOF_TYPE_ALIASES
      .get(
        key
      );

  if (!canonicalType) {
    throw idProofError(
      400,
      "UNSUPPORTED_GUEST_ID_PROOF_TYPE",
      `${label} is not supported.`
    );
  }

  return canonicalType;
}


/* ============================================================
   HOTEL ALLOWED TYPES

   Settings must use canonical values only.
============================================================ */

function validateAllowedGuestIdProofTypes(
  value
) {
  if (
    !Array.isArray(
      value
    ) ||
    value.length === 0
  ) {
    throw idProofError(
      400,
      "INVALID_ALLOWED_GUEST_ID_PROOF_TYPES",
      "At least one guest ID proof type must be allowed."
    );
  }

  const allowedTypes = [];
  const seen =
    new Set();

  for (
    const rawType of
    value
  ) {
    const type =
      optionalText(
        rawType,
        100,
        "Allowed guest ID proof type"
      );

    if (
      !type ||
      !SUPPORTED_GUEST_ID_PROOF_TYPES
        .includes(
          type
        )
    ) {
      throw idProofError(
        400,
        "INVALID_ALLOWED_GUEST_ID_PROOF_TYPES",
        `Unsupported guest ID proof type: ${
          type || "empty value"
        }.`
      );
    }

    if (
      seen.has(
        type
      )
    ) {
      throw idProofError(
        400,
        "DUPLICATE_GUEST_ID_PROOF_TYPE",
        `${type} was included more than once in the allowed guest ID proof types.`
      );
    }

    seen.add(
      type
    );

    allowedTypes.push(
      type
    );
  }

  return allowedTypes;
}


/* ============================================================
   RESOLVE BOOKING POLICY TYPES

   Missing value means legacy booking snapshot.
============================================================ */

function resolveAllowedGuestIdProofTypes(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return [
      ...DEFAULT_ALLOWED_GUEST_ID_PROOF_TYPES,
    ];
  }

  return validateAllowedGuestIdProofTypes(
    value
  );
}


/* ============================================================
   NUMBER VALIDATORS
============================================================ */

function normalizeAadhaarNumber(
  value,
  label
) {
  /*
   * Display input may contain spaces or hyphens:
   *
   * 1234 5678 9012
   * 1234-5678-9012
   *
   * Stored snapshot becomes:
   * 123456789012
   *
   * This validates format only.
   * It does NOT claim Aadhaar authenticity.
   */
  if (
    !/^[0-9\s-]+$/.test(
      value
    )
  ) {
    throw idProofError(
      400,
      "INVALID_GUEST_ID_PROOF_NUMBER",
      `${label} Aadhaar number must contain only digits, spaces or hyphens.`
    );
  }

  const normalized =
    value.replace(
      /[\s-]/g,
      ""
    );

  if (
    !/^\d{12}$/.test(
      normalized
    )
  ) {
    throw idProofError(
      400,
      "INVALID_GUEST_ID_PROOF_NUMBER",
      `${label} Aadhaar number must contain exactly 12 digits.`
    );
  }

  return normalized;
}


function normalizePassportNumber(
  value,
  label
) {
  const normalized =
    value
      .replace(
        /\s+/g,
        ""
      )
      .toUpperCase();

  if (
    !/^[A-Z0-9]{5,20}$/.test(
      normalized
    )
  ) {
    throw idProofError(
      400,
      "INVALID_GUEST_ID_PROOF_NUMBER",
      `${label} Passport number must contain 5 to 20 letters or digits.`
    );
  }

  return normalized;
}


function normalizeDrivingLicenceNumber(
  value,
  label
) {
  const normalized =
    value
      .toUpperCase()
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (
    !/^[A-Z0-9 /-]{5,30}$/.test(
      normalized
    )
  ) {
    throw idProofError(
      400,
      "INVALID_GUEST_ID_PROOF_NUMBER",
      `${label} Driving Licence number is invalid.`
    );
  }

  return normalized;
}


function normalizeVoterIdNumber(
  value,
  label
) {
  const normalized =
    value
      .replace(
        /\s+/g,
        ""
      )
      .toUpperCase();

  if (
    !/^[A-Z0-9]{8,20}$/.test(
      normalized
    )
  ) {
    throw idProofError(
      400,
      "INVALID_GUEST_ID_PROOF_NUMBER",
      `${label} Voter ID number must contain 8 to 20 letters or digits.`
    );
  }

  return normalized;
}


function normalizeOtherIdNumber(
  value,
  label
) {
  if (
    value.length < 4 ||
    value.length > 50
  ) {
    throw idProofError(
      400,
      "INVALID_GUEST_ID_PROOF_NUMBER",
      `${label} ID proof number must contain 4 to 50 characters.`
    );
  }

  /*
   * Do not store control characters in an ID snapshot.
   */
  if (
    /[\u0000-\u001F\u007F]/.test(
      value
    )
  ) {
    throw idProofError(
      400,
      "INVALID_GUEST_ID_PROOF_NUMBER",
      `${label} ID proof number contains invalid characters.`
    );
  }

  return value;
}


/* ============================================================
   VALIDATE GUEST ID PROOF
============================================================ */

function validateGuestIdProof({
  type,
  number,

  label =
    "Guest",

  allowedTypes =
    undefined,
}) {
  const proofTypeText =
    optionalText(
      type,
      100,
      `${label} ID proof type`
    );

  const proofNumberText =
    optionalText(
      number,
      100,
      `${label} ID proof number`
    );


  /*
   * Type and number are one logical value.
   */
  if (
    Boolean(
      proofTypeText
    ) !==
    Boolean(
      proofNumberText
    )
  ) {
    throw idProofError(
      400,
      "INVALID_GUEST_ID_PROOF",
      `${label} ID proof type and ID proof number must be entered together.`
    );
  }


  /*
   * ID can still be optional according to the booking policy.
   * Required/not-required decision remains in bookingGuestService.
   */
  if (!proofTypeText) {
    return {
      idProofType:
        null,

      idProofNumber:
        null,
    };
  }


  const canonicalType =
    normalizeGuestIdProofType(
      proofTypeText,
      `${label} ID proof type`
    );


  const resolvedAllowedTypes =
    resolveAllowedGuestIdProofTypes(
      allowedTypes
    );


  /*
   * Backend authority:
   *
   * Even if someone tampers with the frontend request,
   * the selected ID type must belong to this booking's
   * immutable allowed-type policy.
   */
  if (
    !resolvedAllowedTypes
      .includes(
        canonicalType
      )
  ) {
    throw idProofError(
      400,
      "GUEST_ID_PROOF_TYPE_NOT_ALLOWED",
      `${canonicalType} is not allowed by this booking's guest ID policy.`
    );
  }


  let normalizedNumber =
    proofNumberText;


  switch (
    canonicalType
  ) {
    case "Aadhaar":
      normalizedNumber =
        normalizeAadhaarNumber(
          proofNumberText,
          label
        );

      break;


    case "Passport":
      normalizedNumber =
        normalizePassportNumber(
          proofNumberText,
          label
        );

      break;


    case "Driving Licence":
      normalizedNumber =
        normalizeDrivingLicenceNumber(
          proofNumberText,
          label
        );

      break;


    case "Voter ID":
      normalizedNumber =
        normalizeVoterIdNumber(
          proofNumberText,
          label
        );

      break;


    case "Other":
      normalizedNumber =
        normalizeOtherIdNumber(
          proofNumberText,
          label
        );

      break;


    default:
      /*
       * Defensive only.
       * normalizeGuestIdProofType already blocks this.
       */
      throw idProofError(
        400,
        "UNSUPPORTED_GUEST_ID_PROOF_TYPE",
        `${label} ID proof type is not supported.`
      );
  }


  return {
    idProofType:
      canonicalType,

    idProofNumber:
      normalizedNumber,
  };
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  SUPPORTED_GUEST_ID_PROOF_TYPES,

  DEFAULT_ALLOWED_GUEST_ID_PROOF_TYPES,

  normalizeGuestIdProofType,

  validateAllowedGuestIdProofTypes,

  resolveAllowedGuestIdProofTypes,

  validateGuestIdProof,
};