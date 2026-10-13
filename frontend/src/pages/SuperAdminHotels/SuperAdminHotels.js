import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import SuperAdminLayout from "../../layouts/SuperAdminLayout/SuperAdminLayout";

import SuperAdminSidebar from "../../components/navigation/SuperAdminSidebar/SuperAdminSidebar";

import SuperAdminTopbar from "../../components/navigation/SuperAdminTopbar/SuperAdminTopbar";

import HotelCard from "../../components/hotels/HotelCard/HotelCard";

import CreateHotelModal from "../../components/hotels/CreateHotelModal/CreateHotelModal";

import EditHotelModal from "../../components/hotels/EditHotelModal/EditHotelModal";

import hotelService from "../../services/hotelService";

import "./SuperAdminHotels.css";


function getErrorMessage(
  error
) {
  return (
    error?.response?.data
      ?.message ||
    error?.response?.data
      ?.error ||
    error?.message ||
    "Hotels could not be loaded."
  );
}


function statusValue(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}


function SuperAdminHotels() {
  const [
    hotels,
    setHotels,
  ] =
    useState([]);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState("");


  const [
    notice,
    setNotice,
  ] =
    useState("");


  const [
    search,
    setSearch,
  ] =
    useState("");


  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("all");


  const [
    createOpen,
    setCreateOpen,
  ] =
    useState(false);


  const [
    editingHotel,
    setEditingHotel,
  ] =
    useState(null);


  const loadHotels =
    useCallback(
      async ({
        initialLoad = false,
      } = {}) => {

        if (initialLoad) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }


        setError("");


        try {

          const result =
            await hotelService
              .getHotels();


          if (
            result?.success !==
            true
          ) {

            throw new Error(
              "Hotels could not be loaded."
            );
          }


          setHotels(
            Array.isArray(
              result.hotels
            )
              ? result.hotels
              : []
          );
        } catch (
          loadError
        ) {

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
      []
    );


  useEffect(() => {

    void loadHotels({
      initialLoad:
        true,
    });
  }, [
    loadHotels,
  ]);


  const summary =
    useMemo(() => {

      return hotels.reduce(
        (
          result,
          hotel
        ) => {

          const status =
            statusValue(
              hotel?.status
            );


          result.total += 1;


          if (
            status ===
            "active"
          ) {

            result.active += 1;
          }


          if (
            status ===
            "inactive"
          ) {

            result.inactive += 1;
          }


          result.admins +=
            Number(
              hotel
                ?.admins
                ?.count ||
              0
            );


          result.pendingRequests +=
            Number(
              hotel
                ?.pendingRequests ||
              0
            );


          return result;
        },
        {
          total:
            0,

          active:
            0,

          inactive:
            0,

          admins:
            0,

          pendingRequests:
            0,
        }
      );
    }, [
      hotels,
    ]);


  const visibleHotels =
    useMemo(() => {

      const term =
        search
          .trim()
          .toLowerCase();


      return hotels.filter(
        (hotel) => {

          if (
            statusFilter !==
              "all" &&
            statusValue(
              hotel?.status
            ) !==
              statusFilter
          ) {

            return false;
          }


          if (!term) {
            return true;
          }


          const adminNames =
            Array.isArray(
              hotel
                ?.admins
                ?.names
            )
              ? hotel
                  .admins
                  .names
              : [];


          const searchable =
            [
              hotel?.displayId,
              hotel?.name,
              hotel?.type,
              ...adminNames,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();


          return searchable
            .includes(
              term
            );
        }
      );
    }, [
      hotels,
      search,
      statusFilter,
    ]);


  const handleCreated =
    (
      hotel,
      message
    ) => {

      if (!hotel) {
        return;
      }


      setHotels(
        (current) => [
          hotel,

          ...current.filter(
            (item) =>
              item.displayId !==
              hotel.displayId
          ),
        ]
      );


      setError("");

      setNotice(
        message ||
        "Hotel created successfully."
      );
    };


  const handleUpdated =
    (
      hotel,
      message
    ) => {

      if (!hotel) {
        return;
      }


      setHotels(
        (current) =>
          current.map(
            (item) =>
              item.displayId ===
              hotel.displayId
                ? hotel
                : item
          )
      );


      setError("");

      setNotice(
        message ||
        "Hotel updated successfully."
      );
    };


  const sidebar = (
    <SuperAdminSidebar
      selectedHotel={null}
      hotelCount={
        summary.total
      }
      adminCount={
        summary.admins
      }
      pendingRequests={
        summary.pendingRequests
      }
    />
  );


  const topbar = (
    <SuperAdminTopbar
      title="Hotels"
      breadcrumbs={[
        {
          label:
            "Portfolio",

          to:
            "/superadmin-dashboard",
        },

        {
          label:
            "Hotels",
        },
      ]}
      selectedHotel={null}
      pendingRequests={
        summary.pendingRequests
      }
      onRefresh={() => {

        void loadHotels({
          initialLoad:
            false,
        });
      }}
      isRefreshing={
        refreshing
      }
    />
  );


  if (loading) {

    return (
      <SuperAdminLayout
        sidebar={sidebar}
        topbar={topbar}
      >
        <div className="sa-hotels-page">
          <section className="sa-hotels-page__state">
            <h2>
              Loading Hotels
            </h2>

            <p>
              Your hotel portfolio is
              being loaded securely.
            </p>
          </section>
        </div>
      </SuperAdminLayout>
    );
  }


  return (
    <SuperAdminLayout
      sidebar={sidebar}
      topbar={topbar}
    >
      <div className="sa-hotels-page">

        {error && (
          <div
            className="alert alert-error"
            role="alert"
          >
            {error}
          </div>
        )}


        {notice && (
          <div
            className="alert alert-success"
            role="status"
          >
            {notice}
          </div>
        )}


        <section className="sa-hotels-page__intro">
          <div>
            <span className="sa-hotels-page__eyebrow">
              PROPERTY PORTFOLIO
            </span>

            <h1>
              Hotels
            </h1>

            <p>
              Search, add and manage
              hotels owned by this
              Super Admin account.
            </p>
          </div>


          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {

              setNotice("");
              setCreateOpen(
                true
              );
            }}
          >
            + Add Hotel
          </button>
        </section>


        <section className="sa-hotels-page__summary">
          <article className="sa-hotels-page__summary-card">
            <span>
              Total Hotels
            </span>

            <strong>
              {summary.total}
            </strong>
          </article>


          <article className="sa-hotels-page__summary-card">
            <span>
              Active
            </span>

            <strong>
              {summary.active}
            </strong>
          </article>


          <article className="sa-hotels-page__summary-card">
            <span>
              Inactive
            </span>

            <strong>
              {summary.inactive}
            </strong>
          </article>


          <article className="sa-hotels-page__summary-card">
            <span>
              Hotel Admins
            </span>

            <strong>
              {summary.admins}
            </strong>
          </article>
        </section>


        <section className="sa-hotels-page__toolbar">
          <div className="sa-hotels-page__field">
            <label
              htmlFor="sa-hotel-search"
            >
              Search
            </label>

            <input
              id="sa-hotel-search"
              type="search"
              value={search}
              onChange={
                (event) =>
                  setSearch(
                    event.target.value
                  )
              }
              placeholder="Search hotel, ID, type or Admin..."
            />
          </div>


          <div className="sa-hotels-page__field">
            <label
              htmlFor="sa-hotel-status"
            >
              Status
            </label>

            <select
              id="sa-hotel-status"
              value={
                statusFilter
              }
              onChange={
                (event) =>
                  setStatusFilter(
                    event.target.value
                  )
              }
            >
              <option value="all">
                All Statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="rejected">
                Rejected
              </option>
            </select>
          </div>


          <div className="sa-hotels-page__count">
            {
              visibleHotels.length
            }{" "}
            {
              visibleHotels.length ===
              1
                ? "hotel"
                : "hotels"
            }
          </div>
        </section>


        {hotels.length ===
          0 ? (
          <section className="sa-hotels-page__state">
            <h2>
              No hotels yet
            </h2>

            <p>
              Add the first property to
              your portfolio.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                setCreateOpen(
                  true
                )
              }
            >
              Add First Hotel
            </button>
          </section>
        ) : visibleHotels.length ===
          0 ? (
          <section className="sa-hotels-page__state">
            <h2>
              No matching hotels
            </h2>

            <p>
              Try another search term or
              clear the status filter.
            </p>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {

                setSearch("");
                setStatusFilter(
                  "all"
                );
              }}
            >
              Clear Filters
            </button>
          </section>
        ) : (
          <section className="sa-hotels-page__grid">
            {visibleHotels.map(
              (hotel) => (
                <div
                  key={
                    hotel.displayId
                  }
                  className="sa-hotels-page__hotel"
                >
                  <HotelCard
                    hotel={hotel}
                  />

                  <button
                    type="button"
                    className="btn btn-outline sa-hotels-page__edit"
                    onClick={() => {

                      setNotice("");

                      setEditingHotel(
                        hotel
                      );
                    }}
                  >
                    Edit Hotel
                  </button>
                </div>
              )
            )}
          </section>
        )}


        <CreateHotelModal
          isOpen={
            createOpen
          }
          onClose={() =>
            setCreateOpen(
              false
            )
          }
          onCreated={
            handleCreated
          }
        />


        <EditHotelModal
          isOpen={
            Boolean(
              editingHotel
            )
          }
          hotel={
            editingHotel
          }
          onClose={() =>
            setEditingHotel(
              null
            )
          }
          onUpdated={
            handleUpdated
          }
        />

      </div>
    </SuperAdminLayout>
  );
}


export default SuperAdminHotels;