const express = require("express");
const EmployeeData = require("../models/EmployeeData");
const { protect, companyFilter } = require("../middleware/auth");
const checkPlan = require("../middleware/checkPlan");
const { param } = require("express-validator");
const { validate } = require("../middleware/validate");
const xlsx = require("xlsx");

const router = express.Router();

/* =========================
   🔐 MIDDLEWARE ORDER (FIXED)
========================= */
router.use(protect);
router.use(companyFilter);
router.use(checkPlan);

/* =========================
   📥 GET DATA
========================= */
router.get("/", async (req, res) => {
  try {
    let query = { companyId: req.companyId };

    if (req.user.role === "employee") {
      query.user = req.user._id;
    }

    const data = await EmployeeData.find(query)
      .populate("user", "name employeeId")
      .sort({ uploadedAt: -1 });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("GET ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   ⬇️ DOWNLOAD EXCEL (FINAL FIX)
========================= */
router.get(
  "/download/:id",
  [param("id").isMongoId()],
  validate,
  async (req, res) => {
    try {
      console.log("📥 DOWNLOAD REQUEST");
      console.log("ID:", req.params.id);
      console.log("USER:", req.user._id);
      console.log("REQ COMPANY:", req.companyId);

      /* 🔥 STEP 1: FIND WITHOUT COMPANY FILTER */
      const record = await EmployeeData.findById(req.params.id).lean();

      if (!record) {
        console.log("❌ Record not found in DB");
        return res.status(404).json({
          message: "Record not found",
        });
      }

      /* 🔥 STEP 2: COMPANY VALIDATION (CLEAR ERROR) */
      if (
        req.user.role !== "super_admin" &&
        String(record.companyId) !== String(req.companyId)
      ) {
        console.log("❌ COMPANY MISMATCH");
        console.log("Record company:", record.companyId);
        console.log("Request company:", req.companyId);

        return res.status(403).json({
          message: "Company mismatch",
        });
      }

      /* 🔒 EMPLOYEE ACCESS CHECK */
      if (
        req.user.role === "employee" &&
        record.user.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          message: "Unauthorized",
        });
      }

      /* 🔥 STEP 3: GENERATE EXCEL */
      const workbook = xlsx.utils.book_new();
      const sheet = xlsx.utils.json_to_sheet(record.data);
      xlsx.utils.book_append_sheet(workbook, sheet, "Data");

      const buffer = xlsx.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      const fileName = `${record.employeeId || "data"}_${Date.now()}.xlsx`;

      /* 🔥 STEP 4: RESPONSE HEADERS */
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );

      res.setHeader("Content-Length", buffer.length);

      /* 🔥 STEP 5: SEND FILE */
      return res.send(buffer);

    } catch (err) {
      console.error("❌ DOWNLOAD ERROR:", err);

      res.status(500).json({
        message: "Download failed",
        error: err.message,
      });
    }
  }
);

module.exports = router;
