/**
 * Super Admin Controller — VIEW + DELETE ONLY 🚀
 */

const Company = require("../models/Company");

/* =========================================
   📥 GET ALL COMPANIES
========================================= */
const getCompanies = async (req, res) => {
  try {
    /* 🔒 ONLY SUPER ADMIN */
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin allowed",
      });
    }

    const companies = await Company.find({ isActive: true })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      companies,
    });

  } catch (error) {
    console.error("❌ GET COMPANIES ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   ❌ DELETE COMPANY (SOFT DELETE)
========================================= */
const deleteCompany = async (req, res) => {
  try {
    /* 🔒 ONLY SUPER ADMIN */
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.json({
      success: true,
      message: "Company deleted (soft delete)",
    });

  } catch (error) {
    console.error("❌ DELETE COMPANY ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/* =========================================
   🏢 GET COMPANY DETAILS (FOR LOGGED USER)
========================================= */
const getCompanyDetails = async (req, res) => {
  try {
    if (!req.user || !req.user.companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.json({
      success: true,
      name: company.name,          // ✅ IMPORTANT
      email: company.email,
      phone: company.phone,
      address: company.address,
    });

  } catch (error) {
    console.error("❌ GET COMPANY DETAILS ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getCompanies,
  deleteCompany,
  getCompanyDetails,
};