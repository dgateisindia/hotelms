"use strict";

const express =
  require("express");

const maintenanceController =
  require(
    "../controllers/maintenance/maintenanceController"
  );


const router =
  express.Router();


/* ============================================================
   TASK LIST

   GET /api/maintenance/tasks

   Filters:
   ?status=
   ?priority=
   ?source_type=
   ?room_id=
   ?staff_id=
   ?search=
   ?page=
   ?page_size=
============================================================ */

router.get(
  "/tasks",
  maintenanceController
    .getTasks
);


/* ============================================================
   ASSIGNABLE MAINTENANCE STAFF

   GET /api/maintenance/staff
============================================================ */

router.get(
  "/staff",
  maintenanceController
    .getAssignableStaff
);


/* ============================================================
   TASK DETAIL

   GET /api/maintenance/tasks/:taskId
============================================================ */

router.get(
  "/tasks/:taskId",
  maintenanceController
    .getTaskById
);


/* ============================================================
   CREATE MANUAL MAINTENANCE

   POST /api/maintenance/tasks/manual

   Body:
   {
     room_id,
     issue_title,
     issue_description?,
     priority?
   }
============================================================ */

router.post(
  "/tasks/manual",
  maintenanceController
    .createManualTask
);


/* ============================================================
   ASSIGN / REASSIGN

   PATCH /api/maintenance/tasks/:taskId/assign

   Body:
   {
     staff_id,
     notes?
   }
============================================================ */

router.patch(
  "/tasks/:taskId/assign",
  maintenanceController
    .assignTask
);


/* ============================================================
   UNASSIGN

   PATCH /api/maintenance/tasks/:taskId/unassign

   Body:
   {
     notes?
   }
============================================================ */

router.patch(
  "/tasks/:taskId/unassign",
  maintenanceController
    .unassignTask
);


/* ============================================================
   START

   PATCH /api/maintenance/tasks/:taskId/start

   Body:
   {
     notes?
   }
============================================================ */

router.patch(
  "/tasks/:taskId/start",
  maintenanceController
    .startTask
);


/* ============================================================
   COMPLETE

   PATCH /api/maintenance/tasks/:taskId/complete

   Body:
   {
     resolution_notes?
   }
============================================================ */

router.patch(
  "/tasks/:taskId/complete",
  maintenanceController
    .completeTask
);


/* ============================================================
   CANCEL

   PATCH /api/maintenance/tasks/:taskId/cancel

   Body:
   {
     cancellation_reason
   }
============================================================ */

router.patch(
  "/tasks/:taskId/cancel",
  maintenanceController
    .cancelTask
);


/* ============================================================
   APPEND-ONLY NOTE

   POST /api/maintenance/tasks/:taskId/notes

   Body:
   {
     note
   }
============================================================ */

router.post(
  "/tasks/:taskId/notes",
  maintenanceController
    .addTaskNote
);


module.exports =
  router;