/**
 * User Controller
 * CRUD operations for employee management
 */

const User = require('../models/User');
const logger = require('../config/logger');

/**
 * @route   GET /api/users
 * @access  Private (Admin)
 */
const getUsers = async (req, res) => {
  try {
    const { department, isActive, page = 1, limit = 20, search } = req.query;
    const query = { role: 'employee' };

    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .populate('assignedGeofence', 'name center radius')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-password -refreshToken');

    res.json({ success: true, users, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   POST /api/users
 * @access  Private (Admin)
 */
const createUser = async (req, res) => {
  try {
    const { name, email, password, department, phone, assignedGeofence } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({
      name, email, password, role: 'employee',
      department, phone, assignedGeofence: assignedGeofence || null,
    });

    res.status(201).json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, employeeId: user.employeeId },
      message: 'Employee created successfully.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   PUT /api/users/:id
 * @access  Private (Admin)
 */
const updateUser = async (req, res) => {
  try {
    const allowed = ['name', 'department', 'phone', 'isActive', 'assignedGeofence'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('assignedGeofence', 'name');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   DELETE /api/users/:id
 * @access  Private (Admin)
 */
const deleteUser = async (req, res) => {
  try {
    // Soft delete - just deactivate
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: 'Employee deactivated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
