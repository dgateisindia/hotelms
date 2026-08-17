import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import apiClient from "../../services/apiClient";

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


  /* ==========================================================
     PAYMENT
  ========================================================== */

  const [
    payment,
    setPayment,
  ] = useState(
    EMPTY_PAYMENT
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
    isEditMode
  );


  const [
    loadError,
    setLoadError,
  ] = useState("");


  const [
    formError,
    setFormError,
  ] = useState("");


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
      () =>
        calculateNights(
          booking.check_in,
          booking.check_out
        ),
      [
        booking.check_in,
        booking.check_out,
      ]
    );


  const profileLocked =
    Boolean(
      matchedCustomer
    ) &&
    !editingCustomer;

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


        setBooking({
          check_in:
            data.check_in
              ? String(
                  data.check_in
                ).slice(
                  0,
                  10
                )
              : "",

          check_out:
            data.check_out
              ? String(
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
      isEditMode
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
          nights <= 0
        ) {
          setAvailableRooms([]);

          setRoomsError(
            "Check-out must be later than check-in."
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
        booking.check_in,
        booking.check_out,
        editBookingId,
        isEditMode,
        nights,
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
     TOTALS
  ========================================================== */

  const roomTotals =
    useMemo(
      () =>
        selectedRooms.map(
          (room) => ({
            ...room,

            total_amount:
              Number(
                room.price_per_night ||
                0
              ) *
              nights,
          })
        ),
      [
        selectedRooms,
        nights,
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


  const paymentNow =
    useMemo(
      () => {
        if (
          isEditMode
        ) {
          return existingAmountPaid;
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
      step === 3
    ) {
      error =
        validateReservationPaymentStep({
          booking,
          payment,
          isEditMode,
          grandTotal,
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
      validateGuestStep({
        isEditMode,
        guest,
        matchedCustomer,
      }) ||
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
      });


    if (
      validationError
    ) {
      setFormError(
        validationError
      );

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


        const response =
          await apiClient.put(
            `/bookings/${editBookingId}`,
            {
              customer_id:
                existingCustomerId,

              room_id:
                room.room_id,

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
            }
          );


        const result =
          response.data?.data ||
          {};


        setSuccess({
          title:
            "Reservation Updated",

          message:
            "The reservation was updated successfully.",

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


      const phone =
        matchedCustomer
          ? normalizeStoredPhone(
              matchedCustomer.phone
            )
          : buildPhoneNumber(
              guest.phone
            );


      const payload = {
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


      setSuccess({
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
                "/bookings"
              )
            }
          >
            Back to Bookings
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

              <div>
                <span>
                  Check In
                </span>

                <strong>
                  {formatDate(
                    success.checkIn
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Expected Check Out
                </span>

                <strong>
                  {formatDate(
                    success.checkOut
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Nights
                </span>

                <strong>
                  {success.nights ||
                    nights}
                </strong>
              </div>

            </section>


            <section className="booking-desk-review-card">

              <h3>
                Payment Summary
              </h3>

              <div>
                <span>
                  Booking Total
                </span>

                <strong>
                  {formatCurrency(
                    total
                  )}
                </strong>
              </div>

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
                  "/bookings"
                )
              }
            >
              View Bookings
            </button>


            {!isEditMode && (
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
              : "Booking Desk"}
          </h1>

          <p>
            {isEditMode
              ? "Update this reservation before the guest checks in."
              : "Create a hotel reservation using the guided front-desk flow."}
          </p>
        </div>


        <button
          type="button"
          className="booking-desk-back-link"
          onClick={() =>
            navigate(
              "/bookings"
            )
          }
        >
          <IcoChevL />

          Back to Bookings
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
                  "/bookings"
                )
              }
            >
              Cancel
            </button>


            {step < 4 ? (
              <button
                type="button"
                className="booking-desk-btn booking-desk-btn--primary"
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
                  submitting
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