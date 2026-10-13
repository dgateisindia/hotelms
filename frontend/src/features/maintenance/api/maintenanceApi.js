import apiClient from "../../../shared/api/apiClient";


const maintenanceApi = {

  /* ==========================================================
     TASK LIST
  ========================================================== */

  getTasks(params = {}) {
    return apiClient.get(
      "/maintenance/tasks",
      {
        params,
      }
    );
  },


  /* ==========================================================
     ASSIGNABLE MAINTENANCE STAFF
  ========================================================== */

  getAssignableStaff() {
    return apiClient.get(
      "/maintenance/staff"
    );
  },


  /* ==========================================================
     TASK DETAILS + EVENT HISTORY
  ========================================================== */

  getTask(taskId) {
    return apiClient.get(
      `/maintenance/tasks/${taskId}`
    );
  },


  /* ==========================================================
     CREATE MANUAL MAINTENANCE
  ========================================================== */

  createManualTask(payload) {
    return apiClient.post(
      "/maintenance/tasks/manual",
      payload
    );
  },


  /* ==========================================================
     ASSIGN / REASSIGN
  ========================================================== */

  assignTask(
    taskId,
    payload
  ) {
    return apiClient.patch(
      `/maintenance/tasks/${taskId}/assign`,
      payload
    );
  },


  /* ==========================================================
     UNASSIGN
  ========================================================== */

  unassignTask(
    taskId,
    payload = {}
  ) {
    return apiClient.patch(
      `/maintenance/tasks/${taskId}/unassign`,
      payload
    );
  },


  /* ==========================================================
     START
  ========================================================== */

  startTask(
    taskId,
    payload = {}
  ) {
    return apiClient.patch(
      `/maintenance/tasks/${taskId}/start`,
      payload
    );
  },


  /* ==========================================================
     COMPLETE
  ========================================================== */

  completeTask(
    taskId,
    payload = {}
  ) {
    return apiClient.patch(
      `/maintenance/tasks/${taskId}/complete`,
      payload
    );
  },


  /* ==========================================================
     CANCEL
  ========================================================== */

  cancelTask(
    taskId,
    payload
  ) {
    return apiClient.patch(
      `/maintenance/tasks/${taskId}/cancel`,
      payload
    );
  },


  /* ==========================================================
     APPEND-ONLY NOTE
  ========================================================== */

  addTaskNote(
    taskId,
    payload
  ) {
    return apiClient.post(
      `/maintenance/tasks/${taskId}/notes`,
      payload
    );
  },
};


export default maintenanceApi;