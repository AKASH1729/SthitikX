const express = require("express");
const {
  getCompanies,
  deleteCompany,
  getCompanyDetails,
} = require("../controllers/superAdminController");

const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

/* =========================================
   🏢 COMPANY DETAILS (FOR ALL LOGGED USERS)
========================================= */
router.get("/details", protect, getCompanyDetails); // ✅ IMPORTANT FIX

/* =========================================
   🔒 SUPER ADMIN ONLY
========================================= */
router.use(protect, authorize("super_admin" ));

/* 📥 VIEW */
router.get("/companies", getCompanies );

/* ❌ DELETE */
router.delete("/companies/:id", deleteCompany);

module.exports = router;