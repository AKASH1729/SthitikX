/**
 * Live Dashboard Routes — FINAL VERSION 🔥
 */

const express = require("express");
const router = express.Router();

const { getDashboard } = require("../controllers/livedashboardController");

const {
  protect,
  authorize,
  companyFilter
} = require("../middleware/auth");

/* =========================
   🔐 GLOBAL MIDDLEWARE
========================= */

router.use(
  protect,
  authorize("admin"), // 🔥 block employees
  companyFilter                      // 🔥 multi-tenant safety
);

/* =========================
   📊 DASHBOARD
========================= */

// 👉 GET /api/live-dashboard?date=YYYY-MM-DD
router.get("/", getDashboard);

/* =========================
   🔥 OPTIONAL (ADVANCED)
========================= */

// 👉 employee-wise dashboard
router.get("/employee/:id", getDashboard);

// 👉 date range dashboard
router.get("/range", getDashboard);

module.exports = router;