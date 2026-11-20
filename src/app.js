const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const organizerRoutes = require('./routes/organizerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');

const app = express();

// Core middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend web application from public directory
app.use(express.static(path.join(__dirname, '../public')));

// API Overview and documentation
app.get('/api/docs', (req, res) => {
  return res.status(200).json({
    success: true,
    project: 'Event Planning and Management System (SYP)',
    version: '1.0.0',
    description: 'Online marketplace for event planning (weddings, birthdays, anniversaries, celebrations)',
    endpoints: {
      auth: '/api/auth',
      customer: '/api/customer',
      organizer: '/api/organizer',
      admin: '/api/admin',
    },
    documentation: 'See README.md or API route specifications',
  });
});

app.get('/api', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Event Hub API is operational',
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/admin', adminRoutes);

// Catch-all 404 and Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
