/**
 * Socket.io Manager
 * Handles real-time bidirectional communication for live tracking
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

// Track connected sockets: Map<userId, socketId>
const connectedUsers = new Map();

const initializeSocket = (io) => {

  // ─── Middleware: Authenticate socket connections ──────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('name email role isActive');

      if (!user || !user.isActive) return next(new Error('User not found'));

      socket.user = user; // Attach user to socket
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection Handler ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const user = socket.user;
    logger.info(`🔌 Socket connected: ${user.name} [${user.role}] - ${socket.id}`);

    // Store connection
    connectedUsers.set(user._id.toString(), socket.id);

    // Admins join a special room to receive all employee events
    if (user.role === 'admin') {
      socket.join('admins');
      logger.info(`👑 Admin ${user.name} joined admin room`);
    }

    // Employee joins their own personal room
    socket.join(`employee:${user._id}`);

    // Broadcast updated online count to admins
    io.to('admins').emit('system:employee-online', {
      employeeId: user._id,
      name: user.name,
      role: user.role,
      connectedAt: new Date(),
    });

    // ─── Employee: Send location ping ───────────────────────────────────────
    // This is a WebSocket alternative to the REST API for location updates
    socket.on('location:ping', async (data) => {
      try {
        const { lat, lng, accuracy, speed } = data;

        // Broadcast to all admins
        io.to('admins').emit('location:update', {
          employeeId: user._id,
          name: user.name,
          lat, lng, accuracy, speed,
          timestamp: new Date(),
        });

        // Update last location in DB (non-blocking)
        User.findByIdAndUpdate(user._id, {
          lastLocation: { lat, lng, timestamp: new Date() },
        }).catch(err => logger.error(`Failed to update location: ${err.message}`));

      } catch (error) {
        socket.emit('error', { message: 'Location update failed' });
      }
    });

    // ─── Admin: Request live locations of all employees ─────────────────────
    socket.on('admin:request-live-locations', async () => {
      if (user.role !== 'admin') return;

      const employees = await User.find({
        role: 'employee',
        isActive: true,
        isTracking: true,
      }).select('name email employeeId lastLocation isTracking');

      socket.emit('admin:live-locations', { employees });
    });

    // ─── Admin: Send message/alert to specific employee ─────────────────────
    socket.on('admin:send-alert', ({ employeeId, message }) => {
      if (user.role !== 'admin') return;

      const employeeSocketId = connectedUsers.get(employeeId);
      if (employeeSocketId) {
        io.to(`employee:${employeeId}`).emit('alert:received', {
          message,
          from: user.name,
          timestamp: new Date(),
        });
        socket.emit('admin:alert-sent', { success: true, employeeId });
      } else {
        socket.emit('admin:alert-sent', { success: false, message: 'Employee not online' });
      }
    });

    // ─── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      logger.info(`🔌 Socket disconnected: ${user.name} - ${reason}`);
      connectedUsers.delete(user._id.toString());

      // Mark employee as not tracking on disconnect
      if (user.role === 'employee') {
        await User.findByIdAndUpdate(user._id, { isTracking: false }).catch(() => {});
        io.to('admins').emit('system:employee-offline', {
          employeeId: user._id,
          name: user.name,
          disconnectedAt: new Date(),
        });
      }
    });
  });

  logger.info('✅ Socket.io initialized');
};

// Export utility to get socket id of a user
const getUserSocketId = (userId) => connectedUsers.get(userId.toString());

module.exports = { initializeSocket, getUserSocketId };
