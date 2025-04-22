const mongoose = require('mongoose');
const crypto = require('crypto');

const GymSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide a gym name'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot be more than 500 characters'],
    },
    logoUrl: {
      type: String,
    },
    address: {
      type: String,
    },
    inviteCode: {
      type: String,
      unique: true,
      required: true,
    },
    votingEnabled: {
      type: Boolean,
      default: true,
    },
    playbackMode: {
      type: String,
      enum: ['automatic', 'manual'],
      default: 'automatic',
    },
    spotifyAccessToken: {
      type: String,
      select: false,
    },
    spotifyRefreshToken: {
      type: String,
      select: false,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        isActive: {
          type: Boolean,
          default: true,
        },
        points: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Generate unique invite code before saving
GymSchema.pre('save', function (next) {
  if (this.isNew) {
    // Generate a random 6-character invite code
    this.inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  }
  next();
});

// Method to check if a user is a member of this gym
GymSchema.methods.isMember = function (userId) {
  return this.members.some(
    (member) => member.user.toString() === userId.toString() && member.isActive
  );
};

// Method to add a member to the gym
GymSchema.methods.addMember = function (userId) {
  if (!this.isMember(userId)) {
    this.members.push({
      user: userId,
      joinedAt: Date.now(),
      isActive: true,
      points: 0,
    });
  }
  return this.save();
};

// Method to remove a member from the gym
GymSchema.methods.removeMember = function (userId) {
  this.members = this.members.filter(
    (member) => member.user.toString() !== userId.toString()
  );
  return this.save();
};

// Method to award points to a member
GymSchema.methods.awardPoints = function (userId, points) {
  const memberIndex = this.members.findIndex(
    (member) => member.user.toString() === userId.toString()
  );

  if (memberIndex !== -1) {
    this.members[memberIndex].points += points;
    return this.save();
  }

  return Promise.reject(new Error('User is not a member of this gym'));
};

module.exports = mongoose.model('Gym', GymSchema); 