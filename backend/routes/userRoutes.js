/**
 * Employee Routes — FINAL SaaS VERSION 🔥
 */

const express = require("express");
const router = express.Router();

const User = require("../models/User");

const {
  protect,
  authorize,
  companyFilter
} = require("../middleware/auth");
const checkPlan = require("../middleware/checkPlan");

/* =========================
🔐 GLOBAL SECURITY
========================= */
router.use(
  protect,
  authorize("admin"),   // ❌ block employee + super_admin
  companyFilter         // 🔥 multi-tenant safety
);
router.use(protect, checkPlan);
 
/* =========================
   👥 GET EMPLOYEES
========================= */
router.get("/employees", async (req, res) => {
  try {

    const employees = await User.find({
      role: "employee",
      companyId: req.companyId, // 🔥 isolate data
      isActive: true,
    })
      .select("name employeeId")
      .lean();

    res.json({
      success: true,
      count: employees.length,
      employees,
    });

  } catch (err) {
    console.error("EMPLOYEE ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;