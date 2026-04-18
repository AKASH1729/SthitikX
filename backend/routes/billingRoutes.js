const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth");
const checkPlan = require("../middleware/checkPlan");

const { getBilling } = require("../controllers/billingController");

router.get("/", protect, checkPlan, getBilling);

module.exports = router;