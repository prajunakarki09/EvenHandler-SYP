const { queryOne, queryAll, run } = require('../config/db');
const { hashPassword } = require('../utils/password');

/**
 * Admin: Create restricted user accounts (Staff, Organizer, or additional Admins)
 */
async function createStaffUser(req, res) {
  try {
    const { name, email, phone, password, role } = req.body;

    // Check if user already exists
    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    // Lookup role ID
    const targetRole = queryOne('SELECT id, name FROM roles WHERE name = ?', [role]);
    if (!targetRole) {
      return res.status(400).json({
        success: false,
        message: `Role '${role}' is not recognized in the system.`,
      });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Insert user
    const insertResult = run(
      `INSERT INTO users (role_id, name, email, phone, password_hash, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [targetRole.id, name, email, phone || null, hashedPassword]
    );

    const newUserId = Number(insertResult.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: `${role} account created successfully by Administrator.`,
      user: {
        id: newUserId,
        name,
        email,
        phone: phone || null,
        role: targetRole.name,
        isActive: 1,
      },
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create user account.',
      error: error.message,
    });
  }
}

/**
 * Admin: List all users in the system
 */
async function getAllUsers(req, res) {
  try {
    const users = queryAll(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error('Admin getAllUsers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users.',
      error: error.message,
    });
  }
}

/**
 * Admin: Activate or deactivate a user account
 */
async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = queryOne('SELECT id, name, email FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Prevent admin from deactivating their own account
    if (user.id === req.user.id && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'Administrators cannot deactivate their own account.',
      });
    }

    const newStatus = isActive ? 1 : 0;
    run('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      newStatus,
      id,
    ]);

    // If deactivated, revoke all active sessions immediately
    if (newStatus === 0) {
      run(
        `UPDATE user_sessions 
         SET revoked_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND revoked_at IS NULL`,
        [id]
      );
    }

    return res.status(200).json({
      success: true,
      message: `User '${user.name}' has been ${newStatus ? 'activated' : 'deactivated'}.`,
      userId: id,
      isActive: Boolean(newStatus),
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user status.',
      error: error.message,
    });
  }
}

/**
 * Admin: View overall platform metrics
 */
async function getReports(req, res) {
  try {
    const roleCounts = queryAll(
      `SELECT r.name AS role, COUNT(u.id) AS total_users
       FROM roles r
       LEFT JOIN users u ON r.id = u.role_id
       GROUP BY r.name`
    );

    const activeSessions = queryOne(
      `SELECT COUNT(id) AS active_sessions
       FROM user_sessions
       WHERE revoked_at IS NULL AND datetime(expires_at) > datetime('now')`
    );

    return res.status(200).json({
      success: true,
      overview: {
        roleBreakdown: roleCounts,
        activeSessions: activeSessions ? activeSessions.active_sessions : 0,
        systemStatus: 'Healthy',
      },
    });
  } catch (error) {
    console.error('Admin getReports error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate reports.',
      error: error.message,
    });
  }
}

module.exports = {
  createStaffUser,
  getAllUsers,
  toggleUserStatus,
  getReports,
};
