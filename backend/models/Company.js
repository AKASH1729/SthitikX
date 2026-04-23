const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },

  slug: {
    type: String,
    unique: true,
    lowercase: true,
  },

  plan: {
    type: String,
    enum: ["trial", "pro", "business", "premium", "enterprise"],
    default: "trial",
  },

  /* 💰 BILLING */
  planPrice: { type: Number, default: 0 },

  baseEmployees: { type: Number, default: 50 },

  extraEmployeePrice: { type: Number, default: 30 },

  // 🔥 LIMIT EXTRA USERS
  maxExtraEmployees: { type: Number, default: 10 },

  trialExpiresAt: Date,
  subscriptionExpiresAt: Date,

  isActive: { type: Boolean, default: true },

}, { timestamps: true });

/* =========================
   💰 BILL CALCULATION
========================= */
companySchema.methods.calculateBill = function (employeeCount) {
  const basePrice = this.planPrice || 0;

  const rawExtra = Math.max(0, employeeCount - this.baseEmployees);

  // 🔥 LIMIT TO maxExtraEmployees
  const extraEmployees = Math.min(rawExtra, this.maxExtraEmployees);

  const extraCost = extraEmployees * (this.extraEmployeePrice || 30);

  const total = basePrice + extraCost;

  return {
    basePrice,
    baseEmployees: this.baseEmployees,
    employeeCount,
    extraEmployees,
    extraCost,
    total,
    maxAllowed: this.baseEmployees + this.maxExtraEmployees,
  };
};

/* =========================
   ⏳ DAYS LEFT (FIXED)
========================= */
companySchema.methods.getDaysLeft = function () {
  const now = new Date();

  let endDate = null;

  if (this.plan === "trial") {
    endDate = this.trialExpiresAt;
  } else {
    endDate = this.subscriptionExpiresAt;
  }

  if (!endDate) return 0;

  const diff = endDate - now;

  return Math.max(
    0,
    Math.ceil(diff / (1000 * 60 * 60 * 24))
  );
};

/* =========================
   🔐 ACCESS CHECK (OPTIONAL)
========================= */
companySchema.methods.canAccess = function () {
  return this.isActive && this.getDaysLeft() > 0;
};

module.exports = mongoose.model("Company", companySchema);
