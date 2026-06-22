const express = require("express");
const cors = require("cors");
require("dotenv").config();

const errorHandling = require("./middleware/errorHandling");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// ── Routes ──
app.use("/api/auth", authRoutes);

// ── 404 handler for unmatched routes ──
app.use((req, res, next) => {
  const error = new Error("Route not found");
  error.statusCode = 404;
  next(error);
});

// ── Centralized error handler — must be registered LAST ──
app.use(errorHandling);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});