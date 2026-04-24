const express = require("express");
const router = express.Router();

const {
  createOrder,
  verifyPayment,
  handleWebhook,
} = require("../controllers/paymentController");

const { protect, authorize } = require("../middleware/auth");

/* 🆓 PUBLIC (SIGNUP) */
router.post("/order", createOrder);
router.post("/verify", verifyPayment);


/* 🔐 BILLING (AFTER LOGIN) */
router.post("/billing/order", protect, authorize("admin"), createOrder);
router.post("/billing/verify", protect, authorize("admin"), verifyPayment);

module.exports = router;   // ✅ YOU MISSED THIS
