/**
 * Location Routes — FINAL (REAL-TIME + OFFLINE SYNC 🔥)
 */

const express = require("express");
const { param } = require("express-validator");

const {
  updateLocation,
  syncLocations, // 🔥 NEW
  getRouteHistory,
  getLiveLocations,
} = require("../controllers/locationController");

const {
  protect,
  authorize,
  companyFilter,
} = require("../middleware/auth");

const { validate } = require("../middleware/validate");
const checkPlan = require("../middleware/checkPlan");

const router = express.Router();

/* =========================
🔐 GLOBAL SECURITY (FIXED)
========================= */
// ❌ You used protect twice → remove duplicate
router.use(protect, companyFilter, checkPlan);

/* =========================
   📍 REAL-TIME LOCATION
========================= */
// 👉 Only employee can send live location
router.post(
  "/update",
  authorize("employee"),
  updateLocation
);

/* =========================
   🔥 OFFLINE SYNC (NEW)
========================= */
// 👉 Employee sends batch data when internet comes back
router.post(
  "/sync",
  authorize("employee"),
  syncLocations
);

/* =========================
   📡 LIVE LOCATIONS (ADMIN)
========================= */
router.get(
  "/live",
  authorize("admin"),
  getLiveLocations
);

/* =========================
   🛣 ROUTE HISTORY
========================= */
router.get(
  "/history/:employeeId",
  [
    param("employeeId")
      .notEmpty()
      .withMessage("Employee ID required"),
  ],
  validate,

  async (req, res, next) => {
    try {
      /* 🔒 Employee can only see their own */
      if (
        req.user.role === "employee" &&
        req.params.employeeId !== req.user.employeeId
      ) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized access",
        });
      }

      /* ❌ Block super admin */
      if (req.user.role === "super_admin") {
        return res.status(403).json({
          success: false,
          message: "Super admin not allowed",
        });
      }

      next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  },

  getRouteHistory
);

module.exports = router;