import apiClient from "../../../shared/api/apiClient";


export function getReservationGroup(groupId) {
  return apiClient.get(
    `/bookings/groups/${groupId}`
  );
}


export function getBooking(bookingId) {
  return apiClient.get(
    `/bookings/${bookingId}`
  );
}


export function lookupCustomer(requestConfig) {
  return apiClient.get(
    "/customers/lookup",
    requestConfig
  );
}


export function getAvailableRooms(queryString) {
  return apiClient.get(
    `/rooms/available?${queryString}`
  );
}


export function quoteBookingEdit(
  bookingId,
  payload
) {
  return apiClient.post(
    `/bookings/${bookingId}/quote`,
    payload
  );
}


export function quoteReservationGroupRooms(
  groupId,
  payload
) {
  return apiClient.post(
    `/bookings/groups/${groupId}/rooms/quote`,
    payload
  );
}


export function quoteBooking(payload) {
  return apiClient.post(
    "/bookings/quote",
    payload
  );
}


export function updateCustomer(
  customerId,
  payload
) {
  return apiClient.put(
    `/customers/${customerId}`,
    payload
  );
}


/*
 * Named saveBookingEdit instead of updateBooking because
 * BookingDesk already owns a local updateBooking form-state
 * function. This avoids ambiguous ownership at the call site.
 */
export function saveBookingEdit(
  bookingId,
  payload
) {
  return apiClient.put(
    `/bookings/${bookingId}`,
    payload
  );
}


export function addReservationGroupRooms(
  groupId,
  payload
) {
  return apiClient.post(
    `/bookings/groups/${groupId}/rooms`,
    payload
  );
}


export function createBooking(payload) {
  return apiClient.post(
    "/bookings",
    payload
  );
}