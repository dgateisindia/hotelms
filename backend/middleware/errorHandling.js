// middlewares/errorHandling.js

const errorHandling = (err, req, res, next) => {
  console.error("ERROR:", err);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // ==========================
  // MYSQL DATABASE ERRORS
  // ==========================
  switch (err.code) {
    case "ER_DUP_ENTRY":
      statusCode = 409;
      message = "Record already exists.";
      break;

    case "ER_NO_REFERENCED_ROW_2":
      statusCode = 400;
      message = "Related record not found.";
      break;

    case "ER_ROW_IS_REFERENCED_2":
      statusCode = 400;
      message =
        "Cannot delete this record because it is being used.";
      break;

    case "ER_NO_SUCH_TABLE":
      statusCode = 500;
      message = "Database table not found.";
      break;

    case "ER_BAD_FIELD_ERROR":
      statusCode = 500;
      message = "Invalid database column.";
      break;

    case "ER_ACCESS_DENIED_ERROR":
      statusCode = 500;
      message = "Database authentication failed.";
      break;

    case "ECONNREFUSED":
      statusCode = 500;
      message = "Database connection failed.";
      break;

    default:
      break;
  }

  // ==========================
  // JWT ERRORS
  // ==========================
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Session expired. Please login again.";
  }

  // ==========================
  // MODULE SPECIFIC ERRORS
  // ==========================
  const errorResponses = {
    SIGNIN: {
      400: "Email and password are required.",
      401: "Invalid email or password.",
      403: "Your account is inactive.",
      404: "User account not found.",
      429: "Too many login attempts. Try again later."
    },

    DASHBOARD: {
      401: "Please login to access dashboard.",
      403: "Access denied to dashboard.",
      404: "Dashboard data not found.",
      500: "Failed to load dashboard data."
    },

    BOOKINGS: {
      400: "Booking details are incomplete.",
      404: "Booking record not found.",
      409: "Room already booked.",
      422: "Invalid booking dates selected.",
      500: "Failed to process booking."
    },

    ROOMS: {
      400: "Room details are incomplete.",
      404: "Room not found.",
      409: "Room already exists.",
      422: "Invalid room status.",
      500: "Failed to load room information."
    },

    PAYROLL: {
      400: "Payroll details are incomplete.",
      404: "Payroll record not found.",
      409: "Payroll already generated.",
      422: "Invalid payroll period.",
      500: "Failed to generate payroll."
    },

    BILLING: {
      400: "Billing information is incomplete.",
      402: "Payment required before checkout.",
      404: "Invoice not found.",
      409: "Invoice already generated.",
      500: "Failed to generate invoice."
    },

    STAFF: {
      400: "Staff details are incomplete.",
      404: "Staff member not found.",
      409: "Staff already exists.",
      422: "Invalid staff role selected.",
      500: "Failed to process staff request."
    },

    ATTENDANCE: {
      400: "Attendance details are required.",
      404: "Attendance record not found.",
      409: "Attendance already marked.",
      422: "Invalid attendance status.",
      500: "Failed to record attendance."
    },

    REPORTS: {
      400: "Invalid report parameters.",
      404: "Report data not found.",
      422: "Invalid date range selected.",
      500: "Failed to generate report."
    },

    NOTIFICATIONS: {
      400: "Notification details are incomplete.",
      404: "Notification not found.",
      409: "Duplicate notification detected.",
      422: "Invalid notification type.",
      500: "Failed to send notification."
    },

    SETTINGS: {
      400: "Invalid settings data provided.",
      401: "Please login to update settings.",
      403: "Access denied to modify settings.",
      404: "Settings record not found.",
      500: "Failed to save settings."
    },

    LOGOUT: {
      200: "Logout successful.",
      401: "User session already expired.",
      500: "Failed to logout user."
    }
  };

  // If module is passed in error object
  if (
    err.module &&
    errorResponses[err.module] &&
    errorResponses[err.module][statusCode]
  ) {
    message = errorResponses[err.module][statusCode];
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    module: err.module || "GENERAL",
    message,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandling;