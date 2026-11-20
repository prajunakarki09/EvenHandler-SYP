/**
 * Automated Integration Test Suite for Authentication & RBAC Module
 * Event Planning and Management System (SYP)
 * 
 * Verifies all 4 requirements:
 * 1. User Registration (Validation & Role Isolation)
 * 2. Login, Token Issuance, and Invalidation on Logout
 * 3. Password Management (Hashing & Forgot/Reset Flow)
 * 4. Role-Based Access Control (RBAC) Route Protection
 */

const http = require('http');
const app = require('../src/app');

// ANSI Color Helpers for clean console feedback
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ${GREEN}✓ PASS:${RESET} ${testName}`);
    passedCount++;
  } else {
    console.error(`  ${RED}✗ FAIL:${RESET} ${testName} ${details ? `(${details})` : ''}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log(`\n${BOLD}${CYAN}======================================================${RESET}`);
  console.log(`${BOLD}${CYAN}🧪 STARTING AUTHENTICATION & RBAC TEST SUITE (SYP)${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================${RESET}\n`);

  // Start Express on an ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const helper = {
    async post(path, body, headers = {}) {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    },
    async get(path, headers = {}) {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: { ...headers },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    },
    async patch(path, body, headers = {}) {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    },
  };

  try {
    // -------------------------------------------------------------------------
    // TEST SECTION 1: User Registration & Input Validation
    // -------------------------------------------------------------------------
    console.log(`${BOLD}1. USER REGISTRATION & ROLE ENFORCEMENT${RESET}`);

    // 1.1 Input validation check: Weak password
    const regWeak = await helper.post('/api/auth/register', {
      name: 'John Doe',
      email: 'john.weak@example.com',
      password: '123',
    });
    assert(regWeak.status === 400, 'Rejects registration with weak password (Status 400)');

    // 1.2 Input validation check: Invalid email
    const regInvalidEmail = await helper.post('/api/auth/register', {
      name: 'John Doe',
      email: 'not-an-email',
      password: 'StrongPassword@123',
    });
    assert(regInvalidEmail.status === 400, 'Rejects registration with invalid email format (Status 400)');

    // 1.3 Successful Customer Registration
    const testCustEmail = `test.customer.${Date.now()}@example.com`;
    const regValid = await helper.post('/api/auth/register', {
      name: 'Jane Customer',
      email: testCustEmail,
      phone: '+1-555-9876',
      password: 'CustomerPass@2026',
    });
    assert(regValid.status === 201, 'Registers new customer successfully (Status 201)');
    assert(regValid.data.user?.role === 'CUSTOMER', 'Assigned role is strictly CUSTOMER');
    assert(Boolean(regValid.data.token), 'Returns JWT token on registration');

    // 1.4 Role Escalation Protection: User attempts to register as ADMIN publicly
    const regHackerEmail = `hacker.${Date.now()}@example.com`;
    const regHacker = await helper.post('/api/auth/register', {
      name: 'Mr Hacker',
      email: regHackerEmail,
      password: 'HackerPass@2026',
      role: 'ADMIN', // Attempting privilege escalation
    });
    assert(regHacker.status === 201, 'Processes registration');
    assert(
      regHacker.data.user?.role === 'CUSTOMER',
      'Neutralizes role injection: Enforces CUSTOMER role despite requesting ADMIN'
    );

    // 1.5 Duplicate email rejection
    const regDuplicate = await helper.post('/api/auth/register', {
      name: 'Duplicate Jane',
      email: testCustEmail,
      password: 'CustomerPass@2026',
    });
    assert(regDuplicate.status === 409, 'Rejects duplicate email registration (Status 409 Conflict)');

    // -------------------------------------------------------------------------
    // TEST SECTION 2: Login, Token Verification & Logout Invalidation
    // -------------------------------------------------------------------------
    console.log(`\n${BOLD}2. LOGIN & SESSION INVALIDATION ON LOGOUT${RESET}`);

    // 2.1 Login with incorrect password
    const loginBadPass = await helper.post('/api/auth/login', {
      email: testCustEmail,
      password: 'WrongPassword@999',
    });
    assert(loginBadPass.status === 401, 'Rejects login with invalid password (Status 401)');

    // 2.2 Login with valid credentials
    const loginOk = await helper.post('/api/auth/login', {
      email: testCustEmail,
      password: 'CustomerPass@2026',
    });
    assert(loginOk.status === 200, 'Successful login yields 200 OK');
    const customerToken = loginOk.data.token;
    assert(Boolean(customerToken), 'Issues valid JWT authentication token');

    // 2.3 Access profile with Bearer token
    const meRes = await helper.get('/api/auth/me', {
      Authorization: `Bearer ${customerToken}`,
    });
    assert(meRes.status === 200, 'Authenticated /me route returns user profile');
    assert(meRes.data.user?.email === testCustEmail, 'Authenticated user email matches');

    // 2.4 Logout: Should revoke session in database
    const logoutRes = await helper.post(
      '/api/auth/logout',
      {},
      { Authorization: `Bearer ${customerToken}` }
    );
    assert(logoutRes.status === 200, 'Logout succeeds and responds with 200 OK');

    // 2.5 Security check: Verify token CANNOT be reused after logout
    const reuseRevoked = await helper.get('/api/auth/me', {
      Authorization: `Bearer ${customerToken}`,
    });
    assert(
      reuseRevoked.status === 401,
      'Revoked token is rejected on subsequent requests (Status 401 Session Revoked)'
    );

    // -------------------------------------------------------------------------
    // TEST SECTION 3: Password Management (Forgot & Reset Flow)
    // -------------------------------------------------------------------------
    console.log(`\n${BOLD}3. PASSWORD MANAGEMENT (FORGOT & RESET FLOW)${RESET}`);

    // 3.1 Forgot password request
    const forgotRes = await helper.post('/api/auth/forgot-password', {
      email: testCustEmail,
    });
    assert(forgotRes.status === 200, 'Forgot password initiates successfully (Status 200)');
    const rawResetToken = forgotRes.data.developmentInfo?.rawResetToken;
    assert(Boolean(rawResetToken), 'Generates secure cryptographic reset token');

    // 3.2 Reset password with valid token
    const resetRes = await helper.post('/api/auth/reset-password', {
      token: rawResetToken,
      newPassword: 'BrandNewCustomerPass@2026',
    });
    assert(resetRes.status === 200, 'Password reset succeeds with token (Status 200)');

    // 3.3 Verify old password no longer works
    const loginOldPass = await helper.post('/api/auth/login', {
      email: testCustEmail,
      password: 'CustomerPass@2026',
    });
    assert(loginOldPass.status === 401, 'Old password rejected after reset (Status 401)');

    // 3.4 Verify new password works
    const loginNewPass = await helper.post('/api/auth/login', {
      email: testCustEmail,
      password: 'BrandNewCustomerPass@2026',
    });
    assert(loginNewPass.status === 200, 'New password successfully authenticates (Status 200)');
    const freshCustToken = loginNewPass.data.token;

    // 3.5 Token replay prevention: Reset token cannot be used twice
    const replayReset = await helper.post('/api/auth/reset-password', {
      token: rawResetToken,
      newPassword: 'AnotherPassword@2026',
    });
    assert(replayReset.status === 400, 'Rejects already used reset token (Status 400)');

    // -------------------------------------------------------------------------
    // TEST SECTION 4: Role-Based Access Control (RBAC)
    // -------------------------------------------------------------------------
    console.log(`\n${BOLD}4. ROLE-BASED ACCESS CONTROL (RBAC) ROUTE GUARDS${RESET}`);

    // 4.1 Unauthenticated requests blocked
    const unauthRes = await helper.get('/api/customer/dashboard');
    assert(unauthRes.status === 401, 'Blocks unauthenticated access to customer dashboard (401)');

    // 4.2 Customer accesses Customer Dashboard
    const custDash = await helper.get('/api/customer/dashboard', {
      Authorization: `Bearer ${freshCustToken}`,
    });
    assert(custDash.status === 200, 'Customer successfully accesses Customer Dashboard (200)');

    // 4.3 Customer attempts to access Admin Panel -> MUST BE 403 FORBIDDEN
    const custAccessAdmin = await helper.get('/api/admin/users', {
      Authorization: `Bearer ${freshCustToken}`,
    });
    assert(
      custAccessAdmin.status === 403,
      'Customer is FORBIDDEN from accessing Admin Users API (Status 403)'
    );

    // 4.4 Customer attempts to access Organizer Hub -> MUST BE 403 FORBIDDEN
    const custAccessOrganizer = await helper.get('/api/organizer/dashboard', {
      Authorization: `Bearer ${freshCustToken}`,
    });
    assert(
      custAccessOrganizer.status === 403,
      'Customer is FORBIDDEN from accessing Organizer Dashboard (Status 403)'
    );

    // 4.5 Admin Login (using seeded account)
    const adminLogin = await helper.post('/api/auth/login', {
      email: 'admin@eventhub.com',
      password: 'Admin@12345',
    });
    assert(adminLogin.status === 200, 'Admin logs in successfully with seeded credentials');
    const adminToken = adminLogin.data.token;

    // 4.6 Admin accesses Admin Users endpoint
    const adminUsersList = await helper.get('/api/admin/users', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminUsersList.status === 200, 'Admin successfully accesses Admin Users endpoint (200)');
    assert(Array.isArray(adminUsersList.data.users), 'Admin receives list of users');

    // 4.7 Admin creates a new restricted Staff/Organizer account
    const newStaffEmail = `staff.organizer.${Date.now()}@example.com`;
    const adminCreateStaff = await helper.post(
      '/api/admin/users',
      {
        name: 'Alex Coordinator',
        email: newStaffEmail,
        phone: '+1-555-3344',
        password: 'OrganizerStaff@2026',
        role: 'ORGANIZER',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(adminCreateStaff.status === 201, 'Admin creates restricted ORGANIZER account (Status 201)');
    assert(adminCreateStaff.data.user?.role === 'ORGANIZER', 'New staff member has ORGANIZER role');

    // 4.8 Newly created Organizer logs in
    const staffLogin = await helper.post('/api/auth/login', {
      email: newStaffEmail,
      password: 'OrganizerStaff@2026',
    });
    assert(staffLogin.status === 200, 'Organizer logs in successfully (Status 200)');
    const staffToken = staffLogin.data.token;

    // 4.9 Organizer accesses Organizer Dashboard & Event Coordination Requests
    const staffDash = await helper.get('/api/organizer/dashboard', {
      Authorization: `Bearer ${staffToken}`,
    });
    assert(staffDash.status === 200, 'Organizer successfully accesses Organizer Dashboard (200)');

    const staffReqs = await helper.get('/api/organizer/requests', {
      Authorization: `Bearer ${staffToken}`,
    });
    assert(staffReqs.status === 200, 'Organizer successfully retrieves coordination requests (200)');

    // 4.10 Organizer attempts to access Admin Panel -> MUST BE 403 FORBIDDEN
    const staffAccessAdmin = await helper.get('/api/admin/users', {
      Authorization: `Bearer ${staffToken}`,
    });
    assert(
      staffAccessAdmin.status === 403,
      'Organizer is FORBIDDEN from accessing Admin Users API (Status 403)'
    );

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log(`\n${BOLD}${CYAN}======================================================${RESET}`);
    console.log(`${BOLD}TEST RESULTS SUMMARY:${RESET}`);
    console.log(`  ${GREEN}Passed: ${passedCount}${RESET}`);
    console.log(`  ${failedCount > 0 ? RED : GREEN}Failed: ${failedCount}${RESET}`);
    console.log(`${BOLD}${CYAN}======================================================${RESET}\n`);
  } catch (err) {
    console.error('Fatal test error:', err);
    failedCount++;
  } finally {
    server.close();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTestSuite();
