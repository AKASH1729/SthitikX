const FieldLocation = require("../models/FieldLocation");

/* ================= CREATE ================= */
exports.createFieldLocation = async (req, res) => {
  try {
    const { name } = req.body;

    const location = await FieldLocation.create({
      name,
      companyId: req.user.companyId,
    });

    res.json({ success: true, location });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ================= GET ================= */
exports.getFieldLocations = async (req, res) => {
  try {
    const locations = await FieldLocation.find({
      companyId: req.user.companyId,
    });

    res.json({ success: true, locations });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};