/**
 * LOCATION CONTROLLER (REAL-TIME + OFFLINE SYNC 🔥)
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
      syncId
    } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (
      lat == null || lng == null ||
      isNaN(lat) || isNaN(lng)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude & longitude required",
      });
    }

    if (!deviceId || !syncId) {
      return res.status(400).json({
        success: false,
        message: "deviceId & syncId required",
      });
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    /* =========================
       UPDATE USER LIVE DATA
    ========================= */
    await User.findOneAndUpdate(
      {
        _id: req.user._id,
        companyId: req.user.companyId,
      },
      {
        lastLocation: {
          lat: Number(lat),
          lng: Number(lng),
          timestamp: now,
        },
        battery,
        isTracking: true,
      }
    );

    /* =========================
       SAVE LOCATION (DUP SAFE)
    ========================= */
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
      });
    } catch (err) {
      // 🔥 Ignore duplicate
      if (err.code !== 11000) throw err;
    }

    /* =========================
       SOCKET UPDATE
    ========================= */
    if (req.io) {
      req.io.to(`company_${req.user.companyId}`).emit("location:update", {
        employeeId: req.user.employeeId,
        lat,
        lng,
        battery,
        speed,
        timestamp: now,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Location updated (real-time)",
    });

  } catch (error) {
    console.error("❌ LOCATION UPDATE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   🔥 OFFLINE BULK SYNC
========================================= */
const syncLocations = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    const locations = req.body;

    if (!Array.isArray(locations)) {
      return res.status(400).json({
        success: false,
        message: "Array of locations required",
      });
    }

    const now = new Date();

    const formatted = locations.map((data) => ({
      employee: req.user._id,
      employeeId: req.user.employeeId,
      companyId: req.user.companyId,

      deviceId: data.deviceId,
      syncId: data.syncId,

      location: {
        type: "Point",
        coordinates: [Number(data.lng), Number(data.lat)],
      },

      lat: Number(data.lat),
      lng: Number(data.lng),
      speed: data.speed || 0,
      accuracy: data.accuracy || null,
      date: data.date || now.toISOString().split("T")[0],
      timestamp: data.timestamp || now,
    }));

    // 🔥 BULK INSERT (FAST + DUP SAFE)
    await LocationLog.insertMany(formatted, { ordered: false });

    return res.status(200).json({
      success: true,
      message: "Offline sync completed",
      count: formatted.length,
    });

  } catch (error) {
    console.error("❌ SYNC ERROR:", error);

    // 🔥 ignore duplicates
    if (error.writeErrors) {
      return res.status(200).json({
        success: true,
        message: "Partial sync (duplicates skipped)",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   📡 GET LIVE LOCATIONS
========================================= */
const getLiveLocations = async (req, res) => {
  try {
    const employees = await User.find({
      role: "employee",
      isActive: true,
      companyId: req.user.companyId,
    }).select("name employeeId lastLocation battery");

    const now = new Date();

    const updatedEmployees = employees.map((emp) => {
      const last = emp.lastLocation?.timestamp;

      const isOnline =
        last && (now - new Date(last)) < 120000;

      return {
        ...emp.toObject(),
        isOnline: !!isOnline,
      };
    });

    res.json({
      success: true,
      employees: updatedEmployees,
    });

  } catch (error) {
    console.error("❌ LIVE LOCATION ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   🛣 GET ROUTE HISTORY
========================================= */
const getRouteHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "employeeId required",
      });
    }

    const isValid = await LocationLog.exists({
      employeeId,
      companyId: req.user.companyId,
    });

    if (!isValid) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const logs = await LocationLog.find({
      employeeId,
      companyId: req.user.companyId,
    })
      .sort({ timestamp: 1 })
      .limit(1000);

    return res.status(200).json({
      success: true,
      logs,
    });

  } catch (error) {
    console.error("❌ ROUTE HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   📦 EXPORTS
========================================= */
module.exports = {
  updateLocation,
  syncLocations, // 🔥 NEW
  getLiveLocations,
  getRouteHistory,
};