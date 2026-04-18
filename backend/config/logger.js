const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const { combine, timestamp, printf, colorize, errors, json } = format;

/* =========================
   CUSTOM FORMAT
========================= */
const logFormat = printf(({ level, message, timestamp, stack, companyId, userId }) => {
  return `${timestamp} [${level}]${companyId ? ` [company:${companyId}]` : ''}${userId ? ` [user:${userId}]` : ''}: ${stack || message}`;
});

/* =========================
   LOGGER
========================= */
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),

  transports: [
    /* ✅ Console (dev) */
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        logFormat
      ),
    }),

    /* ✅ Daily rotating logs */
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),

    /* ❌ Errors only */
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d',
    }),
  ],
});

/* =========================
   HELPER METHODS (IMPORTANT)
========================= */
logger.infoWithContext = (message, req) => {
  logger.info(message, {
    companyId: req.user?.companyId,
    userId: req.user?._id,
  });
};

logger.errorWithContext = (message, req, error) => {
  logger.error(message, {
    companyId: req.user?.companyId,
    userId: req.user?._id,
    stack: error?.stack,
  });
};

module.exports = logger;