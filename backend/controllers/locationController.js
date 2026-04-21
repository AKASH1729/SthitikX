/**
 * LOCATION CONTROLLER (REAL-TIME + OFFLINE SYNC + NETWORK QUALITY)
 * No auto‑clockout – you can implement it elsewhere if needed.
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
      networkQuality = "good",   // optional, from client
    } = req.body;

    // Authentication & validation
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
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

    // 1️⃣ Update User's live data
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
        networkQuality,
      }
    );

    // 2️⃣ Save location log (duplicate safe via syncId unique index)
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
        networkQuality,
      });
    } catch (err) {
      // Ignore duplicate syncId errors
      if (err.code !== 11000) throw err;
    }

    // 3️⃣ Emit real‑time event via WebSocket
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
      networkQuality: data.networkQuality || "good",
    }));

    // Bulk insert with duplicate skipping
    await LocationLog.insertMany(formatted, { ordered: false });

    // Also update the user's lastLocation to the most recent log in the batch
    const lastItem = formatted.reduce((latest, item) =>
      new Date(item.timestamp) > new Date(latest.timestamp) ? item : latest
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

    return res.status(200).json({
      success: true,
      message: "Offline sync completed",
      count: formatted.length,
    });
  } catch (error) {
    console.error("❌ SYNC ERROR:", error);
    if (error.writeErrors) {
      // Some items were duplicates – still a success
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
   📡 GET LIVE LOCATIONS (WITH LOG FALLBACK)
========================================= */
const getLiveLocations = async (req, res) => {
  try {
    const employees = await User.find({
      role: "employee",
      isActive: true,
      companyId: req.user.companyId,
    }).select("name employeeId lastLocation battery networkQuality _id");

    const now = new Date();
    const twoMinutesAgo = new Date(now - 120000);
    const updatedEmployees = [];

    for (const emp of employees) {
      let isOnline = false;
      let lastLocation = emp.lastLocation;
      let battery = emp.battery;
      let networkQuality = emp.networkQuality || "good";

      // 1. Check if User.lastLocation is recent
      if (lastLocation?.timestamp && new Date(lastLocation.timestamp) > twoMinutesAgo) {
        isOnline = true;
      } else {
        // 2. Fallback: get the most recent location log
        const latestLog = await LocationLog.findOne({ employeeId: emp.employeeId })
          .sort({ timestamp: -1 })
          .limit(1);
        if (latestLog && new Date(latestLog.timestamp) > twoMinutesAgo) {
          isOnline = true;
          lastLocation = {
            lat: latestLog.lat,
            lng: latestLog.lng,
            timestamp: latestLog.timestamp,
          };
          battery = latestLog.battery;
          networkQuality = latestLog.networkQuality || "good";

          // Sync back to User for future queries (optional)
          await User.updateOne(
            { _id: emp._id },
            {
              lastLocation,
              battery,
              isTracking: true,
              networkQuality,
            }
          ).catch(err => console.error("User sync failed:", err.message));
        }
      }

      updatedEmployees.push({
        _id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        lastLocation,
        battery,
        networkQuality,
        isTracking: isOnline,
        isOnline,
      });
    }

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

    // Security: ensure employee belongs to the same company
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
  syncLocations,
  getLiveLocations,
  getRouteHistory,
};
