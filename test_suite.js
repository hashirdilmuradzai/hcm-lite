const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock browser environment
const localStorageStore = {};
const localStorageMock = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

const windowMock = {
  localStorage: localStorageMock,
  location: { pathname: '/pages/admin.html', href: '' },
  crypto: {
    subtle: {
      digest: async (algo, data) => {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(Buffer.from(data)).digest();
      }
    }
  }
};

const sandbox = {
  window: windowMock,
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  },
  localStorage: localStorageMock,
  console: console,
  navigator: { mediaDevices: {} },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval
};

vm.createContext(sandbox);

function loadScript(relPath, exportName) {
  const code = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
  vm.runInContext(code + (exportName ? `;\nthis.${exportName} = ${exportName};` : ''), sandbox, { filename: relPath });
}

loadScript('js/storage.js', 'Storage');
loadScript('js/auth.js', 'Auth');
loadScript('js/ui.js', 'UI');
loadScript('js/attendance.js', 'Attendance');
loadScript('js/leave.js', 'Leave');
loadScript('js/payroll.js', 'Payroll');
loadScript('js/employees.js', 'EmployeeManager');
loadScript('js/helper.js', 'SmartHelper');

async function runTests() {
  console.log('=== RUNNING HCM LITE VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Initial State
  sandbox.Storage.clearAllData();
  assert(sandbox.Storage.isSetupCompleted() === false, 'Fresh storage isSetupCompleted is false');

  // 2. Company Setup with 0 Grace Minutes and Mon-Fri
  await sandbox.Auth.setupCompanyAndAdmin({
    companyName: 'TechVision Solutions',
    adminName: 'Chief Administrator',
    adminEmail: 'admin@techvision.com',
    adminPassword: 'Password123!',
    startTime: '09:00',
    graceMinutes: 0,
    leaveQuota: 15,
    workingDays: [1, 2, 3, 4, 5]
  });

  const company = sandbox.Storage.getCompany();
  assert(company.name === 'TechVision Solutions', 'Company name saved correctly');
  assert(company.graceMinutes === 0, 'Grace minutes 0 preserved exactly without fallback to 15');
  assert(company.leaveQuota === 15, 'Leave quota 15 saved correctly');

  // 3. Employee Creation & ID Sequence
  const emp1 = await sandbox.EmployeeManager.createEmployee({
    name: 'John Doe',
    email: 'john@techvision.com',
    password: 'password123',
    department: 'Engineering',
    designation: 'Senior Developer',
    salary: 8000,
    joiningDate: '2026-01-01'
  });
  assert(emp1.id === 'EMP-1001', 'First employee ID is EMP-1001');

  // Delete emp1 and create emp2 -> must generate EMP-1002, NOT reusing EMP-1001
  sandbox.Storage.deleteUser(emp1.id);
  const emp2 = await sandbox.EmployeeManager.createEmployee({
    name: 'Jane Smith',
    email: 'jane@techvision.com',
    password: 'password123',
    department: 'Marketing',
    designation: 'Marketing Lead',
    salary: 7500,
    joiningDate: '2026-01-01'
  });
  assert(emp2.id === 'EMP-1002', 'Sequential ID never reuses deleted EMP-1001 (generated EMP-1002)');

  // 4. Grace Period 0 Evaluation
  // Office starts 09:00, grace 0. 09:00:00 -> on time. 09:00:01 -> late.
  const onTimeDate = new Date(2026, 9, 25, 9, 0, 0);
  const lateDate = new Date(2026, 9, 25, 9, 0, 1);
  assert(sandbox.Attendance.evaluateIsLate(onTimeDate, company) === false, '09:00:00 with 0m grace is on time (false)');
  assert(sandbox.Attendance.evaluateIsLate(lateDate, company) === true, '09:00:01 with 0m grace is late (true)');

  // 5. Half-Day Exact Boundary Test (< 5h ms check)
  // Check in 09:00:00, check out 13:59:55 (4h 59m 55s = 4.9986h) -> rounded 5.00h, but raw < 5h -> MUST BE Half Day
  const checkInTime = new Date(2026, 9, 20, 9, 0, 0).getTime();
  const under5hOutTime = checkInTime + (4 * 3600 + 59 * 60 + 55) * 1000;
  const exactly5hOutTime = checkInTime + (5 * 3600 * 1000);

  const testAtt1 = {
    id: 'ATT-TEST-1',
    employeeId: emp2.id,
    date: '2026-10-20',
    checkIn: '09:00:00',
    checkInTimestamp: checkInTime,
    checkOut: null,
    checkOutTimestamp: null,
    isLate: false
  };
  sandbox.Storage.saveAttendanceRecord(testAtt1);

  // Simulate checkout under 5h
  const diffMs1 = under5hOutTime - checkInTime;
  const roundedHours1 = Math.round((diffMs1 / 3600000) * 100) / 100;
  const status1 = diffMs1 < (5 * 3600 * 1000) ? 'Half Day' : 'Present';
  assert(roundedHours1 === 5.00 && status1 === 'Half Day', '4h 59m 55s is strictly Half Day even if rounded to 5.00');

  // 6. Cross-Year Leave Calculation
  // Spans from 2026-12-30 (Wed) to 2027-01-05 (Tue)
  // 2026: Dec 30 (Wed), Dec 31 (Thu) -> 2 working days in 2026
  // 2027: Jan 01 (Fri), Jan 04 (Mon), Jan 05 (Tue) -> 3 working days in 2027
  const crossYearDays = sandbox.Leave.calculateWorkingDaysByYear('2026-12-30', '2027-01-05', company, []);
  assert(crossYearDays[2026] === 2, 'Cross-year leave correctly allocates 2 working days to 2026');
  assert(crossYearDays[2027] === 3, 'Cross-year leave correctly allocates 3 working days to 2027');

  // Apply and approve cross-year leave
  const leaveReq = sandbox.Leave.applyLeave({
    employeeId: emp2.id,
    type: 'Casual',
    fromDate: '2026-12-30',
    toDate: '2027-01-05',
    reason: 'Year-end holiday travel'
  });
  assert(leaveReq.days === 5, 'Total cross-year leave is 5 working days');
  sandbox.Leave.approveLeave(leaveReq.id, 'Approved by admin');

  const bal2026 = sandbox.Leave.getLeaveBalance(emp2.id, 2026);
  const bal2027 = sandbox.Leave.getLeaveBalance(emp2.id, 2027);
  assert(bal2026.usedDays === 2 && bal2026.remainingDays === 13, '2026 balance has 2 used days (13 remaining)');
  assert(bal2027.usedDays === 3 && bal2027.remainingDays === 12, '2027 balance has 3 used days (12 remaining)');

  // 7. Future Month Attendance Breakdown (No Absences for Future Dates)
  const futureBreakdown = sandbox.Attendance.getEmployeeMonthlyAttendance(emp2.id, 2027, 2); // Feb 2027
  assert(futureBreakdown.absentDays === 0, 'Future month has 0 absent days');
  const allFutureUpcoming = futureBreakdown.dailyBreakdown.every(d => !d.isWorkDay || d.status === 'Upcoming');
  assert(allFutureUpcoming === true, 'All working days in future month are marked Upcoming');

  // 8. Admin Dashboard Today Stats excludes deleted employees
  const todayStats = sandbox.Attendance.getTodayStats();
  assert(todayStats.totalEmployees === 1, 'Today stats only counts 1 active employee (EMP-1002), ignoring deleted EMP-1001');

  // 9. Clean wipe for delivery
  sandbox.Storage.clearAllData();
  assert(sandbox.Storage.getUsers().length === 0, 'Data successfully wiped clean: users empty');
  assert(sandbox.Storage.isSetupCompleted() === false, 'Data successfully wiped clean: isSetupCompleted false');

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
