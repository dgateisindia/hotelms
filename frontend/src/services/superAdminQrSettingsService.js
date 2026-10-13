import apiClient, {
  getApiErrorMessage,
} from "../shared/api/apiClient";

const HOTEL_PATTERN = /^HT-[0-9]{4,}$/;

function validHotelId(value) {
  const hotelId = String(value || "").trim().toUpperCase();

  if (!HOTEL_PATTERN.test(hotelId)) {
    throw new Error("Invalid selected hotel.");
  }

  return hotelId;
}

async function readEndpoint(hotelDisplayId, suffix) {
  const hotelId = validHotelId(hotelDisplayId);

  try {
    const response = await apiClient.get(
      `/superadmin/hotels/${encodeURIComponent(hotelId)}/${suffix}`
    );

    const data = response.data?.data;

    if (
      response.data?.success !== true ||
      !data ||
      data.hotel?.displayId !== hotelId
    ) {
      throw new Error("Selected hotel data is unavailable.");
    }

    return data;
  } catch (error) {
    if (error?.response) {
      throw new Error(getApiErrorMessage(error));
    }

    throw error;
  }
}

export function fetchSelectedHotelQr(hotelDisplayId) {
  return readEndpoint(hotelDisplayId, "qr/overview");
}

export function fetchSelectedHotelSettings(hotelDisplayId) {
  return readEndpoint(hotelDisplayId, "settings/snapshot");
}