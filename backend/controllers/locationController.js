// /**
//  * Location Controller (FINAL - FIXED LIVE STATUS)
//  */

// const LocationLog = require('../models/LocationLog');
// const User = require('../models/User');
// const Geofence = require('../models/Geofence');
// const Attendance = require('../models/Attendance'); // ✅ IMPORTANT
// const Alert = require('../models/Alert');
// const logger = require('../config/logger');

// /* =========================================
//    UPDATE LOCATION (REAL-TIME)
// ========================================= */
// const updateLocation = async (req, res) => {
//   try {
//     const { lat, lng, accuracy, speed, heading, attendanceId } = req.body;
//     const today = new Date().toISOString().split('T')[0];

//     if (lat === undefined || lng === undefined) {
//       return res.status(400).json({
//         success: false,
//         message: 'Latitude and Longitude required',
//       });
//     }

//     let isInsideGeofence = true;

//     const user = await User.findById(req.user._id).populate('assignedGeofence');

//     /* =========================
//        GEOFENCE CHECK (SAFE)
//     ========================= */
//     if (user?.assignedGeofence) {
//       try {
//         const result = user.assignedGeofence.containsPoint(lat, lng);
//         isInsideGeofence = result?.isInside ?? true;

//         // 🔔 Create alert when exiting
//         if (!isInsideGeofence) {
//           const lastLog = await LocationLog.findOne({ employee: req.user._id })
//             .sort({ timestamp: -1 });

//           if (!lastLog || lastLog.isInsideGeofence) {
//             const alert = await Alert.create({
//               employee: req.user._id,
//               type: 'geofence_exit',
//               message: `${req.user.name} left work area`,
//               location: { lat, lng },
//               geofence: user.assignedGeofence._id,
//               severity: 'high',
//             });

//             req.io.to('admins').emit('alert:geofence-exit', {
//               alert,
//               employee: { id: req.user._id, name: req.user.name },
//             });

//             logger.warn(`🚨 Geofence exit: ${req.user.name}`);
//           }
//         }

//       } catch (err) {
//         console.log("Geofence error:", err.message);
//       }
//     }

//     /* =========================
//        SAVE LOCATION
//     ========================= */
//     const log = await LocationLog.create({
//       employee: req.user._id,
//       location: { type: 'Point', coordinates: [lng, lat] },
//       lat,
//       lng,
//       accuracy,
//       speed,
//       heading,
//       date: today,
//       isInsideGeofence,
//       attendance: attendanceId,
//     });

//     /* =========================
//        UPDATE USER LIVE LOCATION
//     ========================= */
//     await User.findByIdAndUpdate(req.user._id, {
//       lastLocation: { lat, lng, timestamp: new Date() },
//     });

//     /* =========================
//        SOCKET LIVE UPDATE
//     ========================= */
//     req.io.to('admins').emit('location:update', {
//       employeeId: req.user._id,
//       name: req.user.name,
//       lat,
//       lng,
//       accuracy,
//       speed,
//       isInsideGeofence,
//       timestamp: new Date(),
//     });

//     res.json({
//       success: true,
//       log,
//       isInsideGeofence,
//     });

//   } catch (error) {
//     console.error("LOCATION UPDATE ERROR:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// /* =========================================
//    GET MOVEMENT HISTORY
// ========================================= */
// const getMovementHistory = async (req, res) => {
//   try {
//     const { employeeId } = req.params;
//     const { date } = req.query;

//     if (
//       req.user.role === 'employee' &&
//       req.user._id.toString() !== employeeId
//     ) {
//       return res.status(403).json({
//         success: false,
//         message: 'Access denied.',
//       });
//     }

//     const targetDate = date || new Date().toISOString().split('T')[0];

//     const locations = await LocationLog.getDailyRoute(employeeId, targetDate);
//     const distance = LocationLog.calculateDistance(locations);

//     res.json({
//       success: true,
//       locations,
//       stats: {
//         totalPoints: locations.length,
//         distanceKm: distance,
//         date: targetDate,
//       },
//     });

//   } catch (error) {
//     console.error("HISTORY ERROR:", error);

//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// /* =========================================
//    GET LIVE LOCATIONS (FIXED 🔥)
// ========================================= */
// const getLiveLocations = async (req, res) => {
//   try {
//     const today = new Date().toISOString().split('T')[0];

//     // 👇 Get users
//     const users = await User.find({
//       role: 'employee',
//       isActive: true
//     })
//       .select('name email employeeId department lastLocation avatar')
//       .populate('assignedGeofence', 'name center radius');

//     // 👇 Get today's attendance
//     const attendanceRecords = await Attendance.find({ date: today });

//     // 👇 Merge
//     const employees = users.map(user => {
//       const attendance = attendanceRecords.find(
//         a => a.employee.toString() === user._id.toString()
//       );

//       const isTracking =
//         attendance?.clockIn?.timestamp &&
//         !attendance?.clockOut?.timestamp;

//       return {
//         ...user._doc,
//         clockIn: attendance?.clockIn || null,
//         clockOut: attendance?.clockOut || null,
//         isTracking: !!isTracking
//       };
//     });

//     res.json({
//       success: true,
//       employees
//     });

//   } catch (error) {
//     console.error("LIVE LOCATION ERROR:", error);

//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// /* =========================================
//    EXPORT
// ========================================= */
// module.exports = {
//   updateLocation,
//   getMovementHistory,
//   getLiveLocations,
// };




/**
 * Location Controller (FINAL - REALTIME TRACKING)
 */

/**
 * Location Controller (FINAL - PAGARGEO READY)
 */

const User = require('../models/User');
const LocationLog = require('../models/LocationLog');


/* =========================================
   📍 UPDATE LOCATION (LIVE TRACKING)
========================================= */
const updateLocation = async (req, res) => {
  try {
    const { lat, lng, battery, speed = 0, accuracy = null } = req.body;

    // ✅ VALIDATION
    if (lat == null || lng == null) {
      return res.status(400).json({
        success: false,
        message: "Latitude & Longitude required"
      });
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    /* =========================
       UPDATE USER LIVE DATA
    ========================= */
    await User.findByIdAndUpdate(req.user._id, {
      lastLocation: {
        lat,
        lng,
        timestamp: now
      },
      battery: battery ?? null,
      isTracking: true
    });

    /* =========================
       SAVE LOCATION HISTORY
    ========================= */
    await LocationLog.create({
      employee: req.user._id,               // ObjectId
      employeeId: req.user.employeeId,      // 🔥 STRING ID (IMPORTANT)

      location: {
        type: "Point",
        coordinates: [lng, lat],            // [lng, lat]
      },

      lat,
      lng,
      speed,
      accuracy,
      date: today,
      timestamp: now
    });

    /* =========================
       SOCKET UPDATE (REALTIME)
    ========================= */
    if (req.io) {
      req.io.to("admins").emit("location:update", {
        employeeId: req.user.employeeId,
        lat,
        lng,
        battery,
        speed,
        timestamp: now
      });
    }

    return res.status(200).json({
      success: true,
      message: "Location updated successfully"
    });

  } catch (error) {
    console.error("❌ LOCATION UPDATE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/* =========================================
   📡 GET LIVE LOCATIONS (ADMIN VIEW)
========================================= */
const getLiveLocations = async (req, res) => {
  try {
    const employees = await User.find({
      role: "employee",
      isActive: true
    }).select("name employeeId lastLocation battery");

    const now = new Date();

    const updatedEmployees = employees.map(emp => {
      const last = emp.lastLocation?.timestamp;

      const isOnline =
        last && (now - new Date(last)) < 30000; // 30 sec

      return {
        ...emp.toObject(),
        isOnline
      };
    });

    res.json({
      success: true,
      employees: updatedEmployees
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};


/* =========================================
   🛣 GET ROUTE HISTORY (FOR MAP)
========================================= */
const getRouteHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "employeeId required"
      });
    }

    const logs = await LocationLog.find({
      employeeId: employeeId   // 🔥 USE STRING ID
    })
      .sort({ timestamp: 1 })
      .limit(1000);

    return res.status(200).json({
      success: true,
      logs
    });

  } catch (error) {
    console.error("❌ ROUTE HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/* =========================================
   📦 EXPORT (FINAL)
========================================= */
module.exports = {
  updateLocation,
  getLiveLocations,
  getRouteHistory
};