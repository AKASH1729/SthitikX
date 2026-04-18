/**
 * Auth Controller — FINAL VERSION (EMAIL VERIFY + SaaS FLOW 🚀)
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Company = require("../models/Company");
const sendEmail = require("../utils/sendEmail");

/* ================= TEMP STORAGE ================= */
const pendingUsers = new Map();

/* ================= TOKEN ================= */
const generateToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      companyId: user.companyId,
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
      return res.status(400).json({
        success: false,
        message: "All fields required",
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    /* 🔥 SAVE TEMP USER */
    pendingUsers.set(email, {
      companyName,
      adminName,
      email,
      password,
      plan,
    });

    /* 🔐 CREATE TOKEN */
    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "10m",
    });

    const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;

    await sendEmail(
      email,
      "Verify your email - SthitiX",
      `<h2>Verify your account</h2>
       <p>Click below to verify:</p>
       <a href="${verifyUrl}">Verify Email</a>`
    );

    res.json({
      success: true,
      message: "Verification email sent",
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================================
   📧 VERIFY EMAIL
========================================= */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const data = pendingUsers.get(decoded.email);

    if (!data) {
      return res.status(400).json({
        message: "Expired or invalid link",
      });
    }

    /* ================= TRIAL ================= */
    if (data.plan === "trial") {
      const now = new Date();

      const company = await Company.create({
        name: data.companyName,
        email: data.email,
        plan: "trial",
        planPrice: 0,
        baseEmployees: 50,
        extraEmployeePrice: 30,
        trialExpiresAt: new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000
        ),
      });

      await User.create({
        name: data.adminName,
        email: data.email,
        password: data.password,
        role: "admin",
        companyId: company._id,
      });

      pendingUsers.delete(data.email);

      return res.json({
        success: true,
        message: "Free trial started 🎉",
        redirect: "/login",
      });
    }

    /* ================= PAID ================= */
    return res.json({
      success: true,
      message: "Email verified",
      redirect: `/payment?plan=${data.plan}&email=${data.email}`,
    });

  } catch (err) {
    res.status(400).json({
      message: "Invalid or expired token",
    });
  }
};

/* =========================================
   🔐 LOGIN
========================================= */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email,
      isActive: true,
    }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    /* 🔥 CHECK PLAN */
    if (user.role !== "super_admin") {
      const company = await Company.findById(user.companyId);

      const now = new Date();

      const expired =
        company.plan === "trial"
          ? company.trialExpiresAt < now
          : company.subscriptionExpiresAt < now;

      if (expired) {
        return res.status(403).json({
          message: "Plan expired",
          planExpired: true,
        });
      }
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      token,
      refreshToken,
      user,
    });

  } catch {
    res.status(500).json({ message: "Login failed" });
  }
};

/* =========================================
   🔁 REFRESH TOKEN
========================================= */
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id).select("+refreshToken");

    if (!user || user.refreshToken !== token) {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    const newToken = generateToken(user);

    res.json({ success: true, token: newToken });

  } catch {
    res.status(401).json({
      message: "Token expired",
    });
  }
};

/* =========================================
   👤 GET ME
========================================= */
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, user });
};

/* =========================================
   🚪 LOGOUT
========================================= */
const logout = async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    refreshToken: null,
  });

  res.json({ success: true, message: "Logged out" });
};

module.exports = {
  registerCompany,
  verifyEmail,
  login,
  refreshAccessToken,
  getMe,
  logout,
};