/**
 * GeoTrack Pro - Main Server Entry Point (FIXED)
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const logger = require('./config/logger');
const { initializeSocket } = require('./sockets/socketManager');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const attendanceRoutes = require('./routes/attendance');
const locationRoutes = require('./routes/locations');
const geofenceRoutes = require('./routes/geofences');
const dashboardRoutes = require('./routes/dashboard');
const uploadRoutes = require('./routes/upload');
const getEmployeeData = require('./routes/getEmployeeData');

// 🚫 DO NOT IMPORT SEEDER HERE

// App init
const app = express();
const server = http.createServer(app);

// ─── CORS ─────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── Socket.io ───────────────────────────────────────


// ─── Security Middleware ─────────────────────────────
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});
app.use('/api/auth/', authLimiter);

// ─── General Middleware ─────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim()) }
}));

// Attach socket to req
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─── Routes ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', uploadRoutes);
app.use('/api/employee-data', getEmployeeData);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'GeoTrack API is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.message);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// ─── Initialize Socket ──────────────────────────────
initializeSocket(io);

// ─── START SERVER ──────────────────────────────────
const startServer = async () => {
  try {
    await connectDB(); // ✅ MUST

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    logger.error(`❌ Server start failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };