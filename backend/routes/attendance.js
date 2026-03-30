const express = require('express');
const { clockIn, clockOut, getTodayAttendance, getAttendance } = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);
router.get('/today', getTodayAttendance);
router.get('/', getAttendance);

module.exports = router;
