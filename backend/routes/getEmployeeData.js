/**
 * Employee Data Routes — FINAL SaaS VERSION 🔥
 */

const express = require("express");
const EmployeeData = require("../models/EmployeeData");
const { protect, authorize, companyFilter } = require("../middleware/auth");
const { param } = require("express-validator");
const { validate } = require("../middleware/validate");

const fs = require("fs");
const path = require("path");

const router = express.Router();

/* =========================
   🔐 GLOBAL SECURITY
========================= */
router.use(protect, companyFilter);


/* =========================
   📥 GET EMPLOYEE DATA
========================= */
router.get("/", async (req, res) => {
  try {
    let query = {
      companyId: req.companyId, // 🔥 multi-tenant safety
    };

    // 🔒 Employee → only their own data
    if (req.user.role === "employee") {
      query.employeeId = req.user.employeeId;
    }

    const data = await EmployeeData.find(query)
      .populate("user", "name email employeeId")
      .populate("uploadedBy", "name email")
      .sort({ uploadedAt: -1 })
      .lean();

    return res.status(200).json({ data });

  } catch (err) {
    console.error("GET DATA ERROR:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});


/* =========================
   ⬇️ DOWNLOAD FILE
========================= */
router.get(
  "/download/:id",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
  ],
  validate,
  async (req, res) => {
    try {

      const record = await EmployeeData.findOne({
        _id: req.params.id,
        companyId: req.companyId, // 🔥 prevent cross-company access
      });

      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }

      /* 🔒 EMPLOYEE SECURITY */
      if (
        req.user.role === "employee" &&
        record.employeeId !== req.user.employeeId
      ) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      /* 🔒 SAFE FILE PATH */
      const safeBase = path.join(__dirname, "..");
      const filePath = path.join(
        safeBase,
        record.filePath,
        record.fileName
      );

      // 🔥 Prevent path traversal attack
      if (!filePath.startsWith(safeBase)) {
        return res.status(400).json({
          message: "Invalid file path",
        });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          message: "File not found",
        });
      }

      return res.download(filePath, record.fileName);

    } catch (err) {
      console.error("DOWNLOAD ERROR:", err);
      return res.status(500).json({
        message: "Server error",
        error: err.message,
      });
    }
  }
);

module.exports = router;