const {
  getHotelSettings,
  updateHotelSettings,
  getHotelSettingAuditLogs,
  restoreHotelSetting,
  resetHotelSetting,
} = require("../services/hotelSettingsService");

const {
  CHARGE_METHODS,
  PRICE_METHODS,
  EFFECTIVE_FROM_OPTIONS,
  REFUND_HANDLING_OPTIONS,
  VIP_BILLING_MODES,
} = require("../services/hotelSettingsDefaults");


/* ============================================================
   HOTEL SETTINGS CONTROLLER

   ADMIN
   ------------------------------------------------------------
   - Never chooses hotel manually
   - Hotel comes only from req.dbUser.hotelId

   SUPER ADMIN
   ------------------------------------------------------------
   - May select one of own hotels
   - hotelId comes from route parameter
   - ownership is verified again inside service

   SECURITY
   ------------------------------------------------------------
   Controller never trusts body.hotelId for Admin.
============================================================ */


/* ============================================================
   RESPONSE HELPERS
============================================================ */

function sendSuccess(
  res,
  status,
  message,
  data = null
) {
  return res
    .status(status)
    .json({
      success: true,
      message,
      data,
    });
}


function sendError(
  res,
  error
) {
  const status =
    Number(
      error?.status
    ) || 500;


  const code =
    error?.code ||
    "SETTINGS_ERROR";


  const message =
    status >= 500
      ? (
          error?.message ||
          "Something went wrong while processing hotel settings."
        )
      : (
          error?.message ||
          "Unable to process hotel settings."
        );


  if (
    status >= 500
  ) {
    console.error(
      "[HOTEL SETTINGS ERROR]",
      error
    );
  }


  return res
    .status(status)
    .json({
      success: false,
      code,
      message,
    });
}


/* ============================================================
   POSITIVE ID
============================================================ */

function positiveId(
  value
) {
  const id =
    Number(value);


  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return null;
  }


  return id;
}


/* ============================================================
   RESOLVE HOTEL

   ADMIN:
   Trusted hotel from authenticated DB user.

   SUPER ADMIN:
   Selected hotel from route parameter.

   Never use body.hotelId for Admin.
============================================================ */

function resolveHotelId(
  req
) {
  const role =
    req.dbUser?.role;


  /* ----------------------------------------------------------
     ADMIN
  ---------------------------------------------------------- */

  if (
    role ===
    "admin"
  ) {
    const hotelId =
      positiveId(
        req.dbUser?.hotelId
      );


    if (!hotelId) {
      const error =
        new Error(
          "The Admin account is not assigned to a valid hotel."
        );


      error.status = 403;
      error.code =
        "ADMIN_HOTEL_CONTEXT_MISSING";


      throw error;
    }


    return hotelId;
  }


  /* ----------------------------------------------------------
     SUPER ADMIN
  ---------------------------------------------------------- */

  if (
    role ===
    "super_admin"
  ) {
    const hotelId =
      positiveId(
        req.params?.hotelId
      );


    if (!hotelId) {
      const error =
        new Error(
          "Please select a valid hotel."
        );


      error.status = 400;
      error.code =
        "HOTEL_ID_REQUIRED";


      throw error;
    }


    return hotelId;
  }


  const error =
    new Error(
      "This account cannot access hotel settings."
    );


  error.status = 403;
  error.code =
    "SETTINGS_ACCESS_DENIED";


  throw error;
}


/* ============================================================
   REQUEST AUDIT META

   Saved with settings audit entry.

   Example:
   - request id
   - IP
   - browser/device
============================================================ */

function buildRequestMeta(
  req
) {
  let requestId =
    req.headers?.[
      "x-request-id"
    ] ||
    req.requestId ||
    null;


  if (
    Array.isArray(
      requestId
    )
  ) {
    requestId =
      requestId[0] ||
      null;
  }


  return {
    requestId,

    ipAddress:
      req.ip ||
      req.socket
        ?.remoteAddress ||
      null,

    userAgent:
      req.headers?.[
        "user-agent"
      ] ||
      null,
  };
}


/* ============================================================
   GET SETTINGS

   Admin:
   GET /api/hotel-settings

   Super Admin:
   GET /api/hotel-settings/hotel/:hotelId
============================================================ */

async function getSettings(
  req,
  res
) {
  try {
    const hotelId =
      resolveHotelId(
        req
      );


    const result =
      await getHotelSettings(
        hotelId,
        req.dbUser
      );


    return sendSuccess(
      res,
      200,
      "Hotel settings loaded successfully.",
      result
    );
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
}


/* ============================================================
   UPDATE SETTINGS

   BODY EXAMPLE:

   {
     "changes": [
       {
         "section": "cancellation",
         "key": "calculation_mode",
         "value": "rules"
       },
       {
         "section": "cancellation",
         "key": "rules",
         "value": [...]
       }
     ],

     "changeReason":
       "Updated cancellation policy."
   }

   Important:
   - All changes run inside one transaction.
   - Audit created automatically.
   - Policy version created automatically.
============================================================ */

async function updateSettings(
  req,
  res
) {
  try {
    const hotelId =
      resolveHotelId(
        req
      );


    const changes =
      req.body?.changes;


    const changeReason =
      req.body?.changeReason;


    const result =
      await updateHotelSettings({
        hotelId,

        dbUser:
          req.dbUser,

        changes,

        changeReason,

        requestMeta:
          buildRequestMeta(
            req
          ),
      });


    return sendSuccess(
      res,
      200,
      result.changedCount > 0
        ? "Hotel settings updated successfully."
        : "No settings were changed.",
      result
    );
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
}


/* ============================================================
   AUDIT HISTORY

   Query options:

   ?section=cancellation
   ?actorType=admin
   ?actorId=2
   ?fromDate=2026-08-01
   ?toDate=2026-08-31
   ?page=1
   ?pageSize=50
============================================================ */

async function getAuditHistory(
  req,
  res
) {
  try {
    const hotelId =
      resolveHotelId(
        req
      );


    const result =
      await getHotelSettingAuditLogs({
        hotelId,

        dbUser:
          req.dbUser,

        section:
          req.query?.section ||
          null,

        actorType:
          req.query?.actorType ||
          null,

        actorId:
          req.query?.actorId ||
          null,

        fromDate:
          req.query?.fromDate ||
          null,

        toDate:
          req.query?.toDate ||
          null,

        page:
          req.query?.page ||
          1,

        pageSize:
          req.query?.pageSize ||
          50,
      });


    return sendSuccess(
      res,
      200,
      "Settings activity history loaded successfully.",
      result
    );
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
}


/* ============================================================
   RESTORE SETTING

   BODY:

   {
     "auditId": 12,
     "changeReason":
       "Restoring previous cancellation policy."
   }

   Restore does NOT delete history.

   Example:
   48 hours → 24 hours
   Restore
   24 hours → 48 hours

   Both events stay in audit.
============================================================ */

async function restoreSetting(
  req,
  res
) {
  try {
    const hotelId =
      resolveHotelId(
        req
      );


    const result =
      await restoreHotelSetting({
        hotelId,

        dbUser:
          req.dbUser,

        auditId:
          req.body?.auditId,

        changeReason:
          req.body?.changeReason,

        requestMeta:
          buildRequestMeta(
            req
          ),
      });


    return sendSuccess(
      res,
      200,
      result.changed
        ? "Previous setting value restored successfully."
        : "The setting already has this value.",
      result
    );
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
}


/* ============================================================
   RESET ONE SETTING TO HMS DEFAULT

   BODY:

   {
     "section": "early_checkout",
     "key": "calculation_mode",
     "changeReason":
       "Resetting this policy to default."
   }
============================================================ */

async function resetSetting(
  req,
  res
) {
  try {
    const hotelId =
      resolveHotelId(
        req
      );


    const result =
      await resetHotelSetting({
        hotelId,

        dbUser:
          req.dbUser,

        section:
          req.body?.section,

        key:
          req.body?.key,

        changeReason:
          req.body?.changeReason,

        requestMeta:
          buildRequestMeta(
            req
          ),
      });


    return sendSuccess(
      res,
      200,
      result.changed
        ? "Hotel setting reset successfully."
        : "The setting is already using the default value.",
      result
    );
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
}


/* ============================================================
   POLICY CAPABILITIES

   Frontend must NOT hard-code policy engine options.

   Settings UI obtains available capabilities from backend.
============================================================ */

async function getCapabilities(
  req,
  res
) {
  try {
    /* --------------------------------------------------------
       Authentication / role is still required.

       For Admin we also make sure valid hotel context exists.
       For Super Admin route contains selected hotel.

       This keeps capability endpoint consistent with Settings
       security even though capabilities themselves are global.
    -------------------------------------------------------- */

    resolveHotelId(
      req
    );


    return sendSuccess(
      res,
      200,
      "Hotel policy capabilities loaded successfully.",
      {
        chargeMethods:
          CHARGE_METHODS,

        priceMethods:
          PRICE_METHODS,

        effectiveFromOptions:
          EFFECTIVE_FROM_OPTIONS,

        refundHandlingOptions:
          REFUND_HANDLING_OPTIONS,

        vipBillingModes:
          VIP_BILLING_MODES,
      }
    );
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  getSettings,
  updateSettings,
  getAuditHistory,
  restoreSetting,
  resetSetting,
  getCapabilities,
};