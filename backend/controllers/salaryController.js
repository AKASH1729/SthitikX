const Salary = require("../models/SalaryConfig"); // keep if correct
const User = require("../models/User");

const generateSalary = async (req, res) => {
  try {
    let {
      employeeId,
      month,
      totalCases,
      solvedCases,
      amountPerCase,

      penaltyPercent,
      penaltyAmountPerCase,

      incentiveTargetDate,
      incentiveAction,
      incentiveExtraPerCase,

      slabTargetDate,
      slabAction,
      slabExtraPay,
    } = req.body;

    /* ================= SAFE TYPE CAST ================= */
    totalCases = Number(totalCases) || 0;
    solvedCases = Number(solvedCases) || 0;
    amountPerCase = Number(amountPerCase) || 0;
    penaltyPercent = Number(penaltyPercent) || 0;
    penaltyAmountPerCase = Number(penaltyAmountPerCase) || 0;
    incentiveExtraPerCase = Number(incentiveExtraPerCase) || 0;
    slabExtraPay = Number(slabExtraPay) || 0;

    /* ================= VALIDATION ================= */
    if (!employeeId || !month) {
      return res.status(400).json({ message: "Employee & Month required" });
    }

    const employee = await User.findById(employeeId);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    /* ================= PERFORMANCE ================= */
    const performance =
      totalCases > 0 ? (solvedCases / totalCases) * 100 : 0;

    /* ================= CALCULATIONS ================= */
    const baseEarning = solvedCases * amountPerCase;
    const incentiveEarning = solvedCases * incentiveExtraPerCase;
    const slabEarning = slabExtraPay;

    let penaltyDeduction = 0;

    if (penaltyPercent > 0) {
      penaltyDeduction += (baseEarning * penaltyPercent) / 100;
    }

    if (penaltyAmountPerCase > 0) {
      penaltyDeduction += solvedCases * penaltyAmountPerCase;
    }

    const totalEarning =
      baseEarning + incentiveEarning + slabEarning - penaltyDeduction;

    /* ================= SAFE COMPANY ================= */
    const companyId = req.user?.company || req.user?.companyId || null;

    if (!companyId) {
      return res.status(400).json({
        message: "Company missing in token",
      });
    }

    /* ================= SAVE ================= */
    const salary = await Salary.create({
      employee: employeeId,
      company: companyId,

      month,
      totalCases,
      solvedCases,
      performance,
      amountPerCase,

      penalty: {
        percentage: penaltyPercent,
        amountPerCase: penaltyAmountPerCase,
      },

      incentive: {
        targetDate: incentiveTargetDate || null,
        action: incentiveAction || "",
        extraPerCase: incentiveExtraPerCase,
      },

      incentiveSlab: {
        targetDate: slabTargetDate || null,
        action: slabAction || "",
        extraPay: slabExtraPay,
      },

      totalEarning,
    });

    /* ================= RESPONSE ================= */
    res.status(201).json({
      success: true,
      message: "Salary generated successfully",
      data: salary,
      breakdown: {
        baseEarning,
        incentiveEarning,
        slabEarning,
        penaltyDeduction,
        totalEarning,
        performance,
      },
    });

  } catch (error) {
    console.error("🔥 SALARY ERROR:", error);

    res.status(500).json({
      message: "Error generating salary",
      error: error.message,
    });
  }
};

module.exports = {
  generateSalary,
};