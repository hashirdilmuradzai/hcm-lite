/**
 * HCM Lite — UI Utilities & Shared Component Handlers
 * - Toast notifications (success, error, warning, info)
 * - Confirmation and input dialog modals
 * - Theme switcher (Dark / Light) with localStorage persistence
 * - Init shared sidebar, topbar, mobile drawer, and date display
 * - Init initials avatar generator
 * - Form validation helper
 */

const UI = (() => {
  // SVG Icon repository for sharp, lightweight inline rendering
  const ICONS = {
    dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
    users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    checkSquare: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    logOut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    alertCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`,
    mapPin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
    printer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`,
    bot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>`
  };

  // Toast Notification System
  function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = ICONS.alertCircle;
    if (type === 'success') iconSvg = ICONS.check;
    else if (type === 'info') iconSvg = ICONS.alertCircle;

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-content">${escapeHTML(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 200);
    }, duration);
  }

  // Confirmation Modal Dialog Helper
  function showConfirmModal({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    onConfirm = () => {}
  }) {
    let modal = document.getElementById('global-confirm-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'global-confirm-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title" id="confirm-modal-title"></h3>
            <button class="modal-close" id="confirm-modal-close" aria-label="Close">${ICONS.x}</button>
          </div>
          <div class="modal-body">
            <p id="confirm-modal-message" style="color: var(--color-text-secondary);"></p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="confirm-modal-cancel"></button>
            <button class="btn" id="confirm-modal-action"></button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const actionBtn = document.getElementById('confirm-modal-action');
    const closeBtn = document.getElementById('confirm-modal-close');

    titleEl.textContent = title;
    msgEl.innerHTML = message;
    cancelBtn.textContent = cancelText;
    actionBtn.textContent = confirmText;
    actionBtn.className = `btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`;

    const closeModal = () => {
      modal.classList.remove('active');
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    actionBtn.onclick = () => {
      closeModal();
      if (typeof onConfirm === 'function') onConfirm();
    };

    modal.classList.add('active');
  }

  // Theme Management (Dark / Light)
  function initTheme() {
    const prefs = Storage.getPreferences();
    let theme = prefs.theme;
    if (!theme || theme === 'auto') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }
    applyTheme(theme);
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    updateThemeToggleIcon(theme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    Storage.savePreferences({ theme: newTheme });
    applyTheme(newTheme);
    showToast(`Switched to ${newTheme} mode`, 'info', 2000);
  }

  function updateThemeToggleIcon(theme) {
    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach(btn => {
      btn.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
      btn.setAttribute('title', `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`);
    });
  }

  // Init Common Navigation & Topbar
  function initCommonLayout(activePage, currentUser) {
    initTheme();

    // Render Sidebar if exists
    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarEl && currentUser) {
      renderSidebarContent(sidebarEl, activePage, currentUser);
    }

    // Render Topbar if exists
    const topbarEl = document.querySelector('.topbar');
    if (topbarEl && currentUser) {
      renderTopbarContent(topbarEl, currentUser);
    }

    // Setup mobile drawer toggles
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const backdrop = document.querySelector('.sidebar-backdrop');
    if (mobileToggle && sidebarEl) {
      mobileToggle.onclick = () => {
        sidebarEl.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('active');
      };
    }
    if (backdrop && sidebarEl) {
      backdrop.onclick = () => {
        sidebarEl.classList.remove('open');
        backdrop.classList.remove('active');
      };
    }

    // Format local date display
    const dateElements = document.querySelectorAll('.current-local-date');
    const now = new Date();
    const formattedDate = now.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    dateElements.forEach(el => { el.textContent = formattedDate; });

    // Render copyright footer into main container if present
    const mainWrapper = document.querySelector('.main-wrapper') || document.querySelector('.content-body');
    if (mainWrapper) {
      renderFooter(mainWrapper);
    }
  }

  function renderSidebarContent(sidebarEl, activePage, user) {
    const isAdmin = user.role === 'admin';
    const company = Storage.getCompany() || { name: 'HCM Lite' };
    const prefix = Auth.isPagesDir() ? '' : 'pages/';

    let navItemsHtml = '';
    if (isAdmin) {
      navItemsHtml = `
        <div class="nav-group-title">Administration</div>
        <ul class="nav-list">
          <li>
            <a href="${prefix}admin.html" class="nav-link ${activePage === 'admin' ? 'active' : ''}">
              ${ICONS.dashboard} <span>Dashboard</span>
            </a>
          </li>
          <li>
            <a href="${prefix}employees.html" class="nav-link ${activePage === 'employees' ? 'active' : ''}">
              ${ICONS.users} <span>Employees</span>
            </a>
          </li>
          <li>
            <a href="${prefix}leaves.html" class="nav-link ${activePage === 'leaves' ? 'active' : ''}">
              ${ICONS.calendar} <span>Leave Requests</span>
              <span id="sidebar-pending-leaves-badge" class="nav-badge" style="display: none;">0</span>
            </a>
          </li>
          <li>
            <a href="${prefix}payslip.html" class="nav-link ${activePage === 'payslip' ? 'active' : ''}">
              ${ICONS.fileText} <span>Payroll & Payslips</span>
            </a>
          </li>
          <li>
            <a href="${prefix}settings.html" class="nav-link ${activePage === 'settings' ? 'active' : ''}">
              ${ICONS.settings} <span>Company Settings</span>
            </a>
          </li>
        </ul>
      `;
    } else {
      navItemsHtml = `
        <div class="nav-group-title">Employee Portal</div>
        <ul class="nav-list">
          <li>
            <a href="${prefix}employee.html" class="nav-link ${activePage === 'employee' ? 'active' : ''}">
              ${ICONS.dashboard} <span>My Dashboard</span>
            </a>
          </li>
          <li>
            <a href="${prefix}payslip.html" class="nav-link ${activePage === 'payslip' ? 'active' : ''}">
              ${ICONS.fileText} <span>My Payslip</span>
            </a>
          </li>
        </ul>
      `;
    }

    sidebarEl.innerHTML = `
      <div class="sidebar-header">
        <a href="${isAdmin ? prefix + 'admin.html' : prefix + 'employee.html'}" class="brand-link">
          <div class="brand-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
          </div>
          <div class="brand-text">
            <span class="brand-title">HCM Lite</span>
            <span class="brand-subtitle">${escapeHTML(company.name || 'Workspace')}</span>
          </div>
        </a>
      </div>
      <div class="sidebar-body">
        ${navItemsHtml}
      </div>
      <div class="sidebar-footer">
        <div class="user-snippet">
          <div class="user-avatar-initials">${getInitials(user.name)}</div>
          <div class="user-info-text">
            <div class="user-name" title="${escapeHTML(user.name)}">${escapeHTML(user.name)}</div>
            <div class="user-role-tag">${user.role === 'admin' ? 'Administrator' : escapeHTML(user.designation || 'Employee')}</div>
          </div>
          <button class="btn-icon-subtle" id="sidebar-logout-btn" title="Sign Out">
            ${ICONS.logOut}
          </button>
        </div>
      </div>
    `;

    const logoutBtn = sidebarEl.querySelector('#sidebar-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        showConfirmModal({
          title: 'Sign Out',
          message: 'Are you sure you want to sign out of your account?',
          confirmText: 'Sign Out',
          onConfirm: () => Auth.logout()
        });
      };
    }

    // Update pending leaves badge for Admin
    if (isAdmin) {
      const pendingLeaves = Storage.getLeaves().filter(l => l.status === 'Pending').length;
      const badge = sidebarEl.querySelector('#sidebar-pending-leaves-badge');
      if (badge) {
        if (pendingLeaves > 0) {
          badge.textContent = pendingLeaves;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  }

  function renderTopbarContent(topbarEl, user) {
    const company = Storage.getCompany() || { name: 'HCM Lite' };
    const isAdmin = user.role === 'admin';
    const roleLabel = isAdmin ? 'Admin' : (user.designation || 'Employee');
    const roleClass = isAdmin ? 'role-admin' : 'role-employee';

    topbarEl.innerHTML = `
      <div class="topbar-left">
        <button class="mobile-menu-toggle" aria-label="Toggle Navigation">${ICONS.menu}</button>
        <div class="topbar-company-badge">
          <span class="company-pulse-dot"></span>
          <span class="company-name-text">${escapeHTML(company.name)}</span>
        </div>
      </div>
      <div class="topbar-right">
        <div class="topbar-date">
          ${ICONS.calendar}
          <span class="current-local-date date-text"></span>
        </div>
        <button class="btn btn-outline btn-icon-only theme-toggle-btn" title="Toggle Theme" aria-label="Toggle Theme">
          ${ICONS.moon}
        </button>

        <!-- User Profile Dropdown with Prominent Logout -->
        <div class="profile-dropdown-container" id="topbar-profile-container">
          <button class="profile-trigger-btn" id="topbar-profile-trigger" aria-haspopup="true" aria-expanded="false" title="${escapeHTML(user.name)} (${roleLabel})">
            <div class="profile-trigger-avatar">${getInitials(user.name)}</div>
            <span class="profile-trigger-name">${escapeHTML(user.name)}</span>
            <span class="profile-trigger-chevron">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
          </button>
          <div class="profile-dropdown-menu" id="topbar-profile-menu">
            <div class="profile-dropdown-header">
              <div class="profile-dropdown-avatar">${getInitials(user.name)}</div>
              <div class="profile-dropdown-info">
                <div class="profile-dropdown-fullname" title="${escapeHTML(user.name)}">${escapeHTML(user.name)}</div>
                <div class="profile-dropdown-role ${roleClass}">${escapeHTML(roleLabel)}</div>
              </div>
            </div>
            <div class="profile-dropdown-list">
              <button type="button" class="profile-dropdown-item" id="topbar-switch-workspace-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"></path></svg>
                <span>Switch Workspace</span>
              </button>
              <button type="button" class="profile-dropdown-item" id="topbar-change-pwd-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-1.5 1.5L16 7l-2-2m-2 2l-2-2m-2 2l-2-2m-2 2L2 14v8h8l8.5-8.5"></path></svg>
                <span>Change Password</span>
              </button>
              <button type="button" class="profile-dropdown-item item-logout" id="topbar-logout-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const themeBtn = topbarEl.querySelector('.theme-toggle-btn');
    if (themeBtn) themeBtn.onclick = toggleTheme;

    const container = topbarEl.querySelector('#topbar-profile-container');
    const trigger = topbarEl.querySelector('#topbar-profile-trigger');
    const switchBtn = topbarEl.querySelector('#topbar-switch-workspace-btn');
    const pwdBtn = topbarEl.querySelector('#topbar-change-pwd-btn');
    const logoutBtn = topbarEl.querySelector('#topbar-logout-btn');

    if (trigger && container) {
      trigger.onclick = (e) => {
        e.stopPropagation();
        const isOpen = container.classList.toggle('open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      };

      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
          container.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (switchBtn) {
      switchBtn.onclick = () => {
        if (container) container.classList.remove('open');
        showConfirmModal({
          title: 'Switch Workspace',
          message: 'This will end your current session and return to workspace selection. Continue?',
          confirmText: 'Switch Workspace',
          isDestructive: false,
          onConfirm: () => Auth.switchCompany()
        });
      };
    }

    if (pwdBtn) {
      pwdBtn.onclick = () => {
        if (container) container.classList.remove('open');
        showChangePasswordModal();
      };
    }

    if (logoutBtn) {
      logoutBtn.onclick = () => {
        if (container) container.classList.remove('open');
        showConfirmModal({
          title: 'Sign Out',
          message: 'Are you sure you want to sign out of your account?',
          confirmText: 'Sign Out',
          isDestructive: true,
          onConfirm: () => Auth.logout()
        });
      };
    }
  }

  // Change Password Modal
  function showChangePasswordModal() {
    let modal = document.getElementById('change-pwd-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'change-pwd-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Change Password</h3>
            <button class="modal-close" id="change-pwd-close">${ICONS.x}</button>
          </div>
          <form id="change-pwd-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Current Password <span class="required">*</span></label>
                <input type="password" id="current-pwd-input" class="form-input" required placeholder="Enter current password">
                <div class="form-error" id="current-pwd-error"></div>
              </div>
              <div class="form-group">
                <label class="form-label">New Password <span class="required">*</span></label>
                <input type="password" id="new-pwd-input" class="form-input" required minlength="6" placeholder="At least 6 characters">
                <div class="form-error" id="new-pwd-error"></div>
              </div>
              <div class="form-group">
                <label class="form-label">Confirm New Password <span class="required">*</span></label>
                <input type="password" id="confirm-pwd-input" class="form-input" required placeholder="Re-enter new password">
                <div class="form-error" id="confirm-pwd-error"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline" id="change-pwd-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">Update Password</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const closeBtn = document.getElementById('change-pwd-close');
    const cancelBtn = document.getElementById('change-pwd-cancel');
    const form = document.getElementById('change-pwd-form');

    const closeModal = () => { modal.classList.remove('active'); form.reset(); };
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const currentPwd = document.getElementById('current-pwd-input').value;
      const newPwd = document.getElementById('new-pwd-input').value;
      const confirmPwd = document.getElementById('confirm-pwd-input').value;

      if (newPwd !== confirmPwd) {
        showToast('New passwords do not match.', 'error');
        return;
      }

      try {
        await Auth.changePassword(currentPwd, newPwd);
        showToast('Password updated successfully!', 'success');
        closeModal();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    modal.classList.add('active');
  }

  // Initials generator
  function getInitials(name = '') {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // HTML entity escaper
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Copyright Footer Generator (Shared & Minimal)
  function getFooterHTML(extraClass = '') {
    const year = new Date().getFullYear();
    return `
      <footer class="app-copyright-footer ${extraClass}" role="contentinfo">
        <p class="copyright-text">
          &copy; ${year} HCM Lite. Developed by <a href="https://github.com/hashirdilmuradzai/" target="_blank" rel="noopener noreferrer" class="copyright-link">Hashir Dilmurad Zai</a>
        </p>
      </footer>
    `;
  }

  function renderFooter(containerEl, extraClass = '') {
    if (!containerEl) return;
    if (containerEl.querySelector('.app-copyright-footer')) return; // Avoid duplicates
    const div = document.createElement('div');
    div.innerHTML = getFooterHTML(extraClass);
    containerEl.appendChild(div.firstElementChild);
  }

  return {
    ICONS,
    showToast,
    showConfirmModal,
    initTheme,
    toggleTheme,
    initCommonLayout,
    getInitials,
    escapeHTML,
    showChangePasswordModal,
    getFooterHTML,
    renderFooter
  };
})();
