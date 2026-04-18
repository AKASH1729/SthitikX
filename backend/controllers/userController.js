/**
 * User Controller — FIXED VERSION (NO fieldLocation) 🚀
 */

const User = require("../models/User");

const Company = require("../models/Company");
/* =========================================
   📥 GET USERS
========================================= */
const getUsers = async (req, res) => {
  try {
    /* 🔐 AUTH CHECK */
    if (!req.user || !req.user.companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      search = "",
      page = 1,
      limit = 20,
    } = req.query;

    /* 🔥 BASE QUERY */
    const query = {
      role: "employee",
      companyId: req.user.companyId,
    };

    /* 🔍 SEARCH (SAFE) */
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
        { employeeId: { $regex: search.trim(), $options: "i" } },
      ];
    }

    /* 📊 FETCH USERS */
    const users = await User.find(query)
      .populate("assignedGeofence", "name") // ✅ ONLY THIS
      // ❌ REMOVED fieldLocation populate
      .limit(Number(limit) || 20)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .select("-password -refreshToken");

    /* 📦 RESPONSE */
    res.json({
      success: true,
      users,
    });

  } catch (error) {
    console.error("🔥 GET USERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

/* =========================================
   ➕ CREATE USER
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

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: "employee",
      department,
      phone,
      assignedGeofence: assignedGeofence || undefined,
      companyId: req.user.companyId,
    });

    res.status(201).json({
      success: true,
      message: "Employee created",
      user,
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
    const updates = req.body;

    const user = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.user.companyId,
      },
      updates,
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
   👤 GET LOGGED-IN USER PROFILE
========================================= */
const mongoose = require("mongoose");

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let company = null;

    if (user.companyId) {
      // 🔥 STEP 1: ensure ObjectId
      const companyId = new mongoose.Types.ObjectId(user.companyId);

      // 🔥 STEP 2: fetch full company
      const c = await Company.findById(companyId);

      console.log("👉 COMPANY RAW:", c);

      if (c) {
        // 🔥 STEP 3: map correct expiry field
        const expiry =
          c.plan === "trial"
            ? c.trialExpiresAt
            : c.subscriptionExpiresAt;

        company = {
          _id: c._id,
          name: c.name,
          plan: c.plan,
          subscriptionExpiry: expiry,
        };
      }
    }

    console.log("👉 FINAL COMPANY:", company);

    res.json({
      name: user.name,
      email: user.email,
      role: user.role,
      company: company || null,
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