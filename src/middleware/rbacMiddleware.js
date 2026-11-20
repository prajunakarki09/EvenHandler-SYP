/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Restricts route access to one or more allowed roles.
 * Must be used AFTER the `authenticate` middleware.
 * 
 * Usage example:
 *   router.get('/admin/dashboard', authenticate, authorize('ADMIN'), adminController.dashboard);
 *   router.get('/organizer/events', authenticate, authorize('ORGANIZER', 'ADMIN'), organizerController.events);
 * 
 * @param  {...string} allowedRoles - List of permitted roles
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    // 1. Guard check: Ensure authenticate middleware was called first
    if (!req.user || !req.user.role) {
      return res.status(500).json({
        success: false,
        message: 'RBAC error: Route must be protected with authenticate middleware prior to authorize.',
      });
    }

    // 2. Check if user's role matches any of the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to access this resource.',
        requiredRoles: allowedRoles,
        currentRole: req.user.role,
      });
    }

    // 3. User is authorized
    next();
  };
}

module.exports = {
  authorize,
};
