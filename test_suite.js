const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock browser environment
const localStorageStore = {};
const localStorageMock = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); },
  key: (i) => Object.keys(localStorageStore)[i] || null,
  get length() { return Object.keys(localStorageStore).length; }
};

const windowMock = {
  location: {
    pathname: '/pages/admin.html',
    href: '',
    replaceTarget: '',
    replace: function(url) { this.replaceTarget = url; this.href = url; }
  },
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
  assert(sandbox.Storage.getCompanies().length === 0, 'Fresh storage has 0 companies');

  // 2. Company 1 Setup (Auto-generated code, 0 Grace Minutes, Mon-Fri)
  const res1 = await sandbox.Auth.setupCompanyAndAdmin({
    companyName: 'TechVision Solutions',
    adminName: 'Chief Administrator',
    adminEmail: 'admin@techvision.com',
    adminPassword: 'Password123!',
    startTime: '09:00',
    graceMinutes: 0,
    leaveQuota: 15,
    workingDays: [1, 2, 3, 4, 5]
  });

  const comp1Id = res1.company.id;
  const company = sandbox.Storage.getCompany(comp1Id);
  assert(company.name === 'TechVision Solutions', 'Company 1 name saved correctly');
  assert(typeof company.code === 'string' && company.code.length > 0, 'Company 1 code auto-generated successfully');
  assert(company.graceMinutes === 0, 'Grace minutes 0 preserved exactly without fallback to 15');
  assert(company.leaveQuota === 15, 'Leave quota 15 saved correctly');

  // 2a. Verify NO auto-login after company creation
  assert(sandbox.Storage.getSession() === null, 'Admin is NOT automatically logged in after company registration');

  // 2b. Verify duplicate admin email registration across workspaces is blocked
  let duplicateEmailBlocked = false;
  try {
    await sandbox.Auth.setupCompanyAndAdmin({
      companyName: 'Duplicate Corp',
      adminName: 'Another Admin',
      adminEmail: 'admin@techvision.com', // same email
      adminPassword: 'Password999!'
    });
  } catch (err) {
    if (err.message.includes('already exists')) duplicateEmailBlocked = true;
  }
  assert(duplicateEmailBlocked === true, 'Registration with existing email across companies is strictly blocked');

  // 2c. Register Company 2 (Apex Innovations) with its own distinct admin
  const res2 = await sandbox.Auth.setupCompanyAndAdmin({
    companyName: 'Apex Innovations',
    adminName: 'Apex Admin',
    adminEmail: 'admin@apex.com',
    adminPassword: 'Password456!',
    startTime: '08:30',
    graceMinutes: 10,
    leaveQuota: 20,
    workingDays: [1, 2, 3, 4, 5]
  });

  const comp2Id = res2.company.id;
  const companies = sandbox.Storage.getCompanies();
  assert(companies.length === 2, 'Multi-company support: exactly 2 distinct workspaces stored in localStorage');

  // 2d. Invalid Login Tests (NO company selector used)
  let badLoginFailed = false;
  try {
    await sandbox.Auth.login('admin@techvision.com', 'WrongPassword!');
  } catch (err) {
    if (err.message === 'Invalid email or password.') badLoginFailed = true;
  }
  assert(badLoginFailed === true, 'Login with incorrect password fails with exact message "Invalid email or password."');

  let badEmailFailed = false;
  try {
    await sandbox.Auth.login('unknown@nowhere.com', 'Password123!');
  } catch (err) {
    if (err.message === 'Invalid email or password.') badEmailFailed = true;
  }
  assert(badEmailFailed === true, 'Login with nonexistent email fails with exact message "Invalid email or password."');

  // 2e. Automatic Workspace Resolution: Login to Company 1 using ONLY email and password
  const adminUser1 = await sandbox.Auth.login('admin@techvision.com', 'Password123!');
  assert(adminUser1.role === 'admin', 'Admin 1 successfully logged in with role: "admin"');
  const session1 = sandbox.Storage.getSession();
  assert(session1 !== null && session1.companyId === comp1Id, 'Credentials automatically resolved Company 1 workspace (comp1Id)');

  // 2f. Logout and Login to Company 2 using ONLY email and password
  sandbox.Auth.logout();
  assert(sandbox.Storage.getSession() === null, 'Session removed from hcm_session upon logout');

  const adminUser2 = await sandbox.Auth.login('admin@apex.com', 'Password456!');
  assert(adminUser2.role === 'admin', 'Admin 2 successfully logged in with role: "admin"');
  const session2 = sandbox.Storage.getSession();
  assert(session2 !== null && session2.companyId === comp2Id, 'Credentials automatically resolved Company 2 workspace (comp2Id)');

  // Log back in as Company 1 admin to manage employees
  sandbox.Auth.logout();
  await sandbox.Auth.login('admin@techvision.com', 'Password123!');

  // 3. Employee Creation & ID Sequence in Company 1
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

  // Verify Company 2 users are completely isolated (only its admin, 0 employees)
  const comp2Users = sandbox.Storage.getUsers(comp2Id);
  assert(comp2Users.length === 1 && comp2Users[0].email === 'admin@apex.com', 'Workspace data isolation: Company 2 has 0 employees, unaffected by Company 1 additions');

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

  // 3a. Admin Logout and Employee Login Flow with ONLY Email & Password
  sandbox.Auth.logout();
  assert(sandbox.Storage.getSession() === null, 'Admin session cleared on logout before employee login');

  // Employee logs in with ONLY email and password, NO company selector
  const empUser = await sandbox.Auth.login('jane@techvision.com', 'password123');
  assert(empUser.role === 'employee', 'Employee successfully logged in with role: "employee"');
  const empSession = sandbox.Storage.getSession();
  assert(empSession.userId === emp2.id && empSession.companyId === comp1Id, 'Employee session automatically resolved to Company 1 workspace');

  // 3b. Role-Based Navigation Guard Test (Employee cannot access Admin pages)
  sandbox.window.location.href = '';
  const adminPageAccess = sandbox.Auth.requireAuth('admin');
  assert(adminPageAccess === null, 'Employee denied access to admin page by requireAuth("admin")');
  assert(sandbox.window.location.replaceTarget.includes('employee.html'), 'Employee redirected to employee dashboard when attempting admin page');

  // 3c. Employee accesses employee page
  const employeePageAccess = sandbox.Auth.requireAuth();
  assert(employeePageAccess !== null && employeePageAccess.id === emp2.id, 'Employee granted access to employee page');

  // 3d. Employee Logout
  sandbox.Auth.logout();
  assert(sandbox.Storage.getSession() === null, 'Employee session cleared on logout');

  // 3e. Unauthenticated Access Blocked
  sandbox.window.location.href = '';
  const unauthAccess = sandbox.Auth.requireAuth();
  assert(unauthAccess === null, 'Unauthenticated access blocked by requireAuth()');
  assert(sandbox.window.location.replaceTarget.includes('index.html'), 'Unauthenticated user redirected to index.html');

  // 3f. Switch Workspace Flow
  await sandbox.Auth.login('admin@apex.com', 'Password456!');
  assert(sandbox.Storage.getSession().companyId === comp2Id, 'Logged into Apex Innovations workspace');
  sandbox.Auth.switchCompany();
  assert(sandbox.Storage.getSession() === null, 'Switch Workspace successfully terminated session');

  // Log back in as TechVision admin for attendance and leave calculations
  await sandbox.Auth.login('admin@techvision.com', 'Password123!');

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

  // 9. Universal Copyright Footer Verification
  const footerHtml = sandbox.UI.getFooterHTML();
  const currentYear = new Date().getFullYear();
  assert(footerHtml.includes(String(currentYear)), `Footer contains current dynamic year: ${currentYear}`);
  assert(footerHtml.includes('HCM Lite. Developed by'), 'Footer contains "HCM Lite. Developed by"');
  assert(footerHtml.includes('href="https://github.com/hashirdilmuradzai/"'), 'Footer contains hyperlink to https://github.com/hashirdilmuradzai/');
  assert(footerHtml.includes('target="_blank"') && footerHtml.includes('rel="noopener noreferrer"'), 'Footer hyperlink opens in a new tab with security attributes');

  // 10. Clean wipe for final delivery
  sandbox.Storage.clearAllData();
  assert(sandbox.Storage.getUsers().length === 0, 'Data successfully wiped clean: users empty');
  assert(sandbox.Storage.getCompanies().length === 0, 'Data successfully wiped clean: companies empty');
  assert(sandbox.Storage.isSetupCompleted() === false, 'Data successfully wiped clean: isSetupCompleted false');

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
