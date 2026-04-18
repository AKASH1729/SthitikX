/**
 * Socket.io Manager (PRODUCTION READY 🔥)
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../config/logger");

const connectedUsers = new Map();

const initializeSocket = (io) => {

  /* ================= GLOBAL SETTINGS ================= */
  io.engine.pingTimeout = 60000;   // 60s
  io.engine.pingInterval = 25000;  // 25s

  /* ================= AUTH ================= */
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error("AUTH_REQUIRED"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // ✅ SUPER ADMIN SUPPORT
      let query = {
        _id: decoded.id,
        isActive: true,
      };

      if (decoded.role !== "super_admin") {
        query.companyId = decoded.companyId;
      }

      const user = await User.findOne(query).select(
        "name email role companyId"
      );

      if (!user) {
        return next(new Error("USER_INVALID"));
      }

      socket.user = user;
      next();

    } catch (error) {
      logger.error("Socket Auth Error:", error.message);
      return next(new Error("AUTH_FAILED"));
    }
  });

  /* ================= CONNECTION ================= */
  io.on("connection", (socket) => {
    const user = socket.user;
    const userId = user._id.toString();
    const companyRoom = `company:${user.companyId || "global"}`;

    logger.info(`🔌 ${user.name} connected (${user.companyId || "global"})`);

    /* ================= USER TRACK ================= */
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);

    /* ================= ROOMS ================= */
    socket.join(`employee:${userId}`);
    socket.join(companyRoom);

    if (user.role === "admin") {
      socket.join(`admins:${user.companyId}`);
    }

    if (user.role === "super_admin") {
      socket.join("super_admin");
    }

    /* ================= ONLINE EVENT ================= */
    if (user.role === "employee") {
      io.to(`admins:${user.companyId}`).emit("system:employee-online", {
        employeeId: userId,
        name: user.name,
        companyId: user.companyId,
        connectedAt: new Date(),
      });
    }

    /* ================= EVENTS ================= */

    /* 📍 LOCATION */
    socket.on("location:ping", async (data) => {
      try {
        const { lat, lng, accuracy, speed } = data;

        if (!lat || !lng) return;

        io.to(`admins:${user.companyId}`).emit("location:update", {
          employeeId: userId,
          name: user.name,
          lat,
          lng,
          accuracy,
          speed,
          timestamp: new Date(),
        });

        // 🔥 non-blocking update
        User.updateOne(
          { _id: userId },
          {
            $set: {
              lastLocation: { lat, lng, timestamp: new Date() },
              isTracking: true,
            },
          }
        ).catch(() => {});

      } catch (error) {
        socket.emit("error", { message: "Location failed" });
      }
    });

    /* 📊 ADMIN FETCH */
    socket.on("admin:request-live-locations", async () => {
      try {
        if (user.role !== "admin") return;

        const employees = await User.find({
          role: "employee",
          companyId: user.companyId,
          isActive: true,
          isTracking: true,
        }).select("name employeeId lastLocation isTracking");

        socket.emit("admin:live-locations", { employees });

      } catch (err) {
        socket.emit("error", { message: "Fetch failed" });
      }
    });

    /* 🚨 ALERT */
    socket.on("admin:send-alert", ({ employeeId, message }) => {
      if (user.role !== "admin") return;

      io.to(`employee:${employeeId}`).emit("alert:received", {
        message,
        from: user.name,
        timestamp: new Date(),
      });
    });

    /* ================= DISCONNECT ================= */
    socket.on("disconnect", async () => {
      const sockets = connectedUsers.get(userId);

      if (!sockets) return;

      sockets.delete(socket.id);

      if (sockets.size === 0) {
        connectedUsers.delete(userId);

        if (user.role === "employee") {
          await User.updateOne(
            { _id: userId },
            { isTracking: false }
          ).catch(() => {});

          io.to(`admins:${user.companyId}`).emit(
            "system:employee-offline",
            {
              employeeId: userId,
              name: user.name,
              companyId: user.companyId,
              disconnectedAt: new Date(),
            }
          );
        }
      }
    });

    /* ================= AUTO RECOVERY ================= */
    socket.on("connect_error", (err) => {
      logger.warn("Socket reconnecting...", err.message);
    });
  });

  logger.info("✅ Socket initialized (production ready)");
};

module.exports = { initializeSocket };