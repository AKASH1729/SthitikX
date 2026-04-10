const LocationLog = require("../models/LocationLog");
const { generateTimeline } = require("../services/timelineService");

/* =========================================
   📊 GET TIMELINE
========================================= */
const getTimeline = async (req, res) => {
  try {
    let { employeeId, date } = req.query;

    // 🔒 employee restriction
    if (req.user.role === "employee") {
      employeeId = req.user.employeeId;
    }

    // ❌ validation
    if (!employeeId || !date) {
      return res.status(400).json({
        success: false,
        message: "employeeId and date are required",
      });
    }

    // 📦 fetch logs
    const logs = await LocationLog.find({
      employeeId,
      date,
    }).sort({ timestamp: 1 });

    console.log("📍 LOG COUNT:", logs.length);

    if (!logs.length) {
      return res.json([]);
    }

    // 🔥 generate timeline
    const timeline = generateTimeline(logs);

    console.log("🔥 TIMELINE:", timeline);

    return res.status(200).json(timeline);

  } catch (error) {
    console.error("❌ TIMELINE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getTimeline,
};