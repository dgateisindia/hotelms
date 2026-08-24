import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import apiClient from "../../services/apiClient";

import hotelSettingsService, {
  HOTEL_SETTINGS_SCOPE,
} from "../../services/hotelSettingsService";

import {
  digitsOnly,
  normalizeStoredPhone,
  buildPhoneNumber,
  splitStoredPhone,
  formatCurrency,
  formatDate,
  calculateNights,
  getTodayValue,
  getApiMessage,
  getPaymentDisplayStatus,
} from "./bookingUtils";

import {
  EDITABLE_BOOKING_STATUSES,
  validateCustomerProfile,
  validateGuestStep,
  validateStayRoomsStep,
  validateReservationPaymentStep,
} from "./bookingValidation";

import "./BookingDesk.css";

import {
  IcoCheck,
  IcoChevL,
  IcoPlus,
} from "../../utils/icons/BookingIcons";

import GuestStep from "./components/GuestStep";

import StayRoomsStep from "./components/StayRoomsStep";

import ReservationPaymentStep from "./components/ReservationPaymentStep";

import ReviewStep from "./components/ReviewStep";

/* ============================================================
   CONSTANTS
============================================================ */

const STEPS = [
  {
    id: 1,
    label: "Guest",
  },
  {
    id: 2,
    label: "Stay & Rooms",
  },
  {
    id: 3,
    label: "Booking Details",
  },
  {
    id: 4,
    label: "Review",
  },
];


const EMPTY_GUEST = {
  phone: "",
  guest_name: "",
  email: "",
  gender: "",
  nationality: "",
  address: "",
  id_proof_type: "",
  id_proof_number: "",
};


const EMPTY_BOOKING = {
  stay_type: "overnight",
  check_in: "",
  check_out: "",
  booking_status: "confirmed",
  special_request: "",
};

const EMPTY_PAYMENT = {
  mode: "none",
  amount: "",
  payment_method: "cash",
  transaction_id: "",
  notes: "",
};

const EMPTY_REFUND = {
  payment_method: "cash",
  transaction_id: "",
  notes: "",
};

function normalizeBookingDateTime(
  value
) {
  if (!value) {
    return "";
  }


  const text =
    String(
      value
    ).trim();


  function toLocalValue(
    date
  ) {
    const pad =
      (number) =>
        String(
          number
        ).padStart(
          2,
          "0"
        );


    return (
      `${date.getFullYear()}-` +
      `${pad(
        date.getMonth() + 1
      )}-` +
      `${pad(
        date.getDate()
      )}T` +
      `${pad(
        date.getHours()
      )}:` +
      `${pad(
        date.getMinutes()
      )}:` +
      `${pad(
        date.getSeconds()
      )}`
    );
  }


  /*
   * API may return:
   * 2026-08-22T09:32:00.000Z
   *
   * Convert timezone-aware values to hotel/admin
   * browser local datetime before editing.
   */
  if (
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(
      text
    )
  ) {
    const date =
      new Date(
        text
      );


    return Number.isNaN(
      date.getTime()
    )
      ? ""
      : toLocalValue(
          date
        );
  }


  /*
   * Already-local DB/API datetime.
   * Do not shift it again.
   */
  const localMatch =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
      .exec(
        text
      );


  if (
    localMatch
  ) {
    return (
      `${localMatch[1]}-` +
      `${localMatch[2]}-` +
      `${localMatch[3]}T` +
      `${localMatch[4]}:` +
      `${localMatch[5]}:` +
      `${localMatch[6] || "00"}`
    );
  }


  const fallbackDate =
    new Date(
      text
    );


  return Number.isNaN(
    fallbackDate.getTime()
  )
    ? ""
    : toLocalValue(
        fallbackDate
      );
}


function formatStayDateTime(
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
    return formatDate(
      value
    );
  }


  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      hour12:
        true,
    }
  ).format(
    date
  );
}


function formatStayDuration(
  minutes
) {
  const total =
    Number(
      minutes || 0
    );


  if (
    !Number.isFinite(
      total
    ) ||
    total <= 0
  ) {
    return "—";
  }


  const hours =
    Math.floor(
      total / 60
    );


  const mins =
    Math.round(
      total % 60
    );


  if (!mins) {
    return `${hours} hr${
      hours === 1
        ? ""
        : "s"
    }`;
  }


  return (
    `${hours} hr${
      hours === 1
        ? ""
        : "s"
    } ${mins} min`
  );
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

function BookingDesk() {
  const navigate =
    useNavigate();

  const location =
    useLocation();


  /* ==========================================================
     EDIT MODE
  ========================================================== */

  const editBookingId =
    useMemo(
      () => {
        const params =
          new URLSearchParams(
            location.search
          );


        const value =
          Number(
            params.get(
              "edit"
            )
          );


        return (
          Number.isSafeInteger(
            value
          ) &&
          value > 0
        )
          ? value
          : null;
      },
      [
        location.search,
      ]
    );


  const isEditMode =
    Boolean(
      editBookingId
    );

  const addRoomGroupId =
    useMemo(
      () => {
        if (
          isEditMode
        ) {
          return null;
        }


        const params =
          new URLSearchParams(
            location.search
          );


        if (
          params.get(
            "mode"
          ) !==
          "add-room"
        ) {
          return null;
        }


        const value =
          Number(
            params.get(
              "group"
            )
          );


        return (
          Number.isSafeInteger(
            value
          ) &&
          value > 0
        )
          ? value
          : null;
      },
      [
        location.search,
        isEditMode,
      ]
    );


  const isAddRoomMode =
    Boolean(
      addRoomGroupId
    );


  /* ==========================================================
     STEP
  ========================================================== */

  const [
    step,
    setStep,
  ] = useState(1);


  /* ==========================================================
     CUSTOMER
  ========================================================== */

  const [
    guest,
    setGuest,
  ] = useState(
    EMPTY_GUEST
  );

  const [
    matchedCustomer,
    setMatchedCustomer,
  ] = useState(null);

  const [
    editingCustomer,
    setEditingCustomer,
  ] = useState(false);


  const [
    savingCustomer,
    setSavingCustomer,
  ] = useState(false);

  /* ==========================================================
     BOOKING
  ========================================================== */

  const [
    booking,
    setBooking,
  ] = useState(
    EMPTY_BOOKING
  );


  const [
    existingCustomerId,
    setExistingCustomerId,
  ] = useState(null);


  const [
    existingPaymentStatus,
    setExistingPaymentStatus,
  ] = useState(
    "unpaid"
  );


  const [
    existingAmountPaid,
    setExistingAmountPaid,
  ] = useState(0);

  const [
    dayUsePolicy,
    setDayUsePolicy,
  ] = useState({
    enabled: false,
  });


  const [
    policyLoading,
    setPolicyLoading,
  ] = useState(
    !isEditMode
  );


  const [
    policyError,
    setPolicyError,
  ] = useState("");


  const [
    pricingQuote,
    setPricingQuote,
  ] = useState(null);


  const [
    quoteLoading,
    setQuoteLoading,
  ] = useState(false);


  const [
    quoteError,
    setQuoteError,
  ] = useState("");


  const [
    existingBookingTotal,
    setExistingBookingTotal,
  ] = useState(0);

  const [
    reservationGroup,
    setReservationGroup,
  ] = useState(
    null
  );

  /* ==========================================================
     PAYMENT
  ========================================================== */

  const [
    payment,
    setPayment,
  ] = useState(
    EMPTY_PAYMENT
  );

  const [
    refund,
    setRefund,
  ] = useState(
    EMPTY_REFUND
  );

  /* ==========================================================
     ROOMS
  ========================================================== */

  const [
    availableRooms,
    setAvailableRooms,
  ] = useState([]);


  const [
    selectedRooms,
    setSelectedRooms,
  ] = useState([]);


  const [
    roomsLoading,
    setRoomsLoading,
  ] = useState(false);


  const [
    roomsError,
    setRoomsError,
  ] = useState("");


  /* ==========================================================
     PAGE STATE
  ========================================================== */

  const [
    loading,
    setLoading,
  ] = useState(
    isEditMode ||
    isAddRoomMode
  );


  const [
    loadError,
    setLoadError,
  ] = useState("");


  const [
    formError,
    setFormError,
  ] = useState("");

  const formErrorRef =
    useRef(null);

  useEffect(() => {
    if (
      !formError
    ) {
      return;
    }


    const timer =
      window.setTimeout(
        () => {
          formErrorRef
            .current
            ?.scrollIntoView({
              behavior:
                "smooth",

              block:
                "center",
            });
        },
        50
      );


    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    formError,
  ]);


  const [
    submitting,
    setSubmitting,
  ] = useState(false);


  const [
    success,
    setSuccess,
  ] = useState(null);


  const today =
    useMemo(
      () =>
        getTodayValue(),
      []
    );


  const nights =
    useMemo(
      () => {
        if (
          booking.stay_type ===
          "day_use"
        ) {
          return 0;
        }


        return calculateNights(
          booking.check_in,
          booking.check_out
        );
      },
      [
        booking.stay_type,
        booking.check_in,
        booking.check_out,
      ]
    );


  const dayUseDurationMinutes =
    useMemo(
      () => {
        if (
          booking.stay_type !==
            "day_use" ||
          !booking.check_in ||
          !booking.check_out
        ) {
          return 0;
        }


        const start =
          new Date(
            booking.check_in
          );


        const end =
          new Date(
            booking.check_out
          );


        if (
          Number.isNaN(
            start.getTime()
          ) ||
          Number.isNaN(
            end.getTime()
          ) ||
          end <= start
        ) {
          return 0;
        }


        return (
          end.getTime() -
          start.getTime()
        ) / (
          60 *
          1000
        );
      },
      [
        booking.stay_type,
        booking.check_in,
        booking.check_out,
      ]
    );


  const stayRangeValid =
    useMemo(
      () => {
        if (
          !booking.check_in ||
          !booking.check_out
        ) {
          return false;
        }


        if (
          booking.stay_type ===
          "day_use"
        ) {
          return (
            dayUseDurationMinutes >
              0 &&
            String(
              booking.check_in
            ).slice(
              0,
              10
            ) ===
            String(
              booking.check_out
            ).slice(
              0,
              10
            )
          );
        }


        return nights > 0;
      },
      [
        booking.stay_type,
        booking.check_in,
        booking.check_out,
        dayUseDurationMinutes,
        nights,
      ]
    );


  const profileLocked =
    Boolean(
      matchedCustomer
    ) &&
    !editingCustomer;

  /* ==========================================================
    BOOKING POLICY

    Booking Desk only needs the current Day Use policy
    to decide whether the option should be available.

    Pricing itself still comes from /bookings/quote.
  ========================================================== */

  useEffect(() => {
    if (
      isEditMode
    ) {
      setPolicyLoading(false);

      return;
    }


    let active =
      true;


    async function loadBookingPolicy() {
      setPolicyLoading(true);
      setPolicyError("");


      try {
        const data =
          await hotelSettingsService
            .getSettings({
              scope:
                HOTEL_SETTINGS_SCOPE
                  .ADMIN,
            });


        if (!active) {
          return;
        }


        setDayUsePolicy(
          data
            ?.settings
            ?.day_use ||
          {
            enabled: false,
          }
        );
      } catch (error) {
        if (!active) {
          return;
        }


        setDayUsePolicy({
          enabled: false,
        });


        setPolicyError(
          error?.message ||
          "Hotel stay policy could not be loaded."
        );
      } finally {
        if (active) {
          setPolicyLoading(false);
        }
      }
    }


    void loadBookingPolicy();


    return () => {
      active = false;
    };
  }, [
    isEditMode,
  ]);


  /* ==========================================================
    LOAD RESERVATION GROUP FOR ADD ROOM MODE
  ========================================================== */

  useEffect(() => {
    if (
      !isAddRoomMode ||
      !addRoomGroupId
    ) {
      return;
    }

    let active =
      true;

    async function loadReservationGroup() {
      setLoading(true);
      setLoadError("");

      try {
        const response =
          await apiClient.get(
            `/bookings/groups/${addRoomGroupId}`
          );

        const data =
          response.data?.data;

        if (
          !active
        ) {
          return;
        }

        if (
          !data ||
          !data.customer ||
          !Array.isArray(
            data.bookings
          )
        ) {
          setLoadError(
            "The reservation group could not be loaded."
          );

          return;
        }

        const openBookings =
          data.bookings.filter(
            (item) =>
              item.booking_status !==
              "cancelled"
          );

        const groupCanAcceptRoom =
          openBookings.some(
            (item) =>
              [
                "pending",
                "confirmed",
                "checked_in",
              ].includes(
                item.booking_status
              )
          );

        if (
          !groupCanAcceptRoom
        ) {
          setLoadError(
            "New rooms cannot be added to a completed or fully cancelled reservation group."
          );

          return;
        }

        const stayTypes =
          new Set(
            openBookings.map(
              (item) =>
                item.stay_type
            )
          );

        if (
          stayTypes.size !== 1
        ) {
          setLoadError(
            "This reservation group contains inconsistent stay types and requires review."
          );

          return;
        }

        const groupStayType =
          [
            ...stayTypes,
          ][0];

        const customer =
          data.customer;

        setReservationGroup({
          reservation_group_id:
            data.reservation_group_id,

          group_code:
            data.group_code,
        });

        setExistingCustomerId(
          Number(
            customer.customer_id
          )
        );

        setGuest({
          phone:
            splitStoredPhone(
              customer.phone
            ),

          guest_name:
            customer.full_name ||
            "",

          email:
            customer.email ||
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
        });

        setMatchedCustomer({
          customer_id:
            customer.customer_id,

          full_name:
            customer.full_name,

          phone:
            customer.phone,

          email:
            customer.email,

          gender:
            customer.gender,

          nationality:
            customer.nationality,

          address:
            customer.address,

          id_proof_type:
            customer.id_proof_type,

          id_proof_number:
            customer.id_proof_number,
        });

        setBooking(
          (current) => ({
            ...current,

            stay_type:
              groupStayType,

            check_in: "",
            check_out: "",

            booking_status:
              "confirmed",

            special_request:
              "",
          })
        );

        /*
        * Guest already belongs to this reservation.
        * Start directly from Stay & Rooms.
        */
        setStep(2);
      } catch (error) {
        if (
          active
        ) {
          setLoadError(
            getApiMessage(
              error,
              "The reservation group could not be loaded."
            )
          );
        }
      } finally {
        if (
          active
        ) {
          setLoading(false);
        }
      }
    }

    void loadReservationGroup();

    return () => {
      active = false;
    };
  }, [
    addRoomGroupId,
    isAddRoomMode,
  ]);

  /* ==========================================================
     LOAD EXISTING BOOKING
  ========================================================== */

  useEffect(() => {
    if (
      !isEditMode
    ) {
      return;
    }


    let active =
      true;


    async function loadExistingBooking() {
      setLoading(true);
      setLoadError("");


      try {
        const response =
          await apiClient.get(
            `/bookings/${editBookingId}`
          );


        const data =
          response.data;


        if (!active) {
          return;
        }


        if (
          !EDITABLE_BOOKING_STATUSES.has(
            data.booking_status
          )
        ) {
          setLoadError(
            data.booking_status ===
              "checked_in"
              ? "This guest is already checked in. Normal Edit is locked. Use the operational stay actions instead."
              : "This booking is read-only and can no longer be changed through normal Edit."
          );


          return;
        }


        setExistingCustomerId(
          Number(
            data.customer_id
          )
        );


        setExistingPaymentStatus(
          data.payment_status ||
          "unpaid"
        );


        setExistingAmountPaid(
          Number(
            data.amount_paid ||
            0
          )
        );

        setExistingBookingTotal(
          Number(
            data.total_amount ||
            0
          )
        );


        const localPhone =
          splitStoredPhone(
            data.phone
          );


        setGuest({
          phone:
            localPhone,

          guest_name:
            data.full_name ||
            "",

          email:
            data.email ||
            "",

          gender:
            data.gender ||
            "",

          nationality:
            data.nationality ||
            "",

          address:
            data.address ||
            "",

          id_proof_type:
            data.id_proof_type ||
            "",

          id_proof_number:
            data.id_proof_number ||
            "",
        });


        setMatchedCustomer({
          customer_id:
            data.customer_id,

          full_name:
            data.full_name,

          phone:
            data.phone,

          email:
            data.email,

          gender:
            data.gender,

          nationality:
            data.nationality,

          address:
            data.address,

          id_proof_type:
            data.id_proof_type,

          id_proof_number:
            data.id_proof_number,
        });

        const existingStayType =
          data.stay_type ||
          "overnight";

        setBooking({
          stay_type:
            existingStayType,

          check_in:
            data.check_in
              ? existingStayType ===
                  "day_use"
                ? normalizeBookingDateTime(
                    data.check_in
                  )
                : String(
                    data.check_in
                  ).slice(
                    0,
                    10
                  )
              : "",

          check_out:
            data.check_out
              ? existingStayType ===
                  "day_use"
                ? normalizeBookingDateTime(
                    data.check_out
                  )
                : String(
                    data.check_out
                  ).slice(
                    0,
                    10
                  )
              : "",

          booking_status:
            data.booking_status ||
            "confirmed",

          special_request:
            data.special_request ||
            "",
        });


        setSelectedRooms([
          {
            room_id:
              Number(
                data.room_id
              ),

            room_number:
              data.room_number,

            room_type:
              data.room_type,

            floor_number:
              data.floor_number,

            capacity:
              Number(
                data.capacity ||
                1
              ),

            /*
             * Important:
             * preserve historical booked rate.
             */
            price_per_night:
              Number(
                data.booked_rate_per_night ||
                0
              ),

            total_guests:
              Number(
                data.total_guests ||
                1
              ),

            existing: true,
          },
        ]);
      } catch (
        error
      ) {
        if (!active) {
          return;
        }


        setLoadError(
          getApiMessage(
            error,
            "The booking could not be loaded."
          )
        );
      } finally {
        if (
          active
        ) {
          setLoading(false);
        }
      }
    }


    void loadExistingBooking();


    return () => {
      active = false;
    };
  }, [
    editBookingId,
    isEditMode,
  ]);

  /* ==========================================================
    CUSTOMER PHONE LOOKUP

    Secure hotel-scoped backend lookup.

    No full customer list is downloaded to Booking Desk.
  ========================================================== */

  useEffect(() => {
    if (
      isEditMode ||
      isAddRoomMode
    ) {
      return;
    }

    const phone =
      digitsOnly(
        guest.phone
      );


    /*
    * Do not call API until a complete valid
    * Indian mobile number has been entered.
    */
    if (
      !/^[6-9]\d{9}$/.test(
        phone
      )
    ) {
      setMatchedCustomer(
        null
      );

      setEditingCustomer(
        false
      );

      return;
    }


    let active =
      true;


    const timer =
      window.setTimeout(
        async () => {
          try {
            const response =
              await apiClient.get(
                "/customers/lookup",
                {
                  params: {
                    phone,
                  },
                }
              );


            if (
              !active
            ) {
              return;
            }


            const found =
              Boolean(
                response.data?.found
              );


            const customer =
              response.data?.data ||
              null;


            if (
              !found ||
              !customer
            ) {
              setMatchedCustomer(
                null
              );

              setEditingCustomer(
                false
              );

              return;
            }


            setMatchedCustomer(
              customer
            );


            setEditingCustomer(
              false
            );


            setGuest(
              (current) => ({
                ...current,

                guest_name:
                  customer.full_name ||
                  "",

                email:
                  customer.email ||
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
              })
            );
          } catch (error) {
            if (
              !active
            ) {
              return;
            }


            setMatchedCustomer(
              null
            );


            setEditingCustomer(
              false
            );


            /*
            * 400 is not expected because frontend
            * validates the number before calling.
            *
            * For server/network failures, don't destroy
            * manually typed customer details.
            */
            if (
              Number(
                error?.status
              ) >= 500
            ) {
              setFormError(
                "Customer lookup is temporarily unavailable. Please try again."
              );
            }
          }
        },
        300
      );


    return () => {
      active =
        false;

      window.clearTimeout(
        timer
      );
    };
  }, [
    guest.phone,
    isEditMode,
    isAddRoomMode,
  ]);


  /* ==========================================================
     AVAILABLE ROOMS
  ========================================================== */

  const loadAvailableRooms =
    useCallback(
      async () => {
        if (
          !booking.check_in ||
          !booking.check_out
        ) {
          setAvailableRooms([]);
          setRoomsError("");

          return;
        }


        if (
          !stayRangeValid
        ) {
          setAvailableRooms([]);

          setRoomsError(
            booking.stay_type ===
              "day_use"
              ? "Day Use must start and end on the same day, and checkout must be later than check-in."
              : "Check-out must be later than check-in."
          );

          return;
        }


        setRoomsLoading(true);
        setRoomsError("");


        try {
          const params =
            new URLSearchParams({
              checkIn:
                booking.check_in,

              checkOut:
                booking.check_out,
            });


          if (
            isEditMode &&
            editBookingId
          ) {
            params.set(
              "excludeBookingId",
              String(
                editBookingId
              )
            );
          }


          const response =
            await apiClient.get(
              `/rooms/available?${params.toString()}`
            );


          const rooms =
            Array.isArray(
              response.data?.data
            )
              ? response.data.data
              : [];


          setAvailableRooms(
            rooms
          );


          if (
            !isEditMode
          ) {
            const allowedIds =
              new Set(
                rooms.map(
                  (room) =>
                    Number(
                      room.room_id
                    )
                )
              );


            setSelectedRooms(
              (current) =>
                current.filter(
                  (room) =>
                    allowedIds.has(
                      Number(
                        room.room_id
                      )
                    )
                )
            );
          }
        } catch (
          error
        ) {
          setAvailableRooms([]);

          setRoomsError(
            getApiMessage(
              error,
              "Available rooms could not be loaded."
            )
          );
        } finally {
          setRoomsLoading(false);
        }
      },
      [
        booking.stay_type,
        booking.check_in,
        booking.check_out,
        editBookingId,
        isEditMode,
        stayRangeValid,
      ]
    );


  useEffect(() => {
    if (
      !booking.check_in ||
      !booking.check_out
    ) {
      return;
    }


    const timer =
      window.setTimeout(
        () => {
          void loadAvailableRooms();
        },
        250
      );


    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    booking.check_in,
    booking.check_out,
    loadAvailableRooms,
  ]);


  /* ==========================================================
    TRUSTED BOOKING PRICE QUOTE

    CREATE:
    /bookings/quote
    → current hotel policy

    EDIT:
    /bookings/:id/quote
    → original booking policy snapshot

    Final Save still recalculates authoritatively.
  ========================================================== */

  useEffect(() => {
    const missingEditContext =
      isEditMode &&
      (
        !editBookingId ||
        !existingCustomerId
      );


    if (
      !stayRangeValid ||
      selectedRooms.length ===
        0 ||
      missingEditContext
    ) {
      setPricingQuote(null);
      setQuoteLoading(false);
      setQuoteError("");

      return;
    }


    let active =
      true;


    setPricingQuote(null);
    setQuoteLoading(true);
    setQuoteError("");


    const timer =
      window.setTimeout(
        async () => {
          try {
            let response;


            if (
              isEditMode
            ) {
              const room =
                selectedRooms[0];


              response =
                await apiClient.post(
                  `/bookings/${editBookingId}/quote`,
                  {
                    customer_id:
                      existingCustomerId,

                    stay_type:
                      booking.stay_type,

                    room_id:
                      Number(
                        room.room_id
                      ),

                    check_in:
                      booking.check_in,

                    check_out:
                      booking.check_out,

                    total_guests:
                      Number(
                        room.total_guests ||
                        1
                      ),

                    booking_status:
                      booking.booking_status,

                    special_request:
                      booking.special_request.trim() ||
                      null,
                  }
                );
            } else {
              response =
                await apiClient.post(
                  "/bookings/quote",
                  {
                    stay_type:
                      booking.stay_type,

                    booking_status:
                      booking.booking_status,

                    rooms:
                      selectedRooms.map(
                        (room) => ({
                          room_id:
                            Number(
                              room.room_id
                            ),

                          check_in:
                            booking.check_in,

                          check_out:
                            booking.check_out,

                          total_guests:
                            Number(
                              room.total_guests ||
                              1
                            ),
                        })
                      ),
                  }
                );
            }


            if (
              !active
            ) {
              return;
            }


            setPricingQuote(
              response.data?.data ||
              null
            );
          } catch (
            error
          ) {
            if (
              !active
            ) {
              return;
            }


            setPricingQuote(null);


            setQuoteError(
              getApiMessage(
                error,
                isEditMode
                  ? "The updated reservation price could not be calculated."
                  : "Booking price could not be calculated."
              )
            );
          } finally {
            if (
              active
            ) {
              setQuoteLoading(false);
            }
          }
        },
        250
      );


    return () => {
      active = false;

      window.clearTimeout(
        timer
      );
    };
  }, [
    isEditMode,
    editBookingId,
    existingCustomerId,
    stayRangeValid,
    booking.stay_type,
    booking.check_in,
    booking.check_out,
    booking.booking_status,
    booking.special_request,
    selectedRooms,
  ]);

  /* ==========================================================
     TOTALS
  ========================================================== */

  const roomTotals =
    useMemo(
      () => {
        /*
        * Existing Overnight edit preserves old behaviour.
        *
        * Existing Day Use remains on its stored total until
        * dedicated snapshot-based Edit Quote UI is connected.
        */
        if (
          isEditMode
        ) {
          return selectedRooms.map(
            (room) => {
              const quoteMatchesRoom =
                pricingQuote &&
                Number(
                  pricingQuote.room_id
                ) ===
                Number(
                  room.room_id
                );


              return {
                ...room,

                pricing_mode:
                  quoteMatchesRoom
                    ? pricingQuote
                        .pricing_mode ||
                      null
                    : null,

                duration_minutes:
                  quoteMatchesRoom
                    ? pricingQuote
                        .duration_minutes ??
                      null
                    : null,

                rate_per_night:
                  quoteMatchesRoom
                    ? Number(
                        pricingQuote
                          .rate_per_night ??
                        room.price_per_night ??
                        0
                      )
                    : Number(
                        room.price_per_night ||
                        0
                      ),

                total_amount:
                  quoteMatchesRoom
                    ? Number(
                        pricingQuote
                          .total_amount ||
                        0
                      )
                    : existingBookingTotal,
              };
            }
          );
        }

        const quoteRooms =
          Array.isArray(
            pricingQuote?.rooms
          )
            ? pricingQuote.rooms
            : [];

        const quoteMap =
          new Map(
            quoteRooms.map(
              (quote) => [
                Number(
                  quote.room_id
                ),
                quote,
              ]
            )
          );


        return selectedRooms.map(
          (room) => {
            const quote =
              quoteMap.get(
                Number(
                  room.room_id
                )
              );


            return {
              ...room,

              pricing_mode:
                quote
                  ?.pricing_mode ||
                null,

              duration_minutes:
                quote
                  ?.duration_minutes ??
                null,

              rate_per_night:
                quote
                  ?.rate_per_night ??
                Number(
                  room.price_per_night ||
                  0
                ),

              total_amount:
                Number(
                  quote
                    ?.total_amount ||
                  0
                ),
            };
          }
        );
      },
      [
        booking.stay_type,
        existingBookingTotal,
        isEditMode,
        nights,
        pricingQuote,
        selectedRooms,
      ]
    );


  const grandTotal =
    useMemo(
      () =>
        Number(
          roomTotals
            .reduce(
              (
                total,
                room
              ) =>
                total +
                Number(
                  room.total_amount ||
                  0
                ),
              0
            )
            .toFixed(2)
        ),
      [
        roomTotals,
      ]
    );


  const totalGuests =
    useMemo(
      () =>
        selectedRooms.reduce(
          (
            total,
            room
          ) =>
            total +
            Number(
              room.total_guests ||
              0
            ),
          0
        ),
      [
        selectedRooms,
      ]
    );

  const refundRequired =
    isEditMode &&
    pricingQuote
      ?.refund_required ===
      true &&
    Number(
      pricingQuote
        ?.refund_required_amount ||
      0
    ) >
      0.009;


  const refundRequiredAmount =
    refundRequired
      ? Number(
          pricingQuote
            .refund_required_amount
        )
      : 0;
  
  const paymentNow =
    useMemo(
      () => {
        if (
          isEditMode
        ) {
          return Math.max(
            0,
            Number(
              (
                existingAmountPaid -
                refundRequiredAmount
              ).toFixed(2)
            )
          );
        }

        if (
          payment.mode ===
          "full"
        ) {
          return grandTotal;
        }


        if (
          payment.mode ===
          "advance"
        ) {
          const amount =
            Number(
              payment.amount
            );


          return Number.isFinite(
            amount
          )
            ? Math.max(
                0,
                amount
              )
            : 0;
        }


        return 0;
      },
      [
        refundRequiredAmount,
        existingAmountPaid,
        grandTotal,
        isEditMode,
        payment.amount,
        payment.mode,
      ]
    );


  const balanceDue =
    useMemo(
      () =>
        Math.max(
          0,
          Number(
            (
              grandTotal -
              paymentNow
            ).toFixed(2)
          )
        ),
      [
        grandTotal,
        paymentNow,
      ]
    );


  const paymentPreviewStatus =
    useMemo(
      () =>
        getPaymentDisplayStatus(
          paymentNow,
          grandTotal
        ),
      [
        paymentNow,
        grandTotal,
      ]
    );

    const pricingSaveBlocked =
      isEditMode &&
      pricingQuote
        ?.can_save ===
        false &&
      !refundRequired;



  function startCustomerEdit() {
    if (
      !matchedCustomer
    ) {
      return;
    }


    setFormError("");
    setEditingCustomer(true);
  }


  function cancelCustomerEdit() {
    if (
      !matchedCustomer
    ) {
      return;
    }


    setGuest(
      (current) => ({
        ...current,

        guest_name:
          matchedCustomer.full_name ||
          "",

        email:
          matchedCustomer.email ||
          "",

        gender:
          matchedCustomer.gender ||
          "",

        nationality:
          matchedCustomer.nationality ||
          "",

        address:
          matchedCustomer.address ||
          "",

        id_proof_type:
          matchedCustomer.id_proof_type ||
          "",

        id_proof_number:
          matchedCustomer.id_proof_number ||
          "",
      })
    );


    setEditingCustomer(false);
    setFormError("");
  }


  async function saveCustomerDetails() {
    if (
      !matchedCustomer
    ) {
      return;
    }

    const profileError =
      validateCustomerProfile(
        guest
      );


    if (
      profileError
    ) {
      setFormError(
        profileError
      );

      return;
    }

    const fullName =
      guest.guest_name.trim();


    setSavingCustomer(true);
    setFormError("");


    try {
      await apiClient.put(
        `/customers/${matchedCustomer.customer_id}`,
        {
          full_name:
            fullName,

          /*
          * Phone is intentionally preserved.
          * Changing phone means changing customer identity,
          * so that will be handled from Customer Details later.
          */
          phone:
            normalizeStoredPhone(
              matchedCustomer.phone
            ),

          email:
            guest.email.trim() ||
            null,

          gender:
            guest.gender ||
            null,

          nationality:
            guest.nationality.trim() ||
            null,

          address:
            guest.address.trim() ||
            null,

          id_proof_type:
            guest.id_proof_type ||
            null,

          id_proof_number:
            guest.id_proof_number.trim() ||
            null,
        }
      );


      setMatchedCustomer(
        (current) => ({
          ...current,

          full_name:
            fullName,

          email:
            guest.email.trim() ||
            null,

          gender:
            guest.gender ||
            null,

          nationality:
            guest.nationality.trim() ||
            null,

          address:
            guest.address.trim() ||
            null,

          id_proof_type:
            guest.id_proof_type ||
            null,

          id_proof_number:
            guest.id_proof_number.trim() ||
            null,
        })
      );


      setEditingCustomer(false);
    } catch (error) {
      setFormError(
        getApiMessage(
          error,
          "Customer details could not be updated."
        )
      );
    } finally {
      setSavingCustomer(false);
    }
  }

  /* ==========================================================
     INPUT HANDLERS
  ========================================================== */

  function updateGuest(
    field,
    value
  ) {
    setFormError("");


    /* ==========================================================
      PHONE

      Previous bug:
      Every key press cleared name/email/address/ID fields.

      New behaviour:
      - New customer typing → preserve entered details.
      - Previously matched customer → clear old customer's
        profile when phone is changed.
    ========================================================== */

    if (
      field ===
      "phone"
    ) {
      const nextPhone =
        digitsOnly(
          value
        ).slice(
          0,
          10
        );


      const hadMatchedCustomer =
        Boolean(
          matchedCustomer
        );


      setMatchedCustomer(
        null
      );

      setEditingCustomer(false);

      setGuest(
        (current) => ({
          ...current,

          phone:
            nextPhone,

          ...(hadMatchedCustomer
            ? {
                guest_name: "",
                email: "",
                gender: "",
                nationality: "",
                address: "",
                id_proof_type: "",
                id_proof_number: "",
              }
            : {}),
        })
      );


      return;
    }


    /* ==========================================================
      NORMAL PROFILE FIELD
    ========================================================== */

    setGuest(
      (current) => ({
        ...current,

        [field]:
          value,
      })
    );
  }


  function updateBooking(
    field,
    value
  ) {
    if (
      field ===
        "stay_type" &&
      isAddRoomMode
    ) {
      return;
    }
    if (
      field ===
        "stay_type" &&
      !isEditMode &&
      !isAddRoomMode
    ) {
      setBooking(
        (current) => ({
          ...current,

          stay_type:
            value,

          check_in: "",
          check_out: "",
        })
      );
      setSelectedRooms([]);
      setAvailableRooms([]);
      setPricingQuote(null);
      setQuoteError("");
      setRoomsError("");
      setFormError("");
      return;
    }
    setBooking(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );
    setFormError("");
  }


  function updatePayment(
    field,
    value
  ) {
    setPayment(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );
    setFormError("");
  }

  function updateRefund(
    field,
    value
  ) {
    setRefund(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );
    setFormError("");
  }

  /* ==========================================================
     ROOM SELECTION
  ========================================================== */

  function isRoomSelected(
    roomId
  ) {
    return selectedRooms.some(
      (room) =>
        Number(
          room.room_id
        ) ===
        Number(roomId)
    );
  }


  function addRoom(
    room
  ) {
    if (
      isEditMode
    ) {
      setSelectedRooms([
        {
          ...room,

          room_id:
            Number(
              room.room_id
            ),

          price_per_night:
            Number(
              room.price_per_night ||
              0
            ),

          capacity:
            Number(
              room.capacity ||
              1
            ),

          total_guests: 1,
        },
      ]);


      return;
    }


    if (
      isRoomSelected(
        room.room_id
      )
    ) {
      return;
    }


    setSelectedRooms(
      (current) => [
        ...current,

        {
          ...room,

          room_id:
            Number(
              room.room_id
            ),

          price_per_night:
            Number(
              room.price_per_night ||
              0
            ),

          capacity:
            Number(
              room.capacity ||
              1
            ),

          total_guests: 1,
        },
      ]
    );
  }


  function removeRoom(
    roomId
  ) {
    if (
      isEditMode
    ) {
      return;
    }


    setSelectedRooms(
      (current) =>
        current.filter(
          (room) =>
            Number(
              room.room_id
            ) !==
            Number(roomId)
        )
    );
  }


  function updateRoomGuests(
    roomId,
    value
  ) {
    const parsed =
      Number(value);


    setSelectedRooms(
      (current) =>
        current.map(
          (room) => {
            if (
              Number(
                room.room_id
              ) !==
              Number(roomId)
            ) {
              return room;
            }


            return {
              ...room,

              total_guests:
                Number.isSafeInteger(
                  parsed
                ) &&
                parsed >= 1
                  ? parsed
                  : 1,
            };
          }
        )
    );
  }


  /* ==========================================================
     VALIDATION
  ========================================================== */

  function goNext() {
    if (
      step === 1 &&
      editingCustomer
    ) {
      setFormError(
        "Save or cancel the customer changes before continuing."
      );

      return;
    }
    
    let error = "";

    if (
      step === 1
    ) {
      error =
        validateGuestStep({
          isEditMode,
          guest,
          matchedCustomer,
        });
    }

    if (
      step === 2
    ) {
      error =
        validateStayRoomsStep({
          booking,
          nights,
          selectedRooms,
        });
    }

    if (
      step === 2 &&
      !error
    ) {
      if (
        quoteLoading
      ) {
        error =
          "Calculating the booking price. Please wait.";
      } else if (
        quoteError
      ) {
        error =
          quoteError;
      } else if (
        !pricingQuote
      ) {
        error =
          "The booking price could not be confirmed.";
      } else if (
        isEditMode &&
        pricingQuote
          .can_save ===
          false &&
        !refundRequired
      ) {
        error =
          pricingQuote
            .payment_message ||
          "This reservation cannot be saved until its payment adjustment is resolved.";
      }
    }

    if (
      step === 3
    ) {
      error =
        validateReservationPaymentStep({
        booking,
        payment,
        isEditMode,
        grandTotal,
        refund,
        pricingQuote,
      });
    }

    if (error) {
      setFormError(
        error
      );

      return;
    }


    setFormError("");


    setStep(
      (current) =>
        Math.min(
          4,
          current + 1
        )
    );
  }


  function goBack() {
    setFormError("");

    if (
      isAddRoomMode &&
      step === 2
    ) {
      navigate(
        `/bookings/groups/${addRoomGroupId}`
      );

      return;
    }

    setStep(
      (current) =>
        Math.max(
          1,
          current - 1
        )
    );
  }


  /* ==========================================================
     SUBMIT
  ========================================================== */

  async function handleSubmit() {

    if (
      editingCustomer
    ) {
      setFormError(
        "Save or cancel the customer changes before saving the reservation."
      );

      setStep(1);

      return;
    }
    
    const validationError =
      (
        isAddRoomMode
          ? ""
          : validateGuestStep({
              isEditMode,
              guest,
              matchedCustomer,
            })
      ) ||
      validateStayRoomsStep({
        booking,
        nights,
        selectedRooms,
      }) ||
      validateReservationPaymentStep({
        booking,
        payment,
        isEditMode,
        grandTotal,
        refund,
        pricingQuote,
      });


    if (
      validationError
    ) {
      setFormError(
        validationError
      );

      return;
    }

    if (
      quoteLoading ||
      quoteError ||
      !pricingQuote
    ) {
      setFormError(
        quoteError ||
        (
          quoteLoading
            ? "Calculating the booking price. Please wait."
            : "The booking price could not be confirmed."
        )
      );

      setStep(2);

      return;
    }


    if (
      isEditMode &&
      pricingQuote
        .can_save ===
        false &&
      !refundRequired
    ) {
      setFormError(
        pricingQuote
          .payment_message ||
        "This reservation cannot be saved until its payment adjustment is resolved."
      );

      setStep(2);

      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      if (
        isEditMode
      ) {
        const room =
          roomTotals[0];

        const editPayload = {
          customer_id:
            existingCustomerId,

          room_id:
            room.room_id,

          stay_type:
            booking.stay_type,

          check_in:
            booking.check_in,

          check_out:
            booking.check_out,

          total_guests:
            room.total_guests,

          booking_status:
            booking.booking_status,

          special_request:
            booking.special_request.trim() ||
            null,
        };

        if (
          refundRequired
        ) {
          editPayload.refund = {
            payment_method:
              refund.payment_method,

            transaction_id:
              refund.payment_method ===
                "cash"
                ? null
                : refund.transaction_id.trim(),

            notes:
              refund.notes.trim(),
          };
        }

        const response =
          await apiClient.put(
            `/bookings/${editBookingId}`,
            editPayload
          );

        const result =
          response.data?.data ||
          {};

        setSuccess({
          stayType:
            result.stay_type ||
            booking.stay_type,

          durationMinutes:
            Number(
              result.duration_minutes ||
              dayUseDurationMinutes ||
              0
            ),
            
          title:
            "Reservation Updated",

          message:
            result.refund
              ? `Reservation updated successfully and ${formatCurrency(
                  result.refund.amount
                )} refund recorded.`
              : "The reservation was updated successfully.",

          edit: true,

          bookingCode:
            `BK-${
              1000 +
              Number(
                editBookingId
              )
            }`,

          guestName:
            guest.guest_name,

          checkIn:
            booking.check_in,

          checkOut:
            booking.check_out,

          nights:
            result.nights ||
            nights,

          grandTotal:
            Number(
              result.total_amount ??
              grandTotal
            ),

          amountReceived:
            Number(
              result.amount_paid ??
              existingAmountPaid
            ),

          balanceDue:
            Number(
              result.outstanding_amount ??
              balanceDue
            ),

          paymentStatus:
            result.payment_status ||
            existingPaymentStatus,

          refund:
            result.refund ||
            null,

          bookings: [
            {
              bookingId:
                editBookingId,

              bookingCode:
                `BK-${
                  1000 +
                  Number(
                    editBookingId
                  )
                }`,

              roomNumber:
                room.room_number,

              roomType:
                room.room_type,
            },
          ],
        });


        return;
      }


      const rooms =
        roomTotals.map(
          (room) => ({
            room_id:
              room.room_id,

            stay_type:
              booking.stay_type,

            check_in:
              booking.check_in,

            check_out:
              booking.check_out,

            total_guests:
              room.total_guests,

            booking_status:
              booking.booking_status,

            special_request:
              booking.special_request.trim() ||
              null,
          })
        );

      if (
        isAddRoomMode
      ) {
        const payload = {
          stay_type:
            booking.stay_type,

          booking_source:
            "walk_in",

          rooms,
        };

        if (
          payment.mode !==
          "none"
        ) {
          payload.initial_payment = {
            mode:
              payment.mode,

            amount:
              payment.mode ===
                "advance"
                ? Number(
                    payment.amount
                  )
                : undefined,

            payment_method:
              payment.payment_method,

            transaction_id:
              payment.payment_method ===
                "cash"
                ? null
                : payment.transaction_id.trim(),

            notes:
              payment.notes.trim() ||
              null,
          };
        }

        const response =
          await apiClient.post(
            `/bookings/groups/${addRoomGroupId}/rooms`,
            payload
          );

        const result =
          response.data?.data ||
          {};

        const paymentResult =
          result.payment ||
          {};

        const firstCreatedBooking =
          Array.isArray(
            result.bookings
          )
            ? result.bookings[0]
            : null;

        setSuccess({
          stayType:
            firstCreatedBooking
              ?.stayType ||
            booking.stay_type,

          durationMinutes:
            Number(
              firstCreatedBooking
                ?.durationMinutes ||
              dayUseDurationMinutes ||
              0
            ),

          title:
            roomTotals.length > 1
              ? "Rooms Added"
              : "Room Added",

          message:
            response.data?.message ||
            "Room added to reservation successfully.",

          edit: false,

          addRoomMode: true,

          reservationGroupId:
            addRoomGroupId,

          groupCode:
            reservationGroup
              ?.group_code,

          guestName:
            guest.guest_name,

          checkIn:
            booking.check_in,

          checkOut:
            booking.check_out,

          nights,

          grandTotal:
            Number(
              paymentResult.grandTotal ??
              grandTotal
            ),

          amountReceived:
            Number(
              paymentResult.amountReceived ??
              0
            ),

          balanceDue:
            Number(
              paymentResult.balanceDue ??
              grandTotal
            ),

          bookings:
            result.bookings ||
            [],
        });

        return;
      }

      const phone =
        matchedCustomer
          ? normalizeStoredPhone(
              matchedCustomer.phone
            )
          : buildPhoneNumber(
              guest.phone
            );


      const payload = {
        stay_type:
          booking.stay_type,

        guest_name:
          guest.guest_name.trim(),

        phone,

        email:
          guest.email.trim() ||
          null,

        gender:
          guest.gender ||
          null,

        nationality:
          guest.nationality.trim() ||
          null,

        address:
          guest.address.trim() ||
          null,

        id_proof_type:
          guest.id_proof_type ||
          null,

        id_proof_number:
          guest.id_proof_number.trim() ||
          null,

        rooms,

        booking_status:
          booking.booking_status,

        special_request:
          booking.special_request.trim() ||
          null,
      };


      if (
        payment.mode !==
        "none"
      ) {
        payload.initial_payment = {
          mode:
            payment.mode,

          amount:
            payment.mode ===
            "advance"
              ? Number(
                  payment.amount
                )
              : undefined,

          payment_method:
            payment.payment_method,

          transaction_id:
            payment.transaction_id.trim() ||
            null,

          notes:
            payment.notes.trim() ||
            null,
        };
      }


      const response =
        await apiClient.post(
          "/bookings",
          payload
        );


      const paymentResult =
        response.data?.payment ||
        {};

      const firstCreatedBooking =
        Array.isArray(
          response.data?.bookings
        )
          ? response.data.bookings[0]
          : null;

      setSuccess({
        stayType:
          firstCreatedBooking
            ?.stayType ||
          booking.stay_type,

        durationMinutes:
          Number(
            firstCreatedBooking
              ?.durationMinutes ||
            dayUseDurationMinutes ||
            0
          ),
          
        title:
          roomTotals.length > 1
            ? "Bookings Created"
            : "Booking Created",

        message:
          response.data?.message ||
          "Booking created successfully.",

        edit: false,

        guestName:
          guest.guest_name.trim(),

        checkIn:
          booking.check_in,

        checkOut:
          booking.check_out,

        nights,

        grandTotal:
          Number(
            paymentResult.grandTotal ??
            grandTotal
          ),

        amountReceived:
          Number(
            paymentResult.amountReceived ??
            0
          ),

        balanceDue:
          Number(
            paymentResult.balanceDue ??
            grandTotal
          ),

        bookings:
          response.data?.bookings ||
          [],
      });
    } catch (
      error
    ) {
      setFormError(
        getApiMessage(
          error,
          "The booking could not be saved."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }


  /* ==========================================================
     RESET
  ========================================================== */

  function resetDesk() {
    setGuest({
      ...EMPTY_GUEST,
    });

    setBooking({
      ...EMPTY_BOOKING,
    });

    setPayment({
      ...EMPTY_PAYMENT,
    });

    setMatchedCustomer(
      null
    );

    setRefund({
      ...EMPTY_REFUND,
    });

    setEditingCustomer(false);

    setSelectedRooms([]);

    setAvailableRooms([]);

    setRoomsError("");

    setFormError("");

    setSuccess(null);

    setStep(1);
  }


  /* ==========================================================
     LOADING / LOAD ERROR
  ========================================================== */

  if (
    loading
  ) {
    return (
      <div className="booking-desk-page">

        <div className="booking-desk-state">
          Loading booking...
        </div>

      </div>
    );
  }


  if (
    loadError
  ) {
    return (
      <div className="booking-desk-page">

        <div className="booking-desk-load-error">

          <h2>
            Reservation Locked
          </h2>

          <p>
            {loadError}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                isAddRoomMode
                  ? `/bookings/groups/${addRoomGroupId}`
                  : "/bookings"
              )
            }
          >
            {isAddRoomMode
              ? "Back to Reservation Group"
              : "Back to Bookings"}
          </button>

        </div>

      </div>
    );
  }


  /* ==========================================================
     SUCCESS
  ========================================================== */

  if (
    success
  ) {
    const paid =
      Number(
        success.amountReceived ||
        0
      );


    const total =
      Number(
        success.grandTotal ||
        0
      );


    const due =
      Number(
        success.balanceDue ||
        0
      );


    const status =
      success.paymentStatus
        ? String(
            success.paymentStatus
          )
            .replaceAll(
              "_",
              " "
            )
        : getPaymentDisplayStatus(
            paid,
            total
          );


    return (
      <div className="booking-desk-page">

        <div className="booking-desk-success">

          <div className="booking-desk-success__icon">
            <IcoCheck />
          </div>


          <h1>
            {success.title}
          </h1>


          <p>
            {success.message}
          </p>


          <div className="booking-desk-review-grid">

            <section className="booking-desk-review-card">

              <h3>
                Stay Summary
              </h3>

              <div>
                <span>
                  Guest
                </span>

                <strong>
                  {success.guestName ||
                    "—"}
                </strong>
              </div>

              {success.addRoomMode && (
                <div>
                  <span>
                    Reservation Group
                  </span>

                  <strong>
                    {success.groupCode ||
                      "—"}
                  </strong>
                </div>
              )}

              <div>
                <span>
                  Stay Type
                </span>

                <strong>
                  {success.stayType ===
                    "day_use"
                    ? "Day Use / Short Stay"
                    : "Overnight Stay"}
                </strong>
              </div>


              <div>
                <span>
                  Check In
                </span>

                <strong>
                  {success.stayType ===
                    "day_use"
                    ? formatStayDateTime(
                        success.checkIn
                      )
                    : formatDate(
                        success.checkIn
                      )}
                </strong>
              </div>


              <div>
                <span>
                  {success.stayType ===
                    "day_use"
                    ? "Check Out"
                    : "Expected Check Out"}
                </span>

                <strong>
                  {success.stayType ===
                    "day_use"
                    ? formatStayDateTime(
                        success.checkOut
                      )
                    : formatDate(
                        success.checkOut
                      )}
                </strong>
              </div>


              <div>
                <span>
                  {success.stayType ===
                    "day_use"
                    ? "Stay Duration"
                    : "Nights"}
                </span>

                <strong>
                  {success.stayType ===
                    "day_use"
                    ? formatStayDuration(
                        success.durationMinutes
                      )
                    : success.nights ||
                      nights}
                </strong>
              </div>

            </section>


            <section className="booking-desk-review-card">

              <h3>
                {success.addRoomMode
                  ? "Added Room Payment Summary"
                  : "Payment Summary"}
              </h3>

              <div>
                <span>
                  {success.addRoomMode
                    ? success.bookings?.length > 1
                      ? "Added Rooms Total"
                      : "Added Room Total"
                    : "Booking Total"}
                </span>

                <strong>
                  {formatCurrency(
                    total
                  )}
                </strong>
              </div>

              {success.refund ? (
                <>
                  <div>
                    <span>
                      Refund Processed
                    </span>

                    <strong>
                      -{formatCurrency(
                        success.refund.amount
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Refund Method
                    </span>

                    <strong className="booking-desk-capitalize">
                      {String(
                        success.refund.payment_method ||
                        ""
                      ).replaceAll(
                        "_",
                        " "
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Net Paid
                    </span>

                    <strong>
                      {formatCurrency(
                        paid
                      )}
                    </strong>
                  </div>
                </>
              ) : (
                <div>
                  <span>
                    Amount Received
                  </span>

                  <strong>
                    {formatCurrency(
                      paid
                    )}
                  </strong>
                </div>
              )}

              <div>
                <span>
                  Balance Due
                </span>

                <strong>
                  {formatCurrency(
                    due
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Payment Status
                </span>

                <strong className="booking-desk-capitalize">
                  {status}
                </strong>
              </div>

            </section>

          </div>


          {Array.isArray(
            success.bookings
          ) &&
            success.bookings.length >
              0 && (
              <div className="booking-desk-success__bookings">

                {success.bookings.map(
                  (
                    created
                  ) => (
                    <div
                      key={
                        created.bookingId
                      }
                    >
                      <strong>
                        {
                          created.bookingCode
                        }
                      </strong>

                      <span>
                        Room{" "}
                        {
                          created.roomNumber
                        }
                      </span>
                    </div>
                  )
                )}

              </div>
            )}


          <div className="booking-desk-success__actions">

            <button
              type="button"
              className="booking-desk-btn booking-desk-btn--secondary"
              onClick={() =>
                navigate(
                  isAddRoomMode
                    ? `/bookings/groups/${addRoomGroupId}`
                    : "/bookings"
                )
              }
            >
              {isAddRoomMode
                ? "Back to Reservation Group"
                : "View Bookings"}
            </button>


            {!isEditMode &&
              !isAddRoomMode && (
              <button
                type="button"
                className="booking-desk-btn booking-desk-btn--primary"
                onClick={
                  resetDesk
                }
              >
                <IcoPlus />

                New Booking
              </button>
            )}

          </div>

        </div>

      </div>
    );
  }


  /* ==========================================================
     MAIN RENDER
  ========================================================== */

  return (
    <div className="booking-desk-page">


      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="booking-desk-header">

        <div>
          <h1>
            {isEditMode
              ? "Edit Reservation"
              : isAddRoomMode
                ? `Add Room to ${reservationGroup?.group_code || "Reservation"}`
                : "Booking Desk"}
          </h1>

          <p>
            {isEditMode
              ? "Update this reservation before the guest checks in."
              : isAddRoomMode
                ? `Add additional room reservations for ${guest.guest_name || "this guest"}.`
                : "Create a hotel reservation using the guided front-desk flow."}
          </p>
        </div>


        <button
          type="button"
          className="booking-desk-back-link"
          onClick={() =>
            navigate(
              isAddRoomMode
                ? `/bookings/groups/${addRoomGroupId}`
                : "/bookings"
            )
          }
        >
          <IcoChevL />

          {isAddRoomMode
            ? "Back to Reservation Group"
            : "Back to Bookings"}
        </button>

      </div>


      {/* ======================================================
          STEPS
      ====================================================== */}

      <div className="booking-desk-steps">

        {STEPS.map(
          (
            item
          ) => (
            <div
              key={
                item.id
              }
              className={
                [
                  "booking-desk-step",

                  item.id ===
                  step
                    ? "booking-desk-step--active"
                    : "",

                  item.id <
                  step
                    ? "booking-desk-step--complete"
                    : "",
                ]
                  .filter(
                    Boolean
                  )
                  .join(" ")
              }
            >

              <span className="booking-desk-step__number">

                {item.id <
                step ? (
                  <IcoCheck />
                ) : (
                  item.id
                )}

              </span>


              <span className="booking-desk-step__label">
                {item.label}
              </span>

            </div>
          )
        )}

      </div>


      {formError && (
        <div
          ref={
            formErrorRef
          }
          className="booking-desk-error"
          role="alert"
        >
          {formError}
        </div>
      )}


      <div className="booking-desk-card">


        {/* ====================================================
            STEP 1
        ==================================================== */}

        {step === 1 && (
          <GuestStep
            guest={
              guest
            }
            matchedCustomer={
              matchedCustomer
            }
            editingCustomer={
              editingCustomer
            }
            savingCustomer={
              savingCustomer
            }
            isEditMode={
              isEditMode
            }
            profileLocked={
              profileLocked
            }
            updateGuest={
              updateGuest
            }
            startCustomerEdit={
              startCustomerEdit
            }
            cancelCustomerEdit={
              cancelCustomerEdit
            }
            saveCustomerDetails={
              saveCustomerDetails
            }
          />
        )}


        {/* ====================================================
            STEP 2
        ==================================================== */}

        {step === 2 && (
          <StayRoomsStep
            stayTypeLocked={
              isAddRoomMode
            }
            booking={
              booking
            }
            isEditMode={
              isEditMode
            }
            today={
              today
            }
            nights={
              nights
            }
            updateBooking={
              updateBooking
            }
            selectedRooms={
              selectedRooms
            }
            availableRooms={
              availableRooms
            }
            roomsLoading={
              roomsLoading
            }
            roomsError={
              roomsError
            }
            isRoomSelected={
              isRoomSelected
            }
            addRoom={
              addRoom
            }
            removeRoom={
              removeRoom
            }
            updateRoomGuests={
              updateRoomGuests
            }
            roomTotals={
              roomTotals
            }
            dayUseEnabled={
              dayUsePolicy
                ?.enabled === true
            }

            dayUsePolicy={
              dayUsePolicy
            }

            policyLoading={
              policyLoading
            }

            policyError={
              policyError
            }

            dayUseDurationMinutes={
              dayUseDurationMinutes
            }

            pricingQuote={
              pricingQuote
            }

            quoteLoading={
              quoteLoading
            }

            quoteError={
              quoteError
            }
          />
        )}

        {/* ====================================================
            STEP 3
        ==================================================== */}

        {step === 3 && (
          <ReservationPaymentStep
            booking={
              booking
            }
            payment={
              payment
            }
            isEditMode={
              isEditMode
            }
            existingPaymentStatus={
              existingPaymentStatus
            }
            updateBooking={
              updateBooking
            }
            updatePayment={
              updatePayment
            }
            selectedRooms={
              selectedRooms
            }
            grandTotal={
              grandTotal
            }
            paymentNow={
              paymentNow
            }
            balanceDue={
              balanceDue
            }
            paymentPreviewStatus={
              paymentPreviewStatus
            }
            refund={
              refund
            }
            updateRefund={
              updateRefund
            }
            pricingQuote={
              pricingQuote
            }
            refundRequired={
              refundRequired
            }
            refundRequiredAmount={
              refundRequiredAmount
            }
          />
        )}


        {/* ====================================================
            STEP 4
        ==================================================== */}

        {step === 4 && (
          <ReviewStep
            guest={
              guest
            }
            matchedCustomer={
              matchedCustomer
            }
            booking={
              booking
            }
            payment={
              payment
            }
            isEditMode={
              isEditMode
            }
            isAddRoomMode={
              isAddRoomMode
            }

            reservationGroup={
              reservationGroup
            }
            existingPaymentStatus={
              existingPaymentStatus
            }
            nights={
              nights
            }
            selectedRooms={
              selectedRooms
            }
            totalGuests={
              totalGuests
            }
            roomTotals={
              roomTotals
            }
            grandTotal={
              grandTotal
            }
            paymentNow={
              paymentNow
            }
            balanceDue={
              balanceDue
            }
            paymentPreviewStatus={
              paymentPreviewStatus
            }
            refund={
              refund
            }
            pricingQuote={
              pricingQuote
            }
            refundRequired={
              refundRequired
            }
            refundRequiredAmount={
              refundRequiredAmount
            }
          />
        )}


        {/* ====================================================
            FOOTER
        ==================================================== */}

        <div className="booking-desk-footer">

          <div>

            {step > 1 && (
              <button
                type="button"
                className="booking-desk-btn booking-desk-btn--secondary"
                disabled={
                  submitting
                }
                onClick={
                  goBack
                }
              >
                <IcoChevL />

                Back
              </button>
            )}

          </div>


          <div className="booking-desk-footer__right">

            <button
              type="button"
              className="booking-desk-btn booking-desk-btn--ghost"
              disabled={
                submitting
              }
              onClick={() =>
                navigate(
                  isAddRoomMode
                    ? `/bookings/groups/${addRoomGroupId}`
                    : "/bookings"
                )
              }
            >
              Cancel
            </button>


            {step < 4 ? (
              <button
                type="button"
                className="booking-desk-btn booking-desk-btn--primary"
                disabled={
                  submitting ||
                  (
                    step === 2 &&
                    (
                      quoteLoading ||
                      pricingSaveBlocked
                    )
                  )
                }
                title={
                  pricingSaveBlocked
                    ? (
                        pricingQuote
                          ?.payment_message ||
                        "Resolve the payment adjustment before continuing."
                      )
                    : undefined
                }
                onClick={
                  goNext
                }
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="booking-desk-btn booking-desk-btn--primary"
                disabled={
                  submitting ||
                  quoteLoading ||
                  pricingSaveBlocked
                }
                onClick={() =>
                  void handleSubmit()
                }
              >
                <IcoCheck />

                {submitting
                  ? "Saving..."
                  : isEditMode
                    ? "Save Changes"
                    : isAddRoomMode
                      ? selectedRooms.length > 1
                        ? "Add Rooms"
                        : "Add Room"
                      : selectedRooms.length > 1
                        ? "Confirm Reservations"
                        : "Confirm Reservation"}
              </button>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}


export default BookingDesk;