/**
 * Dashboard Routes — FINAL VERSION 🔥
 */

const express = require('express');
const router = express.Router();

const {
  getDashboardStats,
  getAlerts,
  markAlertRead
} = require('../controllers/dashboardController');

const {
  protect,
  authorize,
  companyFilter
} = require('../middleware/auth');

/* =========================
   🔐 GLOBAL MIDDLEWARE
========================= */

// 🔥 Protect + role + company isolation
router.use(
  protect,
  authorize('admin'),
  companyFilter
);

/* =========================
   📊 STATS
========================= */

// 👉 Dashboard summary
router.get('/stats', getDashboardStats);

/* =========================
   🚨 ALERTS
========================= */

// 👉 Get alerts (with pagination support)
router.get('/alerts', getAlerts);

// 👉 Mark alert as read
router.put('/alerts/:id/read', markAlertRead);

/* =========================
   🔥 OPTIONAL (ADVANCED)
========================= */

// 👉 Mark all alerts as read
router.put('/alerts/read-all', async (req, res) => {
  try {
    const Alert = require('../models/Alert');

    await Alert.updateMany(
      { companyId: req.companyId, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: "All alerts marked as read"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// 👉 Delete alert (soft delete)
router.delete('/alerts/:id', async (req, res) => {
  try {
    const Alert = require('../models/Alert');

    await Alert.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { isActive: false }
    );

    res.json({
      success: true,
      message: "Alert deleted"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;