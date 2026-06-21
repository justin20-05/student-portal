const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const { logActivity } = require('../utils/activityLog');
const { validatePassword } = require('../utils/passwordPolicy');
const {
  users, mfaSecrets, pendingMfa,
  getLoginAttempts, incrementLoginAttempts, resetLoginAttempts,
  isLocked, getLockoutRemaining, MAX_ATTEMPTS,
} = require('../utils/store');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function generateToken(user, expiresIn = '30m') {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      mfaEnabled: user.mfaEnabled || user.mfa_enabled || false,
      issuedAt: Date.now(),
    },
    JWT_SECRET,
    { expiresIn }
  );
}

async function findUser(email) {
  if (supabase) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    if (error || !data) return null;
    return data;
  }
  return users.get(email.toLowerCase()) || null;
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check lockout
  if (isLocked(normalizedEmail)) {
    const remaining = getLockoutRemaining(normalizedEmail);
    await logActivity(null, 'LOGIN_LOCKED', { email: normalizedEmail }, ip);
    return res.status(429).json({
      error: `Account temporarily locked due to too many failed attempts. Try again in ${Math.ceil(remaining / 60)} minute(s).`,
      locked: true,
      remainingSeconds: remaining,
    });
  }

  const user = await findUser(normalizedEmail);
  if (!user) {
    incrementLoginAttempts(normalizedEmail);
    await logActivity(null, 'LOGIN_FAILED', { email: normalizedEmail, reason: 'User not found' }, ip);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    const attempts = incrementLoginAttempts(normalizedEmail);
    await logActivity(user.id, 'LOGIN_FAILED', { reason: 'Wrong password', attempts: attempts.count }, ip);

    const remaining = MAX_ATTEMPTS - attempts.count;
    if (remaining <= 0) {
      return res.status(429).json({
        error: `Too many failed attempts. Account locked for 15 minutes.`,
        locked: true,
      });
    }
    return res.status(401).json({
      error: `Invalid email or password. ${remaining} attempt(s) remaining.`,
      attemptsRemaining: remaining,
    });
  }

  // Password valid — reset attempts
  resetLoginAttempts(normalizedEmail);

  // Check MFA
  const userMfaSecret = supabase
    ? user.mfa_secret
    : mfaSecrets.get(user.id);

  if (user.mfaEnabled || user.mfa_enabled) {
    // Issue temp token for MFA step
    const tempToken = uuidv4();
    pendingMfa.set(tempToken, { userId: user.id, email: user.email, expiresAt: Date.now() + 5 * 60 * 1000 });

    await logActivity(user.id, 'LOGIN_MFA_REQUIRED', {}, ip);
    return res.json({
      requiresMfa: true,
      tempToken,
      message: 'Enter your 6-digit authenticator code to continue.',
    });
  }

  // Issue JWT
  const token = generateToken(user);
  await logActivity(user.id, 'LOGIN_SUCCESS', { role: user.role }, ip);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId || user.student_id,
      course: user.course,
      yearLevel: user.yearLevel || user.year_level,
      mfaEnabled: user.mfaEnabled || user.mfa_enabled || false
    },
  });
}

// POST /api/auth/verify-mfa
async function verifyMfa(req, res) {
  const { tempToken, code } = req.body;
  const ip = req.ip;

  if (!tempToken || !code) {
    return res.status(400).json({ error: 'Temp token and OTP code are required.' });
  }

  const pending = pendingMfa.get(tempToken);
  if (!pending || Date.now() > pending.expiresAt) {
    pendingMfa.delete(tempToken);
    return res.status(401).json({ error: 'MFA session expired. Please log in again.' });
  }

  const user = await findUser(pending.email);
  if (!user) return res.status(401).json({ error: 'User not found.' });

  const secret = supabase ? user.mfa_secret : mfaSecrets.get(user.id);
  const isValid = authenticator.verify({ token: code, secret });

  if (!isValid) {
    await logActivity(user.id, 'MFA_FAILED', {}, ip);
    return res.status(401).json({ error: 'Invalid OTP code. Please try again.' });
  }

  pendingMfa.delete(tempToken);
  const token = generateToken(user);
  await logActivity(user.id, 'MFA_SUCCESS', { role: user.role }, ip);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId || user.student_id,
      course: user.course,
      yearLevel: user.yearLevel || user.year_level,
      mfaEnabled: user.mfaEnabled || user.mfa_enabled || false,
    },
  });
}

// POST /api/auth/setup-mfa
async function setupMfa(req, res) {
  const user = req.user;
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, 'StudentPortal', secret);
  const qrCode = await QRCode.toDataURL(otpauth);

  // Store secret temporarily
  mfaSecrets.set(user.id, secret);

  if (supabase) {
    await supabase.from('users').update({ mfa_secret: secret }).eq('id', user.id);
  } else {
    const u = users.get(user.email);
    if (u) { u.mfaSecret = secret; users.set(user.email, u); }
  }

  await logActivity(user.id, 'MFA_SETUP_INITIATED', {});
  res.json({ qrCode, secret });
}

// POST /api/auth/confirm-mfa
async function confirmMfa(req, res) {
  const { code } = req.body;
  const userId = req.user.id;
  const userEmail = req.user.email;

  const secret = mfaSecrets.get(userId) ||
    (supabase ? (await supabase.from('users').select('mfa_secret').eq('id', userId).single())?.data?.mfa_secret : null);

  if (!secret) return res.status(400).json({ error: 'MFA setup not initiated.' });

  const isValid = authenticator.verify({ token: code, secret });
  if (!isValid) return res.status(401).json({ error: 'Invalid OTP. Setup failed.' });

  if (supabase) {
    await supabase.from('users').update({ mfa_enabled: true }).eq('id', userId);
  } else {
    const u = users.get(userEmail);
    if (u) { u.mfaEnabled = true; users.set(userEmail, u); }
  }

  const updatedUser = { id: userId, email: userEmail, role: req.user.role, name: req.user.name, mfaEnabled: true };
  const newToken = generateToken(updatedUser);

  await logActivity(userId, 'MFA_ENABLED', {});
  res.json({ message: 'MFA enabled successfully.', token: newToken });
}

// POST /api/auth/logout
async function logout(req, res) {
  if (req.user) {
    await logActivity(req.user.id, 'LOGOUT', {});
  }
  req.session.destroy();
  res.json({ message: 'Logged out successfully.' });
}

// POST /api/auth/change-password
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const userEmail = req.user.email;

  const user = await findUser(userEmail);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

  const policy = validatePassword(newPassword);
  if (!policy.valid) return res.status(400).json({ error: policy.errors.join(' ') });

  const hashed = await bcrypt.hash(newPassword, 12);

  if (supabase) {
    await supabase.from('users').update({ password: hashed }).eq('id', user.id);
  } else {
    user.password = hashed;
    users.set(userEmail, user);
  }

  await logActivity(user.id, 'PASSWORD_CHANGED', {});
  res.json({ message: 'Password changed successfully.' });
}

module.exports = { login, verifyMfa, setupMfa, confirmMfa, logout, changePassword };
