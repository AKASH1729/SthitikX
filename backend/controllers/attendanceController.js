/**
 * Attendance Controller (Corrected)
 */

const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Alert = require('../models/Alert');
const logger = require('../config/logger');

/* =========================================
   CLOCK IN
========================================= */
const clockIn = async (req, res) => {
  try {
    const { lat, lng, address } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and Longitude required',
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // 🔍 Check already clocked in
    const existing = await Attendance.findOne({
      employee: req.user._id,
      date: today,
    });

    if (existing && existing.clockIn?.timestamp) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked in today.',
      });
    }

    // 📍 Geofence check
    let isWithinGeofence = false;
    let geofenceId = null;

    const user = await User.findById(req.user._id).populate('assignedGeofence');

    if (user.assignedGeofence) {
      const result = user.assignedGeofence.containsPoint(lat, lng);
      isWithinGeofence = result.isInside;
      geofenceId = user.assignedGeofence._id;

      // 🚫 STRICT VALIDATION
      if (!isWithinGeofence) {
        // 🔔 create alert
        await Alert.create({
          employee: req.user._id,
          type: 'geofence-violation',
          message: 'Clock-in attempted outside geofence',
        });

        return res.status(400).json({
          success: false,
          message: '❌ You are outside allowed area',
          isWithinGeofence: false,
        });
      }
    }

    // ✅ Create attendance
    const attendance = await Attendance.create({
      employee: req.user._id,
      date: today,
      clockIn: {
        timestamp: new Date(),
        location: { lat, lng, address },
        isWithinGeofence,
      },
      geofence: geofenceId,
    });

    // 🔄 Start tracking
    await User.findByIdAndUpdate(req.user._id, { isTracking: true });

    // 📡 Socket event
    req.io.to('admins').emit('employee:clocked-in', {
      employeeId: req.user._id,
      name: req.user.name,
      time: new Date(),
      location: { lat, lng },
      isWithinGeofence,
    });

    res.status(201).json({
      success: true,
      message: '✅ Clocked in successfully',
      attendance,
      isWithinGeofence,
    });

  } catch (error) {
    logger.error(`Clock-in error: ${error.message}`);

    res.status(500).json({
      success: false,
      message: 'Clock-in failed',
    });
  }
};

/* =========================================
   CLOCK OUT
========================================= */
const clockOut = async (req, res) => {
  try {
    const { lat, lng, address } = req.body;

    const today = new Date().toISOString().split('T')[0];

    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today,
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'No clock-in record found',
      });
    }

    if (attendance.clockOut?.timestamp) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked out',
      });
    }

    // 📍 Geofence check (not strict)
    let isWithinGeofence = false;

    const user = await User.findById(req.user._id).populate('assignedGeofence');

    if (user.assignedGeofence) {
      const result = user.assignedGeofence.containsPoint(lat, lng);
      isWithinGeofence = result.isInside;

      // 🔔 Alert only (not blocking)
      if (!isWithinGeofence) {
        await Alert.create({
          employee: req.user._id,
          type: 'geofence-violation',
          message: 'Clock-out outside geofence',
        });
      }
    }

    // ✅ Update attendance
    attendance.clockOut = {
      timestamp: new Date(),
      location: { lat, lng, address },
      isWithinGeofence,
    };

    attendance.calculateHours();

    if (attendance.totalHours < 4) {
      attendance.status = 'half-day';
    }

    await attendance.save();

    // 🛑 Stop tracking
    await User.findByIdAndUpdate(req.user._id, { isTracking: false });

    // 📡 Socket event
    req.io.to('admins').emit('employee:clocked-out', {
      employeeId: req.user._id,
      name: req.user.name,
      time: new Date(),
      totalHours: attendance.totalHours,
    });

    res.json({
      success: true,
      message: '✅ Clocked out successfully',
      attendance,
    });

  } catch (error) {
    logger.error(`Clock-out error: ${error.message}`);

    res.status(500).json({
      success: false,
      message: 'Clock-out failed',
    });
  }
};

/* =========================================
   GET TODAY
========================================= */
const getTodayAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today,
    }).populate('geofence', 'name');

    res.json({
      success: true,
      attendance,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   GET ALL (ADMIN / EMPLOYEE)
========================================= */
const getAttendance = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, page = 1, limit = 30 } = req.query;

    const query = {};

    if (req.user.role === 'employee') {
      query.employee = req.user._id;
    } else if (employeeId) {
      query.employee = employeeId;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const total = await Attendance.countDocuments(query);

    const records = await Attendance.find(query)
      .populate('employee', 'name email employeeId department')
      .populate('geofence', 'name')
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      success: true,
      records,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   EXPORT
========================================= */
module.exports = {
  clockIn,
  clockOut,
  getTodayAttendance,
  getAttendance,
};