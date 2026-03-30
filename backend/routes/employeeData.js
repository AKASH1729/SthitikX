// const express = require("express");
// const EmployeeData = require("../models/EmployeeData");
// const { protect } = require("../middleware/auth");
// const xlsx = require("xlsx");
// const fs = require("fs");
// const path = require("path");

// const router = express.Router();

// /**
//  * ✅ GET DATA (ROLE BASED)
//  */
// router.get("/", protect, async (req, res) => {
//   try {
//     let query = {};

//     // 🔥 Employee → only their data
//     if (req.user.role === "employee") {
//       query.user = req.user._id;
//     }

//     // 🔥 Admin → can filter
//     if (req.user.role === "admin" && req.query.userId) {
//       query.user = req.query.userId;
//     }

//     const data = await EmployeeData.find(query)
//       .populate("user", "name email employeeId")
//       .sort({ uploadedAt: -1 });

//     res.json({
//       count: data.length,
//       data,
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: err.message });
//   }
// });

// /**
//  * ✅ DOWNLOAD EXCEL FILE
//  */
// router.get("/download/:id", protect, async (req, res) => {
//   try {
//     const record = await EmployeeData.findById(req.params.id);

//     if (!record) {
//       return res.status(404).json({ message: "Not found" });
//     }

//     // 🔥 Security: employee can download only their file
//     if (
//       req.user.role === "employee" &&
//       record.user.toString() !== req.user._id.toString()
//     ) {
//       return res.status(403).json({ message: "Unauthorized" });
//     }

//     const workbook = xlsx.utils.book_new();
//     const sheet = xlsx.utils.json_to_sheet(record.data);

//     xlsx.utils.book_append_sheet(workbook, sheet, "Data");

//     const fileName = `${record.employeeId}_${Date.now()}.xlsx`;
//     const filePath = path.join(__dirname, "../uploads", fileName);

//     xlsx.writeFile(workbook, filePath);

//     res.download(filePath, fileName, (err) => {
//       if (err) console.error(err);

//       // 🧹 delete after download
//       fs.unlink(filePath, (err) => {
//         if (err) console.error("Delete error:", err);
//       });
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Download failed" });
//   }
// });

// module.exports = router;