const Company = require("../models/Company");
const User = require("../models/User");

const getBilling = async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);

    const employeeCount = await User.countDocuments({
      companyId: req.user.companyId,
      role: "employee",
    });

    const bill = company.calculateBill(employeeCount);

    res.json({
      success: true,
      plan: company.plan,
      ...bill,
    });

  } catch (err) {
    res.status(500).json({ message: "Billing failed" });
  }
};

module.exports = { getBilling };