/**
 * Attendance Controller (FINAL - SAFE VERSION)
 */

const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Alert = require('../models/Alert');

/* =========================================
   CLOCK IN
========================================= */
const clockIn = async (req, res) => {
  try {
    const { lat, lng, address, battery } = req.body;

    // ✅ Validation (avoid undefined crash)
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and Longitude required',
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // 🔍 Check if already clocked in
    const existing = await Attendance.findOne({
      employee: req.user._id,
      date: today,
    });

    if (existing && existing.clockIn?.timestamp) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked in today',
      });
    }

    let isWithinGeofence = false;
    let geofenceId = null;

    const user = await User.findById(req.user._id).populate('assignedGeofence');

    // ✅ SAFE GEOFENCE CHECK (no crash)
    if (user?.assignedGeofence && lat && lng) {
      try {
        const result = user.assignedGeofence.containsPoint(lat, lng);
        isWithinGeofence = result?.isInside || false;
        geofenceId = user.assignedGeofence._id;
      } catch (err) {
        console.log("Geofence error:", err.message);
      }
    }

    // ❌ Strict check: block if outside
   if (user?.assignedGeofence && !isWithinGeofence) {
  await Alert.create({
    employee: req.user._id,
    type: 'geofence-violation',
    message: 'Outside allowed area',
    location: { lat, lng },
    severity: 'high',
  });

  // ❗ DO NOT BLOCK
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
      battery: battery ?? null, // optional
      geofence: geofenceId,
    });

    // 🔄 Start tracking
    await User.findByIdAndUpdate(req.user._id, { isTracking: true });

    res.status(201).json({
      success: true,
      message: '✅ Clocked in successfully',
      attendance,
    });

  } catch (error) {
    console.error("CLOCK-IN ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
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

    let isWithinGeofence = false;

    const user = await User.findById(req.user._id).populate('assignedGeofence');

    // ✅ SAFE CHECK
    if (user?.assignedGeofence && lat && lng) {
      try {
        const result = user.assignedGeofence.containsPoint(lat, lng);
        isWithinGeofence = result?.isInside || false;
      } catch (err) {
        console.log("Geofence error:", err.message);
      }
    }

    // 🔔 Only alert, not block
    if (user?.assignedGeofence && !isWithinGeofence) {
      await Alert.create({
        employee: req.user._id,
        type: 'geofence-violation',
        message: 'Clock-out outside geofence',
      });
    }

    // ✅ Update attendance
    attendance.clockOut = {
      timestamp: new Date(),
      location: { lat, lng, address },
      isWithinGeofence,
    };

    attendance.calculateHours();

    // Half-day logic
    if (attendance.totalHours < 4) {
      attendance.status = 'half-day';
    }

    await attendance.save();

    // 🛑 Stop tracking
    await User.findByIdAndUpdate(req.user._id, { isTracking: false });

    res.json({
      success: true,
      message: '✅ Clocked out successfully',
      attendance,
    });

  } catch (error) {
    console.error("CLOCK-OUT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   GET TODAY ATTENDANCE
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
    console.error("GET TODAY ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   GET ALL ATTENDANCE
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
      .limit(Number(limit))
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
    console.error("GET ALL ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   EXPORTS
========================================= */
module.exports = {
  clockIn,
  clockOut,
  getTodayAttendance,
  getAttendance,
};