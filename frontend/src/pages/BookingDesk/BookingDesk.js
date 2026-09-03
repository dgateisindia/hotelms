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

const EMPTY_ROOM_GUEST = {
  guest_type: "adult",
  full_name: "",
  phone: "",
  age: "",
  id_proof_type: "",
  id_proof_number: "",
  extra_bed_used: false,
};


function createEmptyRoomGuest() {
  return {
    ...EMPTY_ROOM_GUEST,
  };
}


function normalizeRoomGuest(
  value
) {
  const guest =
    value || {};


  return {
    booking_guest_id:
      guest.booking_guest_id ??
      null,

    guest_type:
      guest.guest_type ===
      "child"
        ? "child"
        : "adult",

    full_name:
      guest.full_name ||
      "",

    phone:
      guest.phone ||
      "",

    age:
      guest.age ===
        null ||
      guest.age ===
        undefined ||
      guest.age ===
        ""
        ? ""
        : Number(
            guest.age
          ),

    id_proof_type:
      guest.id_proof_type ||
      "",

    id_proof_number:
      guest.id_proof_number ||
      "",

    extra_bed_used:
      guest.extra_bed_used ===
      true,
  };
}


function isEmptyRoomGuest(
  guest
) {
  if (!guest) {
    return true;
  }

  return (
    !String(
      guest.full_name ||
      ""
    ).trim() &&
    !String(
      guest.phone ||
      ""
    ).trim() &&
    (
      guest.age === "" ||
      guest.age === null ||
      guest.age === undefined
    ) &&
    !String(
      guest.id_proof_type ||
      ""
    ).trim() &&
    !String(
      guest.id_proof_number ||
      ""
    ).trim() &&
    guest.extra_bed_used !== true
  );
  
}


function getRoomGuestCount(
  room
) {
  if (
    room?.roster_captured ===
    true
  ) {
    return (
      (
        room
          .primary_guest_staying ===
        true
          ? 1
          : 0
      ) +
      (
        Array.isArray(
          room.guests
        )
          ? room.guests.length
          : 0
      )
    );
  }


  const total =
    Number(
      room?.total_guests ||
      0
    );


  return (
    Number.isSafeInteger(
      total
    ) &&
    total >= 1
  )
    ? total
    : 1;
}


function syncRoomGuestCount(
  room
) {
  return {
    ...room,

    total_guests:
      getRoomGuestCount(
        room
      ),
  };
}


function buildRoomOccupancyPayload(
  room
) {
  const totalGuests =
    getRoomGuestCount(
      room
    );


  /*
   * Legacy booking without captured roster:
   * preserve old total_guests behaviour.
   *
   * Never invent historical occupants.
   */
  if (
    room?.roster_captured !==
    true
  ) {
    return {
      total_guests:
        totalGuests,
    };
  }


  return {
    total_guests:
      totalGuests,

    primary_guest_staying:
      room
        .primary_guest_staying ===
      true,

    guests:
      (
        Array.isArray(
          room.guests
        )
          ? room.guests
          : []
      ).map(
        (guest) => ({
          guest_type:
            guest.guest_type ===
            "child"
              ? "child"
              : "adult",

          full_name:
            String(
              guest.full_name ||
              ""
            ).trim(),

          phone:
            String(
              guest.phone ||
              ""
            ).trim() ||
            null,

          age:
            guest.guest_type ===
              "child" &&
            guest.age !==
              "" &&
            guest.age !==
              null &&
            guest.age !==
              undefined
              ? Number(
                  guest.age
                )
              : null,

          id_proof_type:
            String(
              guest.id_proof_type ||
              ""
            ).trim() ||
            null,

          id_proof_number:
            String(
              guest.id_proof_number ||
              ""
            ).trim() ||
            null,

          extra_bed_used:
            guest.extra_bed_used ===
            true,
        })
      ),
  };
}

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

function normalizeBookingDate(
  value
) {
  if (!value) {
    return "";
  }

  const text =
    String(
      value
    ).trim();

  /*
   * Plain/local database date or datetime:
   * date portion already represents the intended hotel date,
   * so do not apply timezone conversion.
   */
  if (
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(
      text
    )
  ) {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})/
        .exec(
          text
        );

    return match
      ? `${match[1]}-${match[2]}-${match[3]}`
      : "";
  }

  /*
   * Timezone-aware API value:
   * convert to browser/hotel-local date before placing it
   * inside <input type="date">.
   */
  const date =
    new Date(
      text
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

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
    )}`
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
    guestRequirementsPolicy,
    setGuestRequirementsPolicy,
  ] = useState(null);


  const [
    groupPrimaryGuestAllocated,
    setGroupPrimaryGuestAllocated,
  ] = useState(false);


  const [
    editPrimaryGuestAllocatedElsewhere,
    setEditPrimaryGuestAllocatedElsewhere,
  ] = useState(false);

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

    CREATE / ADD ROOM:
    - current Day Use policy
    - current Guest & Occupancy policy

    EDIT:
    - policy comes from immutable booking snapshot

    Pricing itself always remains backend-authoritative.
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


        const settings =
          data?.settings ||
          {};


        setDayUsePolicy(
          settings.day_use ||
          {
            enabled: false,
          }
        );


        setGuestRequirementsPolicy(
          settings
            .guest_requirements ||
          null
        );
      } catch (error) {
        if (!active) {
          return;
        }


        setDayUsePolicy({
          enabled: false,
        });

        setGuestRequirementsPolicy(
          null
        );


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

        const primaryGuestAlreadyAllocated =
          openBookings.some(
            (item) =>
              item
                ?.occupancy
                ?.primary_guest_staying ===
              true
          );


        setGroupPrimaryGuestAllocated(
          primaryGuestAlreadyAllocated
        );

        const customer =
          data.customer;

        setReservationGroup({
          reservation_group_id:
            data.reservation_group_id,

          group_code:
            data.group_code,

          primary_guest_already_allocated:
            primaryGuestAlreadyAllocated,
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

        const bookingPolicySnapshot =
          data
            .booking_policy_snapshot ||
          null;


        setDayUsePolicy(
          bookingPolicySnapshot
            ?.day_use ||
          {
            enabled:
              existingStayType ===
              "day_use",
          }
        );


        setGuestRequirementsPolicy(
          bookingPolicySnapshot
            ?.guest_requirements ||
          null
        );


        const occupancy =
          data.occupancy ||
          null;


        const rosterCaptured =
          occupancy
            ?.roster_captured ===
          true;


        const primaryGuestStaying =
          rosterCaptured &&
          occupancy
            ?.primary_guest_staying ===
          true;


        const accompanyingGuests =
          rosterCaptured &&
          Array.isArray(
            occupancy
              ?.accompanying_guests
          )
            ? occupancy
                .accompanying_guests
                .map(
                  normalizeRoomGuest
                )
            : [];

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
                : normalizeBookingDate(
                    data.check_in
                  )
              : "",

          check_out:
            data.check_out
              ? existingStayType ===
                  "day_use"
                ? normalizeBookingDateTime(
                    data.check_out
                  )
                : normalizeBookingDate(
                    data.check_out
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

            max_extra_beds:
              Number(
                data.max_extra_beds ??
                0
              ),

            check_in:
              data.check_in
                ? existingStayType === "day_use"
                  ? normalizeBookingDateTime(
                      data.check_in
                    )
                  : normalizeBookingDate(
                      data.check_in
                    )
                : "",

            check_out:
              data.check_out
                ? existingStayType === "day_use"
                  ? normalizeBookingDateTime(
                      data.check_out
                    )
                  : normalizeBookingDate(
                      data.check_out
                    )
                : "",

            /*
             * Important:
             * preserve historical booked rate.
             */
            price_per_night:
              Number(
                data.booked_rate_per_night ||
                0
              ),

            roster_captured:
              rosterCaptured,

            primary_guest_staying:
              primaryGuestStaying,

            guests:
              accompanyingGuests,

            total_guests:
              rosterCaptured
                ? (
                    (
                      primaryGuestStaying
                        ? 1
                        : 0
                    ) +
                    accompanyingGuests
                      .length
                  )
                : Number(
                    data.total_guests ||
                    1
                  ),

            existing: true,
          },
        ]);

        /*
        * Single-room Edit must know whether the reservation
        * group's Primary Guest belongs to another room.
        */
        setEditPrimaryGuestAllocatedElsewhere(
          false
        );


        const reservationGroupId =
          Number(
            data.reservation_group_id
          );


        if (
          Number.isSafeInteger(
            reservationGroupId
          ) &&
          reservationGroupId > 0
        ) {
          try {
            const groupResponse =
              await apiClient.get(
                `/bookings/groups/${reservationGroupId}`
              );


            if (!active) {
              return;
            }


            const groupBookings =
              Array.isArray(
                groupResponse
                  .data
                  ?.data
                  ?.bookings
              )
                ? groupResponse
                    .data
                    .data
                    .bookings
                : [];


            const primaryElsewhere =
              groupBookings.some(
                (item) =>
                  Number(
                    item.booking_id
                  ) !==
                    Number(
                      editBookingId
                    ) &&
                  item
                    ?.occupancy
                    ?.primary_guest_staying ===
                    true
              );


            setEditPrimaryGuestAllocatedElsewhere(
              primaryElsewhere
            );
          } catch {
            /*
            * Backend still protects Primary uniqueness during
            * quote/save. Failure of this helper lookup must not
            * make the booking itself unreadable.
            */
            setEditPrimaryGuestAllocatedElsewhere(
              false
            );
          }
        }

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
                      room.check_in ||
                      booking.check_in,

                    check_out:
                      room.check_out ||
                      booking.check_out,

                    ...buildRoomOccupancyPayload(
                      room
                    ),

                    booking_status:
                      booking.booking_status,

                    special_request:
                      booking.special_request.trim() ||
                      null,
                  }
                );
            } else {
              const quoteRooms =
                selectedRooms.map(
                  (room) => ({
                    room_id:
                      Number(
                        room.room_id
                      ),

                    check_in:
                      room.check_in ||
                      booking.check_in,

                    check_out:
                      room.check_out ||
                      booking.check_out,

                    ...buildRoomOccupancyPayload(
                      room
                    ),
                  })
                );


              if (
                isAddRoomMode
              ) {
                response =
                  await apiClient.post(
                    `/bookings/groups/${addRoomGroupId}/rooms/quote`,
                    {
                      stay_type:
                        booking.stay_type,

                      booking_status:
                        booking.booking_status,

                      rooms:
                        quoteRooms,
                    }
                  );
              } else {
                const phone =
                  matchedCustomer
                    ? normalizeStoredPhone(
                        matchedCustomer.phone
                      )
                    : buildPhoneNumber(
                        guest.phone
                      );


                response =
                  await apiClient.post(
                    "/bookings/quote",
                    {
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

                      booking_status:
                        booking.booking_status,

                      rooms:
                        quoteRooms,
                    }
                  );
              }
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

    isAddRoomMode,
    addRoomGroupId,
    matchedCustomer,
    guest.phone,
    guest.guest_name,
    guest.email,
    guest.gender,
    guest.nationality,
    guest.address,
    guest.id_proof_type,
    guest.id_proof_number,
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

                room_charge:
                  quoteMatchesRoom
                    ? Number(
                        pricingQuote
                          .room_charge ||
                        0
                      )
                    : null,

                child_charge_amount:
                  quoteMatchesRoom
                    ? Number(
                        pricingQuote
                          .child_charge_amount ||
                        0
                      )
                    : 0,

                extra_bed_charge_amount:
                  quoteMatchesRoom
                    ? Number(
                        pricingQuote
                          .extra_bed_charge_amount ||
                        0
                      )
                    : 0,

                guest_charge_amount:
                  quoteMatchesRoom
                    ? Number(
                        pricingQuote
                          .guest_charge_amount ||
                        0
                      )
                    : 0,

                max_extra_beds:
                  quoteMatchesRoom
                    ? Number(
                        pricingQuote
                          .max_extra_beds ??
                        room.max_extra_beds ??
                        0
                      )
                    : Number(
                        room.max_extra_beds ??
                        0
                      ),

                extra_beds_used:
                  quoteMatchesRoom
                    ? pricingQuote
                        .extra_beds_used ??
                      null
                    : null,

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

              room_charge:
                Number(
                  quote
                    ?.room_charge ||
                  0
                ),

              child_charge_amount:
                Number(
                  quote
                    ?.child_charge_amount ||
                  0
                ),

              extra_bed_charge_amount:
                Number(
                  quote
                    ?.extra_bed_charge_amount ||
                  0
                ),

              guest_charge_amount:
                Number(
                  quote
                    ?.guest_charge_amount ||
                  0
                ),

              max_extra_beds:
                Number(
                  quote
                    ?.max_extra_beds ??
                  room.max_extra_beds ??
                  0
                ),

              extra_beds_used:
                quote
                  ?.extra_beds_used ??
                null,

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
            getRoomGuestCount(
              room
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
      /*
      * Room change during Edit must preserve the
      * existing occupant roster.
      */
      const currentRoom =
        selectedRooms[0] ||
        null;


      setSelectedRooms([
        syncRoomGuestCount({
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

          max_extra_beds:
            Number(
              room.max_extra_beds ??
              0
            ),

          check_in:
            currentRoom?.check_in ||
            booking.check_in,

          check_out:
            currentRoom?.check_out ||
            booking.check_out,

          roster_captured:
            currentRoom
              ?.roster_captured ===
            true,

          primary_guest_staying:
            currentRoom
              ?.primary_guest_staying ===
            true,

          guests:
            Array.isArray(
              currentRoom?.guests
            )
              ? currentRoom.guests
              : [],

          total_guests:
            currentRoom
              ?.total_guests ||
            1,

          existing: true,
        }),
      ]);


      setFormError("");

      return;
    }


    setSelectedRooms(
      (current) => {
        if (
          current.some(
            (selected) =>
              Number(
                selected.room_id
              ) ===
              Number(
                room.room_id
              )
          )
        ) {
          return current;
        }


        return [
          ...current,

          syncRoomGuestCount({
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

            max_extra_beds:
              Number(
                room.max_extra_beds ??
                0
              ),

            check_in:
              booking.check_in,

            check_out:
              booking.check_out,

            /*
              * Room-first reservation:
              * selecting a room does not automatically create
              * or allocate any staying guest.
              *
              * Guests can be added now optionally or later
              * when they actually arrive.
              */
              roster_captured:
                true,

              primary_guest_staying:
                false,

              guests: [],
          }),
        ];
      }
    );


    setFormError("");
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
            Number(
              roomId
            )
        )
    );


    setFormError("");
  }

  function updateRoomTiming(
    roomId,
    field,
    value
  ) {
    if (
      field !== "check_in" &&
      field !== "check_out"
    ) {
      return;
    }

    setSelectedRooms(
      (current) =>
        current.map(
          (room) =>
            Number(room.room_id) ===
            Number(roomId)
              ? {
                  ...room,
                  [field]: value,
                }
              : room
        )
    );

    setFormError("");
  }


  function updateRoomGuests(
    roomId,
    value
  ) {
    const parsed =
      Number(
        value
      );


    const desiredTotal =
    (
      Number.isSafeInteger(
        parsed
      ) &&
      parsed >= 0
    )
      ? parsed
      : 0;


    setSelectedRooms(
      (current) =>
        current.map(
          (room) => {
            if (
              Number(
                room.room_id
              ) !==
              Number(
                roomId
              )
            ) {
              return room;
            }


            if (
              room.roster_captured !==
              true
            ) {
              return {
                ...room,

                total_guests:
                  desiredTotal,
              };
            }


            const primaryCount =
              room
                .primary_guest_staying ===
              true
                ? 1
                : 0;


            const requiredAccompanying =
              Math.max(
                0,
                desiredTotal -
                  primaryCount
              );


            let guests =
              Array.isArray(
                room.guests
              )
                ? [
                    ...room.guests,
                  ]
                : [];


            if (
              guests.length >
              requiredAccompanying
            ) {
              guests =
                guests.slice(
                  0,
                  requiredAccompanying
                );
            }


            while (
              guests.length <
              requiredAccompanying
            ) {
              guests.push(
                createEmptyRoomGuest()
              );
            }


            return syncRoomGuestCount({
              ...room,
              guests,
            });
          }
        )
    );


    setFormError("");
  }


  function updateRoomPrimaryGuest(
    roomId,
    value
  ) {
    const shouldStay =
      value === true;


    /*
    * Existing reservation already owns the Primary Guest
    * in another room.
    */
    if (
      shouldStay &&
      isAddRoomMode &&
      groupPrimaryGuestAllocated
    ) {
      return;
    }


    if (
      shouldStay &&
      isEditMode &&
      editPrimaryGuestAllocatedElsewhere
    ) {
      return;
    }


    setSelectedRooms(
      (current) =>
        current.map(
          (room) => {
            const isTarget =
              Number(
                room.room_id
              ) ===
              Number(
                roomId
              );

            let nextPrimary =
              room
                .primary_guest_staying ===
              true;


            if (
              shouldStay
            ) {
              nextPrimary =
                isTarget;
            } else if (
              isTarget
            ) {
              nextPrimary =
                false;
            }


            let guests =
              Array.isArray(
                room.guests
              )
                ? [
                    ...room.guests,
                  ]
                : [];


            if (
              isTarget &&
              nextPrimary &&
              guests.length === 1 &&
              isEmptyRoomGuest(
                guests[0]
              )
            ) {
              guests = [];
            }


            return syncRoomGuestCount({
              ...room,

              primary_guest_staying:
                nextPrimary,

              guests,
            });
          }
        )
    );


    setFormError("");
  }


  function addAccompanyingGuest(
    roomId
  ) {
    setSelectedRooms(
      (current) =>
        current.map(
          (room) => {
            if (
              Number(
                room.room_id
              ) !==
              Number(
                roomId
              )
            ) {
              return room;
            }


            if (
              getRoomGuestCount(
                room
              ) >=
              Number(
                room.capacity ||
                1
              )
            ) {
              return room;
            }


            return syncRoomGuestCount({
              ...room,

              roster_captured:
                true,

              guests: [
                ...(
                  Array.isArray(
                    room.guests
                  )
                    ? room.guests
                    : []
                ),

                createEmptyRoomGuest(),
              ],
            });
          }
        )
    );


    setFormError("");
  }


  function removeAccompanyingGuest(
    roomId,
    guestIndex
  ) {
    setSelectedRooms(
      (current) =>
        current.map(
          (room) => {
            if (
              Number(
                room.room_id
              ) !==
              Number(
                roomId
              )
            ) {
              return room;
            }


            const guests =
              Array.isArray(
                room.guests
              )
                ? room.guests
                : [];


            return syncRoomGuestCount({
              ...room,

              guests:
                guests.filter(
                  (
                    _guest,
                    index
                  ) =>
                    index !==
                    guestIndex
                ),
            });
          }
        )
    );


    setFormError("");
  }


  function updateAccompanyingGuest(
    roomId,
    guestIndex,
    field,
    value
  ) {
    setSelectedRooms(
      (current) =>
        current.map(
          (room) => {
            if (
              Number(
                room.room_id
              ) !==
              Number(
                roomId
              )
            ) {
              return room;
            }


            const guests =
              Array.isArray(
                room.guests
              )
                ? [
                    ...room.guests,
                  ]
                : [];


            const existing =
              guests[
                guestIndex
              ];


            if (
              !existing
            ) {
              return room;
            }


            guests[
              guestIndex
            ] = {
              ...existing,

              [field]:
                field ===
                "extra_bed_used"
                  ? value ===
                    true
                  : value,
            };


            /*
            * Adult does not need stale child age.
            */
            if (
              field ===
                "guest_type" &&
              value ===
                "adult"
            ) {
              guests[
                guestIndex
              ].age = "";
            }


            return syncRoomGuestCount({
              ...room,
              guests,
            });
          }
        )
    );


    setFormError("");
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
          guestRequirementsPolicy,
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

          guestRequirementsPolicy,

          reservationContact:
            guest,

          isEditMode,
          isAddRoomMode,

          groupPrimaryGuestAllocated,

          editPrimaryGuestAllocatedElsewhere,
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
            guestRequirementsPolicy,
          })
      ) ||
      validateStayRoomsStep({
        booking,
        nights,
        selectedRooms,

        guestRequirementsPolicy,

        reservationContact:
          guest,

        isEditMode,
        isAddRoomMode,

        groupPrimaryGuestAllocated,

        editPrimaryGuestAllocatedElsewhere,
      })||
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
            room.check_in ||
            booking.check_in,

          check_out:
            room.check_out ||
            booking.check_out,

          ...buildRoomOccupancyPayload(
            room
          ),

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
            result.check_in ||
            room.check_in ||
            booking.check_in,

          checkOut:
            result.check_out ||
            room.check_out ||
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

              stayType:
                result.stay_type ||
                booking.stay_type,

              checkIn:
                result.check_in ||
                room.check_in ||
                booking.check_in,

              checkOut:
                result.check_out ||
                room.check_out ||
                booking.check_out,

              nights:
                Number(
                  result.nights ||
                  0
                ),

              durationMinutes:
                Number(
                  result.duration_minutes ||
                  0
                ),

              totalAmount:
                Number(
                  result.total_amount ??
                  grandTotal
                ),
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
              room.check_in ||
              booking.check_in,

            check_out:
              room.check_out ||
              booking.check_out,

            ...buildRoomOccupancyPayload(
              room
            ),

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
            firstCreatedBooking
              ?.checkIn ||
            booking.check_in,

          checkOut:
            firstCreatedBooking
              ?.checkOut ||
            booking.check_out,

          nights:
            Number(
              firstCreatedBooking
                ?.nights ??
              nights
            ),

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
          firstCreatedBooking
            ?.checkIn ||
          booking.check_in,

        checkOut:
          firstCreatedBooking
            ?.checkOut ||
          booking.check_out,

        nights:
          Number(
            firstCreatedBooking
              ?.nights ??
            nights
          ),

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

    const successBookings =
      Array.isArray(
        success.bookings
      )
        ? success.bookings
        : [];


    const hasMultipleSuccessRooms =
      successBookings.length > 1;

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

              <h3>Stay Summary</h3>

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


              {hasMultipleSuccessRooms ? (

                <div>

                  <span>
                    Stay Timing
                  </span>

                  <strong>
                    Room-specific timings shown below
                  </strong>

                </div>

              ) : (
                <>

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

                </>
              )}

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


          {successBookings.length >
            0 && (
              <div className="booking-desk-success__bookings">

                {successBookings.map(
                  (
                    created
                  ) => {
                    const roomStayType =
                      created.stayType ||
                      success.stayType;

                    const roomCheckIn =
                      created.checkIn ||
                      created.check_in ||
                      success.checkIn ||
                      "";

                    const roomCheckOut =
                      created.checkOut ||
                      created.check_out ||
                      success.checkOut ||
                      "";

                    const roomNights =
                      Number(
                        created.nights ??
                        calculateNights(
                          roomCheckIn,
                          roomCheckOut
                        )
                      );

                    const roomDurationMinutes =
                      Number(
                        created.durationMinutes ??
                        created.duration_minutes ??
                        0
                      );

                    const roomTotal =
                      Number(
                        created.totalAmount ??
                        created.total_amount ??
                        0
                      );

                    return (
                      <div
                        key={
                          created.bookingId
                        }
                      >

                        <strong>
                          {created.bookingCode}
                          {" · "}
                          Room{" "}
                          {created.roomNumber}
                        </strong>


                        <span>

                          {created.roomType
                            ? `${created.roomType} · `
                            : ""}

                          {roomStayType ===
                          "day_use"
                            ? (
                                `${formatStayDateTime(
                                  roomCheckIn
                                )} → ${formatStayDateTime(
                                  roomCheckOut
                                )} · ${formatStayDuration(
                                  roomDurationMinutes
                                )}`
                              )
                            : (
                                `${formatDate(
                                  roomCheckIn
                                )} → ${formatDate(
                                  roomCheckOut
                                )} · ${roomNights} night${
                                  roomNights === 1
                                    ? ""
                                    : "s"
                                }`
                              )}

                          {" · "}

                          {formatCurrency(
                            roomTotal
                          )}

                        </span>

                      </div>
                    );
                  }
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
            updateRoomTiming={
              updateRoomTiming
            }
            updateRoomGuests={
              updateRoomGuests
            }
            guestRequirementsPolicy={
              guestRequirementsPolicy
            }

            primaryGuestName={
              guest.guest_name
            }

            isAddRoomMode={
              isAddRoomMode
            }

            groupPrimaryGuestAllocated={
              groupPrimaryGuestAllocated
            }

            editPrimaryGuestAllocatedElsewhere={
              editPrimaryGuestAllocatedElsewhere
            }

            updateRoomPrimaryGuest={
              updateRoomPrimaryGuest
            }

            addAccompanyingGuest={
              addAccompanyingGuest
            }

            removeAccompanyingGuest={
              removeAccompanyingGuest
            }

            updateAccompanyingGuest={
              updateAccompanyingGuest
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