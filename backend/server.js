// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { clerkMiddleware } = require("@clerk/express");

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const roomRoutes = require("./routes/roomRoutes");
const customerRoutes = require("./routes/customerRoutes");
const superAdmin = require("./routes/superAdmin");
const billingRoutes = require("./routes/billingRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const staffRoutes = require("./routes/staffRoutes");
const AttendanceRoutes = require("./routes/attendanceRoutes");
const reportRoutes = require("./routes/reportRoutes");
const customerRequestRoutes = require("./routes/customerRequestRoutes");
const CustomerRequestPublicRoutes = require("./routes/CustomerRequestPublicRoutes");

const app = express();

// ── Base middleware needed by everything, public or not ──
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    "http://192.168.1.21:3000",
    "http://localhost:3000"
  ],
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// ── PUBLIC ROUTES — must be registered before clerkMiddleware ──
// A guest scanning the QR code has no Clerk session at all. If this
// route is registered after clerkMiddleware(), every request to it
// gets run through Clerk's session handling first, which can hang or
// misbehave for a fully anonymous, non-HTTPS request. Handling it here
// first means Express resolves and responds before Clerk ever sees it.
app.use("/api/customer-requests", customerRequestRoutes);
app.use("/api/customer-requests", CustomerRequestPublicRoutes);


// ── Everything below this line is treated as authenticated ──
app.use(clerkMiddleware());

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use("/api/rooms", roomRoutes);
app.use('/api/users', userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/superadmin", superAdmin);
app.use("/api/billing", billingRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/attendance", AttendanceRoutes);
app.use("/api/reports", reportRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, statusCode: 404, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));