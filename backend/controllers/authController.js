/**
 * Auth Controller — FIXED VERSION 🔥
 *
 * FIXES:
 * 1. verifyEmail had broken try/catch — unreachable code after return in try block
 * 2. login crashed silently when company was null — catch swallowed the real error
 * 3. login catch block was empty — now logs the actual error for debugging
 * 4. getMe in this file now uses req.user._id consistently
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Company = require("../models/Company");
const sendEmail = require("../utils/sendEmail");

/* ================= TEMP STORAGE ================= */
const pendingUsers = new Map();

/* ================= TOKEN HELPERS ================= */
const generateToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      companyId: user.companyId,   // ✅ companyId in JWT — required by protect middleware
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );

const generateRefreshToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      companyId: user.companyId,
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || "30d" }
  );

/* =========================================
   📝 REGISTER (EMAIL VERIFY FIRST)
========================================= */
const registerCompany = async (req, res) => {
  try {
    const { companyName, adminName, email, password, plan = "trial" } = req.body;

    if (!companyName || !adminName || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    pendingUsers.set(email, {
      companyName,
      adminName,
      email,
      password,
      plan,
    });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "10m" });

    const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;

    await sendEmail(
      email,
      "Verify your email - SthitiX",
      `<h2>Verify your account</h2>
       <a href="${verifyUrl}">Verify Email</a>`
    );

    res.json({ success: true, message: "Verification email sent" });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =========================================
   📧 VERIFY EMAIL — FIXED try/catch structure
========================================= */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const data = pendingUsers.get(decoded.email);

    if (!data) {
      return res.status(400).json({ message: "Expired or invalid link" });
    }

    const existingCompany = await Company.findOne({ email: data.email });
    if (existingCompany) {
      return res.status(400).json({ message: "Already verified" });
    }

    /* 🆓 TRIAL */
    if (data.plan === "trial") {
      const company = await Company.create({
        name: data.companyName,
        email: data.email,
        plan: "trial",
        planPrice: 0,
        baseEmployees: 50,
        extraEmployeePrice: 30,
        trialExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash(data.password, 10);

      await User.create({
        name: data.adminName,
        email: data.email,
        password: hashedPassword,
        role: "admin",
        companyId: company._id,
      });

      pendingUsers.delete(data.email);

      return res.json({
        success: true,
        message: "Free trial started",
        redirect: "/login",
      });
    }

    /* 💳 PAID PLAN (FIXED) */
    return res.json({
      success: true,
      message: "Email verified",
      redirect: `/payment?plan=${data.plan}&email=${data.email}`,
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err.message);
    res.status(400).json({ message: "Invalid or expired token" });
  }
};

/* =========================================
   🔐 LOGIN — FIXED null company crash
========================================= */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({
      email,
      isActive: true,
    }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    /* ✅ FIX: guard against null company before accessing .plan */
    if (user.role !== "super_admin") {
      const company = await Company.findById(user.companyId);

      if (!company) {
        return res.status(403).json({
          message: "Company not found. Please contact support.",
        });
      }

      if (!company.isActive) {
        return res.status(403).json({
          message: "Company account is inactive.",
        });
      }

      const now = new Date();
      const expired =
        company.plan === "trial"
          ? !company.trialExpiresAt || company.trialExpiresAt < now
          : !company.subscriptionExpiresAt || company.subscriptionExpiresAt < now;

      if (expired) {
        return res.status(403).json({
          message: "Plan expired. Please upgrade.",
          planExpired: true,
        });
      }
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    /* ✅ Strip password from response */
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;

    res.json({
      success: true,
      token,
      refreshToken,
      user: userObj,
    });

  } catch (err) {
    /* ✅ FIX: log the real error — empty catch was hiding all crashes */
    console.error("❌ LOGIN ERROR:", err.message);
    res.status(500).json({ message: "Login failed" });
  }
};

/* =========================================
   🔁 REFRESH TOKEN
========================================= */
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Refresh token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id).select("+refreshToken");

    if (!user || user.refreshToken !== token) {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    const newToken = generateToken(user);

    res.json({ success: true, token: newToken });

  } catch (err) {
    console.error("❌ REFRESH ERROR:", err.message);
    res.status(401).json({
      message: "Token expired or invalid",
    });
  }
};

/* =========================================
   👤 GET ME
========================================= */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password -refreshToken");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error("❌ GET ME ERROR:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =========================================
   🚪 LOGOUT
========================================= */
const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      refreshToken: null,
    });
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    console.error("❌ LOGOUT ERROR:", err.message);
    res.status(500).json({ message: "Logout failed" });
  }
};

module.exports = {
  registerCompany,
  verifyEmail,
  login,
  refreshAccessToken,
  getMe,
  logout,
};
