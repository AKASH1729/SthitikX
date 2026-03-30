/**
 * User Model
 * Stores admin and employee accounts
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password in queries by default
  },
  role: {
    type: String,
    enum: ['admin', 'employee'],
    default: 'employee',
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
  },
  department: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String,
    default: null,
  },
  // Assigned work zone for geo-fencing
  assignedGeofence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Geofence',
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Last known location
  lastLocation: {
    lat: Number,
    lng: Number,
    timestamp: Date,
  },
  // Tracking status
  isTracking: {
    type: Boolean,
    default: false,
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

// Virtual: full initials for avatar fallback
userSchema.virtual('initials').get(function () {
  return this.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Auto-generate employeeId
userSchema.pre('save', async function (next) {
  if (!this.employeeId && this.role === 'employee') {
    const count = await mongoose.model('User').countDocuments({ role: 'employee' });
    this.employeeId = `EMP${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Method: Compare entered password with hashed
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method: Update last location
userSchema.methods.updateLocation = async function (lat, lng) {
  this.lastLocation = { lat, lng, timestamp: new Date() };
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
