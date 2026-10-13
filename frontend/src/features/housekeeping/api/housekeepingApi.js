import apiClient from "../../../shared/api/apiClient";


const housekeepingApi = {

  /* ==========================================================
     TASK LIST
  ========================================================== */

  getTasks(params = {}) {
    return apiClient.get(
      "/housekeeping/tasks",
      {
        params,
      }
    );
  },


  /* ==========================================================
     ASSIGNABLE STAFF
  ========================================================== */

  getAssignableStaff(params = {}) {
    return apiClient.get(
      "/housekeeping/staff",
      {
        params,
      }
    );
  },


  /* ==========================================================
     TASK DETAILS + EVENT HISTORY
  ========================================================== */

  getTask(taskId) {
    return apiClient.get(
      `/housekeeping/tasks/${taskId}`
    );
  },


  /* ==========================================================
     MANUAL CLEANING
  ========================================================== */

  createManualTask(payload) {
    return apiClient.post(
      "/housekeeping/tasks/manual",
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
      `/housekeeping/tasks/${taskId}/assign`,
      payload
    );
  },


  /* ==========================================================
     UNASSIGN

     Assignment is independent from lifecycle status.
  ========================================================== */

  unassignTask(
    taskId,
    payload = {}
  ) {
    return apiClient.patch(
      `/housekeeping/tasks/${taskId}/unassign`,
      payload
    );
  },


  /* ==========================================================
     START

     pending -> in_progress
  ========================================================== */

  startTask(
    taskId,
    payload = {}
  ) {
    return apiClient.patch(
      `/housekeeping/tasks/${taskId}/start`,
      payload
    );
  },


  /* ==========================================================
     COMPLETE

     in_progress -> completed

     Backend remains authoritative for resulting room status.
  ========================================================== */

  completeTask(
    taskId,
    payload = {}
  ) {
    return apiClient.patch(
      `/housekeeping/tasks/${taskId}/complete`,
      payload
    );
  },


  /* ==========================================================
     CANCEL

     pending/in_progress -> cancelled
  ========================================================== */

  cancelTask(
    taskId,
    payload
  ) {
    return apiClient.patch(
      `/housekeeping/tasks/${taskId}/cancel`,
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
      `/housekeeping/tasks/${taskId}/notes`,
      payload
    );
  },
};


export default housekeepingApi;
