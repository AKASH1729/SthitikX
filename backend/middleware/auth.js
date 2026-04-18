/**
 * Authentication Middleware — FINAL VERSION 🔥
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

/* =========================================
   🔐 PROTECT ROUTES
========================================= */
const protect = async (req, res, next) => {
  try {
    let token;

    /* ================= TOKEN EXTRACT ================= */
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    /* ================= VERIFY TOKEN ================= */
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /* ================= FETCH USER ================= */
    let user;

    if (decoded.role === 'super_admin') {
      // 🔥 super admin bypass company check
      user = await User.findOne({
        _id: decoded.id,
        role: 'super_admin',
        isActive: true,
      }).select('-password -refreshToken').lean();
    } else {
      // 🔥 multi-tenant strict check
      user = await User.findOne({
        _id: decoded.id,
        companyId: decoded.companyId,
        isActive: true,
      }).select('-password -refreshToken').lean();
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or unauthorized.',
      });
    }

    /* ================= ATTACH ================= */
    req.user = user;
    req.companyId = user.companyId || null;

    /* ================= OPTIONAL LOG ================= */
    req.meta = {
      userId: user._id,
      role: user.role,
      companyId: user.companyId || 'global',
    };

    next();

  } catch (error) {
    logger.warn(`Auth failed: ${error.message}`);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error.',
    });
  }
};

/* =========================================
   🔐 ROLE AUTHORIZATION
========================================= */
const authorize = (...roles) => {
  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized.`,
      });
    }

    next();
  };
};

/* =========================================
   👑 SUPER ADMIN ONLY
========================================= */
const allowSuperAdmin = (req, res, next) => {
  if (req.user?.role === 'super_admin') return next();

  return res.status(403).json({
    success: false,
    message: 'Super admin access required',
  });
};

/* =========================================
   🏢 COMPANY FILTER (VERY IMPORTANT)
========================================= */
const companyFilter = (req, res, next) => {
  if (req.user?.role !== 'super_admin') {
    req.companyId = req.user.companyId;
  }
  next();
};

/* =========================================
   🔓 OPTIONAL AUTH (PUBLIC + USER)
========================================= */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id)
        .select('-password -refreshToken')
        .lean();

      if (user) {
        req.user = user;
        req.companyId = user.companyId;
      }
    }

    next();
  } catch {
    next(); // ignore errors
  }
};

module.exports = {
  protect,
  authorize,
  allowSuperAdmin,
  companyFilter,
  optionalAuth,
};