const mongoose = require("mongoose");

const employeeDataSchema = new mongoose.Schema({
  /* ================= CORE ================= */

  employeeId: {
    type: String,
    required: true,
    trim: true,
  },

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  /* ================= CATEGORY ================= */

  category: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },

  /* ================= DATA ================= */

  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },

  /* ================= FILE ================= */

  fileName: {
    type: String,
    required: true,
    trim: true,
  },

  filePath: {
    type: String,
    required: true,
  },

  fileSize: {
    type: Number,
    required: true,
  },

  fileType: {
    type: String,
  },

  /* ================= META ================= */

  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },

  // ✅ TTL FIELD (AUTO DELETE)
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },

}, {
  timestamps: true,
});

/* =========================
   🔥 INDEXES
========================= */

employeeDataSchema.index({ companyId: 1, employeeId: 1 });
employeeDataSchema.index({ companyId: 1, user: 1 });
employeeDataSchema.index({ companyId: 1, category: 1 });
employeeDataSchema.index({ companyId: 1, uploadedAt: -1 });

// ✅ TTL INDEX (MOST IMPORTANT)
employeeDataSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "ttl_expire_employee_data" }
);

module.exports = mongoose.model("EmployeeData", employeeDataSchema);