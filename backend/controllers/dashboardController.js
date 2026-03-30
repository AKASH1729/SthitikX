/**
 * Dashboard Controller
 * Admin analytics and summary data
 */

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Alert = require('../models/Alert');
const LocationLog = require('../models/LocationLog');

/**
 * @route   GET /api/dashboard/stats
 * @access  Private (Admin)
 */
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      totalEmployees,
      activeNow,
      todayPresent,
      todayAbsent,
      recentAlerts,
      weeklyAttendance,
    ] = await Promise.all([
      User.countDocuments({ role: 'employee', isActive: true }),
      User.countDocuments({ role: 'employee', isTracking: true }),
      Attendance.countDocuments({ date: today }),
      User.countDocuments({ role: 'employee', isActive: true }).then(total =>
        Attendance.countDocuments({ date: today }).then(present => total - present)
      ),
      Alert.find({ isRead: false }).sort({ timestamp: -1 }).limit(10)
        .populate('employee', 'name employeeId avatar'),
      // Last 7 days attendance count
      (async () => {
        const results = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const count = await Attendance.countDocuments({ date: dateStr });
          results.push({ date: dateStr, count });
        }
        return results;
      })(),
    ]);

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
 * @access  Private (Admin)
 */
const getAlerts = async (req, res) => {
  const { isRead, page = 1, limit = 20 } = req.query;
  const query = {};
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
 * @access  Private (Admin)
 */
const markAlertRead = async (req, res) => {
  await Alert.findByIdAndUpdate(req.params.id, { isRead: true });
  res.json({ success: true });
};

module.exports = { getDashboardStats, getAlerts, markAlertRead };
