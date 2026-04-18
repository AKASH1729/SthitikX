const express = require("express");
const router = express.Router();

const {
  createFieldLocation,
  getFieldLocations,
} = require("../controllers/fieldLocationController");

const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("admin"));

router.post("/", createFieldLocation);
router.get("/", getFieldLocations);

module.exports = router;