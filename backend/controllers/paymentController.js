const Razorpay = require("razorpay");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const Company = require("../models/Company");
const User = require("../models/User");
const { pendingUsers } = require("./authController");

/* ================= INIT ================= */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ================= CREATE ORDER ================= */
const createOrder = async (req, res) => {
  try {
    const { plan, email } = req.body;

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
        notes: {
          type: "signup",
          plan,
          email,
        },
      });

      return res.json({ success: true, order, amount });
    }

    // Renewal flow (unchanged)
    const company = await Company.findById(req.user.companyId);

    const employeeCount = await User.countDocuments({
      companyId: company._id,
      role: "employee",
    });

    const bill = company.calculateBill(employeeCount);

    const order = await razorpay.orders.create({
      amount: bill.total * 100,
      currency: "INR",
      receipt: `b_${Date.now()}`,
      notes: {
        type: "renewal",
        companyId: company._id.toString(),
      },
    });

    res.json({ success: true, order, amount: bill.total });

  } catch (err) {
    console.error("ORDER ERROR:", err);
    res.status(500).json({ message: "Order failed" });
  }
};

/* ================= VERIFY PAYMENT ================= */
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
      plan,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const data = pendingUsers.get(email);

    if (!data) {
      return res.status(400).json({ message: "User not found" });
    }

    /* 🔥 PREVENT DUPLICATE CREATION */
    const existing = await Company.findOne({ email });
    if (existing) {
      return res.json({ success: true });
    }

    /* 🔐 HASH PASSWORD */
    const hashedPassword = await bcrypt.hash(data.password, 10);

    /* 🏢 CREATE COMPANY */
    const company = await Company.create({
      name: data.companyName,
      email,
      plan: data.plan,
      planPrice:
        data.plan === "pro" ? 999 :
        data.plan === "business" ? 1999 :
        data.plan === "premium" ? 2999 :
        data.plan === "enterprise" ? 6999 : 0,

      baseEmployees:
        data.plan === "pro" ? 50 :
        data.plan === "business" ? 100 :
        data.plan === "premium" ? 200 : 700,

      extraEmployeePrice: 30,

      subscriptionExpiresAt: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ),
    });

    /* 👤 CREATE USER */
    await User.create({
      name: data.adminName,
      email,
      password: hashedPassword,
      role: "admin",
      companyId: company._id,
    });

    pendingUsers.delete(email);

    console.log("✅ Company created (verifyPayment):", email);

    res.json({ success: true });

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({ message: "Verification failed" });
  }
};

/* ================= WEBHOOK ================= */
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    const shasum = crypto.createHmac(
      "sha256",
      process.env.RAZORPAY_WEBHOOK_SECRET
    );

    // ✅ RAW BUFFER
    shasum.update(req.body);

    const digest = shasum.digest("hex");

    if (digest !== signature) {
      console.log("❌ Invalid signature");
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());

    console.log("📡 Webhook verified:", event.event);

    if (event.event === "payment.captured") {
      console.log("💰 Payment captured");
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return res.status(500).send("Webhook error");
  }
};
module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook,
};
