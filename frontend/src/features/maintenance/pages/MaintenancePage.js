import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import maintenanceApi from "../api/maintenanceApi";
import ManualMaintenanceTaskModal from "../components/ManualMaintenanceTaskModal";
import MaintenanceTaskActions from "../components/MaintenanceTaskActions";
import "../Maintenance.css";


const PAGE_SIZE = 20;


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
    label: "In progress",
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


const PRIORITY_OPTIONS = [
  {
    value: "",
    label: "All priorities",
  },
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


const SOURCE_OPTIONS = [
  {
    value: "",
    label: "All sources",
  },
  {
    value: "manual",
    label: "Manual",
  },
  {
    value: "permanent_room_change",
    label: "Permanent room change",
  },
  {
    value: "temporary_room_change",
    label: "Temporary room move",
  },
  {
    value: "recovery",
    label: "Recovery",
  },
];


const EMPTY_FILTERS = {
  search: "",
  status: "",
  priority: "",
  sourceType: "",
  roomId: "",
  staffId: "",
};


function humanize(value) {

  if (!value) {
    return "—";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function formatDateTime(value) {

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
    return String(value);
  }

  return date.toLocaleString();
}


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


function normalizePagination(
  raw,
  requestedPage
) {

  const value =
    raw && typeof raw === "object"
      ? raw
      : {};

  const page =
    Number(
      value.page ||
      requestedPage ||
      1
    );

  const pageSize =
    Number(
      value.pageSize ||
      value.page_size ||
      PAGE_SIZE
    );

  const total =
    Number(
      value.total ||
      0
    );

  const totalPages =
    Math.max(
      1,
      Number(
        value.totalPages ||
        value.total_pages ||
        Math.ceil(
          total /
          Math.max(
            1,
            pageSize
          )
        ) ||
        1
      )
    );

  return {
    page,
    pageSize,
    total,
    totalPages,
  };
}


function MaintenancePage() {

  const [
    manualTaskModalOpen,
    setManualTaskModalOpen,
  ] = useState(false);

  const [
    filters,
    setFilters,
  ] = useState(
    EMPTY_FILTERS
  );

  const [
    appliedFilters,
    setAppliedFilters,
  ] = useState(
    EMPTY_FILTERS
  );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    tasks,
    setTasks,
  ] = useState([]);

  const [
    staff,
    setStaff,
  ] = useState([]);

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    staffLoading,
    setStaffLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    selectedTaskId,
    setSelectedTaskId,
  ] = useState(null);

  const [
    selectedTask,
    setSelectedTask,
  ] = useState(null);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    detailError,
    setDetailError,
  ] = useState("");


  const queryParams =
    useMemo(
      () => {

        const params = {
          page,
          page_size:
            PAGE_SIZE,
        };

        if (
          appliedFilters.search
            .trim()
        ) {
          params.search =
            appliedFilters.search
              .trim();
        }

        if (
          appliedFilters.status
        ) {
          params.status =
            appliedFilters.status;
        }

        if (
          appliedFilters.priority
        ) {
          params.priority =
            appliedFilters.priority;
        }

        if (
          appliedFilters.sourceType
        ) {
          params.source_type =
            appliedFilters.sourceType;
        }

        if (
          appliedFilters.roomId
        ) {
          params.room_id =
            appliedFilters.roomId;
        }

        if (
          appliedFilters.staffId
        ) {
          params.staff_id =
            appliedFilters.staffId;
        }

        return params;
      },
      [
        appliedFilters,
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
            await maintenanceApi
              .getTasks(
                queryParams
              );

          const payload =
            response?.data?.data;

          const items =
            Array.isArray(
              payload?.items
            )
              ? payload.items
              : [];

          setTasks(items);

          setPagination(
            normalizePagination(
              payload?.pagination,
              page
            )
          );
        }
        catch (requestError) {

          setTasks([]);

          setError(
            getErrorMessage(
              requestError,
              "Unable to load maintenance tasks."
            )
          );
        }
        finally {

          setLoading(false);
        }
      },
      [
        page,
        queryParams,
      ]
    );


  const loadStaff =
    useCallback(
      async () => {

        setStaffLoading(true);

        try {

          const response =
            await maintenanceApi
              .getAssignableStaff();

          const items =
            Array.isArray(
              response?.data?.data
            )
              ? response.data.data
              : [];

          setStaff(items);
        }
        catch {

          setStaff([]);
        }
        finally {

          setStaffLoading(false);
        }
      },
      []
    );


  useEffect(
    () => {

      loadTasks();
    },
    [
      loadTasks,
    ]
  );


  useEffect(
    () => {

      loadStaff();
    },
    [
      loadStaff,
    ]
  );


  const openTaskDetails =
    async (
      taskId
    ) => {

      setSelectedTaskId(
        taskId
      );

      setSelectedTask(null);
      setDetailError("");
      setDetailLoading(true);

      try {

        const response =
          await maintenanceApi
            .getTask(
              taskId
            );

        const task =
          response?.data?.data;

        if (
          !task ||
          typeof task !== "object" ||
          Array.isArray(task)
        ) {
          throw new Error(
            "Maintenance task details were not returned."
          );
        }

        setSelectedTask(task);
      }
      catch (requestError) {

        setDetailError(
          getErrorMessage(
            requestError,
            "Unable to load maintenance task details."
          )
        );
      }
      finally {

        setDetailLoading(false);
      }
    };


  const refreshSelectedTaskAfterMutation =
    async () => {

      if (
        !selectedTaskId
      ) {
        return;
      }


      const response =
        await maintenanceApi
          .getTask(
            selectedTaskId
          );


      const task =
        response?.data?.data;


      if (
        !task ||
        typeof task !== "object" ||
        Array.isArray(
          task
        )
      ) {

        throw new Error(
          "Maintenance task details were not returned after the action."
        );
      }


      setSelectedTask(
        task
      );


      await Promise.all([
        loadTasks(),
        loadStaff(),
      ]);
    };

  const closeTaskDetails =
    () => {

      setSelectedTaskId(null);
      setSelectedTask(null);
      setDetailError("");
      setDetailLoading(false);
    };


  const handleFilterChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;

      setFilters(
        (current) => ({
          ...current,
          [name]: value,
        })
      );
    };


  const handleApplyFilters =
    (event) => {

      event.preventDefault();

      setPage(1);

      setAppliedFilters({
        ...filters,
      });
    };


  const handleClearFilters =
    () => {

      setFilters(
        EMPTY_FILTERS
      );

      setAppliedFilters(
        EMPTY_FILTERS
      );

      setPage(1);
    };


  const handleRefresh =
    () => {

      loadTasks();

      if (
        selectedTaskId
      ) {
        openTaskDetails(
          selectedTaskId
        );
      }

      loadStaff();
    };


  const pagePending =
    tasks.filter(
      (task) =>
        task.taskStatus ===
        "pending"
    ).length;

  const pageInProgress =
    tasks.filter(
      (task) =>
        task.taskStatus ===
        "in_progress"
    ).length;

  const pageCompleted =
    tasks.filter(
      (task) =>
        task.taskStatus ===
        "completed"
    ).length;

  const pageUrgent =
    tasks.filter(
      (task) =>
        task.priority ===
        "urgent"
    ).length;


  const canGoPrevious =
    page > 1;

  const canGoNext =
    page <
    pagination.totalPages;


  function handleManualTaskCreated() {

    setPage(1);

    void loadTasks();
  }

  return (
    <div className="maintenance-page">

      <header className="maintenance-header">

        <div>
          <p className="maintenance-eyebrow">
            Room Operations
          </p>

          <h1>
            Maintenance
          </h1>

          <p className="maintenance-subtitle">
            Track room maintenance issues, ownership,
            priority and lifecycle progress.
          </p>
        </div>

                <button
          type="button"
          className="maintenance-button maintenance-button--primary"
          onClick={() =>
            setManualTaskModalOpen(true)
          }
        >
          New Maintenance Request
        </button>

<button
          type="button"
          className="maintenance-button maintenance-button--secondary"
          onClick={handleRefresh}
          disabled={
            loading ||
            detailLoading
          }
        >
          Refresh
        </button>

      </header>


      <section
        className="maintenance-summary"
        aria-label="Maintenance summary"
      >

        <article className="maintenance-summary-card">
          <span>
            Total results
          </span>

          <strong>
            {pagination.total}
          </strong>
        </article>

        <article className="maintenance-summary-card">
          <span>
            Pending on page
          </span>

          <strong>
            {pagePending}
          </strong>
        </article>

        <article className="maintenance-summary-card">
          <span>
            In progress on page
          </span>

          <strong>
            {pageInProgress}
          </strong>
        </article>

        <article className="maintenance-summary-card">
          <span>
            Completed on page
          </span>

          <strong>
            {pageCompleted}
          </strong>
        </article>

        <article className="maintenance-summary-card">
          <span>
            Urgent on page
          </span>

          <strong>
            {pageUrgent}
          </strong>
        </article>

      </section>


      <form
        className="maintenance-filters"
        onSubmit={
          handleApplyFilters
        }
      >

        <label className="maintenance-field maintenance-field--search">
          <span>
            Search
          </span>

          <input
            type="search"
            name="search"
            value={
              filters.search
            }
            onChange={
              handleFilterChange
            }
            placeholder="Room, issue or source..."
          />
        </label>


        <label className="maintenance-field">
          <span>
            Status
          </span>

          <select
            name="status"
            value={
              filters.status
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


        <label className="maintenance-field">
          <span>
            Priority
          </span>

          <select
            name="priority"
            value={
              filters.priority
            }
            onChange={
              handleFilterChange
            }
          >
            {PRIORITY_OPTIONS.map(
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


        <label className="maintenance-field">
          <span>
            Source
          </span>

          <select
            name="sourceType"
            value={
              filters.sourceType
            }
            onChange={
              handleFilterChange
            }
          >
            {SOURCE_OPTIONS.map(
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


        <label className="maintenance-field">
          <span>
            Room ID
          </span>

          <input
            type="number"
            min="1"
            name="roomId"
            value={
              filters.roomId
            }
            onChange={
              handleFilterChange
            }
            placeholder="Any room"
          />
        </label>


        <label className="maintenance-field">
          <span>
            Staff
          </span>

          <select
            name="staffId"
            value={
              filters.staffId
            }
            onChange={
              handleFilterChange
            }
            disabled={
              staffLoading
            }
          >
            <option value="">
              {staffLoading
                ? "Loading staff..."
                : "Any maintenance staff"}
            </option>

            {staff.map(
              (member) => (
                <option
                  key={
                    member.staffId
                  }
                  value={
                    member.staffId
                  }
                >
                  {member.fullName ||
                    member.staffName ||
                    member.staffCode ||
                    `Staff ${member.staffId}`}
                </option>
              )
            )}
          </select>
        </label>


        <div className="maintenance-filter-actions">

          <button
            type="submit"
            className="maintenance-button maintenance-button--primary"
            disabled={
              loading
            }
          >
            Apply
          </button>

          <button
            type="button"
            className="maintenance-button maintenance-button--ghost"
            onClick={
              handleClearFilters
            }
            disabled={
              loading
            }
          >
            Clear
          </button>

        </div>

      </form>


      {error ? (
        <div
          className="maintenance-alert maintenance-alert--error"
          role="alert"
        >
          {error}
        </div>
      ) : null}


      <section className="maintenance-table-card">

        <div className="maintenance-table-heading">
          <div>
            <h2>
              Maintenance Tasks
            </h2>

            <p>
              {pagination.total} result
              {pagination.total === 1
                ? ""
                : "s"}
            </p>
          </div>
        </div>


        <div className="maintenance-table-wrap">

          <table className="maintenance-table">

            <thead>
              <tr>
                <th>
                  Task
                </th>

                <th>
                  Room
                </th>

                <th>
                  Issue
                </th>

                <th>
                  Source
                </th>

                <th>
                  Priority
                </th>

                <th>
                  Status
                </th>

                <th>
                  Assigned
                </th>

                <th>
                  Created
                </th>
              </tr>
            </thead>


            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="maintenance-table-state"
                  >
                    Loading maintenance tasks...
                  </td>
                </tr>
              ) : null}


              {!loading &&
              tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="maintenance-table-state"
                  >
                    No maintenance tasks match the current filters.
                  </td>
                </tr>
              ) : null}


              {!loading &&
                tasks.map(
                  (task) => (

                    <tr
                      key={
                        task.maintenanceTaskId
                      }
                    >

                      <td>
                        <button
                          type="button"
                          className="maintenance-task-link"
                          onClick={() =>
                            openTaskDetails(
                              task.maintenanceTaskId
                            )
                          }
                        >
                          #{task.maintenanceTaskId}
                          <span>
                            View details
                          </span>
                        </button>
                      </td>


                      <td>
                        <strong>
                          Room{" "}
                          {task.roomNumber ||
                            task.roomId}
                        </strong>

                        <span className="maintenance-cell-subtext">
                          {task.roomType ||
                            "Room"}
                        </span>
                      </td>


                      <td>
                        <strong>
                          {task.issueTitle ||
                            "Maintenance issue"}
                        </strong>

                        <span className="maintenance-cell-subtext">
                          {task.issueDescription ||
                            "No description"}
                        </span>
                      </td>


                      <td>
                        {humanize(
                          task.sourceType
                        )}
                      </td>


                      <td>
                        <span
                          className={
                            `maintenance-badge maintenance-badge--priority-${task.priority || "medium"}`
                          }
                        >
                          {humanize(
                            task.priority
                          )}
                        </span>
                      </td>


                      <td>
                        <span
                          className={
                            `maintenance-badge maintenance-badge--status-${task.taskStatus || "pending"}`
                          }
                        >
                          {humanize(
                            task.taskStatus
                          )}
                        </span>
                      </td>


                      <td>
                        {task.assignedStaffName ||
                          "Unassigned"}
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


        <footer className="maintenance-pagination">

          <div>
            Page{" "}
            <strong>
              {pagination.page}
            </strong>
            {" "}of{" "}
            <strong>
              {pagination.totalPages}
            </strong>
          </div>


          <div className="maintenance-pagination__actions">

            <button
              type="button"
              className="maintenance-button maintenance-button--ghost"
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
              className="maintenance-button maintenance-button--ghost"
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


      {selectedTaskId ? (

        <div
          className="maintenance-detail-backdrop"
          role="presentation"
          onMouseDown={
            (event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeTaskDetails();
              }
            }
          }
        >

          <section
            className="maintenance-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="maintenance-detail-title"
          >

            <header className="maintenance-detail-header">

              <div>
                <p className="maintenance-eyebrow">
                  Maintenance Task
                </p>

                <h2 id="maintenance-detail-title">
                  Task #{selectedTaskId}
                </h2>
              </div>

              <button
                type="button"
                className="maintenance-detail-close"
                aria-label="Close maintenance task details"
                onClick={
                  closeTaskDetails
                }
              >
                ×
              </button>

            </header>


            <div className="maintenance-detail-body">

              {detailLoading ? (
                <p className="maintenance-table-state">
                  Loading task details...
                </p>
              ) : null}


              {detailError ? (
                <div
                  className="maintenance-alert maintenance-alert--error"
                  role="alert"
                >
                  {detailError}
                </div>
              ) : null}


              {!detailLoading &&
              !detailError &&
              selectedTask ? (
                <>

                  <div className="maintenance-detail-grid">

                    <div>
                      <span>
                        Room
                      </span>

                      <strong>
                        Room{" "}
                        {selectedTask.roomNumber ||
                          selectedTask.roomId}
                      </strong>
                    </div>


                    <div>
                      <span>
                        Room status
                      </span>

                      <strong>
                        {humanize(
                          selectedTask.roomStatus
                        )}
                      </strong>
                    </div>


                    <div>
                      <span>
                        Task status
                      </span>

                      <strong>
                        {humanize(
                          selectedTask.taskStatus
                        )}
                      </strong>
                    </div>


                    <div>
                      <span>
                        Priority
                      </span>

                      <strong>
                        {humanize(
                          selectedTask.priority
                        )}
                      </strong>
                    </div>


                    <div>
                      <span>
                        Source
                      </span>

                      <strong>
                        {humanize(
                          selectedTask.sourceType
                        )}
                      </strong>
                    </div>


                    <div>
                      <span>
                        Release to
                      </span>

                      <strong>
                        {humanize(
                          selectedTask.releaseStatus
                        )}
                      </strong>
                    </div>


                    <div>
                      <span>
                        Assigned staff
                      </span>

                      <strong>
                        {selectedTask.assignedStaffName ||
                          "Unassigned"}
                      </strong>
                    </div>


                    <div>
                      <span>
                        Booking
                      </span>

                      <strong>
                        {selectedTask.bookingId
                          ? `#${selectedTask.bookingId}`
                          : "Not linked"}
                      </strong>
                    </div>

                  </div>


                  <section className="maintenance-detail-section">

                    <h3>
                      Issue
                    </h3>

                    <strong>
                      {selectedTask.issueTitle ||
                        "Maintenance issue"}
                    </strong>

                    <p>
                      {selectedTask.issueDescription ||
                        "No additional issue description."}
                    </p>

                  </section>


                  {selectedTask.resolutionNotes ? (
                    <section className="maintenance-detail-section">

                      <h3>
                        Resolution
                      </h3>

                      <p>
                        {selectedTask.resolutionNotes}
                      </p>

                    </section>
                  ) : null}


                  {selectedTask.cancellationReason ? (
                    <section className="maintenance-detail-section">

                      <h3>
                        Cancellation reason
                      </h3>

                      <p>
                        {selectedTask.cancellationReason}
                      </p>

                    </section>
                  ) : null}


                  <MaintenanceTaskActions
                    task={
                      selectedTask
                    }
                    assignableStaff={
                      staff
                    }
                    onChanged={
                      refreshSelectedTaskAfterMutation
                    }
                  />

                  <section className="maintenance-detail-section">

                    <h3>
                      Timeline
                    </h3>

                    {Array.isArray(
                      selectedTask.events
                    ) &&
                    selectedTask.events.length > 0 ? (

                      <div className="maintenance-timeline">

                        {selectedTask.events.map(
                          (event) => (

                            <article
                              className="maintenance-timeline-item"
                              key={
                                event.maintenanceEventId
                              }
                            >

                              <div className="maintenance-timeline-marker" />

                              <div>
                                <div className="maintenance-timeline-topline">

                                  <strong>
                                    {humanize(
                                      event.eventType
                                    )}
                                  </strong>

                                  <span>
                                    {formatDateTime(
                                      event.createdAt
                                    )}
                                  </span>

                                </div>

                                <p>
                                  {humanize(
                                    event.fromStatus
                                  )}
                                  {" → "}
                                  {humanize(
                                    event.toStatus
                                  )}
                                </p>

                                {event.notes ? (
                                  <p>
                                    {event.notes}
                                  </p>
                                ) : null}

                                {(event.staffName ||
                                  event.adminName) ? (
                                  <small>
                                    {event.staffName
                                      ? `Staff: ${event.staffName}`
                                      : ""}

                                    {event.staffName &&
                                    event.adminName
                                      ? " • "
                                      : ""}

                                    {event.adminName
                                      ? `Admin: ${event.adminName}`
                                      : ""}
                                  </small>
                                ) : null}

                              </div>

                            </article>
                          )
                        )}

                      </div>
                    ) : (
                      <p>
                        No task events available.
                      </p>
                    )}

                  </section>

                </>
              ) : null}

            </div>

          </section>

        </div>
      ) : null}

    
      <ManualMaintenanceTaskModal
        open={
          manualTaskModalOpen
        }
        onClose={() =>
          setManualTaskModalOpen(false)
        }
        onCreated={
          handleManualTaskCreated
        }
      />
</div>
  );
}


export default MaintenancePage;