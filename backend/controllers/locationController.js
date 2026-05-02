/**
 * locationController.js
 *
 * CORE FIXES IN THIS VERSION:
 *
 * FIX A — getLiveLocations now pulls battery+speed from the LATEST Location
 *          ping document directly, not from the User document.
 *          This means even if the User.battery field is stale/null,
 *          the dashboard always shows the real latest value from Location history.
 *
 * FIX B — Battery Op A (always-write) correctly fires on every ping so
 *          User.battery stays fresh going forward.
 *
 * FIX C — Speed 0 is valid and stored/returned correctly (not filtered out).
 *
 * FIX D — isOnline uses lastSeen (updated on every ping) not lastLocation.timestamp
 *          so stationary employees with old GPS timestamps still show as online.
 *
 * FIX E — Socket emits the real battery value from the normalized doc.
 */

const Location = require("../models/bulkLocation");
const User     = require("../models/User");

// ─── Battery normalization ─────────────────────────────────────────────────────
// Handles Expo float 0.0–1.0 AND standard int 1–100.
// Returns null for 0, negative, >100, NaN, null, undefined.
const normalizeBattery = (raw) => {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (isNaN(n) || n < 0) return null;
  const val = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return val >= 1 && val <= 100 ? val : null;
};

/* =========================================================
   POST /api/bulk-location
   Receives location pings from mobile and stores them.
========================================================= */
const syncLocations = async (req, res) => {
  try {
    const { batch } = req.body;
    if (!Array.isArray(batch) || batch.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid or empty batch" });
    }

    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // ── Normalize docs ─────────────────────────────────────────────────────
    const docs = batch
      .filter(i => i?.employeeId)
      .map(i => {
        const timestamp =
          i.timestamp && !isNaN(new Date(i.timestamp))
            ? new Date(i.timestamp)
            : new Date();

        const battery = normalizeBattery(i.battery);

        // Speed 0 is valid — means stationary
        const speed =
          typeof i.speed === "number" && isFinite(i.speed) && i.speed >= 0
            ? Math.round(i.speed * 10) / 10
            : 0;

        const hasValidLocation =
          typeof i.lat === "number" && isFinite(i.lat) && i.lat !== 0 &&
          typeof i.lng === "number" && isFinite(i.lng) && i.lng !== 0;

        return {
          syncId:         i.syncId || `${i.employeeId}-${timestamp.getTime()}`,
          employeeId:     i.employeeId,
          companyId,
          deviceId:       i.deviceId || null,
          lat:            hasValidLocation ? i.lat  : null,
          lng:            hasValidLocation ? i.lng  : null,
          location:       hasValidLocation
            ? { type: "Point", coordinates: [Number(i.lng), Number(i.lat)] }
            : undefined,
          speed,
          accuracy:       typeof i.accuracy === "number" ? i.accuracy : null,
          battery,
          networkQuality: i.networkQuality || "good",
          timestamp,
        };
      });

    if (!docs.length) {
      return res.status(400).json({ success: false, message: "No valid records" });
    }

    // ── Insert location history (dedupe by syncId) ─────────────────────────
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

    // ── Get latest doc per employee ────────────────────────────────────────
    const latestMap = {};
    docs.forEach(doc => {
      const prev = latestMap[doc.employeeId];
      if (!prev || doc.timestamp > prev.timestamp) {
        latestMap[doc.employeeId] = doc;
      }
    });
    const latestDocs = Object.values(latestMap);

    // ── Update User — TWO ops per employee ────────────────────────────────
    //
    // Op A (no timestamp gate): ALWAYS writes battery, speed, networkQuality,
    //   isTracking, lastSeen. This is the key fix — battery is NEVER blocked
    //   by the GPS timestamp filter.
    //
    // Op B (timestamp-gated): Only writes lastLocation when this ping is newer
    //   than what's stored, preventing old queued pings from overwriting fresh GPS.
    //
    await User.bulkWrite(
      latestDocs.flatMap(doc => {
        const hasValidLocation = doc.lat !== null && doc.lng !== null;

        const opA = {
          updateOne: {
            filter: { employeeId: doc.employeeId, companyId },
            update: {
              $set: {
                // Speed 0 is valid — always write it
                speed:          doc.speed,
                networkQuality: doc.networkQuality,
                isTracking:     true,
                lastSeen:       doc.timestamp,
                // Battery: only write if real reading
                ...(typeof doc.battery === "number" &&
                    doc.battery >= 1 &&
                    doc.battery <= 100 && {
                  battery: doc.battery,
                }),
              },
            },
          },
        };

        const opB = hasValidLocation
          ? {
              updateOne: {
                filter: {
                  employeeId: doc.employeeId,
                  companyId,
                  $or: [
                    { "lastLocation.timestamp": { $lt: doc.timestamp } },
                    { "lastLocation.timestamp": { $exists: false } },
                  ],
                },
                update: {
                  $set: {
                    lastLocation: {
                      lat:       doc.lat,
                      lng:       doc.lng,
                      timestamp: doc.timestamp,
                    },
                  },
                },
              },
            }
          : null;

        return opB ? [opA, opB] : [opA];
      }),
      { ordered: false }
    );

    // ── Socket emit ────────────────────────────────────────────────────────
    if (req.io) {
      latestDocs.forEach(doc => {
        const hasValidLocation = doc.lat !== null && doc.lng !== null;
        req.io.to(companyId.toString()).emit("location:update", {
          employeeId:     doc.employeeId,
          lat:            doc.lat,
          lng:            doc.lng,
          // Send undefined (not 0/null) when battery invalid so frontend
          // preserves the last known good value
          battery:
            typeof doc.battery === "number" && doc.battery >= 1 && doc.battery <= 100
              ? doc.battery
              : undefined,
          // Speed 0 is valid — always emit it
          speed:          doc.speed,
          networkQuality: doc.networkQuality,
          timestamp:      doc.timestamp,
          isOnline:       hasValidLocation,
        });
      });
    }

    console.log(`✅ [bulkLocation] Synced ${docs.length} record(s)`);
    res.json({ success: true, count: docs.length });

  } catch (err) {
    console.error("❌ [syncLocations]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


/* =========================================================
   GET /api/locations/live

   FIX A: For each employee, we fetch the LATEST Location ping
   from the Location collection to get fresh battery + speed.
   This bypasses the stale User.battery field entirely.
   User document is only used for name, employeeId, lastLocation,
   isTracking, and lastSeen.
========================================================= */
const getLiveLocations = async (req, res) => {
  try {
    const companyId        = req.user?.companyId;
    const now              = Date.now();
    const ONLINE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get all active employees
    const users = await User.find({ companyId, role: "employee", isActive: true })
      .select("name employeeId lastLocation battery speed networkQuality isTracking lastSeen")
      .lean();

    if (!users.length) {
      return res.json({ success: true, employees: [], timestamp: new Date().toISOString() });
    }

    // FIX A: Get the latest Location ping for each employee in ONE aggregation
    // This gives us the freshest battery + speed + networkQuality directly from
    // the ping history, bypassing any stale values on the User document.
    const employeeIds = users.map(u => u.employeeId);

    const latestPings = await Location.aggregate([
      {
        $match: {
          employeeId: { $in: employeeIds },
          companyId,
        },
      },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id:            "$employeeId",
          battery:        { $first: "$battery" },
          speed:          { $first: "$speed" },
          networkQuality: { $first: "$networkQuality" },
          lat:            { $first: "$lat" },
          lng:            { $first: "$lng" },
          timestamp:      { $first: "$timestamp" },
        },
      },
    ]);

    // Map employeeId → latest ping data
    const pingMap = {};
    latestPings.forEach(p => { pingMap[p._id] = p; });

    const employees = users.map(emp => {
      const ping = pingMap[emp.employeeId];

      // Location: prefer ping coords if valid, fall back to User.lastLocation
      const pingHasCoords =
        ping &&
        typeof ping.lat === "number" && ping.lat !== 0 &&
        typeof ping.lng === "number" && ping.lng !== 0;

      const userHasCoords =
        typeof emp.lastLocation?.lat === "number" && emp.lastLocation.lat !== 0 &&
        typeof emp.lastLocation?.lng === "number" && emp.lastLocation.lng !== 0;

      const hasValidLocation = pingHasCoords || userHasCoords;

      const lastLocation = pingHasCoords
        ? { lat: ping.lat, lng: ping.lng, timestamp: ping.timestamp }
        : userHasCoords
          ? emp.lastLocation
          : null;

      // FIX D: Use lastSeen for online check (updated on every ping via Op A)
      // Fall back to ping.timestamp, then lastLocation.timestamp
      const ts   = emp.lastSeen || ping?.timestamp || emp.lastLocation?.timestamp;
      const diff = ts ? now - new Date(ts).getTime() : Infinity;

      const isOnline =
        emp.isTracking === true &&
        hasValidLocation &&
        diff < ONLINE_THRESHOLD;

      // FIX A: Use battery from latest ping first, fall back to User.battery
      const rawBattery = ping?.battery ?? emp.battery;
      const battery =
        typeof rawBattery === "number" && rawBattery >= 1 && rawBattery <= 100
          ? rawBattery
          : null;

      // FIX C: Speed 0 is valid. Use ping speed first, fall back to User.speed
      const rawSpeed = ping?.speed ?? emp.speed;
      const speed =
        typeof rawSpeed === "number" && rawSpeed >= 0
          ? rawSpeed
          : 0;

      const networkQuality = ping?.networkQuality || emp.networkQuality || "good";

      return {
        _id:            emp._id,
        name:           emp.name,
        employeeId:     emp.employeeId,
        lastLocation,
        battery,        // from latest ping — always fresh
        speed,          // from latest ping — 0 is valid
        networkQuality,
        isOnline,
        isTracking:     isOnline,
        lastSeen:       ts || null,
        lastPingTime:   ping?.timestamp || null,
      };
    });

    res.json({ success: true, employees, timestamp: new Date().toISOString() });

  } catch (err) {
    console.error("❌ [getLiveLocations]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


/* =========================================================
   GET /api/locations/history/:employeeId?date=YYYY-MM-DD
========================================================= */
const getRouteHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { date }       = req.query;

    if (!employeeId || !date) {
      return res.status(400).json({ success: false, message: "employeeId and date required" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "date must be YYYY-MM-DD" });
    }

    const start = new Date(`${date}T00:00:00+05:30`);
    const end   = new Date(`${date}T23:59:59+05:30`);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date" });
    }

    const logs = await Location.find({
      employeeId,
      companyId:  req.user.companyId,
      timestamp:  { $gte: start, $lte: end },
      lat:        { $ne: null, $nin: [0] },
      lng:        { $ne: null, $nin: [0] },
    })
      .sort({ timestamp: 1 })
      .limit(3000)
      .lean();

    res.json({
      success: true,
      date,
      count:   logs.length,
      data:    logs.map(l => ({
        lat:       l.lat,
        lng:       l.lng,
        // Speed 0 is valid
        speed:     typeof l.speed   === "number" && l.speed >= 0 ? l.speed : 0,
        battery:   typeof l.battery === "number" && l.battery >= 1 ? l.battery : null,
        timestamp: l.timestamp,
      })),
    });

  } catch (err) {
    console.error("❌ [getRouteHistory]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


module.exports = { syncLocations, getLiveLocations, getRouteHistory };
