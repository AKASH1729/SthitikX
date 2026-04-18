/**
 * Timeline Service — FINAL VERSION 🔥
 */

// ================= DISTANCE =================
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// ================= TYPE DETECTION =================
const getType = (speed = 0, distance = 0) => {
  // 🔥 fallback if speed missing
  if (speed === 0 && distance < 0.01) return "STOP";

  if (speed < 1) return "STOP";
  if (speed < 10) return "WALK";
  return "DRIVE";
};

// ================= MAIN =================
exports.generateTimeline = (logs) => {
  if (!logs || logs.length < 2) return [];

  let timeline = [];
  let current = null;

  const MIN_DISTANCE = 0.005; // 5 meters
  const MAX_TIME_GAP = 5;     // minutes

  for (let i = 1; i < logs.length; i++) {
    const prev = logs[i - 1];
    const curr = logs[i];

    const dist = haversine(
      prev.lat,
      prev.lng,
      curr.lat,
      curr.lng
    );

    const timeDiff =
      (new Date(curr.timestamp) - new Date(prev.timestamp)) / 60000;

    const type = getType(curr.speed || 0, dist);

    // 🔥 ignore GPS noise
    if (dist < MIN_DISTANCE && type !== "STOP") continue;

    // 🔥 break segment if large time gap
    if (timeDiff > MAX_TIME_GAP) {
      if (current) {
        timeline.push(current);
        current = null;
      }
      continue;
    }

    // 🔥 new segment
    if (!current || current.type !== type) {
      if (current) timeline.push(current);

      current = {
        type,
        startTime: prev.timestamp,
        endTime: curr.timestamp,
        distance: 0,
        points: [[prev.lat, prev.lng]],
      };
    }

    current.endTime = curr.timestamp;
    current.distance += dist;
    current.points.push([curr.lat, curr.lng]);
  }

  if (current) timeline.push(current);

  // ================= CLEAN + FORMAT =================
  return timeline
    .map((t) => ({
      ...t,
      distance: Number(t.distance.toFixed(2)),
      duration: Math.max(
        1,
        Math.round(
          (new Date(t.endTime) - new Date(t.startTime)) / 60000
        )
      ),
    }))
    .filter((t) => t.duration > 0);
};