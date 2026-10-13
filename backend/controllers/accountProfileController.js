const db =
  require("../config/db").promisePool;


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


/* ============================================================
   DISPLAY IDS
============================================================ */

function formatAdminDisplayId(
  adminId
) {
  return `ADM-${String(
    adminId
  ).padStart(4, "0")}`;
}


function formatSuperAdminDisplayId(
  superadminId
) {
  return `SA-${String(
    superadminId
  ).padStart(4, "0")}`;
}


/* ============================================================
   INPUT NORMALIZATION
============================================================ */

function normalizeFullName(
  value
) {
  return String(
    value ?? ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function normalizePhone(
  value
) {
  const phone =
    String(
      value ?? ""
    ).trim();


  if (!phone) {
    return {
      value: null,
      error: null,
    };
  }


  if (
    phone.length < 7 ||
    phone.length > 30
  ) {
    return {
      value: null,
      error:
        "Phone number must contain between 7 and 30 characters.",
    };
  }


  if (
    !/^[0-9+()\-\s]+$/.test(
      phone
    )
  ) {
    return {
      value: null,
      error:
        "Phone number contains unsupported characters.",
    };
  }


  return {
    value: phone,
    error: null,
  };
}


/* ============================================================
   READ AUTHENTICATED HMS PROFILE
============================================================ */

async function readAccountProfile(
  dbUser
) {
  const role =
    String(
      dbUser?.role ||
      ""
    ).trim();


  if (
    role ===
    "admin"
  ) {
    const adminId =
      Number(
        dbUser?.adminId
      );


    const hotelId =
      Number(
        dbUser?.hotelId
      );


    const clerkId =
      String(
        dbUser?.clerkId ||
        ""
      ).trim();


    if (
      !Number.isSafeInteger(
        adminId
      ) ||
      adminId <= 0 ||
      !Number.isSafeInteger(
        hotelId
      ) ||
      hotelId <= 0 ||
      !clerkId
    ) {
      return null;
    }


    const [[row]] =
      await db.query(
        `
          SELECT
            admin_id,
            full_name,
            email,
            phone,
            status

          FROM admins

          WHERE admin_id = ?
            AND hotel_id = ?
            AND clerk_id = ?

          LIMIT 1
        `,
        [
          adminId,
          hotelId,
          clerkId,
        ]
      );


    if (!row) {
      return null;
    }


    return {
      role:
        "admin",

      roleLabel:
        "Hotel Admin",

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

      status:
        row.status,
    };
  }


  if (
    role ===
    "super_admin"
  ) {
    const superadminId =
      Number(
        dbUser?.superadminId
      );


    const clerkId =
      String(
        dbUser?.clerkId ||
        ""
      ).trim();


    if (
      !Number.isSafeInteger(
        superadminId
      ) ||
      superadminId <= 0 ||
      !clerkId
    ) {
      return null;
    }


    const [[row]] =
      await db.query(
        `
          SELECT
            superadmin_id,
            full_name,
            email,
            phone,
            status

          FROM superadmins

          WHERE superadmin_id = ?
            AND clerk_id = ?

          LIMIT 1
        `,
        [
          superadminId,
          clerkId,
        ]
      );


    if (!row) {
      return null;
    }


    return {
      role:
        "super_admin",

      roleLabel:
        "Business Owner",

      displayId:
        formatSuperAdminDisplayId(
          row.superadmin_id
        ),

      fullName:
        row.full_name,

      email:
        row.email,

      phone:
        row.phone,

      status:
        row.status,
    };
  }


  return null;
}


/* ============================================================
   GET PROFILE

   GET /api/auth/profile

   Identity comes only from authenticated Clerk + HMS context.
============================================================ */

exports.getAccountProfile =
  async (req, res) => {
    try {
      const profile =
        await readAccountProfile(
          req.dbUser
        );


      if (!profile) {
        return sendError(
          res,
          404,
          "ACCOUNT_PROFILE_NOT_FOUND",
          "Your HMS account profile could not be found."
        );
      }


      return res
        .status(200)
        .json({
          success: true,
          profile,
        });
    }
    catch (error) {
      console.error(
        "[ACCOUNT_PROFILE:GET]",
        error?.code ||
        error?.message ||
        error
      );


      return sendError(
        res,
        500,
        "ACCOUNT_PROFILE_FETCH_FAILED",
        "Your HMS account profile could not be loaded."
      );
    }
  };


/* ============================================================
   UPDATE PROFILE

   PATCH /api/auth/profile

   Editable:
   - fullName
   - phone

   Never editable here:
   - email
   - role
   - account IDs
   - hotel assignment
   - status
============================================================ */

exports.updateAccountProfile =
  async (req, res) => {
    const body =
      req.body &&
      typeof req.body ===
        "object"
        ? req.body
        : {};


    const forbiddenFields =
      [
        "email",
        "role",
        "status",
        "adminId",
        "admin_id",
        "superadminId",
        "superadmin_id",
        "hotelId",
        "hotel_id",
        "clerkId",
        "clerk_id",
      ];


    const forbiddenField =
      forbiddenFields.find(
        (field) =>
          Object.prototype
            .hasOwnProperty
            .call(
              body,
              field
            )
      );


    if (
      forbiddenField
    ) {
      return sendError(
        res,
        400,
        "PROFILE_FIELD_NOT_EDITABLE",
        `${forbiddenField} cannot be changed from Profile & Security.`
      );
    }


    const fullName =
      normalizeFullName(
        body.fullName
      );


    if (
      fullName.length < 2 ||
      fullName.length > 150
    ) {
      return sendError(
        res,
        400,
        "INVALID_FULL_NAME",
        "Full name must contain between 2 and 150 characters."
      );
    }


    const phoneResult =
      normalizePhone(
        body.phone
      );


    if (
      phoneResult.error
    ) {
      return sendError(
        res,
        400,
        "INVALID_PHONE",
        phoneResult.error
      );
    }


    const role =
      String(
        req.dbUser?.role ||
        ""
      ).trim();


    try {
      if (
        role ===
        "admin"
      ) {
        const adminId =
          Number(
            req.dbUser?.adminId
          );


        const hotelId =
          Number(
            req.dbUser?.hotelId
          );


        const clerkId =
          String(
            req.dbUser?.clerkId ||
            ""
          ).trim();


        if (
          !Number.isSafeInteger(
            adminId
          ) ||
          adminId <= 0 ||
          !Number.isSafeInteger(
            hotelId
          ) ||
          hotelId <= 0 ||
          !clerkId
        ) {
          return sendError(
            res,
            403,
            "ADMIN_CONTEXT_MISSING",
            "Your Hotel Admin account context is incomplete."
          );
        }


        const [result] =
          await db.query(
            `
              UPDATE admins

              SET
                full_name = ?,
                phone = ?

              WHERE admin_id = ?
                AND hotel_id = ?
                AND clerk_id = ?
            `,
            [
              fullName,
              phoneResult.value,
              adminId,
              hotelId,
              clerkId,
            ]
          );


        if (
          result.affectedRows !==
          1
        ) {
          return sendError(
            res,
            404,
            "ADMIN_PROFILE_NOT_FOUND",
            "Your Hotel Admin profile could not be found."
          );
        }
      }
      else if (
        role ===
        "super_admin"
      ) {
        const superadminId =
          Number(
            req.dbUser
              ?.superadminId
          );


        const clerkId =
          String(
            req.dbUser?.clerkId ||
            ""
          ).trim();


        if (
          !Number.isSafeInteger(
            superadminId
          ) ||
          superadminId <= 0 ||
          !clerkId
        ) {
          return sendError(
            res,
            403,
            "SUPER_ADMIN_CONTEXT_MISSING",
            "Your Super Admin account context is incomplete."
          );
        }


        const [result] =
          await db.query(
            `
              UPDATE superadmins

              SET
                full_name = ?,
                phone = ?

              WHERE superadmin_id = ?
                AND clerk_id = ?
            `,
            [
              fullName,
              phoneResult.value,
              superadminId,
              clerkId,
            ]
          );


        if (
          result.affectedRows !==
          1
        ) {
          return sendError(
            res,
            404,
            "SUPER_ADMIN_PROFILE_NOT_FOUND",
            "Your Super Admin profile could not be found."
          );
        }
      }
      else {
        return sendError(
          res,
          403,
          "PROFILE_ROLE_NOT_SUPPORTED",
          "This account type cannot update a profile here."
        );
      }


      const profile =
        await readAccountProfile(
          req.dbUser
        );


      if (!profile) {
        return sendError(
          res,
          404,
          "ACCOUNT_PROFILE_NOT_FOUND",
          "The updated HMS account profile could not be loaded."
        );
      }


      return res
        .status(200)
        .json({
          success: true,

          message:
            "Profile updated successfully.",

          profile,
        });
    }
    catch (error) {
      console.error(
        "[ACCOUNT_PROFILE:UPDATE]",
        error?.code ||
        error?.message ||
        error
      );


      return sendError(
        res,
        500,
        "ACCOUNT_PROFILE_UPDATE_FAILED",
        "Your HMS profile could not be updated."
      );
    }
  };