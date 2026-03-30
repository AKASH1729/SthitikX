/**
 * Attendance Controller
 * Clock-in, clock-out, and attendance history
 */

const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Geofence = require('../models/Geofence');
const Alert = require('../models/Alert');
const logger = require('../config/logger');

/**
 * @route   POST /api/attendance/clock-in
 * @desc    Employee clocks in with location
 * @access  Private (Employee)
 */
const clockIn = async (req, res) => {
  try {
    const { lat, lng, address } = req.body;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if already clocked in today
    const existing = await Attendance.findOne({ employee: req.user._id, date: today });
    if (existing && existing.clockIn.timestamp) {
      return res.status(400).json({ success: false, message: 'Already clocked in today.' });
    }

    // Validate against assigned geofence
    let isWithinGeofence = false;
    let geofenceId = null;

    const user = await User.findById(req.user._id).populate('assignedGeofence');
    if (user.assignedGeofence) {
      const result = user.assignedGeofence.containsPoint(lat, lng);
      isWithinGeofence = result.isInside;
      geofenceId = user.assignedGeofence._id;

      if (!isWithinGeofence) {
        logger.warn(`Employee ${req.user.email} clocked in outside geofence`);
      }
    }

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

    // Update user tracking status
    await User.findByIdAndUpdate(req.user._id, { isTracking: true });

    // Emit real-time event
    req.io.to('admins').emit('employee:clocked-in', {
      employeeId: req.user._id,
      name: req.user.name,
      time: new Date(),
      location: { lat, lng },
      isWithinGeofence,
    });

    res.status(201).json({
      success: true,
      message: 'Clocked in successfully.',
      attendance,
      isWithinGeofence,
    });
  } catch (error) {
    logger.error(`Clock-in error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Clock-in failed.' });
  }
};

/**
 * @route   POST /api/attendance/clock-out
 * @desc    Employee clocks out
 * @access  Private (Employee)
 */
const clockOut = async (req, res) => {
  try {
    const { lat, lng, address } = req.body;
    const today = new Date().toISOString().split('T')[0];

    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today,
    });

    if (!attendance) {
      return res.status(400).json({ success: false, message: 'No clock-in record found for today.' });
    }
    if (attendance.clockOut.timestamp) {
      return res.status(400).json({ success: false, message: 'Already clocked out today.' });
    }

    // Validate geofence for clock-out
    let isWithinGeofence = false;
    const user = await User.findById(req.user._id).populate('assignedGeofence');
    if (user.assignedGeofence) {
      const result = user.assignedGeofence.containsPoint(lat, lng);
      isWithinGeofence = result.isInside;
    }

    attendance.clockOut = {
      timestamp: new Date(),
      location: { lat, lng, address },
      isWithinGeofence,
    };

    // Calculate total working hours
    attendance.calculateHours();
    await attendance.save();

    // Mark status if less than half day (< 4 hours)
    if (attendance.totalHours < 4) attendance.status = 'half-day';
    await attendance.save();

    // Stop tracking
    await User.findByIdAndUpdate(req.user._id, { isTracking: false });

    req.io.to('admins').emit('employee:clocked-out', {
      employeeId: req.user._id,
      name: req.user.name,
      time: new Date(),
      totalHours: attendance.totalHours,
    });

    res.json({
      success: true,
      message: 'Clocked out successfully.',
      attendance,
    });
  } catch (error) {
    logger.error(`Clock-out error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Clock-out failed.' });
  }
};

/**
 * @route   GET /api/attendance/today
 * @desc    Get today's attendance for logged-in employee
 * @access  Private
 */
const getTodayAttendance = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const attendance = await Attendance.findOne({
    employee: req.user._id,
    date: today,
  }).populate('geofence', 'name');

  res.json({ success: true, attendance });
};

/**
 * @route   GET /api/attendance
 * @desc    Get attendance records (admin: all, employee: own)
 * @access  Private
 */
const getAttendance = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, page = 1, limit = 30 } = req.query;

    const query = {};

    // Employees can only see their own records
    if (req.user.role === 'employee') {
      query.employee = req.user._id;
    } else if (employeeId) {
      query.employee = employeeId;
    }

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const total = await Attendance.countDocuments(query);
    const records = await Attendance.find(query)
      .populate('employee', 'name email employeeId department avatar')
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
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { clockIn, clockOut, getTodayAttendance, getAttendance };
