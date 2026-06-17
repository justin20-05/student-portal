/**
 * Password Policy:
 * - Minimum 12 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 * - No common patterns
 */

const COMMON_PASSWORDS = [
  'password', 'password123', '123456789', 'qwerty', 'admin123',
  'letmein', 'welcome', 'monkey', 'dragon', 'master',
];

function validatePassword(password) {
  const errors = [];

  if (!password || password.length < 12) {
    errors.push('Password must be at least 12 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter.');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number.');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character.');
  }

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.some(p => lower.includes(p))) {
    errors.push('Password is too common or contains common patterns.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = { validatePassword };
