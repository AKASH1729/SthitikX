const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");

const EmployeeData = require("../models/EmployeeData");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

/* ==============================
   ✅ MULTER CONFIG (5MB LIMIT)
============================== */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // ✅ 5MB
});

/* ==============================
   ✅ GET EMPLOYEES
============================== */
router.get("/users", protect, async (req, res) => {
  try {
    const users = await User.find({
      role: "employee",
      companyId: req.user.companyId,
    }).select("_id name employeeId email");

    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ==============================
   ✅ UPLOAD EXCEL (FINAL FIX)
============================== */
router.post(
  "/upload-excel",
  protect,
  upload.single("file"),
  async (req, res) => {
    try {
      // 🔥 DEBUG (remove later if needed)
      console.log("BODY:", req.body);
      console.log("FILE:", req.file);

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const loggedInUser = req.user;
      let userId;

      // ✅ ROLE HANDLING
      if (
        loggedInUser.role === "admin" ||
        loggedInUser.role === "super_admin"
      ) {
        userId = req.body.userId;
        if (!userId) {
          return res.status(400).json({ message: "Select employee" });
        }
      } else {
        userId = loggedInUser._id;
      }

      // ✅ CATEGORY VALIDATION
      const category = (req.body.category || "").toLowerCase().trim();
      if (!category) {
        return res.status(400).json({ message: "Category required" });
      }

      // ✅ USER VALIDATION
      const userExists = await User.findById(userId);
      if (!userExists) {
        return res.status(400).json({ message: "User not found" });
      }

      // ✅ SAFE COMPANY CHECK
      if (!userExists.companyId.equals(loggedInUser.companyId)) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      /* ===== READ FILE ===== */
      const workbook = xlsx.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet);

      if (!rows.length) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Empty file" });
      }

      /* ===== TTL (10 DAYS) ===== */
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + 10 * 24 * 60 * 60 * 1000
      );

      /* ===== SAVE ===== */
      const saved = await EmployeeData.create({
        employeeId: userExists.employeeId,
        category,
        user: userId,
        uploadedBy: loggedInUser._id,

        companyId: loggedInUser.companyId,
        fileSize: req.file.size,
        fileType: req.file.mimetype,

        data: rows,
        fileName: req.file.filename,
        filePath: "uploads",

        uploadedAt: now,
        expiresAt,
      });

      // ✅ DELETE FILE AFTER SUCCESS
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.json({
        success: true,
        message: "Upload successful",
        count: rows.length,
        id: saved._id,
      });

    } catch (err) {
      console.error("UPLOAD ERROR:", err);

      // ✅ CLEANUP ON ERROR
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // 🔥 HANDLE FILE SIZE ERROR
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Max size is 5MB",
        });
      }

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

module.exports = router;
