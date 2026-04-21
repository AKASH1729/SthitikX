const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  syncId: { type: String, unique: true, sparse: true },

  employeeId: { type: String, index: true },
  companyId: { type: String, index: true },
  deviceId: String,

  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },

  speed: Number,
  accuracy: Number,
  battery: Number,
  networkQuality: String,

  timestamp: { type: Date, index: true },
}, { timestamps: true });

// Indexes
locationSchema.index({ location: "2dsphere" });
locationSchema.index({ employeeId: 1, timestamp: -1 });

module.exports = mongoose.model("Location", locationSchema);