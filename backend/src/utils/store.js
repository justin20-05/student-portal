const bcrypt = require('bcryptjs');

// In-memory store when Supabase not configured
const loginAttempts = new Map(); // email -> { count, lockedUntil }
const users = new Map();
const mfaSecrets = new Map(); // userId -> secret
const pendingMfa = new Map(); // tempToken -> userId

// Seed demo users
async function seedDemoUsers() {
  const adminHash = await bcrypt.hash('Admin@Portal2024!', 12);
  const studentHash = await bcrypt.hash('Student@Portal2024!', 12);

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
}

seedDemoUsers();

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 min

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

module.exports = {
  users,
  mfaSecrets,
  pendingMfa,
  getLoginAttempts,
  incrementLoginAttempts,
  resetLoginAttempts,
  isLocked,
  getLockoutRemaining,
  MAX_ATTEMPTS,
};
