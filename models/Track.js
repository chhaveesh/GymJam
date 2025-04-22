const mongoose = require('mongoose');

const TrackSchema = new mongoose.Schema(
  {
    spotifyId: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    artist: {
      type: String,
      required: true,
      trim: true,
    },
    album: {
      type: String,
      trim: true,
    },
    durationMs: {
      type: Number,
    },
    imageUrl: {
      type: String,
    },
    previewUrl: {
      type: String,
    },
    explicit: {
      type: Boolean,
      default: false,
    },
    genre: {
      type: String,
    },
    tempo: {
      type: Number,
    },
    energy: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Track', TrackSchema); 