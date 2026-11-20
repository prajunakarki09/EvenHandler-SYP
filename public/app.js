/**
 * EventHub Frontend Application Controller
 * Handles SPA navigation, API requests, RBAC views, and authentication state
 */

const API_BASE = '/api';

class EventHubApp {
  constructor() {
    this.token = localStorage.getItem('eventhub_token') || null;
    this.user = JSON.parse(localStorage.getItem('eventhub_user') || 'null');
    
    // In-memory data store for the session
    this.packages = [];
    this.customerBookings = [
      {
        bookingId: 'BK-892101',
        eventType: '💍 Royal Wedding',
        date: '2026-12-28',
        guests: 250,
        budget: 'Luxury Tier',
        status: 'CONFIRMED'
      }
    ];
    this.organizerRequests = [];
    this.adminUsers = [];
    this.lastDevResetToken = null;

    this.init();
  }

  async init() {
    this.renderNavAuth();
    this.initPackages();
    this.updateCalculator();
    await this.verifyCurrentSession();
  }

  // =========================================================================
  // API Request Helper with Auto-Bearer Headers
  // =========================================================================
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // If session was revoked or token expired, auto logout
        if (response.status === 401 && this.token) {
          this.handleSessionExpired(data.message || 'Session expired. Please log in again.');
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  // =========================================================================
  // Toast Notifications
  // =========================================================================
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✓',
      error: '✗',
      info: 'ℹ'
    };
    
    toast.innerHTML = `<span>${icons[type] || '•'}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // =========================================================================
  // Navigation & RBAC View Switching
  // =========================================================================
  navigate(targetView) {
    // RBAC Route Protection Guards
    if (targetView === 'customer') {
      if (!this.user || this.user.role !== 'CUSTOMER') {
        this.showToast('Please sign in with a Customer account to access the Customer Portal.', 'error');
        this.openAuthModal('login');
        return;
      }
    } else if (targetView === 'organizer') {
      if (!this.user || (this.user.role !== 'ORGANIZER' && this.user.role !== 'ADMIN')) {
        this.showToast('Access Denied: Organizer or Admin role required for this workspace.', 'error');
        return;
      }
    } else if (targetView === 'admin') {
      if (!this.user || this.user.role !== 'ADMIN') {
        this.showToast('Access Denied: System Administrator privileges required.', 'error');
        return;
      }
    }

    // Toggle active view sections
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    const activeSec = document.getElementById(`view-${targetView}`);
    if (activeSec) {
      activeSec.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Load data for specific view
    if (targetView === 'customer') this.loadCustomerDashboard();
    if (targetView === 'organizer') this.loadOrganizerDashboard();
    if (targetView === 'admin') this.loadAdminDashboard();
  }

  // =========================================================================
  // Header / Auth Status Rendering
  // =========================================================================
  renderNavAuth() {
    const navAuth = document.getElementById('nav-auth');
    if (!this.user) {
      navAuth.innerHTML = `
        <button class="btn btn-outline" onclick="app.openAuthModal('login')">Sign In</button>
        <button class="btn btn-primary" onclick="app.openAuthModal('register')">Register</button>
      `;
      return;
    }

    // User is logged in: show role pill and dashboard button
    const roleBadges = {
      CUSTOMER: 'badge-customer',
      ORGANIZER: 'badge-organizer',
      ADMIN: 'badge-admin'
    };

    const dashboardTarget = this.user.role.toLowerCase();

    navAuth.innerHTML = `
      <div class="user-pill">
        <span class="user-avatar">${this.user.name.charAt(0).toUpperCase()}</span>
        <span>${this.user.name}</span>
        <span class="badge ${roleBadges[this.user.role] || ''}">${this.user.role}</span>
      </div>
      <button class="btn btn-outline btn-sm" onclick="app.navigate('${dashboardTarget}')">Dashboard</button>
      <button class="btn btn-outline btn-sm" onclick="app.handleLogout()">Logout</button>
    `;
  }

  // Verify token validity on boot
  async verifyCurrentSession() {
    if (!this.token) return;
    try {
      const res = await this.request('/auth/me');
      if (res.success && res.user) {
        this.user = res.user;
        localStorage.setItem('eventhub_user', JSON.stringify(this.user));
        this.renderNavAuth();
      }
    } catch (e) {
      // Handled in request helper
    }
  }

  handleSessionExpired(msg) {
    this.token = null;
    this.user = null;
    localStorage.removeItem('eventhub_token');
    localStorage.removeItem('eventhub_user');
    this.renderNavAuth();
    this.navigate('home');
    this.showToast(msg, 'error');
  }

  // =========================================================================
  // Modals & Auth Forms
  // =========================================================================
  openAuthModal(tab = 'login') {
    document.getElementById('modal-auth').classList.add('active');
    this.switchAuthTab(tab);
  }

  closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  switchAuthTab(tabName) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    const activeTab = document.getElementById(`tab-${tabName}`);
    const activeForm = document.getElementById(`form-${tabName}`);
    if (activeTab) activeTab.classList.add('active');
    if (activeForm) activeForm.classList.add('active');
  }

  openDemoLoginModal() {
    this.openAuthModal('login');
  }

  fillDemo(role) {
    const creds = {
      admin: { email: 'admin@eventhub.com', pass: 'Admin@12345' },
      organizer: { email: 'organizer@eventhub.com', pass: 'Organizer@12345' },
      customer: { email: 'customer@eventhub.com', pass: 'Customer@12345' }
    };

    const target = creds[role];
    if (target) {
      document.getElementById('login-email').value = target.email;
      document.getElementById('login-password').value = target.pass;
      this.showToast(`Filled ${role.toUpperCase()} credentials! Click Sign In.`, 'info');
    }
  }

  // Live password complexity indicator
  checkPasswordStrength(val) {
    const fill = document.getElementById('strength-fill');
    const text = document.getElementById('strength-text');
    let score = 0;

    if (!val) {
      fill.style.width = '0%';
      text.innerText = 'Enter password';
      return;
    }

    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    if (score <= 2) {
      fill.style.width = '30%';
      fill.style.background = '#ef4444';
      text.innerText = 'Weak (Needs 8+ chars, upper, lower, numbers & symbols)';
      text.style.color = '#ef4444';
    } else if (score <= 4) {
      fill.style.width = '70%';
      fill.style.background = '#f59e0b';
      text.innerText = 'Moderate password strength';
      text.style.color = '#f59e0b';
    } else {
      fill.style.width = '100%';
      fill.style.background = '#10b981';
      text.innerText = 'Strong password ✓';
      text.style.color = '#10b981';
    }
  }

  // =========================================================================
  // Authentication Actions
  // =========================================================================
  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('btn-login-submit');

    try {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Signing in...';

      const res = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('eventhub_token', this.token);
      localStorage.setItem('eventhub_user', JSON.stringify(this.user));

      this.renderNavAuth();
      this.closeModals();
      this.showToast(`Welcome back, ${this.user.name}! (${this.user.role})`, 'success');

      // Auto-route based on RBAC role
      if (this.user.role === 'ADMIN') this.navigate('admin');
      else if (this.user.role === 'ORGANIZER') this.navigate('organizer');
      else this.navigate('customer');
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In';
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const password = document.getElementById('reg-password').value;
    const submitBtn = document.getElementById('btn-reg-submit');

    try {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Registering...';

      const res = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, password }),
      });

      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('eventhub_token', this.token);
      localStorage.setItem('eventhub_user', JSON.stringify(this.user));

      this.renderNavAuth();
      this.closeModals();
      this.showToast(`Account created successfully! Welcome, ${this.user.name}.`, 'success');
      this.navigate('customer');
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Register as Customer';
    }
  }

  async handleLogout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Continue client cleanup even if network fails
    }

    this.token = null;
    this.user = null;
    localStorage.removeItem('eventhub_token');
    localStorage.removeItem('eventhub_user');

    this.renderNavAuth();
    this.navigate('home');
    this.showToast('You have been logged out and your session was invalidated.', 'info');
  }

  async handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;

    try {
      const res = await this.request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      this.showToast(res.message, 'success');

      if (res.developmentInfo && res.developmentInfo.rawResetToken) {
        this.lastDevResetToken = res.developmentInfo.rawResetToken;
        const devBox = document.getElementById('forgot-dev-box');
        const tokenPreview = document.getElementById('forgot-dev-token');
        devBox.classList.remove('hidden');
        tokenPreview.innerText = this.lastDevResetToken;
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  populateResetModal() {
    this.switchAuthTab('reset');
    if (this.lastDevResetToken) {
      document.getElementById('reset-token-input').value = this.lastDevResetToken;
    }
  }

  async handleResetPassword(e) {
    e.preventDefault();
    const token = document.getElementById('reset-token-input').value;
    const newPassword = document.getElementById('reset-new-password').value;

    try {
      const res = await this.request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });

      this.showToast(res.message, 'success');
      this.switchAuthTab('login');
      document.getElementById('login-password').value = newPassword;
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // =========================================================================
  // Marketplace & Package Catalog
  // =========================================================================
  initPackages() {
    this.packages = [
      {
        id: 1,
        title: 'Grand Royal Wedding',
        category: 'Wedding',
        price: '$4,500',
        inclusions: ['Luxury Banquet Hall Reservation', '3-Course Multi-Cuisine Catering', 'Theme Floral Stage & Mandap Decor', 'Bridal Makeup & Hair Styling', 'Live DJ, Sound & Mood Lights']
      },
      {
        id: 2,
        title: 'Vibrant Kids Birthday Gala',
        category: 'Birthday',
        price: '$1,200',
        inclusions: ['Balloon Arch & Theme Backdrop', 'Tiered Custom Theme Cake', 'Magician, Face Painting & Games Host', 'Kids Snack & Dessert Buffet', 'Party Favors & Gift Bags']
      },
      {
        id: 3,
        title: 'Intimate Rooftop Anniversary',
        category: 'Anniversary',
        price: '$950',
        inclusions: ['Private Candlelit Glasshouse Setup', 'Gourmet 4-Course Chef Dinner', 'Solo Acoustic Violinist / Guitarist', 'Fresh Red Rose Bouquet & Champagne', 'Custom Memory Photo Album']
      },
      {
        id: 4,
        title: 'Elite Golden Jubilee Celebration',
        category: 'Anniversary',
        price: '$2,800',
        inclusions: ['Grand Ballroom Setup with Golden Accents', 'Gourmet Buffet Catering for 150 Guests', 'Professional Photographer & Videographer', 'Custom Live Stage & Audio Engineering', 'Audio-Visual Tribute Presentation']
      },
      {
        id: 5,
        title: 'Neon Glow Teen Birthday Bash',
        category: 'Birthday',
        price: '$1,600',
        inclusions: ['UV Blacklight & Glow-in-the-Dark Decor', 'Live Club DJ & Dance Floor', 'Mocktail & Smoothie Bar Station', 'Interactive Photo Booth with Instant Prints', 'Custom DJ Playlist']
      },
      {
        id: 6,
        title: 'Fairytale Destination Wedding',
        category: 'Wedding',
        price: '$7,200',
        inclusions: ['Scenic Outdoor Resort Venue', 'Comprehensive 2-Day Event Coordination', 'Full Bridal & Groom Styling Entourage', 'Luxury Floral Installations & Pyrotechnics', 'Dedicated On-site Event Director']
      }
    ];

    this.renderPackages(this.packages);
  }

  renderPackages(items) {
    const grid = document.getElementById('packages-grid');
    if (!grid) return;

    grid.innerHTML = items.map(pkg => `
      <div class="package-card">
        <div class="package-top">
          <span class="package-category">${pkg.category}</span>
          <span class="package-price">${pkg.price}</span>
        </div>
        <h3 class="package-title">${pkg.title}</h3>
        <ul class="package-inclusions">
          ${pkg.inclusions.map(inc => `<li>${inc}</li>`).join('')}
        </ul>
        <button class="btn btn-primary" onclick="app.bookPackage('${pkg.title}', '${pkg.category}')">Book This Event</button>
      </div>
    `).join('');
  }

  filterPackages(category, btnElement) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    if (category === 'all') {
      this.renderPackages(this.packages);
    } else {
      const filtered = this.packages.filter(p => p.category === category);
      this.renderPackages(filtered);
    }
  }

  bookPackage(packageTitle, category) {
    if (!this.user) {
      this.showToast('Please sign in or register to submit an event booking.', 'info');
      this.openAuthModal('login');
      return;
    }
    this.openBookingModal(packageTitle, category);
  }

  // =========================================================================
  // Customer Dashboard & Event Booking
  // =========================================================================
  loadCustomerDashboard() {
    if (!this.user) return;
    document.getElementById('cust-welcome-name').innerText = this.user.name;
    document.getElementById('cust-stat-bookings').innerText = this.customerBookings.length;
    this.renderCustomerBookings();
  }

  renderCustomerBookings() {
    const tbody = document.getElementById('cust-bookings-tbody');
    if (!tbody) return;

    if (this.customerBookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #94a3b8;">No bookings submitted yet. Click '+ Book New Event' above!</td></tr>`;
      return;
    }

    tbody.innerHTML = this.customerBookings.map(b => `
      <tr>
        <td><strong>${b.bookingId}</strong></td>
        <td>${b.eventType}</td>
        <td>${b.date}</td>
        <td>${b.guests} Guests</td>
        <td>${b.budget}</td>
        <td><span class="badge ${b.status === 'CONFIRMED' ? 'badge-success' : 'badge-warning'}">${b.status}</span></td>
      </tr>
    `).join('');
  }

  openBookingModal(prefillTitle = '', prefillCategory = '') {
    if (!this.user) {
      this.openAuthModal('login');
      return;
    }
    const select = document.getElementById('book-type');
    if (prefillCategory) select.value = prefillCategory;
    document.getElementById('modal-booking').classList.add('active');
  }

  async handleBookingSubmit(e) {
    e.preventDefault();
    const eventType = document.getElementById('book-type').value;
    const date = document.getElementById('book-date').value;
    const guests = document.getElementById('book-guests').value;
    const budget = document.getElementById('book-budget').value;
    const notes = document.getElementById('book-notes').value;

    try {
      const res = await this.request('/customer/bookings', {
        method: 'POST',
        body: JSON.stringify({ eventType, date, guests, budget, notes }),
      });

      this.customerBookings.unshift({
        bookingId: res.booking.bookingId,
        eventType: res.booking.eventType,
        date: res.booking.date,
        guests: res.booking.guests,
        budget: res.booking.budget,
        status: res.booking.status
      });

      this.closeModals();
      this.showToast('Event booking request submitted! An Organizer will contact you.', 'success');
      this.loadCustomerDashboard();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // =========================================================================
  // Organizer / Staff Hub
  // =========================================================================
  async loadOrganizerDashboard() {
    try {
      const res = await this.request('/organizer/requests');
      this.organizerRequests = res.requests || [];
      document.getElementById('org-pending-count').innerText = this.organizerRequests.length;
      this.renderOrganizerRequests();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  renderOrganizerRequests() {
    const tbody = document.getElementById('org-requests-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.organizerRequests.map(req => `
      <tr>
        <td><strong>${req.id}</strong></td>
        <td>${req.customerName}<br><small style="color:#64748b">${req.customerEmail}</small></td>
        <td>${req.eventType}<br><small style="color:#64748b">${req.eventDate}</small></td>
        <td>${req.vendorsNeeded.map(v => `<span class="badge" style="background:#f1f5f9; color:#475569; margin:2px;">${v}</span>`).join('')}</td>
        <td><strong>${req.assignedStaff}</strong></td>
        <td><span class="badge badge-warning">${req.status}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="app.openAssignModal('${req.id}', '${req.eventType}')">Assign Vendor</button>
        </td>
      </tr>
    `).join('');
  }

  openAssignModal(reqId, eventType) {
    document.getElementById('assign-req-id').value = reqId;
    document.getElementById('assign-modal-req-title').innerText = `Request: ${reqId} (${eventType})`;
    document.getElementById('modal-assign-vendor').classList.add('active');
  }

  async handleAssignVendorSubmit(e) {
    e.preventDefault();
    const reqId = document.getElementById('assign-req-id').value;
    const vendorType = document.getElementById('assign-type').value;
    const vendorName = document.getElementById('assign-vendor-name').value;
    const status = document.getElementById('assign-status').value;

    try {
      const res = await this.request(`/organizer/requests/${reqId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ vendorType, vendorName, status }),
      });

      // Update local state
      const item = this.organizerRequests.find(r => r.id === reqId);
      if (item) {
        item.status = status;
        item.assignedStaff = `${this.user.name} (${vendorName})`;
      }

      this.closeModals();
      this.renderOrganizerRequests();
      this.showToast(`Updated: ${vendorName} assigned for ${vendorType}!`, 'success');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // =========================================================================
  // Admin Control Panel
  // =========================================================================
  async loadAdminDashboard() {
    try {
      const [usersRes, reportsRes] = await Promise.all([
        this.request('/admin/users'),
        this.request('/admin/reports')
      ]);

      this.adminUsers = usersRes.users || [];
      this.renderAdminMetrics(reportsRes.overview);
      this.renderAdminUsers(this.adminUsers);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  renderAdminMetrics(overview) {
    const container = document.getElementById('admin-metrics-container');
    if (!container || !overview) return;

    const breakdownHtml = overview.roleBreakdown.map(b => `
      <div class="metric-card">
        <div class="metric-icon">👥</div>
        <div class="metric-info">
          <span class="metric-val">${b.total_users}</span>
          <span class="metric-lbl">${b.role} Accounts</span>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      ${breakdownHtml}
      <div class="metric-card">
        <div class="metric-icon">🔐</div>
        <div class="metric-info">
          <span class="metric-val">${overview.activeSessions}</span>
          <span class="metric-lbl">Active Sessions</span>
        </div>
      </div>
    `;
  }

  renderAdminUsers(users) {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    const roleBadges = {
      CUSTOMER: 'badge-customer',
      ORGANIZER: 'badge-organizer',
      ADMIN: 'badge-admin'
    };

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>#${u.id}</td>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>${u.phone || '—'}</td>
        <td><span class="badge ${roleBadges[u.role] || ''}">${u.role}</span></td>
        <td>
          <span class="badge ${u.is_active ? 'badge-success' : 'badge-warning'}">
            ${u.is_active ? 'Active' : 'Suspended'}
          </span>
        </td>
        <td><small style="color:#64748b">${u.created_at || 'Recently'}</small></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="app.toggleUserStatus(${u.id}, ${u.is_active})">
            ${u.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');
  }

  filterAdminUsers() {
    const query = document.getElementById('admin-user-search').value.toLowerCase();
    const filtered = this.adminUsers.filter(u => 
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query)
    );
    this.renderAdminUsers(filtered);
  }

  openCreateStaffModal() {
    document.getElementById('modal-create-staff').classList.add('active');
  }

  async handleCreateStaff(e) {
    e.preventDefault();
    const name = document.getElementById('staff-name').value;
    const email = document.getElementById('staff-email').value;
    const phone = document.getElementById('staff-phone').value;
    const role = document.getElementById('staff-role').value;
    const password = document.getElementById('staff-password').value;

    try {
      const res = await this.request('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, role, password }),
      });

      this.closeModals();
      this.showToast(`Provisioned ${role} account for ${name}!`, 'success');
      this.loadAdminDashboard();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async toggleUserStatus(userId, currentStatus) {
    const newStatus = !currentStatus;
    try {
      const res = await this.request(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });

      this.showToast(res.message, 'success');
      this.loadAdminDashboard();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // =========================================================================
  // Interactive Budget Calculator
  // =========================================================================
  updateCalculator() {
    const guestsInput = document.getElementById('calc-guests');
    if (!guestsInput) return;

    const guests = parseInt(guestsInput.value, 10);
    const counter = document.getElementById('calc-guests-val');
    if (counter) counter.innerText = `${guests} Guests`;

    const catering = document.getElementById('srv-catering')?.checked;
    const decor = document.getElementById('srv-decor')?.checked;
    const makeup = document.getElementById('srv-makeup')?.checked;
    const sound = document.getElementById('srv-sound')?.checked;
    const photo = document.getElementById('srv-photo')?.checked;
    const cake = document.getElementById('srv-cake')?.checked;

    let total = 0;
    const breakdown = [];

    if (catering) {
      const catCost = guests * 22;
      total += catCost;
      breakdown.push({ label: `Gourmet Catering (${guests} × $22)`, cost: catCost });
    }
    if (decor) {
      total += 650;
      breakdown.push({ label: 'Floral & Theme Decor (Flat)', cost: 650 });
    }
    if (makeup) {
      total += 350;
      breakdown.push({ label: 'Bridal / Glam Makeup (Flat)', cost: 350 });
    }
    if (sound) {
      total += 450;
      breakdown.push({ label: 'DJ, Sound & Mood Lights (Flat)', cost: 450 });
    }
    if (photo) {
      total += 700;
      breakdown.push({ label: 'Cinematic Photo & Video (Flat)', cost: 700 });
    }
    if (cake) {
      total += 180;
      breakdown.push({ label: 'Custom Tiered Cake (Flat)', cost: 180 });
    }

    const priceEl = document.getElementById('calc-total-price');
    if (priceEl) priceEl.innerText = total.toLocaleString();

    const list = document.getElementById('calc-breakdown');
    if (list) {
      list.innerHTML = breakdown.map(item => `
        <li>
          <span>${item.label}</span>
          <strong>$${item.cost.toLocaleString()}</strong>
        </li>
      `).join('');
    }
  }

  bookFromCalculator() {
    const guests = document.getElementById('calc-guests')?.value || 120;
    const total = document.getElementById('calc-total-price')?.innerText || '4,000';

    if (!this.user) {
      this.showToast('Please sign in or register to book your calculated package.', 'info');
      this.openAuthModal('login');
      return;
    }

    // Prefill the booking modal
    const guestsInput = document.getElementById('book-guests');
    const notesInput = document.getElementById('book-notes');
    if (guestsInput) guestsInput.value = guests;
    if (notesInput) {
      notesInput.value = `Custom Calculator Estimate: $${total} for ${guests} guests. Please coordinate the selected vendors.`;
    }

    document.getElementById('modal-booking').classList.add('active');
  }

  handleContactSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('contact-name').value;
    const type = document.getElementById('contact-type').value;

    this.showToast(`Thank you, ${name}! Your inquiry for ${type} has been sent to our coordination team.`, 'success');
    e.target.reset();
  }
}

// Global application instance
const app = new EventHubApp();
window.app = app;
