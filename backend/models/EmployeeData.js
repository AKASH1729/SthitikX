const mongoose = require("mongoose");

const employeeDataSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    index: true,
  },

  category: {
    type: String,
    enum: ["flow", "current"],
    required: true,
    lowercase: true,
  },

  // ✅ DATA OWNER (EMPLOYEE)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // ✅ NEW: WHO UPLOADED (ADMIN / EMPLOYEE)
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",

  },

  // ✅ Excel data
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true, 
  },

  // ✅ File inf
  fileName: {
    type: String,
    required: true,
  },

  filePath: {
    type: String,
    required: true,
  },

  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index
employeeDataSchema.index({ employeeId: 1, user: 1 });

module.exports = mongoose.model("EmployeeData", employeeDataSchema);