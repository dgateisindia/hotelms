require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser =
  require("cookie-parser");

const {
  clerkMiddleware,
} = require("@clerk/express");

const {
  requireClerkSession,
  attachDbUser,
  requireRole,
} = require(
  "./middleware/roleMiddleware"
);

/* ============================================================
   ROUTES
============================================================ */

const authRoutes =
  require("./routes/authRoutes");

const userRoutes =
  require("./routes/userRoutes");

const superAdminRoutes =
  require("./routes/superAdmin");

const dashboardRoutes =
  require("./routes/dashboardRoutes");

const bookingRoutes =
  require("./routes/bookingRoutes");

const roomRoutes =
  require("./routes/roomRoutes");

const customerRoutes =
  require("./routes/customerRoutes");

const billingRoutes =
  require("./routes/billingRoutes");

const payrollRoutes =
  require("./routes/payrollRoutes");

const staffRoutes =
  require("./routes/staffRoutes");

const attendanceRoutes =
  require("./routes/attendanceRoutes");

const reportRoutes =
  require("./routes/reportRoutes");

const customerRequestRoutes =
  require(
    "./routes/customerRequestRoutes"
  );

const customerRequestPublicRoutes =
  require(
    "./routes/CustomerRequestPublicRoutes"
  );

const app = express();

/* ============================================================
   BASIC APPLICATION SECURITY
============================================================ */

app.disable("x-powered-by");

app.use(helmet());

/* ============================================================
   CORS CONFIGURATION

   Production:
   FRONTEND_URL=https://your-domain.com

   Optional development:
   FRONTEND_DEV_URL=http://192.168.1.21:3000
============================================================ */

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_DEV_URL,

  process.env.NODE_ENV !==
  "production"
    ? "http://localhost:3000"
    : null,

  process.env.NODE_ENV !==
  "production"
    ? "http://127.0.0.1:3000"
    : null,
]
  .map((origin) =>
    String(origin || "")
      .trim()
      .replace(/\/+$/, "")
  )
  .filter(Boolean);

app.use(
  cors({
    credentials: true,

    origin(origin, callback) {
      /*
       * Requests without an Origin header include:
       * - Postman
       * - server-to-server requests
       * - some mobile clients
       */
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      const normalizedOrigin =
        String(origin)
          .trim()
          .replace(/\/+$/, "");

      if (
        allowedOrigins.includes(
          normalizedOrigin
        )
      ) {
        return callback(
          null,
          true
        );
      }

      const corsError =
        new Error(
          "CORS origin is not allowed."
        );

      corsError.statusCode = 403;

      return callback(
        corsError
      );
    },
  })
);

/* ============================================================
   REQUEST PARSING
============================================================ */

app.use(cookieParser());

app.use(
  express.json({
    limit: "1mb",
  })
);

/* ============================================================
   CLERK AUTHENTICATION INSPECTION

   clerkMiddleware() reads Clerk cookies or Authorization headers.

   Important:
   This middleware only attaches authentication information.
   It does not automatically reject anonymous requests.
============================================================ */

app.use(
  clerkMiddleware()
);

/* ============================================================
   PUBLIC ROUTES
============================================================ */

/*
 * Public QR customer request submission.
 *
 * CustomerRequestPublicRoutes currently contains only:
 *
 * POST /api/customer-requests
 *
 * It must be mounted before the protected Admin request router.
 *
 * A later controller update will securely resolve hotel_id from
 * the Hotel QR public token.
 */
app.use(
  "/api/customer-requests",
  customerRequestPublicRoutes
);

/* ============================================================
   AUTHENTICATION ROUTES
============================================================ */

/*
 * Individual auth routes apply their required Clerk middleware.
 *
 * Examples:
 * POST /api/auth/register-super-admin
 * GET  /api/auth/me
 */
app.use(
  "/api/auth",
  authRoutes
);

/*
 * Temporary compatibility endpoint:
 * GET /api/users/me
 *
 * userRoutes applies its own Clerk session protection.
 */
app.use(
  "/api/users",
  userRoutes
);

/* ============================================================
   SUPER ADMIN ROUTES
============================================================ */

/*
 * superAdminRoutes applies:
 *
 * requireClerkSession
 * attachDbUser()
 * requireRole("super_admin")
 */
app.use(
  "/api/superadmin",
  superAdminRoutes
);

/* ============================================================
   LEGACY DASHBOARD COMPATIBILITY

   dashboardRoutes contains both Super Admin and Admin routes.
   Individual route definitions perform database-user and role
   verification. This mount adds the missing Clerk-session check.
============================================================ */

app.use(
  "/api/dashboard",
  requireClerkSession,
  dashboardRoutes
);

/* ============================================================
   HOTEL ADMIN SECURITY CHAIN

   Current operational controllers are Admin-facing.

   Super Admin selected-hotel access will be added separately
   with explicit hotel ownership verification. Super Admin must
   not be allowed through Admin routes while hotel_id is null.
============================================================ */

const requireHotelAdmin = [
  requireClerkSession,
  attachDbUser(),
  requireRole("admin"),
];

/* ============================================================
   PROTECTED CUSTOMER REQUEST MANAGEMENT
============================================================ */

/*
 * Protected routes include:
 *
 * GET    /api/customer-requests
 * GET    /api/customer-requests/:id
 * PUT    /api/customer-requests/:id
 * PATCH  /api/customer-requests/:id/approve
 * PATCH  /api/customer-requests/:id/decline
 * PATCH  /api/customer-requests/:id/seen
 * DELETE /api/customer-requests/:id
 */
app.use(
  "/api/customer-requests",
  ...requireHotelAdmin,
  customerRequestRoutes
);

/* ============================================================
   PROTECTED HOTEL OPERATIONAL ROUTES

   This blocks:
   - Anonymous users
   - Super Admin accounts without selected-hotel verification
   - Inactive/unlinked Clerk accounts

   Controllers must still be updated to apply hotel_id to every
   SELECT, INSERT, UPDATE and DELETE operation.
============================================================ */

app.use(
  "/api/bookings",
  ...requireHotelAdmin,
  bookingRoutes
);

app.use(
  "/api/rooms",
  ...requireHotelAdmin,
  roomRoutes
);

app.use(
  "/api/customers",
  ...requireHotelAdmin,
  customerRoutes
);

app.use(
  "/api/billing",
  ...requireHotelAdmin,
  billingRoutes
);

app.use(
  "/api/payroll",
  ...requireHotelAdmin,
  payrollRoutes
);

app.use(
  "/api/staff",
  ...requireHotelAdmin,
  staffRoutes
);

app.use(
  "/api/attendance",
  ...requireHotelAdmin,
  attendanceRoutes
);

app.use(
  "/api/reports",
  ...requireHotelAdmin,
  reportRoutes
);

/* ============================================================
   404 HANDLER
============================================================ */

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    statusCode: 404,
    code: "ROUTE_NOT_FOUND",
    message: "Route not found.",
  });
});

/* ============================================================
   CENTRAL ERROR HANDLER
============================================================ */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    void next;

    const statusCode =
      Number.isInteger(
        error?.statusCode
      ) &&
      error.statusCode >= 400 &&
      error.statusCode <= 599
        ? error.statusCode
        : 500;

    const errorCode =
      statusCode === 403 &&
      error?.message ===
        "CORS origin is not allowed."
        ? "CORS_ORIGIN_BLOCKED"
        : "INTERNAL_SERVER_ERROR";

    console.error(
      `[SERVER:${errorCode}] ${
        error?.message ||
        "Unexpected server error"
      }`
    );

    return res
      .status(statusCode)
      .json({
        success: false,
        statusCode,
        code: errorCode,

        message:
          statusCode === 500
            ? "An unexpected server error occurred."
            : error.message,
      });
  }
);

/* ============================================================
   START SERVER
============================================================ */

const configuredPort =
  Number.parseInt(
    process.env.PORT,
    10
  );

const PORT =
  Number.isInteger(
    configuredPort
  ) &&
  configuredPort > 0
    ? configuredPort
    : 5000;

app.listen(PORT, () => {
  console.log(
    `[SERVER] Running on port ${PORT}.`
  );
});