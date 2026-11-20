const { queryOne, run } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken, hashToken, generateRandomToken } = require('../utils/token');
const { ROLES } = require('../constants/roles');
const config = require('../config/env');

/**
 * Register a new Customer account (Public signup)
 * 
 * Enforces role isolation: Even if an attacker attempts to send 'role: ADMIN',
 * public signup strictly assigns the 'CUSTOMER' role.
 */
async function register(req, res) {
  try {
    const { name, email, phone, password } = req.body;

    // Check if user already exists
    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Retrieve CUSTOMER role ID
    const customerRole = queryOne('SELECT id FROM roles WHERE name = ?', [ROLES.CUSTOMER]);
    if (!customerRole) {
      return res.status(500).json({
        success: false,
        message: 'System role configuration error: CUSTOMER role not found.',
      });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Insert user into database
    const insertResult = run(
      `INSERT INTO users (role_id, name, email, phone, password_hash, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [customerRole.id, name, email, phone || null, hashedPassword]
    );

    const userId = Number(insertResult.lastInsertRowid);

    // Generate JWT
    const payload = { id: userId, email, role: ROLES.CUSTOMER };
    const token = signToken(payload);

    // Record session for logout/revocation tracking (expires in 1 day)
    const tokenHash = hashToken(token);
    run(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
       VALUES (?, ?, datetime('now', '+1 day'))
       ON CONFLICT(token_hash) DO UPDATE SET revoked_at = NULL, expires_at = excluded.expires_at`,
      [userId, tokenHash]
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      message: 'Customer account registered successfully.',
      token,
      user: {
        id: userId,
        name,
        email,
        phone: phone || null,
        role: ROLES.CUSTOMER,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register account.',
      error: error.message,
    });
  }
}

/**
 * Login user (Customer, Organizer, Admin)
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Find user with joined role name
    const user = queryOne(
      `SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.is_active, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Verify account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Please contact an administrator.',
      });
    }

    // Verify password hash
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Issue JWT
    const payload = { id: user.id, email: user.email, role: user.role };
    const token = signToken(payload);

    // Save session in user_sessions table
    const tokenHash = hashToken(token);
    run(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
       VALUES (?, ?, datetime('now', '+1 day'))
       ON CONFLICT(token_hash) DO UPDATE SET revoked_at = NULL, expires_at = excluded.expires_at`,
      [user.id, tokenHash]
    );

    // Send HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed due to a server error.',
      error: error.message,
    });
  }
}

/**
 * Logout user
 * 
 * Secure token invalidation: Marks session as revoked in the database
 * so the token cannot be reused even if retained by the client.
 */
async function logout(req, res) {
  try {
    if (req.tokenHash) {
      // Mark token as revoked in database
      run(
        `UPDATE user_sessions 
         SET revoked_at = CURRENT_TIMESTAMP 
         WHERE token_hash = ?`,
        [req.tokenHash]
      );
    }

    // Clear HTTP-only cookie
    res.clearCookie('token');

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully. Session invalidated.',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error during logout.',
      error: error.message,
    });
  }
}

/**
 * Get current authenticated user profile
 */
async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
}

/**
 * Forgot Password - Generates a secure reset token
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    const user = queryOne('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (!user) {
      // Return a safe message to avoid user enumeration attacks
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been generated.',
      });
    }

    // Generate random 32-byte hex token
    const rawResetToken = generateRandomToken(32);
    const tokenHash = hashToken(rawResetToken);

    // Save token hash in password_resets table with 1 hour expiration
    run(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES (?, ?, datetime('now', '+1 hour'))`,
      [user.id, tokenHash]
    );

    // In a production app, an email with the link is dispatched.
    // For local development and SYP demonstration, we return the token in the response.
    const resetUrl = `http://localhost:${config.port}/api/auth/reset-password?token=${rawResetToken}`;

    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been generated.',
      developmentInfo: {
        rawResetToken,
        resetUrl,
        expiresIn: '1 hour',
      },
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process forgot password request.',
      error: error.message,
    });
  }
}

/**
 * Reset Password using token
 */
async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;

    const tokenHash = hashToken(token);

    // Find valid, unexpired, and unused reset token
    const resetRecord = queryOne(
      `SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at
       FROM password_resets pr
       WHERE pr.token_hash = ?
         AND pr.used_at IS NULL
         AND datetime(pr.expires_at) > datetime('now')`,
      [tokenHash]
    );

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid, expired, or has already been used.',
      });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user's password
    run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      hashedPassword,
      resetRecord.user_id,
    ]);

    // Mark reset token as used
    run('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [resetRecord.id]);

    // Revoke all existing active sessions for this user (security best practice)
    run(
      `UPDATE user_sessions 
       SET revoked_at = CURRENT_TIMESTAMP 
       WHERE user_id = ? AND revoked_at IS NULL`,
      [resetRecord.user_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Password has been successfully reset. Please log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password.',
      error: error.message,
    });
  }
}

/**
 * Update Password (Authenticated user)
 */
async function updatePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Fetch user password hash
    const user = queryOne('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify current password
    const isMatch = await comparePassword(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password does not match.',
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      hashedPassword,
      userId,
    ]);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('Update password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update password.',
      error: error.message,
    });
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updatePassword,
};
