const mongoose = require('mongoose');

const SuggestionSchema = new mongoose.Schema(
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
    suggestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Method to approve the suggestion
SuggestionSchema.methods.approve = function (reviewerId) {
  this.status = 'approved';
  this.reviewedAt = Date.now();
  this.reviewedBy = reviewerId;
  
  return this.save();
};

// Method to reject the suggestion
SuggestionSchema.methods.reject = function (reviewerId, reason = '') {
  this.status = 'rejected';
  this.reviewedAt = Date.now();
  this.reviewedBy = reviewerId;
  this.reason = reason;
  
  return this.save();
};

module.exports = mongoose.model('Suggestion', SuggestionSchema); 