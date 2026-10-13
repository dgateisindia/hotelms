"use strict";

const {
  buildCurrentPolicySnapshotWithConnection,
} = require(
  "../hotelSettingsService"
);

const {
  getDefaultSetting,
} = require(
  "../hotelSettingsDefaults"
);


/* ============================================================
   ERROR / VALIDATION
============================================================ */

function positiveId(
  value
) {
  const parsed =
    Number(
      value
    );

  return (
    Number.isInteger(
      parsed
    ) &&
    parsed > 0
  )
    ? parsed
    : null;
}


function requirePositiveId(
  value,
  fieldName
) {
  const parsed =
    positiveId(
      value
    );

  if (!parsed) {
    const error =
      new Error(
        `${fieldName} must be a positive integer.`
      );

    error.status =
      400;

    error.statusCode =
      400;

    error.code =
      "INVALID_HOUSEKEEPING_POLICY_CONTEXT";

    throw error;
  }

  return parsed;
}


function ensureConnection(
  connection
) {
  if (
    !connection ||
    typeof connection.query !==
      "function"
  ) {
    throw new TypeError(
      "A database connection is required for housekeeping policy resolution."
    );
  }
}


/* ============================================================
   DEFAULTS
============================================================ */

function defaultValue(
  key
) {
  return (
    getDefaultSetting(
      "housekeeping",
      key
    )?.value
  );
}


function normalizeBoolean(
  value,
  fallback
) {
  if (
    typeof value ===
      "boolean"
  ) {
    return value;
  }

  if (
    value === 1 ||
    value === "1" ||
    String(value)
      .trim()
      .toLowerCase() ===
        "true"
  ) {
    return true;
  }

  if (
    value === 0 ||
    value === "0" ||
    String(value)
      .trim()
      .toLowerCase() ===
        "false"
  ) {
    return false;
  }

  return Boolean(
    fallback
  );
}


function normalizeString(
  value,
  fallback
) {
  const normalized =
    String(
      value ??
      ""
    )
      .trim()
      .toLowerCase();

  return (
    normalized ||
    String(
      fallback ??
      ""
    )
      .trim()
      .toLowerCase()
  );
}


/* ============================================================
   CHECKOUT HOUSEKEEPING POLICY

   Canonical operational rule:

   cleaning_required_after_checkout = true
     → canonical cleaning task
     → room status cleaning
     → housekeeping completion releases room

   cleaning_required_after_checkout = false
     → no cleaning task
     → room status available

   Legacy compatibility settings are retained in DB but they do
   not independently control the room lifecycle:
   - checkout_room_status
   - auto_available_after_checkout
============================================================ */

async function resolveCheckoutHousekeepingPolicyWithConnection(
  connection,
  {
    hotelId,
  }
) {
  ensureConnection(
    connection
  );

  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  /*
   * Use the existing transaction-aware Settings service.
   * Do not open another database connection here.
   */
  const current =
    await buildCurrentPolicySnapshotWithConnection(
      connection,
      hId
    );

  const housekeeping =
    current
      ?.policySnapshot
      ?.housekeeping ||
    {};


  const defaultCleaningRequired =
    normalizeBoolean(
      defaultValue(
        "cleaning_required_after_checkout"
      ),
      true
    );


  const cleaningRequired =
    normalizeBoolean(
      housekeeping
        .cleaning_required_after_checkout,
      defaultCleaningRequired
    );


  /*
   * Legacy values are returned for diagnostics and backwards
   * compatibility only.
   */
  const legacyCheckoutRoomStatus =
    normalizeString(
      housekeeping
        .checkout_room_status,
      defaultValue(
        "checkout_room_status"
      ) ||
      "cleaning"
    );


  const legacyAutoAvailable =
    normalizeBoolean(
      housekeeping
        .auto_available_after_checkout,
      defaultValue(
        "auto_available_after_checkout"
      ) ??
      false
    );


  /*
   * One master setting produces one unambiguous lifecycle.
   */
  const canonical = {
    cleaningRequiredAfterCheckout:
      cleaningRequired,

    createHousekeepingTask:
      cleaningRequired,

    roomStatusAfterCheckout:
      cleaningRequired
        ? "cleaning"
        : "available",

    releaseRequiresHousekeepingCompletion:
      cleaningRequired,
  };


  /*
   * Detect old contradictory configuration without allowing it
   * to corrupt the canonical lifecycle.
   *
   * Current production defaults should produce zero warnings.
   */
  const compatibilityWarnings =
    [];


  if (
    cleaningRequired &&
    legacyCheckoutRoomStatus !==
      "cleaning"
  ) {
    compatibilityWarnings.push(
      "LEGACY_CHECKOUT_ROOM_STATUS_IGNORED"
    );
  }


  if (
    cleaningRequired &&
    legacyAutoAvailable
  ) {
    compatibilityWarnings.push(
      "LEGACY_AUTO_AVAILABLE_IGNORED"
    );
  }


  if (
    !cleaningRequired &&
    (
      legacyCheckoutRoomStatus !==
        "available" ||
      !legacyAutoAvailable
    )
  ) {
    compatibilityWarnings.push(
      "LEGACY_NO_CLEANING_SETTINGS_NORMALIZED"
    );
  }


  return {
    ...canonical,

    source:
      "current_hotel_settings",

    policyVersion:
      current
        ?.policyVersions
        ?.housekeeping ||
      null,

    compatibility: {
      checkoutRoomStatus:
        legacyCheckoutRoomStatus,

      autoAvailableAfterCheckout:
        legacyAutoAvailable,

      warnings:
        compatibilityWarnings,
    },
  };
}


module.exports = {
  resolveCheckoutHousekeepingPolicyWithConnection,
};
