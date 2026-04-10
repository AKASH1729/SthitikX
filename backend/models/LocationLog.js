/**
 * LocationLog Model (FINAL - PAGARGEO READY)
 */

const mongoose = require('mongoose');

const locationLogSchema = new mongoose.Schema({
  // 🔵 ObjectId reference (for populate)
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // 🟢 STRING ID (VERY IMPORTANT FOR YOUR SYSTEM)
  employeeId: {
    type: String,
    required: true,
    index: true,
  },

  // 🌍 GeoJSON point
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
  },

  // 📍 Easy access
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },

  // 📊 Sensors
  accuracy: { type: Number, default: null },
  speed: { type: Number, default: 0 },   // m/s
  heading: { type: Number, default: null },

  // 📅 Date grouping
  date: { type: String, required: true, index: true },

  // 🧭 Geofence
  isInsideGeofence: { type: Boolean, default: true },

  // 🧾 Attendance link
  attendance: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendance',
  },

  // ⏱ Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },

}, {
  timestamps: false,
});


// ==============================
// 📌 INDEXES
// ==============================
locationLogSchema.index({ location: '2dsphere' });
locationLogSchema.index({ employeeId: 1, date: 1, timestamp: 1 });


// ==============================
// 📌 GET DAILY ROUTE (FIXED)
// ==============================
locationLogSchema.statics.getDailyRoute = async function (employeeId, date) {
  return this.find({
    employeeId: employeeId,   // ✅ FIXED (was employee)
    date: date
  })
    .sort({ timestamp: 1 })
    .select('lat lng timestamp speed accuracy isInsideGeofence');
};


// ==============================
// 📌 TOTAL DISTANCE
// ==============================
locationLogSchema.statics.calculateDistance = function (locations) {
  if (locations.length < 2) return 0;

  let totalDistance = 0;

  for (let i = 1; i < locations.length; i++) {
    totalDistance += haversineDistance(
      locations[i - 1].lat,
      locations[i - 1].lng,
      locations[i].lat,
      locations[i].lng
    );
  }

  return parseFloat(totalDistance.toFixed(2));
};


// ==============================
// 📌 HAVERSINE FORMULA
// ==============================
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

module.exports = mongoose.model('LocationLog', locationLogSchema);