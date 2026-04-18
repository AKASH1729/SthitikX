/**
 * Geofence Routes — FINAL SaaS VERSION 🔥
 */

const express = require('express');
const { body, param } = require('express-validator');

const router = express.Router();

const {
  getGeofences,
  createGeofence,
  updateGeofence,
  deleteGeofence,
} = require('../controllers/geofenceController');

const {
  protect,
  authorize,
  companyFilter
} = require('../middleware/auth');

const { validate } = require('../middleware/validate');

/* =========================
   🔐 GLOBAL MIDDLEWARE
========================= */

router.use(
  protect,
  authorize('admin'),   // ❌ block employee + super_admin
  companyFilter         // 🔥 multi-tenant safety
);

/* =========================
   📥 GET ALL
========================= */
router.get('/all', getGeofences);

/* =========================
   ➕ CREATE 
========================= */
router.post(
  '/create',
  [
    body('name').notEmpty().withMessage('Name required'),
    body('center.lat').isNumeric().withMessage('Latitude required'),
    body('center.lng').isNumeric().withMessage('Longitude required'),
    body('radius').isNumeric().withMessage('Radius required'),
  ],
  validate,
  createGeofence
);

/* =========================
   ✏️ UPDATE
========================= */
router.put(
  '/update/:id',
  [
    param('id').isMongoId().withMessage('Invalid ID'),
  ],
  validate,
  updateGeofence
);

/* =========================
   ❌ DELETE
========================= */
router.delete(
  '/delete/:id',
  [
    param('id').isMongoId().withMessage('Invalid ID'),
  ],
  validate,
  deleteGeofence
);

module.exports = router;