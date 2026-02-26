// Load environment variables FIRST - before anything else!
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Initialize express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// Connect to MongoDB
console.log("🔌 Attempting to connect to MongoDB...");
console.log(
  "🔍 MONGO_URI:",
  process.env.MONGO_URI ? "Loaded ✅" : "MISSING ❌",
);

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env file!");
  console.error("Please create a .env file in the backend directory with:");
  console.error("MONGO_URI=mongodb://localhost:27017/fsktm-zkp");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected:", mongoose.connection.host);
    console.log("📊 Database:", mongoose.connection.name);
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.error("Make sure MongoDB is running: mongod or net start MongoDB");
    process.exit(1);
  });

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const evaluationRoutes = require("./routes/evaluation");
const rubricRoutes = require("./routes/rubric");
const timetableRoutes = require("./routes/timetable");
const feedbackRoutes = require("./routes/feedback");
const attendanceRoutes = require("./routes/attendance");
const qrRoutes = require("./routes/qr");
const analyticsRoutes = require("./routes/analytics"); // ← NEW: Analytics route

// Register routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/evaluations", evaluationRoutes);
app.use("/api/rubrics", rubricRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/analytics", analyticsRoutes); // ← NEW: Register analytics route

// Root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FSKTM ZKP Symposium API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      evaluations: "/api/evaluations",
      rubrics: "/api/rubrics",
      timetables: "/api/timetables",
      feedback: "/api/feedback",
      attendance: "/api/attendance",
      qr: "/api/qr",
      analytics: "/api/analytics", // ← NEW: Added to documentation
    },
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`,
  );
  console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("🛑 Server closed");
    mongoose.connection.close(false, () => {
      console.log("🗄️ MongoDB connection closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("👋 SIGINT received, shutting down gracefully...");
  server.close(() => {
    console.log("🛑 Server closed");
    mongoose.connection.close(false, () => {
      console.log("🗄️ MongoDB connection closed");
      process.exit(0);
    });
  });
});

module.exports = app;
