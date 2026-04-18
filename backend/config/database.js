/**
 * MongoDB connection configuration (ENV + SECURE 🔥)
 */

const mongoose = require("mongoose");
const logger = require("./logger");

/* =========================
   CONNECT DB
========================= */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);

    /* =========================
       🔥 AUTO CREATE SUPER ADMIN
    ========================= */
    const User = require("../models/User");

    const existingAdmin = await User.findOne({
      role: "super_admin",
    });

    if (!existingAdmin) {
      const adminEmail = process.env.SUPER_ADMIN_EMAIL;
      const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
      const adminName = process.env.SUPER_ADMIN_NAME || "Super Admin";

      // ❗ Safety check
      if (!adminEmail || !adminPassword) {
        logger.error("❌ SUPER ADMIN ENV variables missing");
        return;
      }

      await User.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword, // hashed via schema
        role: "super_admin",
      });

      logger.info(`🔥 Super Admin Created (${adminEmail})`);
    } else {
      logger.info("✅ Super Admin already exists");
    }
  } catch (error) {
    logger.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

/* =========================
   EVENTS
========================= */
mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected");
});

module.exports = connectDB;