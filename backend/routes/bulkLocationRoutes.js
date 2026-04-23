const express = require("express");
const router = express.Router();
const Location = require("../models/bulkLocation");

/* =========================================
   🔥 POST /bulk-location (APK SEND)
========================================= */
router.post("/", async (req, res) => {
  try {
    const { batch } = req.body;

    if (!Array.isArray(batch) || batch.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or empty batch",
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
          companyId: String(item.companyId), // 🔥 FIX
          deviceId: item.deviceId,

          location: {
            type: "Point",
            coordinates: [lng, lat], // 🔥 CRITICAL
          },

          // 🔥 ADD THESE (IMPORTANT)
          lat,
          lng,

          speed: item.speed || 0,
          accuracy: item.accuracy || null,
          battery: item.battery ?? -1,
          networkQuality: item.networkQuality || "good",

          timestamp: item.timestamp
            ? new Date(item.timestamp)
            : new Date(),
        };
      });

    if (!docs.length) {
      return res.status(400).json({
        success: false,
        message: "No valid locations",
      });
    }

    // 🔥 DUPLICATE SAFE INSERT
    await Location.bulkWrite(
      docs.map(doc => ({
        updateOne: {
          filter: { syncId: doc.syncId },
          update: { $setOnInsert: doc },
          upsert: true,
        }
      }))
    );

    console.log("✅ Inserted locations:", docs.length);

    return res.json({
      success: true,
      inserted: docs.length,
    });

  } catch (err) {
    console.error("❌ Bulk insert error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


/* =========================================
   📡 GET LIVE USERS (IMPORTANT)
========================================= */
router.get("/live/:companyId", async (req, res) => {
  try {
    const companyId = String(req.params.companyId);

    const logs = await Location.aggregate([
      { $match: { companyId } }, // 🔥 FIX
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$employeeId",
          doc: { $first: "$$ROOT" },
        },
      },
    ]);

    const now = Date.now();

    const employees = logs.map(l => {
      const log = l.doc;

      const diff = now - new Date(log.timestamp).getTime();

      return {
        employeeId: log.employeeId,
        lastLocation: {
          lat: log.lat,
          lng: log.lng,
          timestamp: log.timestamp,
        },
        battery: log.battery,
        networkQuality: log.networkQuality,
        isOnline: diff < 5 * 60 * 1000,
      };
    });

    return res.json({ success: true, employees });

  } catch (err) {
    console.error("❌ Live error:", err);
    res.status(500).json({ success: false });
  }
});


/* =========================================
   📍 GET LATEST LOCATION
========================================= */
router.get("/latest/:employeeId", async (req, res) => {
  try {
    const data = await Location.findOne({
      employeeId: req.params.employeeId,
    }).sort({ timestamp: -1 });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


/* =========================================
   🛣 ROUTE HISTORY
========================================= */
router.get("/history/:employeeId", async (req, res) => {
  try {
    const { from, to, companyId } = req.query;

    const data = await Location.find({
      employeeId: req.params.employeeId,
      companyId: String(companyId), // 🔥 FIX
      timestamp: {
        $gte: new Date(from),
        $lte: new Date(to),
      },
    }).sort({ timestamp: 1 });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
