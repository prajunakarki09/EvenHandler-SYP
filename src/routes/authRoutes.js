const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateUpdatePassword,
} = require('../middleware/validateMiddleware');

// Brute-force protection for public auth endpoints (login, forgot password, register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});

// 1. User Registration (Public signup - strictly creates CUSTOMER)
router.post('/register', authLimiter, validateRegister, authController.register);

// 2. User Login (Customer, Organizer, Admin)
router.post('/login', authLimiter, validateLogin, authController.login);

// 3. User Logout (Authenticated, session invalidation)
router.post('/logout', authenticate, authController.logout);

// 4. Authenticated User Profile
router.get('/me', authenticate, authController.getMe);

// 5. Password Management: Forgot Password flow
router.post('/forgot-password', authLimiter, validateForgotPassword, authController.forgotPassword);

// 6. Password Management: Reset Password flow
router.post('/reset-password', authLimiter, validateResetPassword, authController.resetPassword);

// 7. Password Management: Authenticated user updating their password
router.put('/update-password', authenticate, validateUpdatePassword, authController.updatePassword);

module.exports = router;
