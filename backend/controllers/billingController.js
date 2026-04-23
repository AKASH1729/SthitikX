const Company = require("../models/Company");
const User = require("../models/User");

const getBilling = async (req, res) => {
  try {
    /* =========================
       🔐 VALIDATION
    ========================= */
    if (!req.user || !req.user.companyId) {
      return res.status(401).json({
        success: false,
        message: "No company context",
      });
    }

    /* =========================
       🏢 GET COMPANY
    ========================= */
    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    /* =========================
       👥 EMPLOYEE COUNT
    ========================= */
    const employeeCount = await User.countDocuments({
      companyId: company._id,
      role: "employee",
      isActive: true,
    });

    /* =========================
       💰 BILL CALCULATION (MODEL)
    ========================= */
    const bill = company.calculateBill(employeeCount);

    /* =========================
       ⏳ DAYS LEFT (MODEL)
    ========================= */
    const daysLeft = company.getDaysLeft();

    /* =========================
       🔔 EXTRA LIMIT WARNING
    ========================= */
    const isLimitExceeded =
      employeeCount > bill.maxAllowed;

    /* =========================
       📦 RESPONSE
    ========================= */
    res.json({
      success: true,

      /* PLAN INFO */
      plan: company.plan,

      /* EMPLOYEE INFO */
      employeeCount,
      baseEmployees: bill.baseEmployees,
      maxAllowed: bill.maxAllowed,

      /* BILLING */
      basePrice: bill.basePrice,
      extraEmployees: bill.extraEmployees,
      extraCost: bill.extraCost,
      total: bill.total,

      /* STATUS */
      daysLeft,
      isLimitExceeded,

      /* OPTIONAL FLAGS */
      isActive: company.isActive,
    });

  } catch (err) {
    console.error("🔥 BILLING ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Billing failed",
    });
  }
};

module.exports = { getBilling };
