// controllers/attendanceController.js

const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Alert = require("../models/Alert");

/* ================= DATE HELPER — IST AWARE ================= */
const getToday = () => {
  // ✅ FIX: use IST (UTC+5:30) instead of UTC
  // UTC date was causing "already clocked in" errors for Indian users
  // between midnight IST and 5:30am IST (when UTC date is still yesterday)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC + 5:30
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().slice(0, 10);
};

/* =========================================
   CLOCK IN
========================================= */
const clockIn = async (req, res) => {
  try {
    /* ✅ DEBUG LOG — remove after confirming clock-in works */
    console.log("🔍 CLOCK-IN HIT:", {
      userId: req.user?._id,
      role: req.user?.role,
      companyId: req.user?.companyId,
      body: req.body,
    });

    const { lat, lng, address, battery } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    /* ✅ FIX: parse to Number first — body values can come in as strings */
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (lat == null || lng == null || isNaN(latNum) || isNaN(lngNum)) {
      console.log("❌ Invalid lat/lng:", { lat, lng });
      return res.status(400).json({
        success: false,
        message: "Valid latitude & longitude required",
      });
    }

    const today = getToday();
    console.log("📅 Today (IST):", today);

    const existing = await Attendance.findOne({
      employee: req.user._id,
      companyId: req.user.companyId,
      date: today,
    });

    if (existing?.clockIn?.timestamp) {
      console.log("⚠️ Already clocked in today");
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
        const result = user.assignedGeofence.containsPoint(latNum, lngNum);
        isWithinGeofence = result?.isInside ?? true;
        geofenceId = user.assignedGeofence._id;
      } catch (geoErr) {
        console.log("⚠️ Geofence check failed (ignored):", geoErr.message);
      }
    }

    if (user?.assignedGeofence && !isWithinGeofence) {
      await Alert.create({
        employee: req.user._id,
        companyId: req.user.companyId,
        type: "geofence-violation",
        message: "Outside allowed area",
        location: { lat: latNum, lng: lngNum },
        severity: "high",
      });
    }

    const attendance = await Attendance.create({
      employee: req.user._id,
      companyId: req.user.companyId,
      date: today,
      clockIn: {
        timestamp: new Date(),
        location: { lat: latNum, lng: lngNum, address },
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
          lat: latNum,
          lng: lngNum,
          timestamp: new Date(),
        },
      }
    );

    console.log("✅ Clock-in saved:", attendance._id);

    res.status(201).json({
      success: true,
      message: "Clocked in successfully",
      attendance,
    });

  } catch (error) {
    console.error("❌ CLOCK-IN ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================================
   CLOCK OUT
========================================= */
const clockOut = async (req, res) => {
  try {
    console.log("🔍 CLOCK-OUT HIT:", {
      userId: req.user?._id,
      body: req.body,
    });

    const userId = req.user?._id || req.body.userId;
    const today = getToday(); // ✅ also IST-aware now

    const attendance = await Attendance.findOne({
      employee: userId,
      date: today,
    });

    if (!attendance) {
      console.log("⚠️ No attendance record found for today");
      return res.status(200).json({ success: true });
    }

    if (attendance.clockOut?.timestamp) {
      console.log("⚠️ Already clocked out");
      return res.status(200).json({ success: true });
    }

    /* ✅ Save clock-out location if provided */
    const lat = req.body.lat ? Number(req.body.lat) : null;
    const lng = req.body.lng ? Number(req.body.lng) : null;

    attendance.clockOut = {
      timestamp: new Date(),
      location: lat && lng ? { lat, lng } : null,
    };

    attendance.calculateHours();
    await attendance.save();

    await User.updateOne(
      { _id: userId },
      { isTracking: false }
    );

    console.log("✅ Clock-out saved");

    res.json({ success: true });

  } catch (err) {
    console.error("❌ CLOCK-OUT ERROR:", err.message);
    res.status(200).json({ success: true }); // never fail clock-out
  }
};

/* =========================================
   GET TODAY
========================================= */
const getTodayAttendance = async (req, res) => {
  try {
    const today = getToday(); // ✅ IST-aware

    const attendance = await Attendance.findOne({
      employee: req.user._id,
      companyId: req.user.companyId,
      date: today,
    }).populate("geofence", "name");

    res.json({ success: true, attendance });

  } catch (error) {
    console.error("❌ GET TODAY ERROR:", error.message);
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
    console.error("❌ GET ATTENDANCE ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  clockIn,
  clockOut,
  getTodayAttendance,
  getAttendance,
};
