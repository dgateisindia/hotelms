import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import housekeepingApi from "../api/housekeepingApi";
import ManualTaskModal from "../components/ManualTaskModal";
import HousekeepingTaskDetails from "../components/HousekeepingTaskDetails";
import "../Housekeeping.css";


const PAGE_SIZE =
  20;


const STATUS_OPTIONS = [
  {
    value: "",
    label: "All statuses",
  },
  {
    value: "pending",
    label: "Pending",
  },
  {
    value: "in_progress",
    label: "In Progress",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];


const TASK_TYPE_OPTIONS = [
  {
    value: "",
    label: "All task types",
  },
  {
    value: "checkout_cleaning",
    label: "Checkout Cleaning",
  },
  {
    value: "room_change_cleaning",
    label: "Room Change Cleaning",
  },
  {
    value: "manual_cleaning",
    label: "Manual Cleaning",
  },
  {
    value: "recovery_cleaning",
    label: "Recovery Cleaning",
  },
];


const EMPTY_FILTERS = {
  search: "",
  status: "",
  taskType: "",
  roomId: "",
};


function taskTypeLabel(
  taskType
) {

  const labels = {
    checkout_cleaning:
      "Checkout Cleaning",

    room_change_cleaning:
      "Room Change Cleaning",

    manual_cleaning:
      "Manual Cleaning",

    recovery_cleaning:
      "Recovery Cleaning",
  };


  return (
    labels[taskType] ||
    taskType ||
    "—"
  );
}


function taskStatusLabel(
  status
) {

  const labels = {
    pending:
      "Pending",

    in_progress:
      "In Progress",

    completed:
      "Completed",

    cancelled:
      "Cancelled",
  };


  return (
    labels[status] ||
    status ||
    "—"
  );
}


function formatDateTime(
  value
) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return date.toLocaleString(
    "en-IN",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    }
  );
}


function getSourceLabel(
  task
) {

  if (
    task?.bookingCode
  ) {
    return `Booking ${task.bookingCode}`;
  }


  if (
    task?.bookingAdjustmentId
  ) {
    return `Room change #${task.bookingAdjustmentId}`;
  }


  if (
    task?.taskType ===
    "manual_cleaning"
  ) {
    return "Manual request";
  }


  if (
    task?.taskType ===
    "recovery_cleaning"
  ) {
    return "System recovery";
  }


  return "Operational";
}


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
    typeof message ===
      "string" &&
    message.trim()
  ) {
    return message.trim();
  }


  return fallback;
}


function buildQuery(
  filters,
  page
) {

  const query = {
    page,
    page_size:
      PAGE_SIZE,
  };


  const search =
    filters.search.trim();


  if (search) {
    query.search =
      search;
  }


  if (
    filters.status
  ) {
    query.status =
      filters.status;
  }


  if (
    filters.taskType
  ) {
    query.task_type =
      filters.taskType;
  }


  const roomId =
    String(
      filters.roomId ||
      ""
    ).trim();


  if (roomId) {
    query.room_id =
      roomId;
  }


  return query;
}


export default function HousekeepingPage() {

  const [
    draftFilters,
    setDraftFilters,
  ] = useState(
    EMPTY_FILTERS
  );


  const [
    filters,
    setFilters,
  ] = useState(
    EMPTY_FILTERS
  );


  const [
    tasks,
    setTasks,
  ] = useState([]);


  const [
    pagination,
    setPagination,
  ] = useState({
    page:
      1,

    pageSize:
      PAGE_SIZE,

    total:
      0,

    totalPages:
      0,
  });


  const [
    page,
    setPage,
  ] = useState(1);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState("");


  const [
    refreshVersion,
    setRefreshVersion,
  ] = useState(0);

  const [
    manualTaskModalOpen,
    setManualTaskModalOpen,
  ] = useState(false);

  const [
    selectedTaskId,
    setSelectedTaskId,
  ] = useState(null);


  const [
    taskDetailsOpen,
    setTaskDetailsOpen,
  ] = useState(false);


  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");


  const query =
    useMemo(
      () =>
        buildQuery(
          filters,
          page
        ),
      [
        filters,
        page,
      ]
    );


  const loadTasks =
    useCallback(
      async () => {

        setLoading(true);
        setError("");


        try {

          const response =
            await housekeepingApi
              .getTasks(
                query
              );


          const payload =
            response?.data;


          if (
            payload?.success !==
            true
          ) {
            throw new Error(
              "Invalid housekeeping response."
            );
          }


          const nextTasks =
            Array.isArray(
              payload.data
            )
              ? payload.data
              : [];


          const nextPagination =
            payload.pagination &&
            typeof payload.pagination ===
              "object"
              ? payload.pagination
              : {
                  page,
                  pageSize:
                    PAGE_SIZE,
                  total:
                    nextTasks.length,
                  totalPages:
                    nextTasks.length
                      ? 1
                      : 0,
                };


          setTasks(
            nextTasks
          );


          setPagination({
            page:
              Number(
                nextPagination.page
              ) || page,

            pageSize:
              Number(
                nextPagination.pageSize
              ) || PAGE_SIZE,

            total:
              Number(
                nextPagination.total
              ) || 0,

            totalPages:
              Number(
                nextPagination.totalPages
              ) || 0,
          });
        }
        catch (requestError) {

          setTasks([]);


          setPagination({
            page,
            pageSize:
              PAGE_SIZE,
            total:
              0,
            totalPages:
              0,
          });


          setError(
            getErrorMessage(
              requestError,
              "Unable to load housekeeping tasks."
            )
          );
        }
        finally {

          setLoading(false);
        }
      },
      [
        page,
        query,
        refreshVersion,
      ]
    );


  useEffect(
    () => {

      loadTasks();
    },
    [
      loadTasks,
    ]
  );


  function handleFilterChange(
    event
  ) {

    const {
      name,
      value,
    } = event.target;


    setDraftFilters(
      (current) => ({
        ...current,
        [name]:
          value,
      })
    );
  }


  function handleApplyFilters(
    event
  ) {

    event.preventDefault();


    setPage(1);


    setFilters({
      search:
        draftFilters
          .search,

      status:
        draftFilters
          .status,

      taskType:
        draftFilters
          .taskType,

      roomId:
        draftFilters
          .roomId,
    });
  }


  function handleClearFilters() {

    setDraftFilters(
      EMPTY_FILTERS
    );


    setFilters(
      EMPTY_FILTERS
    );


    setPage(1);
  }


  function handleOpenTaskDetails(
    taskId
  ) {

    const normalizedTaskId =
      Number(
        taskId
      );


    if (
      !Number.isInteger(
        normalizedTaskId
      ) ||
      normalizedTaskId <= 0
    ) {
      return;
    }


    setSelectedTaskId(
      normalizedTaskId
    );

    setTaskDetailsOpen(
      true
    );
  }


  function handleCloseTaskDetails() {

    setTaskDetailsOpen(
      false
    );

    setSelectedTaskId(
      null
    );
  }


  function handleTaskDetailsChanged() {

    setRefreshVersion(
      (value) =>
        value + 1
    );
  }

  function handleOpenManualTask() {

    setSuccessMessage("");

    setManualTaskModalOpen(
      true
    );
  }


  function handleManualTaskCreated(
    createdData
  ) {

    const roomNumber =
      createdData
        ?.task
        ?.roomNumber;


    setSuccessMessage(
      roomNumber
        ? `Manual cleaning task created for Room ${roomNumber}.`
        : "Manual cleaning task created successfully."
    );


    /*
     * Reset to the default task view so the new
     * pending manual-cleaning task is immediately visible.
     */
    setDraftFilters(
      EMPTY_FILTERS
    );

    setFilters(
      EMPTY_FILTERS
    );

    setPage(1);

    setRefreshVersion(
      (value) =>
        value + 1
    );
  }

  function handleRefresh() {

    setRefreshVersion(
      (value) =>
        value + 1
    );
  }


  const totalPages =
    pagination.totalPages;


  const canGoPrevious =
    page > 1;


  const canGoNext =
    totalPages > 0 &&
    page < totalPages;


  return (
    <div className="housekeeping-page">

      <header className="housekeeping-page__header">

        <div>

          <p className="housekeeping-page__eyebrow">
            Room Operations
          </p>

          <h1>
            Housekeeping
          </h1>

          <p className="housekeeping-page__subtitle">
            Track room-cleaning work,
            assignment status, and
            lifecycle progress.
          </p>

        </div>


        <div className="housekeeping-page__actions">

          <button
            type="button"
            className="housekeeping-button housekeeping-button--primary"
            onClick={
              handleOpenManualTask
            }
          >
            Manual Cleaning
          </button>


          <button
            type="button"
            className="housekeeping-button housekeeping-button--secondary"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

        </div>

      </header>


      <form
        className="housekeeping-filters"
        onSubmit={handleApplyFilters}
      >

        <label className="housekeeping-field">

          <span>
            Search
          </span>

          <input
            type="search"
            name="search"
            value={
              draftFilters.search
            }
            onChange={
              handleFilterChange
            }
            placeholder="Room, booking or staff"
            maxLength={120}
          />

        </label>


        <label className="housekeeping-field">

          <span>
            Status
          </span>

          <select
            name="status"
            value={
              draftFilters.status
            }
            onChange={
              handleFilterChange
            }
          >

            {STATUS_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value ||
                    "all"
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


        <label className="housekeeping-field">

          <span>
            Task type
          </span>

          <select
            name="taskType"
            value={
              draftFilters
                .taskType
            }
            onChange={
              handleFilterChange
            }
          >

            {TASK_TYPE_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value ||
                    "all"
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


        <label className="housekeeping-field">

          <span>
            Room ID
          </span>

          <input
            type="number"
            name="roomId"
            value={
              draftFilters.roomId
            }
            onChange={
              handleFilterChange
            }
            min="1"
            step="1"
            placeholder="Any room"
          />

        </label>


        <div className="housekeeping-filters__actions">

          <button
            type="submit"
            className="housekeeping-button housekeeping-button--primary"
          >
            Apply
          </button>


          <button
            type="button"
            className="housekeeping-button housekeeping-button--ghost"
            onClick={
              handleClearFilters
            }
          >
            Clear
          </button>

        </div>

      </form>


      {successMessage && (
        <div
          className="housekeeping-alert housekeeping-alert--success"
          role="status"
        >
          {successMessage}
        </div>
      )}

      {error && (
        <div
          className="housekeeping-alert housekeeping-alert--error"
          role="alert"
        >
          {error}
        </div>
      )}


      <section className="housekeeping-panel">

        <div className="housekeeping-panel__header">

          <div>

            <h2>
              Cleaning Tasks
            </h2>

            <p>
              {pagination.total}{" "}
              {pagination.total === 1
                ? "task"
                : "tasks"}
            </p>

          </div>

        </div>


        <div className="housekeeping-table-wrap">

          <table className="housekeeping-table">

            <thead>

              <tr>
                <th>Task</th>
                <th>Room</th>
                <th>Source</th>
                <th>Type</th>
                <th>Status</th>
                <th>Assignment</th>
                <th>Created</th>
              </tr>

            </thead>


            <tbody>

              {loading && (
                <tr>

                  <td
                    colSpan="7"
                    className="housekeeping-table__state"
                  >
                    Loading housekeeping
                    tasks...
                  </td>

                </tr>
              )}


              {!loading &&
                tasks.length === 0 && (
                  <tr>

                    <td
                      colSpan="7"
                      className="housekeeping-table__state"
                    >
                      No housekeeping tasks
                      match the current
                      filters.
                    </td>

                  </tr>
                )}


              {!loading &&
                tasks.map(
                  (task) => (

                    <tr
                      key={
                        task.housekeepingTaskId
                      }
                    >

                      <td>

                        <strong>
                          #
                          {
                            task.housekeepingTaskId
                          }
                        </strong>

                      

                        <button
                          type="button"
                          className="housekeeping-button housekeeping-button--ghost"
                          onClick={
                            () =>
                              handleOpenTaskDetails(
                                task.housekeepingTaskId
                              )
                          }
                          aria-label={
                            `View details for housekeeping task ${task.housekeepingTaskId}`
                          }
                        >
                          View details
                        </button>
</td>


                      <td>

                        <div className="housekeeping-cell-stack">

                          <strong>
                            {task.roomNumber
                              ? `Room ${task.roomNumber}`
                              : `Room #${task.roomId}`}
                          </strong>

                          <span>
                            {task.roomType ||
                              "—"}
                          </span>

                        </div>

                      </td>


                      <td>
                        {getSourceLabel(
                          task
                        )}
                      </td>


                      <td>
                        {taskTypeLabel(
                          task.taskType
                        )}
                      </td>


                      <td>

                        <span
                          className={`housekeeping-status housekeeping-status--${task.taskStatus || "unknown"}`}
                        >
                          {taskStatusLabel(
                            task.taskStatus
                          )}
                        </span>

                      </td>


                      <td>

                        <div className="housekeeping-cell-stack">

                          <strong>
                            {task.assignedStaffName ||
                              "Unassigned"}
                          </strong>

                          <span>
                            {task.assignedStaffCode ||
                              "—"}
                          </span>

                        </div>

                      </td>


                      <td>
                        {formatDateTime(
                          task.createdAt
                        )}
                      </td>

                    </tr>
                  )
                )}

            </tbody>

          </table>

        </div>


        <footer className="housekeeping-pagination">

          <span>
            Page{" "}
            {pagination.page}{" "}
            of{" "}
            {totalPages || 0}
          </span>


          <div className="housekeeping-pagination__actions">

            <button
              type="button"
              className="housekeeping-button housekeeping-button--ghost"
              disabled={
                loading ||
                !canGoPrevious
              }
              onClick={() =>
                setPage(
                  (current) =>
                    Math.max(
                      1,
                      current - 1
                    )
                )
              }
            >
              Previous
            </button>


            <button
              type="button"
              className="housekeeping-button housekeeping-button--ghost"
              disabled={
                loading ||
                !canGoNext
              }
              onClick={() =>
                setPage(
                  (current) =>
                    current + 1
                )
              }
            >
              Next
            </button>

          </div>

        </footer>

      </section>


      <ManualTaskModal
        open={
          manualTaskModalOpen
        }
        onClose={
          () =>
            setManualTaskModalOpen(
              false
            )
        }
        onCreated={
          handleManualTaskCreated
        }
      />

      <HousekeepingTaskDetails
        open={
          taskDetailsOpen
        }
        taskId={
          selectedTaskId
        }
        onClose={
          handleCloseTaskDetails
        }
        onChanged={
          handleTaskDetailsChanged
        }
      />

    </div>
  );
}
