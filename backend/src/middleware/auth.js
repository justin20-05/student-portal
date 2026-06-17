const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');
const { logActivity } = require('../utils/activityLog');

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-in-production');
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    // Check session timeout
    if (Date.now() - decoded.issuedAt > SESSION_TIMEOUT_MS) {
      return res.status(401).json({ error: 'Session expired. Please log in again.', code: 'SESSION_EXPIRED' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      logActivity(req.user.id, 'UNAUTHORIZED_ACCESS', {
        attemptedRoute: req.originalUrl,
        userRole: req.user.role,
      }).catch(console.error);
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
