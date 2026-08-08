const db =
  require("../config/db").promisePool;

/* ============================================================
   RESPONSE / LOG HELPERS
============================================================ */

function sendError(
  res,
  status,
  code,
  message
) {
  return res.status(status).json({
    success: false,
    code,
    message,
  });
}

function logCustomerError(
  operation,
  error
) {
  console.error(
    `[CUSTOMER:${operation}] ${
      error?.code ||
      "UNKNOWN_ERROR"
    }: ${
      error?.message ||
      "Unknown customer error"
    }`
  );
}

/* ============================================================
   TRUSTED HOTEL CONTEXT
============================================================ */

function getHotelId(req) {
  const hotelId = Number(
    req.dbUser?.hotelId
  );

  if (
    !Number.isSafeInteger(hotelId) ||
    hotelId <= 0
  ) {
    return null;
  }

  return hotelId;
}

function parsePositiveInteger(
  value
) {
  const parsedValue =
    Number(value);

  if (
    Number.isSafeInteger(
      parsedValue
    ) &&
    parsedValue > 0
  ) {
    return parsedValue;
  }

  return null;
}

/* ============================================================
   NORMALIZATION
============================================================ */

function normalizeOptionalString(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalized =
    String(value).trim();

  return normalized || null;
}

function normalizeEmail(value) {
  const email =
    normalizeOptionalString(
      value
    );

  return email
    ? email.toLowerCase()
    : null;
}

function normalizePhone(value) {
  return String(value || "")
    .trim()
    .replace(
      /[\s()\-]/g,
      ""
    );
}

/* ============================================================
   CUSTOMER VALIDATION
============================================================ */

function validateCustomerPayload(
  body
) {
  const source =
    body &&
    typeof body === "object"
      ? body
      : {};

  const fullName =
    String(
      source.full_name || ""
    ).trim();

  if (!fullName) {
    return {
      error:
        "Customer name is required.",
    };
  }

  if (
    fullName.length > 150
  ) {
    return {
      error:
        "Customer name must not exceed 150 characters.",
    };
  }

  const phone =
    normalizePhone(
      source.phone
    );

  if (!phone) {
    return {
      error:
        "Phone number is required.",
    };
  }

  if (
    phone.length > 30 ||
    !/^\+?[0-9]{6,20}$/.test(
      phone
    )
  ) {
    return {
      error:
        "Enter a valid phone number using digits and an optional leading +.",
    };
  }

  const email =
    normalizeEmail(
      source.email
    );

  if (
    email &&
    (
      email.length > 191 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    )
  ) {
    return {
      error:
        "Enter a valid email address.",
    };
  }

  const gender =
    normalizeOptionalString(
      source.gender
    );

  if (
    gender &&
    gender.length > 20
  ) {
    return {
      error:
        "Gender must not exceed 20 characters.",
    };
  }

  const nationality =
    normalizeOptionalString(
      source.nationality
    );

  if (
    nationality &&
    nationality.length > 100
  ) {
    return {
      error:
        "Nationality must not exceed 100 characters.",
    };
  }

  const address =
    normalizeOptionalString(
      source.address
    );

  if (
    address &&
    address.length > 5000
  ) {
    return {
      error:
        "Address must not exceed 5000 characters.",
    };
  }

  const idProofType =
    normalizeOptionalString(
      source.id_proof_type
    );

  if (
    idProofType &&
    idProofType.length > 100
  ) {
    return {
      error:
        "ID proof type must not exceed 100 characters.",
    };
  }

  const idProofNumber =
    normalizeOptionalString(
      source.id_proof_number
    );

  if (
    idProofNumber &&
    idProofNumber.length > 100
  ) {
    return {
      error:
        "ID proof number must not exceed 100 characters.",
    };
  }

  const profileImage =
    normalizeOptionalString(
      source.profile_image
    );

  if (
    profileImage &&
    profileImage.length > 255
  ) {
    return {
      error:
        "Profile image URL must not exceed 255 characters.",
    };
  }

  return {
    error: "",

    value: {
      fullName,
      email,
      phone,
      gender,
      nationality,
      address,
      idProofType,
      idProofNumber,
      profileImage,
    },
  };
}

/* ============================================================
   GET ALL CUSTOMERS
============================================================ */

exports.getCustomers = async (
  req,
  res
) => {
  const hotelId =
    getHotelId(req);

  if (!hotelId) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  try {
    const [customers] =
      await db.query(
        `
          SELECT
            c.customer_id,
            c.full_name,
            c.email,
            c.phone,
            c.gender,
            c.address,
            c.id_proof_type,
            c.id_proof_number,
            c.profile_image,
            c.nationality,
            c.created_at,
            c.updated_at,

            COUNT(
              b.booking_id
            ) AS bookings,

            DATE_FORMAT(
              MAX(
                CASE
                  WHEN b.booking_status <> 'cancelled'
                  THEN b.check_out
                  ELSE NULL
                END
              ),
              '%d %b %Y'
            ) AS lastStay,

            CASE
              WHEN latest.booking_status = 'checked_in'
                THEN 'Checked In'

              WHEN latest.booking_status = 'confirmed'
                AND latest.check_in > NOW()
                THEN 'Upcoming'

              WHEN latest.booking_status = 'confirmed'
                THEN 'Confirmed'

              WHEN latest.booking_status = 'pending'
                THEN 'Pending'

              WHEN latest.booking_status = 'cancelled'
                THEN 'Cancelled'

              WHEN latest.booking_status = 'checked_out'
                THEN 'Checked Out'

              WHEN latest.booking_status IS NULL
                THEN 'No Bookings'

              ELSE 'Unknown'
            END AS status

          FROM customers c

          LEFT JOIN bookings b
            ON b.hotel_id =
               c.hotel_id
           AND b.customer_id =
               c.customer_id

          LEFT JOIN (
            SELECT
              b1.hotel_id,
              b1.customer_id,
              b1.booking_status,
              b1.check_in,
              b1.check_out

            FROM bookings b1

            INNER JOIN (
              SELECT
                hotel_id,
                customer_id,

                MAX(
                  booking_id
                ) AS max_id

              FROM bookings

              GROUP BY
                hotel_id,
                customer_id
            ) latest_ids
              ON latest_ids.hotel_id =
                 b1.hotel_id

             AND latest_ids.customer_id =
                 b1.customer_id

             AND latest_ids.max_id =
                 b1.booking_id
          ) latest
            ON latest.hotel_id =
               c.hotel_id

           AND latest.customer_id =
               c.customer_id

          WHERE c.hotel_id = ?

          GROUP BY
            c.customer_id,
            c.full_name,
            c.email,
            c.phone,
            c.gender,
            c.address,
            c.id_proof_type,
            c.id_proof_number,
            c.profile_image,
            c.nationality,
            c.created_at,
            c.updated_at,
            latest.booking_status,
            latest.check_in,
            latest.check_out

          ORDER BY
            c.customer_id DESC
        `,
        [hotelId]
      );

    return res
      .status(200)
      .json(customers);
  } catch (error) {
    logCustomerError(
      "GET_CUSTOMERS",
      error
    );

    return sendError(
      res,
      500,
      "CUSTOMER_LIST_FETCH_FAILED",
      "Customers could not be loaded. Please try again."
    );
  }
};

/* ============================================================
   ADD CUSTOMER
============================================================ */

exports.addCustomer = async (
  req,
  res
) => {
  const hotelId =
    getHotelId(req);

  if (!hotelId) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  const validation =
    validateCustomerPayload(
      req.body
    );

  if (validation.error) {
    return sendError(
      res,
      400,
      "INVALID_CUSTOMER_DETAILS",
      validation.error
    );
  }

  const customer =
    validation.value;

  try {
    /*
     * Phone is used by our Booking Desk
     * to locate an existing customer.
     *
     * Current final DB has a hotel+phone
     * index but not a UNIQUE constraint,
     * so we enforce hotel-level duplicate
     * prevention here.
     */
    const [phoneMatches] =
      await db.query(
        `
          SELECT customer_id

          FROM customers

          WHERE hotel_id = ?
            AND phone = ?

          LIMIT 1
        `,
        [
          hotelId,
          customer.phone,
        ]
      );

    if (
      phoneMatches.length > 0
    ) {
      return sendError(
        res,
        409,
        "CUSTOMER_PHONE_EXISTS",
        "A customer with this phone number already exists in this hotel."
      );
    }

    /*
     * Final DB already has:
     * UNIQUE(hotel_id, id_proof_number)
     */
    if (
      customer.idProofNumber
    ) {
      const [idMatches] =
        await db.query(
          `
            SELECT customer_id

            FROM customers

            WHERE hotel_id = ?
              AND id_proof_number = ?

            LIMIT 1
          `,
          [
            hotelId,
            customer.idProofNumber,
          ]
        );

      if (
        idMatches.length > 0
      ) {
        return sendError(
          res,
          409,
          "CUSTOMER_ID_PROOF_EXISTS",
          "A customer with this ID proof number already exists in this hotel."
        );
      }
    }

    const [result] =
      await db.query(
        `
          INSERT INTO customers (
            hotel_id,
            full_name,
            email,
            phone,
            gender,
            nationality,
            address,
            id_proof_type,
            id_proof_number,
            profile_image
          )
          VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?
          )
        `,
        [
          hotelId,
          customer.fullName,
          customer.email,
          customer.phone,
          customer.gender,
          customer.nationality,
          customer.address,
          customer.idProofType,
          customer.idProofNumber,
          customer.profileImage,
        ]
      );

    return res
      .status(201)
      .json({
        success: true,

        message:
          "Customer added successfully.",

        customer_id:
          Number(
            result.insertId
          ),
      });
  } catch (error) {
    logCustomerError(
      "ADD_CUSTOMER",
      error
    );

    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "CUSTOMER_DUPLICATE",
        "A customer with the same unique identification already exists in this hotel."
      );
    }

    return sendError(
      res,
      500,
      "CUSTOMER_CREATE_FAILED",
      "The customer could not be created. Please try again."
    );
  }
};

/* ============================================================
   GET CUSTOMER BY ID
============================================================ */

exports.getCustomer = async (
  req,
  res
) => {
  const hotelId =
    getHotelId(req);

  const customerId =
    parsePositiveInteger(
      req.params.id
    );

  if (!hotelId) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  if (!customerId) {
    return sendError(
      res,
      400,
      "INVALID_CUSTOMER_ID",
      "The customer ID is invalid."
    );
  }

  try {
    const [[customer]] =
      await db.query(
        `
          SELECT
            c.customer_id,
            c.full_name,
            c.email,
            c.phone,
            c.gender,
            c.address,
            c.id_proof_type,
            c.id_proof_number,
            c.profile_image,
            c.nationality,
            c.created_at,
            c.updated_at,

            COALESCE(
              summary.totalBookings,
              0
            ) AS totalBookings,

            /*
             * Actual money received.
             * Do not use booking.total_amount
             * as "spent".
             */
            COALESCE(
              payment_summary.totalSpent,
              0
            ) AS totalSpent,

            DATE_FORMAT(
              summary.lastStay,
              '%d %b %Y'
            ) AS lastStay,

            CASE
              WHEN latest.booking_status = 'checked_in'
                THEN 'Checked In'

              WHEN latest.booking_status = 'confirmed'
                AND latest.check_in > NOW()
                THEN 'Upcoming'

              WHEN latest.booking_status = 'confirmed'
                THEN 'Confirmed'

              WHEN latest.booking_status = 'pending'
                THEN 'Pending'

              WHEN latest.booking_status = 'cancelled'
                THEN 'Cancelled'

              WHEN latest.booking_status = 'checked_out'
                THEN 'Checked Out'

              WHEN latest.booking_status IS NULL
                THEN 'No Bookings'

              ELSE 'Unknown'
            END AS currentStatus

          FROM customers c

          LEFT JOIN (
            SELECT
              hotel_id,
              customer_id,

              COUNT(*) AS totalBookings,

              MAX(
                CASE
                  WHEN booking_status <> 'cancelled'
                  THEN check_out
                  ELSE NULL
                END
              ) AS lastStay

            FROM bookings

            GROUP BY
              hotel_id,
              customer_id
          ) summary
            ON summary.hotel_id =
               c.hotel_id

           AND summary.customer_id =
               c.customer_id

          LEFT JOIN (
            SELECT
              b.hotel_id,
              b.customer_id,

              COALESCE(
                SUM(p.amount),
                0
              ) AS totalSpent

            FROM bookings b

            INNER JOIN payments p
              ON p.hotel_id =
                 b.hotel_id

             AND p.booking_id =
                 b.booking_id

             AND p.payment_status =
                 'success'

            GROUP BY
              b.hotel_id,
              b.customer_id
          ) payment_summary
            ON payment_summary.hotel_id =
               c.hotel_id

           AND payment_summary.customer_id =
               c.customer_id

          LEFT JOIN (
            SELECT
              b1.hotel_id,
              b1.customer_id,
              b1.booking_status,
              b1.check_in,
              b1.check_out

            FROM bookings b1

            INNER JOIN (
              SELECT
                hotel_id,
                customer_id,

                MAX(
                  booking_id
                ) AS max_id

              FROM bookings

              GROUP BY
                hotel_id,
                customer_id
            ) latest_ids
              ON latest_ids.hotel_id =
                 b1.hotel_id

             AND latest_ids.customer_id =
                 b1.customer_id

             AND latest_ids.max_id =
                 b1.booking_id
          ) latest
            ON latest.hotel_id =
               c.hotel_id

           AND latest.customer_id =
               c.customer_id

          WHERE c.hotel_id = ?
            AND c.customer_id = ?

          LIMIT 1
        `,
        [
          hotelId,
          customerId,
        ]
      );

    if (!customer) {
      return sendError(
        res,
        404,
        "CUSTOMER_NOT_FOUND",
        "The customer was not found in your hotel."
      );
    }

    return res
      .status(200)
      .json({
        success: true,
        data: customer,
      });
  } catch (error) {
    logCustomerError(
      "GET_CUSTOMER",
      error
    );

    return sendError(
      res,
      500,
      "CUSTOMER_FETCH_FAILED",
      "Customer details could not be loaded. Please try again."
    );
  }
};

/* ============================================================
   UPDATE CUSTOMER
============================================================ */

exports.updateCustomer = async (
  req,
  res
) => {
  const hotelId =
    getHotelId(req);

  const customerId =
    parsePositiveInteger(
      req.params.id
    );

  if (!hotelId) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  if (!customerId) {
    return sendError(
      res,
      400,
      "INVALID_CUSTOMER_ID",
      "The customer ID is invalid."
    );
  }

  const validation =
    validateCustomerPayload(
      req.body
    );

  if (validation.error) {
    return sendError(
      res,
      400,
      "INVALID_CUSTOMER_DETAILS",
      validation.error
    );
  }

  const customer =
    validation.value;

  try {
    const [[existing]] =
      await db.query(
        `
          SELECT customer_id

          FROM customers

          WHERE hotel_id = ?
            AND customer_id = ?

          LIMIT 1
        `,
        [
          hotelId,
          customerId,
        ]
      );

    if (!existing) {
      return sendError(
        res,
        404,
        "CUSTOMER_NOT_FOUND",
        "The customer was not found in your hotel."
      );
    }

    const [phoneMatches] =
      await db.query(
        `
          SELECT customer_id

          FROM customers

          WHERE hotel_id = ?
            AND phone = ?
            AND customer_id <> ?

          LIMIT 1
        `,
        [
          hotelId,
          customer.phone,
          customerId,
        ]
      );

    if (
      phoneMatches.length > 0
    ) {
      return sendError(
        res,
        409,
        "CUSTOMER_PHONE_EXISTS",
        "Another customer with this phone number already exists in this hotel."
      );
    }

    if (
      customer.idProofNumber
    ) {
      const [idMatches] =
        await db.query(
          `
            SELECT customer_id

            FROM customers

            WHERE hotel_id = ?
              AND id_proof_number = ?
              AND customer_id <> ?

            LIMIT 1
          `,
          [
            hotelId,
            customer.idProofNumber,
            customerId,
          ]
        );

      if (
        idMatches.length > 0
      ) {
        return sendError(
          res,
          409,
          "CUSTOMER_ID_PROOF_EXISTS",
          "Another customer with this ID proof number already exists in this hotel."
        );
      }
    }

    const [result] =
      await db.query(
        `
          UPDATE customers

          SET
            full_name = ?,
            email = ?,
            phone = ?,
            gender = ?,
            nationality = ?,
            address = ?,
            id_proof_type = ?,
            id_proof_number = ?,
            profile_image = ?

          WHERE hotel_id = ?
            AND customer_id = ?
        `,
        [
          customer.fullName,
          customer.email,
          customer.phone,
          customer.gender,
          customer.nationality,
          customer.address,
          customer.idProofType,
          customer.idProofNumber,
          customer.profileImage,
          hotelId,
          customerId,
        ]
      );

    if (
      result.affectedRows === 0
    ) {
      return sendError(
        res,
        404,
        "CUSTOMER_NOT_FOUND",
        "The customer was not found in your hotel."
      );
    }

    return res
      .status(200)
      .json({
        success: true,

        message:
          "Customer updated successfully.",
      });
  } catch (error) {
    logCustomerError(
      "UPDATE_CUSTOMER",
      error
    );

    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "CUSTOMER_DUPLICATE",
        "Another customer with the same unique identification already exists in this hotel."
      );
    }

    return sendError(
      res,
      500,
      "CUSTOMER_UPDATE_FAILED",
      "The customer could not be updated. Please try again."
    );
  }
};

/* ============================================================
   DELETE CUSTOMER
============================================================ */

exports.deleteCustomer = async (
  req,
  res
) => {
  const hotelId =
    getHotelId(req);

  const customerId =
    parsePositiveInteger(
      req.params.id
    );

  if (!hotelId) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  if (!customerId) {
    return sendError(
      res,
      400,
      "INVALID_CUSTOMER_ID",
      "The customer ID is invalid."
    );
  }

  try {
    const [result] =
      await db.query(
        `
          DELETE FROM customers

          WHERE hotel_id = ?
            AND customer_id = ?
        `,
        [
          hotelId,
          customerId,
        ]
      );

    if (
      result.affectedRows === 0
    ) {
      return sendError(
        res,
        404,
        "CUSTOMER_NOT_FOUND",
        "The customer was not found in your hotel."
      );
    }

    return res
      .status(200)
      .json({
        success: true,

        message:
          "Customer deleted successfully.",
      });
  } catch (error) {
    logCustomerError(
      "DELETE_CUSTOMER",
      error
    );

    if (
      error?.code ===
        "ER_ROW_IS_REFERENCED_2" ||
      error?.code ===
        "ER_ROW_IS_REFERENCED"
    ) {
      return sendError(
        res,
        409,
        "CUSTOMER_HAS_HISTORY",
        "This customer cannot be deleted because booking history is linked to the profile."
      );
    }

    return sendError(
      res,
      500,
      "CUSTOMER_DELETE_FAILED",
      "The customer could not be deleted. Please try again."
    );
  }
};

/* ============================================================
   CUSTOMER DASHBOARD STATISTICS
============================================================ */

exports.getCustomerStats =
  async (req, res) => {
    const hotelId =
      getHotelId(req);

    if (!hotelId) {
      return sendError(
        res,
        403,
        "HOTEL_CONTEXT_MISSING",
        "Your Admin account is not linked to a valid hotel."
      );
    }

    try {
      const [[stats]] =
        await db.query(
          `
            SELECT

              (
                SELECT COUNT(*)

                FROM customers

                WHERE hotel_id = ?
              ) AS totalCustomers,

              (
                SELECT COUNT(
                  DISTINCT customer_id
                )

                FROM bookings

                WHERE hotel_id = ?
                  AND booking_status =
                      'checked_in'
              ) AS activeGuests,

              (
                SELECT COUNT(*)

                FROM (
                  SELECT customer_id

                  FROM bookings

                  WHERE hotel_id = ?
                    AND booking_status <>
                        'cancelled'

                  GROUP BY customer_id

                  HAVING COUNT(*) > 1
                ) repeat_guest_rows
              ) AS repeatGuests,

              (
                SELECT COUNT(
                  DISTINCT customer_id
                )

                FROM bookings

                WHERE hotel_id = ?
                  AND booking_status =
                      'confirmed'
                  AND check_in > NOW()
              ) AS upcomingGuests
          `,
          [
            hotelId,
            hotelId,
            hotelId,
            hotelId,
          ]
        );

      return res
        .status(200)
        .json({
          success: true,

          data: {
            totalCustomers:
              Number(
                stats
                  ?.totalCustomers ||
                  0
              ),

            activeGuests:
              Number(
                stats
                  ?.activeGuests ||
                  0
              ),

            repeatGuests:
              Number(
                stats
                  ?.repeatGuests ||
                  0
              ),

            upcomingGuests:
              Number(
                stats
                  ?.upcomingGuests ||
                  0
              ),
          },
        });
    } catch (error) {
      logCustomerError(
        "GET_CUSTOMER_STATS",
        error
      );

      return sendError(
        res,
        500,
        "CUSTOMER_STATS_FETCH_FAILED",
        "Customer statistics could not be loaded. Please try again."
      );
    }
  };