const express = require('express');
const router = express.Router();

const {
  updateLocation,
  getLiveLocations,
  getRouteHistory
} = require('../controllers/locationController');

const { protect } = require('../middleware/auth');

/* =========================
   ROUTES
========================= */

// 🔥 Update location (called by employee)
router.post('/update', protect, updateLocation);

// 🔥 Get all employees live location (admin)
router.get('/live', protect, getLiveLocations);

// 🔥 Get movement history
router.get('/history/:employeeId', protect, getRouteHistory);

module.exports = router;