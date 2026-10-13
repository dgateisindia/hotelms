const {
  createClerkClient,
} = require("@clerk/backend");

const db =
  require("../config/db").promisePool;


const clerkClient =
  createClerkClient({
    secretKey:
      process.env.CLERK_SECRET_KEY,
  });


/* ============================================================
   RESPONSE HELPERS
============================================================ */

function sendError(
  res,
  status,
  code,
  message
) {
  return res
    .status(status)
    .json({
      success: false,
      code,
      message,
    });
}


function logAdminError(
  operation,
  error
) {
  console.error(
    `[SUPER_ADMIN_ADMIN:${operation}] ${
      error?.code ||
      error?.errors?.[0]?.code ||
      "UNKNOWN_ERROR"
    }: ${
      error?.message ||
      error?.errors?.[0]?.message ||
      "Unknown error"
    }`
  );
}


/* ============================================================
   DISPLAY ID HELPERS
============================================================ */

function parseHotelDisplayId(
  value
) {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  const match =
    /^HT-(\d+)$/.exec(
      normalized
    );

  if (!match) {
    return null;
  }

  const hotelId =
    Number(match[1]);

  if (
    !Number.isSafeInteger(
      hotelId
    ) ||
    hotelId <= 0
  ) {
    return null;
  }

  return hotelId;
}


function formatHotelDisplayId(
  hotelId
) {
  return `HT-${String(
    hotelId
  ).padStart(4, "0")}`;
}


function formatAdminDisplayId(
  adminId
) {
  return `ADM-${String(
    adminId
  ).padStart(4, "0")}`;
}


/* ============================================================
   INPUT HELPERS
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


function normalizeEmail(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function validateAdminPayload(
  body
) {
  const source =
    body &&
    typeof body === "object"
      ? body
      : {};


  const fullName =
    String(
      source.fullName || ""
    ).trim();


  const email =
    normalizeEmail(
      source.email
    );


  const phone =
    normalizeOptionalString(
      source.phone
    );


  const temporaryPassword =
    String(
      source.temporaryPassword ||
      ""
    );


  if (!fullName) {
    return {
      error:
        "Admin full name is required.",
    };
  }


  if (
    fullName.length > 150
  ) {
    return {
      error:
        "Admin full name must not exceed 150 characters.",
    };
  }


  if (!email) {
    return {
      error:
        "Admin email address is required.",
    };
  }


  if (
    email.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    return {
      error:
        "Enter a valid Admin email address.",
    };
  }


  if (
    phone &&
    phone.length > 30
  ) {
    return {
      error:
        "Phone number must not exceed 30 characters.",
    };
  }


  if (!temporaryPassword) {
    return {
      error:
        "Temporary password is required.",
    };
  }


  if (
    temporaryPassword.length < 8
  ) {
    return {
      error:
        "Temporary password must contain at least 8 characters.",
    };
  }


  return {
    error: "",

    value: {
      fullName,
      email,
      phone,
      temporaryPassword,
    },
  };
}


/* ============================================================
   CLERK ERROR HELPERS
============================================================ */

function getClerkErrorMessage(
  error
) {
  return (
    error?.errors?.[0]
      ?.longMessage ||
    error?.errors?.[0]
      ?.message ||
    error?.message ||
    "The Admin authentication account could not be created."
  );
}


function isClerkConflict(
  error
) {
  const text =
    [
      error?.errors?.[0]
        ?.code,
      error?.errors?.[0]
        ?.message,
      error?.errors?.[0]
        ?.longMessage,
      error?.message,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();


  return (
    text.includes(
      "already exists"
    ) ||
    text.includes(
      "already taken"
    ) ||
    (
      text.includes(
        "identifier"
      ) &&
      text.includes(
        "exist"
      )
    )
  );
}


/* ============================================================
   GET HOTEL ADMINS

   GET
   /api/superadmin/hotels/:hotelDisplayId/admins
============================================================ */

exports.getHotelAdmins =
  async (req, res) => {
    const superadminId =
      Number(
        req.dbUser
          ?.superadminId
      );


    const hotelId =
      parseHotelDisplayId(
        req.params
          .hotelDisplayId
      );


    if (
      !Number.isSafeInteger(
        superadminId
      ) ||
      superadminId <= 0
    ) {
      return sendError(
        res,
        403,
        "SUPER_ADMIN_CONTEXT_MISSING",
        "Your Super Admin account could not be identified. Please sign in again."
      );
    }


    if (!hotelId) {
      return sendError(
        res,
        400,
        "INVALID_HOTEL_ID",
        "The hotel ID is invalid. Use a value such as HT-0001."
      );
    }


    try {
      const [[hotel]] =
        await db.query(
          `
            SELECT
              hotel_id,
              hotel_name,
              status

            FROM hotels

            WHERE hotel_id = ?
              AND superadmin_id = ?

            LIMIT 1
          `,
          [
            hotelId,
            superadminId,
          ]
        );


      if (!hotel) {
        return sendError(
          res,
          404,
          "HOTEL_NOT_FOUND",
          "The requested hotel was not found in your portfolio."
        );
      }


      const [rows] =
        await db.query(
          `
            SELECT
              admin_id,
              full_name,
              email,
              phone,
              profile_image,
              status,
              created_at,
              updated_at

            FROM admins

            WHERE hotel_id = ?
              AND superadmin_id = ?

            ORDER BY
              created_at DESC,
              admin_id DESC
          `,
          [
            hotelId,
            superadminId,
          ]
        );


      const admins =
        rows.map(
          (row) => ({
            adminId:
              Number(
                row.admin_id
              ),

            displayId:
              formatAdminDisplayId(
                row.admin_id
              ),

            fullName:
              row.full_name,

            email:
              row.email,

            phone:
              row.phone,

            profileImage:
              row.profile_image,

            status:
              row.status,

            createdAt:
              row.created_at,

            updatedAt:
              row.updated_at,
          })
        );


      return res
        .status(200)
        .json({
          success: true,

          hotel: {
            displayId:
              formatHotelDisplayId(
                hotel.hotel_id
              ),

            name:
              hotel.hotel_name,

            status:
              hotel.status,
          },

          summary: {
            totalAdmins:
              admins.length,

            activeAdmins:
              admins.filter(
                (admin) =>
                  admin.status ===
                  "active"
              ).length,

            inactiveAdmins:
              admins.filter(
                (admin) =>
                  admin.status ===
                  "inactive"
              ).length,
          },

          admins,
        });
    } catch (error) {
      logAdminError(
        "GET_HOTEL_ADMINS",
        error
      );


      return sendError(
        res,
        500,
        "HOTEL_ADMINS_FETCH_FAILED",
        "Hotel Admin accounts could not be loaded. Please try again."
      );
    }
  };


/* ============================================================
   CREATE HOTEL ADMIN

   POST
   /api/superadmin/hotels/:hotelDisplayId/admins

   Request:
   {
     fullName,
     email,
     phone,
     temporaryPassword
   }

   Important:
   - Password is sent only to Clerk.
   - Password is NEVER inserted into MySQL.
   - hotel_id comes from selected hotel URL.
   - superadmin_id comes from authenticated DB context.
============================================================ */

exports.createHotelAdmin =
  async (req, res) => {
    const superadminId =
      Number(
        req.dbUser
          ?.superadminId
      );


    const hotelId =
      parseHotelDisplayId(
        req.params
          .hotelDisplayId
      );


    if (
      !Number.isSafeInteger(
        superadminId
      ) ||
      superadminId <= 0
    ) {
      return sendError(
        res,
        403,
        "SUPER_ADMIN_CONTEXT_MISSING",
        "Your Super Admin account could not be identified. Please sign in again."
      );
    }


    if (!hotelId) {
      return sendError(
        res,
        400,
        "INVALID_HOTEL_ID",
        "The hotel ID is invalid. Use a value such as HT-0001."
      );
    }


    const validation =
      validateAdminPayload(
        req.body
      );


    if (validation.error) {
      return sendError(
        res,
        400,
        "INVALID_ADMIN_DETAILS",
        validation.error
      );
    }


    const adminDetails =
      validation.value;


    /* ========================================================
       VERIFY HOTEL OWNERSHIP
    ======================================================== */

    try {
      const [[hotel]] =
        await db.query(
          `
            SELECT
              hotel_id,
              hotel_name,
              status

            FROM hotels

            WHERE hotel_id = ?
              AND superadmin_id = ?

            LIMIT 1
          `,
          [
            hotelId,
            superadminId,
          ]
        );


      if (!hotel) {
        return sendError(
          res,
          404,
          "HOTEL_NOT_FOUND",
          "The requested hotel was not found in your portfolio."
        );
      }


      if (
        hotel.status !==
        "active"
      ) {
        return sendError(
          res,
          409,
          "HOTEL_NOT_ACTIVE",
          "Admin accounts can only be added to an active hotel."
        );
      }
    } catch (error) {
      logAdminError(
        "VERIFY_HOTEL_FOR_ADMIN",
        error
      );


      return sendError(
        res,
        500,
        "HOTEL_VERIFICATION_FAILED",
        "The selected hotel could not be verified."
      );
    }


    /* ========================================================
       PREVENT EMAIL COLLISION

       Clerk email addresses are unique within the Clerk
       application, so check both HMS account tables first
       to provide a clear local error.
    ======================================================== */

    try {
      const [
        existingAccounts,
      ] =
        await db.query(
          `
            SELECT email
            FROM superadmins
            WHERE email = ?

            UNION ALL

            SELECT email
            FROM admins
            WHERE email = ?

            LIMIT 1
          `,
          [
            adminDetails.email,
            adminDetails.email,
          ]
        );


      if (
        existingAccounts.length >
        0
      ) {
        return sendError(
          res,
          409,
          "ADMIN_EMAIL_EXISTS",
          "An HMS account already exists with this email address."
        );
      }
    } catch (error) {
      logAdminError(
        "CHECK_ADMIN_EMAIL",
        error
      );


      return sendError(
        res,
        500,
        "ADMIN_EMAIL_CHECK_FAILED",
        "The Admin email address could not be verified."
      );
    }


    /* ========================================================
       CREATE CLERK USER

       Clerk owns:
       - password
       - password policy
       - authentication
       - sessions

       Phone remains HMS profile data only.
    ======================================================== */

    let clerkUser;


    try {
      clerkUser =
        await clerkClient
          .users
          .createUser({
            emailAddress: [
              adminDetails.email,
            ],

            password:
              adminDetails
                .temporaryPassword,
          });
    } catch (error) {
      logAdminError(
        "CREATE_CLERK_ADMIN",
        error
      );


      if (
        isClerkConflict(
          error
        )
      ) {
        return sendError(
          res,
          409,
          "CLERK_EMAIL_EXISTS",
          "This email address is already registered in the authentication system."
        );
      }


      const clerkStatus =
        Number(
          error?.status ||
          error?.statusCode
        );


      return sendError(
        res,
        clerkStatus === 400 ||
        clerkStatus === 422
          ? 400
          : 502,
        "CLERK_ADMIN_CREATE_FAILED",
        getClerkErrorMessage(
          error
        )
      );
    }


    /* ========================================================
       CREATE HMS ADMIN PROFILE

       External Clerk operation has succeeded.

       If MySQL fails from this point onward, the Clerk user
       is deleted so we do not leave an orphan login account.
    ======================================================== */

    let connection = null;
    try {
      connection =
        await db.getConnection();

      await connection
        .beginTransaction();


      /*
       * Re-check hotel ownership inside the DB transaction.
       */
      const [[hotel]] =
        await connection.query(
          `
            SELECT
              hotel_id,
              hotel_name,
              status

            FROM hotels

            WHERE hotel_id = ?
              AND superadmin_id = ?

            LIMIT 1

            FOR UPDATE
          `,
          [
            hotelId,
            superadminId,
          ]
        );


      if (!hotel) {
        const error =
          new Error(
            "HOTEL_NOT_FOUND"
          );

        error.appCode =
          "HOTEL_NOT_FOUND";

        throw error;
      }


      if (
        hotel.status !==
        "active"
      ) {
        const error =
          new Error(
            "HOTEL_NOT_ACTIVE"
          );

        error.appCode =
          "HOTEL_NOT_ACTIVE";

        throw error;
      }


      /*
       * Re-check email after obtaining transaction context.
       */
      const [
        existingAdmins,
      ] =
        await connection.query(
          `
            SELECT admin_id

            FROM admins

            WHERE email = ?

            LIMIT 1

            FOR UPDATE
          `,
          [
            adminDetails.email,
          ]
        );


      if (
        existingAdmins.length >
        0
      ) {
        const error =
          new Error(
            "ADMIN_EMAIL_EXISTS"
          );

        error.appCode =
          "ADMIN_EMAIL_EXISTS";

        throw error;
      }


      const [result] =
        await connection.query(
          `
            INSERT INTO admins (
              clerk_id,
              superadmin_id,
              hotel_id,
              full_name,
              email,
              phone,
              role,
              profile_image,
              status
            )
            VALUES (
              ?, ?, ?, ?, ?, ?,
              'admin', NULL, 'active'
            )
          `,
          [
            clerkUser.id,
            superadminId,
            hotelId,
            adminDetails.fullName,
            adminDetails.email,
            adminDetails.phone,
          ]
        );


      const adminId =
        Number(
          result.insertId
        );


      const [[createdAdmin]] =
        await connection.query(
          `
            SELECT
              admin_id,
              full_name,
              email,
              phone,
              profile_image,
              status,
              created_at,
              updated_at

            FROM admins

            WHERE admin_id = ?
              AND hotel_id = ?
              AND superadmin_id = ?

            LIMIT 1
          `,
          [
            adminId,
            hotelId,
            superadminId,
          ]
        );


      await connection.commit();


      return res
        .status(201)
        .json({
          success: true,

          message:
            "Hotel Admin account created successfully.",

          admin: {
            adminId,

            displayId:
              formatAdminDisplayId(
                adminId
              ),

            fullName:
              createdAdmin.full_name,

            email:
              createdAdmin.email,

            phone:
              createdAdmin.phone,

            profileImage:
              createdAdmin.profile_image,

            status:
              createdAdmin.status,

            createdAt:
              createdAdmin.created_at,

            updatedAt:
              createdAdmin.updated_at,
          },

          hotel: {
            displayId:
              formatHotelDisplayId(
                hotelId
              ),

            name:
              hotel.hotel_name,
          },
        });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (
          rollbackError
        ) {
          logAdminError(
            "ROLLBACK_ADMIN_CREATE",
            rollbackError
          );
        }
      }


      /*
       * COMPENSATING ROLLBACK:
       *
       * Clerk and MySQL cannot share one database transaction.
       * If MySQL creation fails, remove the Clerk user that was
       * just created.
       */
      if (clerkUser?.id) {
        try {
          await clerkClient
            .users
            .deleteUser(
              clerkUser.id
            );
        } catch (
          cleanupError
        ) {
          logAdminError(
            "DELETE_ORPHAN_CLERK_ADMIN",
            cleanupError
          );
        }
      }


      logAdminError(
        "CREATE_HMS_ADMIN",
        error
      );


      if (
        error?.appCode ===
        "HOTEL_NOT_FOUND"
      ) {
        return sendError(
          res,
          404,
          "HOTEL_NOT_FOUND",
          "The requested hotel was not found in your portfolio."
        );
      }


      if (
        error?.appCode ===
        "HOTEL_NOT_ACTIVE"
      ) {
        return sendError(
          res,
          409,
          "HOTEL_NOT_ACTIVE",
          "Admin accounts can only be added to an active hotel."
        );
      }


      if (
        error?.appCode ===
          "ADMIN_EMAIL_EXISTS" ||
        error?.code ===
          "ER_DUP_ENTRY"
      ) {
        return sendError(
          res,
          409,
          "ADMIN_EMAIL_EXISTS",
          "An Admin account already exists with this email address."
        );
      }


      return sendError(
        res,
        500,
        "ADMIN_CREATE_FAILED",
        "The Hotel Admin account could not be created. No incomplete account was intentionally kept."
      );
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };


/* ============================================================
   SUPER ADMIN-SA3B-1 ACCOUNT LIFECYCLE

   PATCH profile:
     /hotels/:hotelDisplayId/admins/:adminDisplayId

   PATCH status:
     /hotels/:hotelDisplayId/admins/:adminDisplayId/status

   Explicitly does NOT change:
   - email
   - Clerk identity
   - password
   - assigned hotel
   - ownership
   - admin role

   Account access remains enforced by attachDbUser().
============================================================ */

function sa3bParseAdminDisplayId(value) {
  const normalized = String(value || "").trim().toUpperCase();
  const match = /^ADM-(\d+)$/.exec(normalized);

  if (!match) return null;

  const id = Number(match[1]);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function sa3bProblem(status, code, message) {
  const error = new Error(message);
  error.sa3bStatus = status;
  error.sa3bCode = code;
  return error;
}

async function sa3bChangeAdmin(req, res, action) {
  const superadminId = Number(req.dbUser?.superadminId);
  const hotelId = parseHotelDisplayId(req.params?.hotelDisplayId);
  const adminId = sa3bParseAdminDisplayId(req.params?.adminDisplayId);

  if (!Number.isSafeInteger(superadminId) || superadminId <= 0) {
    return sendError(
      res, 403, "SUPER_ADMIN_CONTEXT_MISSING",
      "Super Admin account context is missing."
    );
  }

  if (!hotelId || !adminId) {
    return sendError(
      res, 400, "INVALID_RESOURCE_ID",
      "A valid Hotel ID and Admin ID are required."
    );
  }

  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendError(
      res, 400, "INVALID_ADMIN_DETAILS",
      "A valid request object is required."
    );
  }

  const keys = Object.keys(body);

  let fullName = null;
  let phoneProvided = false;
  let phone = null;
  let desiredStatus = null;

  if (action === "profile") {
    if (
      keys.some(key => !["fullName", "phone"].includes(key)) ||
      !Object.prototype.hasOwnProperty.call(body, "fullName") ||
      typeof body.fullName !== "string"
    ) {
      return sendError(
        res, 400, "INVALID_ADMIN_DETAILS",
        "Only fullName and phone can be edited."
      );
    }

    fullName = body.fullName.trim();

    if (!fullName || fullName.length > 150) {
      return sendError(
        res, 400, "INVALID_ADMIN_NAME",
        "Full Name must contain 1 to 150 characters."
      );
    }

    phoneProvided =
      Object.prototype.hasOwnProperty.call(body, "phone");

    if (phoneProvided) {
      if (
        body.phone !== null &&
        typeof body.phone !== "string"
      ) {
        return sendError(
          res, 400, "INVALID_ADMIN_PHONE",
          "Phone must be a string or null."
        );
      }

      phone = normalizeOptionalString(body.phone);

      if (phone && phone.length > 30) {
        return sendError(
          res, 400, "INVALID_ADMIN_PHONE",
          "Phone number must not exceed 30 characters."
        );
      }
    }
  } else if (action === "status") {
    if (
      keys.length !== 1 ||
      keys[0] !== "status" ||
      !["active", "inactive"].includes(body.status)
    ) {
      return sendError(
        res, 400, "INVALID_ADMIN_STATUS",
        "Status must be active or inactive."
      );
    }

    desiredStatus = body.status;
  } else {
    return sendError(
      res, 400, "INVALID_OPERATION",
      "Unsupported account operation."
    );
  }

  let connection = null;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Lock owning hotel first, consistent with Hotel creation flow.
    const [[hotel]] = await connection.query(
      `
        SELECT hotel_id, hotel_name, status
        FROM hotels
        WHERE hotel_id = ?
          AND superadmin_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [hotelId, superadminId]
    );

    if (!hotel) {
      throw sa3bProblem(
        404, "HOTEL_NOT_FOUND",
        "The hotel was not found in your portfolio."
      );
    }

    // Exact hotel AND portfolio ownership match.
    const [[admin]] = await connection.query(
      `
        SELECT
          admin_id,
          full_name,
          email,
          phone,
          profile_image,
          status,
          created_at,
          updated_at
        FROM admins
        WHERE admin_id = ?
          AND hotel_id = ?
          AND superadmin_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [adminId, hotelId, superadminId]
    );

    if (!admin) {
      throw sa3bProblem(
        404, "ADMIN_NOT_FOUND",
        "This Admin does not belong to the selected hotel."
      );
    }

    if (
      action === "status" &&
      desiredStatus === "active" &&
      hotel.status !== "active"
    ) {
      throw sa3bProblem(
        409, "HOTEL_NOT_ACTIVE",
        "An Admin cannot be activated while the hotel is inactive."
      );
    }

    if (action === "profile") {
      await connection.query(
        `
          UPDATE admins
          SET full_name = ?, phone = ?
          WHERE admin_id = ?
            AND hotel_id = ?
            AND superadmin_id = ?
        `,
        [
          fullName,
          phoneProvided ? phone : admin.phone,
          adminId,
          hotelId,
          superadminId,
        ]
      );
    } else if (admin.status !== desiredStatus) {
      await connection.query(
        `
          UPDATE admins
          SET status = ?
          WHERE admin_id = ?
            AND hotel_id = ?
            AND superadmin_id = ?
        `,
        [
          desiredStatus,
          adminId,
          hotelId,
          superadminId,
        ]
      );
    }

    const [[updated]] = await connection.query(
      `
        SELECT
          admin_id,
          full_name,
          email,
          phone,
          profile_image,
          status,
          created_at,
          updated_at
        FROM admins
        WHERE admin_id = ?
          AND hotel_id = ?
          AND superadmin_id = ?
        LIMIT 1
      `,
      [adminId, hotelId, superadminId]
    );

    if (!updated) {
      throw new Error("Updated Admin record could not be read.");
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message:
        action === "profile"
          ? "Hotel Admin profile updated successfully."
          : `Hotel Admin account ${desiredStatus === "active" ? "activated" : "deactivated"} successfully.`,
      admin: {
        adminId: Number(updated.admin_id),
        displayId: formatAdminDisplayId(updated.admin_id),
        fullName: updated.full_name,
        email: updated.email,
        phone: updated.phone,
        profileImage: updated.profile_image,
        status: updated.status,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
      hotel: {
        displayId: formatHotelDisplayId(hotel.hotel_id),
        name: hotel.hotel_name,
        status: hotel.status,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logAdminError("SA3B_ROLLBACK", rollbackError);
      }
    }

    if (error.sa3bStatus) {
      return sendError(
        res, error.sa3bStatus,
        error.sa3bCode, error.message
      );
    }

    logAdminError("SA3B_ACCOUNT_CHANGE", error);

    return sendError(
      res, 500, "ADMIN_CHANGE_FAILED",
      "The Admin account could not be updated."
    );
  } finally {
    if (connection) connection.release();
  }
}

exports.updateHotelAdmin = (req, res) =>
  sa3bChangeAdmin(req, res, "profile");

exports.updateHotelAdminStatus = (req, res) =>
  sa3bChangeAdmin(req, res, "status");
