const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");

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
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
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
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ==============================
   ✅ UPLOAD EXCEL (FINAL)
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

      // ✅ FIXED ROLE
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

      const category = (req.body.category || "").toLowerCase();
      if (!category) {
        return res.status(400).json({ message: "Category required" });
      }

      const userExists = await User.findById(userId);
      if (!userExists) {
        return res.status(400).json({ message: "User not found" });
      }

      if (
        userExists.companyId.toString() !==
        loggedInUser.companyId.toString()
      ) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      /* ===== READ FILE ===== */
      const workbook = xlsx.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet);

      if (!rows.length) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: "Empty file" });
      }

      /* ===== TTL LOGIC ===== */
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

      // ✅ DELETE FILE AFTER USE
      fs.unlink(req.file.path, () => {});

      res.json({
        success: true,
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
        success: false,
        message: err.message,
      });
    }
  }
);

module.exports = router;