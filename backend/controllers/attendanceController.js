// controllers/attendanceController.js

const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Alert = require("../models/Alert");

/* ================= DATE HELPER ================= */
const getToday = () => {
  return new Date().toISOString().slice(0, 10); // 🔥 FIXED
};

/* =========================================
   CLOCK IN
========================================= */
const clockIn = async (req, res) => {
  try {
    const { lat, lng, address, battery } = req.body;
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude & longitude required",
      });
    }

    const today = getToday();

    const existing = await Attendance.findOne({
      employee: req.user._id,
      companyId: req.user.companyId,
      date: today,
    });

    if (existing?.clockIn?.timestamp) {
      return res.status(400).json({
        success: false,
        message: "Already clocked in today",
      });
    }

    let isWithinGeofence = true;
    let geofenceId = null;

    const user = await User.findOne({
      _id: req.user._id,
      companyId: req.user.companyId,
    }).populate("assignedGeofence");

    if (user?.assignedGeofence) {
      try {
        const result = user.assignedGeofence.containsPoint(lat, lng);
        isWithinGeofence = result?.isInside ?? true;
        geofenceId = user.assignedGeofence._id;
      } catch {}
    }

    if (user?.assignedGeofence && !isWithinGeofence) {
      await Alert.create({
        employee: req.user._id,
        companyId: req.user.companyId,
        type: "geofence-violation",
        message: "Outside allowed area",
        location: { lat, lng },
        severity: "high",
      });
    }

    const attendance = await Attendance.create({
      employee: req.user._id,
      companyId: req.user.companyId,
      date: today,
      clockIn: {
        timestamp: new Date(),
        location: { lat: Number(lat), lng: Number(lng), address },
        isWithinGeofence,
      },
      battery: battery ?? null,
      geofence: geofenceId,
    });

    await User.updateOne(
      { _id: req.user._id },
      {
        isTracking: true,
        lastLocation: {
          lat: Number(lat),
          lng: Number(lng),
          timestamp: new Date(),
        },
      }
    );

    res.status(201).json({
      success: true,
      message: "Clocked in successfully",
      attendance,
    });

  } catch (error) {
    console.error("CLOCK-IN ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================================
   CLOCK OUT
========================================= */
const clockOut = async (req, res) => {
  try {
    const userId = req.user?._id || req.body.userId;

    const today = new Date().toISOString().slice(0, 10);

    const attendance = await Attendance.findOne({
      employee: userId,
      date: today,
    });

    if (!attendance) {
      return res.status(200).json({ success: true });
    }

    // 🔥 already clocked out → ignore
    if (attendance.clockOut?.timestamp) {
      return res.status(200).json({ success: true });
    }

    attendance.clockOut = {
      timestamp: new Date(),
      location: null,
    };

    attendance.calculateHours();
    await attendance.save();

    await User.updateOne(
      { _id: userId },
      { isTracking: false }
    );

    res.json({ success: true });

  } catch (err) {
    res.status(200).json({ success: true }); // 🔥 never fail
  }
};

/* =========================================
   GET TODAY
========================================= */
const getTodayAttendance = async (req, res) => {
  try {
    const today = getToday();

    const attendance = await Attendance.findOne({
      employee: req.user._id,
      companyId: req.user.companyId,
      date: today,
    }).populate("geofence", "name");

    res.json({ success: true, attendance });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================================
   GET ALL
========================================= */
const getAttendance = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, page = 1, limit = 30 } = req.query;

    const query = {
      companyId: req.user.companyId,
    };

    if (req.user.role === "employee") {
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
      .populate("employee", "name email employeeId department")
      .populate("geofence", "name")
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
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  clockIn,
  clockOut,
  getTodayAttendance,
  getAttendance,
};