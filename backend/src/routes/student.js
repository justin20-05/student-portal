const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/profile', authenticate, requireRole('student'), (req, res) => {
  res.json({
    message: "Secure student dashboard data pulled successfully.",
    gpa: "3.75",
    enrolledCredits: 15,
    schedule: [
      { course: "IT 123 - Information Assurance and Security", time: "MWF 9:00 AM" },
      { course: "IT 321 - Capstone 1", time: "TTH 1:30 PM" }
    ]
  });
});

module.exports = router;
