/**
 * LOCATION CONTROLLER (FIXED - PRODUCTION READY)
 */

const User = require("../models/User");
const LocationLog = require("../models/LocationLog");

/* =========================================
   📍 UPDATE LOCATION (REAL-TIME)
========================================= */
const updateLocation = async (req, res) => {
  try {
    const {
      lat,
      lng,
      battery = null,
      speed = 0,
      accuracy = null,
      deviceId,
      syncId,
      networkQuality = "good",
    } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: "Invalid lat/lng" });
    }

    if (!deviceId || !syncId) {
      return res.status(400).json({ success: false, message: "deviceId & syncId required" });
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // ✅ Update live user
    await User.findOneAndUpdate(
      { _id: req.user._id, companyId: req.user.companyId },
      {
        lastLocation: {
          lat: Number(lat),
          lng: Number(lng),
          timestamp: now,
        },
        battery,
        isTracking: true,
        networkQuality,
      }
    );

    // ✅ Save log (duplicate safe)
    try {
      await LocationLog.create({
        employee: req.user._id,
        employeeId: req.user.employeeId,
        companyId: req.user.companyId,
        deviceId,
        syncId,
        location: {
          type: "Point",
          coordinates: [Number(lng), Number(lat)],
        },
        lat: Number(lat),
        lng: Number(lng),
        speed,
        accuracy,
        date: today,
        timestamp: now,
        battery,
        networkQuality,
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }

    // ✅ Realtime socket
    if (req.io) {
      req.io.to(`company_${req.user.companyId}`).emit("location:update", {
        employeeId: req.user.employeeId,
        lat,
        lng,
        battery,
        speed,
        networkQuality,
        timestamp: now,
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ updateLocation:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* =========================================
   🔥 OFFLINE BULK SYNC
========================================= */
const syncLocations = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false });
    }

    const locations = req.body;
    if (!Array.isArray(locations)) {
      return res.status(400).json({ success: false });
    }

    const now = new Date();

    const formatted = locations.map((d) => ({
      employee: req.user._id,
      employeeId: req.user.employeeId,
      companyId: req.user.companyId,
      deviceId: d.deviceId,
      syncId: d.syncId,
      location: {
        type: "Point",
        coordinates: [Number(d.lng), Number(d.lat)],
      },
      lat: Number(d.lat),
      lng: Number(d.lng),
      speed: d.speed || 0,
      accuracy: d.accuracy || null,
      battery: d.battery || null, // ✅ FIXED
      date: d.date || now.toISOString().split("T")[0],
      timestamp: d.timestamp || now,
      networkQuality: d.networkQuality || "good",
    }));

    await LocationLog.insertMany(formatted, { ordered: false });

    // ✅ Latest location update
    const lastItem = formatted.reduce((a, b) =>
      new Date(a.timestamp) > new Date(b.timestamp) ? a : b
    );

    await User.findOneAndUpdate(
      { _id: req.user._id, companyId: req.user.companyId },
      {
        lastLocation: {
          lat: lastItem.lat,
          lng: lastItem.lng,
          timestamp: lastItem.timestamp,
        },
        battery: lastItem.battery,
        isTracking: true,
        networkQuality: lastItem.networkQuality,
      }
    );

    return res.json({ success: true, count: formatted.length });
  } catch (err) {
    console.error("❌ syncLocations:", err);
    return res.status(500).json({ success: false });
  }
};

/* =========================================
   📡 GET LIVE LOCATIONS (FIXED + FAST)
========================================= */
const getLiveLocations = async (req, res) => {
  try {
    const employees = await User.find({
      role: "employee",
      isActive: true,
      companyId: req.user.companyId,
    }).select("name employeeId lastLocation battery networkQuality");

    const now = Date.now();
    const ONLINE_THRESHOLD = 5 * 60 * 1000; // ✅ FIXED (5 min)

    // ✅ Get all latest logs in ONE query (performance fix)
    const logs = await LocationLog.aggregate([
      {
        $match: { companyId: req.user.companyId },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $group: {
          _id: "$employeeId",
          doc: { $first: "$$ROOT" },
        },
      },
    ]);

    const logMap = {};
    logs.forEach((l) => {
      logMap[l._id] = l.doc;
    });

    const result = employees.map((emp) => {
      let lastLocation = emp.lastLocation;
      let battery = emp.battery;
      let networkQuality = emp.networkQuality || "good";

      let isOnline = false;

      // ✅ Check user table first
      if (lastLocation?.timestamp) {
        const diff = now - new Date(lastLocation.timestamp).getTime();
        if (diff < ONLINE_THRESHOLD) isOnline = true;
      }

      // ✅ fallback to logs
      if (!isOnline && logMap[emp.employeeId]) {
        const log = logMap[emp.employeeId];
        const diff = now - new Date(log.timestamp).getTime();

        if (diff < ONLINE_THRESHOLD) {
          isOnline = true;

          lastLocation = {
            lat: log.lat,
            lng: log.lng,
            timestamp: log.timestamp,
          };

          battery = log.battery;
          networkQuality = log.networkQuality;
        }
      }

      return {
        _id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        lastLocation,
        battery,
        networkQuality,
        isOnline,
        isTracking: isOnline,
      };
    });

    return res.json({
      success: true,
      employees: result,
    });
  } catch (err) {
    console.error("❌ getLiveLocations:", err);
    return res.status(500).json({ success: false });
  }
};

/* =========================================
   🛣 ROUTE HISTORY
========================================= */
const getRouteHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const logs = await LocationLog.find({
      employeeId,
      companyId: req.user.companyId,
    })
      .sort({ timestamp: 1 })
      .limit(1000);

    return res.json({ success: true, logs });
  } catch (err) {
    console.error("❌ getRouteHistory:", err);
    return res.status(500).json({ success: false });
  }
};

module.exports = {
  updateLocation,
  syncLocations,
  getLiveLocations,
  getRouteHistory,
};