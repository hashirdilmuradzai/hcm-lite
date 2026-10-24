/**
 * HCM Lite — Settings Management Page Controller
 * Handles company rules, attendance verification, holidays, JSON backup/restore, and clear data
 */

const SettingsController = (() => {
  function initSettingsPage() {
    const user = Auth.requireAuth('admin');
    if (!user) return;

    UI.initCommonLayout('settings', user);

    loadCompanySettings();
    loadHolidaysList();
    setupEventListeners();
  }

  function loadCompanySettings() {
    const company = Storage.getCompany() || {};

    // Populate core settings
    const nameInput = document.getElementById('company-name-input');
    const startInput = document.getElementById('office-start-input');
    const graceInput = document.getElementById('grace-minutes-input');
    const quotaInput = document.getElementById('leave-quota-input');

    if (nameInput) nameInput.value = company.name || '';
    if (startInput) startInput.value = company.startTime || '09:00';
    if (graceInput) graceInput.value = company.graceMinutes !== undefined ? company.graceMinutes : 15;
    if (quotaInput) quotaInput.value = company.leaveQuota !== undefined ? company.leaveQuota : 18;

    // Working days checkboxes (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun)
    const workingDays = company.workingDays || [1, 2, 3, 4, 5];
    for (let day = 0; day <= 6; day++) {
      const cb = document.getElementById(`workday-${day}`);
      if (cb) {
        cb.checked = workingDays.includes(day);
      }
    }

    // Geolocation and Camera Verification
    const latInput = document.getElementById('office-lat-input');
    const lngInput = document.getElementById('office-lng-input');
    const radiusInput = document.getElementById('office-radius-input');
    const cameraToggle = document.getElementById('camera-verify-toggle');
    const gpsToggle = document.getElementById('gps-verify-toggle');

    if (latInput) latInput.value = company.officeLat !== null && company.officeLat !== undefined ? company.officeLat : '';
    if (lngInput) lngInput.value = company.officeLng !== null && company.officeLng !== undefined ? company.officeLng : '';
    if (radiusInput) radiusInput.value = company.officeRadius || 150;
    if (cameraToggle) cameraToggle.checked = !!company.cameraVerification;
    if (gpsToggle) gpsToggle.checked = !!company.gpsVerification;
  }

  function setupEventListeners() {
    // Save Company Core & Verification Settings
    const form = document.getElementById('company-settings-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        saveAllSettings();
      };
    }

    // Capture Current Location Button
    const captureLocBtn = document.getElementById('btn-capture-location');
    if (captureLocBtn) {
      captureLocBtn.onclick = async () => {
        const statusEl = document.getElementById('location-status-text');
        captureLocBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Requesting browser GPS position...';

        try {
          const pos = await GeoLocationService.getCurrentPosition();
          document.getElementById('office-lat-input').value = pos.latitude.toFixed(6);
          document.getElementById('office-lng-input').value = pos.longitude.toFixed(6);
          if (statusEl) {
            statusEl.innerHTML = `<span style="color: var(--color-success);">Captured: ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)} (Accuracy: ±${pos.accuracy}m)</span>`;
          }
          UI.showToast('Current GPS coordinates captured! Don\'t forget to save settings.', 'success');
        } catch (err) {
          if (statusEl) {
            statusEl.innerHTML = `<span style="color: var(--color-error);">${err.message}</span>`;
          }
          UI.showToast(err.message, 'error');
        } finally {
          captureLocBtn.disabled = false;
        }
      };
    }

    // Holiday Form
    const holidayForm = document.getElementById('add-holiday-form');
    if (holidayForm) {
      holidayForm.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('holiday-name-input').value.trim();
        const date = document.getElementById('holiday-date-input').value;

        if (!name || !date) {
          UI.showToast('Please provide both holiday name and date.', 'error');
          return;
        }

        Storage.saveHoliday({ name, date });
        holidayForm.reset();
        loadHolidaysList();
        UI.showToast('Holiday added.', 'success');
      };
    }

    // Export Data JSON
    const exportBtn = document.getElementById('btn-export-backup');
    if (exportBtn) {
      exportBtn.onclick = () => {
        const jsonStr = Storage.exportAllData();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `hcm_lite_backup_${Attendance.getLocalDateString()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        UI.showToast('Backup JSON downloaded successfully.', 'success');
      };
    }

    // Import Data JSON
    const importFileInput = document.getElementById('import-file-input');
    if (importFileInput) {
      importFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          UI.showConfirmModal({
            title: 'Restore Data Backup',
            message: 'Importing data will replace existing local records. Are you sure you wish to proceed?',
            confirmText: 'Restore Backup',
            isDestructive: false,
            onConfirm: () => {
              const res = Storage.importAllData(event.target.result);
              if (res.success) {
                UI.showToast('Data restored successfully! Reloading...', 'success');
                setTimeout(() => window.location.reload(), 1200);
              } else {
                UI.showToast(`Import failed: ${res.error}`, 'error');
              }
            }
          });
        };
        reader.readAsText(file);
        importFileInput.value = '';
      };
    }

    // Clear All Data
    const clearBtn = document.getElementById('btn-clear-all-data');
    if (clearBtn) {
      clearBtn.onclick = () => {
        UI.showConfirmModal({
          title: 'DANGER: Clear All Local Data',
          message: 'This action will completely wipe all company settings, employees, attendance, and leave records stored in this browser. This cannot be undone.',
          confirmText: 'Yes, Delete Everything',
          isDestructive: true,
          onConfirm: () => {
            Storage.clearAllData();
            UI.showToast('All local application data wiped.', 'info');
            setTimeout(() => {
              window.location.href = '../index.html';
            }, 800);
          }
        });
      };
    }
  }

  function saveAllSettings() {
    const name = document.getElementById('company-name-input').value.trim();
    const startTime = document.getElementById('office-start-input').value || '09:00';
    const graceMinutes = parseInt(document.getElementById('grace-minutes-input').value, 10) || 15;
    const leaveQuota = parseInt(document.getElementById('leave-quota-input').value, 10) || 18;

    // Collect checked days
    const workingDays = [];
    for (let day = 0; day <= 6; day++) {
      const cb = document.getElementById(`workday-${day}`);
      if (cb && cb.checked) {
        workingDays.push(day);
      }
    }

    if (workingDays.length === 0) {
      UI.showToast('You must select at least one weekly working day.', 'error');
      return;
    }

    const officeLat = document.getElementById('office-lat-input').value.trim();
    const officeLng = document.getElementById('office-lng-input').value.trim();
    const officeRadius = parseInt(document.getElementById('office-radius-input').value, 10) || 150;
    const cameraVerification = document.getElementById('camera-verify-toggle').checked;
    const gpsVerification = document.getElementById('gps-verify-toggle').checked;

    if (gpsVerification && (!officeLat || !officeLng)) {
      UI.showToast('Please capture or enter office GPS coordinates before enabling GPS verification.', 'error');
      return;
    }

    Storage.saveCompany({
      name,
      startTime,
      graceMinutes,
      workingDays,
      leaveQuota,
      officeLat: officeLat ? parseFloat(officeLat) : null,
      officeLng: officeLng ? parseFloat(officeLng) : null,
      officeRadius,
      cameraVerification,
      gpsVerification
    });

    Storage.logActivity('Settings Updated', 'Company rules and attendance verification policies updated', 'admin');
    UI.showToast('Company settings updated successfully!', 'success');
  }

  function loadHolidaysList() {
    const listEl = document.getElementById('holidays-list-body');
    if (!listEl) return;

    const holidays = Storage.getHolidays();
    if (holidays.length === 0) {
      listEl.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--color-text-muted); padding: var(--space-4);">No company holidays configured.</td></tr>`;
      return;
    }

    listEl.innerHTML = holidays.map(h => `
      <tr>
        <td><strong>${UI.escapeHTML(h.name)}</strong></td>
        <td>${h.date}</td>
        <td style="text-align: right;">
          <button class="btn-icon-subtle delete-holiday-btn" data-id="${h.id}" title="Remove holiday">
            ${UI.ICONS.x}
          </button>
        </td>
      </tr>
    `).join('');

    listEl.querySelectorAll('.delete-holiday-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        Storage.deleteHoliday(id);
        loadHolidaysList();
        UI.showToast('Holiday removed.', 'info');
      };
    });
  }

  return {
    initSettingsPage
  };
})();
