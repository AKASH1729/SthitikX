const express = require("express");
const router = express.Router();

const {
  generateSalary,
} = require("../controllers/salaryController");

const {
  protect,
  authorize,
  companyFilter,
} = require("../middleware/auth");

const checkPlan = require("../middleware/checkPlan");

/* =========================
🔐 GLOBAL SECURITY
========================= */
router.use(protect, companyFilter, checkPlan);

/* =========================
   💰 GENERATE SALARY SLIP
========================= */
/*
👉 ONLY ADMIN (IMPORTANT FIX)
*/
router.post(
  "/generate",
  authorize("admin"),
  generateSalary
); 


module.exports = router;