import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import housekeepingApi from "../api/housekeepingApi";


function getErrorMessage(
  error,
  fallback
) {
  const message =
    error
      ?.response
      ?.data
      ?.message;

  if (
    typeof message === "string" &&
    message.trim()
  ) {
    return message.trim();
  }

  if (
    typeof error?.message ===
      "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return fallback;
}


function formatLabel(
  value
) {
  const text =
    String(
      value ||
        ""
    )
      .trim()
      .replace(
        /_/g,
        " "
      );

  if (!text) {
    return "—";
  }

  return text.replace(
    /\b\w/g,
    (letter) =>
      letter.toUpperCase()
  );
}


function formatDateTime(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString();
}


function normalizeEvents(
  events
) {
  if (
    !Array.isArray(
      events
    )
  ) {
    return [];
  }

  return [
    ...events,
  ].sort(
    (
      left,
      right
    ) => {

      const leftTime =
        new Date(
          left?.createdAt ||
            0
        ).getTime();

      const rightTime =
        new Date(
          right?.createdAt ||
            0
        ).getTime();


      if (
        leftTime !==
        rightTime
      ) {
        return (
          leftTime -
          rightTime
        );
      }


      return (
        Number(
          left?.housekeepingEventId ||
            0
        ) -
        Number(
          right?.housekeepingEventId ||
            0
        )
      );
    }
  );
}


function DetailItem({
  label,
  value,
}) {
  return (
    <div className="housekeeping-task-detail__item">
      <span>
        {label}
      </span>

      <strong>
        {value ?? "—"}
      </strong>
    </div>
  );
}


export default function HousekeepingTaskDetails({
  open,
  taskId,
  onClose,
  onChanged,
}) {

  const [
    detail,
    setDetail,
  ] = useState(null);

  const [
    assignableStaff,
    setAssignableStaff,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    selectedStaffId,
    setSelectedStaffId,
  ] = useState("");

  const [
    assignmentSaving,
    setAssignmentSaving,
  ] = useState(false);

  const [
    assignmentError,
    setAssignmentError,
  ] = useState("");

  const [
    assignmentSuccess,
    setAssignmentSuccess,
  ] = useState("");

  const [
    lifecycleSaving,
    setLifecycleSaving,
  ] = useState(false);

  const [
    lifecycleError,
    setLifecycleError,
  ] = useState("");

  const [
    lifecycleSuccess,
    setLifecycleSuccess,
  ] = useState("");

  const [
    completionConfirming,
    setCompletionConfirming,
  ] = useState(false);

  const [
    completionNotes,
    setCompletionNotes,
  ] = useState("");

  const [
    cancelConfirming,
    setCancelConfirming,
  ] = useState(false);

  const [
    cancellationReason,
    setCancellationReason,
  ] = useState("");

  const [
    notePanelOpen,
    setNotePanelOpen,
  ] = useState(false);

  const [
    noteText,
    setNoteText,
  ] = useState("");

  const [
    noteSaving,
    setNoteSaving,
  ] = useState(false);

  const [
    noteError,
    setNoteError,
  ] = useState("");

  const [
    noteSuccess,
    setNoteSuccess,
  ] = useState("");


  useEffect(
    () => {

      if (
        !open ||
        !taskId
      ) {
        return undefined;
      }


      let active =
        true;


      setLoading(true);
      setError("");
      setDetail(null);
      setAssignableStaff([]);
      setSelectedStaffId("");
      setAssignmentSaving(false);
      setAssignmentError("");
      setAssignmentSuccess("");
      setLifecycleSaving(false);
      setLifecycleError("");
      setLifecycleSuccess("");
      setCompletionConfirming(false);
      setCompletionNotes("");
      setCancelConfirming(false);
      setCancellationReason("");
      setNotePanelOpen(false);
      setNoteText("");
      setNoteSaving(false);
      setNoteError("");
      setNoteSuccess("");


      async function loadDetails() {

        try {

          const [
            detailResponse,
            staffResponse,
          ] =
            await Promise.all([
              housekeepingApi
                .getTask(
                  taskId
                ),

              housekeepingApi
                .getAssignableStaff(),
            ]);


          if (!active) {
            return;
          }


          const detailPayload =
            detailResponse
              ?.data
              ?.data;


          const staffPayload =
            staffResponse
              ?.data
              ?.data;


          if (
            !detailPayload ||
            typeof detailPayload !==
              "object" ||
            Array.isArray(
              detailPayload
            )
          ) {
            throw new Error(
              "Invalid housekeeping task detail response."
            );
          }


          setDetail(
            detailPayload
          );


          setAssignableStaff(
            Array.isArray(
              staffPayload
            )
              ? staffPayload
              : []
          );

        }
        catch (
          requestError
        ) {

          if (!active) {
            return;
          }


          setDetail(null);
          setAssignableStaff([]);

          setError(
            getErrorMessage(
              requestError,
              "Housekeeping task details could not be loaded."
            )
          );

        }
        finally {

          if (active) {
            setLoading(false);
          }

        }
      }


      void loadDetails();


      return () => {
        active =
          false;
      };

    },
    [
      open,
      taskId,
    ]
  );


  useEffect(
    () => {

      if (!open) {
        return undefined;
      }


      function handleKeyDown(
        event
      ) {

        if (
          event.key ===
            "Escape" &&
          typeof onClose ===
            "function"
        ) {
          onClose();
        }

      }


      window.addEventListener(
        "keydown",
        handleKeyDown
      );


      return () => {

        window.removeEventListener(
          "keydown",
          handleKeyDown
        );

      };

    },
    [
      open,
      onClose,
    ]
  );


  const events =
    useMemo(
      () =>
        normalizeEvents(
          detail?.events
        ),
      [
        detail,
      ]
    );


  const assignmentEditable =
    detail?.taskStatus ===
      "pending" ||
    detail?.taskStatus ===
      "in_progress";


  const startAvailable =
    detail?.taskStatus ===
      "pending";


  const completeAvailable =
    detail?.taskStatus ===
      "in_progress";


  const cancelAvailable =
    detail?.taskStatus ===
      "pending" ||
    detail?.taskStatus ===
      "in_progress";


  const selectedStaff =
    assignableStaff.find(
      (staff) =>
        String(
          staff?.staffId ||
            ""
        ) ===
        String(
          selectedStaffId ||
            ""
        )
    ) ||
    null;


  const selectedStaffMatchesCurrent =
    selectedStaff &&
    Number(
      selectedStaff.staffId
    ) ===
    Number(
      detail?.assignedStaffId ||
        0
    );


  async function refreshDetailAfterMutation() {

    const detailResponse =
      await housekeepingApi
        .getTask(
          taskId
        );


    const detailPayload =
      detailResponse
        ?.data
        ?.data;


    if (
      !detailPayload ||
      typeof detailPayload !==
        "object" ||
      Array.isArray(
        detailPayload
      )
    ) {
      throw new Error(
        "Invalid housekeeping task detail response."
      );
    }


    setDetail(
      detailPayload
    );

    setSelectedStaffId("");


    if (
      typeof onChanged ===
        "function"
    ) {
      onChanged(
        detailPayload
      );
    }


    return detailPayload;
  }


  async function handleAssign() {

    if (
      !detail ||
      !taskId ||
      !assignmentEditable ||
      assignmentSaving ||
      lifecycleSaving
    ) {
      return;
    }


    const staffId =
      Number(
        selectedStaffId
      );


    if (
      !Number.isInteger(
        staffId
      ) ||
      staffId <= 0
    ) {
      setAssignmentSuccess("");

      setAssignmentError(
        "Select an active Housekeeping staff member first."
      );

      return;
    }


    if (
      selectedStaffMatchesCurrent
    ) {
      setAssignmentError("");

      setAssignmentSuccess(
        "This staff member is already assigned to the task."
      );

      return;
    }


    const wasAssigned =
      Boolean(
        detail.assignedStaffId
      );

    let mutationCompleted =
      false;


    setAssignmentSaving(true);
    setAssignmentError("");
    setAssignmentSuccess("");
    setLifecycleError("");
    setLifecycleSuccess("");


    try {

      await housekeepingApi
        .assignTask(
          taskId,
          {
            staff_id:
              staffId,
          }
        );

      mutationCompleted =
        true;


      await refreshDetailAfterMutation();


      setAssignmentSuccess(
        wasAssigned
          ? "Housekeeping task reassigned successfully."
          : "Housekeeping task assigned successfully."
      );

    }
    catch (
      requestError
    ) {

      setAssignmentError(
        getErrorMessage(
          requestError,
          mutationCompleted
            ? "Assignment was saved, but refreshed task details could not be loaded. Close and reopen Task Details."
            : "The housekeeping task could not be assigned."
        )
      );

    }
    finally {
      setAssignmentSaving(false);
    }
  }


  async function handleUnassign() {

    if (
      !detail ||
      !taskId ||
      !assignmentEditable ||
      !detail.assignedStaffId ||
      assignmentSaving ||
      lifecycleSaving
    ) {
      return;
    }


    let mutationCompleted =
      false;


    setAssignmentSaving(true);
    setAssignmentError("");
    setAssignmentSuccess("");
    setLifecycleError("");
    setLifecycleSuccess("");


    try {

      await housekeepingApi
        .unassignTask(
          taskId
        );

      mutationCompleted =
        true;


      await refreshDetailAfterMutation();


      setAssignmentSuccess(
        "Housekeeping task unassigned successfully."
      );

    }
    catch (
      requestError
    ) {

      setAssignmentError(
        getErrorMessage(
          requestError,
          mutationCompleted
            ? "Unassignment was saved, but refreshed task details could not be loaded. Close and reopen Task Details."
            : "The housekeeping task could not be unassigned."
        )
      );

    }
    finally {
      setAssignmentSaving(false);
    }
  }


  async function handleStart() {

    if (
      !detail ||
      !taskId ||
      !startAvailable ||
      lifecycleSaving ||
      assignmentSaving
    ) {
      return;
    }


    let mutationCompleted =
      false;


    setLifecycleSaving(true);
    setLifecycleError("");
    setLifecycleSuccess("");
    setAssignmentError("");
    setAssignmentSuccess("");


    try {

      await housekeepingApi
        .startTask(
          taskId,
          {}
        );

      mutationCompleted =
        true;


      await refreshDetailAfterMutation();


      setLifecycleSuccess(
        "Cleaning started successfully."
      );

    }
    catch (
      requestError
    ) {

      setLifecycleError(
        getErrorMessage(
          requestError,
          mutationCompleted
            ? "Cleaning was started, but refreshed task details could not be loaded. Close and reopen Task Details."
            : "The housekeeping task could not be started."
        )
      );

    }
    finally {
      setLifecycleSaving(false);
    }
  }


  function handleOpenCompleteConfirmation() {

    if (
      !detail ||
      !completeAvailable ||
      lifecycleSaving ||
      assignmentSaving
    ) {
      return;
    }


    setLifecycleError("");
    setLifecycleSuccess("");
    setCancelConfirming(false);
    setCancellationReason("");
    setCompletionConfirming(true);
  }


  function handleCancelCompleteConfirmation() {

    if (
      lifecycleSaving
    ) {
      return;
    }


    setCompletionConfirming(false);
    setCompletionNotes("");
    setLifecycleError("");
  }


  async function handleComplete() {

    if (
      !detail ||
      !taskId ||
      !completeAvailable ||
      !completionConfirming ||
      lifecycleSaving ||
      assignmentSaving
    ) {
      return;
    }


    const normalizedCompletionNotes =
      completionNotes.trim();


    const payload =
      normalizedCompletionNotes
        ? {
            completion_notes:
              normalizedCompletionNotes,
          }
        : {};


    let mutationCompleted =
      false;


    setLifecycleSaving(true);
    setLifecycleError("");
    setLifecycleSuccess("");
    setAssignmentError("");
    setAssignmentSuccess("");


    try {

      await housekeepingApi
        .completeTask(
          taskId,
          payload
        );

      mutationCompleted =
        true;


      await refreshDetailAfterMutation();


      setCompletionConfirming(false);
      setCompletionNotes("");

      setLifecycleSuccess(
        "Cleaning completed successfully."
      );

    }
    catch (
      requestError
    ) {

      setLifecycleError(
        getErrorMessage(
          requestError,
          mutationCompleted
            ? "Cleaning was completed, but refreshed task details could not be loaded. Close and reopen Task Details."
            : "The housekeeping task could not be completed."
        )
      );

    }
    finally {
      setLifecycleSaving(false);
    }
  }


  function handleOpenCancelConfirmation() {

    if (
      !detail ||
      !cancelAvailable ||
      lifecycleSaving ||
      assignmentSaving
    ) {
      return;
    }


    setLifecycleError("");
    setLifecycleSuccess("");
    setCompletionConfirming(false);
    setCompletionNotes("");
    setCancellationReason("");
    setCancelConfirming(true);
  }


  function handleBackCancelConfirmation() {

    if (
      lifecycleSaving
    ) {
      return;
    }


    setCancelConfirming(false);
    setCancellationReason("");
    setLifecycleError("");
  }


  async function handleCancelTask() {

    if (
      !detail ||
      !taskId ||
      !cancelAvailable ||
      !cancelConfirming ||
      lifecycleSaving ||
      assignmentSaving
    ) {
      return;
    }


    const normalizedCancellationReason =
      cancellationReason.trim();


    if (
      !normalizedCancellationReason
    ) {

      setLifecycleError(
        "Cancellation reason is required."
      );

      return;
    }


    const payload = {
      cancellation_reason:
        normalizedCancellationReason,
    };


    let mutationCompleted =
      false;


    setLifecycleSaving(true);
    setLifecycleError("");
    setLifecycleSuccess("");
    setAssignmentError("");
    setAssignmentSuccess("");


    try {

      await housekeepingApi
        .cancelTask(
          taskId,
          payload
        );

      mutationCompleted =
        true;


      await refreshDetailAfterMutation();


      setCancelConfirming(false);
      setCancellationReason("");

      setLifecycleSuccess(
        "Cleaning task cancelled successfully."
      );

    }
    catch (
      requestError
    ) {

      setLifecycleError(
        getErrorMessage(
          requestError,
          mutationCompleted
            ? "The task was cancelled, but refreshed task details could not be loaded. Close and reopen Task Details."
            : "The housekeeping task could not be cancelled."
        )
      );

    }
    finally {
      setLifecycleSaving(false);
    }
  }


  function handleOpenNotePanel() {

    if (
      !detail ||
      lifecycleSaving ||
      assignmentSaving ||
      noteSaving
    ) {
      return;
    }


    setLifecycleError("");
    setLifecycleSuccess("");
    setAssignmentError("");
    setAssignmentSuccess("");

    setCompletionConfirming(false);
    setCompletionNotes("");

    setCancelConfirming(false);
    setCancellationReason("");

    setNoteError("");
    setNoteSuccess("");
    setNoteText("");
    setNotePanelOpen(true);
  }


  function handleBackNotePanel() {

    if (
      noteSaving
    ) {
      return;
    }


    setNotePanelOpen(false);
    setNoteText("");
    setNoteError("");
  }


  async function handleAddNote() {

    if (
      !detail ||
      !taskId ||
      !notePanelOpen ||
      noteSaving ||
      lifecycleSaving ||
      assignmentSaving
    ) {
      return;
    }


    const normalizedNote =
      noteText.trim();


    if (
      !normalizedNote
    ) {

      setNoteError(
        "Note is required."
      );

      return;
    }


    if (
      normalizedNote.length > 500
    ) {

      setNoteError(
        "Note cannot exceed 500 characters."
      );

      return;
    }


    const payload = {
      note:
        normalizedNote,
    };


    let mutationCompleted =
      false;


    setNoteSaving(true);
    setNoteError("");
    setNoteSuccess("");

    setLifecycleError("");
    setLifecycleSuccess("");

    setAssignmentError("");
    setAssignmentSuccess("");


    try {

      await housekeepingApi
        .addTaskNote(
          taskId,
          payload
        );

      mutationCompleted =
        true;


      await refreshDetailAfterMutation();


      setNotePanelOpen(false);
      setNoteText("");

      setNoteSuccess(
        "Note added to task history."
      );

    }
    catch (
      requestError
    ) {

      setNoteError(
        getErrorMessage(
          requestError,
          mutationCompleted
            ? "The note was added, but refreshed task details could not be loaded. Close and reopen Task Details."
            : "The housekeeping note could not be added."
        )
      );

    }
    finally {
      setNoteSaving(false);
    }
  }


  if (!open) {
    return null;
  }


  const roomLabel =
    detail?.roomNumber
      ? `Room ${detail.roomNumber}`
      : detail?.roomId
        ? `Room #${detail.roomId}`
        : "Room";


  const assignmentLabel =
    detail?.assignedStaffName
      ? (
          detail.assignedStaffCode
            ? `${detail.assignedStaffName} (${detail.assignedStaffCode})`
            : detail.assignedStaffName
        )
      : "Unassigned";


  const bookingLabel =
    detail?.bookingCode ||
    (
      detail?.bookingId
        ? `Booking #${detail.bookingId}`
        : "Not linked"
    );


  return (
    <div
      className="housekeeping-modal-backdrop housekeeping-task-detail-backdrop"
      onMouseDown={
        (event) => {

          if (
            event.target ===
              event.currentTarget &&
            typeof onClose ===
              "function"
          ) {
            onClose();
          }

        }
      }
    >

      <section
        className="housekeeping-task-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="housekeeping-task-detail-title"
      >

        <header className="housekeeping-task-detail__header">

          <div className="housekeeping-task-detail__heading">

            <p className="housekeeping-page__eyebrow">
              Housekeeping Task
            </p>

            <h2 id="housekeeping-task-detail-title">
              {detail?.housekeepingTaskId
                ? `Task #${detail.housekeepingTaskId}`
                : "Task Details"}
            </h2>

            <p>
              Review task context,
              assignment and event history.
            </p>

          </div>


          <button
            type="button"
            className="housekeeping-modal__close"
            onClick={
              onClose
            }
            aria-label="Close housekeeping task details"
          >
            ×
          </button>

        </header>


        <div className="housekeeping-task-detail__body">

          {loading && (
            <div
              className="housekeeping-task-detail__state"
              role="status"
            >
              Loading task details...
            </div>
          )}


          {!loading &&
            error && (
              <div
                className="housekeeping-alert housekeeping-alert--error"
                role="alert"
              >
                {error}
              </div>
            )}


          {!loading &&
            !error &&
            detail && (
              <>

                <section className="housekeeping-task-detail__summary">

                  <div className="housekeeping-task-detail__summary-main">

                    <div>

                      <span className="housekeeping-task-detail__label">
                        Room
                      </span>

                      <strong>
                        {roomLabel}
                      </strong>

                      <small>
                        {detail.roomType ||
                          "Room type not set"}
                      </small>

                    </div>


                    <div className="housekeeping-task-detail__badges">

                      <span className="housekeeping-task-detail__badge">
                        {formatLabel(
                          detail.taskType
                        )}
                      </span>

                      <span
                        className={
                          `housekeeping-status housekeeping-status--${detail.taskStatus || "unknown"}`
                        }
                      >
                        {formatLabel(
                          detail.taskStatus
                        )}
                      </span>

                    </div>

                  </div>


                  <div className="housekeeping-task-detail__grid">

                    <DetailItem
                      label="Room Status"
                      value={
                        formatLabel(
                          detail.roomStatus
                        )
                      }
                    />

                    <DetailItem
                      label="Booking"
                      value={
                        bookingLabel
                      }
                    />

                    <DetailItem
                      label="Assigned To"
                      value={
                        assignmentLabel
                      }
                    />

                    <DetailItem
                      label="Created By"
                      value={
                        detail.createdByAdminName ||
                        (
                          detail.createdByAdminId
                            ? `Admin #${detail.createdByAdminId}`
                            : "—"
                        )
                      }
                    />

                  </div>

                </section>


                <section className="housekeeping-task-detail__section">

                  <div className="housekeeping-task-detail__section-header">

                    <div>

                      <h3>
                        Assignment
                      </h3>

                      <p>
                        Current housekeeping assignment context.
                      </p>

                    </div>

                  </div>


                  <div className="housekeeping-task-detail__grid">

                    <DetailItem
                      label="Assigned Staff"
                      value={
                        assignmentLabel
                      }
                    />

                    <DetailItem
                      label="Department"
                      value={
                        detail.assignedStaffDepartment ||
                        "—"
                      }
                    />

                    <DetailItem
                      label="Staff Status"
                      value={
                        detail.assignedStaffStatus ||
                        "—"
                      }
                    />

                    <DetailItem
                      label="Assigned At"
                      value={
                        formatDateTime(
                          detail.assignedAt
                        )
                      }
                    />

                  </div>


                  {!assignmentEditable && (
                    <div className="housekeeping-task-detail__empty-note">
                      Assignment changes are unavailable for completed
                      or cancelled housekeeping tasks.
                    </div>
                  )}


                  {assignmentEditable &&
                    assignableStaff.length ===
                      0 && (
                    <div className="housekeeping-task-detail__empty-note">
                      No active Housekeeping staff are currently
                      available for assignment. Cleaning lifecycle
                      remains available without staff assignment.
                    </div>
                  )}


                  {assignmentEditable &&
                    assignableStaff.length >
                      0 && (
                    <div className="housekeeping-task-detail__assignment-controls">

                      <label className="housekeeping-field">

                        <span>
                          {detail.assignedStaffId
                            ? "Reassign to"
                            : "Assign to"}
                        </span>

                        <select
                          value={
                            selectedStaffId
                          }
                          disabled={
                            assignmentSaving ||
                            lifecycleSaving
                          }
                          onChange={
                            (event) => {
                              setSelectedStaffId(
                                event.target.value
                              );

                              setAssignmentError("");
                              setAssignmentSuccess("");
                            }
                          }
                        >

                          <option value="">
                            Select Housekeeping staff
                          </option>

                          {assignableStaff.map(
                            (staff) => (
                              <option
                                key={
                                  staff.staffId
                                }
                                value={
                                  staff.staffId
                                }
                              >
                                {staff.fullName ||
                                  `Staff #${staff.staffId}`}
                                {staff.staffCode
                                  ? ` (${staff.staffCode})`
                                  : ""}
                              </option>
                            )
                          )}

                        </select>

                      </label>


                      <div className="housekeeping-task-detail__assignment-actions">

                        <button
                          type="button"
                          className="housekeeping-button housekeeping-button--primary"
                          disabled={
                            assignmentSaving ||
                            lifecycleSaving ||
                            !selectedStaffId ||
                            selectedStaffMatchesCurrent
                          }
                          onClick={
                            handleAssign
                          }
                        >
                          {assignmentSaving
                            ? "Saving..."
                            : detail.assignedStaffId
                              ? "Reassign"
                              : "Assign"}
                        </button>


                        {detail.assignedStaffId && (
                          <button
                            type="button"
                            className="housekeeping-button housekeeping-button--secondary"
                            disabled={
                              assignmentSaving ||
                              lifecycleSaving
                            }
                            onClick={
                              handleUnassign
                            }
                          >
                            Unassign
                          </button>
                        )}

                      </div>

                    </div>
                  )}


                  {assignmentError && (
                    <div
                      className="housekeeping-alert housekeeping-alert--error housekeeping-task-detail__assignment-alert"
                      role="alert"
                    >
                      {assignmentError}
                    </div>
                  )}


                  {assignmentSuccess && (
                    <div
                      className="housekeeping-alert housekeeping-alert--success housekeeping-task-detail__assignment-alert"
                      role="status"
                    >
                      {assignmentSuccess}
                    </div>
                  )}

                </section>


                <section className="housekeeping-task-detail__section">

                  <div className="housekeeping-task-detail__section-header">

                    <div>

                      <h3>
                        Timeline
                      </h3>

                      <p>
                        Canonical lifecycle timestamps.
                      </p>

                    </div>

                  </div>


                  <div className="housekeeping-task-detail__grid">

                    <DetailItem
                      label="Created"
                      value={
                        formatDateTime(
                          detail.createdAt
                        )
                      }
                    />

                    <DetailItem
                      label="Started"
                      value={
                        formatDateTime(
                          detail.startedAt
                        )
                      }
                    />

                    <DetailItem
                      label="Completed"
                      value={
                        formatDateTime(
                          detail.completedAt
                        )
                      }
                    />

                    <DetailItem
                      label="Cancelled"
                      value={
                        formatDateTime(
                          detail.cancelledAt
                        )
                      }
                    />

                  </div>

                </section>


                <section className="housekeeping-task-detail__section">

                  <div className="housekeeping-task-detail__section-header">

                    <div>

                      <h3>
                        Notes
                      </h3>

                      <p>
                        Operational notes recorded against this task.
                      </p>

                    </div>

                  </div>


                  <div className="housekeeping-task-detail__notes">

                    <div>

                      <span>
                        Task notes
                      </span>

                      <p>
                        {detail.notes ||
                          "No task notes recorded."}
                      </p>

                    </div>


                    <div>

                      <span>
                        Completion notes
                      </span>

                      <p>
                        {detail.completionNotes ||
                          "No completion notes recorded."}
                      </p>

                    </div>


                    <div>

                      <span>
                        Cancellation reason
                      </span>

                      <p>
                        {detail.cancellationReason ||
                          "No cancellation reason recorded."}
                      </p>

                    </div>

                  </div>

                </section>


                <section className="housekeeping-task-detail__section">

                  <div className="housekeeping-task-detail__section-header">

                    <div>

                      <h3>
                        Event History
                      </h3>

                      <p>
                        Append-only housekeeping task activity.
                      </p>

                    </div>

                    <span className="housekeeping-task-detail__event-count">
                      {events.length}
                      {" "}
                      {events.length === 1
                        ? "event"
                        : "events"}
                    </span>

                  </div>


                  {events.length ===
                    0 ? (

                    <div className="housekeeping-task-detail__state">
                      No housekeeping events recorded.
                    </div>

                  ) : (

                    <ol className="housekeeping-task-detail__events">

                      {events.map(
                        (
                          event,
                          index
                        ) => {

                          const eventKey =
                            event.housekeepingEventId ||
                            `${event.eventType}-${event.createdAt}-${index}`;


                          const actor =
                            event.staffName ||
                            event.adminName ||
                            (
                              event.staffId
                                ? `Staff #${event.staffId}`
                                : event.adminId
                                  ? `Admin #${event.adminId}`
                                  : "System"
                            );


                          return (
                            <li
                              key={
                                eventKey
                              }
                              className="housekeeping-task-detail__event"
                            >

                              <div className="housekeeping-task-detail__event-marker" />


                              <div className="housekeeping-task-detail__event-content">

                                <div className="housekeeping-task-detail__event-topline">

                                  <strong>
                                    {formatLabel(
                                      event.eventType
                                    )}
                                  </strong>

                                  <time
                                    dateTime={
                                      event.createdAt ||
                                      undefined
                                    }
                                  >
                                    {formatDateTime(
                                      event.createdAt
                                    )}
                                  </time>

                                </div>


                                <div className="housekeeping-task-detail__event-meta">

                                  <span>
                                    {actor}
                                  </span>


                                  {(event.fromStatus ||
                                    event.toStatus) && (
                                    <span>
                                      {formatLabel(
                                        event.fromStatus
                                      )}
                                      {" → "}
                                      {formatLabel(
                                        event.toStatus
                                      )}
                                    </span>
                                  )}

                                </div>


                                {event.notes && (
                                  <p>
                                    {event.notes}
                                  </p>
                                )}

                              </div>

                            </li>
                          );

                        }
                      )}

                    </ol>

                  )}

                </section>

              </>
            )}

        </div>


        {completeAvailable &&
          completionConfirming && (
            <section
              className="housekeeping-task-detail__completion-panel"
              aria-label="Complete cleaning confirmation"
            >

              <div className="housekeeping-task-detail__completion-copy">

                <strong>
                  Complete this cleaning task?
                </strong>

                <span>
                  Completion may release a room from Cleaning to Available.
                  Rooms under Maintenance remain unavailable.
                </span>

              </div>


              <label className="housekeeping-field">

                <span>
                  Completion note
                  <small>
                    Optional
                  </small>
                </span>

                <textarea
                  rows="3"
                  value={
                    completionNotes
                  }
                  disabled={
                    lifecycleSaving
                  }
                  placeholder="Add any final cleaning note"
                  onChange={
                    (event) =>
                      setCompletionNotes(
                        event.target.value
                      )
                  }
                />

              </label>


              <div className="housekeeping-task-detail__completion-actions">

                <button
                  type="button"
                  className="housekeeping-button housekeeping-button--secondary"
                  disabled={
                    lifecycleSaving
                  }
                  onClick={
                    handleCancelCompleteConfirmation
                  }
                >
                  Back
                </button>


                <button
                  type="button"
                  className="housekeeping-button housekeeping-button--primary"
                  disabled={
                    lifecycleSaving ||
                    assignmentSaving
                  }
                  onClick={
                    handleComplete
                  }
                >
                  {lifecycleSaving
                    ? "Completing..."
                    : "Confirm Complete"}
                </button>

              </div>

            </section>
          )}


        {cancelAvailable &&
          cancelConfirming && (
            <section
              className="housekeeping-task-detail__cancellation-panel"
              aria-label="Cancel cleaning confirmation"
            >

              <div className="housekeeping-task-detail__cancellation-copy">

                <strong>
                  Cancel this cleaning task?
                </strong>

                <span>
                  Cancelling this task does not release the room to Available.
                </span>

              </div>


              <label className="housekeeping-field">

                <span>
                  Cancellation reason
                  <small>
                    Required
                  </small>
                </span>

                <textarea
                  rows="3"
                  required
                  aria-required="true"
                  value={
                    cancellationReason
                  }
                  disabled={
                    lifecycleSaving
                  }
                  placeholder="Enter the reason for cancellation"
                  onChange={
                    (event) => {
                      setCancellationReason(
                        event.target.value
                      );

                      if (
                        lifecycleError ===
                        "Cancellation reason is required."
                      ) {
                        setLifecycleError("");
                      }
                    }
                  }
                />

              </label>


              <div className="housekeeping-task-detail__cancellation-actions">

                <button
                  type="button"
                  className="housekeeping-button housekeeping-button--secondary"
                  disabled={
                    lifecycleSaving
                  }
                  onClick={
                    handleBackCancelConfirmation
                  }
                >
                  Back
                </button>


                <button
                  type="button"
                  className="housekeeping-button housekeeping-button--danger"
                  disabled={
                    lifecycleSaving ||
                    assignmentSaving ||
                    !cancellationReason.trim()
                  }
                  onClick={
                    handleCancelTask
                  }
                >
                  {lifecycleSaving
                    ? "Cancelling..."
                    : "Confirm Cancel"}
                </button>

              </div>

            </section>
          )}


        {noteSuccess && (
          <div
            className="housekeeping-task-detail__note-feedback housekeeping-task-detail__note-feedback--success"
            role="status"
          >
            {noteSuccess}
          </div>
        )}


        {notePanelOpen && (
          <section
            className="housekeeping-task-detail__note-panel"
            aria-label="Add housekeeping task note"
          >

            <div className="housekeeping-task-detail__note-copy">

              <strong>
                Add task note
              </strong>

              <span>
                Notes are added to the task history and cannot be edited here.
              </span>

            </div>


            <label className="housekeeping-field">

              <span>
                Note
                <small>
                  Required
                </small>
              </span>

              <textarea
                rows="3"
                required
                aria-required="true"
                maxLength={500}
                value={
                  noteText
                }
                disabled={
                  noteSaving
                }
                placeholder="Enter an operational note"
                onChange={
                  (event) => {
                    setNoteText(
                      event.target.value
                    );

                    if (noteError) {
                      setNoteError("");
                    }
                  }
                }
              />

            </label>


            <div className="housekeeping-task-detail__note-meta">

              <span>
                {noteText.length}/500
              </span>

            </div>


            {noteError && (
              <div
                className="housekeeping-task-detail__note-feedback housekeeping-task-detail__note-feedback--error"
                role="alert"
              >
                {noteError}
              </div>
            )}


            <div className="housekeeping-task-detail__note-actions">

              <button
                type="button"
                className="housekeeping-button housekeeping-button--secondary"
                disabled={
                  noteSaving
                }
                onClick={
                  handleBackNotePanel
                }
              >
                Back
              </button>


              <button
                type="button"
                className="housekeeping-button housekeeping-button--primary"
                disabled={
                  noteSaving ||
                  lifecycleSaving ||
                  assignmentSaving ||
                  !noteText.trim()
                }
                onClick={
                  handleAddNote
                }
              >
                {noteSaving
                  ? "Saving..."
                  : "Save Note"}
              </button>

            </div>

          </section>
        )}


        <footer className="housekeeping-task-detail__footer">

          <div className="housekeeping-task-detail__footer-feedback">

            {lifecycleError && (
              <span
                className="housekeeping-task-detail__action-feedback housekeeping-task-detail__action-feedback--error"
                role="alert"
              >
                {lifecycleError}
              </span>
            )}


            {lifecycleSuccess && (
              <span
                className="housekeeping-task-detail__action-feedback housekeeping-task-detail__action-feedback--success"
                role="status"
              >
                {lifecycleSuccess}
              </span>
            )}

          </div>


          <div className="housekeeping-task-detail__footer-actions">

            {startAvailable &&
              !cancelConfirming &&
              !notePanelOpen && (
              <button
                type="button"
                className="housekeeping-button housekeeping-button--primary"
                disabled={
                  lifecycleSaving ||
                  assignmentSaving
                }
                onClick={
                  handleStart
                }
              >
                {lifecycleSaving
                  ? "Starting..."
                  : "Start Cleaning"}
              </button>
            )}


            {completeAvailable &&
              !completionConfirming &&
              !cancelConfirming &&
              !notePanelOpen && (
                <button
                  type="button"
                  className="housekeeping-button housekeeping-button--primary"
                  disabled={
                    lifecycleSaving ||
                    assignmentSaving
                  }
                  onClick={
                    handleOpenCompleteConfirmation
                  }
                >
                  Complete Cleaning
                </button>
              )}


            {cancelAvailable &&
              !completionConfirming &&
              !cancelConfirming &&
              !notePanelOpen && (
                <button
                  type="button"
                  className="housekeeping-button housekeeping-button--danger"
                  disabled={
                    lifecycleSaving ||
                    assignmentSaving
                  }
                  onClick={
                    handleOpenCancelConfirmation
                  }
                >
                  Cancel Cleaning
                </button>
              )}


            {!completionConfirming &&
              !cancelConfirming &&
              !notePanelOpen && (
                <button
                  type="button"
                  className="housekeeping-button housekeeping-button--secondary"
                  disabled={
                    lifecycleSaving ||
                    assignmentSaving ||
                    noteSaving
                  }
                  onClick={
                    handleOpenNotePanel
                  }
                >
                  Add Note
                </button>
              )}


            <button
              type="button"
              className="housekeeping-button housekeeping-button--secondary"
              disabled={
                lifecycleSaving ||
                noteSaving
              }
              onClick={
                onClose
              }
            >
              Close
            </button>

          </div>

        </footer>

      </section>

    </div>
  );
}