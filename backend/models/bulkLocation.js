const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    syncId: {
      type:   String,
      unique: true,
      sparse: true,   // sparse so null syncIds don't conflict
    },
    employeeId: {
      type:     String,
      required: true,
    },
    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Company",
      required: true,
    },
    deviceId: String,

    // GeoJSON — optional so heartbeats (no GPS) are accepted
    location: {
      type: {
        type:    String,
        enum:    ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
      },
    },

    // Flat coords for fast UI reads — optional for heartbeats
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },

    speed:          { type: Number, default: 0 },
    accuracy:       { type: Number, default: null },
    battery:        { type: Number, default: null },
    networkQuality: { type: String, default: "good" },

    // FIX: do NOT add "index: true" here — we declare it below via schema.index()
    // Having both causes the duplicate index Mongoose warning
    timestamp: {
      type:     Date,
      required: true,
    },
  },
  {
    timestamps: true,  // adds createdAt / updatedAt

    // Tell Mongoose not to auto-build indexes in production
    // (let your deploy script or Atlas handle it)
    autoIndex: process.env.NODE_ENV !== "production",
  }
);

/* ─── INDEXES ──────────────────────────────────────────────────────────────────
   Rule: declare every index ONCE here, never with "index: true" on the field.
   The duplicate warning comes from having both.
──────────────────────────────────────────────────────────────────────────────── */

// Primary query: history page, route playback
locationSchema.index({ companyId: 1, employeeId: 1, timestamp: -1 });

// Dashboard: recent data across company
locationSchema.index({ companyId: 1, timestamp: -1 });

// Single employee tracking
locationSchema.index({ employeeId: 1, timestamp: -1 });

// Geo queries (radius search, geofence checks)
locationSchema.index({ location: "2dsphere" });

// TTL: auto-delete records older than 30 days
// FIX: this is the ONLY timestamp index — no "index: true" on the field above
locationSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 }  // 30 days
);

module.exports = mongoose.model("bulkLocation", locationSchema);
