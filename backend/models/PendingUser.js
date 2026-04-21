const mongoose = require("mongoose");

const PendingUserSchema = new mongoose.Schema({
  companyName: String,
  adminName: String,
  email: String,
  password: String,
  plan: String,
  token: String,
  expiresAt: {
    type: Date,
    expires: 600, // auto delete after 10 min
  },  	
});

module.exports = mongoose.model("PendingUser", PendingUserSchema);

