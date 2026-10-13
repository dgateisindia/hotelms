import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import roomsApi from "../../rooms/api/roomsApi";
import maintenanceApi from "../api/maintenanceApi";


const PRIORITY_OPTIONS = [
  {
    value: "low",
    label: "Low",
  },
  {
    value: "medium",
    label: "Medium",
  },
  {
    value: "high",
    label: "High",
  },
  {
    value: "urgent",
    label: "Urgent",
  },
];


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


function normalizeRoom(
  room
) {
  const roomId =
    Number(
      room?.roomId ??
      room?.room_id ??
      room?.id
    );

  const roomNumber =
    String(
      room?.roomNumber ??
      room?.room_number ??
      room?.roomNo ??
      room?.room_no ??
      ""
    ).trim();

  const roomType =
    String(
      room?.roomType ??
      room?.room_type ??
      room?.type ??
      ""
    ).trim();

  const status =
    String(
      room?.status || ""
    )
      .trim()
      .toLowerCase();

  return {
    roomId,
    roomNumber,
    roomType,
    status,
  };
}


function roomStatusLabel(
  status
) {
  if (
    status === "available"
  ) {
    return "Available";
  }

  if (
    status === "cleaning"
  ) {
    return "Cleaning";
  }

  return status || "Unknown";
}


export default function ManualMaintenanceTaskModal({
  open,
  onClose,
  onCreated,
}) {

  const [
    rooms,
    setRooms,
  ] = useState([]);

  const [
    roomId,
    setRoomId,
  ] = useState("");

  const [
    issueTitle,
    setIssueTitle,
  ] = useState("");

  const [
    issueDescription,
    setIssueDescription,
  ] = useState("");

  const [
    priority,
    setPriority,
  ] = useState("medium");

  const [
    loadingRooms,
    setLoadingRooms,
  ] = useState(false);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    submitError,
    setSubmitError,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);


  const eligibleRooms =
    useMemo(
      () =>
        rooms
          .filter(
            (room) =>
              [
                "available",
                "cleaning",
              ].includes(
                room.status
              )
          )
          .sort(
            (
              left,
              right
            ) =>
              String(
                left.roomNumber
              ).localeCompare(
                String(
                  right.roomNumber
                ),
                undefined,
                {
                  numeric: true,
                  sensitivity: "base",
                }
              )
          ),
      [
        rooms,
      ]
    );


  useEffect(
    () => {

      if (!open) {
        return undefined;
      }


      let active =
        true;


      setRoomId("");
      setIssueTitle("");
      setIssueDescription("");
      setPriority("medium");

      setRooms([]);
      setLoadError("");
      setSubmitError("");

      setLoadingRooms(true);


      async function loadRooms() {

        try {

          const response =
            await roomsApi.getRooms();


          const sourceRooms =
            Array.isArray(
              response?.data
            )
              ? response.data
              : Array.isArray(
                  response?.data?.data
                )
                ? response.data.data
                : [];


          const normalizedRooms =
            sourceRooms
              .map(
                normalizeRoom
              )
              .filter(
                (room) =>
                  Number.isInteger(
                    room.roomId
                  ) &&
                  room.roomId > 0 &&
                  room.roomNumber
              );


          if (active) {

            setRooms(
              normalizedRooms
            );
          }
        }
        catch (
          error
        ) {

          if (active) {

            setLoadError(
              getErrorMessage(
                error,
                "Unable to load rooms."
              )
            );
          }
        }
        finally {

          if (active) {

            setLoadingRooms(
              false
            );
          }
        }
      }


      loadRooms();


      return () => {

        active =
          false;
      };
    },
    [
      open,
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
          !submitting
        ) {

          onClose();
        }
      }


      document.addEventListener(
        "keydown",
        handleKeyDown
      );


      return () => {

        document.removeEventListener(
          "keydown",
          handleKeyDown
        );
      };
    },
    [
      open,
      submitting,
      onClose,
    ]
  );


  if (!open) {
    return null;
  }


  function handleBackdropMouseDown(
    event
  ) {

    if (
      event.target ===
        event.currentTarget &&
      !submitting
    ) {

      onClose();
    }
  }


  async function handleSubmit(
    event
  ) {

    event.preventDefault();

    setSubmitError("");


    const selectedRoomId =
      Number(roomId);

    if (
      !Number.isInteger(
        selectedRoomId
      ) ||
      selectedRoomId <= 0
    ) {

      setSubmitError(
        "Select a room for maintenance."
      );

      return;
    }


    const selectedRoom =
      eligibleRooms.find(
        (room) =>
          room.roomId ===
          selectedRoomId
      );


    if (!selectedRoom) {

      setSubmitError(
        "The selected room is not eligible for a manual maintenance request."
      );

      return;
    }


    const normalizedTitle =
      String(
        issueTitle || ""
      ).trim();


    if (!normalizedTitle) {

      setSubmitError(
        "Issue title is required."
      );

      return;
    }


    const validPriority =
      PRIORITY_OPTIONS.some(
        (option) =>
          option.value ===
          priority
      );


    if (!validPriority) {

      setSubmitError(
        "Select a valid priority."
      );

      return;
    }


    const normalizedDescription =
      String(
        issueDescription ||
        ""
      ).trim();


    const payload = {
      room_id:
        selectedRoomId,

      issue_title:
        normalizedTitle,

      priority,
    };


    if (
      normalizedDescription
    ) {

      payload.issue_description =
        normalizedDescription;
    }


    setSubmitting(true);


    try {

      const response =
        await maintenanceApi
          .createManualTask(
            payload
          );


      if (
        typeof onCreated ===
        "function"
      ) {

        await onCreated(
          response?.data?.data ??
          null
        );
      }


      onClose();
    }
    catch (
      error
    ) {

      setSubmitError(
        getErrorMessage(
          error,
          "Unable to create the maintenance request."
        )
      );
    }
    finally {

      setSubmitting(false);
    }
  }


  return (
    <div
      className="maintenance-modal-backdrop"
      onMouseDown={
        handleBackdropMouseDown
      }
    >
      <section
        className="maintenance-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-maintenance-title"
        onMouseDown={(
          event
        ) =>
          event.stopPropagation()
        }
      >

        <header
          className="maintenance-modal__header"
        >
          <div>
            <h2
              id="manual-maintenance-title"
            >
              New Maintenance Request
            </h2>

            <p>
              Create a maintenance task for an
              Available or Cleaning room.
            </p>
          </div>

          <button
            type="button"
            className="maintenance-modal__close"
            aria-label="Close manual maintenance request"
            disabled={
              submitting
            }
            onClick={
              onClose
            }
          >
            ×
          </button>
        </header>


        <form
          className="maintenance-modal__form"
          onSubmit={
            handleSubmit
          }
        >

          <div
            className="maintenance-modal__body"
          >

            {loadError && (
              <div
                className="maintenance-form-message maintenance-form-message--error"
                role="alert"
              >
                {loadError}
              </div>
            )}


            {submitError && (
              <div
                className="maintenance-form-message maintenance-form-message--error"
                role="alert"
              >
                {submitError}
              </div>
            )}


            <label
              className="maintenance-modal__field"
            >
              <span>
                Room
              </span>

              <select
                value={
                  roomId
                }
                disabled={
                  loadingRooms ||
                  submitting
                }
                required
                onChange={(
                  event
                ) =>
                  setRoomId(
                    event.target
                      .value
                  )
                }
              >
                <option
                  value=""
                >
                  {
                    loadingRooms
                      ? "Loading rooms..."
                      : "Select room"
                  }
                </option>

                {eligibleRooms.map(
                  (room) => (
                    <option
                      key={
                        room.roomId
                      }
                      value={
                        room.roomId
                      }
                    >
                      Room{" "}
                      {room.roomNumber}
                      {room.roomType
                        ? ` — ${room.roomType}`
                        : ""}
                      {" — "}
                      {
                        roomStatusLabel(
                          room.status
                        )
                      }
                    </option>
                  )
                )}
              </select>
            </label>


            {!loadingRooms &&
              !loadError &&
              eligibleRooms.length ===
                0 && (
                <p
                  className="maintenance-modal__hint"
                >
                  No Available or Cleaning rooms
                  are currently eligible for a
                  manual maintenance request.
                </p>
              )}


            <label
              className="maintenance-modal__field"
            >
              <span>
                Issue title
              </span>

              <input
                type="text"
                value={
                  issueTitle
                }
                disabled={
                  submitting
                }
                required
                autoComplete="off"
                placeholder="Example: AC not cooling"
                onChange={(
                  event
                ) =>
                  setIssueTitle(
                    event.target
                      .value
                  )
                }
              />
            </label>


            <label
              className="maintenance-modal__field"
            >
              <span>
                Priority
              </span>

              <select
                value={
                  priority
                }
                disabled={
                  submitting
                }
                onChange={(
                  event
                ) =>
                  setPriority(
                    event.target
                      .value
                  )
                }
              >
                {PRIORITY_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </label>


            <label
              className="maintenance-modal__field"
            >
              <span>
                Description
                <small>
                  Optional
                </small>
              </span>

              <textarea
                value={
                  issueDescription
                }
                disabled={
                  submitting
                }
                rows="4"
                placeholder="Add useful details for the maintenance team..."
                onChange={(
                  event
                ) =>
                  setIssueDescription(
                    event.target
                      .value
                  )
                }
              />
            </label>


            <p
              className="maintenance-modal__hint"
            >
              Occupied rooms and rooms already
              under Maintenance are intentionally
              not selectable here.
            </p>

          </div>


          <footer
            className="maintenance-modal__footer"
          >
            <button
              type="button"
              className="maintenance-button maintenance-button--ghost"
              disabled={
                submitting
              }
              onClick={
                onClose
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              className="maintenance-button maintenance-button--primary"
              disabled={
                submitting ||
                loadingRooms ||
                eligibleRooms.length === 0
              }
            >
              {
                submitting
                  ? "Creating..."
                  : "Create Request"
              }
            </button>
          </footer>

        </form>

      </section>
    </div>
  );
}