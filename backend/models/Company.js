/**
 * Company Model — FINAL SaaS BILLING VERSION 🚀
 */

const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({

  /* ================= BASIC ================= */
  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: /^\S+@\S+\.\S+$/,
  },

  /* ================= UNIQUE SLUG ================= */
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
  },

  /* ================= PLAN ================= */
  plan: {
    type: String,
    enum: ["trial", "pro", "business", "premium", "enterprise"],
    default: "trial",
  },

  /* ================= BILLING ================= */

  // 💰 Base monthly price
  planPrice: {
    type: Number,
    default: 0,
  },

  // 👥 Included employees
  baseEmployees: {
    type: Number,
    default: 50,
  },

  // 💸 Extra employee cost (global)
  extraEmployeePrice: {
    type: Number,
    default: 30,
  },

  /* ================= EXPIRY ================= */

  trialExpiresAt: {
    type: Date,
  },

  subscriptionExpiresAt: {
    type: Date,
  },

  /* ================= STORAGE ================= */
  storageLimitMB: {
    type: Number,
    default: 500,
  },

  /* ================= STATUS ================= */
  isActive: {
    type: Boolean,
    default: true,
  },

  /* ================= OWNER ================= */
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

}, {
  timestamps: true,
});

/* =========================
   🔥 AUTO SLUG
========================= */
companySchema.pre("save", async function (next) {
  if (!this.slug) {
    let baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");

    let slug = baseSlug;
    let count = 0;

    const Company = mongoose.model("Company");

    while (await Company.findOne({ slug })) {
      count++;
      slug = `${baseSlug}-${count}`;
    }

    this.slug = slug;
  }

  next();
});

/* =========================
   🔥 PLAN HELPERS
========================= */

// ✅ Trial active
companySchema.methods.isTrialActive = function () {
  if (this.plan !== "trial") return false;
  if (!this.trialExpiresAt) return false;

  return this.trialExpiresAt > new Date();
};

// ✅ Subscription active
companySchema.methods.isSubscriptionActive = function () {
  if (this.plan === "trial") {
    return this.isTrialActive();
  }

  if (!this.subscriptionExpiresAt) return false;

  return this.subscriptionExpiresAt > new Date();
};

// ✅ Overall access
companySchema.methods.canAccess = function () {
  return this.isActive && this.isSubscriptionActive();
};

// ✅ Days left
companySchema.methods.getDaysLeft = function () {
  const now = new Date();

  const endDate =
    this.plan === "trial"
      ? this.trialExpiresAt
      : this.subscriptionExpiresAt;

  if (!endDate) return 0;

  const diff = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  return diff > 0 ? diff : 0;
};

/* =========================
   💰 BILLING CALCULATION
========================= */
companySchema.methods.calculateBill = function (employeeCount) {
  const basePrice = this.planPrice || 0;

  const extraEmployees = Math.max(
    0,
    employeeCount - this.baseEmployees
  );

  const extraCost =
    extraEmployees * (this.extraEmployeePrice || 30);

  const total = basePrice + extraCost;

  return {
    basePrice,
    baseEmployees: this.baseEmployees,
    employeeCount,
    extraEmployees,
    extraCost,
    total,
  };
};

/* =========================
   🔥 INDEXES
========================= */
companySchema.index({ slug: 1 }, { unique: true });
companySchema.index({ isActive: 1 });

module.exports = mongoose.model("Company", companySchema);