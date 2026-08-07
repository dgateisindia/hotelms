import apiClient from "./apiClient";

const HOTEL_DISPLAY_ID_PATTERN =
  /^HT-\d+$/i;

/* ============================================================
   RESPONSE HELPERS
============================================================ */

function getResponseData(response) {
  return response?.data ?? response;
}

/* ============================================================
   HOTEL ID HELPERS
============================================================ */

function normalizeHotelDisplayId(
  hotelDisplayId
) {
  const normalizedValue =
    String(hotelDisplayId || "")
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
   PAYLOAD HELPERS
============================================================ */

function cleanRequiredString(
  value
) {
  return String(value || "").trim();
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

  const cleanedValue =
    String(value).trim();

  return cleanedValue || null;
}

function cleanOptionalNumber(
  value
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const parsedValue =
    Number(value);

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : value;
}

function prepareHotelPayload(
  hotelDetails
) {
  const source =
    hotelDetails &&
    typeof hotelDetails === "object"
      ? hotelDetails
      : {};

  const hotelName =
    cleanRequiredString(
      source.hotelName
    );

  if (!hotelName) {
    throw new Error(
      "Hotel name is required."
    );
  }

  return {
    hotelName,

    hotelType:
      cleanOptionalString(
        source.hotelType
      ),

    hotelDescription:
      cleanOptionalString(
        source.hotelDescription
      ),

    starRating:
      cleanOptionalNumber(
        source.starRating
      ),

    yearEstablished:
      cleanOptionalNumber(
        source.yearEstablished
      ),

    gstNumber:
      cleanOptionalString(
        source.gstNumber
      ),

    panNumber:
      cleanOptionalString(
        source.panNumber
      ),

    businessRegistrationNumber:
      cleanOptionalString(
        source.businessRegistrationNumber
      ),

    hotelLogo:
      cleanOptionalString(
        source.hotelLogo
      ),
  };
}

/* ============================================================
   HOTEL API SERVICE
============================================================ */

/**
 * Returns all hotels owned by the authenticated
 * Super Admin.
 *
 * GET /api/superadmin/hotels
 */
async function getHotels() {
  const response =
    await apiClient.get(
      "/superadmin/hotels"
    );

  const data =
    getResponseData(response);

  return {
    success:
      data?.success === true,

    summary: {
      totalHotels: Number(
        data?.summary
          ?.totalHotels || 0
      ),

      activeHotels: Number(
        data?.summary
          ?.activeHotels || 0
      ),

      pendingHotels: Number(
        data?.summary
          ?.pendingHotels || 0
      ),

      rejectedHotels: Number(
        data?.summary
          ?.rejectedHotels || 0
      ),
    },

    hotels: Array.isArray(
      data?.hotels
    )
      ? data.hotels
      : [],
  };
}

/**
 * Returns one hotel after backend ownership
 * verification.
 *
 * GET /api/superadmin/hotels/HT-0001
 */
async function getHotelByDisplayId(
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
      )}`
    );

  const data =
    getResponseData(response);

  return {
    success:
      data?.success === true,

    hotel:
      data?.hotel || null,
  };
}

/**
 * Creates:
 * - Hotel record
 * - Hotel-level QR record
 *
 * Backend performs both operations inside one
 * transaction.
 *
 * POST /api/superadmin/hotels
 */
async function createHotel(
  hotelDetails
) {
  const payload =
    prepareHotelPayload(
      hotelDetails
    );

  const response =
    await apiClient.post(
      "/superadmin/hotels",
      payload
    );

  const data =
    getResponseData(response);

  return {
    success:
      data?.success === true,

    message:
      data?.message ||
      "Hotel created successfully.",

    hotel:
      data?.hotel || null,
  };
}

const hotelService = {
  getHotels,
  getHotelByDisplayId,
  createHotel,
};

export default hotelService;