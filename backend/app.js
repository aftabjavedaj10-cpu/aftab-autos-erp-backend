require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./config/db");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const customerRoutes = require("./routes/customers");
const vendorRoutes = require("./routes/vendors");
const categoryRoutes = require("./routes/categories");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/categories", categoryRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "Aftab Autos ERP Backend is running!" });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Basic diagnostics for deploy logs
  try {
    const rawDb = process.env.DATABASE_URL || "";
    const atIndex = rawDb.indexOf("@");
    const hostPort = atIndex !== -1 ? rawDb.slice(atIndex + 1) : rawDb;
    const host = hostPort.split(":")[0] || hostPort;
    console.log(`DATABASE host (masked): ${host}`);
  } catch (e) {
    console.log("DATABASE host: <unavailable>");
  }
});

// Graceful shutdown and better error visibility in deploy logs
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION - shutting down', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION - shutting down', reason);
  // attempt graceful shutdown
  server.close(() => {
    if (db && typeof db.end === 'function') db.end().catch(() => {});
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received - closing server');
  server.close(() => {
    console.log('HTTP server closed');
    if (db && typeof db.end === 'function') {
      db.end().then(() => console.log('DB pool closed')).catch(() => {});
    }
  });
});

module.exports = app;
