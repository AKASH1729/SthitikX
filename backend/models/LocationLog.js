/**
 * LocationLog Model
 * Stores GPS breadcrumbs for route tracking
 */

const mongoose = require('mongoose');

const locationLogSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // GeoJSON point for geospatial queries
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude] - GeoJSON order
      required: true,
    },
  },
  // Human-readable lat/lng for easy access
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  // Device accuracy in meters
  accuracy: { type: Number, default: null },
  // Speed in m/s (from GPS)
  speed: { type: Number, default: null },
  // Compass heading
  heading: { type: Number, default: null },
  // Date string for daily grouping
  date: { type: String, required: true, index: true },
  // Whether inside assigned geofence at this moment
  isInsideGeofence: { type: Boolean, default: true },
  // Attendance session reference
  attendance: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendance', 
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false, // Using custom timestamp field
});

// Geospatial index for location queries
locationLogSchema.index({ location: '2dsphere' });
locationLogSchema.index({ employee: 1, date: 1, timestamp: 1 });

// Static: Get movement history for an employee on a date
locationLogSchema.statics.getDailyRoute = async function (employeeId, date) {
  return this.find({ employee: employeeId, date })
    .sort({ timestamp: 1 })
    .select('lat lng timestamp isInsideGeofence speed accuracy');
};

// Static: Calculate total distance traveled (in km)
locationLogSchema.statics.calculateDistance = function (locations) {
  if (locations.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < locations.length; i++) {
    totalDistance += haversineDistance(
      locations[i - 1].lat, locations[i - 1].lng,
      locations[i].lat, locations[i].lng
    );
  }
  return parseFloat(totalDistance.toFixed(2));
};

/**
 * Haversine formula - calculates distance between two coordinates
 * @returns distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) { return deg * (Math.PI / 180); }

module.exports = mongoose.model('LocationLog', locationLogSchema);
