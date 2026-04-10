const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/auth");

/* ================= GET EMPLOYEES ================= */
router.get("/employees", protect, async (req, res) => {
  try {
    const employees = await User.find({ role: "employee" })
      .select("name employeeId");

    res.json(employees);

  } catch (err) {
    console.error("EMPLOYEE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;