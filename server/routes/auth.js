import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Google OAuth login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  const token = jwt.sign(
    { id: req.user._id, email: req.user.email, role: req.user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

  // Redirect to frontend with token
  res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('followers following');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Logged out successfully' });
  });
});

export default router;
