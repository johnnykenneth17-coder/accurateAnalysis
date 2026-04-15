// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { supabase } = require("./config/supabase");

// Import routes
const authRoutes = require("./routes/auth");
const tipsRoutes = require("./routes/tips");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");
const paymentRoutes = require("./routes/payment");

// Import socket setup
const setupSockets = require("./sockets");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: true, // Will be handled by Express CORS middleware
    credentials: true,
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        "http://127.0.0.1:5501",
        "http://localhost",
        "https://localhost",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "*",
      ];
      if (
        !origin ||
        allowed.includes(origin) ||
        allowed.some((a) => origin?.startsWith(a))
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  }),
);

// ---------- FLEXIBLE CORS CONFIGURATION ----------
/*const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5501",
  "http://127.0.0.1:5501",
  "http://127.0.0.1:3000",
  "https://localhost",
  process.env.FRONTEND_URL, // Production URL (if set)
].filter(Boolean); // Remove undefined

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      // Allow any origin if FRONTEND_URL is not set (development)
      if (!process.env.FRONTEND_URL && process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      // Check against allowed list
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.some((a) => origin?.startsWith(a))
      ) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  }),
);*/

// ---------- OTHER MIDDLEWARE ----------
app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

// Conditional body parsing – raw body for Stripe webhook
app.use((req, res, next) => {
  if (req.originalUrl === "/api/payment/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// ---------- ROUTES ----------
app.use("/api/auth", authRoutes);
app.use("/api/tips", tipsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ---------- SOCKET.IO SETUP ----------
const { emitTipUpdate } = setupSockets(io);
app.set("emitTipUpdate", emitTipUpdate);
global.emitTipUpdate = emitTipUpdate;

// ---------- DATABASE CONNECTION TEST ----------
async function verifyDatabaseConnection() {
  try {
    const { data, error } = await supabase.from("users").select("id").limit(1);
    if (error) throw error;
    console.log("✅ Supabase connection successful");
  } catch (err) {
    console.error("❌ Supabase connection failed:", err.message);
    process.exit(1);
  }
}

// ---------- START SERVER ----------
const PORT = process.env.PORT || 5000;

verifyDatabaseConnection()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 WebSocket ready for real‑time updates`);
      console.log(`🌐 CORS enabled for origins: ${allowedOrigins.join(", ")}`);
      if (!process.env.FRONTEND_URL) {
        console.log(
          `⚠️  FRONTEND_URL not set – CORS allows all origins (development mode)`,
        );
      }
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, closing server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
