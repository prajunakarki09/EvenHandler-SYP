const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/rbacMiddleware');
const { ROLES } = require('../constants/roles');

// Apply Authentication and Staff/Organizer RBAC authorization
// Admins are also permitted to view organizer routes
router.use(authenticate);
router.use(authorize(ROLES.ORGANIZER, ROLES.ADMIN));

/**
 * Organizer Dashboard Overview
 */
router.get('/dashboard', (req, res) => {
  return res.status(200).json({
    success: true,
    message: `Welcome to Organizer Coordination Hub, ${req.user.name}!`,
    organizer: req.user,
    stats: {
      pendingRequests: 4,
      eventsInProgress: 2,
      completedThisMonth: 8,
      vendorsCoordinated: ['Catering Services', 'Floral Decoration', 'Stage & Sound', 'Bridal Makeup'],
    },
  });
});

/**
 * Organizer: View Pending Event Requests
 */
router.get('/requests', (req, res) => {
  return res.status(200).json({
    success: true,
    requests: [
      {
        id: 'REQ-101',
        customerName: 'Alice Green',
        customerEmail: 'alice@example.com',
        eventType: 'Golden Jubilee Celebration',
        eventDate: '2026-12-15',
        vendorsNeeded: ['Catering', 'Decoration', 'Entertainment'],
        assignedStaff: req.user.name,
        status: 'COORDINATION_IN_PROGRESS',
      },
      {
        id: 'REQ-102',
        customerName: 'Robert Smith',
        customerEmail: 'robert@example.com',
        eventType: 'Destination Wedding',
        eventDate: '2027-01-20',
        vendorsNeeded: ['Catering', 'Floral Decor', 'Makeup', 'Photography', 'DJ'],
        assignedStaff: 'Unassigned',
        status: 'AWAITING_ORGANIZER',
      },
    ],
  });
});

/**
 * Organizer: Update Activity Status / Assign Vendor
 */
router.patch('/requests/:id/assign', (req, res) => {
  const { id } = req.params;
  const { vendorType, vendorName, status } = req.body;

  return res.status(200).json({
    success: true,
    message: `Activity coordination updated for request ${id}.`,
    details: {
      requestId: id,
      vendorType: vendorType || 'General Coordination',
      vendorName: vendorName || 'Internal Staff Team',
      status: status || 'ASSIGNED',
      updatedBy: req.user.name,
      updatedAt: new Date().toISOString(),
    },
  });
});

module.exports = router;
