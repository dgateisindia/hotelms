"use strict";

const db =
  require("../../config/db").promisePool;


/* ============================================================
   CONSTANTS
============================================================ */

const TASK_TYPES =
  Object.freeze({
    CHECKOUT:
      "checkout_cleaning",

    ROOM_CHANGE:
      "room_change_cleaning",

    MANUAL:
      "manual_cleaning",

    RECOVERY:
      "recovery_cleaning",
  });


const TASK_STATUSES =
  Object.freeze({
    PENDING:
      "pending",

    IN_PROGRESS:
      "in_progress",

    COMPLETED:
      "completed",

    CANCELLED:
      "cancelled",
  });


const VALID_TASK_TYPES =
  new Set(
    Object.values(
      TASK_TYPES
    )
  );


const VALID_TASK_STATUSES =
  new Set(
    Object.values(
      TASK_STATUSES
    )
  );


/* ============================================================
   VALIDATION / ERROR HELPERS
============================================================ */

function throwHttp(
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

  throw error;
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


function requirePositiveId(
  value,
  fieldName
) {
  const parsed =
    positiveId(
      value
    );

  if (!parsed) {
    throwHttp(
      400,
      "INVALID_HOUSEKEEPING_ID",
      `${fieldName} must be a positive integer.`
    );
  }

  return parsed;
}


function optionalText(
  value,
  fieldName,
  maxLength = 500
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalized =
    String(
      value
    ).trim();

  if (!normalized) {
    return null;
  }

  if (
    normalized.length >
    maxLength
  ) {
    throwHttp(
      400,
      "HOUSEKEEPING_TEXT_TOO_LONG",
      `${fieldName} cannot exceed ${maxLength} characters.`
    );
  }

  return normalized;
}


function requiredText(
  value,
  fieldName,
  maxLength = 500
) {
  const normalized =
    optionalText(
      value,
      fieldName,
      maxLength
    );

  if (!normalized) {
    throwHttp(
      400,
      "HOUSEKEEPING_TEXT_REQUIRED",
      `${fieldName} is required.`
    );
  }

  return normalized;
}


function normalizePage(
  value
) {
  const parsed =
    Number.parseInt(
      value,
      10
    );

  return (
    Number.isInteger(
      parsed
    ) &&
    parsed > 0
  )
    ? parsed
    : 1;
}


function normalizePageSize(
  value
) {
  const parsed =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed <= 0
  ) {
    return 25;
  }

  return Math.min(
    parsed,
    100
  );
}


function ensureConnection(
  connection
) {
  if (
    !connection ||
    typeof connection.query !==
      "function"
  ) {
    throw new TypeError(
      "A database connection is required for housekeeping mutations."
    );
  }
}


/* ============================================================
   ROOM LOCK
============================================================ */

async function lockRoom(
  connection,
  hotelId,
  roomId
) {
  const [[room]] =
    await connection.query(
      `
        SELECT
          room_id,
          room_number,
          room_type,
          status

        FROM rooms

        WHERE hotel_id = ?
          AND room_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        roomId,
      ]
    );

  if (!room) {
    throwHttp(
      404,
      "HOUSEKEEPING_ROOM_NOT_FOUND",
      "The room was not found in your hotel."
    );
  }

  return room;
}


/* ============================================================
   TASK CORE
============================================================ */

async function getTaskCore(
  executor,
  hotelId,
  taskId,
  {
    forUpdate = false,
  } = {}
) {
  const lockClause =
    forUpdate
      ? "FOR UPDATE"
      : "";

  const [[task]] =
    await executor.query(
      `
        SELECT
          housekeeping_task_id,
          hotel_id,
          room_id,

          booking_id,
          booking_adjustment_id,

          task_type,
          source_key,
          task_status,
          active_slot,

          assigned_staff_id,

          created_by_admin_id,
          assigned_by_admin_id,
          completed_by_admin_id,
          cancelled_by_admin_id,

          assigned_at,
          started_at,
          completed_at,
          cancelled_at,

          notes,
          completion_notes,
          cancellation_reason,

          created_at,
          updated_at

        FROM housekeeping_tasks

        WHERE hotel_id = ?
          AND housekeeping_task_id = ?

        ${lockClause}
      `,
      [
        hotelId,
        taskId,
      ]
    );

  if (!task) {
    throwHttp(
      404,
      "HOUSEKEEPING_TASK_NOT_FOUND",
      "The housekeeping task was not found in your hotel."
    );
  }

  return task;
}


/* ============================================================
   TASK RESPONSE
============================================================ */

async function getTaskContext(
  executor,
  hotelId,
  taskId
) {
  const [[task]] =
    await executor.query(
      `
        SELECT
          ht.housekeeping_task_id
            AS housekeepingTaskId,

          ht.hotel_id
            AS hotelId,

          ht.room_id
            AS roomId,

          r.room_number
            AS roomNumber,

          r.room_type
            AS roomType,

          r.status
            AS roomStatus,

          ht.booking_id
            AS bookingId,

          b.booking_code
            AS bookingCode,

          ht.booking_adjustment_id
            AS bookingAdjustmentId,

          ht.task_type
            AS taskType,

          ht.source_key
            AS sourceKey,

          ht.task_status
            AS taskStatus,

          ht.assigned_staff_id
            AS assignedStaffId,

          s.staff_code
            AS assignedStaffCode,

          s.full_name
            AS assignedStaffName,

          s.department
            AS assignedStaffDepartment,

          s.status
            AS assignedStaffStatus,

          ht.created_by_admin_id
            AS createdByAdminId,

          created_admin.full_name
            AS createdByAdminName,

          ht.assigned_by_admin_id
            AS assignedByAdminId,

          assigned_admin.full_name
            AS assignedByAdminName,

          ht.completed_by_admin_id
            AS completedByAdminId,

          completed_admin.full_name
            AS completedByAdminName,

          ht.cancelled_by_admin_id
            AS cancelledByAdminId,

          cancelled_admin.full_name
            AS cancelledByAdminName,

          ht.assigned_at
            AS assignedAt,

          ht.started_at
            AS startedAt,

          ht.completed_at
            AS completedAt,

          ht.cancelled_at
            AS cancelledAt,

          ht.notes,

          ht.completion_notes
            AS completionNotes,

          ht.cancellation_reason
            AS cancellationReason,

          ht.created_at
            AS createdAt,

          ht.updated_at
            AS updatedAt

        FROM housekeeping_tasks ht

        INNER JOIN rooms r
          ON r.hotel_id =
            ht.hotel_id

         AND r.room_id =
            ht.room_id

        LEFT JOIN bookings b
          ON b.hotel_id =
            ht.hotel_id

         AND b.booking_id =
            ht.booking_id

        LEFT JOIN staff s
          ON s.hotel_id =
            ht.hotel_id

         AND s.staff_id =
            ht.assigned_staff_id

        LEFT JOIN admins created_admin
          ON created_admin.hotel_id =
            ht.hotel_id

         AND created_admin.admin_id =
            ht.created_by_admin_id

        LEFT JOIN admins assigned_admin
          ON assigned_admin.hotel_id =
            ht.hotel_id

         AND assigned_admin.admin_id =
            ht.assigned_by_admin_id

        LEFT JOIN admins completed_admin
          ON completed_admin.hotel_id =
            ht.hotel_id

         AND completed_admin.admin_id =
            ht.completed_by_admin_id

        LEFT JOIN admins cancelled_admin
          ON cancelled_admin.hotel_id =
            ht.hotel_id

         AND cancelled_admin.admin_id =
            ht.cancelled_by_admin_id

        WHERE ht.hotel_id = ?
          AND ht.housekeeping_task_id = ?
      `,
      [
        hotelId,
        taskId,
      ]
    );

  if (!task) {
    throwHttp(
      404,
      "HOUSEKEEPING_TASK_NOT_FOUND",
      "The housekeeping task was not found in your hotel."
    );
  }

  return task;
}


/* ============================================================
   EVENT WRITER
============================================================ */

async function insertEvent(
  connection,
  {
    hotelId,
    taskId,
    eventType,

    fromStatus = null,
    toStatus = null,

    staffId = null,
    adminId = null,

    notes = null,
  }
) {
  await connection.query(
    `
      INSERT INTO housekeeping_task_events (
        hotel_id,
        housekeeping_task_id,

        event_type,

        from_status,
        to_status,

        staff_id,
        admin_id,

        notes
      )

      VALUES (
        ?,?,
        ?,
        ?,?,
        ?,?,
        ?
      )
    `,
    [
      hotelId,
      taskId,

      eventType,

      fromStatus,
      toStatus,

      staffId,
      adminId,

      notes,
    ]
  );
}


/* ============================================================
   SOURCE / ACTIVE TASK LOCKS
============================================================ */

async function findBySourceKeyForUpdate(
  connection,
  hotelId,
  sourceKey
) {
  if (!sourceKey) {
    return null;
  }

  const [[task]] =
    await connection.query(
      `
        SELECT
          housekeeping_task_id,
          room_id,

          booking_id,
          booking_adjustment_id,

          task_type,
          task_status

        FROM housekeeping_tasks

        WHERE hotel_id = ?
          AND source_key = ?

        FOR UPDATE
      `,
      [
        hotelId,
        sourceKey,
      ]
    );

  return task || null;
}


async function findActiveTaskForRoomForUpdate(
  connection,
  hotelId,
  roomId
) {
  const [[task]] =
    await connection.query(
      `
        SELECT
          housekeeping_task_id,
          task_type,
          task_status,
          source_key

        FROM housekeeping_tasks

        WHERE hotel_id = ?
          AND room_id = ?
          AND active_slot = 1

        LIMIT 1

        FOR UPDATE
      `,
      [
        hotelId,
        roomId,
      ]
    );

  return task || null;
}


function assertExistingSourceMatches(
  existing,
  {
    roomId,
    taskType,
    bookingId,
    bookingAdjustmentId,
  }
) {
  const matches =
    Number(
      existing.room_id
    ) ===
      roomId &&

    existing.task_type ===
      taskType &&

    Number(
      existing.booking_id ||
      0
    ) ===
      Number(
        bookingId ||
        0
      ) &&

    Number(
      existing.booking_adjustment_id ||
      0
    ) ===
      Number(
        bookingAdjustmentId ||
        0
      );

  if (!matches) {
    throwHttp(
      409,
      "HOUSEKEEPING_SOURCE_CONFLICT",
      "The housekeeping source key is already linked to a different cleaning task."
    );
  }
}


/* ============================================================
   CHECKOUT SOURCE VALIDATION
============================================================ */

async function validateCheckoutSource(
  connection,
  hotelId,
  bookingId,
  roomId
) {
  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          room_id,
          booking_status

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
      ]
    );

  if (!booking) {
    throwHttp(
      404,
      "HOUSEKEEPING_BOOKING_NOT_FOUND",
      "The booking linked to this cleaning task was not found."
    );
  }

  if (
    Number(
      booking.room_id
    ) !==
      roomId
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_BOOKING_ROOM_MISMATCH",
      "The booking is not currently linked to the housekeeping room."
    );
  }

  if (
    booking.booking_status !==
      "checked_in" &&

    booking.booking_status !==
      "checked_out"
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_BOOKING_STATE_INVALID",
      "Checkout cleaning can only be created for a checked-in or checked-out stay."
    );
  }
}


/* ============================================================
   ROOM CHANGE SOURCE VALIDATION
============================================================ */

async function validateRoomChangeSource(
  connection,
  hotelId,
  adjustmentId,
  roomId
) {
  const [[adjustment]] =
    await connection.query(
      `
        SELECT
          adjustment_id,
          adjustment_type,
          original_room_id,
          replacement_room_id

        FROM booking_adjustments

        WHERE hotel_id = ?
          AND adjustment_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        adjustmentId,
      ]
    );

  if (!adjustment) {
    throwHttp(
      404,
      "HOUSEKEEPING_ADJUSTMENT_NOT_FOUND",
      "The room-change adjustment linked to this cleaning task was not found."
    );
  }

  if (
    adjustment.adjustment_type !==
      "room_change"
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_ADJUSTMENT_TYPE_INVALID",
      "The linked adjustment is not a room-change adjustment."
    );
  }

  const belongsToAdjustment =
    Number(
      adjustment.original_room_id ||
      0
    ) === roomId ||

    Number(
      adjustment.replacement_room_id ||
      0
    ) === roomId;

  if (!belongsToAdjustment) {
    throwHttp(
      409,
      "HOUSEKEEPING_ADJUSTMENT_ROOM_MISMATCH",
      "The housekeeping room does not belong to the linked room-change adjustment."
    );
  }
}


/* ============================================================
   CREATE CORE
============================================================ */

async function createTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,
    roomId,

    taskType,

    bookingId = null,
    bookingAdjustmentId = null,

    sourceKey = null,

    notes = null,
  }
) {
  ensureConnection(
    connection
  );

  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  const aId =
    (
      taskType ===
        TASK_TYPES.RECOVERY &&
      (
        adminId === null ||
        adminId === undefined ||
        adminId === ""
      )
    )
      ? null
      : requirePositiveId(
          adminId,
          "adminId"
        );

  const rId =
    requirePositiveId(
      roomId,
      "roomId"
    );

  if (
    !VALID_TASK_TYPES.has(
      taskType
    )
  ) {
    throwHttp(
      400,
      "INVALID_HOUSEKEEPING_TASK_TYPE",
      "The housekeeping task type is invalid."
    );
  }

  const normalizedNotes =
    optionalText(
      notes,
      "notes"
    );

  /*
   * Canonical lock order:
   *
   * room
   *   -> source task
   *   -> active task
   *
   * Completion uses the same room -> task order.
   */
  const room =
    await lockRoom(
      connection,
      hId,
      rId
    );

  /*
   * System-generated tasks are idempotent.
   */
  const existingSource =
    await findBySourceKeyForUpdate(
      connection,
      hId,
      sourceKey
    );

  if (
    existingSource
  ) {
    assertExistingSourceMatches(
      existingSource,
      {
        roomId:
          rId,

        taskType,

        bookingId,

        bookingAdjustmentId,
      }
    );

    return {
      created:
        false,

      task:
        await getTaskContext(
          connection,
          hId,
          Number(
            existingSource
              .housekeeping_task_id
          )
        ),
    };
  }

  /*
   * Only one active housekeeping task per room.
   */
  const activeTask =
    await findActiveTaskForRoomForUpdate(
      connection,
      hId,
      rId
    );

  if (
    activeTask
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_ACTIVE_TASK_EXISTS",
      `Room ${room.room_number} already has an active housekeeping task.`
    );
  }

  /*
   * Manual cleaning is an explicit operational request for an
   * available room.
   *
   * If a room is already physically in Cleaning state but has
   * lost its canonical active task, use recovery_cleaning.
   */
  if (
    taskType ===
      TASK_TYPES.MANUAL
  ) {
    if (
      room.status !==
        "available"
    ) {
      throwHttp(
        409,
        "HOUSEKEEPING_MANUAL_ROOM_STATE_INVALID",
        "Manual cleaning can only be created for an available room. Use recovery cleaning when the room is already in Cleaning state."
      );
    }
  }

  /*
   * Recovery cleaning repairs a missing canonical task for a
   * room which is already physically marked Cleaning.
   */
  else if (
    taskType ===
      TASK_TYPES.RECOVERY
  ) {
    if (
      room.status !==
        "cleaning"
    ) {
      throwHttp(
        409,
        "HOUSEKEEPING_RECOVERY_ROOM_STATE_INVALID",
        "Recovery cleaning can only be created for a room already in Cleaning state."
      );
    }
  }

  /*
   * Checkout / room-change integrations may encounter either:
   *
   * occupied
   *   -> normal release path
   *
   * cleaning
   *   -> idempotent/recovery-compatible integration path
   */
  else if (
    room.status !==
      "occupied" &&

    room.status !==
      "cleaning"
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_RELEASED_ROOM_STATE_INVALID",
      "A checkout or room-change cleaning task requires the released room to be occupied or already marked cleaning."
    );
  }

  if (
    taskType ===
      TASK_TYPES.CHECKOUT
  ) {
    await validateCheckoutSource(
      connection,
      hId,
      bookingId,
      rId
    );
  }

  if (
    taskType ===
      TASK_TYPES.ROOM_CHANGE
  ) {
    await validateRoomChangeSource(
      connection,
      hId,
      bookingAdjustmentId,
      rId
    );
  }

  let result;

  try {
    [result] =
      await connection.query(
        `
          INSERT INTO housekeeping_tasks (
            hotel_id,
            room_id,

            booking_id,
            booking_adjustment_id,

            task_type,
            source_key,

            task_status,
            active_slot,

            created_by_admin_id,

            notes
          )

          VALUES (
            ?,?,
            ?,?,
            ?,?,
            'pending',
            1,
            ?,
            ?
          )
        `,
        [
          hId,
          rId,

          bookingId,
          bookingAdjustmentId,

          taskType,
          sourceKey,

          aId,

          normalizedNotes,
        ]
      );
  }
  catch (
    error
  ) {
    if (
      error?.code ===
        "ER_DUP_ENTRY"
    ) {
      throwHttp(
        409,
        "HOUSEKEEPING_TASK_CONFLICT",
        "A conflicting housekeeping task was created before this request could finish."
      );
    }

    throw error;
  }

  const taskId =
    Number(
      result.insertId
    );

  /*
   * rooms.status remains the current physical snapshot.
   *
   * Housekeeping task remains canonical historical lifecycle.
   */
  if (
    room.status !==
      "cleaning"
  ) {
    await connection.query(
      `
        UPDATE rooms

        SET status =
          'cleaning'

        WHERE hotel_id = ?
          AND room_id = ?
      `,
      [
        hId,
        rId,
      ]
    );
  }

  await insertEvent(
    connection,
    {
      hotelId:
        hId,

      taskId,

      eventType:
        "created",

      fromStatus:
        null,

      toStatus:
        TASK_STATUSES
          .PENDING,

      adminId:
        aId,

      notes:
        normalizedNotes,
    }
  );

  return {
    created:
      true,

    task:
      await getTaskContext(
        connection,
        hId,
        taskId
      ),
  };
}


/* ============================================================
   CREATE — CHECKOUT
============================================================ */

async function createCheckoutCleaningTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
    roomId,
    notes = null,
  }
) {
  const bId =
    requirePositiveId(
      bookingId,
      "bookingId"
    );

  return createTaskWithConnection(
    connection,
    {
      hotelId,
      adminId,
      roomId,

      taskType:
        TASK_TYPES
          .CHECKOUT,

      bookingId:
        bId,

      bookingAdjustmentId:
        null,

      sourceKey:
        `checkout:${bId}`,

      notes,
    }
  );
}


/* ============================================================
   CREATE — ROOM CHANGE
============================================================ */

async function createRoomChangeCleaningTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,
    adjustmentId,
    roomId,
    notes = null,
  }
) {
  const adjustment =
    requirePositiveId(
      adjustmentId,
      "adjustmentId"
    );

  const room =
    requirePositiveId(
      roomId,
      "roomId"
    );

  return createTaskWithConnection(
    connection,
    {
      hotelId,
      adminId,

      roomId:
        room,

      taskType:
        TASK_TYPES
          .ROOM_CHANGE,

      bookingId:
        null,

      bookingAdjustmentId:
        adjustment,

      sourceKey:
        `room_change:${adjustment}:${room}`,

      notes,
    }
  );
}


/* ============================================================
   CREATE — MANUAL
============================================================ */

async function createManualCleaningTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,
    roomId,
    notes = null,
  }
) {
  return createTaskWithConnection(
    connection,
    {
      hotelId,
      adminId,
      roomId,

      taskType:
        TASK_TYPES
          .MANUAL,

      bookingId:
        null,

      bookingAdjustmentId:
        null,

      sourceKey:
        null,

      notes,
    }
  );
}


/* ============================================================
   CREATE — RECOVERY

   Used when the room is already Cleaning but the canonical
   active housekeeping task is missing.

   adminId may be NULL for system/reconciliation creation.
============================================================ */

async function createRecoveryCleaningTaskWithConnection(
  connection,
  {
    hotelId,
    adminId = null,
    roomId,
    notes = null,
  }
) {
  return createTaskWithConnection(
    connection,
    {
      hotelId,
      adminId,
      roomId,

      taskType:
        TASK_TYPES
          .RECOVERY,

      bookingId:
        null,

      bookingAdjustmentId:
        null,

      /*
       * Recovery is recurring by nature.
       * active_slot prevents concurrent duplicates.
       */
      sourceKey:
        null,

      notes,
    }
  );
}


/* ============================================================
   STAFF VALIDATION
============================================================ */

async function lockAssignableStaff(
  connection,
  hotelId,
  staffId
) {
  const [[staff]] =
    await connection.query(
      `
        SELECT
          staff_id,
          staff_code,
          full_name,
          department,
          designation,
          status

        FROM staff

        WHERE hotel_id = ?
          AND staff_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        staffId,
      ]
    );

  if (!staff) {
    throwHttp(
      404,
      "HOUSEKEEPING_STAFF_NOT_FOUND",
      "The selected staff member was not found in your hotel."
    );
  }

  if (
    String(
      staff.department ||
      ""
    )
      .trim()
      .toLowerCase() !==
        "housekeeping"
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_STAFF_DEPARTMENT_INVALID",
      "Only Housekeeping department staff can be assigned to housekeeping tasks."
    );
  }

  if (
    staff.status !==
      "Active"
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_STAFF_NOT_ACTIVE",
      "Only active Housekeeping staff can be assigned."
    );
  }

  return staff;
}


/* ============================================================
   ASSIGN / REASSIGN
============================================================ */

async function assignHousekeepingTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,
    taskId,
    staffId,
    notes = null,
  }
) {
  ensureConnection(
    connection
  );

  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  const aId =
    requirePositiveId(
      adminId,
      "adminId"
    );

  const tId =
    requirePositiveId(
      taskId,
      "taskId"
    );

  const sId =
    requirePositiveId(
      staffId,
      "staffId"
    );

  const normalizedNotes =
    optionalText(
      notes,
      "notes"
    );

  const task =
    await getTaskCore(
      connection,
      hId,
      tId,
      {
        forUpdate:
          true,
      }
    );

  if (
    task.task_status ===
      TASK_STATUSES
        .COMPLETED ||

    task.task_status ===
      TASK_STATUSES
        .CANCELLED
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_TASK_TERMINAL",
      "A completed or cancelled housekeeping task cannot be assigned."
    );
  }

  const staff =
    await lockAssignableStaff(
      connection,
      hId,
      sId
    );

  const previousStaffId =
    positiveId(
      task.assigned_staff_id
    );

  /*
   * Duplicate assignment is idempotent.
   */
  if (
    previousStaffId ===
      sId
  ) {
    return {
      changed:
        false,

      task:
        await getTaskContext(
          connection,
          hId,
          tId
        ),
    };
  }

  /*
   * Assignment is orthogonal to task lifecycle.
   *
   * pending stays pending
   * in_progress stays in_progress
   */
  await connection.query(
    `
      UPDATE housekeeping_tasks

      SET
        assigned_staff_id = ?,
        assigned_by_admin_id = ?,
        assigned_at = NOW()

      WHERE hotel_id = ?
        AND housekeeping_task_id = ?
    `,
    [
      sId,
      aId,
      hId,
      tId,
    ]
  );

  await insertEvent(
    connection,
    {
      hotelId:
        hId,

      taskId:
        tId,

      eventType:
        previousStaffId
          ? "reassigned"
          : "assigned",

      fromStatus:
        task.task_status,

      toStatus:
        task.task_status,

      staffId:
        sId,

      adminId:
        aId,

      notes:
        normalizedNotes,
    }
  );

  return {
    changed:
      true,

    assignedStaff: {
      staffId:
        Number(
          staff.staff_id
        ),

      staffCode:
        staff.staff_code,

      fullName:
        staff.full_name,
    },

    task:
      await getTaskContext(
        connection,
        hId,
        tId
      ),
  };
}


/* ============================================================
   UNASSIGN

   Assignment changes never alter task_status.
============================================================ */

async function unassignHousekeepingTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,
    taskId,
    notes = null,
  }
) {
  ensureConnection(
    connection
  );

  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  const aId =
    requirePositiveId(
      adminId,
      "adminId"
    );

  const tId =
    requirePositiveId(
      taskId,
      "taskId"
    );

  const normalizedNotes =
    optionalText(
      notes,
      "notes"
    );

  const task =
    await getTaskCore(
      connection,
      hId,
      tId,
      {
        forUpdate:
          true,
      }
    );

  if (
    task.task_status ===
      TASK_STATUSES
        .COMPLETED ||

    task.task_status ===
      TASK_STATUSES
        .CANCELLED
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_TASK_TERMINAL",
      "A completed or cancelled housekeeping task cannot be unassigned."
    );
  }

  const previousStaffId =
    positiveId(
      task.assigned_staff_id
    );

  if (
    !previousStaffId
  ) {
    return {
      changed:
        false,

      task:
        await getTaskContext(
          connection,
          hId,
          tId
        ),
    };
  }

  await connection.query(
    `
      UPDATE housekeeping_tasks

      SET
        assigned_staff_id = NULL,
        assigned_by_admin_id = NULL,
        assigned_at = NULL

      WHERE hotel_id = ?
        AND housekeeping_task_id = ?
    `,
    [
      hId,
      tId,
    ]
  );

  await insertEvent(
    connection,
    {
      hotelId:
        hId,

      taskId:
        tId,

      eventType:
        "unassigned",

      fromStatus:
        task.task_status,

      toStatus:
        task.task_status,

      /*
       * Preserve the staff member who was removed in the
       * append-only audit event.
       */
      staffId:
        previousStaffId,

      adminId:
        aId,

      notes:
        normalizedNotes,
    }
  );

  return {
    changed:
      true,

    previousAssignedStaffId:
      previousStaffId,

    task:
      await getTaskContext(
        connection,
        hId,
        tId
      ),
  };
}

async function startHousekeepingTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,
    taskId,
    notes = null,
  }
) {
  ensureConnection(
    connection
  );

  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  const aId =
    requirePositiveId(
      adminId,
      "adminId"
    );

  const tId =
    requirePositiveId(
      taskId,
      "taskId"
    );

  const normalizedNotes =
    optionalText(
      notes,
      "notes"
    );

  const task =
    await getTaskCore(
      connection,
      hId,
      tId,
      {
        forUpdate:
          true,
      }
    );

  if (
    task.task_status ===
      TASK_STATUSES
        .IN_PROGRESS
  ) {
    return {
      changed:
        false,

      task:
        await getTaskContext(
          connection,
          hId,
          tId
        ),
    };
  }

  if (
    task.task_status !==
      TASK_STATUSES
        .PENDING
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_START_NOT_ALLOWED",
      "Only a pending housekeeping task can be started."
    );
  }

  /*
   * Pending task can be started without staff assignment.
   *
   * This is required because hotels may currently have
   * zero Housekeeping staff rows.
   */
  await connection.query(
    `
      UPDATE housekeeping_tasks

      SET
        task_status =
          'in_progress',

        started_at =
          NOW()

      WHERE hotel_id = ?
        AND housekeeping_task_id = ?
    `,
    [
      hId,
      tId,
    ]
  );

  await insertEvent(
    connection,
    {
      hotelId:
        hId,

      taskId:
        tId,

      eventType:
        "started",

      fromStatus:
        task.task_status,

      toStatus:
        TASK_STATUSES
          .IN_PROGRESS,

      staffId:
        positiveId(
          task.assigned_staff_id
        ),

      adminId:
        aId,

      notes:
        normalizedNotes,
    }
  );

  return {
    changed:
      true,

    task:
      await getTaskContext(
        connection,
        hId,
        tId
      ),
  };
}


/* ============================================================
   COMPLETE CLEANING

   Room-state rules:

   cleaning
     -> available

   maintenance
     -> maintenance
        Maintenance wins.

   available
     -> available
        Recovery-friendly if room snapshot was already corrected.

   occupied
     -> BLOCK
============================================================ */

async function completeHousekeepingTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,
    taskId,
    completionNotes = null,
  }
) {
  ensureConnection(
    connection
  );

  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  const aId =
    requirePositiveId(
      adminId,
      "adminId"
    );

  const tId =
    requirePositiveId(
      taskId,
      "taskId"
    );

  const normalizedNotes =
    optionalText(
      completionNotes,
      "completionNotes"
    );

  /*
   * First read room_id without row lock.
   *
   * Then lock room BEFORE task.
   *
   * This keeps the same room -> task lock order used
   * during task creation and avoids inverted lock ordering.
   */
  const initialTask =
    await getTaskCore(
      connection,
      hId,
      tId
    );

  if (
    initialTask.task_status ===
      TASK_STATUSES
        .COMPLETED
  ) {
    return {
      changed:
        false,

      roomStatusChanged:
        false,

      task:
        await getTaskContext(
          connection,
          hId,
          tId
        ),
    };
  }

  const room =
    await lockRoom(
      connection,
      hId,
      Number(
        initialTask.room_id
      )
    );

  const task =
    await getTaskCore(
      connection,
      hId,
      tId,
      {
        forUpdate:
          true,
      }
    );

  /*
   * Concurrent duplicate completion.
   */
  if (
    task.task_status ===
      TASK_STATUSES
        .COMPLETED
  ) {
    return {
      changed:
        false,

      roomStatusChanged:
        false,

      task:
        await getTaskContext(
          connection,
          hId,
          tId
        ),
    };
  }

  if (
    task.task_status !==
      TASK_STATUSES
        .IN_PROGRESS
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_COMPLETE_NOT_ALLOWED",
      "Only an in-progress housekeeping task can be completed."
    );
  }

  if (
    room.status ===
      "occupied"
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_ROOM_OCCUPIED",
      "The room is occupied and cannot be released by housekeeping completion."
    );
  }

  if (
    room.status !==
      "cleaning" &&

    room.status !==
      "maintenance" &&

    room.status !==
      "available"
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_ROOM_STATE_INVALID",
      "The room is in an unsupported state for housekeeping completion."
    );
  }

  await connection.query(
    `
      UPDATE housekeeping_tasks

      SET
        task_status =
          'completed',

        active_slot =
          NULL,

        completed_by_admin_id =
          ?,

        completed_at =
          NOW(),

        completion_notes =
          ?

      WHERE hotel_id = ?
        AND housekeeping_task_id = ?
    `,
    [
      aId,
      normalizedNotes,
      hId,
      tId,
    ]
  );

  let roomStatusChanged =
    false;

  let resultingRoomStatus =
    room.status;

  /*
   * Housekeeping may only release a room which is still
   * physically in Cleaning state.
   */
  if (
    room.status ===
      "cleaning"
  ) {
    await connection.query(
      `
        UPDATE rooms

        SET status =
          'available'

        WHERE hotel_id = ?
          AND room_id = ?
          AND status =
            'cleaning'
      `,
      [
        hId,
        Number(
          task.room_id
        ),
      ]
    );

    roomStatusChanged =
      true;

    resultingRoomStatus =
      "available";
  }

  /*
   * Maintenance wins.
   *
   * Cleaning can be recorded complete while room stays
   * unavailable for maintenance.
   */
  const eventNotes =
    room.status ===
      "maintenance"
      ? [
          normalizedNotes,
          "Cleaning completed; room remains under maintenance.",
        ]
          .filter(
            Boolean
          )
          .join(
            " "
          )
      : normalizedNotes;

  await insertEvent(
    connection,
    {
      hotelId:
        hId,

      taskId:
        tId,

      eventType:
        "completed",

      fromStatus:
        TASK_STATUSES
          .IN_PROGRESS,

      toStatus:
        TASK_STATUSES
          .COMPLETED,

      staffId:
        positiveId(
          task.assigned_staff_id
        ),

      adminId:
        aId,

      notes:
        eventNotes,
    }
  );

  return {
    changed:
      true,

    roomStatusChanged,

    resultingRoomStatus,

    task:
      await getTaskContext(
        connection,
        hId,
        tId
      ),
  };
}


/* ============================================================
   CANCEL TASK

   Deliberate safety rule:
   cancellation NEVER marks room available.

   If room remains cleaning after cancellation, Admin or the
   reconciliation flow can create a recovery cleaning task.

   This prevents "cancel task" from accidentally releasing an
   unclean room.
============================================================ */

async function cancelHousekeepingTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,
    taskId,
    cancellationReason,
  }
) {
  ensureConnection(
    connection
  );

  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  const aId =
    requirePositiveId(
      adminId,
      "adminId"
    );

  const tId =
    requirePositiveId(
      taskId,
      "taskId"
    );

  const reason =
    requiredText(
      cancellationReason,
      "cancellationReason"
    );

  const task =
    await getTaskCore(
      connection,
      hId,
      tId,
      {
        forUpdate:
          true,
      }
    );

  if (
    task.task_status ===
      TASK_STATUSES
        .CANCELLED
  ) {
    return {
      changed:
        false,

      task:
        await getTaskContext(
          connection,
          hId,
          tId
        ),
    };
  }

  if (
    task.task_status !==
      TASK_STATUSES
        .PENDING &&

    task.task_status !==
      TASK_STATUSES
        .IN_PROGRESS
  ) {
    throwHttp(
      409,
      "HOUSEKEEPING_CANCEL_NOT_ALLOWED",
      "Only a pending or in-progress housekeeping task can be cancelled."
    );
  }

  await connection.query(
    `
      UPDATE housekeeping_tasks

      SET
        task_status =
          'cancelled',

        active_slot =
          NULL,

        cancelled_by_admin_id =
          ?,

        cancelled_at =
          NOW(),

        cancellation_reason =
          ?

      WHERE hotel_id = ?
        AND housekeeping_task_id = ?
    `,
    [
      aId,
      reason,
      hId,
      tId,
    ]
  );

  await insertEvent(
    connection,
    {
      hotelId:
        hId,

      taskId:
        tId,

      eventType:
        "cancelled",

      fromStatus:
        task.task_status,

      toStatus:
        TASK_STATUSES
          .CANCELLED,

      staffId:
        positiveId(
          task.assigned_staff_id
        ),

      adminId:
        aId,

      notes:
        reason,
    }
  );

  return {
    changed:
      true,

    roomStatusUnchanged:
      true,

    task:
      await getTaskContext(
        connection,
        hId,
        tId
      ),
  };
}


/* ============================================================
   ADD APPEND-ONLY NOTE
============================================================ */

async function addHousekeepingTaskNoteWithConnection(
  connection,
  {
    hotelId,
    adminId,
    taskId,
    note,
  }
) {
  ensureConnection(
    connection
  );

  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  const aId =
    requirePositiveId(
      adminId,
      "adminId"
    );

  const tId =
    requirePositiveId(
      taskId,
      "taskId"
    );

  const normalizedNote =
    requiredText(
      note,
      "note"
    );

  const task =
    await getTaskCore(
      connection,
      hId,
      tId,
      {
        forUpdate:
          true,
      }
    );

  await insertEvent(
    connection,
    {
      hotelId:
        hId,

      taskId:
        tId,

      eventType:
        "note_added",

      fromStatus:
        task.task_status,

      toStatus:
        task.task_status,

      staffId:
        positiveId(
          task.assigned_staff_id
        ),

      adminId:
        aId,

      notes:
        normalizedNote,
    }
  );

  return {
    task:
      await getTaskContext(
        connection,
        hId,
        tId
      ),
  };
}


/* ============================================================
   LIST TASKS
============================================================ */

async function listHousekeepingTasks({
  hotelId,

  status = null,
  taskType = null,

  roomId = null,
  staffId = null,

  search = null,

  page = 1,
  pageSize = 25,
}) {
  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  const normalizedPage =
    normalizePage(
      page
    );

  const normalizedPageSize =
    normalizePageSize(
      pageSize
    );

  const offset =
    (
      normalizedPage -
      1
    ) *
    normalizedPageSize;

  const where = [
    "ht.hotel_id = ?",
  ];

  const params = [
    hId,
  ];

  if (
    status
  ) {
    const normalizedStatus =
      String(
        status
      ).trim();

    if (
      !VALID_TASK_STATUSES.has(
        normalizedStatus
      )
    ) {
      throwHttp(
        400,
        "INVALID_HOUSEKEEPING_STATUS",
        "The housekeeping status filter is invalid."
      );
    }

    where.push(
      "ht.task_status = ?"
    );

    params.push(
      normalizedStatus
    );
  }

  if (
    taskType
  ) {
    const normalizedType =
      String(
        taskType
      ).trim();

    if (
      !VALID_TASK_TYPES.has(
        normalizedType
      )
    ) {
      throwHttp(
        400,
        "INVALID_HOUSEKEEPING_TASK_TYPE",
        "The housekeeping task-type filter is invalid."
      );
    }

    where.push(
      "ht.task_type = ?"
    );

    params.push(
      normalizedType
    );
  }

  if (
    roomId !== null &&
    roomId !== undefined &&
    roomId !== ""
  ) {
    const rId =
      requirePositiveId(
        roomId,
        "roomId"
      );

    where.push(
      "ht.room_id = ?"
    );

    params.push(
      rId
    );
  }

  if (
    staffId !== null &&
    staffId !== undefined &&
    staffId !== ""
  ) {
    const sId =
      requirePositiveId(
        staffId,
        "staffId"
      );

    where.push(
      "ht.assigned_staff_id = ?"
    );

    params.push(
      sId
    );
  }

  const normalizedSearch =
    optionalText(
      search,
      "search",
      120
    );

  if (
    normalizedSearch
  ) {
    const like =
      `%${normalizedSearch}%`;

    where.push(
      `(
        r.room_number LIKE ?
        OR b.booking_code LIKE ?
        OR s.full_name LIKE ?
        OR s.staff_code LIKE ?
      )`
    );

    params.push(
      like,
      like,
      like,
      like
    );
  }

  const whereSql =
    where.join(
      " AND "
    );

  const [[countRow]] =
    await db.query(
      `
        SELECT
          COUNT(*) AS total

        FROM housekeeping_tasks ht

        INNER JOIN rooms r
          ON r.hotel_id =
            ht.hotel_id

         AND r.room_id =
            ht.room_id

        LEFT JOIN bookings b
          ON b.hotel_id =
            ht.hotel_id

         AND b.booking_id =
            ht.booking_id

        LEFT JOIN staff s
          ON s.hotel_id =
            ht.hotel_id

         AND s.staff_id =
            ht.assigned_staff_id

        WHERE ${whereSql}
      `,
      params
    );

  const [items] =
    await db.query(
      `
        SELECT
          ht.housekeeping_task_id
            AS housekeepingTaskId,

          ht.room_id
            AS roomId,

          r.room_number
            AS roomNumber,

          r.room_type
            AS roomType,

          r.status
            AS roomStatus,

          ht.booking_id
            AS bookingId,

          b.booking_code
            AS bookingCode,

          ht.booking_adjustment_id
            AS bookingAdjustmentId,

          ht.task_type
            AS taskType,

          ht.task_status
            AS taskStatus,

          ht.assigned_staff_id
            AS assignedStaffId,

          s.staff_code
            AS assignedStaffCode,

          s.full_name
            AS assignedStaffName,

          ht.started_at
            AS startedAt,

          ht.completed_at
            AS completedAt,

          ht.cancelled_at
            AS cancelledAt,

          ht.created_at
            AS createdAt,

          ht.updated_at
            AS updatedAt

        FROM housekeeping_tasks ht

        INNER JOIN rooms r
          ON r.hotel_id =
            ht.hotel_id

         AND r.room_id =
            ht.room_id

        LEFT JOIN bookings b
          ON b.hotel_id =
            ht.hotel_id

         AND b.booking_id =
            ht.booking_id

        LEFT JOIN staff s
          ON s.hotel_id =
            ht.hotel_id

         AND s.staff_id =
            ht.assigned_staff_id

        WHERE ${whereSql}

        ORDER BY
          CASE
            ht.task_status

            WHEN 'in_progress'
              THEN 1

            WHEN 'pending'
              THEN 2

            WHEN 'completed'
              THEN 3

            WHEN 'cancelled'
              THEN 4

            ELSE 5
          END,

          ht.created_at DESC,

          ht.housekeeping_task_id DESC

        LIMIT ?
        OFFSET ?
      `,
      [
        ...params,
        normalizedPageSize,
        offset,
      ]
    );

  const total =
    Number(
      countRow.total ||
      0
    );

  return {
    items,

    pagination: {
      page:
        normalizedPage,

      pageSize:
        normalizedPageSize,

      total,

      totalPages:
        total === 0
          ? 0
          : Math.ceil(
              total /
              normalizedPageSize
            ),
    },
  };
}


/* ============================================================
   TASK DETAIL + EVENTS
============================================================ */

async function getHousekeepingTaskById({
  hotelId,
  taskId,
}) {
  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  const tId =
    requirePositiveId(
      taskId,
      "taskId"
    );

  const task =
    await getTaskContext(
      db,
      hId,
      tId
    );

  const [events] =
    await db.query(
      `
        SELECT
          e.housekeeping_event_id
            AS housekeepingEventId,

          e.event_type
            AS eventType,

          e.from_status
            AS fromStatus,

          e.to_status
            AS toStatus,

          e.staff_id
            AS staffId,

          s.staff_code
            AS staffCode,

          s.full_name
            AS staffName,

          e.admin_id
            AS adminId,

          a.full_name
            AS adminName,

          e.notes,

          e.created_at
            AS createdAt

        FROM housekeeping_task_events e

        LEFT JOIN staff s
          ON s.hotel_id =
            e.hotel_id

         AND s.staff_id =
            e.staff_id

        LEFT JOIN admins a
          ON a.hotel_id =
            e.hotel_id

         AND a.admin_id =
            e.admin_id

        WHERE e.hotel_id = ?
          AND e.housekeeping_task_id = ?

        ORDER BY
          e.created_at ASC,
          e.housekeeping_event_id ASC
      `,
      [
        hId,
        tId,
      ]
    );

  return {
    ...task,
    events,
  };
}


/* ============================================================
   ASSIGNABLE HOUSEKEEPING STAFF
============================================================ */

async function listAssignableHousekeepingStaff({
  hotelId,
}) {
  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  const [rows] =
    await db.query(
      `
        SELECT
          staff_id
            AS staffId,

          staff_code
            AS staffCode,

          full_name
            AS fullName,

          department,
          designation,
          status

        FROM staff

        WHERE hotel_id = ?

          AND LOWER(
                TRIM(
                  department
                )
              ) =
              'housekeeping'

          AND status =
            'Active'

        ORDER BY
          full_name ASC,
          staff_id ASC
      `,
      [
        hId,
      ]
    );

  return rows;
}


/* ============================================================
   ROOM HOUSEKEEPING HISTORY

   This will later be consumed by Room Details without
   duplicating housekeeping history into rooms.
============================================================ */

async function getRoomHousekeepingHistory({
  hotelId,
  roomId,
  limit = 50,
}) {
  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );

  const rId =
    requirePositiveId(
      roomId,
      "roomId"
    );

  const parsedLimit =
    Number.parseInt(
      limit,
      10
    );

  const safeLimit =
    Number.isInteger(
      parsedLimit
    ) &&
    parsedLimit > 0
      ? Math.min(
          parsedLimit,
          100
        )
      : 50;

  const [rows] =
    await db.query(
      `
        SELECT
          ht.housekeeping_task_id
            AS housekeepingTaskId,

          ht.task_type
            AS taskType,

          ht.task_status
            AS taskStatus,

          ht.booking_id
            AS bookingId,

          b.booking_code
            AS bookingCode,

          ht.booking_adjustment_id
            AS bookingAdjustmentId,

          ht.assigned_staff_id
            AS assignedStaffId,

          s.staff_code
            AS assignedStaffCode,

          s.full_name
            AS assignedStaffName,

          ht.started_at
            AS startedAt,

          ht.completed_at
            AS completedAt,

          ht.cancelled_at
            AS cancelledAt,

          ht.notes,

          ht.completion_notes
            AS completionNotes,

          ht.cancellation_reason
            AS cancellationReason,

          ht.created_at
            AS createdAt

        FROM housekeeping_tasks ht

        LEFT JOIN bookings b
          ON b.hotel_id =
            ht.hotel_id

         AND b.booking_id =
            ht.booking_id

        LEFT JOIN staff s
          ON s.hotel_id =
            ht.hotel_id

         AND s.staff_id =
            ht.assigned_staff_id

        WHERE ht.hotel_id = ?
          AND ht.room_id = ?

        ORDER BY
          ht.created_at DESC,
          ht.housekeeping_task_id DESC

        LIMIT ?
      `,
      [
        hId,
        rId,
        safeLimit,
      ]
    );

  return rows;
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  TASK_TYPES,
  TASK_STATUSES,

  createCheckoutCleaningTaskWithConnection,
  createRoomChangeCleaningTaskWithConnection,
  createManualCleaningTaskWithConnection,
  createRecoveryCleaningTaskWithConnection,

  assignHousekeepingTaskWithConnection,
  unassignHousekeepingTaskWithConnection,
  startHousekeepingTaskWithConnection,
  completeHousekeepingTaskWithConnection,
  cancelHousekeepingTaskWithConnection,

  addHousekeepingTaskNoteWithConnection,

  listHousekeepingTasks,
  getHousekeepingTaskById,

  listAssignableHousekeepingStaff,

  getRoomHousekeepingHistory,
};
