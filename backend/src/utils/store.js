const bcrypt = require('bcryptjs');

// In-memory store when Supabase not configured
const loginAttempts = new Map(); // email -> { count, lockedUntil }
const otpAttempts = new Map(); // tempToken -> { count, lockedUntil }
const users = new Map();
const mfaSecrets = new Map(); // userId -> secret
const pendingMfa = new Map(); // tempToken -> userId
const revokedTokens = new Set();

const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5;
const OTP_LOCKOUT_DURATION = parseInt(process.env.OTP_LOCKOUT_DURATION, 10) * 1000 || 10 * 60 * 1000;

// Seed demo users
function seedDemoUsers() {
  const adminHash = bcrypt.hashSync('Admin@Portal2024!', 12);
  const studentHash = bcrypt.hashSync('Student@Portal2024!', 12);

  users.set('admin@portal.edu', {
    id: 'admin-001',
    email: 'admin@portal.edu',
    password: adminHash,
    role: 'admin',
    name: 'System Administrator',
    mfaEnabled: false,
    mfaSecret: null,
    studentId: null,
    course: null,
    yearLevel: null,
  });

  users.set('student@portal.edu', {
    id: 'student-001',
    email: 'student@portal.edu',
    password: studentHash,
    role: 'student',
    name: 'Juan dela Cruz',
    mfaEnabled: false,
    mfaSecret: null,
    studentId: '2024-00001',
    course: 'BS Information Technology',
    yearLevel: '3rd Year',
  });

  users.set('mfa@portal.edu', {
    id: 'mfa-001',
    email: 'mfa@portal.edu',
    password: bcrypt.hashSync('MfaUser@2026!', 12),
    role: 'student',
    name: 'MFA Test User',
    mfaEnabled: true,
    mfaSecret: 'JBSWY3DPEHPK3PXP',
    studentId: '2024-00002',
    course: 'BS Information Technology',
    yearLevel: '2nd Year',
  });
}

seedDemoUsers();

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 10 * 60 * 1000; 

function getLoginAttempts(email) {
  const record = loginAttempts.get(email) || { count: 0, lockedUntil: null };
  if (record.lockedUntil && Date.now() > record.lockedUntil) {
    loginAttempts.delete(email);
    return { count: 0, lockedUntil: null };
  }
  return record;
}

function incrementLoginAttempts(email) {
  const record = getLoginAttempts(email);
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }
  loginAttempts.set(email, record);
  return record;
}

function resetLoginAttempts(email) {
  loginAttempts.delete(email);
}

function isLocked(email) {
  const record = getLoginAttempts(email);
  return record.lockedUntil && Date.now() < record.lockedUntil;
}

function getLockoutRemaining(email) {
  const record = getLoginAttempts(email);
  if (!record.lockedUntil) return 0;
  return Math.ceil((record.lockedUntil - Date.now()) / 1000);
}

function getOtpAttempts(tempToken) {
  const record = otpAttempts.get(tempToken) || { count: 0, lockedUntil: null };
  if (record.lockedUntil && Date.now() > record.lockedUntil) {
    otpAttempts.delete(tempToken);
    return { count: 0, lockedUntil: null };
  }
  return record;
}

function incrementOtpAttempts(tempToken) {
  const record = getOtpAttempts(tempToken);
  record.count += 1;
  if (record.count >= OTP_MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + OTP_LOCKOUT_DURATION;
  }
  otpAttempts.set(tempToken, record);
  return record;
}

function resetOtpAttempts(tempToken) {
  otpAttempts.delete(tempToken);
}

function isOtpLocked(tempToken) {
  const record = getOtpAttempts(tempToken);
  return record.lockedUntil && Date.now() < record.lockedUntil;
}

function getOtpLockoutRemaining(tempToken) {
  const record = getOtpAttempts(tempToken);
  if (!record.lockedUntil) return 0;
  return Math.ceil((record.lockedUntil - Date.now()) / 1000);
}

function revokeToken(token) {
  revokedTokens.add(token);
}

function isTokenRevoked(token) {
  return revokedTokens.has(token);
}

module.exports = {
  users,
  mfaSecrets,
  pendingMfa,
  getLoginAttempts,
  incrementLoginAttempts,
  resetLoginAttempts,
  isLocked,
  getLockoutRemaining,
  getOtpAttempts,
  incrementOtpAttempts,
  resetOtpAttempts,
  isOtpLocked,
  getOtpLockoutRemaining,
  revokeToken,
  isTokenRevoked,
  MAX_ATTEMPTS,
  OTP_MAX_ATTEMPTS,
  OTP_LOCKOUT_DURATION,
};
