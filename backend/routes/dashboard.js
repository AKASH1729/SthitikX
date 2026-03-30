const express = require('express');
const { getDashboardStats, getAlerts, markAlertRead } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/alerts', getAlerts);
router.put('/alerts/:id/read', markAlertRead);

module.exports = router;
