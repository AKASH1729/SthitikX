/**
 * Alert Model (UPDATED - FLEXIBLE & PRODUCTION READY)
 */

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  type: {
    type: String,
    enum: [
      // ✅ New standard type
      'geofence-violation',

      // ✅ Existing types (kept for compatibility)
      'geofence_exit',
      'geofence_entry',
      'late_clockin',
      'no_clockin',
      'unusual_movement',

      // ✅ Extra useful types (future-ready)
      'manual_override',
      'system_alert'
    ],
    required: true,
  },

  message: {
    type: String,
    required: true,
  },

  location: {
    lat: { type: Number },
    lng: { type: Number },
  },

  geofence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Geofence',
  },

  isRead: {
    type: Boolean,
    default: false,
  },

  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },

  // ✅ optional metadata (VERY useful later)
  meta: {
    type: Object,
    default: {},
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },

}, {
  timestamps: true,
});

// ✅ Indexes (optimized for dashboard)
alertSchema.index({ employee: 1, isRead: 1 });
alertSchema.index({ timestamp: -1 });
alertSchema.index({ type: 1 });

module.exports = mongoose.model('Alert', alertSchema);