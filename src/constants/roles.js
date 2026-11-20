/**
 * System Roles for Event Planning and Management System (SYP)
 * 
 * - CUSTOMER: Public user who registers to browse packages and book events.
 * - ORGANIZER: Staff or coordinator managing event schedules, vendors, and activities.
 * - ADMIN: System administrator with full access to manage users, roles, and reports.
 */
const ROLES = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  ORGANIZER: 'ORGANIZER',
  ADMIN: 'ADMIN',
});

const ALL_ROLES = Object.freeze([
  ROLES.CUSTOMER,
  ROLES.ORGANIZER,
  ROLES.ADMIN,
]);

// Roles that require elevated permissions to create
const RESTRICTED_ROLES = Object.freeze([
  ROLES.ORGANIZER,
  ROLES.ADMIN,
]);

module.exports = {
  ROLES,
  ALL_ROLES,
  RESTRICTED_ROLES,
};
