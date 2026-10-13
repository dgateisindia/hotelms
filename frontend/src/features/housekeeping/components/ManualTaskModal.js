import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import housekeepingApi from "../api/housekeepingApi";
import roomsApi from "../../rooms/api/roomsApi";


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
    error?.message &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return fallback;
}


function normalizeRoom(
  room
) {
  const roomId =
    Number(
      room?.room_id
    );

  const roomNumber =
    String(
      room?.room_number ||
        ""
    ).trim();

  const roomType =
    String(
      room?.room_type ||
        ""
    ).trim();

  const status =
    String(
      room?.status ||
        ""
    )
      .trim()
      .toLowerCase();

  const floorValue =
    room?.floor_number;

  const floorNumber =
    floorValue === null ||
    floorValue === undefined ||
    floorValue === ""
      ? null
      : Number(
          floorValue
        );

  return {
    roomId,
    roomNumber,
    roomType,
    floorNumber,
    status,
  };
}


function roomOptionLabel(
  room
) {
  const parts = [
    room.roomNumber
      ? `Room ${room.roomNumber}`
      : `Room #${room.roomId}`,
  ];

  if (room.roomType) {
    parts.push(
      room.roomType
    );
  }

  if (
    Number.isFinite(
      room.floorNumber
    )
  ) {
    parts.push(
      `Floor ${room.floorNumber}`
    );
  }

  return parts.join(" • ");
}


export default function ManualTaskModal({
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
    notes,
    setNotes,
  ] = useState("");

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


  useEffect(
    () => {
      if (!open) {
        return undefined;
      }

      let active = true;

      setRoomId("");
      setNotes("");
      setRooms([]);
      setLoadError("");
      setSubmitError("");
      setLoadingRooms(true);

      async function loadEligibleRooms() {
        try {
          const response =
            await roomsApi.getRooms();

          const sourceRooms =
            Array.isArray(
              response?.data
            )
              ? response.data
              : [];

          const availableRooms =
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
                  room.status ===
                    "available"
              )
              .sort(
                (left, right) =>
                  String(
                    left.roomNumber
                  ).localeCompare(
                    String(
                      right.roomNumber
                    ),
                    undefined,
                    {
                      numeric: true,
                      sensitivity:
                        "base",
                    }
                  )
              );

          if (!active) {
            return;
          }

          setRooms(
            availableRooms
          );
        }
        catch (requestError) {
          if (!active) {
            return;
          }

          setRooms([]);

          setLoadError(
            getErrorMessage(
              requestError,
              "Available rooms could not be loaded. Please try again."
            )
          );
        }
        finally {
          if (active) {
            setLoadingRooms(
              false
            );
          }
        }
      }

      void loadEligibleRooms();

      return () => {
        active = false;
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
          !submitting &&
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
      submitting,
    ]
  );


  const selectedRoom =
    useMemo(
      () => {
        const selectedId =
          Number(
            roomId
          );

        if (
          !Number.isInteger(
            selectedId
          ) ||
          selectedId <= 0
        ) {
          return null;
        }

        return (
          rooms.find(
            (room) =>
              room.roomId ===
              selectedId
          ) ||
          null
        );
      },
      [
        roomId,
        rooms,
      ]
    );


  if (!open) {
    return null;
  }


  const canSubmit =
    !loadingRooms &&
    !submitting &&
    Boolean(
      selectedRoom
    );


  function handleClose() {
    if (
      submitting
    ) {
      return;
    }

    if (
      typeof onClose ===
      "function"
    ) {
      onClose();
    }
  }


  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    setSubmitError("");

    const numericRoomId =
      Number(
        roomId
      );

    if (
      !Number.isInteger(
        numericRoomId
      ) ||
      numericRoomId <= 0 ||
      !selectedRoom
    ) {
      setSubmitError(
        "Select an available room."
      );

      return;
    }

    setSubmitting(true);

    let createdData =
      null;

    try {
      const payload = {
        room_id:
          numericRoomId,
      };

      const normalizedNotes =
        notes.trim();

      if (
        normalizedNotes
      ) {
        payload.notes =
          normalizedNotes;
      }

      const response =
        await housekeepingApi
          .createManualTask(
            payload
          );

      const responsePayload =
        response?.data;

      if (
        responsePayload
          ?.success !== true ||
        !responsePayload
          ?.data
          ?.task
      ) {
        throw new Error(
          "Invalid manual housekeeping response."
        );
      }

      createdData =
        responsePayload.data;
    }
    catch (requestError) {
      setSubmitError(
        getErrorMessage(
          requestError,
          "The manual housekeeping task could not be created."
        )
      );

      setSubmitting(false);

      return;
    }

    setSubmitting(false);

    if (
      typeof onCreated ===
      "function"
    ) {
      onCreated(
        createdData
      );
    }

    if (
      typeof onClose ===
      "function"
    ) {
      onClose();
    }
  }


  return (
    <div
      className="housekeeping-modal-backdrop"
      onMouseDown={
        (event) => {
          if (
            event.target ===
              event.currentTarget
          ) {
            handleClose();
          }
        }
      }
    >
      <section
        className="housekeeping-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-housekeeping-title"
        aria-describedby="manual-housekeeping-description"
      >
        <header className="housekeeping-modal__header">
          <div className="housekeeping-modal__title-block">
            <p className="housekeeping-page__eyebrow">
              Room Operations
            </p>

            <h2 id="manual-housekeeping-title">
              Create Manual Cleaning
            </h2>

            <p
              id="manual-housekeeping-description"
              className="housekeeping-modal__subtitle"
            >
              Create a cleaning task for a room
              that is currently available.
            </p>
          </div>

          <button
            type="button"
            className="housekeeping-modal__close"
            onClick={
              handleClose
            }
            disabled={
              submitting
            }
            aria-label="Close manual cleaning dialog"
          >
            ×
          </button>
        </header>

        <form
          onSubmit={
            handleSubmit
          }
        >
          <div className="housekeeping-modal__body">
            {loadError && (
              <div
                className="housekeeping-alert housekeeping-alert--error"
                role="alert"
              >
                {loadError}
              </div>
            )}

            {submitError && (
              <div
                className="housekeeping-alert housekeeping-alert--error"
                role="alert"
              >
                {submitError}
              </div>
            )}

            <label className="housekeeping-field housekeeping-field--full">
              <span>
                Available room
              </span>

              <select
                value={
                  roomId
                }
                onChange={
                  (event) => {
                    setRoomId(
                      event.target
                        .value
                    );

                    setSubmitError(
                      ""
                    );
                  }
                }
                disabled={
                  loadingRooms ||
                  submitting ||
                  rooms.length ===
                    0
                }
                required
                autoFocus
              >
                <option value="">
                  {loadingRooms
                    ? "Loading available rooms..."
                    : rooms.length === 0
                      ? "No available rooms"
                      : "Select a room"}
                </option>

                {rooms.map(
                  (room) => (
                    <option
                      key={
                        room.roomId
                      }
                      value={
                        room.roomId
                      }
                    >
                      {roomOptionLabel(
                        room
                      )}
                    </option>
                  )
                )}
              </select>
            </label>

            {!loadingRooms &&
              !loadError &&
              rooms.length ===
                0 && (
                <p className="housekeeping-modal__hint">
                  There are currently no rooms
                  marked Available for manual
                  cleaning.
                </p>
              )}

            {selectedRoom && (
              <div className="housekeeping-modal__room-preview">
                <strong>
                  {selectedRoom
                    .roomNumber
                    ? `Room ${selectedRoom.roomNumber}`
                    : `Room #${selectedRoom.roomId}`}
                </strong>

                <span>
                  {selectedRoom
                    .roomType ||
                    "Room type not set"}
                </span>

                <span>
                  Status: Available
                </span>
              </div>
            )}

            <label className="housekeeping-field housekeeping-field--full">
              <span>
                Notes
                {" "}
                <small>
                  (optional)
                </small>
              </span>

              <textarea
                value={
                  notes
                }
                onChange={
                  (event) =>
                    setNotes(
                      event.target
                        .value
                    )
                }
                rows="4"
                placeholder="Add cleaning instructions or operational notes"
                disabled={
                  submitting
                }
              />
            </label>
          </div>

          <footer className="housekeeping-modal__footer">
            <button
              type="button"
              className="housekeeping-button housekeeping-button--ghost"
              onClick={
                handleClose
              }
              disabled={
                submitting
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              className="housekeeping-button housekeeping-button--primary"
              disabled={
                !canSubmit
              }
            >
              {submitting
                ? "Creating..."
                : "Create Cleaning Task"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}