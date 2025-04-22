const mongoose = require('mongoose');

const PlaylistSchema = new mongoose.Schema(
  {
    gym: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    spotifyId: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    tracks: [
      {
        track: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Track',
        },
        position: {
          type: Number,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
        lastPlayedAt: {
          type: Date,
        },
        playCount: {
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

// Method to add a track to playlist
PlaylistSchema.methods.addTrack = function (trackId) {
  const trackExists = this.tracks.some(
    (item) => item.track.toString() === trackId.toString()
  );

  if (!trackExists) {
    this.tracks.push({
      track: trackId,
      position: this.tracks.length,
      addedAt: Date.now(),
      playCount: 0,
    });
  }
  return this.save();
};

// Method to remove a track from playlist
PlaylistSchema.methods.removeTrack = function (trackId) {
  this.tracks = this.tracks.filter(
    (item) => item.track.toString() !== trackId.toString()
  );
  return this.save();
};

// Method to reorder tracks
PlaylistSchema.methods.reorderTracks = function (trackOrder) {
  // trackOrder is an array of track IDs in the new order
  this.tracks.sort((a, b) => {
    const indexA = trackOrder.indexOf(a.track.toString());
    const indexB = trackOrder.indexOf(b.track.toString());
    return indexA - indexB;
  });

  // Update position values
  this.tracks.forEach((item, index) => {
    item.position = index;
  });

  return this.save();
};

// Method to mark a track as played
PlaylistSchema.methods.markTrackPlayed = function (trackId) {
  const trackIndex = this.tracks.findIndex(
    (item) => item.track.toString() === trackId.toString()
  );

  if (trackIndex !== -1) {
    this.tracks[trackIndex].lastPlayedAt = Date.now();
    this.tracks[trackIndex].playCount += 1;
    return this.save();
  }

  return Promise.reject(new Error('Track not found in playlist'));
};

module.exports = mongoose.model('Playlist', PlaylistSchema); 