const mongoose = require('mongoose');

const QueueSchema = new mongoose.Schema(
  {
    gym: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
    },
    track: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Track',
      required: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    voteCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'playing', 'played', 'skipped'],
      default: 'pending',
    },
    playedAt: {
      type: Date,
    },
    votes: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        votedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        type: {
          type: String,
          enum: ['fire', 'strong', 'thumbsdown'],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Method to add a vote
QueueSchema.methods.addVote = function (userId) {
  // Check if user already voted
  const alreadyVoted = this.votes.some(
    (vote) => vote.user.toString() === userId.toString()
  );

  if (!alreadyVoted) {
    this.votes.push({
      user: userId,
      votedAt: Date.now(),
    });
    this.voteCount = this.votes.length;
  }

  return this.save();
};

// Method to remove a vote
QueueSchema.methods.removeVote = function (userId) {
  this.votes = this.votes.filter(
    (vote) => vote.user.toString() !== userId.toString()
  );
  this.voteCount = this.votes.length;

  return this.save();
};

// Method to add a reaction
QueueSchema.methods.addReaction = function (userId, reactionType) {
  // Remove any existing reaction from this user
  this.reactions = this.reactions.filter(
    (reaction) => reaction.user.toString() !== userId.toString()
  );

  // Add the new reaction
  this.reactions.push({
    user: userId,
    type: reactionType,
    createdAt: Date.now(),
  });

  return this.save();
};

// Method to remove a reaction
QueueSchema.methods.removeReaction = function (userId) {
  this.reactions = this.reactions.filter(
    (reaction) => reaction.user.toString() !== userId.toString()
  );

  return this.save();
};

// Method to mark as playing
QueueSchema.methods.markAsPlaying = function () {
  this.status = 'playing';
  return this.save();
};

// Method to mark as played
QueueSchema.methods.markAsPlayed = function () {
  this.status = 'played';
  this.playedAt = Date.now();
  return this.save();
};

// Method to mark as skipped
QueueSchema.methods.markAsSkipped = function () {
  this.status = 'skipped';
  this.playedAt = Date.now();
  return this.save();
};

module.exports = mongoose.model('Queue', QueueSchema); 