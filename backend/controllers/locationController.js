/**
 * Location Controller
 * Real-time location updates and movement history
 */

const LocationLog = require('../models/LocationLog');
const User = require('../models/User');
const Geofence = require('../models/Geofence');
const Alert = require('../models/Alert');
const logger = require('../config/logger');

/**
 * @route   POST /api/locations/update
 * @desc    Employee sends location ping
 * @access  Private (Employee)
 */
const updateLocation = async (req, res) => {
  try {
    const { lat, lng, accuracy, speed, heading, attendanceId } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Check geofence status
    let isInsideGeofence = true;
    const user = await User.findById(req.user._id).populate('assignedGeofence');

    if (user.assignedGeofence) {
      const result = user.assignedGeofence.containsPoint(lat, lng);
      isInsideGeofence = result.isInside;

      // Fire alert if employee just left geofence
      if (!isInsideGeofence) {
        // Check last log to avoid duplicate alerts
        const lastLog = await LocationLog.findOne({ employee: req.user._id })
          .sort({ timestamp: -1 });

        if (!lastLog || lastLog.isInsideGeofence) {
          // Just exited - create alert
          const alert = await Alert.create({
            employee: req.user._id,
            type: 'geofence_exit',
            message: `${req.user.name} has left the assigned work area (${user.assignedGeofence.name})`,
            location: { lat, lng },
            geofence: user.assignedGeofence._id,
            severity: 'high',
          });

          // Broadcast alert to admins via Socket.io
          req.io.to('admins').emit('alert:geofence-exit', {
            alert,
            employee: { id: req.user._id, name: req.user.name },
            geofence: user.assignedGeofence.name,
          });

          logger.warn(`🚨 Geofence exit: ${req.user.name}`);
        }
      }
    }

    // Save location log
    const log = await LocationLog.create({
      employee: req.user._id,
      location: { type: 'Point', coordinates: [lng, lat] }, // GeoJSON: [lng, lat]
      lat,
      lng,
      accuracy,
      speed,
      heading,
      date: today,
      isInsideGeofence,
      attendance: attendanceId,
    });

    // Update user's last known location
    await User.findByIdAndUpdate(req.user._id, {
      lastLocation: { lat, lng, timestamp: new Date() },
    });

    // Broadcast live location to admins
    req.io.to('admins').emit('location:update', {
      employeeId: req.user._id,
      name: req.user.name,
      lat,
      lng,
      accuracy,
      speed,
      isInsideGeofence,
      timestamp: new Date(),
    });

    res.json({ success: true, log, isInsideGeofence });
  } catch (error) {
    logger.error(`Location update error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to update location.' });
  }
};

/**
 * @route   GET /api/locations/history/:employeeId
 * @desc    Get movement history for employee
 * @access  Private (Admin, or own employee)
 */
const getMovementHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { date } = req.query;

    // Employees can only see their own history
    if (req.user.role === 'employee' && req.user._id.toString() !== employeeId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const locations = await LocationLog.getDailyRoute(employeeId, targetDate);
    const distance = LocationLog.calculateDistance(locations);

    res.json({
      success: true,
      locations,
      stats: {
        totalPoints: locations.length,
        distanceKm: distance,
        date: targetDate,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   GET /api/locations/live
 * @desc    Get all employees' live locations (admin only)
 * @access  Private (Admin)
 */
const getLiveLocations = async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee', isActive: true })
      .select('name email employeeId department lastLocation isTracking avatar')
      .populate('assignedGeofence', 'name center radius');

    res.json({ success: true, employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { updateLocation, getMovementHistory, getLiveLocations };
