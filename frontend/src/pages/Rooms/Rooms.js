// ============================================================
// Rooms.js — Hotel-scoped Room Management
//
// API:
// GET    /api/rooms
// POST   /api/rooms
// PUT    /api/rooms/:id
// DELETE /api/rooms/:id
//
// Security:
// Backend resolves hotel_id from authenticated Admin account.
// Frontend never sends or trusts hotel_id.
// ============================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import apiClient from "../../services/apiClient";

import "../../styles/Rooms.css";

import {
  IcoPlus,
  IcoSearch,
  IcoEye,
  IcoEdit,
  IcoTrash,
  IcoChevL,
  IcoChevR,
  IcoWarn,
  IcoBed2,
  IcoCheck2,
  IcoUser2,
  IcoBrush,
  IcoWrench,
} from "../../utils/icons/RoomsIcons";

/* ============================================================
   CONSTANTS
============================================================ */

const PER_PAGE = 8;

const EMPTY_FORM = {
  roomNo: "",
  type: "Deluxe Room",
  floor: "1",
  capacity: "2",
  price: "",
  status: "available",
};

const COMMON_ROOM_TYPES = [
  "Deluxe Room",
  "Premium Room",
  "Suite Room",
  "Executive Room",
  "Presidential Suite",
];

const ROOM_STATUS_OPTIONS = [
  {
    value: "available",
    label: "Available",
  },
  {
    value: "occupied",
    label: "Occupied",
  },
  {
    value: "cleaning",
    label: "Cleaning",
  },
  {
    value: "maintenance",
    label: "Maintenance",
  },
];

/* ============================================================
   HELPERS
============================================================ */

function statusClass(status) {
  const classes = {
    available: "badge-available",
    occupied: "badge-occupied",
    cleaning: "badge-cleaning",
    maintenance:
      "badge-maintenance",
  };

  const normalizedStatus =
    String(status || "")
      .trim()
      .toLowerCase();

  return [
    "badge",
    classes[normalizedStatus] || "",
  ]
    .filter(Boolean)
    .join(" ");
}

function statusLabel(status) {
  const normalizedStatus =
    String(status || "")
      .trim()
      .toLowerCase();

  const option =
    ROOM_STATUS_OPTIONS.find(
      (item) =>
        item.value ===
        normalizedStatus
    );

  return (
    option?.label ||
    "Unknown"
  );
}

function formatCurrency(value) {
  const amount = Number(value);

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(amount)
      ? amount
      : 0
  );
}

function getApiErrorMessage(
  error,
  fallbackMessage
) {
  return (
    error?.response?.data
      ?.message ||
    error?.response?.data
      ?.error ||
    error?.message ||
    fallbackMessage
  );
}

function validateRoomForm(form) {
  const roomNo =
    String(
      form.roomNo || ""
    ).trim();

  if (!roomNo) {
    return "Room number is required.";
  }

  if (roomNo.length > 20) {
    return "Room number must not exceed 20 characters.";
  }

  const roomType =
    String(
      form.type || ""
    ).trim();

  if (!roomType) {
    return "Room type is required.";
  }

  if (roomType.length > 100) {
    return "Room type must not exceed 100 characters.";
  }

  const floor =
    Number(form.floor);

  if (
    !Number.isInteger(floor) ||
    floor < 0
  ) {
    return "Floor must be a whole number greater than or equal to 0.";
  }

  const capacity =
    Number(form.capacity);

  if (
    !Number.isInteger(
      capacity
    ) ||
    capacity < 1
  ) {
    return "Capacity must be at least 1 guest.";
  }

  const price =
    Number(form.price);

  if (
    !Number.isFinite(price) ||
    price < 0
  ) {
    return "Price per night must be a valid non-negative amount.";
  }

  const validStatus =
    ROOM_STATUS_OPTIONS.some(
      (option) =>
        option.value ===
        form.status
    );

  if (!validStatus) {
    return "Please select a valid room status.";
  }

  return "";
}

/* ============================================================
   REUSABLE ROOM FORM MODAL

   Defined outside Rooms() so it does not get recreated on
   every keystroke.
============================================================ */

function RoomFormModal({
  title,
  form,
  onChange,
  onSave,
  onClose,
  isSaving,
  error,
}) {
  const handleOverlayMouseDown = (
    event
  ) => {
    if (
      event.target ===
        event.currentTarget &&
      !isSaving
    ) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={
        handleOverlayMouseDown
      }
    >
      <div
        className="modal-box"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="modal-header">
          <h3>{title}</h3>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close room form"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSave}>
          <div className="modal-body">
            {error && (
              <div
                className="room-form-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="modal-grid">
              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-number"
                >
                  Room No.
                </label>

                <input
                  id="room-number"
                  className="form-input"
                  name="roomNo"
                  value={form.roomNo}
                  onChange={onChange}
                  placeholder="e.g. 101"
                  maxLength={20}
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-floor"
                >
                  Floor
                </label>

                <input
                  id="room-floor"
                  className="form-input"
                  type="number"
                  name="floor"
                  min="0"
                  step="1"
                  value={form.floor}
                  onChange={onChange}
                  placeholder="e.g. 1"
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-type"
                >
                  Room Type
                </label>

                <input
                  id="room-type"
                  className="form-input"
                  name="type"
                  list="room-type-options"
                  value={form.type}
                  onChange={onChange}
                  placeholder="e.g. Deluxe Room"
                  maxLength={100}
                  disabled={isSaving}
                  required
                />

                <datalist id="room-type-options">
                  {COMMON_ROOM_TYPES.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      />
                    )
                  )}
                </datalist>
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-capacity"
                >
                  Capacity
                </label>

                <input
                  id="room-capacity"
                  className="form-input"
                  type="number"
                  name="capacity"
                  min="1"
                  step="1"
                  value={form.capacity}
                  onChange={onChange}
                  placeholder="e.g. 2"
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-price"
                >
                  Price / Night
                </label>

                <input
                  id="room-price"
                  className="form-input"
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={onChange}
                  placeholder="e.g. 4000"
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-status"
                >
                  Status
                </label>

                <select
                  id="room-status"
                  className="form-select"
                  name="status"
                  value={form.status}
                  onChange={onChange}
                  disabled={isSaving}
                  required
                >
                  {ROOM_STATUS_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-save"
              disabled={isSaving}
            >
              {isSaving
                ? "Saving..."
                : "Save Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

function Rooms() {
  const [
    rooms,
    setRooms,
  ] = useState([]);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filterFloor,
    setFilterFloor,
  ] = useState("all");

  const [
    filterType,
    setFilterType,
  ] = useState("all");

  const [
    filterStatus,
    setFilterStatus,
  ] = useState("all");

  const [
    page,
    setPage,
  ] = useState(1);

  /* ==========================================================
     MODAL STATE
  ========================================================== */

  const [
    showAdd,
    setShowAdd,
  ] = useState(false);

  const [
    showEdit,
    setShowEdit,
  ] = useState(false);

  const [
    showView,
    setShowView,
  ] = useState(false);

  const [
    showDelete,
    setShowDelete,
  ] = useState(false);

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState({
    ...EMPTY_FORM,
  });

  /* ==========================================================
     REQUEST STATE
  ========================================================== */

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    actionError,
    setActionError,
  ] = useState("");

  const [
    formError,
    setFormError,
  ] = useState("");

  /* ==========================================================
     LOAD ROOMS
  ========================================================== */

  const fetchRooms =
    useCallback(async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const response =
          await apiClient.get(
            "/rooms"
          );

        const sourceRooms =
          Array.isArray(
            response?.data
          )
            ? response.data
            : [];

        const formattedRooms =
          sourceRooms.map(
            (room) => ({
              id:
                Number(
                  room.room_id
                ),

              roomNo:
                String(
                  room.room_number ||
                    ""
                ),

              type:
                String(
                  room.room_type ||
                    ""
                ),

              floor:
                room.floor_number ===
                null
                  ? null
                  : Number(
                      room.floor_number
                    ),

              capacity:
                Number(
                  room.capacity || 0
                ),

              price:
                Number(
                  room.price_per_night ||
                    0
                ),

              status:
                String(
                  room.status ||
                    ""
                )
                  .trim()
                  .toLowerCase(),
            })
          );

        setRooms(
          formattedRooms
        );
      } catch (error) {
        console.error(
          "[ROOMS:FETCH]",
          error
        );

        setLoadError(
          getApiErrorMessage(
            error,
            "Rooms could not be loaded. Please try again."
          )
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    void fetchRooms();
  }, [fetchRooms]);

  /* ==========================================================
     FILTER OPTIONS
  ========================================================== */

  const floorOptions =
    useMemo(() => {
      return Array.from(
        new Set(
          rooms
            .map(
              (room) =>
                room.floor
            )
            .filter(
              (floor) =>
                floor !== null &&
                Number.isInteger(
                  floor
                )
            )
        )
      ).sort(
        (first, second) =>
          first - second
      );
    }, [rooms]);

  const typeOptions =
    useMemo(() => {
      return Array.from(
        new Set(
          rooms
            .map(
              (room) =>
                room.type
            )
            .filter(Boolean)
        )
      ).sort((first, second) =>
        first.localeCompare(
          second
        )
      );
    }, [rooms]);

  /* ==========================================================
     FILTERING
  ========================================================== */

  const filtered =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return rooms.filter(
        (room) => {
          const matchSearch =
            !normalizedSearch ||
            room.roomNo
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            room.type
              .toLowerCase()
              .includes(
                normalizedSearch
              );

          const matchFloor =
            filterFloor ===
              "all" ||
            room.floor ===
              Number(
                filterFloor
              );

          const matchType =
            filterType ===
              "all" ||
            room.type ===
              filterType;

          const matchStatus =
            filterStatus ===
              "all" ||
            room.status ===
              filterStatus;

          return (
            matchSearch &&
            matchFloor &&
            matchType &&
            matchStatus
          );
        }
      );
    }, [
      rooms,
      search,
      filterFloor,
      filterType,
      filterStatus,
    ]);

  const totalPages =
    Math.ceil(
      filtered.length /
        PER_PAGE
    );

  useEffect(() => {
    if (
      totalPages === 0
    ) {
      if (page !== 1) {
        setPage(1);
      }

      return;
    }

    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [
    page,
    totalPages,
  ]);

  const paginated =
    useMemo(() => {
      const startIndex =
        (page - 1) *
        PER_PAGE;

      return filtered.slice(
        startIndex,
        startIndex +
          PER_PAGE
      );
    }, [
      filtered,
      page,
    ]);

  /* ==========================================================
     STATISTICS
  ========================================================== */

  const totalRooms =
    rooms.length;

  const availableRooms =
    rooms.filter(
      (room) =>
        room.status ===
        "available"
    ).length;

  const occupiedRooms =
    rooms.filter(
      (room) =>
        room.status ===
        "occupied"
    ).length;

  const cleaningRooms =
    rooms.filter(
      (room) =>
        room.status ===
        "cleaning"
    ).length;

  const maintenanceRooms =
    rooms.filter(
      (room) =>
        room.status ===
        "maintenance"
    ).length;

  const getPercentage = (
    value
  ) =>
    totalRooms > 0
      ? Math.round(
          (value /
            totalRooms) *
            100
        )
      : 0;

  /* ==========================================================
     MODAL HANDLERS
  ========================================================== */

  const openAdd = () => {
    setSelected(null);

    setForm({
      ...EMPTY_FORM,
    });

    setFormError("");
    setActionError("");
    setShowAdd(true);
  };

  const openEdit = (room) => {
    setSelected(room);

    setForm({
      roomNo:
        room.roomNo,

      type:
        room.type,

      floor:
        room.floor === null
          ? ""
          : String(
              room.floor
            ),

      capacity:
        String(
          room.capacity
        ),

      price:
        String(
          room.price
        ),

      status:
        room.status,
    });

    setFormError("");
    setActionError("");
    setShowEdit(true);
  };

  const openView = (room) => {
    setSelected(room);
    setShowView(true);
  };

  const openDelete = (
    room
  ) => {
    setSelected(room);
    setActionError("");
    setShowDelete(true);
  };

  const handleFormChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setForm(
      (currentForm) => ({
        ...currentForm,
        [name]: value,
      })
    );

    if (formError) {
      setFormError("");
    }
  };

  /* ==========================================================
     CREATE ROOM
  ========================================================== */

  const handleAdd = async (
    event
  ) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const validationError =
      validateRoomForm(form);

    if (validationError) {
      setFormError(
        validationError
      );

      return;
    }

    setIsSaving(true);
    setFormError("");
    setActionError("");

    try {
      await apiClient.post(
        "/rooms",
        {
          roomNo:
            form.roomNo.trim(),

          type:
            form.type.trim(),

          floor:
            Number(
              form.floor
            ),

          capacity:
            Number(
              form.capacity
            ),

          price:
            Number(
              form.price
            ),

          status:
            form.status,
        }
      );

      await fetchRooms();

      setShowAdd(false);

      setForm({
        ...EMPTY_FORM,
      });
    } catch (error) {
      console.error(
        "[ROOMS:CREATE]",
        error
      );

      setFormError(
        getApiErrorMessage(
          error,
          "The room could not be created."
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* ==========================================================
     UPDATE ROOM
  ========================================================== */

  const handleEdit = async (
    event
  ) => {
    event.preventDefault();

    if (
      isSaving ||
      !selected?.id
    ) {
      return;
    }

    const validationError =
      validateRoomForm(form);

    if (validationError) {
      setFormError(
        validationError
      );

      return;
    }

    setIsSaving(true);
    setFormError("");
    setActionError("");

    try {
      await apiClient.put(
        `/rooms/${selected.id}`,
        {
          roomNo:
            form.roomNo.trim(),

          type:
            form.type.trim(),

          floor:
            Number(
              form.floor
            ),

          capacity:
            Number(
              form.capacity
            ),

          price:
            Number(
              form.price
            ),

          status:
            form.status,
        }
      );

      await fetchRooms();

      setShowEdit(false);
      setSelected(null);
    } catch (error) {
      console.error(
        "[ROOMS:UPDATE]",
        error
      );

      setFormError(
        getApiErrorMessage(
          error,
          "The room could not be updated."
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* ==========================================================
     DELETE ROOM
  ========================================================== */

  const handleDelete =
    async () => {
      if (
        isDeleting ||
        !selected?.id
      ) {
        return;
      }

      setIsDeleting(true);
      setActionError("");

      try {
        await apiClient.delete(
          `/rooms/${selected.id}`
        );

        await fetchRooms();

        setShowDelete(false);
        setSelected(null);
      } catch (error) {
        console.error(
          "[ROOMS:DELETE]",
          error
        );

        setActionError(
          getApiErrorMessage(
            error,
            "The room could not be deleted."
          )
        );
      } finally {
        setIsDeleting(false);
      }
    };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="rooms-page">
      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="page-header">
        <div className="page-header-left">
          <h2>Rooms</h2>

          <p>
            Manage rooms for your
            hotel and keep their
            operational status up to
            date.
          </p>
        </div>

        <div className="page-header-right">
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Search by room no. or type..."
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value
                );

                setPage(1);
              }}
            />

            <IcoSearch />
          </div>

          <button
            type="button"
            className="btn-add-room"
            onClick={openAdd}
          >
            <IcoPlus />
            Add New Room
          </button>
        </div>
      </div>

      {/* ======================================================
          LOAD / ACTION ERROR
      ====================================================== */}

      {loadError && (
        <div
          className="rooms-error-banner"
          role="alert"
        >
          <span>{loadError}</span>

          <button
            type="button"
            onClick={fetchRooms}
          >
            Retry
          </button>
        </div>
      )}

      {actionError &&
        !showDelete && (
          <div
            className="rooms-error-banner"
            role="alert"
          >
            {actionError}
          </div>
        )}

      {/* ======================================================
          FILTER BAR
      ====================================================== */}

      <div className="filter-bar">
        <select
          className="filter-select"
          value={filterFloor}
          onChange={(event) => {
            setFilterFloor(
              event.target.value
            );

            setPage(1);
          }}
        >
          <option value="all">
            All Floors
          </option>

          {floorOptions.map(
            (floor) => (
              <option
                key={floor}
                value={String(
                  floor
                )}
              >
                Floor {floor}
              </option>
            )
          )}
        </select>

        <select
          className="filter-select"
          value={filterType}
          onChange={(event) => {
            setFilterType(
              event.target.value
            );

            setPage(1);
          }}
        >
          <option value="all">
            All Room Types
          </option>

          {typeOptions.map(
            (type) => (
              <option
                key={type}
                value={type}
              >
                {type}
              </option>
            )
          )}
        </select>

        <select
          className="filter-select"
          value={filterStatus}
          onChange={(event) => {
            setFilterStatus(
              event.target.value
            );

            setPage(1);
          }}
        >
          <option value="all">
            All Status
          </option>

          {ROOM_STATUS_OPTIONS.map(
            (option) => (
              <option
                key={option.value}
                value={
                  option.value
                }
              >
                {option.label}
              </option>
            )
          )}
        </select>

        <div className="filter-spacer" />
      </div>

      {/* ======================================================
          ROOMS TABLE
      ====================================================== */}

      <div className="rooms-card">
        <table className="rooms-table">
          <thead>
            <tr>
              <th>Room No.</th>
              <th>Room Type</th>
              <th>Floor</th>
              <th>Capacity</th>
              <th>Price / Night</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={7}
                  className="rooms-table-message"
                >
                  Loading rooms...
                </td>
              </tr>
            ) : paginated.length ===
              0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="rooms-table-message"
                >
                  No rooms found.
                </td>
              </tr>
            ) : (
              paginated.map(
                (room) => (
                  <tr key={room.id}>
                    <td
                      style={{
                        fontWeight:
                          600,
                      }}
                    >
                      {room.roomNo}
                    </td>

                    <td>
                      {room.type}
                    </td>

                    <td>
                      {room.floor ??
                        "—"}
                    </td>

                    <td>
                      {room.capacity}{" "}
                      {room.capacity ===
                      1
                        ? "Guest"
                        : "Guests"}
                    </td>

                    <td
                      style={{
                        fontWeight:
                          600,
                      }}
                    >
                      {formatCurrency(
                        room.price
                      )}
                    </td>

                    <td>
                      <span
                        className={statusClass(
                          room.status
                        )}
                      >
                        {statusLabel(
                          room.status
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="action-btns">
                        <button
                          type="button"
                          className="btn-icon btn-icon-view"
                          title="View"
                          aria-label={`View room ${room.roomNo}`}
                          onClick={() =>
                            openView(
                              room
                            )
                          }
                        >
                          <IcoEye />
                        </button>

                        <button
                          type="button"
                          className="btn-icon btn-icon-edit"
                          title="Edit"
                          aria-label={`Edit room ${room.roomNo}`}
                          onClick={() =>
                            openEdit(
                              room
                            )
                          }
                        >
                          <IcoEdit />
                        </button>

                        <button
                          type="button"
                          className="btn-icon btn-icon-delete"
                          title="Delete"
                          aria-label={`Delete room ${room.roomNo}`}
                          onClick={() =>
                            openDelete(
                              room
                            )
                          }
                        >
                          <IcoTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>

        {/* ====================================================
            PAGINATION
        ==================================================== */}

        <div className="pagination">
          <span className="pagination-info">
            Showing{" "}
            {filtered.length === 0
              ? 0
              : (page - 1) *
                  PER_PAGE +
                1}{" "}
            to{" "}
            {Math.min(
              page * PER_PAGE,
              filtered.length
            )}{" "}
            of {filtered.length} rooms
          </span>

          <div className="pagination-btns">
            <button
              type="button"
              className="pg-btn"
              onClick={() =>
                setPage(
                  (currentPage) =>
                    currentPage -
                    1
                )
              }
              disabled={
                page === 1
              }
              aria-label="Previous page"
            >
              <IcoChevL />
            </button>

            {Array.from(
              {
                length:
                  totalPages,
              },
              (_, index) =>
                index + 1
            ).map(
              (pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  className={[
                    "pg-btn",

                    page ===
                    pageNumber
                      ? "active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() =>
                    setPage(
                      pageNumber
                    )
                  }
                >
                  {pageNumber}
                </button>
              )
            )}

            <button
              type="button"
              className="pg-btn"
              onClick={() =>
                setPage(
                  (currentPage) =>
                    currentPage +
                    1
                )
              }
              disabled={
                totalPages === 0 ||
                page >=
                  totalPages
              }
              aria-label="Next page"
            >
              <IcoChevR />
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================
          STAT CARDS
      ====================================================== */}

      <div className="room-stats">
        <div className="rstat-card">
          <div className="rstat-icon blue">
            <IcoBed2 />
          </div>

          <div className="rstat-info">
            <div className="rstat-label">
              Total Rooms
            </div>

            <div className="rstat-value">
              {totalRooms}
            </div>

            <div className="rstat-sub">
              All rooms in this hotel
            </div>
          </div>
        </div>

        <div className="rstat-card">
          <div className="rstat-icon green">
            <IcoCheck2 />
          </div>

          <div className="rstat-info">
            <div className="rstat-label">
              Available Rooms
            </div>

            <div className="rstat-value">
              {availableRooms}
            </div>

            <div className="rstat-sub">
              {getPercentage(
                availableRooms
              )}
              % of Total
            </div>
          </div>
        </div>

        <div className="rstat-card">
          <div className="rstat-icon indigo">
            <IcoUser2 />
          </div>

          <div className="rstat-info">
            <div className="rstat-label">
              Occupied Rooms
            </div>

            <div className="rstat-value">
              {occupiedRooms}
            </div>

            <div className="rstat-sub">
              {getPercentage(
                occupiedRooms
              )}
              % of Total
            </div>
          </div>
        </div>

        <div className="rstat-card">
          <div className="rstat-icon orange">
            <IcoBrush />
          </div>

          <div className="rstat-info">
            <div className="rstat-label">
              Cleaning Rooms
            </div>

            <div className="rstat-value">
              {cleaningRooms}
            </div>

            <div className="rstat-sub">
              {getPercentage(
                cleaningRooms
              )}
              % of Total
            </div>
          </div>
        </div>

        <div className="rstat-card">
          <div className="rstat-icon red">
            <IcoWrench />
          </div>

          <div className="rstat-info">
            <div className="rstat-label">
              Maintenance Rooms
            </div>

            <div className="rstat-value">
              {maintenanceRooms}
            </div>

            <div className="rstat-sub">
              {getPercentage(
                maintenanceRooms
              )}
              % of Total
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================
          ADD / EDIT MODALS
      ====================================================== */}

      {showAdd && (
        <RoomFormModal
          title="+ Add New Room"
          form={form}
          onChange={
            handleFormChange
          }
          onSave={handleAdd}
          onClose={() => {
            if (!isSaving) {
              setShowAdd(false);
            }
          }}
          isSaving={isSaving}
          error={formError}
        />
      )}

      {showEdit && (
        <RoomFormModal
          title="Edit Room"
          form={form}
          onChange={
            handleFormChange
          }
          onSave={handleEdit}
          onClose={() => {
            if (!isSaving) {
              setShowEdit(false);
            }
          }}
          isSaving={isSaving}
          error={formError}
        />
      )}

      {/* ======================================================
          VIEW MODAL

          No fake amenities are shown because the finalized
          rooms table does not store room amenities.
      ====================================================== */}

      {showView &&
        selected && (
          <div
            className="modal-overlay"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowView(
                  false
                );
              }
            }}
          >
            <div
              className="modal-box"
              role="dialog"
              aria-modal="true"
              aria-label={`Room ${selected.roomNo} details`}
              onMouseDown={(
                event
              ) =>
                event.stopPropagation()
              }
            >
              <div className="modal-header">
                <h3>
                  Room Details —{" "}
                  {selected.roomNo}
                </h3>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() =>
                    setShowView(
                      false
                    )
                  }
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                {[
                  [
                    "Room No.",
                    selected.roomNo,
                  ],
                  [
                    "Room Type",
                    selected.type,
                  ],
                  [
                    "Floor",
                    selected.floor ??
                      "—",
                  ],
                  [
                    "Capacity",
                    `${selected.capacity} ${
                      selected.capacity ===
                      1
                        ? "Guest"
                        : "Guests"
                    }`,
                  ],
                  [
                    "Price / Night",
                    formatCurrency(
                      selected.price
                    ),
                  ],
                  [
                    "Status",
                    statusLabel(
                      selected.status
                    ),
                  ],
                ].map(
                  ([
                    key,
                    value,
                  ]) => (
                    <div
                      className="detail-row"
                      key={key}
                    >
                      <span className="detail-key">
                        {key}
                      </span>

                      <span className="detail-value">
                        {value}
                      </span>
                    </div>
                  )
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-save"
                  onClick={() =>
                    setShowView(
                      false
                    )
                  }
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ======================================================
          DELETE MODAL
      ====================================================== */}

      {showDelete &&
        selected && (
          <div
            className="modal-overlay"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                  event.currentTarget &&
                !isDeleting
              ) {
                setShowDelete(
                  false
                );
              }
            }}
          >
            <div
              className="modal-box confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Delete room ${selected.roomNo}`}
              onMouseDown={(
                event
              ) =>
                event.stopPropagation()
              }
            >
              <div className="modal-header">
                <h3>
                  Delete Room
                </h3>

                <button
                  type="button"
                  className="modal-close"
                  disabled={
                    isDeleting
                  }
                  onClick={() =>
                    setShowDelete(
                      false
                    )
                  }
                >
                  ×
                </button>
              </div>

              <div className="confirm-body">
                <div className="confirm-icon red">
                  <IcoWarn />
                </div>

                <h4>
                  Delete Room{" "}
                  {selected.roomNo}?
                </h4>

                <p>
                  This room will be
                  permanently deleted.
                  Rooms already linked
                  to hotel records
                  cannot be deleted.
                </p>

                {actionError && (
                  <div
                    className="room-form-error"
                    role="alert"
                  >
                    {actionError}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  disabled={
                    isDeleting
                  }
                  onClick={() =>
                    setShowDelete(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn-danger"
                  disabled={
                    isDeleting
                  }
                  onClick={
                    handleDelete
                  }
                >
                  {isDeleting
                    ? "Deleting..."
                    : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default Rooms;