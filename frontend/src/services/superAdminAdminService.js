import apiClient from "./apiClient";


const HOTEL_DISPLAY_ID_PATTERN =
  /^HT-\d+$/i;


/* ============================================================
   RESPONSE HELPER
============================================================ */

function getResponseData(
  response
) {
  return response?.data ?? response;
}


/* ============================================================
   HOTEL DISPLAY ID
============================================================ */

function normalizeHotelDisplayId(
  hotelDisplayId
) {
  const normalizedValue =
    String(
      hotelDisplayId || ""
    )
      .trim()
      .toUpperCase();


  if (
    !HOTEL_DISPLAY_ID_PATTERN.test(
      normalizedValue
    )
  ) {
    throw new Error(
      "The hotel ID is invalid. Use a value such as HT-0001."
    );
  }


  return normalizedValue;
}


/* ============================================================
   STRING HELPERS
============================================================ */

function cleanRequiredString(
  value
) {
  return String(
    value || ""
  ).trim();
}


function cleanOptionalString(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }


  const cleaned =
    String(value).trim();


  return cleaned || null;
}


/* ============================================================
   PREPARE ADMIN PAYLOAD
============================================================ */

function prepareAdminPayload(
  adminDetails
) {
  const source =
    adminDetails &&
    typeof adminDetails === "object"
      ? adminDetails
      : {};


  const fullName =
    cleanRequiredString(
      source.fullName
    );


  const email =
    cleanRequiredString(
      source.email
    ).toLowerCase();


  const phone =
    cleanOptionalString(
      source.phone
    );


  const temporaryPassword =
    String(
      source.temporaryPassword ||
      ""
    );


  if (!fullName) {
    throw new Error(
      "Admin full name is required."
    );
  }


  if (!email) {
    throw new Error(
      "Admin email address is required."
    );
  }


  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new Error(
      "Enter a valid Admin email address."
    );
  }


  if (
    temporaryPassword.length < 8
  ) {
    throw new Error(
      "Temporary password must contain at least 8 characters."
    );
  }


  return {
    fullName,
    email,
    phone,
    temporaryPassword,
  };
}


/* ============================================================
   GET SELECTED HOTEL ADMINS
============================================================ */

/**
 * GET
 * /api/superadmin/hotels/HT-0001/admins
 */
async function getHotelAdmins(
  hotelDisplayId
) {
  const normalizedHotelId =
    normalizeHotelDisplayId(
      hotelDisplayId
    );


  const response =
    await apiClient.get(
      `/superadmin/hotels/${encodeURIComponent(
        normalizedHotelId
      )}/admins`
    );


  const data =
    getResponseData(
      response
    );


  return {
    success:
      data?.success === true,

    hotel:
      data?.hotel || null,

    summary: {
      totalAdmins:
        Number(
          data?.summary
            ?.totalAdmins ||
            0
        ),

      activeAdmins:
        Number(
          data?.summary
            ?.activeAdmins ||
            0
        ),

      inactiveAdmins:
        Number(
          data?.summary
            ?.inactiveAdmins ||
            0
        ),
    },

    admins:
      Array.isArray(
        data?.admins
      )
        ? data.admins
        : [],
  };
}


/* ============================================================
   CREATE SELECTED HOTEL ADMIN
============================================================ */

/**
 * POST
 * /api/superadmin/hotels/HT-0001/admins
 *
 * Password is sent to backend only so Clerk can create
 * the authentication account.
 *
 * MySQL never stores this password.
 */
async function createHotelAdmin(
  hotelDisplayId,
  adminDetails
) {
  const normalizedHotelId =
    normalizeHotelDisplayId(
      hotelDisplayId
    );


  const payload =
    prepareAdminPayload(
      adminDetails
    );


  const response =
    await apiClient.post(
      `/superadmin/hotels/${encodeURIComponent(
        normalizedHotelId
      )}/admins`,
      payload
    );


  const data =
    getResponseData(
      response
    );


  return {
    success:
      data?.success === true,

    message:
      data?.message ||
      "Hotel Admin account created successfully.",

    admin:
      data?.admin || null,

    hotel:
      data?.hotel || null,
  };
}


/* ============================================================
   SERVICE
============================================================ */

const superAdminAdminService = {
  getHotelAdmins,
  createHotelAdmin,
};


export default superAdminAdminService;