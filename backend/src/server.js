require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
app.set("trust proxy", 1);

const expertiseRoutes = require("./routes/expertiseRoutes");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const sessionBatchRoutes = require("./routes/sessionBatch");
const { getEmailConfigStatus } = require("./utils/mailer");

const isLoopbackOrigin = (origin) => {
  if (!origin) return false;

  try {
    const { protocol, hostname } = new URL(origin);

    if (!["http:", "https:"].includes(protocol)) {
      return false;
    }

    return ["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return false;
  }
};

const getAllowedOrigins = () => {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.FRONTEND_URLS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ].filter(Boolean);

  return [
    "https://fsktm-zkp-system.vercel.app",
    "http://localhost:5173",
    ...configuredOrigins,
  ];
};

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(
  express.json({
    limit: "4mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "4mb",
  }),
);

app.use(
  mongoSanitize({
    replaceWith: "_",
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        isLoopbackOrigin(origin) ||
        getAllowedOrigins().includes(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);

console.log(
  "Attempting to connect to MongoDB...",
  process.env.MONGO_URI ? "MONGO_URI loaded" : "MONGO_URI missing",
);

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is not defined in .env file.");
  console.error("Please create a .env file in the backend directory with:");
  console.error("MONGO_URI=mongodb://localhost:27017/fsktm-zkp");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected:", mongoose.connection.host);
    console.log("Database:", mongoose.connection.name);
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    console.error("Make sure MongoDB is running: mongod or net start MongoDB");
    process.exit(1);
  });

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const evaluationRoutes = require("./routes/evaluation");
const rubricRoutes = require("./routes/rubric");
const timetableRoutes = require("./routes/timetable");
const feedbackRoutes = require("./routes/feedback");
const attendanceRoutes = require("./routes/attendance");
const qrRoutes = require("./routes/qr");
const analyticsRoutes = require("./routes/analytics");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/evaluations", evaluationRoutes);
app.use("/api/rubrics", rubricRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/session-batches", sessionBatchRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api", expertiseRoutes);

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
      analytics: "/api/analytics",
    },
  });
});

app.get("/api/health", (req, res) => {
  const emailConfig = getEmailConfigStatus();

  res.json({
    success: true,
    status: "healthy",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    email: {
      configured: emailConfig.ready,
      missing: emailConfig.missing,
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      userConfigured: emailConfig.userConfigured,
    },
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`,
  );
  console.log(`API documentation: http://localhost:${PORT}/api`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
});

module.exports = app;
