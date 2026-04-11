/**
 * GeoTrack Pro - Main Server Entry Point (FINAL STABLE VERSION)
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
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendance');
const locationRoutes = require('./routes/locations');
const geofenceRoutes = require('./routes/geofences');
const dashboardRoutes = require('./routes/dashboard');
const uploadRoutes = require('./routes/upload');
const getEmployeeData = require('./routes/getEmployeeData');
const timelineRoutes = require('./routes/timelineRoutes');
const { getDashboard } = require('./controllers/livedashboardController');

// ─────────────────────────────────────────
// App Init
// ─────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────
// CORS (ALLOW ALL USERS)
// ─────────────────────────────────────────
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
}));

// ─────────────────────────────────────────
// Socket.IO (ALLOW ALL)
// ─────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ─────────────────────────────────────────
// Security
// ─────────────────────────────────────────
app.use(helmet());

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
  max: Number(process.env.RATE_LIMIT_MAX || 100),
}));

app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
}));

// ─────────────────────────────────────────
// Body Parser
// ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────
// Logger
// ─────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim()) }
}));

// ─────────────────────────────────────────
// Attach socket to req
// ─────────────────────────────────────────
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', uploadRoutes);
app.use('/api/employee-data', getEmployeeData);
app.use('/api/timeline', timelineRoutes);

console.log("dashboardRoutes:", typeof dashboardRoutes);
app.use('/api/dashboards', getDashboard);

// ─────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'GeoTrack API is running'
  });
});

// ─────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ─────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  logger.error(err.message);

  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// ─────────────────────────────────────────
// Initialize Socket
// ─────────────────────────────────────────
initializeSocket(io);

// ─────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────
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
