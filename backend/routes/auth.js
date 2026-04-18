/**
 * Auth Routes — FINAL SaaS VERSION (EMAIL VERIFY + PLAN CHECK 🚀)
 */

const express = require("express");
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");

const {
  login,
  refreshAccessToken,
  getMe,
  logout,
  registerCompany,
  verifyEmail, // ✅ ADDED
} = require("../controllers/authController");

const { protect } = require("../middleware/auth");
const checkPlan = require("../middleware/checkPlan");
const { validate } = require("../middleware/validate");

const router = express.Router();

/* =========================
   🚨 RATE LIMITERS
========================= */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many login attempts",
  },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many registrations",
  },
});

/* =========================
   🏢 REGISTER COMPANY
========================= */
router.post(
  "/register-company",
  registerLimiter,
  [
    body("companyName").notEmpty(),
    body("adminName").notEmpty(),
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
  ],
  validate,
  registerCompany
);

/* =========================
   📧 VERIFY EMAIL (VERY IMPORTANT)
========================= */
router.get(
  "/verify-email/:token",
  verifyEmail
);

/* =========================
   🔐 LOGIN
========================= */
router.post(
  "/login",
  loginLimiter,
  [
    body("email").isEmail(),
    body("password").notEmpty(),
  ],
  validate,
  login
);

/* =========================
   🔄 REFRESH TOKEN
========================= */
router.post(
  "/refresh",
  [
    body("refreshToken").notEmpty(),
  ],
  validate,
  refreshAccessToken
);

/* =========================
   🔐 PROTECTED ROUTES
========================= */

router.get(
  "/me",
  protect,
  checkPlan,
  getMe
);

router.post(
  "/logout",
  protect,
  checkPlan,
  logout
);

router.post(
  "/logout-all",
  protect,
  checkPlan,
  async (req, res) => {
    await require("../models/User").findByIdAndUpdate(req.user._id, {
      refreshToken: null,
    });

    res.json({
      success: true,
      message: "Logged out from all devices",
    });
  }
);

module.exports = router;