const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // 🔥 ADD THIS (MOST IMPORTANT)
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },

  date: {
    type: String,
    required: true,
  },

  clockIn: {
    timestamp: { type: Date, default: null },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String },
    },
    isWithinGeofence: { type: Boolean, default: false },
  },

  clockOut: {
    timestamp: { type: Date, default: null },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String },
    },
    isWithinGeofence: { type: Boolean, default: false },
  },

  battery: {
    type: Number,
    default: null,
  },

  totalHours: {
    type: Number,
    default: 0,
  },

  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day', 'on-leave'],
    default: 'present',
  },

  notes: {
    type: String,
    maxlength: 500,
  },

  geofence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Geofence',
  },
workLocation: {
  name: { type: String },
  lat: { type: Number },
  lng: { type: Number },
},
}, { timestamps: true }); 

/* 🔥 UPDATED UNIQUE INDEX (MULTI-TENANT SAFE) */
attendanceSchema.index(
  { employee: 1, date: 1, companyId: 1 },
  { unique: true }
);

/* 🔥 EXTRA INDEXES (PERFORMANCE) */
attendanceSchema.index({ companyId: 1, date: 1 });
attendanceSchema.index({ companyId: 1, employee: 1 });

/* =========================
   CALCULATE HOURS
========================= */
attendanceSchema.methods.calculateHours = function () {
  if (this.clockIn?.timestamp && this.clockOut?.timestamp) {
    const ms = this.clockOut.timestamp - this.clockIn.timestamp;
    this.totalHours = Number((ms / (1000 * 60 * 60)).toFixed(2));
  }
};

/* =========================
   STATUS LOGIC
========================= */
attendanceSchema.pre('save', function (next) {
  if (this.clockIn?.timestamp) {
    const time = new Date(this.clockIn.timestamp);
    const h = time.getHours();
    const m = time.getMinutes();

    if (h > 9 || (h === 9 && m > 30)) {
      this.status = 'late';
    }
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);














// /**
//  * Attendance Model
//  * Tracks employee clock-in/out with location validation
//  */

// const mongoose = require('mongoose');

// const attendanceSchema = new mongoose.Schema({
//   employee: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//   },
//   date: {
//     type: String, // Format: YYYY-MM-DD for easy querying
//     required: true,
//   },
//   clockIn: {
//     timestamp: { type: Date },
//     location: {
//       lat: { type: Number },
//       lng: { type: Number },
//       address: { type: String },
//     },
//     isWithinGeofence: { type: Boolean, default: false },
//   },
//   clockOut: {
//     timestamp: { type: Date, default: null },
//     location: {
//       lat: { type: Number },
//       lng: { type: Number },
//       address: { type: String },
//     },
//     isWithinGeofence: { type: Boolean, default: false },
//   },
//   // Working hours calculated on clock-out
//   totalHours: {
//     type: Number, // In hours (decimal)
//     default: 0,
//   },
//   // Status for admin review
//   status: {
//     type: String,
//     enum: ['present', 'absent', 'late', 'half-day', 'on-leave'],
//     default: 'present',
//   },
//   // Notes for manual override or issues
//   notes: {
//     type: String,
//     maxlength: 500,
//   },
//   geofence: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Geofence',
//   },
// }, {
//   timestamps: true,
// });

// // Compound index: one attendance record per employee per day
// attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
// attendanceSchema.index({ date: 1 });
// attendanceSchema.index({ employee: 1 });

// // Method: Calculate total hours on clock-out
// attendanceSchema.methods.calculateHours = function () {
//   if (this.clockIn.timestamp && this.clockOut.timestamp) {
//     const ms = this.clockOut.timestamp - this.clockIn.timestamp;
//     this.totalHours = parseFloat((ms / (1000 * 60 * 60)).toFixed(2));
//   }
// };

// // Update status based on clock-in time
// attendanceSchema.pre('save', function (next) {
//   if (this.clockIn.timestamp) {
//     const clockInHour = new Date(this.clockIn.timestamp).getHours();
//     // Mark as late if after 9:30 AM
//     if (clockInHour >= 9 && new Date(this.clockIn.timestamp).getMinutes() > 30) {
//       this.status = 'late';
//     }
//   }
//   next();
// });

// module.exports = mongoose.model('Attendance', attendanceSchema);
