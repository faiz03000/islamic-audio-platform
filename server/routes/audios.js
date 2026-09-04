import express from 'express';
import multer from 'multer';
import Audio from '../models/Audio.js';
import User from '../models/User.js';
import Report from '../models/Report.js';
import { authenticate, authorizeUser } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Get all public audios with filtering
router.get('/', async (req, res) => {
  try {
    const { category, search, sort = '-createdAt', page = 1, limit = 20 } = req.query;

    const filter = { isPublic: true, isDeleted: false };

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { speaker: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const audios = await Audio.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('uploader', 'name profileImage email');

    const total = await Audio.countDocuments(filter);

    res.json({
      data: audios,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single audio
router.get('/:id', async (req, res) => {
  try {
    const audio = await Audio.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('uploader', 'name profileImage email');

    if (!audio || audio.isDeleted) {
      return res.status(404).json({ error: 'Audio not found' });
    }

    res.json(audio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload audio
router.post('/upload', authenticate, upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'cover', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, description, category, speaker, isPublic } = req.body;
    const user = await User.findById(req.user.id);

    // Check upload limit
    if (user.uploadCount >= user.uploadLimit) {
      return res.status(400).json({ error: 'Upload limit reached' });
    }

    if (!req.files?.audio) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // In production, upload to Cloudinary
    // For now, create placeholder URLs
    const audioUrl = `https://placeholder.audio/${req.files.audio[0].originalname}`;
    const coverImage = req.files.cover ? `https://placeholder.image/${req.files.cover[0].originalname}` : null;

    const audio = await Audio.create({
      title,
      description,
      category,
      speaker,
      audioUrl,
      coverImage,
      uploader: req.user.id,
      isPublic: isPublic === 'true'
    });

    // Update user upload count
    user.uploadCount += 1;
    await user.save();

    await audio.populate('uploader', 'name profileImage');
    res.status(201).json(audio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update audio
router.put('/:id', authenticate, async (req, res) => {
  try {
    const audio = await Audio.findById(req.params.id);

    if (!audio) return res.status(404).json({ error: 'Audio not found' });
    if (audio.uploader.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { title, description, category, speaker, isPublic, coverImage } = req.body;
    Object.assign(audio, { title, description, category, speaker, isPublic, coverImage });
    await audio.save();

    res.json(audio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete audio
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const audio = await Audio.findById(req.params.id);

    if (!audio) return res.status(404).json({ error: 'Audio not found' });
    if (audio.uploader.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    audio.isDeleted = true;
    audio.deletedAt = new Date();
    audio.deletedBy = req.user.id;
    await audio.save();

    res.json({ message: 'Audio deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like/Unlike audio
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const audio = await Audio.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { likes: req.user.id } },
      { new: true }
    );

    res.json(audio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/unlike', authenticate, async (req, res) => {
  try {
    const audio = await Audio.findByIdAndUpdate(
      req.params.id,
      { $pull: { likes: req.user.id } },
      { new: true }
    );

    res.json(audio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Report audio
router.post('/:id/report', authenticate, async (req, res) => {
  try {
    const { reason, description } = req.body;
    const audio = await Audio.findById(req.params.id);

    if (!audio) return res.status(404).json({ error: 'Audio not found' });

    const report = await Report.create({
      type: 'audio',
      targetId: req.params.id,
      targetModel: 'Audio',
      reporter: req.user.id,
      reason,
      description
    });

    // Add to audio reports
    audio.reports.push({
      reporter: req.user.id,
      reason
    });
    await audio.save();

    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add to recently played
router.post('/:id/play', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.recentlyPlayed = user.recentlyPlayed.filter(
      item => item.audio.toString() !== req.params.id
    );
    user.recentlyPlayed.unshift({ audio: req.params.id });
    user.recentlyPlayed = user.recentlyPlayed.slice(0, 50); // Keep last 50
    await user.save();

    res.json({ message: 'Added to recently played' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
