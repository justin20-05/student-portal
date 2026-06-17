const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

// Secure profile data fetch for logged-in students
router.get('/profile', authenticate, requireRole('student'), (req, res) => {
  res.json({
    message: "Secure student dashboard data pulled successfully.",
    gpa: "3.75",
    enrolledCredits: 15,
    schedule: [
      { course: "CS 301 - Advanced Web Architecture", time: "MWF 9:00 AM" },
      { course: "CS 312 - Systems Security", time: "TTH 1:30 PM" }
    ]
  });
});

module.exports = router;
