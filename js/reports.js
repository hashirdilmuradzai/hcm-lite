/**
 * HCM Lite — Reports & CSV Export Module (Bonus Features E & F)
 * - CSV Export with custom filters (Employee, Department, Date range, Status)
 * - Printable Monthly Attendance Report for Admin
 * - Native browser printing with formatted clean layout
 */

const Reports = (() => {
  // Export Attendance records to CSV with filtering
  function exportAttendanceToCSV(filters = {}) {
    const { employeeId, department, fromDate, toDate, status } = filters;
    let records = Storage.getAttendance();

    // Filter by date range
    if (fromDate) {
      records = records.filter(r => r.date >= fromDate);
    }
    if (toDate) {
      records = records.filter(r => r.date <= toDate);
    }

    // Filter by employee
    if (employeeId) {
      records = records.filter(r => String(r.employeeId) === String(employeeId));
    }

    // Filter by status
    if (status) {
      records = records.filter(r => r.status === status);
    }

    // Join with employee details
    const rows = [];
    // CSV Header
    rows.push([
      'Employee ID',
      'Employee Name',
      'Department',
      'Date',
      'Check In',
      'Check Out',
      'Worked Hours',
      'Status',
      'Is Late',
      'Verification Method'
    ]);

    records.forEach(r => {
      const emp = Storage.getUserById(r.employeeId);
      const empDept = emp ? (emp.department || 'General') : 'N/A';
      const empName = emp ? emp.name : 'Unknown';

      // Department filter
      if (department && empDept !== department) {
        return;
      }

      rows.push([
        r.employeeId,
        empName,
        empDept,
        r.date,
        r.checkIn || '',
        r.checkOut || '',
        r.workHours !== null && r.workHours !== undefined ? r.workHours : '',
        r.status || 'Present',
        r.isLate ? 'Yes' : 'No',
        r.verificationMethod || 'standard'
      ]);
    });

    if (rows.length <= 1) {
      throw new Error('No records found matching the selected export filters.');
    }

    // Convert array of rows to CSV string with standard quoting
    const csvContent = rows.map(row => {
      return row.map(val => {
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',');
    }).join('\r\n');

    // Trigger download using Blob
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `attendance_export_${fromDate || 'all'}_to_${toDate || 'all'}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return rows.length - 1; // Count of exported records
  }

  // Generate and display printable monthly attendance report modal
  function showPrintableMonthlyReport(year, month) {
    const company = Storage.getCompany() || { name: 'HCM Lite' };
    const employees = Storage.getUsers().filter(u => u.role === 'employee' && u.status !== 'inactive');
    const monthDate = new Date(year, month - 1, 1);
    const monthName = monthDate.toLocaleString('default', { month: 'long' });

    // Aggregate statistics across all employees
    let totalPresent = 0;
    let totalLate = 0;
    let totalHalfDays = 0;
    let totalAbsences = 0;
    let totalLeaveDays = 0;
    let workingDaysInMonth = 0;

    const employeeRows = [];

    employees.forEach(emp => {
      const stats = Attendance.getEmployeeMonthlyAttendance(emp.id, year, month);
      if (stats) {
        workingDaysInMonth = stats.workingDaysInMonth;
        totalPresent += stats.presentDays;
        totalLate += stats.lateDays;
        totalHalfDays += stats.halfDays;
        totalAbsences += stats.absentDays;
        totalLeaveDays += stats.approvedLeaveDays;

        employeeRows.push({
          id: emp.id,
          name: emp.name,
          department: emp.department || 'General',
          present: stats.presentDays,
          late: stats.lateDays,
          halfDays: stats.halfDays,
          absent: stats.absentDays,
          leave: stats.approvedLeaveDays,
          hours: stats.totalWorkedHours
        });
      }
    });

    let reportModal = document.getElementById('monthly-report-modal');
    if (!reportModal) {
      reportModal = document.createElement('div');
      reportModal.id = 'monthly-report-modal';
      reportModal.className = 'modal-backdrop';
      document.body.appendChild(reportModal);
    }

    reportModal.innerHTML = `
      <div class="modal-dialog modal-xl" style="max-height: 95vh;">
        <div class="modal-header no-print">
          <h3 class="modal-title">Monthly Attendance Report — ${monthName} ${year}</h3>
          <button class="modal-close" id="close-report-modal">${UI.ICONS.x}</button>
        </div>
        <div class="modal-body" id="printable-report-content">
          <div style="border-bottom: 2px solid var(--color-primary-dark); padding-bottom: 15px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h1 style="font-size: 1.5rem; font-weight: bold; color: var(--color-primary-dark); margin: 0;">${UI.escapeHTML(company.name)}</h1>
                <p style="color: var(--color-text-secondary); margin-top: 4px; font-size: 0.9rem;">Monthly Attendance & Productivity Report</p>
              </div>
              <div style="text-align: right; font-size: 0.85rem; color: var(--color-text-secondary);">
                <div><strong>Period:</strong> ${monthName} ${year}</div>
                <div><strong>Generated:</strong> ${Attendance.getLocalDateString()}</div>
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px;">
            <div style="background: var(--color-surface-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); text-align: center;">
              <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Headcount</div>
              <div style="font-size: 1.25rem; font-weight: bold;">${employees.length}</div>
            </div>
            <div style="background: var(--color-surface-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); text-align: center;">
              <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Work Days</div>
              <div style="font-size: 1.25rem; font-weight: bold;">${workingDaysInMonth}</div>
            </div>
            <div style="background: var(--color-surface-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); text-align: center;">
              <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Total Present</div>
              <div style="font-size: 1.25rem; font-weight: bold; color: var(--color-success);">${totalPresent}</div>
            </div>
            <div style="background: var(--color-surface-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); text-align: center;">
              <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Late Arrivals</div>
              <div style="font-size: 1.25rem; font-weight: bold; color: var(--color-warning);">${totalLate}</div>
            </div>
            <div style="background: var(--color-surface-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); text-align: center;">
              <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Half Days</div>
              <div style="font-size: 1.25rem; font-weight: bold; color: var(--color-warning);">${totalHalfDays}</div>
            </div>
            <div style="background: var(--color-surface-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); text-align: center;">
              <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Approved Leaves</div>
              <div style="font-size: 1.25rem; font-weight: bold; color: var(--color-purple);">${totalLeaveDays}</div>
            </div>
            <div style="background: var(--color-surface-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); text-align: center;">
              <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Absences</div>
              <div style="font-size: 1.25rem; font-weight: bold; color: var(--color-error);">${totalAbsences}</div>
            </div>
          </div>

          <h4 style="margin-bottom: 12px; font-size: 1rem;">Employee Breakdown</h4>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Half Day</th>
                  <th>On Leave</th>
                  <th>Absent</th>
                  <th>Hours Worked</th>
                </tr>
              </thead>
              <tbody>
                ${employeeRows.length === 0 ? `
                  <tr><td colspan="8" style="text-align: center; padding: 20px;">No employee records found.</td></tr>
                ` : employeeRows.map(r => `
                  <tr>
                    <td>
                      <strong>${UI.escapeHTML(r.name)}</strong>
                      <div style="font-size: 0.75rem; color: var(--color-text-muted); font-family: var(--font-mono);">${r.id}</div>
                    </td>
                    <td>${UI.escapeHTML(r.department)}</td>
                    <td><span class="badge badge-success">${r.present}</span></td>
                    <td><span class="badge ${r.late > 0 ? 'badge-warning' : 'badge-muted'}">${r.late}</span></td>
                    <td><span class="badge ${r.halfDays > 0 ? 'badge-warning' : 'badge-muted'}">${r.halfDays}</span></td>
                    <td><span class="badge ${r.leave > 0 ? 'badge-purple' : 'badge-muted'}">${r.leave}</span></td>
                    <td><span class="badge ${r.absent > 0 ? 'badge-error' : 'badge-muted'}">${r.absent}</span></td>
                    <td><strong>${r.hours}h</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--color-border); text-align: center;">
            <p style="font-size: 0.75rem; color: var(--color-text-muted); margin: 0;">
              &copy; ${new Date().getFullYear()} HCM Lite. Developed by <a href="https://github.com/hashirdilmuradzai/" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary-accent); text-decoration: none;">Hashir Dilmurad Zai</a>
            </p>
          </div>
        </div>
        <div class="modal-footer no-print">
          <button class="btn btn-outline" id="btn-close-report">Close</button>
          <button class="btn btn-primary" id="btn-print-report">${UI.ICONS.printer} Print / Save PDF</button>
        </div>
      </div>
    `;

    const closeBtn = reportModal.querySelector('#close-report-modal');
    const closeBtn2 = reportModal.querySelector('#btn-close-report');
    const printBtn = reportModal.querySelector('#btn-print-report');

    const closeModal = () => { reportModal.classList.remove('active'); };
    closeBtn.onclick = closeModal;
    closeBtn2.onclick = closeModal;

    printBtn.onclick = () => {
      window.print();
    };

    reportModal.classList.add('active');
  }

  return {
    exportAttendanceToCSV,
    showPrintableMonthlyReport
  };
})();
