/**
 * Geofence Model
 * Defines circular work zones for geo-fencing
 */

const mongoose = require('mongoose');

const geofenceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Geofence name is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  // Center point of the geofence
  center: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  // Radius in meters
  radius: {
    type: Number,
    required: true,
    min: [50, 'Minimum radius is 50 meters'],
    max: [10000, 'Maximum radius is 10km'],
    default: 200,
  },
  address: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  color: {
    type: String,
    default: '#3B82F6', // Default blue
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

// Virtual: count of employees assigned to this geofence
geofenceSchema.virtual('employeeCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'assignedGeofence',
  count: true,
});

/**
 * Check if a point (lat, lng) is within this geofence
 * Uses Haversine formula
 */
geofenceSchema.methods.containsPoint = function (lat, lng) {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat - this.center.lat);
  const dLon = toRad(lng - this.center.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(this.center.lat)) * Math.cos(toRad(lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in meters
  return { isInside: distance <= this.radius, distance: Math.round(distance) };
};

function toRad(deg) { return deg * (Math.PI / 180); }

module.exports = mongoose.model('Geofence', geofenceSchema);
