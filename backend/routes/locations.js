const express = require("express");
const { param } = require("express-validator");

const {
  syncLocations,
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
🔥 BULK SYNC (PROTECTED)
========================= */
router.post(
  "/sync",
  protect,
  companyFilter,
  checkPlan,
  authorize("employee"),
  syncLocations
);

/* =========================
📡 LIVE LOCATIONS (PUBLIC FIX)
========================= */
router.get(
  "/live",
  protect,        // 🔥 REQUIRED
  companyFilter,  // 🔥 REQUIRED
  getLiveLocations
);
/* =========================
🛣 ROUTE HISTORY (PROTECTED)
========================= */
router.get(
  "/history/:employeeId",
  protect,
  companyFilter,
  checkPlan,

  [
    param("employeeId")
      .notEmpty()
      .withMessage("Employee ID required"),
  ],
  validate,

  async (req, res, next) => {
    if (
      req.user.role === "employee" &&
      req.params.employeeId !== req.user.employeeId
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (req.user.role === "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Not allowed",
      });
    }

    next();
  },

  getRouteHistory
);

module.exports = router;
