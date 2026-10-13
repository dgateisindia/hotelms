"use strict";

const db =
  require("../../config/db").promisePool;

const {
  createManualCleaningTaskWithConnection,

  assignHousekeepingTaskWithConnection,
  unassignHousekeepingTaskWithConnection,
  startHousekeepingTaskWithConnection,
  completeHousekeepingTaskWithConnection,
  cancelHousekeepingTaskWithConnection,

  addHousekeepingTaskNoteWithConnection,

  listHousekeepingTasks,
  getHousekeepingTaskById,

  listAssignableHousekeepingStaff,
} = require(
  "../../services/housekeeping/housekeepingService"
);


/* ============================================================
   RESPONSE / ERROR HELPERS
============================================================ */

function sendError(
  res,
  status,
  code,
  message
) {
  return res
    .status(status)
    .json({
      success:
        false,

      code,

      message,
    });
}


function httpError(
  status,
  code,
  message
) {
  const error =
    new Error(
      message
    );

  error.status =
    status;

  error.statusCode =
    status;

  error.code =
    code;

  return error;
}


function positiveId(
  value
) {
  const parsed =
    Number(
      value
    );

  return (
    Number.isInteger(
      parsed
    ) &&
    parsed > 0
  )
    ? parsed
    : null;
}


/* ============================================================
   TRUSTED ADMIN CONTEXT

   Never accept:
   - hotel_id
   - admin_id

   from request body/query/params.
============================================================ */

function getAdminContext(
  req
) {
  const hotelId =
    positiveId(
      req.dbUser
        ?.hotelId
    );

  const adminId =
    positiveId(
      req.dbUser
        ?.adminId
    );

  if (
    !hotelId ||
    !adminId
  ) {
    throw httpError(
      403,
      "HOUSEKEEPING_ADMIN_CONTEXT_REQUIRED",
      "A valid hotel Admin context is required."
    );
  }

  return {
    hotelId,
    adminId,
  };
}


/* ============================================================
   SERVICE ERROR RESPONSE

   Expected service errors preserve:
   - HTTP status
   - code
   - safe business message

   Unexpected DB/runtime details are never exposed.
============================================================ */

function sendControllerError(
  res,
  error,
  fallbackCode,
  fallbackMessage
) {
  const status =
    Number(
      error?.statusCode ||
      error?.status
    );

  if (
    Number.isInteger(
      status
    ) &&
    status >= 400 &&
    status <= 599
  ) {
    return sendError(
      res,
      status,
      error?.code ||
        fallbackCode,
      error?.message ||
        fallbackMessage
    );
  }

  console.error(
    `[HOUSEKEEPING] ${fallbackCode}:`,
    error
  );

  return sendError(
    res,
    500,
    fallbackCode,
    fallbackMessage
  );
}


/* ============================================================
   TRANSACTION RUNNER

   All housekeeping mutations:
   controller transaction
        ↓
   canonical housekeeping service
        ↓
   commit / rollback
============================================================ */

async function runMutation(
  req,
  res,
  {
    action,
    successStatus = 200,
    fallbackCode,
    fallbackMessage,
  }
) {
  let connection =
    null;

  let transactionStarted =
    false;

  let committed =
    false;

  try {
    const context =
      getAdminContext(
        req
      );

    connection =
      await db
        .getConnection();

    await connection
      .beginTransaction();

    transactionStarted =
      true;

    const result =
      await action(
        connection,
        context
      );

    await connection
      .commit();

    committed =
      true;

    return res
      .status(
        successStatus
      )
      .json({
        success:
          true,

        data:
          result,
      });
  }
  catch (
    error
  ) {
    if (
      connection &&
      transactionStarted &&
      !committed
    ) {
      try {
        await connection
          .rollback();
      }
      catch (
        rollbackError
      ) {
        console.error(
          "[HOUSEKEEPING] rollback failed:",
          rollbackError
        );
      }
    }

    return sendControllerError(
      res,
      error,
      fallbackCode,
      fallbackMessage
    );
  }
  finally {
    if (
      connection
    ) {
      connection.release();
    }
  }
}


/* ============================================================
   GET TASK LIST

   GET /api/housekeeping/tasks

   Filters:
   ?status=
   ?task_type=
   ?room_id=
   ?staff_id=
   ?search=
   ?page=
   ?page_size=
============================================================ */

exports.getTasks =
  async (
    req,
    res
  ) => {
    try {
      const {
        hotelId,
      } =
        getAdminContext(
          req
        );

      const result =
        await listHousekeepingTasks({
          hotelId,

          status:
            req.query
              ?.status,

          taskType:
            req.query
              ?.task_type,

          roomId:
            req.query
              ?.room_id,

          staffId:
            req.query
              ?.staff_id,

          search:
            req.query
              ?.search,

          page:
            req.query
              ?.page,

          pageSize:
            req.query
              ?.page_size,
        });

      return res.json({
        success:
          true,

        data:
          result.items,

        pagination:
          result.pagination,
      });
    }
    catch (
      error
    ) {
      return sendControllerError(
        res,
        error,
        "HOUSEKEEPING_LIST_FAILED",
        "Housekeeping tasks could not be loaded."
      );
    }
  };


/* ============================================================
   GET TASK DETAIL

   GET /api/housekeeping/tasks/:taskId
============================================================ */

exports.getTaskById =
  async (
    req,
    res
  ) => {
    try {
      const {
        hotelId,
      } =
        getAdminContext(
          req
        );

      const result =
        await getHousekeepingTaskById({
          hotelId,

          taskId:
            req.params
              .taskId,
        });

      return res.json({
        success:
          true,

        data:
          result,
      });
    }
    catch (
      error
    ) {
      return sendControllerError(
        res,
        error,
        "HOUSEKEEPING_DETAIL_FAILED",
        "The housekeeping task could not be loaded."
      );
    }
  };


/* ============================================================
   GET ASSIGNABLE STAFF

   GET /api/housekeeping/staff

   Only:
   - same hotel
   - Housekeeping department
   - Active staff
============================================================ */

exports.getAssignableStaff =
  async (
    req,
    res
  ) => {
    try {
      const {
        hotelId,
      } =
        getAdminContext(
          req
        );

      const result =
        await listAssignableHousekeepingStaff({
          hotelId,
        });

      return res.json({
        success:
          true,

        data:
          result,
      });
    }
    catch (
      error
    ) {
      return sendControllerError(
        res,
        error,
        "HOUSEKEEPING_STAFF_LIST_FAILED",
        "Assignable Housekeeping staff could not be loaded."
      );
    }
  };


/* ============================================================
   CREATE MANUAL CLEANING

   POST /api/housekeeping/tasks/manual

   BODY:
   {
     room_id,
     notes?
   }

   hotel_id/admin_id are intentionally ignored.
============================================================ */

exports.createManualTask =
  async (
    req,
    res
  ) => {
    return runMutation(
      req,
      res,
      {
        successStatus:
          201,

        fallbackCode:
          "HOUSEKEEPING_MANUAL_CREATE_FAILED",

        fallbackMessage:
          "The manual housekeeping task could not be created.",

        action:
          async (
            connection,
            context
          ) => {
            return createManualCleaningTaskWithConnection(
              connection,
              {
                hotelId:
                  context.hotelId,

                adminId:
                  context.adminId,

                roomId:
                  req.body
                    ?.room_id,

                notes:
                  req.body
                    ?.notes,
              }
            );
          },
      }
    );
  };


/* ============================================================
   ASSIGN / REASSIGN

   PATCH /api/housekeeping/tasks/:taskId/assign

   BODY:
   {
     staff_id,
     notes?
   }
============================================================ */

exports.assignTask =
  async (
    req,
    res
  ) => {
    return runMutation(
      req,
      res,
      {
        fallbackCode:
          "HOUSEKEEPING_ASSIGN_FAILED",

        fallbackMessage:
          "The housekeeping task could not be assigned.",

        action:
          async (
            connection,
            context
          ) => {
            return assignHousekeepingTaskWithConnection(
              connection,
              {
                hotelId:
                  context.hotelId,

                adminId:
                  context.adminId,

                taskId:
                  req.params
                    .taskId,

                staffId:
                  req.body
                    ?.staff_id,

                notes:
                  req.body
                    ?.notes,
              }
            );
          },
      }
    );
  };


/* ============================================================
   UNASSIGN

   PATCH /api/housekeeping/tasks/:taskId/unassign

   BODY:
   {
     notes?
   }

   Assignment is orthogonal to lifecycle.
   Unassigning does not change task_status.
============================================================ */

exports.unassignTask =
  async (
    req,
    res
  ) => {
    return runMutation(
      req,
      res,
      {
        fallbackCode:
          "HOUSEKEEPING_ASSIGN_FAILED",

        fallbackMessage:
          "The housekeeping task could not be assigned.",

        action:
          async (
            connection,
            context
          ) => {
            return unassignHousekeepingTaskWithConnection(
              connection,
              {
                hotelId:
                  context.hotelId,

                adminId:
                  context.adminId,

                taskId:
                  req.params
                    .taskId,
notes:
                  req.body
                    ?.notes,
              }
            );
          },
      }
    );
  };


/* ============================================================
   START TASK

   PATCH /api/housekeeping/tasks/:taskId/start

   BODY:
   {
     notes?
   }
============================================================ */

exports.startTask =
  async (
    req,
    res
  ) => {
    return runMutation(
      req,
      res,
      {
        fallbackCode:
          "HOUSEKEEPING_START_FAILED",

        fallbackMessage:
          "The housekeeping task could not be started.",

        action:
          async (
            connection,
            context
          ) => {
            return startHousekeepingTaskWithConnection(
              connection,
              {
                hotelId:
                  context.hotelId,

                adminId:
                  context.adminId,

                taskId:
                  req.params
                    .taskId,

                notes:
                  req.body
                    ?.notes,
              }
            );
          },
      }
    );
  };


/* ============================================================
   COMPLETE TASK

   PATCH /api/housekeeping/tasks/:taskId/complete

   BODY:
   {
     completion_notes?
   }
============================================================ */

exports.completeTask =
  async (
    req,
    res
  ) => {
    return runMutation(
      req,
      res,
      {
        fallbackCode:
          "HOUSEKEEPING_COMPLETE_FAILED",

        fallbackMessage:
          "The housekeeping task could not be completed.",

        action:
          async (
            connection,
            context
          ) => {
            return completeHousekeepingTaskWithConnection(
              connection,
              {
                hotelId:
                  context.hotelId,

                adminId:
                  context.adminId,

                taskId:
                  req.params
                    .taskId,

                completionNotes:
                  req.body
                    ?.completion_notes,
              }
            );
          },
      }
    );
  };


/* ============================================================
   CANCEL TASK

   PATCH /api/housekeeping/tasks/:taskId/cancel

   BODY:
   {
     cancellation_reason
   }

   Cancellation never releases room to Available.
============================================================ */

exports.cancelTask =
  async (
    req,
    res
  ) => {
    return runMutation(
      req,
      res,
      {
        fallbackCode:
          "HOUSEKEEPING_CANCEL_FAILED",

        fallbackMessage:
          "The housekeeping task could not be cancelled.",

        action:
          async (
            connection,
            context
          ) => {
            return cancelHousekeepingTaskWithConnection(
              connection,
              {
                hotelId:
                  context.hotelId,

                adminId:
                  context.adminId,

                taskId:
                  req.params
                    .taskId,

                cancellationReason:
                  req.body
                    ?.cancellation_reason,
              }
            );
          },
      }
    );
  };


/* ============================================================
   APPEND NOTE

   POST /api/housekeeping/tasks/:taskId/notes

   BODY:
   {
     note
   }

   Notes are append-only events.
============================================================ */

exports.addTaskNote =
  async (
    req,
    res
  ) => {
    return runMutation(
      req,
      res,
      {
        fallbackCode:
          "HOUSEKEEPING_NOTE_FAILED",

        fallbackMessage:
          "The housekeeping note could not be added.",

        action:
          async (
            connection,
            context
          ) => {
            return addHousekeepingTaskNoteWithConnection(
              connection,
              {
                hotelId:
                  context.hotelId,

                adminId:
                  context.adminId,

                taskId:
                  req.params
                    .taskId,

                note:
                  req.body
                    ?.note,
              }
            );
          },
      }
    );
  };
