import {
  useEffect,
  useMemo,
  useState,
} from "react";

import maintenanceApi from "../api/maintenanceApi";


const ACTIVE_STATUSES =
  new Set([
    "pending",
    "in_progress",
  ]);


function getErrorMessage(
  error,
  fallback
) {

  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}


function normalizeStaffId(
  staff
) {

  const value =
    staff?.staffId ??
    staff?.staff_id ??
    staff?.id ??
    null;


  const numericValue =
    Number(value);


  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : null;
}


function getStaffLabel(
  staff
) {

  const staffId =
    normalizeStaffId(
      staff
    );


  const composedName =
    [
      staff?.firstName,
      staff?.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();


  return (
    staff?.fullName ||
    staff?.staffName ||
    staff?.name ||
    composedName ||
    staff?.staffCode ||
    (
      staffId
        ? `Staff #${staffId}`
        : "Maintenance staff"
    )
  );
}


export default function MaintenanceTaskActions({
  task,
  assignableStaff = [],
  onChanged,
}) {

  const taskId =
    Number(
      task?.maintenanceTaskId ||
      0
    );


  const taskStatus =
    task?.taskStatus ||
    "";


  const assignedStaffId =
    Number(
      task?.assignedStaffId ||
      0
    );


  const [
    selectedStaffId,
    setSelectedStaffId,
  ] =
    useState("");


  const [
    busyAction,
    setBusyAction,
  ] =
    useState("");


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");


  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");


  const [
    completePanelOpen,
    setCompletePanelOpen,
  ] =
    useState(false);


  const [
    resolutionNotes,
    setResolutionNotes,
  ] =
    useState("");


  const [
    cancelPanelOpen,
    setCancelPanelOpen,
  ] =
    useState(false);


  const [
    cancellationReason,
    setCancellationReason,
  ] =
    useState("");


  const [
    notePanelOpen,
    setNotePanelOpen,
  ] =
    useState(false);


  const [
    noteText,
    setNoteText,
  ] =
    useState("");


  const staffOptions =
    useMemo(
      () =>
        (
          Array.isArray(
            assignableStaff
          )
            ? assignableStaff
            : []
        )
          .map(
            (staff) => ({
              id:
                normalizeStaffId(
                  staff
                ),

              label:
                getStaffLabel(
                  staff
                ),

              code:
                staff?.staffCode ||
                staff?.staff_code ||
                "",
            })
          )
          .filter(
            (staff) =>
              staff.id
          ),
      [
        assignableStaff,
      ]
    );


  useEffect(
    () => {

      setSelectedStaffId(
        assignedStaffId
          ? String(
              assignedStaffId
            )
          : ""
      );


      setBusyAction("");
      setErrorMessage("");
      setSuccessMessage("");

      setCompletePanelOpen(false);
      setResolutionNotes("");

      setCancelPanelOpen(false);
      setCancellationReason("");

      setNotePanelOpen(false);
      setNoteText("");
    },
    [
      taskId,
      taskStatus,
      assignedStaffId,
    ]
  );


  const assignmentEditable =
    ACTIVE_STATUSES.has(
      taskStatus
    );


  const startAvailable =
    taskStatus ===
      "pending";


  const completeAvailable =
    taskStatus ===
      "in_progress";


  const cancelAvailable =
    ACTIVE_STATUSES.has(
      taskStatus
    );


  const noteAvailable =
    ACTIVE_STATUSES.has(
      taskStatus
    );


  const actionBusy =
    Boolean(
      busyAction
    );


  async function refreshAfterMutation() {

    if (
      typeof onChanged ===
      "function"
    ) {

      await onChanged();
    }
  }


  async function runMutation({
    actionName,
    mutate,
    successText,
    mutationFailureText,
    refreshFailureText,
    afterSuccess,
  }) {

    if (
      actionBusy ||
      !taskId
    ) {
      return;
    }


    let mutationCompleted =
      false;


    setBusyAction(
      actionName
    );

    setErrorMessage("");
    setSuccessMessage("");


    try {

      await mutate();

      mutationCompleted =
        true;


      await refreshAfterMutation();


      if (
        typeof afterSuccess ===
        "function"
      ) {

        afterSuccess();
      }


      setSuccessMessage(
        successText
      );
    }
    catch (
      requestError
    ) {

      setErrorMessage(
        getErrorMessage(
          requestError,
          mutationCompleted
            ? refreshFailureText
            : mutationFailureText
        )
      );
    }
    finally {

      setBusyAction("");
    }
  }


  async function handleAssign() {

    if (
      !assignmentEditable ||
      actionBusy
    ) {
      return;
    }


    const staffId =
      Number(
        selectedStaffId
      );


    if (
      !Number.isFinite(
        staffId
      ) ||
      staffId <= 0
    ) {

      setErrorMessage(
        "Select a Maintenance staff member."
      );

      setSuccessMessage("");

      return;
    }


    if (
      assignedStaffId &&
      staffId ===
        assignedStaffId
    ) {

      setErrorMessage("");

      setSuccessMessage(
        "This staff member is already assigned to the task."
      );

      return;
    }


    const wasAssigned =
      Boolean(
        assignedStaffId
      );


    await runMutation({
      actionName:
        "assign",

      mutate:
        () =>
          maintenanceApi
            .assignTask(
              taskId,
              {
                staff_id:
                  staffId,
              }
            ),

      successText:
        wasAssigned
          ? "Maintenance task reassigned successfully."
          : "Maintenance task assigned successfully.",

      mutationFailureText:
        "The Maintenance task could not be assigned.",

      refreshFailureText:
        "Assignment was saved, but refreshed Maintenance task details could not be loaded.",
    });
  }


  async function handleUnassign() {

    if (
      !assignmentEditable ||
      !assignedStaffId ||
      actionBusy
    ) {
      return;
    }


    await runMutation({
      actionName:
        "unassign",

      mutate:
        () =>
          maintenanceApi
            .unassignTask(
              taskId
            ),

      successText:
        "Maintenance task unassigned successfully.",

      mutationFailureText:
        "The Maintenance task could not be unassigned.",

      refreshFailureText:
        "Unassignment was saved, but refreshed Maintenance task details could not be loaded.",
    });
  }


  async function handleStart() {

    if (
      !startAvailable ||
      actionBusy
    ) {
      return;
    }


    await runMutation({
      actionName:
        "start",

      mutate:
        () =>
          maintenanceApi
            .startTask(
              taskId,
              {}
            ),

      successText:
        "Maintenance work started successfully.",

      mutationFailureText:
        "The Maintenance task could not be started.",

      refreshFailureText:
        "Maintenance work was started, but refreshed task details could not be loaded.",
    });
  }


  function openCompletePanel() {

    if (
      !completeAvailable ||
      actionBusy
    ) {
      return;
    }


    setCompletePanelOpen(true);
    setCancelPanelOpen(false);
    setNotePanelOpen(false);

    setErrorMessage("");
    setSuccessMessage("");
  }


  async function handleComplete() {

    if (
      !completeAvailable ||
      actionBusy
    ) {
      return;
    }


    const normalizedNotes =
      resolutionNotes.trim();


    const payload =
      normalizedNotes
        ? {
            resolution_notes:
              normalizedNotes,
          }
        : {};


    await runMutation({
      actionName:
        "complete",

      mutate:
        () =>
          maintenanceApi
            .completeTask(
              taskId,
              payload
            ),

      successText:
        "Maintenance task completed successfully.",

      mutationFailureText:
        "The Maintenance task could not be completed.",

      refreshFailureText:
        "Maintenance was completed, but refreshed task details could not be loaded.",

      afterSuccess:
        () => {

          setCompletePanelOpen(false);
          setResolutionNotes("");
        },
    });
  }


  function openCancelPanel() {

    if (
      !cancelAvailable ||
      actionBusy
    ) {
      return;
    }


    setCancelPanelOpen(true);
    setCompletePanelOpen(false);
    setNotePanelOpen(false);

    setErrorMessage("");
    setSuccessMessage("");
  }


  async function handleCancel() {

    if (
      !cancelAvailable ||
      actionBusy
    ) {
      return;
    }


    const normalizedReason =
      cancellationReason.trim();


    if (
      !normalizedReason
    ) {

      setErrorMessage(
        "Cancellation reason is required."
      );

      setSuccessMessage("");

      return;
    }


    await runMutation({
      actionName:
        "cancel",

      mutate:
        () =>
          maintenanceApi
            .cancelTask(
              taskId,
              {
                cancellation_reason:
                  normalizedReason,
              }
            ),

      successText:
        "Maintenance task cancelled successfully.",

      mutationFailureText:
        "The Maintenance task could not be cancelled.",

      refreshFailureText:
        "The task was cancelled, but refreshed task details could not be loaded.",

      afterSuccess:
        () => {

          setCancelPanelOpen(false);
          setCancellationReason("");
        },
    });
  }


  function openNotePanel() {

    if (
      !noteAvailable ||
      actionBusy
    ) {
      return;
    }


    setNotePanelOpen(true);
    setCompletePanelOpen(false);
    setCancelPanelOpen(false);

    setErrorMessage("");
    setSuccessMessage("");
  }


  async function handleAddNote() {

    if (
      !noteAvailable ||
      actionBusy
    ) {
      return;
    }


    const normalizedNote =
      noteText.trim();


    if (
      !normalizedNote
    ) {

      setErrorMessage(
        "Note is required."
      );

      setSuccessMessage("");

      return;
    }


    await runMutation({
      actionName:
        "note",

      mutate:
        () =>
          maintenanceApi
            .addTaskNote(
              taskId,
              {
                note:
                  normalizedNote,
              }
            ),

      successText:
        "Note added to Maintenance task history.",

      mutationFailureText:
        "The Maintenance note could not be added.",

      refreshFailureText:
        "The note was added, but refreshed task details could not be loaded.",

      afterSuccess:
        () => {

          setNotePanelOpen(false);
          setNoteText("");
        },
    });
  }


  if (
    !task ||
    !taskId
  ) {

    return null;
  }


  return (
    <section
      className="maintenance-lifecycle"
      aria-label="Maintenance task actions"
    >
      <div className="maintenance-lifecycle__header">
        <div>
          <p className="maintenance-lifecycle__eyebrow">
            Task workflow
          </p>

          <h3 className="maintenance-lifecycle__title">
            Maintenance Actions
          </h3>
        </div>

        <span
          className="maintenance-lifecycle__status"
        >
          {taskStatus
            ? taskStatus.replaceAll(
                "_",
                " "
              )
            : "Unknown"}
        </span>
      </div>


      {assignmentEditable ? (
        <div className="maintenance-lifecycle__section">
          <h4 className="maintenance-lifecycle__section-title">
            Staff assignment
          </h4>

          <div className="maintenance-lifecycle__assignment">
            <label className="maintenance-lifecycle__field">
              <span>
                Maintenance staff
              </span>

              <select
                value={
                  selectedStaffId
                }
                onChange={
                  (event) =>
                    setSelectedStaffId(
                      event.target.value
                    )
                }
                disabled={
                  actionBusy
                }
              >
                <option value="">
                  Select staff
                </option>

                {staffOptions.map(
                  (staff) => (
                    <option
                      key={
                        staff.id
                      }
                      value={
                        staff.id
                      }
                    >
                      {staff.label}
                      {staff.code
                        ? ` · ${staff.code}`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </label>

            <div className="maintenance-lifecycle__actions">
              <button
                type="button"
                className="maintenance-button maintenance-button--primary"
                onClick={
                  handleAssign
                }
                disabled={
                  actionBusy ||
                  !selectedStaffId
                }
              >
                {assignedStaffId
                  ? "Reassign"
                  : "Assign"}
              </button>

              {assignedStaffId ? (
                <button
                  type="button"
                  className="maintenance-button maintenance-button--ghost"
                  onClick={
                    handleUnassign
                  }
                  disabled={
                    actionBusy
                  }
                >
                  Unassign
                </button>
              ) : null}
            </div>
          </div>

          <p className="maintenance-lifecycle__meta">
            {assignedStaffId
              ? `Currently assigned: ${
                  task?.assignedStaffName ||
                  task?.assignedStaffCode ||
                  `Staff #${assignedStaffId}`
                }`
              : "No staff is currently assigned."}
          </p>
        </div>
      ) : null}


      {ACTIVE_STATUSES.has(
        taskStatus
      ) ? (
        <div className="maintenance-lifecycle__section">
          <h4 className="maintenance-lifecycle__section-title">
            Lifecycle
          </h4>

          <div className="maintenance-lifecycle__actions">
            {startAvailable ? (
              <button
                type="button"
                className="maintenance-button maintenance-button--primary"
                onClick={
                  handleStart
                }
                disabled={
                  actionBusy
                }
              >
                Start Maintenance
              </button>
            ) : null}

            {completeAvailable ? (
              <button
                type="button"
                className="maintenance-button maintenance-button--primary"
                onClick={
                  openCompletePanel
                }
                disabled={
                  actionBusy
                }
              >
                Complete
              </button>
            ) : null}

            {cancelAvailable ? (
              <button
                type="button"
                className="maintenance-button maintenance-button--ghost"
                onClick={
                  openCancelPanel
                }
                disabled={
                  actionBusy
                }
              >
                Cancel Task
              </button>
            ) : null}

            {noteAvailable ? (
              <button
                type="button"
                className="maintenance-button maintenance-button--ghost"
                onClick={
                  openNotePanel
                }
                disabled={
                  actionBusy
                }
              >
                Add Note
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="maintenance-lifecycle__terminal">
          No further lifecycle actions are available for this task.
        </div>
      )}


      {completePanelOpen ? (
        <div className="maintenance-lifecycle__panel">
          <label className="maintenance-lifecycle__field">
            <span>
              Resolution notes
            </span>

            <textarea
              rows="3"
              value={
                resolutionNotes
              }
              onChange={
                (event) =>
                  setResolutionNotes(
                    event.target.value
                  )
              }
              placeholder="Optional work completed / resolution notes"
              disabled={
                actionBusy
              }
            />
          </label>

          <div className="maintenance-lifecycle__actions">
            <button
              type="button"
              className="maintenance-button maintenance-button--primary"
              onClick={
                handleComplete
              }
              disabled={
                actionBusy
              }
            >
              Confirm Complete
            </button>

            <button
              type="button"
              className="maintenance-button maintenance-button--ghost"
              onClick={
                () => {
                  setCompletePanelOpen(false);
                  setResolutionNotes("");
                }
              }
              disabled={
                actionBusy
              }
            >
              Back
            </button>
          </div>
        </div>
      ) : null}


      {cancelPanelOpen ? (
        <div className="maintenance-lifecycle__panel">
          <label className="maintenance-lifecycle__field">
            <span>
              Cancellation reason
            </span>

            <textarea
              rows="3"
              value={
                cancellationReason
              }
              onChange={
                (event) =>
                  setCancellationReason(
                    event.target.value
                  )
              }
              placeholder="Why is this Maintenance task being cancelled?"
              disabled={
                actionBusy
              }
              required
            />
          </label>

          <div className="maintenance-lifecycle__actions">
            <button
              type="button"
              className="maintenance-button maintenance-button--primary"
              onClick={
                handleCancel
              }
              disabled={
                actionBusy ||
                !cancellationReason.trim()
              }
            >
              Confirm Cancel
            </button>

            <button
              type="button"
              className="maintenance-button maintenance-button--ghost"
              onClick={
                () => {
                  setCancelPanelOpen(false);
                  setCancellationReason("");
                }
              }
              disabled={
                actionBusy
              }
            >
              Back
            </button>
          </div>
        </div>
      ) : null}


      {notePanelOpen ? (
        <div className="maintenance-lifecycle__panel">
          <label className="maintenance-lifecycle__field">
            <span>
              Task note
            </span>

            <textarea
              rows="3"
              value={
                noteText
              }
              onChange={
                (event) =>
                  setNoteText(
                    event.target.value
                  )
              }
              placeholder="Add an append-only Maintenance note"
              disabled={
                actionBusy
              }
              required
            />
          </label>

          <div className="maintenance-lifecycle__actions">
            <button
              type="button"
              className="maintenance-button maintenance-button--primary"
              onClick={
                handleAddNote
              }
              disabled={
                actionBusy ||
                !noteText.trim()
              }
            >
              Save Note
            </button>

            <button
              type="button"
              className="maintenance-button maintenance-button--ghost"
              onClick={
                () => {
                  setNotePanelOpen(false);
                  setNoteText("");
                }
              }
              disabled={
                actionBusy
              }
            >
              Back
            </button>
          </div>
        </div>
      ) : null}


      {errorMessage ? (
        <div
          className="maintenance-lifecycle__message maintenance-lifecycle__message--error"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}


      {successMessage ? (
        <div
          className="maintenance-lifecycle__message maintenance-lifecycle__message--success"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </div>
      ) : null}


      {actionBusy ? (
        <p
          className="maintenance-lifecycle__saving"
          role="status"
          aria-live="polite"
        >
          Saving Maintenance action...
        </p>
      ) : null}
    </section>
  );
}