import apiClient from "../shared/api/apiClient";

const HOTEL_ID_PATTERN = /^HT-[0-9]{4,}$/;

async function getOperationsOverview(hotelDisplayId) {
  const hotelId = String(hotelDisplayId || "")
    .trim()
    .toUpperCase();

  if (!HOTEL_ID_PATTERN.test(hotelId)) {
    throw new Error("Invalid hotel ID.");
  }

  const response = await apiClient.get(
    `/superadmin/hotels/${encodeURIComponent(hotelId)}/operations/overview`
  );

  const payload = response?.data;

  if (
    payload?.success !== true ||
    !payload?.data ||
    payload.data.hotel?.displayId !== hotelId
  ) {
    throw new Error("Invalid operations response.");
  }

  const data = payload.data;

  const summaryKeys = [
    "rooms",
    "bookings",
    "housekeeping",
    "maintenance",
    "customerRequests",
    "serviceRequests",
  ];

  const listKeys = [
    "recentBookings",
    "openHousekeeping",
    "openMaintenance",
  ];

  if (
    !summaryKeys.every(
      (key) =>
        data[key] &&
        Number.isFinite(Number(data[key].total))
    ) ||
    !listKeys.every((key) => Array.isArray(data[key]))
  ) {
    throw new Error("Operations response is incomplete.");
  }

  return data;
}

const superAdminOperationsService = {
  getOperationsOverview,
};

export default superAdminOperationsService;