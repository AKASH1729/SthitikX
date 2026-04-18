const Company = require("../models/Company");

const checkPlan = async (req, res, next) => {
  try {
    // ✅ super admin bypass
    if (req.user.role === "super_admin") return next();

    const company = await Company.findById(req.user.companyId);

    if (!company || !company.isActive) {
      return res.status(403).json({
        message: "Company inactive",
      });
    }

    const now = new Date();

    let expired = false;

    if (company.plan === "trial") {
      expired =
        !company.trialExpiresAt ||
        company.trialExpiresAt < now;
    } else {
      expired =
        !company.subscriptionExpiresAt ||
        company.subscriptionExpiresAt < now;
    }

    if (expired) {
      return res.status(403).json({
        message: "Plan expired. Upgrade required.",
        planExpired: true,
      });
    }

    next();

  } catch (err) {
    res.status(500).json({ message: "Plan check failed" });
  }
};

module.exports = checkPlan;