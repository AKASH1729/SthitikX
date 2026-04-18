const LocationLog = require("../models/LocationLog");
const { generateTimeline } = require("../services/timelineService");

/* =========================================
   📊 GET TIMELINE (MULTI-TENANT SAFE 🔥)
========================================= */
const getTimeline = async (req, res) => {
  try {
    let { employeeId, date } = req.query;

    /* =========================
       🔒 EMPLOYEE RESTRICTION
    ========================= */
    if (req.user.role === "employee") {
      employeeId = req.user.employeeId;
    }

    /* =========================
       ❌ VALIDATION
    ========================= */
    if (!employeeId || !date) {
      return res.status(400).json({
        success: false,
        message: "employeeId and date are required",
      });
    }

    /* =========================
       🔥 MULTI-TENANT FILTER
    ========================= */
    const query = {
      employeeId,
      date,
      companyId: req.user.companyId, // 🔥 CRITICAL
    };

    /* =========================
       📦 FETCH LOGS
    ========================= */
    const logs = await LocationLog.find(query).sort({ timestamp: 1 });

    console.log("📍 LOG COUNT:", logs.length);

    if (!logs.length) {
      return res.json([]);
    }

    /* =========================
       🔥 GENERATE TIMELINE
    ========================= */
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