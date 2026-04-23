/**
 * User Controller — FINAL VERSION (WITH EMPLOYEE LIMIT 🚀)
 */

const User = require("../models/User");
const Company = require("../models/Company");
const mongoose = require("mongoose");

/* =========================================
   📥 GET USERS
========================================= */
const getUsers = async (req, res) => {
  try {
    if (!req.user || !req.user.companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { search = "", page = 1, limit = 20 } = req.query;

    const query = {
      role: "employee",
      companyId: req.user.companyId,
    };

    if (search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
        { employeeId: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .populate("assignedGeofence", "name")
      .limit(Number(limit))
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .select("-password -refreshToken");

    res.json({
      success: true,
      users,
    });

  } catch (error) {
    console.error("🔥 GET USERS ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================
   ➕ CREATE USER (LIMIT LOGIC ADDED)
========================================= */
const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      department,
      phone,
      assignedGeofence,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, Email, Password required",
      });
    }

    /* 🔥 GET COMPANY */
    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    /* 👥 COUNT EMPLOYEES */
    const employeeCount = await User.countDocuments({
      companyId: company._id,
      role: "employee",
    });

    const maxAllowed =
      company.baseEmployees + (company.maxExtraEmployees || 10);

    /* ❌ HARD BLOCK */
    if (employeeCount >= maxAllowed) {
      return res.status(400).json({
        success: false,
        message: `❌ Max employee limit reached (${maxAllowed}). Upgrade plan.`,
      });
    }

    /* ⚠ WARNING */
    let warning = null;
    if (employeeCount >= company.baseEmployees) {
      warning = `⚠ Extra employee added (${employeeCount}/${maxAllowed}). Charges will apply.`;
    }

    /* ➕ CREATE USER */
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: "employee",
      department,
      phone,
      assignedGeofence: assignedGeofence || undefined,
      companyId: company._id,
    });

    res.status(201).json({
      success: true,
      message: "Employee created",
      user,
      warning,
    });

  } catch (error) {
    console.error("🔥 CREATE USER ERROR:", error);
    res.status(500).json({
      message: error.message,
    });
  }
};

/* =========================================
   ✏️ UPDATE USER
========================================= */
const updateUser = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.user.companyId,
      },
      req.body,
      { new: true }
    ).populate("assignedGeofence", "name");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });

  } catch (error) {
    console.error("🔥 UPDATE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================================
   ❌ DELETE USER
========================================= */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findOneAndDelete({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Employee deleted",
    });

  } catch (error) {
    console.error("🔥 DELETE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================================
   👤 GET PROFILE
========================================= */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let company = null;

    if (user.companyId) {
      const c = await Company.findById(user.companyId);

      if (c) {
        const expiry =
          c.plan === "trial"
            ? c.trialExpiresAt
            : c.subscriptionExpiresAt;

        company = {
          _id: c._id,
          name: c.name,
          plan: c.plan,
          subscriptionExpiry: expiry,
          daysLeft: c.getDaysLeft ? c.getDaysLeft() : 0,
          baseEmployees: c.baseEmployees,
          maxExtraEmployees: c.maxExtraEmployees || 10,
        };
      }
    }

    res.json({
      name: user.name,
      email: user.email,
      role: user.role,
      company,
    });

  } catch (error) {
    console.error("❌ GET ME ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getMe,
};
