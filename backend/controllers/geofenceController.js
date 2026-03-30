const Geofence = require('../models/Geofence');

const getGeofences = async (req, res) => {
  const geofences = await Geofence.find({ isActive: true }).populate('employeeCount');
  res.json({ success: true, geofences });
};

const createGeofence = async (req, res) => {
  try {
    const { name, description, center, radius, address, color } = req.body;
    const geofence = await Geofence.create({
      name, description, center, radius, address, color,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, geofence });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateGeofence = async (req, res) => {
  const geofence = await Geofence.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!geofence) return res.status(404).json({ success: false, message: 'Geofence not found.' });
  res.json({ success: true, geofence });
};

const deleteGeofence = async (req, res) => {
  await Geofence.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true, message: 'Geofence deactivated.' });
};

module.exports = { getGeofences, createGeofence, updateGeofence, deleteGeofence };
