const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/rbacMiddleware');
const { validateAdminCreateUser } = require('../middleware/validateMiddleware');
const { ROLES } = require('../constants/roles');

// Apply Authentication and Strict Admin RBAC
router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

/**
 * Admin Dashboard Overview
 */
router.get('/dashboard', (req, res) => {
  return res.status(200).json({
    success: true,
    message: `Welcome to the Admin Control Panel, ${req.user.name}!`,
    admin: req.user,
    privileges: [
      'Manage User Accounts (Create Staff/Organizers, Toggle Active Status)',
      'Inspect System Sessions & Audit Logs',
      'Generate Platform Reports',
      'Global System Settings',
    ],
  });
});

/**
 * Admin: List all registered users
 */
router.get('/users', adminController.getAllUsers);

/**
 * Admin: Create restricted user account (Staff, Organizer, Admin)
 */
router.post('/users', validateAdminCreateUser, adminController.createStaffUser);

/**
 * Admin: Activate / Deactivate user account
 */
router.patch('/users/:id/status', adminController.toggleUserStatus);

/**
 * Admin: Platform metrics and reports
 */
router.get('/reports', adminController.getReports);

module.exports = router;
