/**
 * Timeline Routes — FINAL SaaS VERSION 🔥
 */

const express = require("express");
const { query } = require("express-validator");

const router = express.Router();

const { getTimeline } = require("../controllers/timelineController");

const {
  protect,
  authorize,
  companyFilter
} = require("../middleware/auth");

const { validate } = require("../middleware/validate");
const checkPlan = require("../middleware/checkPlan");


/* =========================
   🔐 GLOBAL SECURITY
========================= */
router.use(protect, companyFilter);


router.use(protect, checkPlan);
/* =========================
   🕒 GET TIMELINE
========================= */
router.get(
  "/",
  [
    query("employeeId").notEmpty().withMessage("Employee ID required"),
    query("date").notEmpty().withMessage("Date required"),
  ],
  validate,

  async (req, res, next) => {
    try {

      /* 🔒 EMPLOYEE RESTRICTION */
      if (req.user.role === "employee") {
        req.query.employeeId = req.user.employeeId;
      }

      /* ❌ BLOCK SUPER ADMIN */
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

  getTimeline
);

module.exports = router;