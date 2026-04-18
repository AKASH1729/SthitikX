const mongoose = require("mongoose");

const fieldLocationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },

}, { timestamps: true });

module.exports = mongoose.model("FieldLocation", fieldLocationSchema);