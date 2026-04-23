const LocationLog = require("../models/bulkLocation");
const { generateTimeline } = require("../services/timelineService");

/* =========================================
   📊 GET TIMELINE (FIXED TIMEZONE ✅)
========================================= */
const getTimeline = async (req, res) => {
  try {
    let { employeeId, date } = req.query;

    if (req.user.role === "employee") {
      employeeId = req.user.employeeId;
    }

    if (!employeeId || !date) {
      return res.status(400).json({
        success: false,
        message: "employeeId and date are required",
      });
    }

    /* 🔥 IST → UTC RANGE FIX */
    const start = new Date(`${date}T00:00:00+05:30`);
    const end = new Date(`${date}T23:59:59.999+05:30`);

    console.log("📅 DATE:", date);
    console.log("🕒 START:", start);
    console.log("🕒 END:", end);

    const query = {
      employeeId,
      companyId: String(req.user.companyId),
      timestamp: {
        $gte: start,
        $lte: end,
      },
    };

    const logs = await LocationLog.find(query).sort({ timestamp: 1 });

    console.log("📍 LOG COUNT:", logs.length);

    const timeline = logs.length ? generateTimeline(logs) : [];

    return res.status(200).json({
      success: true,
      data: timeline,
    });

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
