const { ALL_ROLES } = require('../constants/roles');
const { validatePasswordStrength } = require('../utils/password');

// Standard RFC-compliant email regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate customer registration input
 */
function validateRegister(req, res, next) {
  const { name, email, password, phone } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('Please provide a valid email address');
  }

  const passCheck = validatePasswordStrength(password);
  if (!passCheck.isValid) {
    errors.push(passCheck.message);
  }

  if (phone && (typeof phone !== 'string' || phone.trim().length < 7)) {
    errors.push('Phone number must be at least 7 characters long');
  }

  // Security check: Guard against role injection in public signup
  if (req.body.role && req.body.role !== 'CUSTOMER') {
    // We intentionally enforce CUSTOMER role for public signup
    req.body.role = 'CUSTOMER';
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // Sanitize
  req.body.name = name.trim();
  req.body.email = email.trim().toLowerCase();
  if (phone) req.body.phone = phone.trim();

  next();
}

/**
 * Validate login credentials
 */
function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('Please provide a valid email address');
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body.email = email.trim().toLowerCase();
  next();
}

/**
 * Validate forgot password request
 */
function validateForgotPassword(req, res, next) {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address',
    });
  }

  req.body.email = email.trim().toLowerCase();
  next();
}

/**
 * Validate password reset request
 */
function validateResetPassword(req, res, next) {
  const { token, newPassword } = req.body;
  const errors = [];

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    errors.push('Reset token is required');
  }

  const passCheck = validatePasswordStrength(newPassword);
  if (!passCheck.isValid) {
    errors.push(passCheck.message);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body.token = token.trim();
  next();
}

/**
 * Validate password update for logged-in user
 */
function validateUpdatePassword(req, res, next) {
  const { currentPassword, newPassword } = req.body;
  const errors = [];

  if (!currentPassword || typeof currentPassword !== 'string') {
    errors.push('Current password is required');
  }

  const passCheck = validatePasswordStrength(newPassword);
  if (!passCheck.isValid) {
    errors.push(passCheck.message);
  }

  if (currentPassword === newPassword) {
    errors.push('New password must be different from current password');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  next();
}

/**
 * Validate admin creation of new user (Staff / Organizer / Admin)
 */
function validateAdminCreateUser(req, res, next) {
  const { name, email, password, role, phone } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('Please provide a valid email address');
  }

  const passCheck = validatePasswordStrength(password);
  if (!passCheck.isValid) {
    errors.push(passCheck.message);
  }

  if (!role || !ALL_ROLES.includes(role)) {
    errors.push(`Role must be one of: ${ALL_ROLES.join(', ')}`);
  }

  if (phone && (typeof phone !== 'string' || phone.trim().length < 7)) {
    errors.push('Phone number must be at least 7 characters long');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body.name = name.trim();
  req.body.email = email.trim().toLowerCase();
  req.body.role = role.trim().toUpperCase();
  if (phone) req.body.phone = phone.trim();

  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateUpdatePassword,
  validateAdminCreateUser,
};
