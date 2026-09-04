import mongoose from 'mongoose';

const audioSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['Quran', 'Tafsir', 'Hadith', 'Khutbah', 'Lectures', 'Nasheed', 'Dua', 'Reminders', 'Other'],
    required: true
  },
  speaker: {
    type: String,
    required: true
  },
  coverImage: {
    type: String,
    default: null
  },
  audioUrl: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reports: [{
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for faster queries
audioSchema.index({ category: 1 });
audioSchema.index({ uploader: 1 });
audioSchema.index({ isPublic: 1 });
audioSchema.index({ createdAt: -1 });

export default mongoose.model('Audio', audioSchema);
