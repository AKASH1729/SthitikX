const Location = require("../models/bulkLocation");
const User = require("../models/User");

/* =========================================================
   POST /api/bulk-location
========================================================= */
const syncLocations = async (req, res) => {
  try {
    const { batch } = req.body;

    if (!Array.isArray(batch) || batch.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid batch" });
    }

    const companyId = req.user.companyId;

    // 🔥 FIX 1: allow heartbeat (lat/lng optional)
    const docs = batch
      .filter(i => i.employeeId)   // ❌ before: lat && lng
      .map(i => {
        const timestamp =
          i.timestamp && !isNaN(new Date(i.timestamp))
            ? new Date(i.timestamp)
            : new Date();

        // 🔋 normalize battery
        let battery = 0;
        if (typeof i.battery === "number") {
          battery =
            i.battery <= 1
              ? Math.round(i.battery * 100)
              : Math.round(i.battery);
        }

        return {
          syncId: i.syncId || `${i.employeeId}-${timestamp.getTime()}`,
          employeeId: i.employeeId,
          companyId,
          deviceId: i.deviceId,

          // allow missing GPS
          location: i.lat && i.lng
            ? {
                type: "Point",
                coordinates: [Number(i.lng), Number(i.lat)],
              }
            : undefined,

          lat: i.lat ?? null,
          lng: i.lng ?? null,

          speed: typeof i.speed === "number" ? i.speed : 0,
          accuracy: i.accuracy ?? null,
          battery,
          networkQuality: i.networkQuality || "good",
          timestamp,
        };
      });

    if (!docs.length) {
      return res.status(400).json({ success: false });
    }

    // ✅ Insert (dedupe)
    await Location.bulkWrite(
      docs.map(doc => ({
        updateOne: {
          filter: { syncId: doc.syncId },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    // 🔥 get latest per employee
    const latestMap = {};
    docs.forEach(doc => {
      if (
        !latestMap[doc.employeeId] ||
        new Date(doc.timestamp) > new Date(latestMap[doc.employeeId].timestamp)
      ) {
        latestMap[doc.employeeId] = doc;
      }
    });

    const latestDocs = Object.values(latestMap);

    // 🔥 FIX 2: update user safely (NO stale overwrite)
    await User.bulkWrite(
      latestDocs.map(doc => ({
        updateOne: {
          filter: {
            employeeId: doc.employeeId,
            $or: [
              { "lastLocation.timestamp": { $lt: doc.timestamp } },
              { "lastLocation.timestamp": { $exists: false } },
            ],
          },
          update: {
            $set: {
              ...(doc.lat && doc.lng
                ? {
                    lastLocation: {
                      lat: doc.lat,
                      lng: doc.lng,
                      timestamp: doc.timestamp,
                    },
                  }
                : {}), // 🔥 do not overwrite location if heartbeat

              battery: typeof doc.battery === "number" ? doc.battery : 0,
              speed: doc.speed ?? 0,
              networkQuality: doc.networkQuality || "good",
              isTracking: true,
              lastSeen: doc.timestamp, // 🔥 NEW (for heartbeat tracking)
            },
          },
        },
      })),
      { ordered: false }
    );

    // 🔥 FIX 3: socket emit (always)
    if (req.io) {
      latestDocs.forEach(doc => {
        req.io.to(companyId.toString()).emit("location:update", {
          employeeId: doc.employeeId,
          lat: doc.lat,
          lng: doc.lng,
          battery: typeof doc.battery === "number" ? doc.battery : 0,
          speed: doc.speed ?? 0,
          networkQuality: doc.networkQuality || "good",
          timestamp: doc.timestamp,
          isOnline: true,
        });
      });
    }

    console.log(`✅ Synced ${docs.length} locations`);
    res.json({ success: true });

  } catch (err) {
    console.error("❌ syncLocations:", err);
    res.status(500).json({ success: false });
  }
};


/* =========================================================
   GET /api/locations/live
========================================================= */
const getLiveLocations = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const now = Date.now();

    // 🔥 FIX 4: increase threshold for background
    const ONLINE_THRESHOLD = 10 * 60 * 1000; // 10 min

    const users = await User.find({
      companyId,
      role: "employee",
      isActive: true,
    })
      .select("name employeeId lastLocation battery speed networkQuality isTracking lastSeen")
      .lean();

    const employees = users.map(emp => {
      const ts =
        emp.lastLocation?.timestamp ||
        emp.lastSeen; // 🔥 fallback to heartbeat

      const diff = ts ? now - new Date(ts).getTime() : Infinity;
      const isOnline = diff < ONLINE_THRESHOLD;

      return {
        _id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        lastLocation: emp.lastLocation || null,
        battery: typeof emp.battery === "number" ? emp.battery : 0,
        speed: typeof emp.speed === "number" ? emp.speed : 0,
        networkQuality: emp.networkQuality || "good",
        isOnline,
        isTracking: !!(emp.isTracking && isOnline),
      };
    });

    res.json({ success: true, employees });

  } catch (err) {
    console.error("❌ getLiveLocations:", err);
    res.status(500).json({ success: false });
  }
};


/* =========================================================
   GET /api/locations/history/:employeeId
========================================================= */
const getRouteHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { date } = req.query;

    if (!employeeId || !date) {
      return res.status(400).json({
        success: false,
        message: "employeeId and date required",
      });
    }

    const start = new Date(date + "T00:00:00+05:30");
    const end   = new Date(date + "T23:59:59+05:30");

    const logs = await Location.find({
      employeeId,
      companyId: req.user.companyId,
      timestamp: { $gte: start, $lte: end },
    })
      .sort({ timestamp: 1 })
      .limit(3000)
      .lean();

    res.json({
      success: true,
      count: logs.length,
      data: logs.map(l => ({
        lat: l.lat,
        lng: l.lng,
        speed: l.speed ?? 0,
        battery: typeof l.battery === "number" ? l.battery : 0,
        timestamp: l.timestamp,
      })),
    });

  } catch (err) {
    console.error("❌ getRouteHistory:", err);
    res.status(500).json({ success: false });
  }
};

module.exports = {
  syncLocations,
  getLiveLocations,
  getRouteHistory,
};
