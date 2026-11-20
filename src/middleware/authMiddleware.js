const { verifyToken, hashToken } = require('../utils/token');
const { queryOne } = require('../config/db');

/**
 * Authentication Middleware
 * 
 * 1. Checks Authorization header ('Bearer <token>') and HTTP-only cookie.
 * 2. Validates JWT signature and expiration.
 * 3. Enforces session revocation: checks user_sessions to ensure the token has not been logged out.
 * 4. Ensures the user is still active in the database.
 * 5. Attaches the authenticated user object to req.user.
 */
function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // Fallback to HTTP-only cookie
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    // 2. Verify token signature
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
      });
    }

    // 3. Check Session / Token Revocation table
    const tokenHash = hashToken(token);
    const session = queryOne(
      `SELECT id, revoked_at, datetime(expires_at) as exp, datetime('now') as now_time
       FROM user_sessions
       WHERE token_hash = ?`,
      [tokenHash]
    );

    // If session was explicitly revoked upon logout
    if (session && session.revoked_at) {
      return res.status(401).json({
        success: false,
        message: 'This session has been logged out / revoked. Please log in again.',
      });
    }

    // 4. Verify user exists and is active in database
    const user = queryOne(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // 5. Attach user and token context to request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    req.rawToken = token;
    req.tokenHash = tokenHash;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal authentication error.',
    });
  }
}

module.exports = {
  authenticate,
};
