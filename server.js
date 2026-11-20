const app = require('./src/app');
const config = require('./src/config/env');
// Trigger database initialization & verification
require('./src/config/db');

const server = app.listen(config.port, () => {
  console.log('====================================================');
  console.log('🎉 Event Planning & Management System (SYP) API');
  console.log(`🚀 Server running in [${config.nodeEnv}] mode on port: ${config.port}`);
  console.log(`🌐 Base URL: http://localhost:${config.port}`);
  console.log('----------------------------------------------------');
  console.log('🔑 Seeded Default Accounts:');
  console.log('   Admin:      admin@eventhub.com      | Admin@12345');
  console.log('   Organizer:  organizer@eventhub.com  | Organizer@12345');
  console.log('   Customer:   customer@eventhub.com   | Customer@12345');
  console.log('====================================================');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
