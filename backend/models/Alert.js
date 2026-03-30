/**
 * Alert Model
 * Stores geo-fence breach and other notifications
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
    enum: ['geofence_exit', 'geofence_entry', 'late_clockin', 'no_clockin', 'unusual_movement'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  location: {
    lat: Number,
    lng: Number,
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
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

alertSchema.index({ employee: 1, isRead: 1 });
alertSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Alert', alertSchema);
