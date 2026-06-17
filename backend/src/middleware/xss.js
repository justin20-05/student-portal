const xss = require('xss');

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return xss(value, {
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script'],
    });
  }
  if (typeof value === 'object' && value !== null) {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeValue);
  }
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    sanitized[key] = sanitizeValue(obj[key]);
  }
  return sanitized;
}

function xssClean(req, res, next) {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
}

module.exports = { xssClean };
