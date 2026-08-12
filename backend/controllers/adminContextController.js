const db =
  require("../config/db").promisePool;


/* ============================================================
   HELPERS
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


function formatAdminDisplayId(
  adminId
) {
  return `ADM-${String(
    adminId
  ).padStart(4, "0")}`;
}


function formatHotelDisplayId(
  hotelId
) {
  return `HT-${String(
    hotelId
  ).padStart(4, "0")}`;
}


/* ============================================================
   GET ADMIN CONTEXT

   GET /api/admin/context

   Important:
   - Admin ID comes from req.dbUser
   - Hotel ID comes from req.dbUser
   - Client does NOT provide hotel_id
============================================================ */

exports.getAdminContext =
  async (req, res) => {
    const adminId =
      Number(
        req.dbUser
          ?.adminId
      );


    const hotelId =
      Number(
        req.dbUser
          ?.hotelId
      );


    if (
      !Number.isSafeInteger(
        adminId
      ) ||
      adminId <= 0 ||
      !Number.isSafeInteger(
        hotelId
      ) ||
      hotelId <= 0
    ) {
      return sendError(
        res,
        403,
        "ADMIN_CONTEXT_MISSING",
        "Your Hotel Admin account is not linked to a valid hotel."
      );
    }


    try {
      /* ======================================================
         ADMIN + ASSIGNED HOTEL

         Both IDs come from authenticated server context.
      ====================================================== */

      const [[row]] =
        await db.query(
          `
            SELECT
              a.admin_id,
              a.full_name,
              a.email,
              a.phone,
              a.profile_image,
              a.status AS admin_status,

              h.hotel_id,
              h.hotel_name,
              h.hotel_type,
              h.hotel_logo,
              h.status AS hotel_status

            FROM admins a

            INNER JOIN hotels h
              ON h.hotel_id =
                a.hotel_id
             AND h.superadmin_id =
                a.superadmin_id

            WHERE a.admin_id = ?
              AND a.hotel_id = ?

            LIMIT 1
          `,
          [
            adminId,
            hotelId,
          ]
        );


      if (!row) {
        return sendError(
          res,
          404,
          "ADMIN_HOTEL_NOT_FOUND",
          "The Admin account or assigned hotel could not be found."
        );
      }


      if (
        row.admin_status !==
        "active"
      ) {
        return sendError(
          res,
          403,
          "ADMIN_INACTIVE",
          "This Hotel Admin account is inactive."
        );
      }


      if (
        row.hotel_status !==
        "active"
        ) {
        return sendError(
            res,
            403,
            "HOTEL_NOT_ACTIVE",
            "Your assigned hotel is not active."
        );
      }


      /* ======================================================
         PENDING CUSTOMER REQUESTS

         No notifications table.
         Every Admin of this hotel sees the same hotel-level
         pending request count.
      ====================================================== */

      const [[requestSummary]] =
        await db.query(
          `
            SELECT
              COUNT(*) AS pending_requests

            FROM customer_requests

            WHERE hotel_id = ?
              AND status = 'pending'
          `,
          [
            hotelId,
          ]
        );


      const pendingRequests =
        Number(
          requestSummary
            ?.pending_requests ||
          0
        );


      return res
        .status(200)
        .json({
          success: true,

          admin: {
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
              row.admin_status,
          },

          hotel: {
            displayId:
              formatHotelDisplayId(
                row.hotel_id
              ),

            name:
              row.hotel_name,

            type:
              row.hotel_type,

            logo:
              row.hotel_logo,

            status:
              row.hotel_status,
          },

          pendingRequests,
        });
    } catch (error) {
      console.error(
        "[ADMIN_CONTEXT:GET]",
        error?.code ||
          error?.message ||
          error
      );


      return sendError(
        res,
        500,
        "ADMIN_CONTEXT_FETCH_FAILED",
        "The Hotel Admin workspace could not be loaded. Please try again."
      );
    }
  };