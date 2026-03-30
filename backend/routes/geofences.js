const express = require('express');
const { getGeofences, createGeofence, updateGeofence, deleteGeofence } = require('../controllers/geofenceController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getGeofences);
router.post('/', authorize('admin'), createGeofence);
router.put('/:id', authorize('admin'), updateGeofence);
router.delete('/:id', authorize('admin'), deleteGeofence);

module.exports = router;
