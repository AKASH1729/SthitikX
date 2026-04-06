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
    unique: true,
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
    enum: ['admin', 'employee'],
    default: 'employee',
  },

  employeeId: {
    type: String,
    unique: true,
    sparse: true,
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

  // =========================
  // 🔥 TRACKING FIELDS (SYSTEM ONLY)
  // =========================
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

}, { timestamps: true });

/* =========================
   INITIALS
========================= */
userSchema.virtual('initials').get(function () {
  return this.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

/* =========================
   HASH PASSWORD
========================= */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* =========================
   AUTO EMPLOYEE ID
========================= */
userSchema.pre('save', async function (next) {
  if (!this.employeeId && this.role === 'employee') {
    const count = await mongoose.model('User').countDocuments({ role: 'employee' });
    this.employeeId = `EMP${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

/* =========================
   PASSWORD MATCH
========================= */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/* =========================
   UPDATE LOCATION (SYSTEM ONLY)
========================= */
userSchema.methods.updateLocation = async function (lat, lng, battery = null) {
  this.lastLocation = {
    lat,
    lng,
    timestamp: new Date(),
  };

  if (battery !== null) {
    this.battery = battery;
  }

  this.isTracking = true;

  await this.save();
};

/* =========================
   SET OFFLINE
========================= */
userSchema.methods.setOffline = async function () {
  this.isTracking = false;
  await this.save();
};

module.exports = mongoose.model('User', userSchema);