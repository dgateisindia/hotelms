"use strict";

const db =
  require("../../config/db").promisePool;

const {
  createManualMaintenanceTaskWithConnection,

  assignMaintenanceTaskWithConnection,
  unassignMaintenanceTaskWithConnection,

  startMaintenanceTaskWithConnection,
  completeMaintenanceTaskWithConnection,
  cancelMaintenanceTaskWithConnection,

  addMaintenanceTaskNoteWithConnection,

  listMaintenanceTasks,
  getMaintenanceTaskById,

  listAssignableMaintenanceStaff,
} = require(
  "../../services/maintenance/maintenanceService"
);


/* ============================================================
   RESPONSE / ERROR HELPERS
============================================================ */

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

  error.code =
    code;

  return error;
}


function positiveId(
  value
) {

  const id =
    Number(
      value
    );

  return (
    Number.isSafeInteger(
      id
    ) &&
    id > 0
      ? id
      : null
  );
}


function sendControllerError(
  res,
  error,
  fallbackCode,
  fallbackMessage
) {

  const status =
    Number.isInteger(
      error?.status
    ) &&
    error.status >= 400 &&
    error.status <= 599
      ? error.status
      : 500;


  const expectedServiceError =
    status < 500;


  if (
    !expectedServiceError
  ) {

    console.error(
      "[MAINTENANCE]",
      error
    );
  }


  return res
    .status(
      status
    )
    .json({
      success:
        false,

      error: {
        code:
          expectedServiceError &&
          error?.code
            ? error.code
            : fallbackCode,

        message:
          expectedServiceError &&
          error?.message
            ? error.message
            : fallbackMessage,
      },
    });
}


/* ============================================================
   TRUSTED ADMIN CONTEXT

   hotelId/adminId are derived only from authenticated
   req.dbUser context.

   Client-supplied tenancy identifiers are never trusted.
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
      "MAINTENANCE_ADMIN_CONTEXT_REQUIRED",
      "A valid hotel Admin context is required."
    );
  }


  return {
    hotelId,
    adminId,
  };
}


/* ============================================================
   MUTATION TRANSACTION WRAPPER

   Controller owns:
   - connection
   - beginTransaction
   - commit
   - rollback
   - release

   Maintenance service receives the same caller connection.
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
          "[MAINTENANCE] rollback failed:",
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
        await listMaintenanceTasks({
          hotelId,

          status:
            req.query
              ?.status,

          priority:
            req.query
              ?.priority,

          sourceType:
            req.query
              ?.source_type,

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
          result,
      });
    }
    catch (
      error
    ) {

      return sendControllerError(
        res,
        error,
        "MAINTENANCE_LIST_FETCH_FAILED",
        "Maintenance tasks could not be loaded."
      );
    }
  };


/* ============================================================
   GET TASK DETAIL

   GET /api/maintenance/tasks/:taskId
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
        await getMaintenanceTaskById({
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
        "MAINTENANCE_TASK_FETCH_FAILED",
        "The maintenance task could not be loaded."
      );
    }
  };


/* ============================================================
   GET ASSIGNABLE MAINTENANCE STAFF

   GET /api/maintenance/staff
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
        await listAssignableMaintenanceStaff({
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
        "MAINTENANCE_STAFF_FETCH_FAILED",
        "Assignable maintenance staff could not be loaded."
      );
    }
  };


/* ============================================================
   CREATE MANUAL TASK

   POST /api/maintenance/tasks/manual

   Body:
   {
     room_id,
     issue_title,
     issue_description?,
     priority?
   }

   hotel/admin tenancy always comes from req.dbUser.
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
          "MAINTENANCE_MANUAL_CREATE_FAILED",

        fallbackMessage:
          "The maintenance task could not be created.",

        action:
          async (
            connection,
            context
          ) => {

            return createManualMaintenanceTaskWithConnection(
              connection,
              {
                hotelId:
                  context.hotelId,

                adminId:
                  context.adminId,

                roomId:
                  req.body
                    ?.room_id,

                issueTitle:
                  req.body
                    ?.issue_title,

                issueDescription:
                  req.body
                    ?.issue_description,

                priority:
                  req.body
                    ?.priority,
              }
            );
          },
      }
    );
  };


/* ============================================================
   ASSIGN / REASSIGN

   PATCH /api/maintenance/tasks/:taskId/assign

   Body:
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
          "MAINTENANCE_ASSIGN_FAILED",

        fallbackMessage:
          "The maintenance task could not be assigned.",

        action:
          async (
            connection,
            context
          ) => {

            return assignMaintenanceTaskWithConnection(
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

   PATCH /api/maintenance/tasks/:taskId/unassign
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
          "MAINTENANCE_UNASSIGN_FAILED",

        fallbackMessage:
          "The maintenance task could not be unassigned.",

        action:
          async (
            connection,
            context
          ) => {

            return unassignMaintenanceTaskWithConnection(
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
   START

   PATCH /api/maintenance/tasks/:taskId/start
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
          "MAINTENANCE_START_FAILED",

        fallbackMessage:
          "The maintenance task could not be started.",

        action:
          async (
            connection,
            context
          ) => {

            return startMaintenanceTaskWithConnection(
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
   COMPLETE

   PATCH /api/maintenance/tasks/:taskId/complete

   Body:
   {
     resolution_notes?
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
          "MAINTENANCE_COMPLETE_FAILED",

        fallbackMessage:
          "The maintenance task could not be completed.",

        action:
          async (
            connection,
            context
          ) => {

            return completeMaintenanceTaskWithConnection(
              connection,
              {
                hotelId:
                  context.hotelId,

                adminId:
                  context.adminId,

                taskId:
                  req.params
                    .taskId,

                resolutionNotes:
                  req.body
                    ?.resolution_notes,
              }
            );
          },
      }
    );
  };


/* ============================================================
   CANCEL

   PATCH /api/maintenance/tasks/:taskId/cancel

   Cancellation intentionally does not release the room.

   Body:
   {
     cancellation_reason
   }
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
          "MAINTENANCE_CANCEL_FAILED",

        fallbackMessage:
          "The maintenance task could not be cancelled.",

        action:
          async (
            connection,
            context
          ) => {

            return cancelMaintenanceTaskWithConnection(
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
   APPEND-ONLY NOTE

   POST /api/maintenance/tasks/:taskId/notes

   Body:
   {
     note
   }
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
          "MAINTENANCE_NOTE_FAILED",

        fallbackMessage:
          "The maintenance note could not be added.",

        action:
          async (
            connection,
            context
          ) => {

            return addMaintenanceTaskNoteWithConnection(
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