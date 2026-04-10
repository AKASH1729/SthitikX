const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");

const EmployeeData = require("../models/EmployeeData");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();


// ==============================
// ✅ MULTER CONFIG
// ==============================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });


// ==============================
// ✅ GET EMPLOYEES (FIXED)
// ==============================
router.get("/users", protect, async (req, res) => {
  try {
    console.log("👉 Fetching employees...");

    const users = await User.find({ role: "employee" })
      .select("_id name employeeId email");

    console.log("✅ Employees found:", users.length);

    res.status(200).json({
      success: true,
      users: users,
    });
  } catch (err) {
    console.error("❌ FETCH USERS ERROR:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
});


// ==============================
// ✅ UPLOAD EXCEL (FINAL)
// ==============================
router.post(
  "/upload-excel",
  protect,
  upload.single("file"),
  async (req, res) => {
    try {
      // ==============================
      // 🔴 FILE CHECK
      // ==============================
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const loggedInUser = req.user;

      console.log("RAW BODY:", req.body);
      console.log("Logged in:", loggedInUser.name);
      console.log("Role:", loggedInUser.role);

      // ==============================
      // ✅ USER ID FIX
      // ==============================
      let userId;

      if (loggedInUser.role === "admin") {
        userId = String(req.body.userId || "").trim();

        if (!userId || userId === "undefined" || userId === "null") {
          return res.status(400).json({
            message: "Please select a valid employee",
          });
        }
      } else {
        userId = loggedInUser._id.toString();
      }

      console.log("✅ FINAL userId:", userId);

      // ==============================
      // 🔴 CATEGORY CHECK
      // ==============================
      const category = String(req.body.category || "").toLowerCase();

      if (!category) {
        return res.status(400).json({
          message: "Category is required",
        });
      }

      // ==============================
      // ✅ USER EXISTS CHECK
      // ==============================
      const userExists = await User.findById(userId);

      if (!userExists) {
        return res.status(400).json({
          message: "User not found",
        });
      }

      // ==============================
      // ✅ READ EXCEL
      // ==============================
      const workbook = xlsx.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet);

      if (!rows.length) {
        return res.status(400).json({
          message: "Excel file is empty",
        });
      }

      // ==============================
      // ✅ SAVE DATA
      // ==============================
      const saved = await EmployeeData.create({
        employeeId: userExists.employeeId,
        category,
        user: userId,
        uploadedBy: loggedInUser._id.toString(),
        data: rows,
        fileName: req.file.filename,
        filePath: "uploads",
        uploadedAt: new Date(),
      });

      console.log("✅ SAVED:", saved._id);

      res.status(200).json({
        message: "Upload successful",
        count: rows.length,
        id: saved._id,
      });

    } catch (err) {
      console.error("❌ UPLOAD ERROR:", err);

      if (req.file && req.file.path) {
        fs.unlink(req.file.path, () => {});
      }

      res.status(500).json({
        message: "Server error",
        error: err.message,
      });
    }
  }
);

module.exports = router;