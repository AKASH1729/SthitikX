/**
 * User Routes — FINAL FIXED VERSION ✅
 */

const express = require('express');
const { body, param, query } = require('express-validator');

const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getMe
} = require('../controllers/userController');

const {
  protect,
  authorize,
  companyFilter
} = require('../middleware/auth');

const { validate } = require('../middleware/validate');
const checkPlan = require("../middleware/checkPlan");

const router = express.Router();

/* =========================
   👤 GET CURRENT USER (ALL LOGGED USERS)
========================= */
router.get("/me", protect, getMe);  // ✅ MUST be first

/* =========================
🔐 ADMIN-ONLY + MULTI-TENANT SECURITY
========================= */
router.use(
  protect,
  authorize('admin'),   // only admin allowed below
  companyFilter
);

router.use(checkPlan); // no need to add protect again

/* =========================
   👥 GET USERS
========================= */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
  ],
  validate,
  getUsers
);

/* =========================
   ➕ CREATE USER
========================= */
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Min 6 chars'),
    body('role').optional().isIn(['employee', 'admin']),
  ],
  validate,
  createUser
);

/* =========================
   ✏️ UPDATE USER
========================= */
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid ID'),
  ],
  validate,
  updateUser
);

/* =========================
   ❌ DELETE USER
========================= */
router.delete(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid ID'),
  ],
  validate,
  deleteUser
);

module.exports = router;