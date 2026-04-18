/**
 * Payment Controller — FINAL FIXED VERSION 🚀
 */

const Razorpay = require("razorpay");
const crypto = require("crypto");
const Company = require("../models/Company");
const User = require("../models/User");
const { pendingUsers } = require("./authController"); // ✅ IMPORTANT

/* ================= ENV CHECK ================= */
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  throw new Error("❌ Razorpay keys missing in .env");
}

/* ================= INIT ================= */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* =========================
   🧾 CREATE ORDER
========================= */
const createOrder = async (req, res) => {
  try {
    const { plan } = req.body;

    /* ================= SIGNUP FLOW ================= */
    if (!req.user) {
      const plans = {
        pro: 999,
        business: 1999,
        premium: 2999,
        enterprise: 6999,
      };

      const amount = plans[plan];

      if (!amount) {
        return res.status(400).json({ message: "Invalid plan" });
      }

      const order = await razorpay.orders.create({
        amount: amount * 100,
        currency: "INR",
        receipt: `s_${Date.now()}`, // ✅ short
      });

      return res.json({
        success: true,
        order,
        amount,
      });
    }

    /* ================= BILLING FLOW ================= */
    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const employeeCount = await User.countDocuments({
      companyId: company._id,
      role: "employee",
    });

    const bill = company.calculateBill(employeeCount);

    const order = await razorpay.orders.create({
      amount: bill.total * 100,
      currency: "INR",
      receipt: `b_${Date.now()}`,
    });

    res.json({
      success: true,
      order,
      amount: bill.total,
      employees: employeeCount,
    });

  } catch (err) {
    console.error("RAZORPAY ERROR:", err);

    res.status(500).json({
      message: err?.error?.description || err.message || "Order failed",
    });
  }
};

/* =========================
   ✅ VERIFY PAYMENT (SAFE)
========================= */
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    /* 🔥 DO NOT CREATE COMPANY HERE */
    res.json({
      success: true,
      message: "Payment verified (waiting webhook)",
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err);

    res.status(500).json({
      message: "Verification failed",
    });
  }
};

/* =========================
   🔔 WEBHOOK (REAL SOURCE)
========================= */
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    if (signature !== expected) {
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;

      const email = payment.email || payment.notes?.email;

      const data = pendingUsers.get(email);
      if (!data) return res.json({ ok: true });

      /* ✅ CREATE COMPANY */
      const company = await Company.create({
        name: data.companyName,
        email,
        plan: data.plan,
        planPrice: payment.amount / 100,
        baseEmployees:
          data.plan === "pro" ? 50 :
          data.plan === "business" ? 100 :
          data.plan === "premium" ? 200 : 700,
        extraEmployeePrice: 30,
        subscriptionExpiresAt: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ),
      });

      await User.create({
        name: data.adminName,
        email,
        password: data.password,
        role: "admin",
        companyId: company._id,
      });

      pendingUsers.delete(email);

      console.log("✅ Company created via webhook");
    }

    res.json({ success: true });

  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    res.status(500).send("Webhook error");
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook,
};