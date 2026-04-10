// ✅ HAVERSINE DISTANCE (KM)
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

// ✅ SPEED → TYPE
const getType = (speed = 0) => {
  if (speed < 1) return "STOP";
  if (speed < 10) return "WALK";
  return "DRIVE";
};

// ✅ MAIN FUNCTION
exports.generateTimeline = (logs) => {
  let timeline = [];
  let current = null;

  const MIN_DISTANCE = 0.005; // 🔥 5 meters (important fix)
  const MIN_DURATION = 0;     // 🔥 don't filter small segments

  for (let i = 1; i < logs.length; i++) {
    const prev = logs[i - 1];
    const curr = logs[i];

    const type = getType(curr.speed || 0);

    const dist = haversine(
      prev.lat,
      prev.lng,
      curr.lat,
      curr.lng
    );

    // 🔥 ignore noise
    if (dist < MIN_DISTANCE && type !== "STOP") continue;

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

  // push last
  if (current) timeline.push(current);

  // format
  return timeline.map((t) => ({
    ...t,
    distance: Number(t.distance.toFixed(2)),
    duration: Math.round(
      (new Date(t.endTime) - new Date(t.startTime)) / 60000
    ),
  }));
};