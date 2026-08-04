require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { clerkMiddleware } = require("@clerk/express");

const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const roomRoutes = require("./routes/roomRoutes");
const customerRoutes = require("./routes/customerRoutes");
const superAdminRoutes = require("./routes/superAdmin");
const billingRoutes = require("./routes/billingRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const staffRoutes = require("./routes/staffRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const reportRoutes = require("./routes/reportRoutes");
const customerRequestRoutes = require("./routes/customerRequestRoutes");
const customerRequestPublicRoutes = require(
  "./routes/CustomerRequestPublicRoutes"
);

const app = express();

/*
 * Clerk must inspect every request before protected routes use getAuth().
 *
 * This middleware verifies Clerk cookies or Authorization headers and
 * attaches the authentication state to the request.
 *
 * It does not automatically block anonymous public routes.
 */
app.use(clerkMiddleware());

app.use(helmet());

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://192.168.1.21:3000",
      "http://localhost:3000",
    ].filter(Boolean),
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

/*
 * Public customer QR routes.
 *
 * These routes remain public because they do not use
 * requireClerkSession().
 */
app.use("/api/customer-requests", customerRequestRoutes);
app.use("/api/customer-requests", customerRequestPublicRoutes);

/*
 * Application routes.
 *
 * Authentication and role authorization will be applied inside
 * the individual route files.
 */
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/reports", reportRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    statusCode: 404,
    message: "Route not found.",
  });
});

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});