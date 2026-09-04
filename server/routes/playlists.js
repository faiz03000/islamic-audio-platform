import express from 'express';
import Playlist from '../models/Playlist.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all playlists
router.get('/', async (req, res) => {
  try {
    const playlists = await Playlist.find({ isPublic: true })
      .populate('creator', 'name profileImage')
      .populate('audios', 'title speaker duration');

    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's playlists
router.get('/user/:userId', async (req, res) => {
  try {
    const playlists = await Playlist.find({ creator: req.params.userId })
      .populate('audios', 'title speaker duration');

    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single playlist
router.get('/:id', async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('creator', 'name profileImage email')
      .populate('audios')
      .populate('followers', 'name profileImage');

    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create playlist
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const playlist = await Playlist.create({
      name,
      description,
      isPublic,
      creator: req.user.id
    });

    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update playlist
router.put('/:id', authenticate, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (playlist.creator.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { name, description, isPublic, coverImage } = req.body;
    Object.assign(playlist, { name, description, isPublic, coverImage });
    await playlist.save();

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add audio to playlist
router.post('/:id/add-audio', authenticate, async (req, res) => {
  try {
    const { audioId } = req.body;
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (playlist.creator.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    playlist.audios.addToSet(audioId);
    await playlist.save();

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove audio from playlist
router.post('/:id/remove-audio', authenticate, async (req, res) => {
  try {
    const { audioId } = req.body;
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (playlist.creator.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    playlist.audios.pull(audioId);
    await playlist.save();

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Follow playlist
router.post('/:id/follow', authenticate, async (req, res) => {
  try {
    const playlist = await Playlist.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { followers: req.user.id } },
      { new: true }
    );

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unfollow playlist
router.post('/:id/unfollow', authenticate, async (req, res) => {
  try {
    const playlist = await Playlist.findByIdAndUpdate(
      req.params.id,
      { $pull: { followers: req.user.id } },
      { new: true }
    );

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete playlist
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (playlist.creator.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Playlist.deleteOne({ _id: req.params.id });
    res.json({ message: 'Playlist deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
