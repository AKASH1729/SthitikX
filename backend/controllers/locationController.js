const Location = require("../models/bulkLocation");
const User     = require("../models/User");

/* =========================================================
   BATTERY HELPERS
========================================================= */

/**
 * Normalize a raw battery value to an integer 1–100, or null.
 * Handles both 0–1 float (mobile) and 0–100 int formats.
 * Returns null if invalid, missing, or zero.
 */
const normalizeBattery = (raw) => {
  if (typeof raw !== "number" || isNaN(raw)) return null;
  const val = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
  return val > 0 && val <= 100 ? val : null;
};

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

    // ── Normalize + validate incoming data ────────────────────────────────────
    const docs = batch
      .filter(i => i.employeeId)
      .map(i => {
        const timestamp =
          i.timestamp && !isNaN(new Date(i.timestamp))
            ? new Date(i.timestamp)
            : new Date();

        // ✅ BATTERY FIX: normalize → null if 0 or invalid
        const battery = normalizeBattery(i.battery);

        // ✅ SPEED FIX: safe parse
        const speed =
          typeof i.speed === "number" && i.speed >= 0
            ? Math.round(i.speed)
            : 0;

        // ✅ GPS VALIDATION
        const hasValidLocation =
          typeof i.lat === "number" &&
          typeof i.lng === "number" &&
          i.lat !== 0 &&
          i.lng !== 0;

        return {
          syncId:         i.syncId || `${i.employeeId}-${timestamp.getTime()}`,
          employeeId:     i.employeeId,
          companyId,
          deviceId:       i.deviceId,

          location: hasValidLocation
            ? { type: "Point", coordinates: [Number(i.lng), Number(i.lat)] }
            : undefined,

          lat:            hasValidLocation ? i.lat  : null,
          lng:            hasValidLocation ? i.lng  : null,
          speed,
          accuracy:       i.accuracy ?? null,
          battery,                          // null or valid 1–100 int
          networkQuality: i.networkQuality || "good",
          timestamp,
        };
      });

    if (!docs.length) {
      return res.status(400).json({ success: false, message: "No valid docs" });
    }

    // ── Insert with syncId deduplication ─────────────────────────────────────
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

    // ── Get latest doc per employee ───────────────────────────────────────────
    const latestMap = {};
    docs.forEach(doc => {
      const prev = latestMap[doc.employeeId];
      if (!prev || new Date(doc.timestamp) > new Date(prev.timestamp)) {
        latestMap[doc.employeeId] = doc;
      }
    });
    const latestDocs = Object.values(latestMap);

    // ── Update User document ──────────────────────────────────────────────────
    await User.bulkWrite(
      latestDocs.map(doc => {
        const hasValidLocation =
          typeof doc.lat === "number" &&
          typeof doc.lng === "number";

        const updateFields = {
          speed:          doc.speed ?? 0,
          networkQuality: doc.networkQuality || "good",
          isTracking:     true,
          lastSeen:       doc.timestamp,
        };

        // ✅ BATTERY FIX: only write to DB if valid (never overwrite good value with 0/null)
        if (typeof doc.battery === "number" && doc.battery > 0 && doc.battery <= 100) {
          updateFields.battery = doc.battery;
        }

        // Only update location if GPS is valid
        if (hasValidLocation) {
          updateFields.lastLocation = {
            lat:       doc.lat,
            lng:       doc.lng,
            timestamp: doc.timestamp,
          };
        }

        return {
          updateOne: {
            filter: {
              employeeId: doc.employeeId,
              $or: [
                { "lastLocation.timestamp": { $lt: doc.timestamp } },
                { "lastLocation.timestamp": { $exists: false } },
              ],
            },
            update: { $set: updateFields },
          },
        };
      }),
      { ordered: false }
    );

    // ── Socket emit ───────────────────────────────────────────────────────────
    if (req.io) {
      latestDocs.forEach(doc => {
        const hasValidLocation =
          typeof doc.lat === "number" &&
          typeof doc.lng === "number";

        req.io.to(companyId.toString()).emit("location:update", {
          employeeId:     doc.employeeId,
          lat:            doc.lat,
          lng:            doc.lng,
          // ✅ BATTERY FIX: send only valid battery, otherwise undefined (not 0)
          battery:        typeof doc.battery === "number" && doc.battery > 0
                            ? doc.battery
                            : undefined,
          speed:          doc.speed ?? 0,
          networkQuality: doc.networkQuality || "good",
          timestamp:      doc.timestamp,
          isOnline:       hasValidLocation,
        });
      });
    }

    console.log(`✅ Synced ${docs.length} locations for company ${companyId}`);
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
    const companyId      = req.user.companyId;
    const now            = Date.now();
    const ONLINE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

    const users = await User.find({
      companyId,
      role:     "employee",
      isActive: true,
    })
      .select("name employeeId lastLocation battery speed networkQuality isTracking lastSeen")
      .lean();

    const employees = users.map(emp => {
      const hasValidLocation =
        typeof emp.lastLocation?.lat === "number" &&
        typeof emp.lastLocation?.lng === "number";

      const ts   = emp.lastLocation?.timestamp || emp.lastSeen;
      const diff = ts ? now - new Date(ts).getTime() : Infinity;

      const isOnline =
        emp.isTracking &&
        diff < ONLINE_THRESHOLD &&
        hasValidLocation;

      // ✅ BATTERY FIX: only expose valid battery — never 0
      const battery =
        typeof emp.battery === "number" && emp.battery > 0 && emp.battery <= 100
          ? emp.battery
          : null;

      // ✅ SPEED FIX: safe default
      const speed =
        typeof emp.speed === "number" && emp.speed >= 0
          ? emp.speed
          : 0;

      return {
        _id:            emp._id,
        name:           emp.name,
        employeeId:     emp.employeeId,
        lastLocation:   emp.lastLocation || null,
        battery,
        speed,
        networkQuality: emp.networkQuality || "good",
        isOnline,
        isTracking:     emp.isTracking && isOnline,
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
    const { date }       = req.query;

    if (!employeeId || !date) {
      return res.status(400).json({
        success: false,
        message: "employeeId and date required",
      });
    }

    const start = new Date(date + "T00:00:00+05:30");
    const end   = new Date(date + "T23:59:59+05:30");

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    const logs = await Location.find({
      employeeId,
      companyId: req.user.companyId,
      timestamp: { $gte: start, $lte: end },
      lat:       { $ne: null },
      lng:       { $ne: null },
    })
      .sort({ timestamp: 1 })
      .limit(3000)
      .lean();

    res.json({
      success: true,
      count:   logs.length,
      data:    logs.map(l => ({
        lat:       l.lat,
        lng:       l.lng,
        speed:     typeof l.speed === "number"   ? l.speed   : 0,
        // ✅ BATTERY FIX: never return 0 from history either
        battery:   typeof l.battery === "number" && l.battery > 0 ? l.battery : null,
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
