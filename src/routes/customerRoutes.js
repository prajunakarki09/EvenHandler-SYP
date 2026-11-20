const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/rbacMiddleware');
const { ROLES } = require('../constants/roles');

// Apply Authentication and Customer RBAC authorization to all customer endpoints
router.use(authenticate);
router.use(authorize(ROLES.CUSTOMER));

/**
 * Customer Dashboard Overview
 */
router.get('/dashboard', (req, res) => {
  return res.status(200).json({
    success: true,
    message: `Welcome to your Customer Dashboard, ${req.user.name}!`,
    customer: req.user,
    data: {
      activeBookings: 1,
      savedPackages: 3,
      upcomingCelebration: '25th Wedding Anniversary (Dec 20)',
    },
  });
});

/**
 * Customer: Browse Event Packages (Weddings, Birthdays, Anniversaries)
 */
router.get('/packages', (req, res) => {
  return res.status(200).json({
    success: true,
    packages: [
      {
        id: 1,
        title: 'Grand Royal Wedding Package',
        category: 'Wedding',
        price: 4500,
        includes: ['Luxury Banquet Hall', '3-Course Catering', 'Theme Floral Decor', 'Bridal Makeup', 'Live DJ'],
      },
      {
        id: 2,
        title: 'Vibrant Kids Birthday Gala',
        category: 'Birthday',
        price: 1200,
        includes: ['Balloon Decor & Arch', 'Cake & Dessert Bar', 'Magician & Face Painter', 'Snack Buffet'],
      },
      {
        id: 3,
        title: 'Intimate Candlelight Anniversary',
        category: 'Anniversary',
        price: 900,
        includes: ['Private Rooftop Setup', 'Acoustic Violinist', 'Gourmet Dinner', 'Custom Photo Album'],
      },
    ],
  });
});

/**
 * Customer: Submit Event Booking Request
 */
router.post('/bookings', (req, res) => {
  const { eventType, date, guests, budget, notes } = req.body;

  if (!eventType || !date) {
    return res.status(400).json({
      success: false,
      message: 'Event type and date are required.',
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Event booking request submitted successfully. An Organizer will contact you soon.',
    booking: {
      bookingId: 'BK-' + Math.floor(100000 + Math.random() * 900000),
      customerId: req.user.id,
      customerName: req.user.name,
      eventType,
      date,
      guests: guests || 50,
      budget: budget || 'Standard',
      notes: notes || '',
      status: 'PENDING_ORGANIZER_REVIEW',
    },
  });
});

module.exports = router;
