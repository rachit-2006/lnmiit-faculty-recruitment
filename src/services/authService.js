// Authentication Service implementing scrypt password hashing & session management
const crypto = require('crypto');
const config = require('../config');

// Promisified crypto.scrypt
function scryptAsync(password, salt, keylen) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey);
    });
  });
}

/**
 * Hash password using crypto.scrypt with a unique random salt
 * @param {string} password 
 * @returns {Promise<string>} Format: "salt:derivedKeyHex"
 */
async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify password against stored hash using constant-time comparison
 * @param {string} password 
 * @param {string} storedHash Format: "salt:derivedKeyHex"
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, expectedKeyHex] = parts;
  try {
    const derivedKey = await scryptAsync(password, salt, 64);
    const expectedKey = Buffer.from(expectedKeyHex, 'hex');
    if (derivedKey.length !== expectedKey.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedKey, expectedKey);
  } catch (err) {
    return false;
  }
}

/**
 * Generate a cryptographically secure random session token
 * @returns {string} 64-character hex string
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate registration input fields
 * @param {Object} input 
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
function validateRegistrationInput(input) {
  const errors = [];
  const { name, email, password, confirmPassword, phone } = input || {};

  // 1. Mandatory Name
  if (!name || !name.trim()) {
    errors.push({ field: 'name', message: 'Full name is required.' });
  }

  // 2. Mandatory & Valid Email Format
  if (!email || !email.trim()) {
    errors.push({ field: 'email', message: 'Email address is required.' });
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push({ field: 'email', message: 'Please provide a valid email address.' });
    }
  }

  // 3. Password length >= 10
  if (!password) {
    errors.push({ field: 'password', message: 'Password is required.' });
  } else if (password.length < config.PASSWORD_MIN_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must contain at least ${config.PASSWORD_MIN_LENGTH} characters.`
    });
  }

  // 4. Password and Confirm Password match
  if (!confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Please confirm your password.' });
  } else if (password !== confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Password and Confirm Password do not match.' });
  }

  // 5. Optional Phone validation
  if (phone && phone.trim()) {
    const phoneClean = phone.trim().replace(/[\s\-()]/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(phoneClean)) {
      errors.push({ field: 'phone', message: 'Enter a valid 10-digit phone number.' });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  validateRegistrationInput
};
