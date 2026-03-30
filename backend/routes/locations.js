const express = require('express');
const { updateLocation, getMovementHistory, getLiveLocations } = require('../controllers/locationController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/update', updateLocation);
router.get('/live', authorize('admin'), getLiveLocations);
router.get('/history/:employeeId', getMovementHistory);

module.exports = router;
