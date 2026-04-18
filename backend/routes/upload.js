const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

const EmployeeData = require("../models/EmployeeData");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

/* ==============================
   ✅ MULTER CONFIG
============================== */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/";

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

/* ==============================
   ✅ GET EMPLOYEES (MULTI-TENANT SAFE)
============================== */
router.get("/users", protect, async (req, res) => {
  try {
    const users = await User.find({
      role: "employee",
      companyId: req.user.companyId, // ✅ FIX
    }).select("_id name employeeId email");

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ==============================
   ✅ UPLOAD EXCEL (FULL FIX)
============================== */
router.post(
  "/upload-excel",
  protect,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const loggedInUser = req.user;

      let userId;

      if (loggedInUser.role === "admin") {
        userId = req.body.userId;

        if (!userId) {
          return res.status(400).json({
            message: "Select employee",
          });
        }
      } else {
        userId = loggedInUser._id;
      }

      const category = (req.body.category || "").toLowerCase();

      if (!category) {
        return res.status(400).json({
          message: "Category required",
        });
      }

      const userExists = await User.findById(userId);

      if (!userExists) {
        return res.status(400).json({
          message: "User not found",
        });
      }

      /* 🔒 MULTI-TENANT SECURITY */
      if (
        userExists.companyId.toString() !==
        loggedInUser.companyId.toString()
      ) {
        return res.status(403).json({
          message: "Unauthorized",
        });
      }

      /* ===== READ EXCEL ===== */
      const workbook = xlsx.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet);

      if (!rows.length) {
        return res.status(400).json({
          message: "Empty file",
        });
      }

      /* ===== SAVE ===== */
      const saved = await EmployeeData.create({
        employeeId: userExists.employeeId,
        category,
        user: userId,
        uploadedBy: loggedInUser._id,

        // ✅ REQUIRED FIXES
        companyId: loggedInUser.companyId,
        fileSize: req.file.size,
        fileType: req.file.mimetype,

        data: rows,
        fileName: req.file.filename,
        filePath: "uploads",
        uploadedAt: new Date(),
      });

      res.json({
        message: "Upload successful",
        count: rows.length,
        id: saved._id,
      });

    } catch (err) {
      console.error(err);

      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }

      res.status(500).json({
        message: err.message,
      });
    }
  }
);

module.exports = router;