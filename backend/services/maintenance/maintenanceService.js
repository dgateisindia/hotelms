"use strict";

const db =
  require("../../config/db").promisePool;

const {
  createRecoveryCleaningTaskWithConnection,
} = require(
  "../housekeeping/housekeepingService"
);


/* ============================================================
   CONSTANTS
============================================================ */

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


const ACTIVE_TASK_STATUSES =
  new Set([
    TASK_STATUSES.PENDING,
    TASK_STATUSES.IN_PROGRESS,
  ]);


const PRIORITIES =
  Object.freeze({
    LOW:
      "low",

    MEDIUM:
      "medium",

    HIGH:
      "high",

    URGENT:
      "urgent",
  });


const VALID_PRIORITIES =
  new Set(
    Object.values(
      PRIORITIES
    )
  );


const SOURCE_TYPES =
  Object.freeze({
    MANUAL:
      "manual",

    PERMANENT_ROOM_CHANGE:
      "permanent_room_change",

    TEMPORARY_ROOM_CHANGE:
      "temporary_room_change",

    RECOVERY:
      "recovery",
  });


const BOOKING_SOURCE_TYPES =
  new Set([
    SOURCE_TYPES
      .PERMANENT_ROOM_CHANGE,

    SOURCE_TYPES
      .TEMPORARY_ROOM_CHANGE,
  ]);


const VALID_SOURCE_TYPES =
  new Set(
    Object.values(
      SOURCE_TYPES
    )
  );


const RELEASE_STATUSES =
  Object.freeze({
    AVAILABLE:
      "available",

    CLEANING:
      "cleaning",
  });


const VALID_RELEASE_STATUSES =
  new Set(
    Object.values(
      RELEASE_STATUSES
    )
  );


const DEFAULT_PAGE_SIZE =
  20;

const MAX_PAGE_SIZE =
  100;


/* ============================================================
   ERROR / VALIDATION HELPERS
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

  error.code =
    code;

  throw error;
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
      "A valid database connection is required."
    );
  }
}


function positiveId(
  value
) {

  const number =
    Number(value);


  if (
    !Number.isSafeInteger(
      number
    ) ||
    number <= 0
  ) {

    return null;
  }


  return number;
}


function requirePositiveId(
  value,
  fieldName
) {

  const id =
    positiveId(
      value
    );


  if (!id) {

    throwHttp(
      400,
      "MAINTENANCE_INVALID_ID",
      `${fieldName} must be a valid positive integer.`
    );
  }


  return id;
}


function normalizeText(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";
  }


  return String(
    value
  ).trim();
}


function requiredText(
  value,
  fieldName,
  maxLength
) {

  const normalized =
    normalizeText(
      value
    );


  if (!normalized) {

    throwHttp(
      400,
      "MAINTENANCE_REQUIRED_FIELD",
      `${fieldName} is required.`
    );
  }


  if (
    normalized.length >
    maxLength
  ) {

    throwHttp(
      400,
      "MAINTENANCE_TEXT_TOO_LONG",
      `${fieldName} must not exceed ${maxLength} characters.`
    );
  }


  return normalized;
}


function optionalText(
  value,
  fieldName,
  maxLength
) {

  const normalized =
    normalizeText(
      value
    );


  if (!normalized) {
    return null;
  }


  if (
    normalized.length >
    maxLength
  ) {

    throwHttp(
      400,
      "MAINTENANCE_TEXT_TOO_LONG",
      `${fieldName} must not exceed ${maxLength} characters.`
    );
  }


  return normalized;
}


function normalizePriority(
  value
) {

  const normalized =
    normalizeText(
      value ||
      PRIORITIES.MEDIUM
    ).toLowerCase();


  if (
    !VALID_PRIORITIES.has(
      normalized
    )
  ) {

    throwHttp(
      400,
      "MAINTENANCE_PRIORITY_INVALID",
      "Priority must be low, medium, high, or urgent."
    );
  }


  return normalized;
}


function normalizeReleaseStatus(
  value
) {

  const normalized =
    normalizeText(
      value
    ).toLowerCase();


  if (
    !VALID_RELEASE_STATUSES
      .has(
        normalized
      )
  ) {

    throwHttp(
      400,
      "MAINTENANCE_RELEASE_STATUS_INVALID",
      "Release status must be available or cleaning."
    );
  }


  return normalized;
}


function normalizeSourceType(
  value
) {

  const normalized =
    normalizeText(
      value
    ).toLowerCase();


  if (
    !VALID_SOURCE_TYPES.has(
      normalized
    )
  ) {

    throwHttp(
      400,
      "MAINTENANCE_SOURCE_TYPE_INVALID",
      "The maintenance source type is invalid."
    );
  }


  return normalized;
}


function parsePage(
  value
) {

  const parsed =
    Number.parseInt(
      value,
      10
    );


  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < 1
  ) {

    return 1;
  }


  return parsed;
}


function parsePageSize(
  value
) {

  const parsed =
    Number.parseInt(
      value,
      10
    );


  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < 1
  ) {

    return DEFAULT_PAGE_SIZE;
  }


  return Math.min(
    parsed,
    MAX_PAGE_SIZE
  );
}


/* ============================================================
   ROW MAPPERS
============================================================ */

function mapTaskRow(
  row
) {

  if (!row) {
    return null;
  }


  return {
    maintenanceTaskId:
      Number(
        row.maintenance_task_id
      ),

    hotelId:
      Number(
        row.hotel_id
      ),

    roomId:
      Number(
        row.room_id
      ),

    roomNumber:
      row.room_number ??
      null,

    roomType:
      row.room_type ??
      null,

    roomStatus:
      row.room_status ??
      null,

    bookingId:
      row.booking_id ===
        null
        ? null
        : Number(
            row.booking_id
          ),

    bookingAdjustmentId:
      row.booking_adjustment_id ===
        null
        ? null
        : Number(
            row.booking_adjustment_id
          ),

    sourceType:
      row.source_type,

    sourceKey:
      row.source_key,

    issueTitle:
      row.issue_title,

    issueDescription:
      row.issue_description,

    priority:
      row.priority,

    taskStatus:
      row.task_status,

    activeSlot:
      row.active_slot ===
        null
        ? null
        : Number(
            row.active_slot
          ),

    releaseStatus:
      row.release_status,

    assignedStaffId:
      row.assigned_staff_id ===
        null
        ? null
        : Number(
            row.assigned_staff_id
          ),

    assignedStaffCode:
      row.assigned_staff_code ??
      null,

    assignedStaffName:
      row.assigned_staff_name ??
      null,

    assignedStaffDepartment:
      row.assigned_staff_department ??
      null,

    assignedStaffStatus:
      row.assigned_staff_status ??
      null,

    createdByAdminId:
      row.created_by_admin_id ===
        null
        ? null
        : Number(
            row.created_by_admin_id
          ),

    assignedByAdminId:
      row.assigned_by_admin_id ===
        null
        ? null
        : Number(
            row.assigned_by_admin_id
          ),

    completedByAdminId:
      row.completed_by_admin_id ===
        null
        ? null
        : Number(
            row.completed_by_admin_id
          ),

    cancelledByAdminId:
      row.cancelled_by_admin_id ===
        null
        ? null
        : Number(
            row.cancelled_by_admin_id
          ),

    assignedAt:
      row.assigned_at,

    startedAt:
      row.started_at,

    completedAt:
      row.completed_at,

    cancelledAt:
      row.cancelled_at,

    resolutionNotes:
      row.resolution_notes,

    cancellationReason:
      row.cancellation_reason,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


function mapEventRow(
  row
) {

  return {
    maintenanceEventId:
      Number(
        row.maintenance_event_id
      ),

    eventType:
      row.event_type,

    fromStatus:
      row.from_status,

    toStatus:
      row.to_status,

    staffId:
      row.staff_id ===
        null
        ? null
        : Number(
            row.staff_id
          ),

    staffCode:
      row.staff_code ??
      null,

    staffName:
      row.staff_name ??
      null,

    adminId:
      row.admin_id ===
        null
        ? null
        : Number(
            row.admin_id
          ),

    notes:
      row.notes,

    createdAt:
      row.created_at,
  };
}


/* ============================================================
   LOCKED LOOKUPS
============================================================ */

async function getLockedRoom(
  connection,
  hotelId,
  roomId
) {

  const [[room]] =
    await connection.query(
      `
        SELECT
          room_id,
          hotel_id,
          room_number,
          room_type,
          status
        FROM rooms
        WHERE hotel_id = ?
          AND room_id = ?
        LIMIT 1
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
      "MAINTENANCE_ROOM_NOT_FOUND",
      "The room was not found in your hotel."
    );
  }


  return room;
}


async function getLockedTask(
  connection,
  hotelId,
  taskId
) {

  /*
   * Deliberate concurrency order:
   *
   *   room -> maintenance task
   *
   * First discover the task's room without taking a task row
   * lock. Then lock the room. Only after that do we lock the
   * maintenance task itself.
   *
   * This matches the room-first discipline used by the
   * Housekeeping lifecycle and prevents task->room versus
   * room->task inversion with Maintenance creation.
   */
  const [[initialTask]] =
    await connection.query(
      `
        SELECT
          maintenance_task_id,
          room_id
        FROM maintenance_tasks
        WHERE hotel_id = ?
          AND maintenance_task_id = ?
        LIMIT 1
      `,
      [
        hotelId,
        taskId,
      ]
    );


  if (!initialTask) {

    throwHttp(
      404,
      "MAINTENANCE_TASK_NOT_FOUND",
      "The maintenance task was not found."
    );
  }


  const initialRoomId =
    positiveId(
      initialTask.room_id
    );


  if (!initialRoomId) {

    throwHttp(
      409,
      "MAINTENANCE_TASK_ROOM_INVALID",
      "The maintenance task is not linked to a valid room."
    );
  }


  /*
   * Acquire the authoritative room row lock first.
   */
  await getLockedRoom(
    connection,
    hotelId,
    initialRoomId
  );


  /*
   * Then acquire the Maintenance task row lock.
   */
  const [[task]] =
    await connection.query(
      `
        SELECT
          *
        FROM maintenance_tasks
        WHERE hotel_id = ?
          AND maintenance_task_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [
        hotelId,
        taskId,
      ]
    );


  if (!task) {

    throwHttp(
      404,
      "MAINTENANCE_TASK_NOT_FOUND",
      "The maintenance task was not found."
    );
  }


  if (
    Number(
      task.room_id
    ) !==
      initialRoomId
  ) {

    throwHttp(
      409,
      "MAINTENANCE_TASK_ROOM_CHANGED",
      "The maintenance task room changed while the task was being locked."
    );
  }


  return task;
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
          *
        FROM maintenance_tasks
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


  return (
    task ||
    null
  );
}


async function findTaskBySourceKey(
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
          *
        FROM maintenance_tasks
        WHERE hotel_id = ?
          AND source_key = ?
        LIMIT 1
      `,
      [
        hotelId,
        sourceKey,
      ]
    );


  return (
    task ||
    null
  );
}

async function findTaskBySourceKeyForUpdate(
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
          *
        FROM maintenance_tasks
        WHERE hotel_id = ?
          AND source_key = ?
        LIMIT 1
        FOR UPDATE
      `,
      [
        hotelId,
        sourceKey,
      ]
    );


  return (
    task ||
    null
  );
}


/* ============================================================
   ROOM OCCUPANCY SAFETY
============================================================ */

async function assertRoomNotActivelyOccupied(
  connection,
  hotelId,
  roomId
) {

  const [[historyBooking]] =
    await connection.query(
      `
        SELECT
          h.booking_id
        FROM booking_room_history h

        INNER JOIN bookings b
          ON b.hotel_id =
            h.hotel_id
         AND b.booking_id =
            h.booking_id

        WHERE h.hotel_id = ?
          AND h.room_id = ?
          AND h.assignment_status =
            'active'
          AND b.booking_status =
            'checked_in'

        LIMIT 1
        FOR UPDATE
      `,
      [
        hotelId,
        roomId,
      ]
    );


  if (historyBooking) {

    throwHttp(
      409,
      "MAINTENANCE_ROOM_OCCUPIED",
      "The room still has an active checked-in room assignment."
    );
  }


  /*
   * Legacy safety fallback for any checked-in booking which may
   * not yet have authoritative room-history coverage.
   */
  const [[legacyBooking]] =
    await connection.query(
      `
        SELECT
          booking_id
        FROM bookings
        WHERE hotel_id = ?
          AND room_id = ?
          AND booking_status =
            'checked_in'
        LIMIT 1
        FOR UPDATE
      `,
      [
        hotelId,
        roomId,
      ]
    );


  if (legacyBooking) {

    throwHttp(
      409,
      "MAINTENANCE_ROOM_OCCUPIED",
      "The room is still assigned to a checked-in booking."
    );
  }
}


/* ============================================================
   SOURCE VALIDATION
============================================================ */

async function validateBookingSource(
  connection,
  {
    hotelId,
    roomId,
    bookingId,
    bookingAdjustmentId,
    sourceType,
  }
) {

  const expectedMode =
    sourceType ===
      SOURCE_TYPES.PERMANENT_ROOM_CHANGE
      ? "permanent"
      : sourceType ===
          SOURCE_TYPES.TEMPORARY_ROOM_CHANGE
        ? "temporary"
        : null;


  if (!expectedMode) {

    throwHttp(
      400,
      "MAINTENANCE_BOOKING_SOURCE_INVALID",
      "Booking-origin maintenance requires a permanent or temporary room-change source."
    );
  }


  const [[adjustment]] =
    await connection.query(
      `
        SELECT
          adjustment_id,
          booking_id,
          adjustment_type,
          room_change_mode,
          original_room_id,
          replacement_room_id,
          room_change_status,
          reason
        FROM booking_adjustments
        WHERE hotel_id = ?
          AND adjustment_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [
        hotelId,
        bookingAdjustmentId,
      ]
    );


  if (!adjustment) {

    throwHttp(
      409,
      "MAINTENANCE_BOOKING_ADJUSTMENT_NOT_FOUND",
      "The room-change adjustment could not be verified."
    );
  }


  /*
   * Identity check:
   * the adjustment must belong to the exact booking and
   * released/original room supplied by the booking workflow.
   */
  if (
    Number(
      adjustment.booking_id
    ) !== bookingId ||
    Number(
      adjustment.original_room_id
    ) !== roomId
  ) {

    throwHttp(
      409,
      "MAINTENANCE_BOOKING_SOURCE_MISMATCH",
      "The maintenance source does not match the booking room-change record."
    );
  }


  /*
   * Semantic check:
   *
   * A booking-linked Maintenance task must NEVER be generated
   * from an unrelated adjustment, non-maintenance room change,
   * or the wrong permanent/temporary workflow.
   */
  const replacementRoomId =
    positiveId(
      adjustment.replacement_room_id
    );


  if (
    adjustment.adjustment_type !==
      "room_change" ||

    adjustment.room_change_mode !==
      expectedMode ||

    adjustment.reason !==
      "maintenance" ||

    !replacementRoomId
  ) {

    throwHttp(
      409,
      "MAINTENANCE_BOOKING_SEMANTIC_MISMATCH",
      "The booking adjustment is not a matching Maintenance room-change source."
    );
  }


  return adjustment;
}


/* ============================================================
   EVENT INSERT
============================================================ */

async function insertEvent(
  connection,
  {
    hotelId,
    taskId,
    eventType,
    fromStatus,
    toStatus,
    staffId = null,
    adminId = null,
    notes = null,
  }
) {

  await connection.query(
    `
      INSERT INTO
        maintenance_task_events
      (
        hotel_id,
        maintenance_task_id,
        event_type,
        from_status,
        to_status,
        staff_id,
        admin_id,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
   TASK CONTEXT
============================================================ */

async function getTaskContextWithConnection(
  connection,
  hotelId,
  taskId
) {

  ensureConnection(
    connection
  );


  const [[row]] =
    await connection.query(
      `
        SELECT
          mt.*,

          r.room_number,
          r.room_type,
          r.status
            AS room_status,

          s.staff_code
            AS assigned_staff_code,

          s.full_name
            AS assigned_staff_name,

          s.department
            AS assigned_staff_department,

          s.status
            AS assigned_staff_status

        FROM maintenance_tasks mt

        INNER JOIN rooms r
          ON r.hotel_id =
            mt.hotel_id
         AND r.room_id =
            mt.room_id

        LEFT JOIN staff s
          ON s.hotel_id =
            mt.hotel_id
         AND s.staff_id =
            mt.assigned_staff_id

        WHERE mt.hotel_id = ?
          AND mt.maintenance_task_id = ?

        LIMIT 1
      `,
      [
        hotelId,
        taskId,
      ]
    );


  if (!row) {

    throwHttp(
      404,
      "MAINTENANCE_TASK_NOT_FOUND",
      "The maintenance task was not found."
    );
  }


  return mapTaskRow(
    row
  );
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

    sourceType,

    bookingId = null,
    bookingAdjustmentId = null,

    sourceKey = null,

    issueTitle,
    issueDescription = null,

    priority =
      PRIORITIES.MEDIUM,

    releaseStatus = null,
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

  const rId =
    requirePositiveId(
      roomId,
      "roomId"
    );

  const source =
    normalizeSourceType(
      sourceType
    );

  const normalizedPriority =
    normalizePriority(
      priority
    );

  const normalizedTitle =
    requiredText(
      issueTitle,
      "issueTitle",
      150
    );

  const normalizedDescription =
    optionalText(
      issueDescription,
      "issueDescription",
      1000
    );


  const aId =
    (
      source ===
        SOURCE_TYPES.RECOVERY &&
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


  let bId =
    null;

  let adjustmentId =
    null;


  if (
    BOOKING_SOURCE_TYPES.has(
      source
    )
  ) {

    bId =
      requirePositiveId(
        bookingId,
        "bookingId"
      );

    adjustmentId =
      requirePositiveId(
        bookingAdjustmentId,
        "bookingAdjustmentId"
      );
  }


  const normalizedSourceKey =
    optionalText(
      sourceKey,
      "sourceKey",
      120
    );


  /*
   * Deterministic booking source keys make retry behavior
   * idempotent.
   */
  if (normalizedSourceKey) {

    const existingBySource =
      await findTaskBySourceKey(
        connection,
        hId,
        normalizedSourceKey
      );


    if (existingBySource) {

      const sameSource =
        Number(
          existingBySource.room_id
        ) === rId &&
        existingBySource
          .source_type === source &&
        (
          existingBySource.booking_id ===
            null
            ? bId === null
            : Number(
                existingBySource.booking_id
              ) === bId
        ) &&
        (
          existingBySource
            .booking_adjustment_id ===
              null
            ? adjustmentId ===
                null
            : Number(
                existingBySource
                  .booking_adjustment_id
              ) === adjustmentId
        );


      if (!sameSource) {

        throwHttp(
          409,
          "MAINTENANCE_SOURCE_KEY_CONFLICT",
          "The maintenance source key is already linked to a different task."
        );
      }


      return {
        created:
          false,

        idempotent:
          true,

        task:
          await getTaskContextWithConnection(
            connection,
            hId,
            Number(
              existingBySource
                .maintenance_task_id
            )
          ),
      };
    }
  }


  const room =
    await getLockedRoom(
      connection,
      hId,
      rId
    );


  /*
   * Second idempotency check AFTER the room lock.
   *
   * Why this exists:
   *
   * Transaction A and Transaction B may both miss the initial
   * non-locking source-key preflight.
   *
   * Transaction A:
   *   room lock -> INSERT -> COMMIT
   *
   * Transaction B:
   *   waits for room lock
   *
   * Once B obtains the room lock, it must re-check source_key
   * before treating A's task as an unrelated active-task
   * conflict.
   *
   * This makes concurrent retries of the exact same booking
   * room-change operation return the canonical existing task
   * instead of MAINTENANCE_ACTIVE_TASK_EXISTS.
   */
  if (normalizedSourceKey) {

    const existingAfterRoomLock =
      await findTaskBySourceKeyForUpdate(
        connection,
        hId,
        normalizedSourceKey
      );


    if (existingAfterRoomLock) {

      const sameSource =
        Number(
          existingAfterRoomLock.room_id
        ) === rId &&
        existingAfterRoomLock
          .source_type === source &&
        (
          existingAfterRoomLock.booking_id ===
            null
            ? bId === null
            : Number(
                existingAfterRoomLock.booking_id
              ) === bId
        ) &&
        (
          existingAfterRoomLock
            .booking_adjustment_id ===
              null
            ? adjustmentId ===
                null
            : Number(
                existingAfterRoomLock
                  .booking_adjustment_id
              ) === adjustmentId
        );


      if (!sameSource) {

        throwHttp(
          409,
          "MAINTENANCE_SOURCE_KEY_CONFLICT",
          "The maintenance source key is already linked to a different task."
        );
      }


      return {
        created:
          false,

        idempotent:
          true,

        task:
          await getTaskContextWithConnection(
            connection,
            hId,
            Number(
              existingAfterRoomLock
                .maintenance_task_id
            )
          ),
      };
    }
  }


  const activeTask =
    await findActiveTaskForRoomForUpdate(
      connection,
      hId,
      rId
    );


  if (activeTask) {

    throwHttp(
      409,
      "MAINTENANCE_ACTIVE_TASK_EXISTS",
      `Room ${room.room_number} already has an active maintenance task.`
    );
  }


  let resolvedReleaseStatus =
    null;


  if (
    source ===
      SOURCE_TYPES.MANUAL
  ) {

    if (
      room.status !==
        "available" &&
      room.status !==
        "cleaning"
    ) {

      throwHttp(
        409,
        "MAINTENANCE_MANUAL_ROOM_STATE_INVALID",
        "Manual maintenance can only start for an Available or Cleaning room."
      );
    }


    await assertRoomNotActivelyOccupied(
      connection,
      hId,
      rId
    );


    resolvedReleaseStatus =
      room.status ===
        "cleaning"
        ? RELEASE_STATUSES
            .CLEANING
        : RELEASE_STATUSES
            .AVAILABLE;
  }
  else if (
    BOOKING_SOURCE_TYPES.has(
      source
    )
  ) {

    /*
     * Booking room-change maintenance is created from inside
     * the booking transaction after the guest has been moved.
     *
     * The room snapshot may still be Occupied until this
     * authoritative maintenance transition executes.
     */
    if (
      ![
        "occupied",
        "cleaning",
        "available",
      ].includes(
        room.status
      )
    ) {

      throwHttp(
        409,
        "MAINTENANCE_BOOKING_ROOM_STATE_INVALID",
        "The released room is not in a valid state for booking-origin maintenance."
      );
    }


    await validateBookingSource(
      connection,
      {
        hotelId:
          hId,

        roomId:
          rId,

        bookingId:
          bId,

        bookingAdjustmentId:
          adjustmentId,

        sourceType:
          source,
      }
    );


    await assertRoomNotActivelyOccupied(
      connection,
      hId,
      rId
    );


    resolvedReleaseStatus =
      RELEASE_STATUSES.CLEANING;
  }
  else if (
    source ===
      SOURCE_TYPES.RECOVERY
  ) {

    if (
      room.status !==
        "maintenance"
    ) {

      throwHttp(
        409,
        "MAINTENANCE_RECOVERY_ROOM_STATE_INVALID",
        "Recovery maintenance requires a room already marked Maintenance."
      );
    }


    resolvedReleaseStatus =
      normalizeReleaseStatus(
        releaseStatus
      );
  }


  let insertResult;


  try {

    [insertResult] =
      await connection.query(
      `
        INSERT INTO maintenance_tasks (
          hotel_id,
          room_id,

          booking_id,
          booking_adjustment_id,

          source_type,
          source_key,

          issue_title,
          issue_description,

          priority,
          task_status,
          active_slot,

          release_status,

          assigned_staff_id,

          created_by_admin_id,
          assigned_by_admin_id,
          completed_by_admin_id,
          cancelled_by_admin_id,

          assigned_at,
          started_at,
          completed_at,
          cancelled_at,

          resolution_notes,
          cancellation_reason
        )
        VALUES (
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, 'pending', 1,
          ?,
          NULL,
          ?, NULL, NULL, NULL,
          NULL, NULL, NULL, NULL,
          NULL, NULL
        )
      `,
      [
        hId,
        rId,

        bId,
        adjustmentId,

        source,
        normalizedSourceKey,

        normalizedTitle,
        normalizedDescription,

        normalizedPriority,
        resolvedReleaseStatus,

        aId,
      ]    );
  }
  catch (error) {

    const duplicateKey =
      error?.code ===
        "ER_DUP_ENTRY" ||
      Number(
        error?.errno
      ) === 1062;


    if (!duplicateKey) {
      throw error;
    }


    /*
     * Concurrent booking-origin retry:
     *
     * another transaction may have committed the exact same
     * deterministic source_key after our initial preflight.
     *
     * Use a locking/current read here so the winner is visible
     * even under REPEATABLE READ.
     */
    if (normalizedSourceKey) {

      const existingBySource =
        await findTaskBySourceKeyForUpdate(
          connection,
          hId,
          normalizedSourceKey
        );


      if (existingBySource) {

        const sameSource =
          Number(
            existingBySource.room_id
          ) === rId &&
          existingBySource
            .source_type === source &&
          (
            existingBySource.booking_id ===
              null
              ? bId === null
              : Number(
                  existingBySource.booking_id
                ) === bId
          ) &&
          (
            existingBySource
              .booking_adjustment_id ===
                null
              ? adjustmentId ===
                  null
              : Number(
                  existingBySource
                    .booking_adjustment_id
                ) === adjustmentId
          );


        if (!sameSource) {

          throwHttp(
            409,
            "MAINTENANCE_SOURCE_KEY_CONFLICT",
            "The maintenance source key is already linked to a different task."
          );
        }


        return {
          created:
            false,

          idempotent:
            true,

          task:
            await getTaskContextWithConnection(
              connection,
              hId,
              Number(
                existingBySource
                  .maintenance_task_id
              )
            ),
        };
      }
    }


    /*
     * If the duplicate was the one-active-task-per-room unique
     * key, surface the normal domain conflict instead of raw SQL.
     */
    const concurrentActiveTask =
      await findActiveTaskForRoomForUpdate(
        connection,
        hId,
        rId
      );


    if (concurrentActiveTask) {

      throwHttp(
        409,
        "MAINTENANCE_ACTIVE_TASK_EXISTS",
        "This room already has an active maintenance task."
      );
    }


    throwHttp(
      409,
      "MAINTENANCE_UNIQUE_CONFLICT",
      "An equivalent maintenance task was created concurrently. Please retry."
    );
  }


  const taskId =
    Number(
      insertResult.insertId
    );


  /*
   * Maintenance owns the operational room state while the task
   * is active.
   */
  if (
    room.status !==
      "maintenance"
  ) {

    const [roomResult] =
      await connection.query(
        `
          UPDATE rooms
          SET status =
            'maintenance'
          WHERE hotel_id = ?
            AND room_id = ?
            AND status = ?
        `,
        [
          hId,
          rId,
          room.status,
        ]
      );


    if (
      roomResult.affectedRows !==
        1
    ) {

      throwHttp(
        409,
        "MAINTENANCE_ROOM_STATE_CHANGED",
        "The room status changed while maintenance was being created."
      );
    }
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
        TASK_STATUSES.PENDING,

      staffId:
        null,

      adminId:
        aId,

      notes:
        normalizedTitle,
    }
  );


  return {
    created:
      true,

    idempotent:
      false,

    task:
      await getTaskContextWithConnection(
        connection,
        hId,
        taskId
      ),
  };
}


/* ============================================================
   CREATE — MANUAL
============================================================ */

async function createManualMaintenanceTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,
    roomId,

    issueTitle,
    issueDescription = null,

    priority =
      PRIORITIES.MEDIUM,
  }
) {

  return createTaskWithConnection(
    connection,
    {
      hotelId,
      adminId,
      roomId,

      sourceType:
        SOURCE_TYPES.MANUAL,

      bookingId:
        null,

      bookingAdjustmentId:
        null,

      sourceKey:
        null,

      issueTitle,
      issueDescription,
      priority,

      releaseStatus:
        null,
    }
  );
}


/* ============================================================
   CREATE — BOOKING ROOM CHANGE
============================================================ */

async function createBookingMaintenanceTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,

    roomId,
    bookingId,
    bookingAdjustmentId,

    sourceType,

    issueDescription = null,

    priority =
      PRIORITIES.MEDIUM,
  }
) {

  const source =
    normalizeSourceType(
      sourceType
    );


  if (
    !BOOKING_SOURCE_TYPES.has(
      source
    )
  ) {

    throwHttp(
      400,
      "MAINTENANCE_BOOKING_SOURCE_INVALID",
      "Booking-origin maintenance must come from a permanent or temporary room change."
    );
  }


  const adjustment =
    requirePositiveId(
      bookingAdjustmentId,
      "bookingAdjustmentId"
    );

  const room =
    requirePositiveId(
      roomId,
      "roomId"
    );


  const sourceKey =
    `${source}:${adjustment}:${room}`;


  const issueTitle =
    source ===
      SOURCE_TYPES
        .PERMANENT_ROOM_CHANGE
      ? "Maintenance after permanent room change"
      : "Maintenance during temporary room move";


  return createTaskWithConnection(
    connection,
    {
      hotelId,
      adminId,

      roomId:
        room,

      sourceType:
        source,

      bookingId,

      bookingAdjustmentId:
        adjustment,

      sourceKey,

      issueTitle,
      issueDescription,

      priority,

      releaseStatus:
        RELEASE_STATUSES.CLEANING,
    }
  );
}


/* ============================================================
   CREATE — INTERNAL RECOVERY
============================================================ */

async function createRecoveryMaintenanceTaskWithConnection(
  connection,
  {
    hotelId,
    adminId = null,
    roomId,

    releaseStatus,

    issueTitle =
      "Recovered maintenance task",

    issueDescription = null,

    priority =
      PRIORITIES.MEDIUM,
  }
) {

  return createTaskWithConnection(
    connection,
    {
      hotelId,
      adminId,
      roomId,

      sourceType:
        SOURCE_TYPES.RECOVERY,

      bookingId:
        null,

      bookingAdjustmentId:
        null,

      sourceKey:
        null,

      issueTitle,
      issueDescription,

      priority,

      releaseStatus,
    }
  );
}


/* ============================================================
   ASSIGNABLE STAFF
============================================================ */

async function lockAssignableMaintenanceStaff(
  connection,
  hotelId,
  staffId
) {

  const [[staff]] =
    await connection.query(
      `
        SELECT
          staff_id,
          hotel_id,
          staff_code,
          full_name,
          department,
          designation,
          status
        FROM staff
        WHERE hotel_id = ?
          AND staff_id = ?
        LIMIT 1
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
      "MAINTENANCE_STAFF_NOT_FOUND",
      "The selected staff member was not found in your hotel."
    );
  }


  if (
    String(
      staff.status || ""
    ).trim() !==
      "Active"
  ) {

    throwHttp(
      409,
      "MAINTENANCE_STAFF_INACTIVE",
      "Only Active staff can be assigned to maintenance."
    );
  }


  if (
    String(
      staff.department || ""
    )
      .trim()
      .toLowerCase() !==
        "maintenance"
  ) {

    throwHttp(
      409,
      "MAINTENANCE_STAFF_DEPARTMENT_INVALID",
      "Only Maintenance department staff can be assigned."
    );
  }


  return staff;
}


/* ============================================================
   ACTIVE TASK + ROOM SAFETY
============================================================ */

function assertActiveTask(
  task
) {

  if (
    !ACTIVE_TASK_STATUSES.has(
      task.task_status
    )
  ) {

    throwHttp(
      409,
      "MAINTENANCE_TASK_TERMINAL",
      "Completed or cancelled maintenance tasks cannot be changed."
    );
  }
}


function assertRoomUnderMaintenance(
  room
) {

  if (
    room.status !==
      "maintenance"
  ) {

    throwHttp(
      409,
      "MAINTENANCE_ROOM_STATE_INVALID",
      "The room is no longer marked Maintenance."
    );
  }
}


/* ============================================================
   ASSIGN / REASSIGN
============================================================ */

async function assignMaintenanceTaskWithConnection(
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
      "notes",
      500
    );


  const task =
    await getLockedTask(
      connection,
      hId,
      tId
    );


  assertActiveTask(
    task
  );


  const room =
    await getLockedRoom(
      connection,
      hId,
      Number(
        task.room_id
      )
    );


  assertRoomUnderMaintenance(
    room
  );


  await lockAssignableMaintenanceStaff(
    connection,
    hId,
    sId
  );


  const previousStaffId =
    task.assigned_staff_id ===
      null
      ? null
      : Number(
          task.assigned_staff_id
        );


  /*
   * Repeating the exact same assignment is an idempotent no-op.
   */
  if (
    previousStaffId ===
      sId
  ) {

    return {
      changed:
        false,

      task:
        await getTaskContextWithConnection(
          connection,
          hId,
          tId
        ),
    };
  }


  await connection.query(
    `
      UPDATE maintenance_tasks
      SET
        assigned_staff_id = ?,
        assigned_by_admin_id = ?,
        assigned_at = NOW()
      WHERE hotel_id = ?
        AND maintenance_task_id = ?
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
        previousStaffId ===
          null
          ? "assigned"
          : "reassigned",

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

    task:
      await getTaskContextWithConnection(
        connection,
        hId,
        tId
      ),
  };
}


/* ============================================================
   UNASSIGN
============================================================ */

async function unassignMaintenanceTaskWithConnection(
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
      "notes",
      500
    );


  const task =
    await getLockedTask(
      connection,
      hId,
      tId
    );


  assertActiveTask(
    task
  );


  const room =
    await getLockedRoom(
      connection,
      hId,
      Number(
        task.room_id
      )
    );


  assertRoomUnderMaintenance(
    room
  );


  if (
    task.assigned_staff_id ===
      null
  ) {

    return {
      changed:
        false,

      task:
        await getTaskContextWithConnection(
          connection,
          hId,
          tId
        ),
    };
  }


  const previousStaffId =
    Number(
      task.assigned_staff_id
    );


  await connection.query(
    `
      UPDATE maintenance_tasks
      SET
        assigned_staff_id = NULL,
        assigned_by_admin_id = NULL,
        assigned_at = NULL
      WHERE hotel_id = ?
        AND maintenance_task_id = ?
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

    task:
      await getTaskContextWithConnection(
        connection,
        hId,
        tId
      ),
  };
}


/* ============================================================
   START
============================================================ */

async function startMaintenanceTaskWithConnection(
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
      "notes",
      500
    );


  const task =
    await getLockedTask(
      connection,
      hId,
      tId
    );


  if (
    task.task_status !==
      TASK_STATUSES.PENDING
  ) {

    throwHttp(
      409,
      "MAINTENANCE_START_NOT_ALLOWED",
      "Only a pending maintenance task can be started."
    );
  }


  const room =
    await getLockedRoom(
      connection,
      hId,
      Number(
        task.room_id
      )
    );


  assertRoomUnderMaintenance(
    room
  );


  await connection.query(
    `
      UPDATE maintenance_tasks
      SET
        task_status =
          'in_progress',
        started_at =
          NOW()
      WHERE hotel_id = ?
        AND maintenance_task_id = ?
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
        TASK_STATUSES.PENDING,

      toStatus:
        TASK_STATUSES.IN_PROGRESS,

      staffId:
        task.assigned_staff_id,

      adminId:
        aId,

      notes:
        normalizedNotes,
    }
  );


  return {
    task:
      await getTaskContextWithConnection(
        connection,
        hId,
        tId
      ),
  };
}


/* ============================================================
   HOUSEKEEPING HANDOFF LOOKUP
============================================================ */

async function findActiveHousekeepingTaskForRoomForUpdate(
  connection,
  hotelId,
  roomId
) {

  const [[task]] =
    await connection.query(
      `
        SELECT
          housekeeping_task_id,
          task_status,
          active_slot
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


  return (
    task ||
    null
  );
}


/* ============================================================
   COMPLETE
============================================================ */

async function completeMaintenanceTaskWithConnection(
  connection,
  {
    hotelId,
    adminId,
    taskId,
    resolutionNotes = null,
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

  const normalizedResolution =
    optionalText(
      resolutionNotes,
      "resolutionNotes",
      500
    );


  const task =
    await getLockedTask(
      connection,
      hId,
      tId
    );


  if (
    task.task_status !==
      TASK_STATUSES.IN_PROGRESS
  ) {

    throwHttp(
      409,
      "MAINTENANCE_COMPLETE_NOT_ALLOWED",
      "Only an in-progress maintenance task can be completed."
    );
  }


  const rId =
    Number(
      task.room_id
    );


  const room =
    await getLockedRoom(
      connection,
      hId,
      rId
    );


  assertRoomUnderMaintenance(
    room
  );


  await assertRoomNotActivelyOccupied(
    connection,
    hId,
    rId
  );


  const releaseStatus =
    normalizeReleaseStatus(
      task.release_status
    );


  await connection.query(
    `
      UPDATE maintenance_tasks
      SET
        task_status =
          'completed',
        active_slot =
          NULL,
        completed_by_admin_id =
          ?,
        completed_at =
          NOW(),
        resolution_notes =
          ?
      WHERE hotel_id = ?
        AND maintenance_task_id = ?
    `,
    [
      aId,
      normalizedResolution,
      hId,
      tId,
    ]
  );


  let housekeepingHandoff =
    null;


  if (
    releaseStatus ===
      RELEASE_STATUSES.AVAILABLE
  ) {

    const [roomResult] =
      await connection.query(
        `
          UPDATE rooms
          SET status =
            'available'
          WHERE hotel_id = ?
            AND room_id = ?
            AND status =
              'maintenance'
        `,
        [
          hId,
          rId,
        ]
      );


    if (
      roomResult.affectedRows !==
        1
    ) {

      throwHttp(
        409,
        "MAINTENANCE_RELEASE_FAILED",
        "The room could not be released from Maintenance."
      );
    }
  }
  else {

    const [roomResult] =
      await connection.query(
        `
          UPDATE rooms
          SET status =
            'cleaning'
          WHERE hotel_id = ?
            AND room_id = ?
            AND status =
              'maintenance'
        `,
        [
          hId,
          rId,
        ]
      );


    if (
      roomResult.affectedRows !==
        1
    ) {

      throwHttp(
        409,
        "MAINTENANCE_CLEANING_HANDOFF_FAILED",
        "The room could not be handed back to Housekeeping."
      );
    }


    const activeHousekeepingTask =
      await findActiveHousekeepingTaskForRoomForUpdate(
        connection,
        hId,
        rId
      );


    if (activeHousekeepingTask) {

      housekeepingHandoff = {
        created:
          false,

        reusedExisting:
          true,

        housekeepingTaskId:
          Number(
            activeHousekeepingTask
              .housekeeping_task_id
          ),
      };
    }
    else {

      const recovery =
        await createRecoveryCleaningTaskWithConnection(
          connection,
          {
            hotelId:
              hId,

            adminId:
              aId,

            roomId:
              rId,

            notes:
              "Created automatically after maintenance completion.",
          }
        );


      housekeepingHandoff = {
        created:
          true,

        reusedExisting:
          false,

        housekeepingTaskId:
          Number(
            recovery
              ?.task
              ?.housekeepingTaskId ??
            recovery
              ?.housekeepingTaskId ??
            0
          ) ||
          null,
      };
    }
  }


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
        TASK_STATUSES.IN_PROGRESS,

      toStatus:
        TASK_STATUSES.COMPLETED,

      staffId:
        task.assigned_staff_id,

      adminId:
        aId,

      notes:
        normalizedResolution,
    }
  );


  return {
    releaseStatus,

    resultingRoomStatus:
      releaseStatus,

    housekeepingHandoff,

    task:
      await getTaskContextWithConnection(
        connection,
        hId,
        tId
      ),
  };
}


/* ============================================================
   CANCEL

   Cancellation does NOT release the room.
============================================================ */

async function cancelMaintenanceTaskWithConnection(
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
      "cancellationReason",
      500
    );


  const task =
    await getLockedTask(
      connection,
      hId,
      tId
    );


  assertActiveTask(
    task
  );


  const room =
    await getLockedRoom(
      connection,
      hId,
      Number(
        task.room_id
      )
    );


  assertRoomUnderMaintenance(
    room
  );


  await connection.query(
    `
      UPDATE maintenance_tasks
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
        AND maintenance_task_id = ?
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
        TASK_STATUSES.CANCELLED,

      staffId:
        task.assigned_staff_id,

      adminId:
        aId,

      notes:
        reason,
    }
  );


  return {
    roomStatusUnchanged:
      true,

    resultingRoomStatus:
      "maintenance",

    task:
      await getTaskContextWithConnection(
        connection,
        hId,
        tId
      ),
  };
}


/* ============================================================
   APPEND-ONLY NOTE
============================================================ */

async function addMaintenanceTaskNoteWithConnection(
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
      "note",
      500
    );


  const task =
    await getLockedTask(
      connection,
      hId,
      tId
    );


  /*
   * Notes are audit annotations and are deliberately allowed
   * for active and terminal tasks.
   */
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
        task.assigned_staff_id,

      adminId:
        aId,

      notes:
        normalizedNote,
    }
  );


  return {
    task:
      await getTaskContextWithConnection(
        connection,
        hId,
        tId
      ),
  };
}


/* ============================================================
   LIST TASKS
============================================================ */

async function listMaintenanceTasks({
  hotelId,

  status = null,
  priority = null,
  sourceType = null,

  roomId = null,
  staffId = null,

  search = null,

  page = 1,
  pageSize =
    DEFAULT_PAGE_SIZE,
} = {}) {

  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );


  const safePage =
    parsePage(
      page
    );

  const safePageSize =
    parsePageSize(
      pageSize
    );

  const offset =
    (
      safePage - 1
    ) *
    safePageSize;


  const conditions = [
    "mt.hotel_id = ?",
  ];

  const params = [
    hId,
  ];


  const normalizedStatus =
    normalizeText(
      status
    ).toLowerCase();


  if (normalizedStatus) {

    if (
      !Object.values(
        TASK_STATUSES
      ).includes(
        normalizedStatus
      )
    ) {

      throwHttp(
        400,
        "MAINTENANCE_STATUS_FILTER_INVALID",
        "The maintenance status filter is invalid."
      );
    }


    conditions.push(
      "mt.task_status = ?"
    );

    params.push(
      normalizedStatus
    );
  }


  const normalizedPriority =
    normalizeText(
      priority
    ).toLowerCase();


  if (normalizedPriority) {

    if (
      !VALID_PRIORITIES.has(
        normalizedPriority
      )
    ) {

      throwHttp(
        400,
        "MAINTENANCE_PRIORITY_FILTER_INVALID",
        "The maintenance priority filter is invalid."
      );
    }


    conditions.push(
      "mt.priority = ?"
    );

    params.push(
      normalizedPriority
    );
  }


  const normalizedSource =
    normalizeText(
      sourceType
    ).toLowerCase();


  if (normalizedSource) {

    if (
      !VALID_SOURCE_TYPES.has(
        normalizedSource
      )
    ) {

      throwHttp(
        400,
        "MAINTENANCE_SOURCE_FILTER_INVALID",
        "The maintenance source filter is invalid."
      );
    }


    conditions.push(
      "mt.source_type = ?"
    );

    params.push(
      normalizedSource
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


    conditions.push(
      "mt.room_id = ?"
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


    conditions.push(
      "mt.assigned_staff_id = ?"
    );

    params.push(
      sId
    );
  }


  const normalizedSearch =
    optionalText(
      search,
      "search",
      100
    );


  if (normalizedSearch) {

    conditions.push(
      `(
        r.room_number LIKE ?
        OR mt.issue_title LIKE ?
        OR mt.issue_description LIKE ?
        OR s.full_name LIKE ?
        OR s.staff_code LIKE ?
      )`
    );


    const pattern =
      `%${normalizedSearch}%`;


    params.push(
      pattern,
      pattern,
      pattern,
      pattern,
      pattern
    );
  }


  const where =
    conditions.join(
      "\n AND "
    );


  const [countRows] =
    await db.query(
      `
        SELECT
          COUNT(*) AS total
        FROM maintenance_tasks mt

        INNER JOIN rooms r
          ON r.hotel_id =
            mt.hotel_id
         AND r.room_id =
            mt.room_id

        LEFT JOIN staff s
          ON s.hotel_id =
            mt.hotel_id
         AND s.staff_id =
            mt.assigned_staff_id

        WHERE ${where}
      `,
      params
    );


  const [rows] =
    await db.query(
      `
        SELECT
          mt.*,

          r.room_number,
          r.room_type,
          r.status
            AS room_status,

          s.staff_code
            AS assigned_staff_code,

          s.full_name
            AS assigned_staff_name,

          s.department
            AS assigned_staff_department,

          s.status
            AS assigned_staff_status

        FROM maintenance_tasks mt

        INNER JOIN rooms r
          ON r.hotel_id =
            mt.hotel_id
         AND r.room_id =
            mt.room_id

        LEFT JOIN staff s
          ON s.hotel_id =
            mt.hotel_id
         AND s.staff_id =
            mt.assigned_staff_id

        WHERE ${where}

        ORDER BY
          mt.created_at DESC,
          mt.maintenance_task_id DESC

        LIMIT ?
        OFFSET ?
      `,
      [
        ...params,
        safePageSize,
        offset,
      ]
    );


  const total =
    Number(
      countRows?.[0]?.total ||
      0
    );


  return {
    items:
      rows.map(
        mapTaskRow
      ),

    pagination: {
      page:
        safePage,

      pageSize:
        safePageSize,

      total,

      totalPages:
        Math.max(
          1,
          Math.ceil(
            total /
            safePageSize
          )
        ),
    },
  };
}


/* ============================================================
   TASK DETAIL
============================================================ */

async function getMaintenanceTaskById({
  hotelId,
  taskId,
} = {}) {

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
    await getTaskContextWithConnection(
      db,
      hId,
      tId
    );


  const [eventRows] =
    await db.query(
      `
        SELECT
          e.*,

          s.staff_code,
          s.full_name
            AS staff_name

        FROM maintenance_task_events e

        LEFT JOIN staff s
          ON s.hotel_id =
            e.hotel_id
         AND s.staff_id =
            e.staff_id

        WHERE e.hotel_id = ?
          AND e.maintenance_task_id = ?

        ORDER BY
          e.maintenance_event_id ASC
      `,
      [
        hId,
        tId,
      ]
    );


  return {
    ...task,

    events:
      eventRows.map(
        mapEventRow
      ),
  };
}


/* ============================================================
   ASSIGNABLE MAINTENANCE STAFF
============================================================ */

async function listAssignableMaintenanceStaff({
  hotelId,
} = {}) {

  const hId =
    requirePositiveId(
      hotelId,
      "hotelId"
    );


  const [rows] =
    await db.query(
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
          AND status = 'Active'
          AND LOWER(
            TRIM(
              department
            )
          ) = 'maintenance'

        ORDER BY
          full_name ASC,
          staff_id ASC
      `,
      [
        hId,
      ]
    );


  return rows.map(
    (row) => ({
      staffId:
        Number(
          row.staff_id
        ),

      staffCode:
        row.staff_code,

      fullName:
        row.full_name,

      department:
        row.department,

      designation:
        row.designation,

      status:
        row.status,
    })
  );
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  TASK_STATUSES,
  PRIORITIES,
  SOURCE_TYPES,
  RELEASE_STATUSES,

  createManualMaintenanceTaskWithConnection,
  createBookingMaintenanceTaskWithConnection,
  createRecoveryMaintenanceTaskWithConnection,

  assignMaintenanceTaskWithConnection,
  unassignMaintenanceTaskWithConnection,

  startMaintenanceTaskWithConnection,
  completeMaintenanceTaskWithConnection,
  cancelMaintenanceTaskWithConnection,

  addMaintenanceTaskNoteWithConnection,

  listMaintenanceTasks,
  getMaintenanceTaskById,

  listAssignableMaintenanceStaff,
};