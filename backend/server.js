/**
 * GeoTrack Pro - Main Server Entry Point (FINAL FIXED VERSION 🚀)
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/database');
const logger = require('./config/logger');
const { initializeSocket } = require('./sockets/socketManager');

/* ================= ROUTES ================= */
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/userRoutes');
const userRoutesV2 = require('./routes/users');

const attendanceRoutes = require('./routes/attendance');
const locationRoutes = require('./routes/locations');
const geofenceRoutes = require('./routes/geofences');

const dashboardRoutes = require('./routes/dashboard');
const liveDashboardRoutes = require('./routes/dashboardRoutes');

const uploadRoutes = require('./routes/upload');
const employeeDataRoutes = require('./routes/getEmployeeData');

const timelineRoutes = require('./routes/timelineRoutes');
const salaryRoutes = require('./routes/salaryRoutes');

const superAdminRoutes = require('./routes/superAdminRoutes');
const Fieldlocation = require('./routes/fieldRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const bulkLocationRoutes = require('./routes/bulkLocationRoutes');
const billingRoutes = require("./routes/billingRoutes");

/* ================= APP INIT ================= */
const app = express();
app.set("trust proxy", 1);

const server = http.createServer(app);

/* =========================================================
   🔥🔥🔥 CRITICAL FIX: WEBHOOK MUST COME FIRST (RAW BODY)
========================================================= */
const paymentController = require("./controllers/paymentController");

app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook
);

/* ================= BASIC MIDDLEWARE ================= */
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

/* ================= CORS ================= */
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://sthitix.online",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
}));

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://sthitix.online",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"],
  pingInterval: 25000,
  pingTimeout: 60000,
});

/* 🔐 SOCKET AUTH */
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

/* ================= SECURITY ================= */
app.use(helmet());

/* ================= RATE LIMIT ================= */
const locationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
});

app.post('/api/locations/update', locationLimiter);
app.get('/api/locations/live', locationLimiter);

app.use('/api/', rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
  max: Number(process.env.RATE_LIMIT_MAX || 100),
}));

app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
}));

/* =========================================================
   ✅ NORMAL BODY PARSER (AFTER WEBHOOK)
========================================================= */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ================= LOGGER ================= */
app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim()) }
}));

/* ================= SOCKET ATTACH ================= */
app.use((req, res, next) => {
  req.io = io;
  next();
});

/* ================= ROUTES ================= */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/v2/users', userRoutesV2);

app.use('/api/attendance', attendanceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/geofences', geofenceRoutes);

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dashboards', liveDashboardRoutes);
app.use("/api/billing", billingRoutes);
app.use('/api', uploadRoutes);
app.use('/api/employee-data', employeeDataRoutes);

app.use('/api/timeline', timelineRoutes);
app.use('/api/salary', salaryRoutes);

app.use('/api/super-admin', superAdminRoutes);
app.use("/api/bulk-location", bulkLocationRoutes);
app.use("/api/field-locations", Fieldlocation);
app.use("/api/payment", paymentRoutes);

/* ================= HEALTH ================= */
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API running 🚀' });
});

/* ================= 404 ================= */
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error(err);
  logger.error(err.message);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

/* ================= SOCKET INIT ================= */
initializeSocket(io);

/* ================= START ================= */
const startServer = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || '0.0.0.0';

    server.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running at http://${HOST}:${PORT}`);
    });

  } catch (error) {
    logger.error(`❌ Server start failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };
