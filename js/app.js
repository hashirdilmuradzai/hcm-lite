/**
 * HCM Lite — Main Application Orchestrator
 * Page initialization, event wiring, and view rendering for all 7 application views
 */

const App = (() => {
  // Detect current page
  function getCurrentPageName() {
    const path = window.location.pathname;
    if (path.endsWith('index.html') || path.endsWith('/') || !path.includes('.html')) return 'index';
    if (path.includes('admin.html')) return 'admin';
    if (path.includes('employees.html')) return 'employees';
    if (path.includes('leaves.html')) return 'leaves';
    if (path.includes('settings.html')) return 'settings';
    if (path.includes('employee.html')) return 'employee';
    if (path.includes('payslip.html')) return 'payslip';
    return 'index';
  }

  // --- PAGE 1: INDEX (LOGIN & FIRST-RUN COMPANY SETUP) ---
  function initIndexPage() {
    UI.initTheme();

    const isFirstRun = Auth.checkFirstRun();
    const setupCard = document.getElementById('first-run-setup-card');
    const loginCard = document.getElementById('login-card');

    if (isFirstRun) {
      if (setupCard) setupCard.style.display = 'block';
      if (loginCard) loginCard.style.display = 'none';
      setupFirstRunForm();
    } else {
      if (setupCard) setupCard.style.display = 'none';
      if (loginCard) loginCard.style.display = 'block';
      setupLoginForm();

      // Check if session already active
      const session = Storage.getSession();
      if (session && session.userId) {
        const user = Storage.getUserById(session.userId);
        if (user) {
          if (user.role === 'admin') window.location.href = 'pages/admin.html';
          else window.location.href = 'pages/employee.html';
        }
      }
    }
  }

  function setupFirstRunForm() {
    const form = document.getElementById('first-run-form');
    if (!form) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Setting up workspace...';

      const companyName = document.getElementById('setup-company-name').value;
      const adminName = document.getElementById('setup-admin-name').value;
      const adminEmail = document.getElementById('setup-admin-email').value;
      const adminPassword = document.getElementById('setup-admin-pwd').value;
      const confirmPassword = document.getElementById('setup-confirm-pwd').value;
      const startTime = document.getElementById('setup-start-time').value || '09:00';
      const graceMinutes = document.getElementById('setup-grace-mins').value || 15;
      const leaveQuota = document.getElementById('setup-leave-quota').value || 18;

      if (adminPassword !== confirmPassword) {
        UI.showToast('Passwords do not match.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Company & Admin Account';
        return;
      }

      try {
        await Auth.setupCompanyAndAdmin({
          companyName,
          adminName,
          adminEmail,
          adminPassword,
          startTime,
          graceMinutes,
          leaveQuota,
          workingDays: [1, 2, 3, 4, 5] // Mon - Fri default
        });

        UI.showToast('Workspace created successfully! Entering dashboard...', 'success');
        setTimeout(() => {
          window.location.href = 'pages/admin.html';
        }, 800);
      } catch (err) {
        UI.showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Company & Admin Account';
      }
    };
  }

  function setupLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const company = Storage.getCompany();
    const titleEl = document.getElementById('login-company-title');
    if (titleEl && company && company.name) {
      titleEl.textContent = company.name;
    }

    const togglePwdBtn = document.getElementById('toggle-login-pwd');
    const pwdInput = document.getElementById('login-password');
    if (togglePwdBtn && pwdInput) {
      togglePwdBtn.onclick = () => {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
        togglePwdBtn.textContent = isPwd ? 'Hide' : 'Show';
      };
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      const email = document.getElementById('login-email').value;
      const password = pwdInput.value;

      try {
        const user = await Auth.login(email, password);
        UI.showToast(`Welcome back, ${user.name}!`, 'success');
        setTimeout(() => {
          if (user.role === 'admin') {
            window.location.href = 'pages/admin.html';
          } else {
            window.location.href = 'pages/employee.html';
          }
        }, 500);
      } catch (err) {
        UI.showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    };
  }

  // --- PAGE 2: ADMIN DASHBOARD ---
  function initAdminDashboard() {
    const user = Auth.requireAuth('admin');
    if (!user) return;

    UI.initCommonLayout('admin', user);

    renderAdminDashboardData();
    SmartHelper.initWidget('admin-helper-container', user);
    AnnouncementManager.renderAnnouncementsList('admin-announcements-list', true);

    // New Announcement button
    const newAnnBtn = document.getElementById('btn-new-announcement');
    if (newAnnBtn) {
      newAnnBtn.onclick = () => {
        AnnouncementManager.showCreateAnnouncementModal(() => {
          AnnouncementManager.renderAnnouncementsList('admin-announcements-list', true);
        });
      };
    }

    // Export CSV trigger
    const exportCsvBtn = document.getElementById('btn-quick-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.onclick = () => {
        try {
          const count = Reports.exportAttendanceToCSV({});
          UI.showToast(`Exported ${count} attendance records to CSV.`, 'success');
        } catch (err) {
          UI.showToast(err.message, 'error');
        }
      };
    }

    // Monthly Report Print trigger
    const printReportBtn = document.getElementById('btn-monthly-report-modal');
    if (printReportBtn) {
      printReportBtn.onclick = () => {
        const now = new Date();
        Reports.showPrintableMonthlyReport(now.getFullYear(), now.getMonth() + 1);
      };
    }

    // React to storage changes
    window.addEventListener('hcm_storage_change', () => {
      renderAdminDashboardData();
    });
  }

  function renderAdminDashboardData() {
    const stats = Attendance.getTodayStats();
    const todayStr = Attendance.getLocalDateString();

    // Metric counters
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('stat-total-employees', stats.totalEmployees);
    setVal('stat-present-today', stats.presentToday);
    setVal('stat-late-today', stats.lateToday);
    setVal('stat-on-leave-today', stats.onLeaveToday);
    setVal('stat-absent-today', stats.absentToday);
    setVal('stat-pending-leaves', stats.pendingLeaves);

    // Today's Attendance Table
    const tableBody = document.getElementById('admin-today-attendance-body');
    const emptyState = document.getElementById('admin-attendance-empty');
    const tableContainer = document.getElementById('admin-attendance-table-container');

    const todayRecords = Storage.getAttendanceForDate(todayStr);

    if (todayRecords.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      if (tableContainer) tableContainer.style.display = 'none';
    } else {
      if (emptyState) emptyState.style.display = 'none';
      if (tableContainer) tableContainer.style.display = 'block';

      if (tableBody) {
        tableBody.innerHTML = todayRecords.map(rec => {
          const emp = Storage.getUserById(rec.employeeId);
          const empName = emp ? emp.name : 'Unknown';
          const empDept = emp ? (emp.department || 'General') : 'N/A';

          let statusBadgeClass = 'badge-success';
          if (rec.status === 'Half Day') statusBadgeClass = 'badge-warning';
          else if (rec.isLate) statusBadgeClass = 'badge-warning';

          return `
            <tr>
              <td>
                <div class="user-cell">
                  <div class="user-avatar-initials" style="width: 32px; height: 32px; font-size: 0.75rem;">${UI.getInitials(empName)}</div>
                  <div class="user-cell-meta">
                    <span class="user-cell-name">${UI.escapeHTML(empName)}</span>
                    <span class="user-cell-id">${rec.employeeId}</span>
                  </div>
                </div>
              </td>
              <td>${UI.escapeHTML(empDept)}</td>
              <td><strong>${rec.checkIn}</strong></td>
              <td>${rec.checkOut ? `<strong>${rec.checkOut}</strong>` : `<span style="color: var(--color-text-muted); font-style: italic;">In Progress</span>`}</td>
              <td>${rec.workHours !== null ? `${rec.workHours}h` : '—'}</td>
              <td>
                <span class="badge ${statusBadgeClass}">
                  <span class="badge-dot"></span>
                  ${rec.status} ${rec.isLate && rec.status !== 'Late' ? '(Late)' : ''}
                </span>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Pending Leaves Review Section
    const pendingContainer = document.getElementById('admin-pending-leaves-list');
    const pendingEmpty = document.getElementById('admin-pending-leaves-empty');
    const pendingLeaves = Storage.getLeaves().filter(l => l.status === 'Pending');

    if (pendingLeaves.length === 0) {
      if (pendingEmpty) pendingEmpty.style.display = 'flex';
      if (pendingContainer) pendingContainer.style.display = 'none';
    } else {
      if (pendingEmpty) pendingEmpty.style.display = 'none';
      if (pendingContainer) {
        pendingContainer.style.display = 'flex';
        pendingContainer.innerHTML = pendingLeaves.map(leave => {
          const emp = Storage.getUserById(leave.employeeId);
          const empName = emp ? emp.name : leave.employeeId;
          const balance = Leave.getLeaveBalance(leave.employeeId);

          return `
            <div class="card" style="margin-bottom: var(--space-3); border-left: 3px solid var(--color-warning);">
              <div class="card-body" style="padding: var(--space-4);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                  <div>
                    <strong style="color: var(--color-text-main); font-size: var(--font-size-sm);">${UI.escapeHTML(empName)}</strong>
                    <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">${leave.type} Leave • ${leave.days} working day(s)</div>
                  </div>
                  <span class="badge badge-warning">Pending</span>
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: 8px;">
                  <strong>Dates:</strong> ${leave.fromDate} to ${leave.toDate} | <strong>Reason:</strong> "${UI.escapeHTML(leave.reason)}"
                </div>
                <div style="font-size: 0.72rem; color: var(--color-text-muted); margin-bottom: 10px;">
                  Annual Quota Remaining: <strong>${balance.remainingDays} days</strong>
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                  <button class="btn btn-outline btn-sm reject-leave-quick-btn" data-id="${leave.id}">Reject</button>
                  <button class="btn btn-success btn-sm approve-leave-quick-btn" data-id="${leave.id}">Approve</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

        pendingContainer.querySelectorAll('.approve-leave-quick-btn').forEach(btn => {
          btn.onclick = () => {
            const id = btn.getAttribute('data-id');
            showLeaveDecisionDialog(id, true);
          };
        });

        pendingContainer.querySelectorAll('.reject-leave-quick-btn').forEach(btn => {
          btn.onclick = () => {
            const id = btn.getAttribute('data-id');
            showLeaveDecisionDialog(id, false);
          };
        });
      }
    }

    // Recent Activity Feed
    const activityContainer = document.getElementById('admin-activity-feed');
    if (activityContainer) {
      const logs = Storage.getActivityLog().slice(0, 7);
      if (logs.length === 0) {
        activityContainer.innerHTML = `<div style="color: var(--color-text-muted); font-size: var(--font-size-xs); padding: 10px 0;">No recent actions recorded.</div>`;
      } else {
        activityContainer.innerHTML = logs.map(l => {
          const time = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `
            <li class="activity-item">
              <div class="activity-indicator">
                <div class="activity-indicator-dot"></div>
              </div>
              <div class="activity-content">
                <div class="activity-text"><strong>${UI.escapeHTML(l.action)}</strong>: ${UI.escapeHTML(l.details)}</div>
                <div class="activity-time">${time}</div>
              </div>
            </li>
          `;
        }).join('');
      }
    }

    // Render Charts if on page and available
    if (typeof AnalyticsCharts !== 'undefined') {
      setTimeout(() => {
        AnalyticsCharts.renderTodayDistribution('chart-today-distribution');
        AnalyticsCharts.renderDepartmentAttendance('chart-department-attendance');
        AnalyticsCharts.renderMonthlyTrend('chart-monthly-trend');
      }, 50);
    }
  }

  // --- Leave Decision Dialog (Approve / Reject with comment) ---
  function showLeaveDecisionDialog(leaveId, isApprove) {
    const leave = Storage.getLeaves().find(l => String(l.id) === String(leaveId));
    if (!leave) return;
    const emp = Storage.getUserById(leave.employeeId);
    const empName = emp ? emp.name : leave.employeeId;

    let modal = document.getElementById('leave-decision-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'leave-decision-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title" id="leave-decision-title"></h3>
            <button class="modal-close" id="close-leave-decision">${UI.ICONS.x}</button>
          </div>
          <form id="leave-decision-form">
            <div class="modal-body">
              <p id="leave-decision-summary" style="font-size: var(--font-size-sm); margin-bottom: var(--space-4); color: var(--color-text-secondary);"></p>
              <div class="form-group">
                <label class="form-label">Admin Comment / Note</label>
                <textarea id="leave-decision-comment" class="form-textarea" rows="3" placeholder="Add optional remarks for the employee..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline" id="cancel-leave-decision">Cancel</button>
              <button type="submit" class="btn" id="submit-leave-decision"></button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const titleEl = modal.querySelector('#leave-decision-title');
    const summaryEl = modal.querySelector('#leave-decision-summary');
    const submitBtn = modal.querySelector('#submit-leave-decision');
    const closeBtn = modal.querySelector('#close-leave-decision');
    const cancelBtn = modal.querySelector('#cancel-leave-decision');
    const form = modal.querySelector('#leave-decision-form');
    const commentInput = modal.querySelector('#leave-decision-comment');

    titleEl.textContent = isApprove ? `Approve Leave Request` : `Reject Leave Request`;
    summaryEl.innerHTML = `<strong>${UI.escapeHTML(empName)}</strong> requested <strong>${leave.days} day(s) ${leave.type} leave</strong> from <strong>${leave.fromDate}</strong> to <strong>${leave.toDate}</strong>. Reason: <em>"${UI.escapeHTML(leave.reason)}"</em>`;

    submitBtn.textContent = isApprove ? 'Confirm Approval' : 'Confirm Rejection';
    submitBtn.className = `btn ${isApprove ? 'btn-success' : 'btn-danger'}`;

    const closeModal = () => { modal.classList.remove('active'); form.reset(); };
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    form.onsubmit = (e) => {
      e.preventDefault();
      const comment = commentInput.value;
      try {
        if (isApprove) {
          Leave.approveLeave(leaveId, comment);
          UI.showToast('Leave request approved successfully!', 'success');
        } else {
          Leave.rejectLeave(leaveId, comment);
          UI.showToast('Leave request rejected.', 'info');
        }
        closeModal();
        if (getCurrentPageName() === 'admin') {
          renderAdminDashboardData();
        }
        if (typeof LeavesController !== 'undefined' && LeavesController.renderLeavesTable) {
          LeavesController.renderLeavesTable();
        }
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    };

    modal.classList.add('active');
  }

  // Auto-init on page load
  function init() {
    const page = getCurrentPageName();
    if (page === 'index') {
      initIndexPage();
    } else if (page === 'admin') {
      initAdminDashboard();
    } else if (page === 'settings') {
      SettingsController.initSettingsPage();
    }
  }

  return {
    init,
    showLeaveDecisionDialog
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
