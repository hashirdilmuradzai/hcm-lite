/**
 * HCM Lite — Attendance Business Logic
 * Strict adherence to rules:
 * - Start time + grace period (e.g. 09:00 + 15m = 09:15). 09:15 -> on time, 09:16 -> late
 * - One check-in per day per employee
 * - Check-out only allowed after check-in
 * - Work hours = (checkOutTimestamp - checkInTimestamp) / 3600000
 * - Under 5 hours = Half Day
 * - Absence dynamically calculated for working days excluding approved leaves
 * - Separate isLate flag preserved
 */

const Attendance = (() => {
  // Format local date string YYYY-MM-DD
  function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Format local time string HH:MM:SS
  function getLocalTimeString(d = new Date()) {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  // Check if a given Date object falls on a configured working day (and not a holiday)
  function isConfiguredWorkingDay(dateObj, company, holidays = []) {
    const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    const configuredDays = company && company.workingDays ? company.workingDays : [1, 2, 3, 4, 5];
    if (!configuredDays.includes(dayOfWeek)) {
      return false;
    }
    const dateStr = getLocalDateString(dateObj);
    const isHoliday = holidays.some(h => h.date === dateStr);
    return !isHoliday;
  }

  // Check if a time is late based on company start time and grace minutes
  function evaluateIsLate(checkInDateObj, company) {
    const startTimeStr = (company && company.startTime) || '09:00';
    const graceMinutes = (company && company.graceMinutes !== undefined) ? parseInt(company.graceMinutes, 10) : 15;

    const [startH, startM] = startTimeStr.split(':').map(Number);
    // Boundary time in minutes from midnight
    const boundaryMinutes = (startH * 60) + startM + graceMinutes;

    const checkInMinutes = (checkInDateObj.getHours() * 60) + checkInDateObj.getMinutes();
    const checkInSeconds = checkInDateObj.getSeconds();

    // If check-in minutes strictly exceeds boundary, or boundary reached with extra seconds
    // Example: boundary 09:15 -> 09:15:00 is on time; 09:15:01 is late
    if (checkInMinutes > boundaryMinutes) {
      return true;
    }
    if (checkInMinutes === boundaryMinutes && checkInSeconds > 0) {
      return true;
    }
    return false;
  }

  // Employee Check-In
  function checkIn(employeeId, verificationMeta = {}) {
    const todayStr = getLocalDateString();
    const existing = Storage.getTodayAttendanceForEmployee(employeeId);

    if (existing) {
      throw new Error('You have already checked in today.');
    }

    const company = Storage.getCompany() || { startTime: '09:00', graceMinutes: 15 };
    const now = new Date();
    const isLate = evaluateIsLate(now, company);

    const record = {
      id: `ATT-${Date.now()}-${employeeId}`,
      employeeId,
      date: todayStr,
      checkIn: getLocalTimeString(now),
      checkInTimestamp: now.getTime(),
      checkOut: null,
      checkOutTimestamp: null,
      workHours: null,
      isLate,
      status: isLate ? 'Late' : 'Present',
      verificationMethod: verificationMeta.method || 'standard',
      location: verificationMeta.location || null,
      faceVerified: !!verificationMeta.faceVerified
    };

    Storage.saveAttendanceRecord(record);

    const emp = Storage.getUserById(employeeId);
    const empName = emp ? emp.name : employeeId;
    Storage.logActivity('Check In', `${empName} checked in at ${record.checkIn} (${record.status})`, 'employee', empName);

    return record;
  }

  // Employee Check-Out
  function checkOut(employeeId) {
    const todayStr = getLocalDateString();
    const record = Storage.getTodayAttendanceForEmployee(employeeId);

    if (!record || !record.checkInTimestamp) {
      throw new Error('Cannot check out before checking in.');
    }

    if (record.checkOutTimestamp) {
      throw new Error('You have already checked out today.');
    }

    const now = new Date();
    const checkOutTimestamp = now.getTime();
    const diffHours = (checkOutTimestamp - record.checkInTimestamp) / (1000 * 60 * 60);
    const roundedHours = Math.round(diffHours * 100) / 100;

    record.checkOut = getLocalTimeString(now);
    record.checkOutTimestamp = checkOutTimestamp;
    record.workHours = roundedHours;

    // Rule: Under 5 hours = Half Day
    if (roundedHours < 5.0) {
      record.status = 'Half Day';
    } else {
      record.status = record.isLate ? 'Late' : 'Present';
    }

    Storage.saveAttendanceRecord(record);

    const emp = Storage.getUserById(employeeId);
    const empName = emp ? emp.name : employeeId;
    Storage.logActivity('Check Out', `${empName} checked out at ${record.checkOut} (${roundedHours} hrs worked)`, 'employee', empName);

    return record;
  }

  // Calculate dynamic today statistics for Admin Dashboard
  function getTodayStats() {
    const todayStr = getLocalDateString();
    const allEmployees = Storage.getUsers().filter(u => u.role === 'employee' && u.status !== 'inactive');
    const totalEmployees = allEmployees.length;

    const todayAttendance = Storage.getAttendanceForDate(todayStr);
    const leaves = Storage.getLeaves();
    const company = Storage.getCompany() || { workingDays: [1,2,3,4,5] };
    const holidays = Storage.getHolidays();

    const isTodayWorking = isConfiguredWorkingDay(new Date(), company, holidays);

    let presentToday = 0;
    let lateToday = 0;
    let onLeaveToday = 0;

    // Count present & late from attendance
    todayAttendance.forEach(a => {
      presentToday++;
      if (a.isLate) lateToday++;
    });

    // Check approved leaves covering today
    const employeeOnLeaveIds = new Set();
    leaves.forEach(l => {
      if (l.status === 'Approved' && l.fromDate <= todayStr && todayStr <= l.toDate) {
        employeeOnLeaveIds.add(String(l.employeeId));
      }
    });
    onLeaveToday = employeeOnLeaveIds.size;

    // Calculate absent employees:
    // Only on working days! Those who have neither checked in nor have approved leave today.
    let absentToday = 0;
    if (isTodayWorking && totalEmployees > 0) {
      const attendedIds = new Set(todayAttendance.map(a => String(a.employeeId)));
      allEmployees.forEach(emp => {
        const idStr = String(emp.id);
        if (!attendedIds.has(idStr) && !employeeOnLeaveIds.has(idStr)) {
          // Employee must have joined on or before today to be considered absent
          const joinDate = emp.joiningDate || todayStr;
          if (joinDate <= todayStr) {
            absentToday++;
          }
        }
      });
    }

    const pendingLeaves = leaves.filter(l => l.status === 'Pending').length;

    return {
      totalEmployees,
      presentToday,
      lateToday,
      onLeaveToday,
      absentToday,
      pendingLeaves,
      isTodayWorking
    };
  }

  // Calculate detailed monthly attendance breakdown for an employee
  function getEmployeeMonthlyAttendance(employeeId, year, month) {
    // year: e.g. 2026, month: 1-12
    const company = Storage.getCompany() || { workingDays: [1,2,3,4,5] };
    const holidays = Storage.getHolidays();
    const employee = Storage.getUserById(employeeId);
    if (!employee) return null;

    const empJoinDate = employee.joiningDate || '2000-01-01';

    // Days in the given month
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
    const maxEvaluationDay = isCurrentMonth ? today.getDate() : totalDaysInMonth;

    const allAttendances = Storage.getAttendanceForEmployee(employeeId);
    const allLeaves = Storage.getLeavesForEmployee(employeeId).filter(l => l.status === 'Approved');

    let workingDaysInMonth = 0;
    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let approvedLeaveDays = 0;
    let totalWorkedHours = 0;

    const dailyBreakdown = [];

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isWorkDay = isConfiguredWorkingDay(dateObj, company, holidays);

      if (isWorkDay) {
        workingDaysInMonth++;
      }

      // Check if employee had already joined by this date
      const hasJoined = dateStr >= empJoinDate;
      const isPastOrToday = day <= maxEvaluationDay;

      // Find attendance record for this day
      const att = allAttendances.find(a => a.date === dateStr);

      // Check if covered by approved leave
      const leaveCover = allLeaves.find(l => l.fromDate <= dateStr && dateStr <= l.toDate);

      let dayStatus = isWorkDay ? 'Upcoming' : 'Non-Working Day';
      if (!hasJoined) {
        dayStatus = 'Not Employed';
      } else if (att) {
        if (att.status === 'Half Day') {
          dayStatus = 'Half Day';
          halfDays++;
        } else {
          dayStatus = att.isLate ? 'Late' : 'Present';
          presentDays++;
        }
        if (att.isLate) lateDays++;
        if (att.workHours) totalWorkedHours += att.workHours;
      } else if (leaveCover) {
        dayStatus = `On Leave (${leaveCover.type})`;
        approvedLeaveDays++;
      } else if (isWorkDay && isPastOrToday) {
        dayStatus = 'Absent';
        absentDays++;
      }

      dailyBreakdown.push({
        date: dateStr,
        dayOfWeek: dateObj.toLocaleDateString(undefined, { weekday: 'short' }),
        isWorkDay,
        status: dayStatus,
        attendance: att || null,
        leave: leaveCover || null
      });
    }

    return {
      year,
      month,
      totalDaysInMonth,
      workingDaysInMonth,
      presentDays,
      lateDays,
      halfDays,
      absentDays,
      approvedLeaveDays,
      totalWorkedHours: Math.round(totalWorkedHours * 100) / 100,
      dailyBreakdown
    };
  }

  return {
    getLocalDateString,
    getLocalTimeString,
    isConfiguredWorkingDay,
    evaluateIsLate,
    checkIn,
    checkOut,
    getTodayStats,
    getEmployeeMonthlyAttendance
  };
})();
