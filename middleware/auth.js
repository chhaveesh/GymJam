const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to protect routes
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      // Check if user daily votes need to be reset
      if (req.user) {
        const needsReset = req.user.resetDailyVotes();
        if (needsReset) {
          await req.user.save();
        }
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

// Middleware to check if user is gym owner
const gymOwner = (req, res, next) => {
  if (req.user && req.user.role === 'gym_owner') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Gym owner access required.' });
  }
};

// Middleware to check if user is gym member
const gymMember = (req, res, next) => {
  if (req.user && req.user.role === 'gym_member') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Gym member access required.' });
  }
};

// Middleware to check if user is premium
const premiumUser = (req, res, next) => {
  if (req.user && req.user.isPremium) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Premium access required.' });
  }
};

module.exports = { protect, gymOwner, gymMember, premiumUser }; 