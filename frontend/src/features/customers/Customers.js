// ============================================================
// Customers.js — Hotel-scoped Customer Management
//
// API:
// GET    /api/customers
// GET    /api/customers/stats
// GET    /api/customers/:id
// POST   /api/customers
// PUT    /api/customers/:id
// DELETE /api/customers/:id
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

import apiClient from "../../shared/api/apiClient";

import "./Customers.css";

import {
  IcoPlus,
  IcoSearch,
  IcoEye,
  IcoEdit,
  IcoTrash,
  IcoChevL,
  IcoChevR,
  IcoWarn,
  IcoUsers,
  IcoRepeat,
  IcoUserNew,
  IcoCalendar,
} from "../../utils/icons/CustomersIcons";


/* ============================================================
   CONSTANTS
============================================================ */

const PER_PAGE = 8;


const EMPTY_FORM = {
  full_name: "",
  email: "",
  phone: "",
  gender: "",
  nationality: "",
  address: "",
  id_proof_type: "",
  id_proof_number: "",
  profile_image: "",
};


const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Other",
];


const ID_PROOF_OPTIONS = [
  "Aadhaar",
  "PAN",
  "Passport",
  "Driving License",
  "Voter ID",
];


/* ============================================================
   HELPERS
============================================================ */

function getApiErrorMessage(
  error,
  fallbackMessage
) {
  return (
    error?.message ||
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    fallbackMessage
  );
}


function formatCustomerDisplayId(
  customerId
) {
  const id =
    Number(customerId);


  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return "—";
  }


  return `CUS-${String(id).padStart(
    4,
    "0"
  )}`;
}


function initials(name) {
  const parts =
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);


  if (parts.length === 0) {
    return "CU";
  }


  return parts
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0)
    )
    .join("")
    .toUpperCase();
}


function numberValue(value) {
  const number =
    Number(value);


  return Number.isFinite(number)
    ? number
    : 0;
}


function formatMoney(value) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }
  ).format(
    numberValue(value)
  );
}


function formatDate(value) {
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


  return date.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}


function normalizeStatus(status) {
  return String(
    status || "Unknown"
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      "-"
    );
}


function statusClass(status) {
  const normalized =
    normalizeStatus(status);


  const supported = [
    "checked-in",
    "upcoming",
    "confirmed",
    "pending",
    "cancelled",
    "checked-out",
    "no-bookings",
    "unknown",
  ];


  const safeStatus =
    supported.includes(
      normalized
    )
      ? normalized
      : "unknown";


  return [
    "badge",
    "customer-status",
    `customer-status--${safeStatus}`,
  ].join(" ");
}


function displayValue(
  value,
  fallback = "—"
) {
  const normalized =
    String(
      value ?? ""
    ).trim();


  return normalized || fallback;
}


/* ============================================================
   CLIENT VALIDATION

   Backend remains authoritative.
   Only fields actually required by backend are required here.
============================================================ */

function validateCustomerForm(
  form
) {
  const fullName =
    String(
      form.full_name || ""
    ).trim();


  if (!fullName) {
    return "Full Name is required.";
  }


  const phone =
    String(
      form.phone || ""
    ).trim();


  if (!phone) {
    return "Phone Number is required.";
  }


  const email =
    String(
      form.email || ""
    ).trim();


  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    return "Please enter a valid email address.";
  }


  return "";
}


/* ============================================================
   CUSTOMER FORM DIALOG

   Temporary local implementation while the old
   CustomerFormModal component is being retired.

   Backend-supported fields only.
============================================================ */

function CustomerFormDialog({
  title,
  submitLabel,
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
        className="modal-box customer-form-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="modal-header">

          <div>
            <h3>
              {title}
            </h3>

            <p className="customer-modal-subtitle">
              Full Name and Phone Number are required.
              Other details can be completed later.
            </p>
          </div>


          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={
              isSaving
            }
            aria-label="Close customer form"
          >
            ×
          </button>

        </div>


        {/* ==================================================
            FORM
        ================================================== */}

        <form
          onSubmit={onSave}
        >

          <div className="modal-body">

            {error && (
              <div
                className="customer-form-error"
                role="alert"
              >
                {error}
              </div>
            )}


            <div className="modal-grid">

              {/* ============================================
                  FULL NAME
              ============================================ */}

              <div className="form-group">

                <label
                  className="form-label"
                  htmlFor="customer-full-name"
                >
                  Full Name
                  <span className="customer-required">
                    *
                  </span>
                </label>


                <input
                  id="customer-full-name"
                  className="form-input"
                  type="text"
                  name="full_name"
                  value={
                    form.full_name
                  }
                  onChange={
                    onChange
                  }
                  placeholder="Enter full name"
                  maxLength={150}
                  disabled={
                    isSaving
                  }
                  required
                />

              </div>


              {/* ============================================
                  PHONE
              ============================================ */}

              <div className="form-group">

                <label
                  className="form-label"
                  htmlFor="customer-phone"
                >
                  Phone Number
                  <span className="customer-required">
                    *
                  </span>
                </label>


                <input
                  id="customer-phone"
                  className="form-input"
                  type="tel"
                  name="phone"
                  value={
                    form.phone
                  }
                  onChange={
                    onChange
                  }
                  placeholder="+91 9876543210"
                  maxLength={30}
                  disabled={
                    isSaving
                  }
                  required
                />

              </div>


              {/* ============================================
                  EMAIL
              ============================================ */}

              <div className="form-group">

                <label
                  className="form-label"
                  htmlFor="customer-email"
                >
                  Email
                </label>


                <input
                  id="customer-email"
                  className="form-input"
                  type="email"
                  name="email"
                  value={
                    form.email
                  }
                  onChange={
                    onChange
                  }
                  placeholder="customer@example.com"
                  maxLength={191}
                  disabled={
                    isSaving
                  }
                />

              </div>


              {/* ============================================
                  GENDER
              ============================================ */}

              <div className="form-group">

                <label
                  className="form-label"
                  htmlFor="customer-gender"
                >
                  Gender
                </label>


                <select
                  id="customer-gender"
                  className="form-select"
                  name="gender"
                  value={
                    form.gender
                  }
                  onChange={
                    onChange
                  }
                  disabled={
                    isSaving
                  }
                >
                  <option value="">
                    Select Gender
                  </option>


                  {GENDER_OPTIONS.map(
                    (option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    )
                  )}

                </select>

              </div>


              {/* ============================================
                  NATIONALITY
              ============================================ */}

              <div className="form-group">

                <label
                  className="form-label"
                  htmlFor="customer-nationality"
                >
                  Nationality
                </label>


                <input
                  id="customer-nationality"
                  className="form-input"
                  type="text"
                  name="nationality"
                  value={
                    form.nationality
                  }
                  onChange={
                    onChange
                  }
                  placeholder="e.g. Indian"
                  maxLength={100}
                  disabled={
                    isSaving
                  }
                />

              </div>


              {/* ============================================
                  ID PROOF TYPE
              ============================================ */}

              <div className="form-group">

                <label
                  className="form-label"
                  htmlFor="customer-id-proof-type"
                >
                  ID Proof Type
                </label>


                <select
                  id="customer-id-proof-type"
                  className="form-select"
                  name="id_proof_type"
                  value={
                    form.id_proof_type
                  }
                  onChange={
                    onChange
                  }
                  disabled={
                    isSaving
                  }
                >
                  <option value="">
                    Select ID Proof
                  </option>


                  {ID_PROOF_OPTIONS.map(
                    (option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    )
                  )}

                </select>

              </div>


              {/* ============================================
                  ID PROOF NUMBER
              ============================================ */}

              <div className="form-group">

                <label
                  className="form-label"
                  htmlFor="customer-id-proof-number"
                >
                  ID Proof Number
                </label>


                <input
                  id="customer-id-proof-number"
                  className="form-input"
                  type="text"
                  name="id_proof_number"
                  value={
                    form.id_proof_number
                  }
                  onChange={
                    onChange
                  }
                  placeholder="Enter ID number"
                  maxLength={100}
                  disabled={
                    isSaving
                  }
                />

              </div>


              {/* ============================================
                  PROFILE IMAGE URL
              ============================================ */}

              <div className="form-group">

                <label
                  className="form-label"
                  htmlFor="customer-profile-image"
                >
                  Profile Image URL
                </label>


                <input
                  id="customer-profile-image"
                  className="form-input"
                  type="url"
                  name="profile_image"
                  value={
                    form.profile_image
                  }
                  onChange={
                    onChange
                  }
                  placeholder="https://..."
                  maxLength={255}
                  disabled={
                    isSaving
                  }
                />

              </div>


              {/* ============================================
                  ADDRESS
              ============================================ */}

              <div className="form-group customer-form-full">

                <label
                  className="form-label"
                  htmlFor="customer-address"
                >
                  Address
                </label>


                <textarea
                  id="customer-address"
                  className="form-textarea customer-address-input"
                  name="address"
                  value={
                    form.address
                  }
                  onChange={
                    onChange
                  }
                  placeholder="Enter customer address"
                  maxLength={5000}
                  disabled={
                    isSaving
                  }
                  rows={3}
                />

              </div>

            </div>

          </div>


          {/* ==================================================
              FOOTER
          ================================================== */}

          <div className="modal-footer">

            <button
              type="button"
              className="btn-cancel"
              onClick={
                onClose
              }
              disabled={
                isSaving
              }
            >
              Cancel
            </button>


            <button
              type="submit"
              className="btn-save"
              disabled={
                isSaving
              }
            >
              {isSaving
                ? "Saving..."
                : submitLabel}
            </button>

          </div>

        </form>

      </div>
    </div>
  );
}


/* ============================================================
   EMPTY STATE
============================================================ */

function CustomerEmptyState({
  hasSearch,
  onAdd,
}) {
  return (
    <div className="customers-empty-state">

      <div className="customers-empty-icon">
        <IcoUsers />
      </div>


      <h3 className="customers-empty-title">
        {hasSearch
          ? "No matching customers"
          : "No customers yet"}
      </h3>


      <p className="customers-empty-description">
        {hasSearch
          ? "No customer matches the current search."
          : "Customer profiles will appear here when they are added manually or created from a booking."}
      </p>


      {!hasSearch && (
        <button
          type="button"
          className="customers-empty-action"
          onClick={onAdd}
        >
          <IcoPlus />
          Add First Customer
        </button>
      )}

    </div>
  );
}


/* ============================================================
   MAIN COMPONENT
============================================================ */

function Customers() {
  const [
    customers,
    setCustomers,
  ] = useState([]);


  const [
    stats,
    setStats,
  ] = useState({
    totalCustomers: 0,
    activeGuests: 0,
    repeatGuests: 0,
    upcomingGuests: 0,
  });


  const [
    search,
    setSearch,
  ] = useState("");


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
    viewLoading,
    setViewLoading,
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
     LOAD CUSTOMERS + STATS
  ========================================================== */

  const fetchCustomerData =
    useCallback(
      async () => {
        setIsLoading(true);
        setLoadError("");


        try {
          const [
            customersResponse,
            statsResponse,
          ] =
            await Promise.all([
              apiClient.get(
                "/customers"
              ),

              apiClient.get(
                "/customers/stats"
              ),
            ]);


          const customerRows =
            Array.isArray(
              customersResponse?.data
            )
              ? customersResponse.data
              : [];


          setCustomers(
            customerRows
          );


          const statsData =
            statsResponse?.data?.data;


          setStats({
            totalCustomers:
              numberValue(
                statsData
                  ?.totalCustomers
              ),

            activeGuests:
              numberValue(
                statsData
                  ?.activeGuests
              ),

            repeatGuests:
              numberValue(
                statsData
                  ?.repeatGuests
              ),

            upcomingGuests:
              numberValue(
                statsData
                  ?.upcomingGuests
              ),
          });
        } catch (error) {
          console.error(
            "[CUSTOMERS:LOAD]",
            error
          );


          setLoadError(
            getApiErrorMessage(
              error,
              "Customers could not be loaded. Please try again."
            )
          );
        } finally {
          setIsLoading(false);
        }
      },
      []
    );


  useEffect(() => {
    void fetchCustomerData();
  }, [
    fetchCustomerData,
  ]);


  /* ==========================================================
     FILTER
  ========================================================== */

  const filtered =
    useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase();


        if (!term) {
          return customers;
        }


        return customers.filter(
          (customer) => {
            const displayId =
              formatCustomerDisplayId(
                customer.customer_id
              )
                .toLowerCase();


            return (
              String(
                customer.full_name ||
                ""
              )
                .toLowerCase()
                .includes(term) ||

              String(
                customer.email ||
                ""
              )
                .toLowerCase()
                .includes(term) ||

              String(
                customer.phone ||
                ""
              )
                .toLowerCase()
                .includes(term) ||

              String(
                customer.nationality ||
                ""
              )
                .toLowerCase()
                .includes(term) ||

              displayId.includes(
                term
              )
            );
          }
        );
      },
      [
        customers,
        search,
      ]
    );


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


    if (
      page >
      totalPages
    ) {
      setPage(
        totalPages
      );
    }
  }, [
    page,
    totalPages,
  ]);


  const paginated =
    useMemo(
      () => {
        const start =
          (page - 1) *
          PER_PAGE;


        return filtered.slice(
          start,
          start + PER_PAGE
        );
      },
      [
        filtered,
        page,
      ]
    );


  /* ==========================================================
     FORM HANDLERS
  ========================================================== */

  const handleFormChange = (
    event
  ) => {
    const {
      name,
      value,
    } =
      event.target;


    setForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );


    if (formError) {
      setFormError("");
    }
  };


  const openAdd = () => {
    setSelected(null);

    setForm({
      ...EMPTY_FORM,
    });

    setFormError("");
    setActionError("");

    setShowAdd(true);
  };


  const openEdit = (
    customer
  ) => {
    setSelected(
      customer
    );


    setForm({
      full_name:
        customer.full_name ||
        "",

      email:
        customer.email ||
        "",

      phone:
        customer.phone ||
        "",

      gender:
        customer.gender ||
        "",

      nationality:
        customer.nationality ||
        "",

      address:
        customer.address ||
        "",

      id_proof_type:
        customer.id_proof_type ||
        "",

      id_proof_number:
        customer.id_proof_number ||
        "",

      profile_image:
        customer.profile_image ||
        "",
    });


    setFormError("");
    setActionError("");

    setShowEdit(true);
  };


  const openDelete = (
    customer
  ) => {
    setSelected(
      customer
    );

    setActionError("");

    setShowDelete(true);
  };


  /* ==========================================================
     CREATE CUSTOMER
  ========================================================== */

  const handleAdd = async (
    event
  ) => {
    event.preventDefault();


    if (isSaving) {
      return;
    }


    const validationError =
      validateCustomerForm(
        form
      );


    if (
      validationError
    ) {
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
        "/customers",
        {
          full_name:
            form.full_name.trim(),

          email:
            form.email.trim(),

          phone:
            form.phone.trim(),

          gender:
            form.gender.trim(),

          nationality:
            form.nationality.trim(),

          address:
            form.address.trim(),

          id_proof_type:
            form.id_proof_type.trim(),

          id_proof_number:
            form.id_proof_number.trim(),

          profile_image:
            form.profile_image.trim(),
        }
      );


      await fetchCustomerData();


      setShowAdd(false);

      setForm({
        ...EMPTY_FORM,
      });
    } catch (error) {
      console.error(
        "[CUSTOMERS:CREATE]",
        error
      );


      setFormError(
        getApiErrorMessage(
          error,
          "The customer could not be created."
        )
      );
    } finally {
      setIsSaving(false);
    }
  };


  /* ==========================================================
     UPDATE CUSTOMER
  ========================================================== */

  const handleEdit = async (
    event
  ) => {
    event.preventDefault();


    if (
      isSaving ||
      !selected?.customer_id
    ) {
      return;
    }


    const validationError =
      validateCustomerForm(
        form
      );


    if (
      validationError
    ) {
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
        `/customers/${selected.customer_id}`,
        {
          full_name:
            form.full_name.trim(),

          email:
            form.email.trim(),

          phone:
            form.phone.trim(),

          gender:
            form.gender.trim(),

          nationality:
            form.nationality.trim(),

          address:
            form.address.trim(),

          id_proof_type:
            form.id_proof_type.trim(),

          id_proof_number:
            form.id_proof_number.trim(),

          profile_image:
            form.profile_image.trim(),
        }
      );


      await fetchCustomerData();


      setShowEdit(false);
      setSelected(null);
    } catch (error) {
      console.error(
        "[CUSTOMERS:UPDATE]",
        error
      );


      setFormError(
        getApiErrorMessage(
          error,
          "The customer could not be updated."
        )
      );
    } finally {
      setIsSaving(false);
    }
  };


  /* ==========================================================
     VIEW CUSTOMER
  ========================================================== */

  const openView = async (
    customer
  ) => {
    if (
      !customer?.customer_id
    ) {
      return;
    }


    setViewLoading(true);
    setActionError("");


    try {
      const response =
        await apiClient.get(
          `/customers/${customer.customer_id}`
        );


      const customerData =
        response?.data?.data;


      if (
        !customerData
      ) {
        throw new Error(
          "Customer details could not be loaded."
        );
      }


      setSelected(
        customerData
      );

      setShowView(true);
    } catch (error) {
      console.error(
        "[CUSTOMERS:VIEW]",
        error
      );


      setActionError(
        getApiErrorMessage(
          error,
          "Customer details could not be loaded."
        )
      );
    } finally {
      setViewLoading(false);
    }
  };


  /* ==========================================================
     DELETE CUSTOMER
  ========================================================== */

  const handleDelete =
    async () => {
      if (
        isDeleting ||
        !selected?.customer_id
      ) {
        return;
      }


      setIsDeleting(true);
      setActionError("");


      try {
        await apiClient.delete(
          `/customers/${selected.customer_id}`
        );


        await fetchCustomerData();


        setShowDelete(false);
        setSelected(null);
      } catch (error) {
        console.error(
          "[CUSTOMERS:DELETE]",
          error
        );


        setActionError(
          getApiErrorMessage(
            error,
            "The customer could not be deleted."
          )
        );
      } finally {
        setIsDeleting(false);
      }
    };


  /* ==========================================================
     STAT CARDS
  ========================================================== */

  const statCards = [
    {
      label:
        "Total Customers",

      value:
        stats.totalCustomers,

      text:
        "Registered Customers",

      icon:
        <IcoUsers />,

      tone:
        "blue",
    },

    {
      label:
        "Active Guests",

      value:
        stats.activeGuests,

      text:
        "Currently Checked In",

      icon:
        <IcoRepeat />,

      tone:
        "green",
    },

    {
      label:
        "Repeat Guests",

      value:
        stats.repeatGuests,

      text:
        "Returning Guests",

      icon:
        <IcoUserNew />,

      tone:
        "orange",
    },

    {
      label:
        "Upcoming Guests",

      value:
        stats.upcomingGuests,

      text:
        "Future Confirmed Stays",

      icon:
        <IcoCalendar />,

      tone:
        "purple",
    },
  ];


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="customers-page">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="page-header">

        <div className="page-header-left">

          <h2>
            Customers
          </h2>


          <p>
            Manage hotel customer profiles and booking history.
          </p>

        </div>


        <div className="page-header-right">

          <div className="search-wrap">

            <input
              className="search-input"
              type="search"
              placeholder="Search by name, phone, email or ID..."
              value={search}
              onChange={(
                event
              ) => {
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
            className="btn-add-customer"
            onClick={openAdd}
          >
            <IcoPlus />

            Add New Customer
          </button>

        </div>

      </div>


      {/* ======================================================
          ERROR
      ====================================================== */}

      {loadError && (
        <div
          className="customers-error-banner"
          role="alert"
        >
          <span>
            {loadError}
          </span>


          <button
            type="button"
            onClick={
              fetchCustomerData
            }
          >
            Retry
          </button>

        </div>
      )}


      {actionError &&
        !showDelete && (
          <div
            className="customers-error-banner"
            role="alert"
          >
            {actionError}
          </div>
        )}


      {/* ======================================================
          STAT CARDS
      ====================================================== */}

      <div className="cust-stats">

        {statCards.map(
          (card) => (
            <article
              key={
                card.label
              }
              className="cstat-card"
            >

              <div
                className={`cstat-icon ${card.tone}`}
              >
                {card.icon}
              </div>


              <div className="cstat-info">

                <div className="cstat-label">
                  {card.label}
                </div>


                <div className="cstat-value">
                  {card.value}
                </div>


                <div className="cstat-change">
                  {card.text}
                </div>

              </div>

            </article>
          )
        )}

      </div>


      {/* ======================================================
          RESULT SUMMARY
      ====================================================== */}

      <div className="customers-toolbar">

        <div className="customers-result-summary">

          <span className="customers-result-count">
            {filtered.length}
          </span>

          <span>
            {filtered.length === 1
              ? "customer"
              : "customers"}
          </span>

        </div>


        {search.trim() && (
          <button
            type="button"
            className="customers-clear-search"
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
          >
            Clear Search
          </button>
        )}

      </div>


      {/* ======================================================
          TABLE
      ====================================================== */}

      <div className="customers-card">

        <div className="customers-table-wrap">

          <table className="customers-table">

            <thead>

              <tr>
                <th>
                  Customer ID
                </th>

                <th>
                  Customer
                </th>

                <th>
                  Phone
                </th>

                <th>
                  Email
                </th>

                <th>
                  Nationality
                </th>

                <th>
                  Bookings
                </th>

                <th>
                  Last Stay
                </th>

                <th>
                  Status
                </th>

                <th>
                  Action
                </th>
              </tr>

            </thead>


            <tbody>

              {isLoading ? (
                <tr>

                  <td
                    colSpan={9}
                    className="customers-table-message"
                  >
                    Loading customers...
                  </td>

                </tr>
              ) : paginated.length ===
                0 ? (
                <tr>

                  <td colSpan={9}>

                    <CustomerEmptyState
                      hasSearch={
                        Boolean(
                          search.trim()
                        )
                      }
                      onAdd={
                        openAdd
                      }
                    />

                  </td>

                </tr>
              ) : (
                paginated.map(
                  (customer) => (
                    <tr
                      key={
                        customer.customer_id
                      }
                    >

                      <td className="customers-table-id">
                        {formatCustomerDisplayId(
                          customer.customer_id
                        )}
                      </td>


                      <td>

                        <div className="cust-avatar-cell">

                          <div className="cust-avatar">
                            {initials(
                              customer.full_name
                            )}
                          </div>


                          <div className="customer-name-copy">

                            <span className="customer-name">
                              {displayValue(
                                customer.full_name
                              )}
                            </span>

                          </div>

                        </div>

                      </td>


                      <td>
                        {displayValue(
                          customer.phone
                        )}
                      </td>


                      <td className="customer-muted-cell">
                        {displayValue(
                          customer.email
                        )}
                      </td>


                      <td>
                        {displayValue(
                          customer.nationality
                        )}
                      </td>


                      <td className="customer-bookings-cell">
                        {numberValue(
                          customer.bookings
                        )}
                      </td>


                      <td>
                        {displayValue(
                          customer.lastStay,
                          "No Stay"
                        )}
                      </td>


                      <td>

                        <span
                          className={
                            statusClass(
                              customer.status
                            )
                          }
                        >
                          {displayValue(
                            customer.status,
                            "Unknown"
                          )}
                        </span>

                      </td>


                      <td>

                        <div className="action-btns">

                          <button
                            type="button"
                            className="btn-icon btn-icon-view"
                            title="View"
                            aria-label={`View ${customer.full_name}`}
                            disabled={
                              viewLoading
                            }
                            onClick={() =>
                              openView(
                                customer
                              )
                            }
                          >
                            <IcoEye />
                          </button>


                          <button
                            type="button"
                            className="btn-icon btn-icon-edit"
                            title="Edit"
                            aria-label={`Edit ${customer.full_name}`}
                            onClick={() =>
                              openEdit(
                                customer
                              )
                            }
                          >
                            <IcoEdit />
                          </button>


                          <button
                            type="button"
                            className="btn-icon btn-icon-delete"
                            title="Delete"
                            aria-label={`Delete ${customer.full_name}`}
                            onClick={() =>
                              openDelete(
                                customer
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

        </div>


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
                1}

            {" "}to{" "}

            {Math.min(
              page *
                PER_PAGE,
              filtered.length
            )}

            {" "}of{" "}

            {filtered.length}

            {" "}customers

          </span>


          <div className="pagination-btns">

            <button
              type="button"
              className="pg-btn"
              disabled={
                page === 1
              }
              aria-label="Previous page"
              onClick={() =>
                setPage(
                  (current) =>
                    current - 1
                )
              }
            >
              <IcoChevL />
            </button>


            {Array.from(
              {
                length:
                  totalPages,
              },
              (
                _,
                index
              ) =>
                index + 1
            ).map(
              (
                pageNumber
              ) => (
                <button
                  type="button"
                  key={
                    pageNumber
                  }
                  className={[
                    "pg-btn",

                    page ===
                    pageNumber
                      ? "active"
                      : "",
                  ]
                    .filter(
                      Boolean
                    )
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
              disabled={
                totalPages === 0 ||
                page >=
                  totalPages
              }
              aria-label="Next page"
              onClick={() =>
                setPage(
                  (current) =>
                    current + 1
                )
              }
            >
              <IcoChevR />
            </button>

          </div>

        </div>

      </div>


      {/* ======================================================
          ADD CUSTOMER
      ====================================================== */}

      {showAdd && (
        <CustomerFormDialog
          title="Add New Customer"
          submitLabel="Add Customer"
          form={form}
          onChange={
            handleFormChange
          }
          onSave={
            handleAdd
          }
          onClose={() => {
            if (
              !isSaving
            ) {
              setShowAdd(
                false
              );
            }
          }}
          isSaving={
            isSaving
          }
          error={
            formError
          }
        />
      )}


      {/* ======================================================
          EDIT CUSTOMER
      ====================================================== */}

      {showEdit && (
        <CustomerFormDialog
          title="Edit Customer"
          submitLabel="Save Changes"
          form={form}
          onChange={
            handleFormChange
          }
          onSave={
            handleEdit
          }
          onClose={() => {
            if (
              !isSaving
            ) {
              setShowEdit(
                false
              );
            }
          }}
          isSaving={
            isSaving
          }
          error={
            formError
          }
        />
      )}


      {/* ======================================================
          VIEW CUSTOMER
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
              className="modal-box customer-view-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Customer Details"
              onMouseDown={(
                event
              ) =>
                event.stopPropagation()
              }
            >

              <div className="modal-header">

                <div>

                  <h3>
                    Customer Details
                  </h3>


                  <p className="customer-modal-subtitle">
                    {formatCustomerDisplayId(
                      selected.customer_id
                    )}
                  </p>

                </div>


                <button
                  type="button"
                  className="modal-close"
                  aria-label="Close customer details"
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

                {/* ============================================
                    CUSTOMER INFORMATION
                ============================================ */}

                <section className="customer-detail-section">

                  <h4>
                    Customer Information
                  </h4>


                  {[
                    [
                      "Full Name",
                      selected.full_name,
                    ],

                    [
                      "Phone",
                      selected.phone,
                    ],

                    [
                      "Email",
                      selected.email,
                    ],

                    [
                      "Gender",
                      selected.gender,
                    ],

                    [
                      "Nationality",
                      selected.nationality,
                    ],

                    [
                      "Address",
                      selected.address,
                    ],
                  ].map(
                    ([
                      label,
                      value,
                    ]) => (
                      <div
                        className="detail-row"
                        key={
                          label
                        }
                      >

                        <span className="detail-key">
                          {label}
                        </span>


                        <span className="detail-value">
                          {displayValue(
                            value
                          )}
                        </span>

                      </div>
                    )
                  )}

                </section>


                {/* ============================================
                    IDENTITY
                ============================================ */}

                <section className="customer-detail-section">

                  <h4>
                    Identity Details
                  </h4>


                  <div className="detail-row">

                    <span className="detail-key">
                      ID Proof Type
                    </span>


                    <span className="detail-value">
                      {displayValue(
                        selected.id_proof_type
                      )}
                    </span>

                  </div>


                  <div className="detail-row">

                    <span className="detail-key">
                      ID Proof Number
                    </span>


                    <span className="detail-value">
                      {displayValue(
                        selected.id_proof_number
                      )}
                    </span>

                  </div>

                </section>


                {/* ============================================
                    BOOKING SUMMARY
                ============================================ */}

                <section className="customer-detail-section">

                  <h4>
                    Booking Summary
                  </h4>


                  <div className="detail-row">

                    <span className="detail-key">
                      Total Bookings
                    </span>


                    <span className="detail-value">
                      {numberValue(
                        selected.totalBookings
                      )}
                    </span>

                  </div>
                  <div className="detail-row">
                    <span className="detail-key">
                      Guests Stayed
                    </span>

                    <span className="detail-value">
                      {numberValue(
                        selected.guestsStayed
                      )}
                    </span>
                  </div>


                  <div className="detail-row">

                    <span className="detail-key">
                      Total Paid
                    </span>


                    <span className="detail-value">
                      {formatMoney(
                        selected.totalSpent
                      )}
                    </span>

                  </div>


                  <div className="detail-row">

                    <span className="detail-key">
                      Last Stay
                    </span>


                    <span className="detail-value">
                      {displayValue(
                        selected.lastStay,
                        "No Stay"
                      )}
                    </span>

                  </div>


                  <div className="detail-row">

                    <span className="detail-key">
                      Current Status
                    </span>


                    <span className="detail-value">

                      <span
                        className={
                          statusClass(
                            selected.currentStatus
                          )
                        }
                      >
                        {displayValue(
                          selected.currentStatus,
                          "Unknown"
                        )}
                      </span>

                    </span>

                  </div>


                  <div className="detail-row">

                    <span className="detail-key">
                      Registered On
                    </span>


                    <span className="detail-value">
                      {formatDate(
                        selected.created_at
                      )}
                    </span>

                  </div>

                </section>

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
          DELETE CUSTOMER
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
              aria-label={`Delete ${selected.full_name}`}
              onMouseDown={(
                event
              ) =>
                event.stopPropagation()
              }
            >

              <div className="modal-header">

                <h3>
                  Delete Customer
                </h3>


                <button
                  type="button"
                  className="modal-close"
                  disabled={
                    isDeleting
                  }
                  aria-label="Close delete confirmation"
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
                  Delete{" "}
                  {selected.full_name}?
                </h4>


                <p>
                  This customer will be permanently deleted.
                  Customers with booking history cannot be deleted.
                </p>


                {actionError && (
                  <div
                    className="customer-form-error customer-delete-error"
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


export default Customers;