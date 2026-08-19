require('dotenv').config();


/* ─── WORKER ───────────────── */
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient }  = require('redis');

const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const jwt = require('jsonwebtoken');

const connectDB = require('./config/database');
const logger    = require('./config/logger');
const { initializeSocket } = require('./sockets/socketManager');

/* ─── ROUTES ───────────────── */
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
/* ─── APP INIT ───────────────── */
const app    = express();
const server = http.createServer(app);


const paymentController = require("./controllers/paymentController");

app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook
);
/* ─── KEEP ALIVE ───────────────── */
server.keepAliveTimeout = 65000;
server.headersTimeout   = 66000;

app.set('trust proxy', 1);

/* ─── COMPRESSION ───────────────── */
app.use(compression());

/* ─── BODY PARSER ───────────────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ─── CORS ───────────────── */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://sthitix.online',
];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

/* ─── HELMET ───────────────── */
app.use(helmet());

/* ─── LOGGER ───────────────── */
app.use(morgan('dev', {
  stream: { write: msg => logger.info(msg.trim()) }
}));

/* ─── REDIS FIX (IMPORTANT) ───────────────── */
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const pubClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Redis reconnect limit');
      return Math.min(retries * 100, 3000);
    },
    connectTimeout: 5000,
  },
});

const subClient = pubClient.duplicate();

pubClient.on('error', (err) =>
  console.warn(`⚠️ Redis pub error: ${err.message}`)
);

subClient.on('error', (err) =>
  console.warn(`⚠️ Redis sub error: ${err.message}`)
);

/* ─── SOCKET.IO ───────────────── */
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
});

/* 🔥 FIX: connect Redis FIRST, then attach adapter */
const connectRedis = async () => {
  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));

    console.log(`✅ Worker ${process.pid} — Redis adapter ready`);
  } catch (err) {
    console.warn(`⚠️ Redis unavailable — using memory: ${err.message}`);
  }
};

connectRedis();

/* ─── SOCKET AUTH ───────────────── */
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

/* ─── RATE LIMIT ───────────────── */
const makeLimit = (windowMs, max) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  store: pubClient.isReady
    ? new RedisStore({ sendCommand: (...args) => pubClient.sendCommand(args) })
    : undefined,
});

app.use('/api/bulk-location', makeLimit(60000, 120));
app.use('/api/', makeLimit(900000, 500));

/* ─── ATTACH IO ───────────────── */
app.use((req, res, next) => {
  req.io = io;
  next();
});

/* ─── ROUTES ───────────────── */
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
/* ─── HEALTH ───────────────── */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    worker: process.pid,
  });
});

/* ─── SOCKET INIT ───────────────── */
initializeSocket(io);

/* ─── START ───────────────── */
const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT || 5000;

  server.listen(PORT, () => {
    console.log(`🚀 Worker ${process.pid} running on port ${PORT}`);
  });
};

startServer();

/* ─── SHUTDOWN ───────────────── */
process.on('SIGTERM', async () => {
  await pubClient.quit();
  await subClient.quit();
  process.exit(0);
});
