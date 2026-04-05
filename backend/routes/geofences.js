const express = require('express');
const {
  getGeofences,
  createGeofence,
  updateGeofence,
  deleteGeofence,
  checkGeofence
} = require('../controllers/geofenceController');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// 🔐 Protect all routes
router.use(protect);

/* =========================================
   📍 GEOFENCE ROUTES (UNIQUE PREFIX)
========================================= */

// ✅ GET all geofences
router.get('/all', getGeofences);

// ✅ CREATE geofence (admin only)
router.post('/create', authorize('admin'), createGeofence);

// ✅ UPDATE geofence
router.put('/update/:id', authorize('admin'), updateGeofence);

// ✅ DELETE (soft delete)
router.delete('/delete/:id', authorize('admin'), deleteGeofence);

// ✅ CHECK geofence (IMPORTANT for frontend)
router.post('/check', checkGeofence);

module.exports = router;