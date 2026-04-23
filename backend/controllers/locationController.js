const Location = require("../models/bulkLocation");
const User = require("../models/User");

/* =========================================
🔥 BULK SYNC (OPTIMIZED + FIXED)
========================================= */
const syncLocations = async (req, res) => {
  try {
    const { batch } = req.body;

    if (!Array.isArray(batch) || batch.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch",
      });
    }

    const companyId = String(req.user.companyId);
    const now = new Date();

    const docs = batch
      .filter(item => item.lat && item.lng && item.employeeId)
      .map(item => {
        const lat = Number(item.lat);
        const lng = Number(item.lng);

        return {
          syncId: item.syncId,
          employeeId: item.employeeId,
          companyId,

          deviceId: item.deviceId,

          location: {
            type: "Point",
            coordinates: [lng, lat],
          },

          lat,
          lng,

          speed: item.speed || 0,
          accuracy: item.accuracy || null,
          battery: item.battery ?? -1,
          networkQuality: item.networkQuality || "good",

          timestamp: now, // 🔥 SAME TIME FOR ALL
        };
      });

    /* 🔥 SAVE ROUTES */
    await Location.bulkWrite(
      docs.map(doc => ({
        updateOne: {
          filter: { syncId: doc.syncId },
          update: { $setOnInsert: doc },
          upsert: true,
        }
      }))
    );

    /* 🔥 FIX: UPDATE USERS IN BULK (FAST + ACCURATE) */
    const userUpdates = docs.map(doc => ({
      updateOne: {
        filter: {
          employeeId: doc.employeeId,
          companyId,
        },
        update: {
          $set: {
            lastLocation: {
              lat: doc.lat,
              lng: doc.lng,
              timestamp: now, // 🔥 CRITICAL FIX
            },
            battery: doc.battery,
            networkQuality: doc.networkQuality,
          }
        }
      }
    }));

    await User.bulkWrite(userUpdates);

    console.log("✅ Locations synced:", docs.length);

    res.json({
      success: true,
      inserted: docs.length,
    });

  } catch (err) {
    console.error("❌ syncLocations:", err);
    res.status(500).json({ success: false });
  }
};


/* =========================================
📡 LIVE LOCATIONS (FIXED)
========================================= */
const getLiveLocations = async (req, res) => {
  try {
    if (!req.user || !req.user.companyId) {
      return res.status(401).json({
        success: false,
        message: "No company context",
      });
    }

    const companyId = req.user.companyId;

    const users = await User.find({
      companyId,
      role: "employee",
      isActive: true,
    }).select(
      "name employeeId lastLocation battery networkQuality isTracking"
    );

    const now = Date.now();

    /* 🔥 MATCH FRONTEND (3 MINUTES) */
    const ONLINE_THRESHOLD = 3 * 60 * 1000;

    const employees = users.map((emp) => {
      let isOnline = false;

      if (emp.lastLocation?.timestamp) {
        const diff = now - new Date(emp.lastLocation.timestamp).getTime();
        if (diff < ONLINE_THRESHOLD) {
          isOnline = true;
        }
      }

      return {
        _id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,

        lastLocation: emp.lastLocation,
        battery: emp.battery,
        networkQuality: emp.networkQuality || "good",

        isOnline,
        isTracking: emp.isTracking && isOnline, // 🔥 FINAL FIX
      };
    });

    res.json({
      success: true,
      employees,
    });

  } catch (err) {
    console.error("❌ getLiveLocations:", err);
    res.status(500).json({ success: false });
  }
};


/* =========================================
🛣 ROUTE HISTORY (OK)
========================================= */
const getRouteHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { date } = req.query;

    const start = new Date(`${date}T00:00:00+05:30`);
    const end = new Date(`${date}T23:59:59.999+05:30`);

    const logs = await Location.find({
      employeeId,
      companyId: String(req.user.companyId),
      timestamp: {
        $gte: start,
        $lte: end,
      },
    }).sort({ timestamp: 1 });

    res.json({
      success: true,
      data: logs.map(l => ({
        lat: l.lat,
        lng: l.lng,
        timestamp: l.timestamp,
      })),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

module.exports = {
  syncLocations,
  getLiveLocations,
  getRouteHistory,
};
