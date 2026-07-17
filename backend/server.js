// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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
// backend/server.js
const cookieParser = require('cookie-parser');
const app = express();

const { clerkMiddleware } = require("@clerk/express");

app.use(clerkMiddleware());
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL, // matches your Vite env on the other side
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

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

app.use((req, res) => {
  res.status(404).json({ success: false, statusCode: 404, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));