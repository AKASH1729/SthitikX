/**
 * Employee Data Routes (Excel) — FINAL SaaS VERSION 🔥
 */

const express = require("express");
const EmployeeData = require("../models/EmployeeData");

const {
  protect,
  companyFilter
} = require("../middleware/auth");

const { param, query } = require("express-validator");
const { validate } = require("../middleware/validate");
const checkPlan = require("../middleware/checkPlan");


const xlsx = require("xlsx");

const router = express.Router();

/* =========================
🔐 GLOBAL SECURITY
========================= */
router.use(protect, companyFilter);


router.use(protect, checkPlan);
/* =========================
   📥 GET DATA (SAFE)
========================= */
router.get(
  "/",
  [
    query("userId").optional().isMongoId(),
  ],
  validate,
  async (req, res) => {
    try {
      let queryObj = {
        companyId: req.companyId, // 🔥 MUST
      };

      /* 🔒 EMPLOYEE */
      if (req.user.role === "employee") {
        queryObj.user = req.user._id;
      }

      /* 🔒 ADMIN FILTER */
      if (req.user.role === "admin" && req.query.userId) {
        queryObj.user = req.query.userId;
      }

      /* ❌ BLOCK SUPER ADMIN */
      if (req.user.role === "super_admin") {
        return res.status(403).json({
          message: "Super admin not allowed",
        });
      }

      const data = await EmployeeData.find(queryObj)
        .populate("user", "name email employeeId")
        .populate("uploadedBy", "name email")
        .sort({ uploadedAt: -1 })
        .lean();

      res.json({
        success: true,
        count: data.length,
        data,
      });

    } catch (err) {
      console.error("GET ERROR:", err);

      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);


/* =========================
   ⬇️ DOWNLOAD EXCEL (NO FILE SAVE 🔥)
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
        companyId: req.companyId, // 🔥 MUST
      }).lean();

      if (!record) {
        return res.status(404).json({
          message: "Record not found",
        });
      }

      /* 🔒 EMPLOYEE CHECK */
      if (
        req.user.role === "employee" &&
        record.user.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          message: "Unauthorized",
        });
      }

      /* ❌ BLOCK SUPER ADMIN */
      if (req.user.role === "super_admin") {
        return res.status(403).json({
          message: "Super admin not allowed",
        });
      }

      /* 🔥 CREATE EXCEL IN MEMORY (BEST PRACTICE) */
      const workbook = xlsx.utils.book_new();
      const sheet = xlsx.utils.json_to_sheet(record.data);

      xlsx.utils.book_append_sheet(workbook, sheet, "Data");

      const buffer = xlsx.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      const fileName = `${record.employeeId}_${Date.now()}.xlsx`;

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      return res.send(buffer);

    } catch (err) {
      console.error("DOWNLOAD ERROR:", err);

      res.status(500).json({
        message: "Download failed",
        error: err.message,
      });
    }
  }
);

module.exports = router;