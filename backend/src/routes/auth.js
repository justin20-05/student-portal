const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Public auth routes
router.post('/login', authController.login);
router.post('/verify-mfa', authController.verifyMfa);

// Protected auth routes (Require active authentication)
router.post('/setup-mfa', authenticate, authController.setupMfa);
router.post('/confirm-mfa', authenticate, authController.confirmMfa);
router.post('/disable-mfa', authenticate, authController.disableMfa);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
