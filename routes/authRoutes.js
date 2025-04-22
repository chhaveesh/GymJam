const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getCurrentUser,
  updateUserProfile,
  upgradeToPremium,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/signup', registerUser);
router.post('/login', loginUser);

// Protected routes
router.get('/me', protect, getCurrentUser);
router.put('/me', protect, updateUserProfile);
router.post('/premium', protect, upgradeToPremium);

module.exports = router; 