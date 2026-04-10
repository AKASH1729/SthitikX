const LocationLog = require("../models/LocationLog");
const User = require("../models/User");
const Attendance = require("../models/Attendance");

/* ================= DISTANCE ================= */
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

const getDashboard = async (req, res) => {
  try {
    const { date } = req.query;

    const employees = await User.find({ role: "employee" })
      .select("_id name");

    let totalDistanceAll = 0;
    let totalTimeAll = 0;
    let motionTimeAll = 0;

    const table = [];

    for (const emp of employees) {

      /* ================= GET ATTENDANCE ================= */
      const attendance = await Attendance.findOne({
        employee: emp._id,
        date
      });

      if (!attendance || !attendance.clockIn) {
        table.push({
          name: emp.name,
          totalDistance: "0.00",
          totalTime: "0 min",
          motion: "0 min",
          rest: "0 min"
        });
        continue;
      }

      const startTime = new Date(attendance.clockIn.timestamp);
      const endTime = attendance.clockOut
        ? new Date(attendance.clockOut.timestamp)
        : new Date(); // if not clocked out

      /* ================= GET LOGS IN RANGE ================= */
      const logs = await LocationLog.find({
        employee: emp._id,
        timestamp: { $gte: startTime, $lte: endTime }
      }).sort({ timestamp: 1 });

      if (logs.length < 2) {
        table.push({
          name: emp.name,
          totalDistance: "0.00",
          totalTime: "0 min",
          motion: "0 min",
          rest: "0 min"
        });
        continue;
      }

      let distance = 0;
      let totalTime = 0;
      let motionTime = 0;

      for (let i = 1; i < logs.length; i++) {
        const prev = logs[i - 1];
        const curr = logs[i];

        const d = getDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        distance += d;

        let diff =
          (new Date(curr.timestamp) - new Date(prev.timestamp)) / 60000;

        /* 🔥 IGNORE BIG GAPS */
        if (diff > 5) continue;

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
        rest: `${Math.round(restTime)} min`
      });
    }

    const restTimeAll = totalTimeAll - motionTimeAll;

    res.json({
      totalDistance: totalDistanceAll.toFixed(2),
      totalTime: Math.round(totalTimeAll),
      motionTime: Math.round(motionTimeAll),
      restTime: Math.round(restTimeAll),
      table
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getDashboard };