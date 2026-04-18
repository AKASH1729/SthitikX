/**
 * Dashboard Controller (MULTI-TENANT SAFE 🔥)
 */

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Alert = require('../models/Alert');

/**
 * @route   GET /api/dashboard/stats
 */
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const companyFilter = { companyId: req.user.companyId };

    const [
      totalEmployees,
      activeNow,
      todayPresent,
      totalEmployeesCount,
      recentAlerts,
      weeklyAttendance,
    ] = await Promise.all([

      /* 🔥 ONLY COMPANY USERS */
      User.countDocuments({
        role: 'employee',
        isActive: true,
        ...companyFilter,
      }),

      User.countDocuments({
        role: 'employee',
        isTracking: true,
        ...companyFilter,
      }),

      Attendance.countDocuments({
        date: today,
        ...companyFilter,
      }),

      User.countDocuments({
        role: 'employee',
        isActive: true,
        ...companyFilter,
      }),

      Alert.find({
        isRead: false,
        ...companyFilter,
      })
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('employee', 'name employeeId avatar'),

      /* 🔥 WEEKLY ATTENDANCE */
      (async () => {
        const results = [];

        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];

          const count = await Attendance.countDocuments({
            date: dateStr,
            ...companyFilter,
          });

          results.push({ date: dateStr, count });
        }

        return results;
      })(),
    ]);

    const todayAbsent = totalEmployeesCount - todayPresent;

    res.json({
      success: true,
      stats: {
        totalEmployees,
        activeNow,
        todayPresent,
        todayAbsent,
        unreadAlerts: recentAlerts.length,
        recentAlerts,
        weeklyAttendance,
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   GET /api/dashboard/alerts
 */
const getAlerts = async (req, res) => {
  const { isRead, page = 1, limit = 20 } = req.query;

  const query = {
    companyId: req.user.companyId, // 🔥 FIX
  };

  if (isRead !== undefined) query.isRead = isRead === 'true';

  const total = await Alert.countDocuments(query);

  const alerts = await Alert.find(query)
    .populate('employee', 'name employeeId avatar')
    .populate('geofence', 'name')
    .sort({ timestamp: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  res.json({ success: true, alerts, total });
};

/**
 * @route   PUT /api/dashboard/alerts/:id/read
 */
const markAlertRead = async (req, res) => {
  const alert = await Alert.findOneAndUpdate(
    {
      _id: req.params.id,
      companyId: req.user.companyId, // 🔥 SECURITY
    },
    { isRead: true },
    { new: true }
  );

  if (!alert) {
    return res.status(404).json({
      success: false,
      message: "Alert not found or unauthorized",
    });
  }

  res.json({ success: true });
};

module.exports = {
  getDashboardStats,
  getAlerts,
  markAlertRead,
};