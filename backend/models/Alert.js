const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // 🔥 ADD THIS (MOST IMPORTANT)
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },

  type: {
    type: String,
    enum: [
      'geofence-violation',
      'geofence_exit',
      'geofence_entry',
      'late_clockin',
      'no_clockin',
      'unusual_movement',
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

// 🔥 UPDATED INDEXES (company-based)
alertSchema.index({ companyId: 1, isRead: 1 });
alertSchema.index({ companyId: 1, timestamp: -1 });
alertSchema.index({ companyId: 1, type: 1 });

module.exports = mongoose.model('Alert', alertSchema);