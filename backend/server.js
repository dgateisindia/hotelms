// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
// backend/server.js
const cookieParser = require('cookie-parser');
const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL, // matches your Vite env on the other side
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use(cookieParser()); // add this near your other app.use() calls


app.use((req, res) => {
  res.status(404).json({ success: false, statusCode: 404, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));