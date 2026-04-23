const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Alert = require("../models/Alert");

/* ================= DATE HELPER (IST SAFE) ================= */
const getToday = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().slice(0, 10); // YYYY-MM-DD
};

/* =========================================
   CLOCK IN
========================================= */
const clockIn = async (req, res) => {
  try {
    const { lat, lng, address, battery } = req.body;

    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude & longitude required",
      });
    }

    const today = getToday();

    console.log("📅 CLOCK-IN DATE:", today);

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

    const attendance = await Attendance.create({
      employee: req.user._id,
      companyId: req.user.companyId,
      date: today,
      clockIn: {
        timestamp: new Date(),
        location: { lat: latNum, lng: lngNum, address },
      },
      battery: battery ?? null,
    });

    await User.updateOne(
      { _id: req.user._id },
      {
        isTracking: true,
        lastLocation: {
          lat: latNum,
          lng: lngNum,
          timestamp: new Date(), // 🔥 IMPORTANT
        },
      }
    );

    console.log("✅ Clock-in saved");

    res.status(201).json({
      success: true,
      attendance,
    });

  } catch (error) {
    console.error("❌ CLOCK-IN ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================================
   CLOCK OUT (FIXED)
========================================= */
const clockOut = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = getToday();

    console.log("📅 CLOCK-OUT DATE:", today);

    const attendance = await Attendance.findOne({
      employee: userId,
      companyId: req.user.companyId, // 🔥 FIX
      date: today,
    });

    if (!attendance) {
      console.log("⚠️ No attendance found");
      return res.json({ success: true });
    }

    if (attendance.clockOut?.timestamp) {
      return res.json({ success: true });
    }

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
    console.error("❌ CLOCK-OUT ERROR:", err);
    res.json({ success: true });
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
    });

    res.json({ success: true, attendance });

  } catch (error) {
    console.error("❌ GET TODAY ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================================
   GET ALL (FIXED FOR FRONTEND)
========================================= */
const getAttendance = async (req, res) => {
  try {
    const { employeeId, date } = req.query;

    const query = {
      companyId: req.user.companyId,
    };

    if (req.user.role === "employee") {
      query.employee = req.user._id;
    } else if (employeeId) {
      query.employee = employeeId;
    }

    if (date) {
      query.date = String(date).trim();
    }

    const records = await Attendance.find(query)
      .populate("employee", "name email employeeId")
      .populate("geofence", "name")
      .sort({ date: -1, "clockIn.timestamp": 1 })
      .lean();

    /* 🔥 CREATE GROUPED DATA (FOR WEB) */
    const grouped = {};

    records.forEach((rec) => {
      if (!grouped[rec.date]) {
        grouped[rec.date] = [];
      }
      grouped[rec.date].push(rec);
    });

    /* 🔥 RETURN BOTH FORMATS */
    res.json({
      success: true,

      // 📱 MOBILE (Flat)
      records,

      // 💻 WEB (Grouped)
      data: grouped,
    });

  } catch (error) {
    console.error("GET ATTENDANCE ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
module.exports = {
  clockIn,
  clockOut,
  getTodayAttendance,
  getAttendance,
};
