const crypto = require('crypto');

// Simple double-submit cookie CSRF protection
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function csrfTokenRoute(req, res) {
  let token = req.session.csrfToken;
  if (!token) {
    token = generateToken();
    req.session.csrfToken = token;
  }
  res.json({ csrfToken: token });
}

function csrfMiddleware(req, res, next) {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const sessionToken = req.session.csrfToken;
  const requestToken = req.headers['x-csrf-token'] || req.body?._csrf;

  if (!sessionToken || !requestToken || sessionToken !== requestToken) {
    return res.status(403).json({ error: 'Invalid CSRF token. Please refresh and try again.' });
  }

  next();
}

module.exports = { csrfMiddleware, csrfTokenRoute };
