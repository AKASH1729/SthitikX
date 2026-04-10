const express = require('express');
const router = express.Router();

const {
  getDashboardStats,
  getAlerts,
  markAlertRead
} = require('../controllers/dashboardController');

const { protect, authorize } = require('../middleware/auth');

// middleware
router.use(protect, authorize('admin'));

// routes
router.get('/stats', getDashboardStats);
router.get('/alerts', getAlerts);
router.put('/alerts/:id/read', markAlertRead);

// ✅ THIS LINE FIXES YOUR ERROR
module.exports = router;