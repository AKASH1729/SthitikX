const mongoose = require("mongoose");

const locationLogSchema = new mongoose.Schema(
  {
    /* ==============================
       👤 EMPLOYEE INFO
    ============================== */
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    employeeId: {
      type: String,
      required: true,
    },

    /* ==============================
       🏢 COMPANY (MULTI-TENANT)
    ============================== */
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    /* ==============================
       📍 GEO LOCATION (Mongo GeoJSON)
    ============================== */
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },

    lat: { type: Number, required: true },
    lng: { type: Number, required: true },

    /* ==============================
       📡 EXTRA LOCATION DATA
    ============================== */
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: null },

    /* ==============================
       📅 DATE INFO
    ============================== */
    date: { type: String, required: true },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    /* ==============================
       🔥 OFFLINE SYNC SUPPORT
    ============================== */
    deviceId: {
      type: String,
      required: true,
    },

    syncId: {
      type: String,
      required: true,
    },

    /* ==============================
       📶 NETWORK QUALITY (NEW)
    ============================== */
    networkQuality: {
      type: String,
      enum: ['good', 'weak', 'none'],
      default: 'good',
    },

    /* ==============================
       📍 GEOFENCE + ATTENDANCE
    ============================== */
    isInsideGeofence: {
      type: Boolean,
      default: true,
    },

    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
    },
  },
  {
    timestamps: false,
  }
);

/* ==============================
   🔥 INDEXES (PERFORMANCE + SAFETY)
============================== */

// 🌍 Geo index
locationLogSchema.index({ location: "2dsphere" });

// 🔥 Multi-tenant queries
locationLogSchema.index({
  companyId: 1,
  employeeId: 1,
  date: 1,
  timestamp: 1,
});

// 🔥 Fast latest location query
locationLogSchema.index({
  companyId: 1,
  employee: 1,
  timestamp: -1,
});

// 🔥 CRITICAL: Prevent duplicate sync
locationLogSchema.index(
  { syncId: 1 },
  { unique: true }
);

/* ==============================
   📌 GET DAILY ROUTE
============================== */
locationLogSchema.statics.getDailyRoute = async function (
  employeeId,
  date,
  companyId
) {
  return this.find({
    employeeId,
    date,
    companyId,
  })
    .sort({ timestamp: 1 })
    .select("lat lng timestamp speed accuracy isInsideGeofence");
};

/* ==============================
   📌 TOTAL DISTANCE
============================== */
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

/* ==============================
   📌 HAVERSINE DISTANCE
============================== */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km

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

module.exports = mongoose.model("LocationLog", locationLogSchema);
