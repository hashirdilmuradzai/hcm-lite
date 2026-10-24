/**
 * HCM Lite — Smart HR Helper (Conversational Assistant)
 * Strict adherence to:
 * - Real data query engine (no fake numbers, no hallucinations)
 * - Strict role-based scoping (Employee ONLY accesses their own data)
 * - Natural language keyword and intent matching
 * - Clickable suggested query chips
 * - Honest zero-data handling
 */

const SmartHelper = (() => {
  // Query responder for Admin
  function answerAdminQuery(rawQuery) {
    const q = rawQuery.toLowerCase().trim();
    const employees = Storage.getUsers().filter(u => u.role === 'employee' && u.status !== 'inactive');
    const todayStats = Attendance.getTodayStats();
    const todayStr = Attendance.getLocalDateString();
    const leaves = Storage.getLeaves();
    const attendance = Storage.getAttendance();

    // 1. Employee count
    if (q.includes('how many employee') || q.includes('total employee') || q.includes('count of employee') || q.includes('employee count') || q.includes('number of employee')) {
      if (employees.length === 0) {
        return `We currently have <strong>0 employees</strong> registered in the system. You can add new employees from the <a href="employees.html" style="text-decoration: underline;">Employees</a> page.`;
      }
      return `We currently have <strong>${employees.length} active employee${employees.length === 1 ? '' : 's'}</strong> on record.`;
    }

    // 2. Who is on leave today? / How many on leave
    if (q.includes('on leave today') || (q.includes('leave') && q.includes('today')) || q.includes('who is on leave')) {
      const activeLeaves = leaves.filter(l => l.status === 'Approved' && l.fromDate <= todayStr && todayStr <= l.toDate);
      if (activeLeaves.length === 0) {
        return `No employees are on approved leave today (${todayStr}).`;
      }
      const names = activeLeaves.map(l => {
        const emp = Storage.getUserById(l.employeeId);
        return `${emp ? emp.name : l.employeeId} (${l.type} Leave)`;
      });
      return `There ${activeLeaves.length === 1 ? 'is' : 'are'} <strong>${activeLeaves.length} employee${activeLeaves.length === 1 ? '' : 's'} on leave today</strong>:<br>• ${names.join('<br>• ')}`;
    }

    // 3. Who was late today? / How many late
    if (q.includes('who was late') || q.includes('late today') || q.includes('how many late')) {
      const todayLate = Storage.getAttendanceForDate(todayStr).filter(a => a.isLate);
      if (todayLate.length === 0) {
        return `No employees were marked late today (${todayStr}). All checked-in employees arrived within the grace period.`;
      }
      const names = todayLate.map(a => {
        const emp = Storage.getUserById(a.employeeId);
        return `${emp ? emp.name : a.employeeId} (Checked in at ${a.checkIn})`;
      });
      return `<strong>${todayLate.length} employee${todayLate.length === 1 ? '' : 's'} arrived late today</strong>:<br>• ${names.join('<br>• ')}`;
    }

    // 4. How many present today?
    if (q.includes('present') && (q.includes('today') || q.includes('how many'))) {
      if (todayStats.presentToday === 0) {
        return `No employees have checked in yet today (${todayStr}).`;
      }
      return `<strong>${todayStats.presentToday} of ${todayStats.totalEmployees} employee${todayStats.totalEmployees === 1 ? '' : 's'}</strong> are present today.`;
    }

    // 5. How many absent today?
    if (q.includes('absent') && (q.includes('today') || q.includes('how many'))) {
      if (!todayStats.isTodayWorking) {
        return `Today is configured as a non-working day or holiday, so absences are not counted today.`;
      }
      if (todayStats.totalEmployees === 0) {
        return `There are currently 0 employees in the organization.`;
      }
      return `<strong>${todayStats.absentToday} employee${todayStats.absentToday === 1 ? '' : 's'}</strong> are absent today (excluding approved leaves).`;
    }

    // 6. Pending leave requests
    if (q.includes('pending leave') || q.includes('pending request') || (q.includes('leave') && q.includes('pending'))) {
      const pending = leaves.filter(l => l.status === 'Pending');
      if (pending.length === 0) {
        return `There are currently <strong>0 pending leave requests</strong>. All requests have been reviewed!`;
      }
      return `There ${pending.length === 1 ? 'is' : 'are'} <strong>${pending.length} pending leave request${pending.length === 1 ? '' : 's'}</strong> awaiting review. You can approve or reject them on the <a href="leaves.html" style="text-decoration: underline;">Leave Requests</a> page.`;
    }

    // 7. Attendance summary
    if (q.includes('attendance summary') || q.includes('show attendance') || q.includes('today summary') || q.includes('overview')) {
      return `<strong>Today's Attendance Overview (${todayStr})</strong>:<br>
      • Total Employees: <strong>${todayStats.totalEmployees}</strong><br>
      • Present: <strong>${todayStats.presentToday}</strong><br>
      • Late Arrivals: <strong>${todayStats.lateToday}</strong><br>
      • On Approved Leave: <strong>${todayStats.onLeaveToday}</strong><br>
      • Absent: <strong>${todayStats.absentToday}</strong>`;
    }

    // 8. Department queries (e.g. "how many in IT", "engineering", etc.)
    const deptMatch = q.match(/(?:how many employees (?:work in|in)|department) ([a-zA-Z\s]+)/i);
    if (deptMatch || q.includes('department')) {
      const queryDept = deptMatch ? deptMatch[1].trim() : '';
      if (queryDept) {
        const matches = employees.filter(e => (e.department || '').toLowerCase().includes(queryDept.toLowerCase()));
        return `There ${matches.length === 1 ? 'is' : 'are'} <strong>${matches.length} employee${matches.length === 1 ? '' : 's'}</strong> in the <strong>${queryDept.toUpperCase()}</strong> department.`;
      }
      // Group by all departments
      const depts = {};
      employees.forEach(e => {
        const d = e.department || 'Unassigned';
        depts[d] = (depts[d] || 0) + 1;
      });
      const list = Object.entries(depts).map(([d, c]) => `${d}: ${c}`);
      return `<strong>Employees by Department</strong>:<br>• ${list.length ? list.join('<br>• ') : 'No departments assigned yet.'}`;
    }

    // 9. Total payroll / salary
    if (q.includes('payroll') || q.includes('total salary') || q.includes('salary expense')) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const payroll = Payroll.calculateTotalMonthlyPayroll(currentYear, currentMonth);

      return `<strong>Payroll Summary for ${now.toLocaleString('default', { month: 'long' })} ${currentYear}</strong>:<br>
      • Active Employees: <strong>${payroll.employeeCount}</strong><br>
      • Gross Monthly Base: <strong>${Payroll.formatCurrency(payroll.totalGross)}</strong><br>
      • Total Deductions: <strong>${Payroll.formatCurrency(payroll.totalDeductions)}</strong><br>
      • Estimated Net Payable: <strong>${Payroll.formatCurrency(payroll.totalNet)}</strong>`;
    }

    // 10. Sick leave query
    if (q.includes('sick leave') || q.includes('sick')) {
      const sickLeaves = leaves.filter(l => l.type === 'Sick' && l.status === 'Approved');
      const totalDays = sickLeaves.reduce((acc, l) => acc + (l.days || 0), 0);
      return `A total of <strong>${sickLeaves.length} approved sick leave request${sickLeaves.length === 1 ? '' : 's'}</strong> totaling <strong>${totalDays} day(s)</strong> have been granted to date.`;
    }

    // Fallback guidance for Admin
    return `I couldn't quite find an answer for that. As an Admin, you can ask me questions like:<br>
    • <em>"How many employees do we have?"</em><br>
    • <em>"Who is on leave today?"</em><br>
    • <em>"Who was late today?"</em><br>
    • <em>"How many employees are present?"</em><br>
    • <em>"How many leave requests are pending?"</em><br>
    • <em>"Show attendance summary"</em><br>
    • <em>"What is the total monthly payroll?"</em>`;
  }

  // Query responder for Employee
  function answerEmployeeQuery(rawQuery, currentUserId) {
    const q = rawQuery.toLowerCase().trim();
    const user = Storage.getUserById(currentUserId);
    if (!user) return `Session user could not be found. Please log in again.`;

    const todayStr = Attendance.getLocalDateString();
    const todayAtt = Storage.getTodayAttendanceForEmployee(currentUserId);
    const balance = Leave.getLeaveBalance(currentUserId);
    const leaves = Storage.getLeavesForEmployee(currentUserId);

    // 1. Was I late today?
    if (q.includes('was i late') || q.includes('am i late') || (q.includes('late') && q.includes('today'))) {
      if (!todayAtt) {
        return `You have not checked in yet today (${todayStr}).`;
      }
      if (todayAtt.isLate) {
        return `Yes, you were marked <strong>Late</strong> today. You checked in at <strong>${todayAtt.checkIn}</strong>, which was after the configured office start time plus grace period.`;
      } else {
        return `No, you arrived on time today! You checked in at <strong>${todayAtt.checkIn}</strong>.`;
      }
    }

    // 2. How many hours did I work today?
    if (q.includes('hours') && q.includes('today')) {
      if (!todayAtt) {
        return `You have not recorded attendance today.`;
      }
      if (!todayAtt.checkOutTimestamp) {
        const now = new Date();
        const diffHrs = Math.round(((now.getTime() - todayAtt.checkInTimestamp) / 3600000) * 10) / 10;
        return `You checked in at <strong>${todayAtt.checkIn}</strong> and are currently working (~<strong>${diffHrs} hours</strong> elapsed so far). Check out when you finish to finalize your worked hours.`;
      }
      return `You completed <strong>${todayAtt.workHours} hours</strong> of work today (Checked in at ${todayAtt.checkIn}, checked out at ${todayAtt.checkOut}).`;
    }

    // 3. How many hours did I work this week?
    if (q.includes('hours') && (q.includes('week') || q.includes('this week'))) {
      const now = new Date();
      // Find start of week (e.g. Monday)
      const day = now.getDay();
      const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now.setDate(diffToMon));
      const monStr = Attendance.getLocalDateString(mon);

      const allAtt = Storage.getAttendanceForEmployee(currentUserId);
      const thisWeekAtt = allAtt.filter(a => a.date >= monStr && a.date <= todayStr);
      const totalHours = thisWeekAtt.reduce((sum, a) => sum + (a.workHours || 0), 0);

      return `You have logged <strong>${Math.round(totalHours * 100) / 100} hours</strong> across ${thisWeekAtt.length} workday(s) this week.`;
    }

    // 4. How many leaves do I have left?
    if (q.includes('leave') && (q.includes('left') || q.includes('balance') || q.includes('remaining') || q.includes('quota'))) {
      return `You have <strong>${balance.remainingDays} leave day${balance.remainingDays === 1 ? '' : 's'} remaining</strong> for ${balance.year} (used ${balance.usedDays} of your ${balance.yearlyQuota}-day annual quota).`;
    }

    // 5. Is my leave approved? / Leave status
    if (q.includes('is my leave approved') || q.includes('leave status') || (q.includes('leave') && q.includes('approved'))) {
      if (leaves.length === 0) {
        return `You haven't submitted any leave requests yet. You can apply on your dashboard!`;
      }
      const latest = leaves[leaves.length - 1];
      let statusComment = latest.adminComment ? ` (Admin comment: "${latest.adminComment}")` : '';
      return `Your latest request for <strong>${latest.days} day(s) ${latest.type} Leave</strong> (${latest.fromDate} to ${latest.toDate}) is currently <strong>${latest.status}</strong>${statusComment}.`;
    }

    // 6. Attendance this month
    if (q.includes('attendance') && (q.includes('month') || q.includes('this month'))) {
      const now = new Date();
      const stats = Attendance.getEmployeeMonthlyAttendance(currentUserId, now.getFullYear(), now.getMonth() + 1);
      return `<strong>Your Attendance for ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}</strong>:<br>
      • Present Days: <strong>${stats.presentDays}</strong><br>
      • Late Arrivals: <strong>${stats.lateDays}</strong><br>
      • Half Days: <strong>${stats.halfDays}</strong><br>
      • Absences: <strong>${stats.absentDays}</strong><br>
      • Approved Leave: <strong>${stats.approvedLeaveDays} days</strong><br>
      • Total Hours Worked: <strong>${stats.totalWorkedHours} hrs</strong>`;
    }

    // 7. Salary this month / payslip
    if (q.includes('salary') || q.includes('payslip') || q.includes('pay')) {
      const now = new Date();
      try {
        const slip = Payroll.calculateMonthlyPayslip(currentUserId, now.getFullYear(), now.getMonth() + 1);
        return `<strong>Estimated Salary for ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}</strong>:<br>
        • Base Monthly Salary: <strong>${Payroll.formatCurrency(slip.monthlySalary)}</strong><br>
        • Absence Deductions: <strong>${Payroll.formatCurrency(slip.absentDeduction)}</strong> (${slip.absentDays} day(s))<br>
        • Half-Day Deductions: <strong>${Payroll.formatCurrency(slip.halfDayDeduction)}</strong> (${slip.halfDays} half-day(s))<br>
        • Net Estimated Pay: <strong>${Payroll.formatCurrency(slip.netSalary)}</strong><br>
        <span style="font-size: 0.8rem; color: var(--color-text-muted);">You can view and print your complete salary slip on the <a href="payslip.html" style="text-decoration: underline;">Payslip</a> page.</span>`;
      } catch (err) {
        return `Could not compute salary estimate: ${err.message}`;
      }
    }

    // Fallback guidance for Employee
    return `I can help you with questions about your personal records! Try asking:<br>
    • <em>"Was I late today?"</em><br>
    • <em>"How many hours did I work today?"</em><br>
    • <em>"How many hours did I work this week?"</em><br>
    • <em>"How many leaves do I have left?"</em><br>
    • <em>"Is my leave approved?"</em><br>
    • <em>"What is my attendance this month?"</em><br>
    • <em>"What is my salary this month?"</em>`;
  }

  // Render and initialize helper widget into a target container
  function initWidget(containerId, currentUser) {
    const container = document.getElementById(containerId);
    if (!container || !currentUser) return;

    const isAdmin = currentUser.role === 'admin';
    const chips = isAdmin ? [
      'How many employees do we have?',
      'Who is on leave today?',
      'Who was late today?',
      'Show attendance summary',
      'Pending leave requests?',
      'What is the total monthly payroll?'
    ] : [
      'Was I late today?',
      'How many hours did I work today?',
      'How many leaves do I have left?',
      'Is my leave approved?',
      'What is my attendance this month?',
      'What is my salary this month?'
    ];

    container.innerHTML = `
      <div class="helper-widget">
        <div class="helper-header">
          <div class="helper-title">
            ${UI.ICONS.bot}
            <span>Smart HR Helper</span>
          </div>
          <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--color-text-muted);"><span class="company-pulse-dot" style="width: 6px; height: 6px;"></span>Online</span>
        </div>
        <div class="helper-messages" id="helper-msg-list">
          <div class="message-bubble message-bot">
            Hello ${UI.escapeHTML(currentUser.name.split(' ')[0])}! I am your HCM Lite Smart Assistant. Ask me anything about your ${isAdmin ? 'company operations and attendance' : 'personal attendance, leaves, and salary'}.
          </div>
        </div>
        <div class="helper-chips-container" id="helper-chips-row">
          ${chips.map(c => `<button class="helper-chip" type="button">${c}</button>`).join('')}
        </div>
        <form class="helper-input-row" id="helper-chat-form">
          <input type="text" id="helper-user-input" class="form-input" placeholder="Type a question..." autocomplete="off">
          <button type="submit" class="btn btn-primary btn-sm">Ask</button>
        </form>
      </div>
    `;

    const msgList = container.querySelector('#helper-msg-list');
    const form = container.querySelector('#helper-chat-form');
    const input = container.querySelector('#helper-user-input');
    const chipsRow = container.querySelector('#helper-chips-row');

    function appendMessage(text, isUser = false) {
      const bubble = document.createElement('div');
      bubble.className = `message-bubble ${isUser ? 'message-user' : 'message-bot'}`;
      if (isUser) {
        bubble.textContent = text;
      } else {
        bubble.innerHTML = text;
      }
      msgList.appendChild(bubble);
      msgList.scrollTop = msgList.scrollHeight;
    }

    function handleQuestion(q) {
      if (!q || !q.trim()) return;
      appendMessage(q, true);

      // Rule-based engine execution
      setTimeout(() => {
        let answer = '';
        if (isAdmin) {
          answer = answerAdminQuery(q);
        } else {
          answer = answerEmployeeQuery(q, currentUser.id);
        }
        appendMessage(answer, false);
      }, 150);
    }

    form.onsubmit = (e) => {
      e.preventDefault();
      const val = input.value;
      input.value = '';
      handleQuestion(val);
    };

    chipsRow.querySelectorAll('.helper-chip').forEach(btn => {
      btn.onclick = () => {
        handleQuestion(btn.textContent);
      };
    });
  }

  return {
    answerAdminQuery,
    answerEmployeeQuery,
    initWidget
  };
})();
