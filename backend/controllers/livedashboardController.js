const LocationLog = require("../models/bulkLocation"); // or bulkLocation if that's your actual model
const User = require("../models/User");
const Attendance = require("../models/Attendance");

/* ================= DISTANCE (KM) ================= */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ================= DASHBOARD ================= */
const getDashboard = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    const companyId = String(req.user.companyId);

    /* 🔥 GET EMPLOYEES */
    const employees = await User.find({
      role: "employee",
      companyId,
      isActive: true,
    }).select("_id name employeeId");

    let totalDistanceAll = 0;
    let totalTimeAll = 0;
    let motionTimeAll = 0;

    const table = [];

    /* ================= LOOP EMPLOYEES ================= */
    for (const emp of employees) {

      /* 🔥 ATTENDANCE */
      const attendance = await Attendance.findOne({
        employee: emp._id,
        companyId,
        date, // already "YYYY-MM-DD"
      });

      if (!attendance || !attendance.clockIn?.timestamp) {
        table.push({
          name: emp.name,
          totalDistance: "0.00",
          totalTime: "0 min",
          motion: "0 min",
          rest: "0 min",
        });
        continue;
      }

      const startTime = new Date(attendance.clockIn.timestamp);
      const endTime = attendance.clockOut?.timestamp
        ? new Date(attendance.clockOut.timestamp)
        : new Date();

      /* 🔥 LOCATION LOGS (FIXED) */
      const logs = await LocationLog.find({
        employeeId: emp.employeeId,              // ✅ FIX
        companyId,                               // ✅ STRING MATCH
        timestamp: { $gte: startTime, $lte: endTime },
      }).sort({ timestamp: 1 });

      if (logs.length < 2) {
        table.push({
          name: emp.name,
          totalDistance: "0.00",
          totalTime: "0 min",
          motion: "0 min",
          rest: "0 min",
        });
        continue;
      }

      let distance = 0;
      let totalTime = 0;
      let motionTime = 0;

      /* ================= CALCULATE ================= */
      for (let i = 1; i < logs.length; i++) {
        const prev = logs[i - 1];
        const curr = logs[i];

        // 🔥 HANDLE BOTH STRUCTURES
        const prevLat = prev.lat ?? prev.location?.coordinates?.[1];
        const prevLng = prev.lng ?? prev.location?.coordinates?.[0];

        const currLat = curr.lat ?? curr.location?.coordinates?.[1];
        const currLng = curr.lng ?? curr.location?.coordinates?.[0];

        if (!prevLat || !prevLng || !currLat || !currLng) continue;

        const d = getDistance(prevLat, prevLng, currLat, currLng);
        distance += d;

        const diff =
          (new Date(curr.timestamp) - new Date(prev.timestamp)) / 60000;

        /* 🔥 IGNORE BAD DATA (GPS GAP) */
        if (diff <= 0 || diff > 5) continue;

        totalTime += diff;

        /* 🔥 MOTION DETECTION */
        if (d > 0.01) {
          motionTime += diff;
        }
      }

      const restTime = totalTime - motionTime;

      totalDistanceAll += distance;
      totalTimeAll += totalTime;
      motionTimeAll += motionTime;

      table.push({
        name: emp.name,
        totalDistance: distance.toFixed(2),
        totalTime: `${Math.round(totalTime)} min`,
        motion: `${Math.round(motionTime)} min`,
        rest: `${Math.round(restTime)} min`,
      });
    }

    const restTimeAll = totalTimeAll - motionTimeAll;

    /* ================= RESPONSE ================= */
    res.json({
      success: true,
      totalDistance: totalDistanceAll.toFixed(2),
      totalTime: Math.round(totalTimeAll),
      motionTime: Math.round(motionTimeAll),
      restTime: Math.round(restTimeAll),
      table,
    });

  } catch (err) {
    console.error("❌ Dashboard Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = { getDashboard };
