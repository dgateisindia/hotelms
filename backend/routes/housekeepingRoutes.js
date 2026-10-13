"use strict";

const express =
  require("express");

const router =
  express.Router();

const housekeepingController =
  require(
    "../controllers/housekeeping/housekeepingController"
  );


/* ============================================================
   HOUSEKEEPING ROUTES

   SECURITY
   ------------------------------------------------------------
   Authentication / tenant authorization is intentionally
   applied by server.js when this router is mounted:

   requireClerkSession
     -> attachDbUser()
     -> requireRole("admin")

   Controllers use only:
   req.dbUser.hotelId
   req.dbUser.adminId

   Never accept trusted tenant identity from frontend input.
============================================================ */


/* ============================================================
   READ
============================================================ */

/*
 * GET /api/housekeeping/tasks
 *
 * Optional filters:
 * ?status=
 * ?task_type=
 * ?room_id=
 * ?staff_id=
 * ?search=
 * ?page=
 * ?page_size=
 */
router.get(
  "/tasks",
  housekeepingController
    .getTasks
);


/*
 * GET /api/housekeeping/staff
 *
 * Returns only:
 * - same-hotel
 * - Active
 * - Housekeeping department staff
 */
router.get(
  "/staff",
  housekeepingController
    .getAssignableStaff
);


/*
 * GET /api/housekeeping/tasks/:taskId
 *
 * Includes append-only event history.
 */
router.get(
  "/tasks/:taskId",
  housekeepingController
    .getTaskById
);


/* ============================================================
   CREATE MANUAL CLEANING
============================================================ */

/*
 * POST /api/housekeeping/tasks/manual
 *
 * Body:
 * {
 *   room_id,
 *   notes?
 * }
 */
router.post(
  "/tasks/manual",
  housekeepingController
    .createManualTask
);


/* ============================================================
   ASSIGN / REASSIGN
============================================================ */

/*
 * PATCH /api/housekeeping/tasks/:taskId/assign
 *
 * Body:
 * {
 *   staff_id,
 *   notes?
 * }
 */
router.patch(
  "/tasks/:taskId/assign",
  housekeepingController
    .assignTask
);


/* ============================================================
   UNASSIGN
============================================================ */

/*
 * PATCH /api/housekeeping/tasks/:taskId/unassign
 *
 * Body:
 * {
 *   notes?
 * }
 *
 * Assignment changes do not change task lifecycle status.
 */
router.patch(
  "/tasks/:taskId/unassign",
  housekeepingController
    .unassignTask
);


/* ============================================================
   START
============================================================ */

/*
 * PATCH /api/housekeeping/tasks/:taskId/start
 *
 * Body:
 * {
 *   notes?
 * }
 */
router.patch(
  "/tasks/:taskId/start",
  housekeepingController
    .startTask
);


/* ============================================================
   COMPLETE
============================================================ */

/*
 * PATCH /api/housekeeping/tasks/:taskId/complete
 *
 * Body:
 * {
 *   completion_notes?
 * }
 */
router.patch(
  "/tasks/:taskId/complete",
  housekeepingController
    .completeTask
);


/* ============================================================
   CANCEL
============================================================ */

/*
 * PATCH /api/housekeeping/tasks/:taskId/cancel
 *
 * Body:
 * {
 *   cancellation_reason
 * }
 */
router.patch(
  "/tasks/:taskId/cancel",
  housekeepingController
    .cancelTask
);


/* ============================================================
   APPEND-ONLY NOTE
============================================================ */

/*
 * POST /api/housekeeping/tasks/:taskId/notes
 *
 * Body:
 * {
 *   note
 * }
 */
router.post(
  "/tasks/:taskId/notes",
  housekeepingController
    .addTaskNote
);


module.exports =
  router;
