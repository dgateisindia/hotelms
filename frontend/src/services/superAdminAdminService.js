import apiClient from "../shared/api/apiClient";


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

/* ============================================================
   SUPER ADMIN-SA3A
   PORTFOLIO HOTEL ADMIN LIST
   GET /api/superadmin/admins
============================================================ */

async function getPortfolioAdmins() {
  const response = await apiClient.get("/superadmin/admins");

  const data = getResponseData(response);

  return {
    success: data?.success === true,
    admins: Array.isArray(data?.admins) ? data.admins : [],
  };
}

/* SUPER ADMIN-SA3B-2-R1 */

function sa3bNormalizeAdminId(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (!/^ADM-\d+$/.test(normalized)) {
    throw new Error("Invalid Hotel Admin ID.");
  }

  return normalized;
}

async function updateHotelAdminProfile(hotelDisplayId, adminDisplayId, details) {
  const hotel = normalizeHotelDisplayId(hotelDisplayId);
  const admin = sa3bNormalizeAdminId(adminDisplayId);

  const fullName = String(details?.fullName || "").trim();
  const phone = String(details?.phone || "").trim();

  if (!fullName || fullName.length > 150) {
    throw new Error("Full Name must contain 1 to 150 characters.");
  }

  if (phone.length > 30) {
    throw new Error("Phone number must not exceed 30 characters.");
  }

  const response = await apiClient.patch(
    `/superadmin/hotels/${encodeURIComponent(hotel)}/admins/${encodeURIComponent(admin)}`,
    { fullName, phone: phone || null }
  );

  return getResponseData(response);
}

async function updateHotelAdminStatus(hotelDisplayId, adminDisplayId, status) {
  const hotel = normalizeHotelDisplayId(hotelDisplayId);
  const admin = sa3bNormalizeAdminId(adminDisplayId);

  if (!["active", "inactive"].includes(status)) {
    throw new Error("Invalid Admin status.");
  }

  const response = await apiClient.patch(
    `/superadmin/hotels/${encodeURIComponent(hotel)}/admins/${encodeURIComponent(admin)}/status`,
    { status }
  );

  return getResponseData(response);
}

const superAdminAdminService = {
  getPortfolioAdmins,
  getHotelAdmins,
  createHotelAdmin,
  updateHotelAdminProfile,
  updateHotelAdminStatus,
};


export default superAdminAdminService;