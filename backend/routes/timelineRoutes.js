const express = require("express");
const router = express.Router();
const { getTimeline } = require("../controllers/timelineController");
const { protect } = require("../middleware/auth");

router.get("/", protect, getTimeline);

module.exports = router;