import express from 'express';
import User from '../models/User.js';
import Audio from '../models/Audio.js';
import Report from '../models/Report.js';
import { authenticate, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all users
router.get('/users', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const users = await User.find(filter)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort('-createdAt');

    const total = await User.countDocuments(filter);

    res.json({
      data: users,
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

// Get user details
router.get('/users/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('followers following');

    if (!user) return res.status(404).json({ error: 'User not found' });

    const audios = await Audio.find({
      uploader: req.params.id
    }).select('title category views likes');

    res.json({ ...user.toObject(), audios });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete/Suspend user account
router.delete('/users/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Mark user as inactive instead of hard delete
    user.isActive = false;
    await user.save();

    // Optionally mark all their audios as deleted
    const { hardDelete } = req.body;
    if (hardDelete) {
      await Audio.updateMany(
        { uploader: req.params.id },
        { isDeleted: true, deletedBy: req.user.id }
      );
    }

    res.json({ message: 'User account disabled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all reports
router.get('/reports', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};

    const skip = (page - 1) * limit;
    const reports = await Report.find(filter)
      .populate('reporter', 'name email')
      .populate('resolvedBy', 'name')
      .skip(skip)
      .limit(parseInt(limit))
      .sort('-createdAt');

    const total = await Report.countDocuments(filter);

    res.json({
      data: reports,
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

// Resolve report
router.put('/reports/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { status, action, adminNotes } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        status,
        action,
        adminNotes,
        resolvedBy: req.user.id,
        resolvedAt: new Date()
      },
      { new: true }
    );

    // Execute action
    if (action === 'content_removed') {
      await Audio.findByIdAndUpdate(report.targetId, {
        isDeleted: true,
        deletedBy: req.user.id
      });
    } else if (action === 'account_suspended') {
      await User.findByIdAndUpdate(report.targetId, { isActive: false });
    } else if (action === 'account_deleted') {
      const user = await User.findById(report.targetId);
      user.isActive = false;
      await user.save();
      await Audio.updateMany({ uploader: report.targetId }, { isDeleted: true });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete audio by admin
router.delete('/audios/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const audio = await Audio.findByIdAndUpdate(
      req.params.id,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user.id
      },
      { new: true }
    );

    res.json({ message: 'Audio deleted by admin', audio });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get platform statistics
router.get('/stats/overview', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAudios = await Audio.countDocuments({ isDeleted: false });
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });

    const audioCategoryCounts = await Audio.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    res.json({
      totalUsers,
      totalAudios,
      totalReports,
      pendingReports,
      audioCategoryCounts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manage categories
router.post('/categories', authenticate, authorizeAdmin, async (req, res) => {
  try {
    // Category management would require a separate Category model
    res.json({ message: 'Category management endpoint' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
