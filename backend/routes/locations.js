const express = require('express');
const { updateLocation, getRouteHistory, getLiveLocations } = require('../controllers/locationController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/update', updateLocation);
router.get('/live', authorize('admin'), getLiveLocations);
router.get('/history/:employeeId', getRouteHistory);

module.exports = router; 
