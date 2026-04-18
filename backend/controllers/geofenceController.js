const Geofence = require('../models/Geofence');

/* =========================================
   📏 HAVERSINE DISTANCE
========================================= */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
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
   🧠 REUSABLE CHECK (MULTI-TENANT SAFE)
========================================= */
const isInsideGeofence = async (lat, lng, companyId) => {
  const geofences = await Geofence.find({
    isActive: true,
    companyId, // 🔥 FIX
  });

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

  return { inside: false, geofence: null };
};

/* =========================================
   📥 GET GEOFENCES
========================================= */
const getGeofences = async (req, res) => {
  try {
    const geofences = await Geofence.find({
      isActive: true,
      companyId: req.user.companyId, // 🔥 FIX
    });

    res.json({ success: true, geofences });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =========================================
   ➕ CREATE GEOFENCE (MAX 10KM)
========================================= */
const createGeofence = async (req, res) => {
  try {
    const { name, description, center, radius, address, color } = req.body;

    if (!center?.lat || !center?.lng) {
      return res.status(400).json({
        success: false,
        message: "Center coordinates required",
      });
    }

    if (radius > 10000) {
      return res.status(400).json({
        success: false,
        message: "Max radius is 10km (10000 meters)",
      });
    }

    const geofence = await Geofence.create({
      name,
      description,
      center,
      radius,
      address,
      color,
      createdBy: req.user._id,
      companyId: req.user.companyId, // 🔥 REQUIRED
    });

    res.status(201).json({ success: true, geofence });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================================
   ✏️ UPDATE GEOFENCE (SECURE)
========================================= */
const updateGeofence = async (req, res) => {
  try {
    if (req.body.radius && req.body.radius > 10000) {
      return res.status(400).json({
        success: false,
        message: "Max radius is 10km",
      });
    }

    const geofence = await Geofence.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.user.companyId, // 🔥 SECURITY
      },
      req.body,
      { new: true, runValidators: true }
    );

    if (!geofence) {
      return res.status(404).json({
        success: false,
        message: 'Geofence not found or unauthorized',
      });
    }

    res.json({ success: true, geofence });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =========================================
   ❌ DELETE (SOFT DELETE SAFE)
========================================= */
const deleteGeofence = async (req, res) => {
  try {
    const geofence = await Geofence.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.user.companyId,
      },
      { isActive: false },
      { new: true }
    );

    if (!geofence) {
      return res.status(404).json({
        success: false,
        message: 'Geofence not found or unauthorized',
      });
    }

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
   📍 CHECK GEOFENCE
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

    const result = await isInsideGeofence(
      lat,
      lng,
      req.user.companyId // 🔥 FIX
    );

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
   EXPORTS
========================================= */
module.exports = {
  getGeofences,
  createGeofence,
  updateGeofence,
  deleteGeofence,
  checkGeofence,
  isInsideGeofence,
};