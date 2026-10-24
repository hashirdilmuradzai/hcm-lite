/**
 * HCM Lite — Leave Management Business Logic
 * Strict adherence to rules:
 * - fromDate <= toDate
 * - Working days only (skips weekends and company holidays)
 * - No overlapping active leaves for employee
 * - Does not exceed yearly quota set by Admin
 * - Pending requests do not consume balance until approved
 * - Real-time balance revalidation at approval time
 */

const Leave = (() => {
  // Calculate count of working days between fromDate and toDate (inclusive)
  function calculateWorkingDays(fromDateStr, toDateStr, company, holidays = []) {
    const from = new Date(fromDateStr + 'T00:00:00');
    const to = new Date(toDateStr + 'T00:00:00');

    if (from > to) return 0;

    let workingDaysCount = 0;
    const current = new Date(from);

    while (current <= to) {
      if (Attendance.isConfiguredWorkingDay(current, company, holidays)) {
        workingDaysCount++;
      }
      current.setDate(current.getDate() + 1);
    }

    return workingDaysCount;
  }

  // Calculate working days broken down by calendar year
  function calculateWorkingDaysByYear(fromDateStr, toDateStr, company, holidays = []) {
    const from = new Date(fromDateStr + 'T00:00:00');
    const to = new Date(toDateStr + 'T00:00:00');
    const breakdown = {};

    if (from > to) return breakdown;

    const current = new Date(from);
    while (current <= to) {
      if (Attendance.isConfiguredWorkingDay(current, company, holidays)) {
        const yr = current.getFullYear();
        breakdown[yr] = (breakdown[yr] || 0) + 1;
      }
      current.setDate(current.getDate() + 1);
    }
    return breakdown;
  }

  // Get total approved leave days for an employee in a given calendar year
  function getApprovedLeaveDaysInYear(employeeId, year = new Date().getFullYear()) {
    const leaves = Storage.getLeavesForEmployee(employeeId);
    const company = Storage.getCompany() || { workingDays: [1,2,3,4,5], leaveQuota: 18 };
    const holidays = Storage.getHolidays();
    let total = 0;
    const targetYear = parseInt(year, 10);

    leaves.forEach(l => {
      if (l.status === 'Approved') {
        const fromYear = parseInt(l.fromDate.split('-')[0], 10);
        const toYear = parseInt(l.toDate.split('-')[0], 10);
        if (fromYear === targetYear && toYear === targetYear) {
          total += (l.days || 0);
        } else if (fromYear <= targetYear && targetYear <= toYear) {
          // Cross-year leave, count working days specifically in targetYear
          const yearStart = `${targetYear}-01-01`;
          const yearEnd = `${targetYear}-12-31`;
          const effFrom = l.fromDate > yearStart ? l.fromDate : yearStart;
          const effTo = l.toDate < yearEnd ? l.toDate : yearEnd;
          total += calculateWorkingDays(effFrom, effTo, company, holidays);
        }
      }
    });

    return total;
  }

  // Get leave balance summary for an employee
  function getLeaveBalance(employeeId, year = new Date().getFullYear()) {
    const company = Storage.getCompany() || { leaveQuota: 18 };
    const yearlyQuota = parseInt(company.leaveQuota, 10) || 18;
    const usedDays = getApprovedLeaveDaysInYear(employeeId, year);
    const remainingDays = Math.max(0, yearlyQuota - usedDays);

    return {
      yearlyQuota,
      usedDays,
      remainingDays,
      year
    };
  }

  // Check if dates overlap with any existing Pending or Approved leaves
  function checkLeaveOverlap(employeeId, fromDateStr, toDateStr, excludeLeaveId = null) {
    const leaves = Storage.getLeavesForEmployee(employeeId);

    return leaves.some(l => {
      if (excludeLeaveId && String(l.id) === String(excludeLeaveId)) return false;
      if (l.status === 'Rejected') return false; // Rejected leaves do not block new requests

      // Overlap condition: (StartA <= EndB) and (EndA >= StartB)
      return (fromDateStr <= l.toDate && toDateStr >= l.fromDate);
    });
  }

  // Submit a new leave request (by Employee)
  function applyLeave({ employeeId, type, fromDate, toDate, reason }) {
    if (!employeeId) throw new Error('Employee ID is required.');
    if (!type || !['Casual', 'Sick'].includes(type)) throw new Error('Leave type must be Casual or Sick.');
    if (!fromDate || !toDate) throw new Error('Both start date and end date are required.');
    if (fromDate > toDate) throw new Error('Start date cannot be after end date.');
    if (!reason || !reason.trim()) throw new Error('Reason for leave is required.');

    const company = Storage.getCompany() || { workingDays: [1,2,3,4,5], leaveQuota: 18 };
    const holidays = Storage.getHolidays();
    const workingDays = calculateWorkingDays(fromDate, toDate, company, holidays);

    if (workingDays === 0) {
      throw new Error('Selected date range contains 0 working days. No leave required.');
    }

    // Check overlap
    if (checkLeaveOverlap(employeeId, fromDate, toDate)) {
      throw new Error('You already have a pending or approved leave request during these dates.');
    }

    // Check balance for each year spanned
    const daysByYear = calculateWorkingDaysByYear(fromDate, toDate, company, holidays);
    for (const [yrStr, reqDays] of Object.entries(daysByYear)) {
      const yr = parseInt(yrStr, 10);
      const balance = getLeaveBalance(employeeId, yr);
      if (reqDays > balance.remainingDays) {
        throw new Error(`Insufficient leave balance for ${yr}. You requested ${reqDays} working days in ${yr}, but have only ${balance.remainingDays} days remaining.`);
      }
    }

    const leaveRequest = {
      id: `LV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId,
      type,
      fromDate,
      toDate,
      days: workingDays,
      reason: reason.trim(),
      requestDate: Attendance.getLocalDateString(),
      status: 'Pending',
      adminComment: '',
      processedAt: null
    };

    Storage.saveLeaveRequest(leaveRequest);

    const emp = Storage.getUserById(employeeId);
    const empName = emp ? emp.name : employeeId;
    Storage.logActivity('Applied for Leave', `${empName} requested ${workingDays} day(s) ${type} leave`, 'employee', empName);

    return leaveRequest;
  }

  // Admin approves leave request with balance re-validation
  function approveLeave(leaveId, adminComment = '') {
    const leaves = Storage.getLeaves();
    const leave = leaves.find(l => String(l.id) === String(leaveId));
    if (!leave) throw new Error('Leave request not found.');
    if (leave.status !== 'Pending') throw new Error(`Leave request is already ${leave.status}.`);

    // Revalidate available balance at approval time for each year spanned
    const company = Storage.getCompany() || { workingDays: [1,2,3,4,5], leaveQuota: 18 };
    const holidays = Storage.getHolidays();
    const daysByYear = calculateWorkingDaysByYear(leave.fromDate, leave.toDate, company, holidays);
    for (const [yrStr, reqDays] of Object.entries(daysByYear)) {
      const yr = parseInt(yrStr, 10);
      const balance = getLeaveBalance(leave.employeeId, yr);
      if (reqDays > balance.remainingDays) {
        throw new Error(`Cannot approve: Employee only has ${balance.remainingDays} leave days remaining for ${yr}, but requested ${reqDays} days in ${yr}.`);
      }
    }

    leave.status = 'Approved';
    leave.adminComment = adminComment.trim();
    leave.processedAt = new Date().toISOString();

    Storage.saveLeaveRequest(leave);

    const emp = Storage.getUserById(leave.employeeId);
    const empName = emp ? emp.name : leave.employeeId;
    Storage.logActivity('Approved Leave', `Approved ${leave.days} day(s) ${leave.type} leave for ${empName}`, 'admin');

    return leave;
  }

  // Admin rejects leave request
  function rejectLeave(leaveId, adminComment = '') {
    const leaves = Storage.getLeaves();
    const leave = leaves.find(l => String(l.id) === String(leaveId));
    if (!leave) throw new Error('Leave request not found.');
    if (leave.status !== 'Pending') throw new Error(`Leave request is already ${leave.status}.`);

    leave.status = 'Rejected';
    leave.adminComment = adminComment.trim();
    leave.processedAt = new Date().toISOString();

    Storage.saveLeaveRequest(leave);

    const emp = Storage.getUserById(leave.employeeId);
    const empName = emp ? emp.name : leave.employeeId;
    Storage.logActivity('Rejected Leave', `Rejected ${leave.type} leave for ${empName}`, 'admin');

    return leave;
  }

  return {
    calculateWorkingDays,
    calculateWorkingDaysByYear,
    getApprovedLeaveDaysInYear,
    getLeaveBalance,
    checkLeaveOverlap,
    applyLeave,
    approveLeave,
    rejectLeave
  };
})();
