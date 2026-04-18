/**
 * Payment Routes — FULL FIXED VERSION 🚀
 */

const express = require("express");
const router = express.Router();

const {
  createOrder,
  verifyPayment,
  handleWebhook,
} = require("../controllers/paymentController");

const { protect, authorize } = require("../middleware/auth");

/* =========================================
   🆓 PUBLIC ROUTES (SIGNUP PAYMENT)
========================================= */
router.post("/order", createOrder);   // ✅ NO AUTH
router.post("/verify", verifyPayment); // ✅ NO AUTH
router.post("/webhook", express.raw({ type: "application/json" }), handleWebhook);

/* =========================================
   🔐 PROTECTED ROUTES (BILLING AFTER LOGIN)
========================================= */
router.post(
  "/billing/order",
  protect,
  authorize("admin"),
  createOrder
);

router.post(
  "/billing/verify",
  protect,
  authorize("admin"),
  verifyPayment
);

module.exports = router;