import express from 'express';
import User from '../models/User.js';
import Audio from '../models/Audio.js';
import { authenticate, authorizeUser } from '../middleware/auth.js';

const router = express.Router();

// Get user profile
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('followers following')
      .lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get user's public audios
    const audios = await Audio.find({
      uploader: req.params.id,
      isPublic: true,
      isDeleted: false
    }).select('title category speaker coverImage duration').lean();

    res.json({ ...user, audios });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/profile/:id', authenticate, async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { name, bio, profileImage } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, bio, profileImage },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Follow user
router.post('/:id/follow', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const targetUser = await User.findByIdAndUpdate(
      targetUserId,
      { $addToSet: { followers: currentUserId } },
      { new: true }
    );

    await User.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { following: targetUserId } }
    );

    res.json(targetUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unfollow user
router.post('/:id/unfollow', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    const targetUser = await User.findByIdAndUpdate(
      targetUserId,
      { $pull: { followers: currentUserId } },
      { new: true }
    );

    await User.findByIdAndUpdate(
      currentUserId,
      { $pull: { following: targetUserId } }
    );

    res.json(targetUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's uploaded content
router.get('/:id/uploads', async (req, res) => {
  try {
    const audios = await Audio.find({
      uploader: req.params.id,
      isDeleted: false
    }).populate('uploader', 'name profileImage');

    res.json(audios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add to favorites
router.post('/favorites/add', authenticate, async (req, res) => {
  try {
    const { audioId } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { favorites: audioId } },
      { new: true }
    ).populate('favorites');

    res.json(user.favorites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove from favorites
router.post('/favorites/remove', authenticate, async (req, res) => {
  try {
    const { audioId } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { favorites: audioId } },
      { new: true }
    ).populate('favorites');

    res.json(user.favorites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's recently played
router.get('/:id/recently-played', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate({
        path: 'recentlyPlayed.audio',
        select: 'title speaker category duration coverImage'
      })
      .select('recentlyPlayed');

    res.json(user?.recentlyPlayed || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
