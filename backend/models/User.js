/**
 * User Model — FINAL MULTI-TENANT VERSION 🔥
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },

  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: /^\S+@\S+\.\S+$/,
  },

  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },

  role: {
    type: String,
    enum: ['super_admin', 'admin', 'employee'],
    default: 'employee',
  },

  /* 🔥 MULTI-TENANT CORE */
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: function () {
      return this.role !== 'super_admin';
    },
    index: true,
  },

  employeeId: {
    type: String,
  },

  department: String,
  phone: String,

  avatar: {
    type: String,
    default: null,
  },

  assignedGeofence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Geofence',
    default: null,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  lastLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    timestamp: { type: Date, default: null },
  },

  isTracking: {
    type: Boolean,
    default: false,
  },

  battery: {
    type: Number,
    default: null,
  },

  refreshToken: {
    type: String,
    select: false,
  },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

/* =========================
   🔐 HASH PASSWORD
========================= */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

/* =========================
   📧 FORCE LOWERCASE EMAIL
========================= */
userSchema.pre('save', function (next) {
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  next();
});

/* =========================
   🆔 GENERATE SAFE EMPLOYEE ID
========================= */
userSchema.pre('save', function (next) {
  if (!this.employeeId && this.role === 'employee') {

    const companyPart = this.companyId
      ? this.companyId.toString().slice(-4)
      : "0000";

    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();

    const timePart = Date.now().toString().slice(-4);

    this.employeeId = `EMP-${companyPart}-${randomPart}-${timePart}`;
  }

  next();
});

/* =========================
   🔑 PASSWORD MATCH
========================= */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/* =========================
   🧠 INITIALS
========================= */
userSchema.virtual('initials').get(function () {
  return this.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();
});

/* =========================
   ⚡ INDEXES (VERY IMPORTANT)
========================= */

// ✅ Email unique per company (active users only)
userSchema.index(
  { email: 1, companyId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

// ✅ Employee ID unique per company
userSchema.index(
  { companyId: 1, employeeId: 1 },
  {
    unique: true,
    sparse: true
  }
);

// ✅ Fast queries
userSchema.index({ companyId: 1, role: 1 });
userSchema.index({ companyId: 1, isActive: 1 });

module.exports = mongoose.model('User', userSchema);