/**
 * Payment Controller — FINAL PRODUCTION VERSION 🚀
 */

const Razorpay = require("razorpay");
const crypto = require("crypto");
const Company = require("../models/Company");
const User = require("../models/User");
const { pendingUsers } = require("./authController");

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

      const order = await razorpay.orders.create({
        amount: amount * 100,
        currency: "INR",
        receipt: `s_${Date.now()}`,

        // 🔥 IMPORTANT
        notes: {
          type: "signup",
          plan,
        },
      });

      return res.json({
        success: true,
        order,
        amount,
      });
    }

    /* ================= BILLING FLOW ================= */
    const company = await Company.findById(req.user.companyId);

    const employeeCount = await User.countDocuments({
      companyId: company._id,
      role: "employee",
    });

    const bill = company.calculateBill(employeeCount);

    /* 🔥 DEBUG LOGS */
    console.log("👥 Employees:", employeeCount);
    console.log("📦 Included:", company.baseEmployees);
    console.log("➕ Extra:", bill.extraEmployees);
    console.log("💰 Extra Cost:", bill.extraCost);
    console.log("💰 TOTAL:", bill.total);

    const order = await razorpay.orders.create({
      amount: bill.total * 100,
      currency: "INR",
      receipt: `b_${Date.now()}`,

      // 🔥 CRITICAL FOR WEBHOOK
      notes: {
        type: "renewal",
        companyId: company._id.toString(),
        employees: employeeCount,
        extraEmployees: bill.extraEmployees,
      },
    });

    res.json({
      success: true,
      order,
      amount: bill.total,
      breakdown: bill,
    });

  } catch (err) {
    console.error("ORDER ERROR:", err);
    res.status(500).json({ message: "Order failed" });
  }
};

/* =========================
   ✅ VERIFY PAYMENT
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
        message: "Invalid signature",
      });
    }

    // ❌ DO NOT update DB here
    res.json({
      success: true,
      message: "Verified (waiting webhook)",
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({ message: "Verification failed" });
  }
};

/* =========================
   🔔 WEBHOOK (MOST IMPORTANT)
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

      const type = payment.notes?.type;

      /* =========================
         🔥 RENEWAL FLOW
      ========================= */
      if (type === "renewal") {
        const companyId = payment.notes.companyId;

        const company = await Company.findById(companyId);
        if (!company) return res.json({ ok: true });

        const now = new Date();

        if (company.subscriptionExpiresAt > now) {
          // 🔥 extend
          company.subscriptionExpiresAt = new Date(
            company.subscriptionExpiresAt.getTime() +
              30 * 24 * 60 * 60 * 1000
          );
        } else {
          // 🔥 new cycle
          company.subscriptionExpiresAt = new Date(
            now.getTime() + 30 * 24 * 60 * 60 * 1000
          );
        }

        company.planPrice = payment.amount / 100;

        await company.save();

        console.log("✅ Subscription renewed");

        return res.json({ success: true });
      }

      /* =========================
         🆕 SIGNUP FLOW
      ========================= */
      if (type === "signup") {
        const email = payment.email;

        const data = pendingUsers.get(email);
        if (!data) return res.json({ ok: true });

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

        console.log("✅ Company created");
      }
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
