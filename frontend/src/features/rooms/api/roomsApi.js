import apiClient from "../../../shared/api/apiClient";

const roomsApi = {
  getRooms() {
    return apiClient.get("/rooms");
  },

  createRoom(payload) {
    return apiClient.post("/rooms", payload);
  },

  updateRoom(roomId, payload) {
    return apiClient.put(`/rooms/${roomId}`, payload);
  },

  deleteRoom(roomId) {
    return apiClient.delete(`/rooms/${roomId}`);
  },

  getRoomDetails(roomId) {
    return apiClient.get(`/rooms/${roomId}/details`);
  },

  getAvailableRooms(params = {}) {
    return apiClient.get("/rooms/available", {
      params,
    });
  },
};

export default roomsApi;