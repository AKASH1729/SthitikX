const Geofence = require('../models/Geofence');

/* =========================================
   📏 HAVERSINE DISTANCE FUNCTION
========================================= */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // meters
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* =========================================
   🧠 REUSABLE CHECK FUNCTION
========================================= */
const isInsideGeofence = async (lat, lng) => {
  const geofences = await Geofence.find({ isActive: true });

  for (const fence of geofences) {
    const distance = calculateDistance(
      lat,
      lng,
      fence.center.lat,
      fence.center.lng
    );

    if (distance <= fence.radius) {
      return {
        inside: true,
        geofence: fence,
      };
    }
  }

  return {
    inside: false,
    geofence: null,
  };
};

/* =========================================
   📥 GET ALL GEOFENCES
========================================= */
const getGeofences = async (req, res) => {
  try {
    const geofences = await Geofence.find({ isActive: true });

    res.json({
      success: true,
      geofences,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================================
   ➕ CREATE GEOFENCE
========================================= */
const createGeofence = async (req, res) => {
  try {
    const { name, description, center, radius, address, color } = req.body;

    const geofence = await Geofence.create({
      name,
      description,
      center,
      radius,
      address,
      color,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      geofence,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   ✏️ UPDATE GEOFENCE
========================================= */
const updateGeofence = async (req, res) => {
  try {
    const geofence = await Geofence.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!geofence) {
      return res.status(404).json({
        success: false,
        message: 'Geofence not found',
      });
    }

    res.json({
      success: true,
      geofence,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================================
   ❌ DELETE (SOFT DELETE)
========================================= */
const deleteGeofence = async (req, res) => {
  try {
    await Geofence.findByIdAndUpdate(req.params.id, {
      isActive: false,
    });

    res.json({
      success: true,
      message: 'Geofence deactivated',
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================================
   📍 CHECK GEOFENCE API
========================================= */
const checkGeofence = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and Longitude required",
      });
    }

    const result = await isInsideGeofence(lat, lng);

    res.json({
      success: true,
      inside: result.inside,
      geofence: result.geofence,
      message: result.inside
        ? "✅ Inside allowed area"
        : "❌ Outside geofence",
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================================
   📦 EXPORTS
========================================= */
module.exports = {
  getGeofences,
  createGeofence,
  updateGeofence,
  deleteGeofence,
  checkGeofence,
  isInsideGeofence, // 🔥 reusable for attendance
};