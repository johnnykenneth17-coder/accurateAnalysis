// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { supabase, supabaseAdmin } = require("./config/supabase");

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
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ---------- MIDDLEWARE ----------
// Trust proxy (for rate limiting behind reverse proxies)
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// CORS
 app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

// Body parsing – note: Stripe webhook needs raw body, so we apply express.json conditionally
app.use((req, res, next) => {
  if (req.originalUrl === "/api/payment/webhook") {
    next(); // raw body will be handled by the webhook route
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

// Health check endpoint
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
// Make emitTipUpdate available globally to routes (e.g., after admin updates a tip)
app.set("emitTipUpdate", emitTipUpdate);

// Optional: also store in global object for convenience
global.emitTipUpdate = emitTipUpdate;

// ---------- DATABASE VERIFICATION ----------
async function verifyDatabaseConnection() {
  try {
    // Simple query to test Supabase connection
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
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });

// ---------- GRACEFUL SHUTDOWN ----------
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
