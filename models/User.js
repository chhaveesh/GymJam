const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false, // Don't return password in queries
    },
    name: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['gym_owner', 'gym_member'],
      required: [true, 'Please specify user role'],
    },
    avatarUrl: {
      type: String,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    dailyVotesRemaining: {
      type: Number,
      default: 5,
    },
    votesResetAt: {
      type: Date,
      default: Date.now,
    },
    spotifyConnected: {
      type: Boolean,
      default: false,
    },
    spotifyAccessToken: {
      type: String,
      select: false, // Don't return token in queries
    },
    spotifyRefreshToken: {
      type: String,
      select: false, // Don't return token in queries
    },
    fcmToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password for login
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Reset daily votes
UserSchema.methods.resetDailyVotes = function () {
  const now = new Date();
  const lastReset = new Date(this.votesResetAt);

  // Check if it's a new day since last reset
  if (
    now.getDate() !== lastReset.getDate() ||
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()
  ) {
    this.dailyVotesRemaining = this.isPremium ? Infinity : 5;
    this.votesResetAt = now;
    return true;
  }
  return false;
};

module.exports = mongoose.model('User', UserSchema); 