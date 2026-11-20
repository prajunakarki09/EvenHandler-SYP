const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');

/**
 * Sign a new JWT with user payload
 * @param {object} payload - { id, email, role }
 * @param {string} [expiresIn] - Optional custom expiration (e.g. '1d')
 * @returns {string}
 */
function signToken(payload, expiresIn = config.jwtExpiresIn) {
  // RFC 7519 jti (JWT ID): Guarantees every issued token is cryptographically unique
  const tokenPayload = {
    ...payload,
    jti: payload.jti || crypto.randomUUID(),
  };
  return jwt.sign(tokenPayload, config.jwtSecret, { expiresIn });
}

/**
 * Verify and decode a JWT
 * @param {string} token 
 * @returns {object} Decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

/**
 * Hash any token string using SHA-256
 * Used for storing reset tokens & session identifiers in database without keeping raw secrets
 * @param {string} rawToken 
 * @returns {string} 64-character hex string
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generate a cryptographically random token string
 * @param {number} bytes - Number of random bytes (default 32)
 * @returns {string}
 */
function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
  signToken,
  verifyToken,
  hashToken,
  generateRandomToken,
};
