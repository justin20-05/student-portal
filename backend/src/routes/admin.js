const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getActivityLogs } = require('../utils/activityLog');

// Secure activity logs fetch for administrators
router.get('/logs', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const logs = await getActivityLogs(null, 100);
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
