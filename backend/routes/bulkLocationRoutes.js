const express = require("express");
const router = express.Router();
const Location = require("../models/bulkLocation");

// ✅ POST /bulk-location
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
      .map(item => ({
        syncId: item.syncId,
        employeeId: item.employeeId,
        companyId: item.companyId,
        deviceId: item.deviceId,

        location: {
          type: "Point",
          coordinates: [item.lng, item.lat],
        },

        speed: item.speed || 0,
        accuracy: item.accuracy || 0,
        battery: item.battery ?? -1,
        networkQuality: item.networkQuality || "unknown",

        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
      }));

    if (docs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid locations",
      });
    }

    await Location.insertMany(docs, { ordered: false });

    return res.json({
      success: true,
      inserted: docs.length,
    });

  } catch (err) {
    console.error("❌ Bulk insert error:", err.message);

    // Duplicate syncId (safe ignore)
    if (err.code === 11000) {
      return res.json({
        success: true,
        message: "Duplicates ignored",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


// ✅ GET latest location
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


// ✅ GET history
router.get("/history/:employeeId", async (req, res) => {
  try {
    const { from, to } = req.query;

    const data = await Location.find({
      employeeId: req.params.employeeId,
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