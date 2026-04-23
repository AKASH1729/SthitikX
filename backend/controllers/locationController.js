const Location = require("../models/bulkLocation");
const User = require("../models/User");

/* =========================================
🔥 BULK SYNC (APK → SERVER)
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

    const docs = batch
      .filter(item => item.lat && item.lng)
      .map(item => {
        const lat = Number(item.lat);
        const lng = Number(item.lng);

        return {
          syncId: item.syncId,
          employeeId: item.employeeId,
          companyId: String(req.user.companyId),

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

          timestamp: new Date(), // 🔥 SERVER TIME
        };
      });

    await Location.bulkWrite(
      docs.map(doc => ({
        updateOne: {
          filter: { syncId: doc.syncId },
          update: { $setOnInsert: doc },
          upsert: true,
        }
      }))
    );

    /* 🔥 UPDATE USER LIVE STATUS */
    for (const item of docs) {
      await User.updateOne(
        { employeeId: item.employeeId },
        {
          lastLocation: {
            lat: item.lat,
            lng: item.lng,
            timestamp: item.timestamp,
          },
          battery: item.battery,
          networkQuality: item.networkQuality,
          // ⚠️ DO NOT change isTracking here
        }
      );
    }

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
📡 LIVE LOCATIONS (FINAL FIX)
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

    /* 🔥 GET USERS */
    const users = await User.find({
      companyId,
      role: "employee",
      isActive: true,
    }).select(
      "name employeeId lastLocation battery networkQuality isTracking"
    );

    const now = Date.now();
    const ONLINE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

    const employees = users.map((emp) => {
      let lastLocation = emp.lastLocation;
      let battery = emp.battery;
      let networkQuality = emp.networkQuality || "good";

      let isOnline = false;

      /* 🔹 CHECK LAST LOCATION TIME */
      if (lastLocation?.timestamp) {
        const diff = now - new Date(lastLocation.timestamp).getTime();
        if (diff < ONLINE_THRESHOLD) {
          isOnline = true;
        }
      }

      /* 🔥 FINAL FIX: RESPECT CLOCK-IN / CLOCK-OUT */
      const isTracking = emp.isTracking && isOnline;

      return {
        _id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,

        lastLocation,
        battery,
        networkQuality,

        isOnline,
        isTracking, // ✅ FINAL FIX
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
🛣 ROUTE HISTORY
========================================= */
const getRouteHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { date } = req.query;

    /* 🔥 FIX: IST → UTC RANGE */
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

    const formatted = logs.map(l => ({
      lat: l.lat,
      lng: l.lng,
      timestamp: l.timestamp,
    }));

    res.json({
      success: true,
      data: formatted,
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
