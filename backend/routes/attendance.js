/**
 * Attendance Routes — FINAL FIXED VERSION 🚀
 */

const express = require('express');
const {
  clockIn,
  clockOut,
  getTodayAttendance,
  getAttendance
} = require('../controllers/attendanceController');

const { protect, authorize } = require('../middleware/auth');
const checkPlan = require("../middleware/checkPlan");


const router = express.Router();

/* =========================
🔐 GLOBAL PROTECTION
========================= */
router.use(protect);
router.use(protect, checkPlan); 

/* =========================
   👤 EMPLOYEE ROUTES 
========================= */

// 🟢 Clock In
router.post(
  '/clock-in',
  authorize('employee'),
  clockIn
);

// 🔴 Clock Out
router.post(
  '/clock-out',
  authorize('employee'),
  clockOut
);

// 📅 Today Attendance
router.get(
  '/today',
  authorize('employee', 'admin', 'super_admin'),
  getTodayAttendance
);

/* =========================
   📊 SHARED ROUTE (IMPORTANT FIX)
========================= */

// 🔥 FIX: allow employee also
router.get(
  '/',
  authorize('employee', 'admin', 'super_admin'),
  getAttendance
);

/* =========================
   🔵 ADMIN ONLY ROUTES
========================= */

// 👤 Attendance by employee
router.get(
  '/employee/:id',
  authorize('admin'),
  getAttendance
);

// 📆 Date range filter
router.get(
  '/range',
  authorize('admin'),
  getAttendance
);

module.exports = router;