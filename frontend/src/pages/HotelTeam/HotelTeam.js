import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useOutletContext,
} from "react-router-dom";

import superAdminAdminService from "../../services/superAdminAdminService";

import CreateAdminModal from "../../components/admins/CreateAdminModal/CreateAdminModal";

import "./HotelTeam.css";


/* ============================================================
   ICON BASE
============================================================ */

function IconBase({
  children,
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}


function TeamIcon() {
  return (
    <IconBase>
      <circle
        cx="9"
        cy="8"
        r="3"
      />

      <path d="M3 20c0-4 2.5-6 6-6s6 2 6 6" />

      <circle
        cx="17"
        cy="9"
        r="2"
      />

      <path d="M15 15c3.5 0 6 1.5 6 5" />
    </IconBase>
  );
}


function ActiveIcon() {
  return (
    <IconBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path d="m8 12 2.5 2.5L16 9" />
    </IconBase>
  );
}


function InactiveIcon() {
  return (
    <IconBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path d="M9 9l6 6" />
      <path d="M15 9l-6 6" />
    </IconBase>
  );
}


function PlusIcon() {
  return (
    <IconBase>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}


/* ============================================================
   HELPERS
============================================================ */

function getErrorMessage(
  error
) {
  return (
    error?.message ||
    "Hotel Admin accounts could not be loaded."
  );
}


function getInitials(
  name
) {
  const words =
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    words.length === 0
  ) {
    return "A";
  }

  return words
    .slice(0, 2)
    .map(
      (word) =>
        word.charAt(0).toUpperCase()
    )
    .join("");
}


function formatDate(
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

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}


function normalizeStatus(
  value
) {
  const status =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    status === "active" ||
    status === "inactive"
  ) {
    return status;
  }

  return "inactive";
}


/* ============================================================
   HOTEL TEAM PAGE
============================================================ */

function HotelTeam() {
  const {
    selectedHotel,
  } = useOutletContext();


  const [
    admins,
    setAdmins,
  ] = useState([]);


  const [
    summary,
    setSummary,
  ] = useState({
    totalAdmins: 0,
    activeAdmins: 0,
    inactiveAdmins: 0,
  });


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    refreshing,
    setRefreshing,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState("");

  const [
    isCreateAdminOpen,
    setIsCreateAdminOpen,
  ] = useState(false);


  const [
    notice,
    setNotice,
  ] = useState("");

  /* ==========================================================
     LOAD ADMINS
  ========================================================== */

  const loadAdmins =
    useCallback(
      async ({
        initialLoad = false,
      } = {}) => {
        if (
          !selectedHotel
            ?.displayId
        ) {
          return;
        }


        if (initialLoad) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }


        setError("");


        try {
          const result =
            await superAdminAdminService
              .getHotelAdmins(
                selectedHotel.displayId
              );


          if (
            result?.success !== true
          ) {
            throw new Error(
              "Hotel Admin accounts could not be loaded."
            );
          }


          setAdmins(
            Array.isArray(
              result.admins
            )
              ? result.admins
              : []
          );


          setSummary({
            totalAdmins:
              Number(
                result?.summary
                  ?.totalAdmins ||
                  0
              ),

            activeAdmins:
              Number(
                result?.summary
                  ?.activeAdmins ||
                  0
              ),

            inactiveAdmins:
              Number(
                result?.summary
                  ?.inactiveAdmins ||
                  0
              ),
          });
        } catch (
          loadError
        ) {
          console.error(
            "[HOTEL_TEAM:LOAD_ADMINS]",
            loadError
          );


          setError(
            getErrorMessage(
              loadError
            )
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        selectedHotel
          ?.displayId,
      ]
    );


  useEffect(() => {
    void loadAdmins({
      initialLoad: true,
    });
  }, [
    loadAdmins,
  ]);

  /* ==========================================================
   ADMIN CREATED
  ========================================================== */

  const handleAdminCreated =
    useCallback(
      async (result) => {
        const createdAdmin =
          result?.admin;


        if (createdAdmin) {
          setAdmins(
            (currentAdmins) => {
              const exists =
                currentAdmins.some(
                  (admin) =>
                    admin.adminId ===
                      createdAdmin.adminId ||
                    admin.displayId ===
                      createdAdmin.displayId
                );


              if (exists) {
                return currentAdmins;
              }


              return [
                createdAdmin,
                ...currentAdmins,
              ];
            }
          );


          setSummary(
            (currentSummary) => ({
              totalAdmins:
                currentSummary.totalAdmins +
                1,

              activeAdmins:
                createdAdmin.status ===
                "active"
                  ? currentSummary.activeAdmins +
                    1
                  : currentSummary.activeAdmins,

              inactiveAdmins:
                createdAdmin.status ===
                "inactive"
                  ? currentSummary.inactiveAdmins +
                    1
                  : currentSummary.inactiveAdmins,
            })
          );
        }


        setNotice(
          result?.message ||
            "Hotel Admin account created successfully."
        );


        /*
        * Re-fetch from backend so the UI finishes in the
        * authoritative server state.
        */
        await loadAdmins();
      },
      [
        loadAdmins,
      ]
    );


  if (!selectedHotel) {
    return null;
  }


  return (
    <div className="hotel-team">
      {notice && (
        <div
          className="alert alert-success"
          role="status"
        >
          {notice}
        </div>
      )}

      {/* ======================================================
          PAGE INTRO
      ====================================================== */}

      <section className="hotel-team__intro">

        <div className="hotel-team__intro-copy">
          <h1>
            Hotel Team
          </h1>

          <p>
            Manage Hotel Admin accounts
            assigned to{" "}
            <strong>
              {selectedHotel.name}
            </strong>
            .
          </p>
        </div>


        {/*
         * Admin creation will be connected in the next
         * backend/frontend step.
         *
         * Keeping the button disabled prevents a fake or
         * incomplete action from reaching production code.
         */}
        <button
          type="button"
          className="btn btn-primary hotel-team__add-button"
          onClick={() => {
            setNotice("");
            setIsCreateAdminOpen(true);
          }}
        >
          <PlusIcon />

          Add Admin
        </button>

      </section>


      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <section className="hotel-team__summary">

        <SummaryCard
          label="Total Admins"
          value={
            summary.totalAdmins
          }
          icon={<TeamIcon />}
        />


        <SummaryCard
          label="Active Admins"
          value={
            summary.activeAdmins
          }
          icon={<ActiveIcon />}
          tone="active"
        />


        <SummaryCard
          label="Inactive Admins"
          value={
            summary.inactiveAdmins
          }
          icon={<InactiveIcon />}
          tone="inactive"
        />

      </section>


      {/* ======================================================
          ADMIN LIST CARD
      ====================================================== */}

      <section className="hotel-team__card">

        <div className="hotel-team__card-header">
          <div>
            <h2>
              Hotel Admin Accounts
            </h2>

            <p>
              Admins listed here belong
              only to this selected
              hotel.
            </p>
          </div>


          <span className="hotel-team__count">
            {summary.totalAdmins}{" "}
            {summary.totalAdmins === 1
              ? "Admin"
              : "Admins"}
          </span>
        </div>


        {/* ====================================================
            LOADING
        ==================================================== */}

        {loading && (
          <div className="hotel-team__loading">
            Loading Hotel Admin
            accounts...
          </div>
        )}


        {/* ====================================================
            ERROR
        ==================================================== */}

        {!loading &&
          error && (
            <div className="hotel-team__error">

              <div
                className="alert alert-error"
                role="alert"
              >
                {error}
              </div>


              <div className="hotel-team__error-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    refreshing
                  }
                  onClick={() => {
                    void loadAdmins();
                  }}
                >
                  {refreshing
                    ? "Retrying..."
                    : "Retry"}
                </button>
              </div>

            </div>
          )}


        {/* ====================================================
            EMPTY STATE
        ==================================================== */}

        {!loading &&
          !error &&
          admins.length === 0 && (
            <div className="hotel-team__empty">

              <div className="hotel-team__empty-content">

                <div className="hotel-team__empty-icon">
                  <TeamIcon />
                </div>


                <h3>
                  No Admin accounts yet
                </h3>


                <p>
                  This hotel does not
                  have an Admin account
                  assigned yet. Admin
                  creation will be
                  available from this
                  Team section.
                </p>


                <button
                  type="button"
                  className="btn btn-primary hotel-team__add-button"
                  onClick={() => {
                    setNotice("");
                    setIsCreateAdminOpen(true);
                  }}
                >
                  <PlusIcon />

                  Add First Admin
                </button>

              </div>

            </div>
          )}


        {/* ====================================================
            ADMIN TABLE
        ==================================================== */}

        {!loading &&
          !error &&
          admins.length > 0 && (
            <div className="hotel-team__table-wrapper">

              <table className="hotel-team__table">

                <thead>
                  <tr>
                    <th>
                      Admin
                    </th>

                    <th>
                      Email
                    </th>

                    <th>
                      Phone
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Added
                    </th>
                  </tr>
                </thead>


                <tbody>
                  {admins.map(
                    (admin) => {
                      const status =
                        normalizeStatus(
                          admin.status
                        );


                      return (
                        <tr
                          key={
                            admin.displayId ||
                            admin.adminId
                          }
                        >

                          <td>
                            <div className="hotel-team__admin">

                              <div className="hotel-team__avatar">
                                {admin.profileImage ? (
                                  <img
                                    src={
                                      admin.profileImage
                                    }
                                    alt=""
                                  />
                                ) : (
                                  getInitials(
                                    admin.fullName
                                  )
                                )}
                              </div>


                              <div>
                                <span className="hotel-team__admin-name">
                                  {admin.fullName ||
                                    "Unnamed Admin"}
                                </span>

                                <span className="hotel-team__admin-id">
                                  {admin.displayId ||
                                    "—"}
                                </span>
                              </div>

                            </div>
                          </td>


                          <td>
                            {admin.email ||
                              "—"}
                          </td>


                          <td>
                            {admin.phone ||
                              "—"}
                          </td>


                          <td>
                            <span
                              className={`hotel-team__status hotel-team__status--${status}`}
                            >
                              {status}
                            </span>
                          </td>


                          <td>
                            {formatDate(
                              admin.createdAt
                            )}
                          </td>

                        </tr>
                      );
                    }
                  )}
                </tbody>

              </table>

            </div>
          )}

      </section>
      
      {isCreateAdminOpen && (
        <CreateAdminModal
          selectedHotel={selectedHotel}
          onClose={() =>
            setIsCreateAdminOpen(false)
          }
          onCreated={handleAdminCreated}
        />
      )}

    </div>
  );
}


/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  label,
  value,
  icon,
  tone = "",
}) {
  const iconClassName = [
    "hotel-team__summary-icon",

    tone
      ? `hotel-team__summary-icon--${tone}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");


  return (
    <article className="hotel-team__summary-card">

      <div className={iconClassName}>
        {icon}
      </div>


      <div className="hotel-team__summary-content">
        <span className="hotel-team__summary-label">
          {label}
        </span>

        <strong className="hotel-team__summary-value">
          {value}
        </strong>
      </div>

    </article>
  );
}


export default HotelTeam;