const express = require("express");
const EmployeeData = require("../models/EmployeeData");
const { protect } = require("../middleware/auth");
const fs = require("fs");
const path = require("path");

const router = express.Router();


// ==============================
// ✅ GET EMPLOYEE DATA (FINAL)
// ==============================
router.get("/", protect, async (req, res) => {
  try {
    let query = {};

    // 🔒 Employee → only their own data
    if (req.user.role === "employee") {
      query.employeeId = req.user.employeeId;
    }

    const data = await EmployeeData.find(query)
      .populate("user", "name email employeeId")        // 👈 data owner
      .populate("uploadedBy", "name email")             // 👈 uploader
      .sort({ uploadedAt: -1 });

    return res.status(200).json({ data });

  } catch (err) {
    console.error("GET DATA ERROR:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});


// ==============================
// ✅ DOWNLOAD FILE (FINAL)
// ==============================
router.get("/download/:id", protect, async (req, res) => {
  try {
    console.log("👉 Requested ID:", req.params.id);

    const record = await EmployeeData.findById(req.params.id);

    // ❌ Not found
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    console.log("✅ Record Found:", record._id);

    // 🔒 Authorization (FIXED)
    if (
      req.user.role === "employee" &&
      record.employeeId !== req.user.employeeId
    ) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    // ✅ Correct file path
    const filePath = path.join(
      __dirname,
      "..",
      record.filePath,
      record.fileName
    );

    console.log("📁 File Path:", filePath);

    // ❌ File missing
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: "File not found on server",
      });
    }

    console.log("⬇️ Download starting...");

    // ✅ Download
    return res.download(filePath, record.fileName, (err) => {
      if (err) {
        console.error("❌ DOWNLOAD ERROR:", err);

        if (!res.headersSent) {
          return res.status(500).json({
            message: "Download failed",
            error: err.message,
          });
        }
      }
    });

  } catch (err) {
    console.error("❌ DOWNLOAD ROUTE ERROR:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

module.exports = router;