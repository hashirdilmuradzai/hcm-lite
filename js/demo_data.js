/**
 * HCM Lite — Development Demo Data Generator & Manager
 * 
 * IMPORTANT HACKATHON COMPLIANCE:
 * - This feature is strictly for LOCAL DEVELOPMENT AND TESTING ONLY.
 * - Never auto-executes on initial company creation or production deployment.
 * - Hidden and disabled when running in production (e.g. GitHub Pages).
 * - Tracks seeded demo records with `isDemo: true` and reserved `@example.test` domain.
 * - Allows 1-click safe generation and 1-click clean removal without touching real data.
 */

const DemoData = (() => {
  // Check if current runtime is a local development environment
  function isDevMode() {
    if (typeof window === 'undefined') return true; // Node / test environment
    const loc = window.location || {};
    const hostname = loc.hostname || '';
    const protocol = loc.protocol || '';

    // Local development addresses and test mock environments
    if (
      !hostname ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname === '0.0.0.0' ||
      protocol === 'file:'
    ) {
      return true;
    }

    // Explicit opt-in query parameter for manual testing in preview environments
    try {
      if (loc.search) {
        const params = new URLSearchParams(loc.search);
        if (params.get('dev') === 'true' || params.get('demo') === 'true') {
          return true;
        }
      }
    } catch (e) {}

    return false;
  }

  // Check if current active company currently has seeded demo data
  function hasDemoData(overrideCompanyId = null) {
    const users = Storage.getUsers(overrideCompanyId);
    return users.some(u => u.isDemo === true || (u.email && u.email.endsWith('@example.test')));
  }

  // 20 Fictional Pakistani Employees with diverse departmental distribution
  const DEMO_EMPLOYEES = [
    // Engineering (6)
    {
      name: 'Tariq Mehmood',
      email: 'tariq.mehmood@example.test',
      department: 'Engineering',
      designation: 'Senior Full Stack Engineer',
      salary: 145000,
      phone: '+92 300 5551101',
      joiningDaysAgo: 320
    },
    {
      name: 'Bilal Ahmed',
      email: 'bilal.ahmed@example.test',
      department: 'Engineering',
      designation: 'Frontend Engineer',
      salary: 95000,
      phone: '+92 301 5551102',
      joiningDaysAgo: 240
    },
    {
      name: 'Hamza Farooq',
      email: 'hamza.farooq@example.test',
      department: 'Engineering',
      designation: 'Backend Developer',
      salary: 110000,
      phone: '+92 302 5551103',
      joiningDaysAgo: 180
    },
    {
      name: 'Ali Raza',
      email: 'ali.raza@example.test',
      department: 'Engineering',
      designation: 'QA Automation Specialist',
      salary: 80000,
      phone: '+92 303 5551104',
      joiningDaysAgo: 150
    },
    {
      name: 'Mustafa Kamal',
      email: 'mustafa.kamal@example.test',
      department: 'Engineering',
      designation: 'DevOps & Cloud Engineer',
      salary: 130000,
      phone: '+92 304 5551105',
      joiningDaysAgo: 210
    },
    {
      name: 'Zeeshan Butt',
      email: 'zeeshan.butt@example.test',
      department: 'Engineering',
      designation: 'Mobile App Developer',
      salary: 105000,
      phone: '+92 305 5551106',
      joiningDaysAgo: 120
    },

    // Human Resources (3)
    {
      name: 'Ayesha Khan',
      email: 'ayesha.khan@example.test',
      department: 'Human Resources',
      designation: 'HR Director',
      salary: 140000,
      phone: '+92 321 5551201',
      joiningDaysAgo: 340
    },
    {
      name: 'Zainab Bibi',
      email: 'zainab.bibi@example.test',
      department: 'Human Resources',
      designation: 'Talent Acquisition Lead',
      salary: 75000,
      phone: '+92 322 5551202',
      joiningDaysAgo: 190
    },
    {
      name: 'Hina Aslam',
      email: 'hina.aslam@example.test',
      department: 'Human Resources',
      designation: 'HR Operations Coordinator',
      salary: 55000,
      phone: '+92 323 5551203',
      joiningDaysAgo: 90
    },

    // Marketing (4)
    {
      name: 'Sana Malik',
      email: 'sana.malik@example.test',
      department: 'Marketing',
      designation: 'Marketing Lead',
      salary: 125000,
      phone: '+92 333 5551301',
      joiningDaysAgo: 270
    },
    {
      name: 'Maryam Nawaz',
      email: 'maryam.nawaz@example.test',
      department: 'Marketing',
      designation: 'Content & Brand Strategist',
      salary: 70000,
      phone: '+92 334 5551302',
      joiningDaysAgo: 160
    },
    {
      name: 'Sadia Qureshi',
      email: 'sadia.qureshi@example.test',
      department: 'Marketing',
      designation: 'SEO & Growth Specialist',
      salary: 85000,
      phone: '+92 335 5551303',
      joiningDaysAgo: 220
    },
    {
      name: 'Nida Yasir',
      email: 'nida.yasir@example.test',
      department: 'Marketing',
      designation: 'Digital Communications Manager',
      salary: 60000,
      phone: '+92 336 5551304',
      joiningDaysAgo: 110
    },

    // Finance (3)
    {
      name: 'Omar Siddiqui',
      email: 'omar.siddiqui@example.test',
      department: 'Finance',
      designation: 'Senior Financial Analyst',
      salary: 115000,
      phone: '+92 345 5551401',
      joiningDaysAgo: 250
    },
    {
      name: 'Kamran Akmal',
      email: 'kamran.akmal@example.test',
      department: 'Finance',
      designation: 'Senior Accountant',
      salary: 90000,
      phone: '+92 346 5551402',
      joiningDaysAgo: 280
    },
    {
      name: 'Rabia Basri',
      email: 'rabia.basri@example.test',
      department: 'Finance',
      designation: 'Payroll Specialist',
      salary: 68000,
      phone: '+92 347 5551403',
      joiningDaysAgo: 140
    },

    // Operations (4)
    {
      name: 'Fatima Noor',
      email: 'fatima.noor@example.test',
      department: 'Operations',
      designation: 'Operations Director',
      salary: 135000,
      phone: '+92 311 5551501',
      joiningDaysAgo: 330
    },
    {
      name: 'Usman Ali',
      email: 'usman.ali@example.test',
      department: 'Operations',
      designation: 'Logistics Lead',
      salary: 78000,
      phone: '+92 312 5551502',
      joiningDaysAgo: 170
    },
    {
      name: 'Faisal Shah',
      email: 'faisal.shah@example.test',
      department: 'Operations',
      designation: 'Facilities Administrator',
      salary: 50000,
      phone: '+92 313 5551503',
      joiningDaysAgo: 260
    },
    {
      name: 'Mahnoor Baloch',
      email: 'mahnoor.baloch@example.test',
      department: 'Operations',
      designation: 'Support Operations Lead',
      salary: 58000,
      phone: '+92 314 5551504',
      joiningDaysAgo: 85
    }
  ];

  // Helper: compute YYYY-MM-DD from a past offset days
  function getDateStringDaysAgo(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Generate complete demo dataset into active company workspace
  async function generateDemoData() {
    const company = Storage.getCompany();
    if (!company) {
      throw new Error('Please set up or select a company workspace before generating demo data.');
    }

    const companyId = company.id || Storage.getActiveCompanyId();

    // Prevent duplicate demo generation
    if (hasDemoData(companyId)) {
      throw new Error('Demo data already exists in this workspace. Please remove demo data first if you wish to re-seed.');
    }

    const defaultPassword = 'DemoPass123!';
    const passwordHash = await Auth.hashPassword(defaultPassword);

    // 1. Seed 20 Demo Employees
    const createdEmployees = [];
    for (let i = 0; i < DEMO_EMPLOYEES.length; i++) {
      const raw = DEMO_EMPLOYEES[i];
      const employeeId = EmployeeManager.generateEmployeeId();
      const joiningDate = getDateStringDaysAgo(raw.joiningDaysAgo);

      const empRecord = {
        id: employeeId,
        name: raw.name,
        email: raw.email.toLowerCase(),
        passwordHash,
        role: 'employee',
        department: raw.department,
        designation: raw.designation,
        salary: raw.salary,
        joiningDate,
        phone: raw.phone,
        status: 'active',
        isDemo: true,
        createdAt: new Date(Date.now() - raw.joiningDaysAgo * 86400000).toISOString()
      };

      Storage.saveUser(empRecord, companyId);
      createdEmployees.push(empRecord);
    }

    // 2. Seed 10 Realistic Leave Requests (4 Approved, 3 Pending, 3 Rejected)
    // Distributed cleanly without overlap
    const LEAVE_SPECS = [
      {
        empIndex: 0, // Tariq Mehmood
        type: 'Casual',
        fromDaysAgo: 16,
        toDaysAgo: 15,
        reason: 'Family wedding event in Lahore',
        status: 'Approved',
        adminRemarks: 'Approved. Please ensure sprint tasks are handed over.'
      },
      {
        empIndex: 6, // Ayesha Khan
        type: 'Sick',
        fromDaysAgo: 9,
        toDaysAgo: 8,
        reason: 'Seasonal viral flu and doctor-advised bed rest',
        status: 'Approved',
        adminRemarks: 'Get well soon. Approved.'
      },
      {
        empIndex: 16, // Fatima Noor
        type: 'Casual',
        fromDaysAgo: 22,
        toDaysAgo: 22,
        reason: 'Personal banking and urgent property documentation',
        status: 'Approved',
        adminRemarks: 'Approved.'
      },
      {
        empIndex: 13, // Omar Siddiqui
        type: 'Sick',
        fromDaysAgo: 4,
        toDaysAgo: 4,
        reason: 'Emergency dental extraction and recovery',
        status: 'Approved',
        adminRemarks: 'Approved.'
      },
      {
        empIndex: 1, // Bilal Ahmed
        type: 'Casual',
        fromDaysAgo: -4, // Future
        toDaysAgo: -2,
        reason: 'Attending regional developer summit in Islamabad',
        status: 'Pending',
        adminRemarks: ''
      },
      {
        empIndex: 2, // Hamza Farooq
        type: 'Casual',
        fromDaysAgo: -7, // Future
        toDaysAgo: -6,
        reason: 'Personal travel to hometown for family gathering',
        status: 'Pending',
        adminRemarks: ''
      },
      {
        empIndex: 3, // Ali Raza
        type: 'Casual',
        fromDaysAgo: -2, // Near Future
        toDaysAgo: -2,
        reason: 'Home utility maintenance and civil inspection',
        status: 'Pending',
        adminRemarks: ''
      },
      {
        empIndex: 9, // Sana Malik
        type: 'Casual',
        fromDaysAgo: 12,
        toDaysAgo: 10,
        reason: 'Extended out-of-town leisure trip',
        status: 'Rejected',
        adminRemarks: 'Rejected: Critical marketing sprint release week. Please reschedule.'
      },
      {
        empIndex: 17, // Usman Ali
        type: 'Sick',
        fromDaysAgo: 20,
        toDaysAgo: 18,
        reason: 'Medical rest without doctor prescription',
        status: 'Rejected',
        adminRemarks: 'Rejected: Medical certificate missing per HR attendance policy.'
      },
      {
        empIndex: 4, // Mustafa Kamal
        type: 'Casual',
        fromDaysAgo: 26,
        toDaysAgo: 25,
        reason: 'Vacation request during planned server migration',
        status: 'Rejected',
        adminRemarks: 'Rejected due to scheduled weekend infrastructure upgrade window.'
      }
    ];

    const approvedLeaveMap = {}; // Map of `empId_YYYY-MM-DD` => true

    for (let k = 0; k < LEAVE_SPECS.length; k++) {
      const spec = LEAVE_SPECS[k];
      const emp = createdEmployees[spec.empIndex];
      const fromDate = getDateStringDaysAgo(spec.fromDaysAgo);
      const toDate = getDateStringDaysAgo(spec.toDaysAgo);
      const daysCount = Math.max(1, Math.abs(spec.fromDaysAgo - spec.toDaysAgo) + 1);

      const leaveRecord = {
        id: `LV-DEMO-${1001 + k}`,
        employeeId: emp.id,
        type: spec.type,
        fromDate,
        toDate,
        days: daysCount,
        reason: spec.reason,
        status: spec.status,
        adminRemarks: spec.adminRemarks,
        appliedAt: getDateStringDaysAgo(Math.max(spec.fromDaysAgo, spec.toDaysAgo) + 2),
        isDemo: true
      };

      Storage.saveLeaveRequest(leaveRecord, companyId);

      // Record approved dates to guarantee zero attendance is seeded on approved leaves
      if (spec.status === 'Approved') {
        const start = new Date(fromDate);
        const end = new Date(toDate);
        for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
          const dtStr = dt.toISOString().split('T')[0];
          approvedLeaveMap[`${emp.id}_${dtStr}`] = true;
        }
      }
    }

    // 3. Seed 30 Days Attendance Records
    const companyWorkingDays = Array.isArray(company.workingDays) ? company.workingDays.map(Number) : [1, 2, 3, 4, 5];
    const startTimeParts = (company.startTime || '09:00').split(':');
    const startHour = parseInt(startTimeParts[0], 10) || 9;
    const startMin = parseInt(startTimeParts[1], 10) || 0;
    const graceMinutes = parseInt(company.graceMinutes, 10) || 15;

    // Seed attendance for each employee across the last 30 days (excluding future days)
    for (let d = 29; d >= 0; d--) {
      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() - d);
      const dayOfWeek = dateObj.getDay();

      // Only generate attendance for configured working days
      if (!companyWorkingDays.includes(dayOfWeek)) continue;

      const dateStr = dateObj.toISOString().split('T')[0];

      for (let eIdx = 0; eIdx < createdEmployees.length; eIdx++) {
        const emp = createdEmployees[eIdx];

        // 1. Skip if on approved leave
        if (approvedLeaveMap[`${emp.id}_${dateStr}`]) continue;

        // Deterministic pseudo-randomness based on date and employee index
        const hashSeed = (d * 17 + eIdx * 31) % 100;

        // ~5% Absence (no record created)
        if (hashSeed < 5) continue;

        let checkInH, checkInM, checkInS;
        let checkOutH, checkOutM, checkOutS;
        let isLate = false;
        let status = 'Present';
        let workHours = 8.5;

        if (hashSeed >= 5 && hashSeed < 10) {
          // ~5% Half Day (< 5.0 hours, e.g. 4.5 hours)
          checkInH = startHour;
          checkInM = 0;
          checkInS = 12;
          checkOutH = startHour + 4;
          checkOutM = 30;
          checkOutS = 0;
          isLate = false;
          status = 'Half Day';
          workHours = 4.5;
        } else if (hashSeed >= 10 && hashSeed < 25) {
          // ~15% Late Arrival (> grace minutes)
          const lateOffset = graceMinutes + 12 + (eIdx % 15);
          const totalMin = startHour * 60 + startMin + lateOffset;
          checkInH = Math.floor(totalMin / 60);
          checkInM = totalMin % 60;
          checkInS = 30;
          checkOutH = 18;
          checkOutM = 15;
          checkOutS = 0;
          isLate = true;
          status = 'Present';
          const diffMs = (checkOutH * 3600 + checkOutM * 60) - (checkInH * 3600 + checkInM * 60);
          workHours = Math.round((diffMs / 3600) * 100) / 100;
        } else {
          // ~75% On-Time Check In (up to 15 mins early or on the dot)
          const earlyOffset = (eIdx % 12);
          const totalMin = Math.max(0, startHour * 60 + startMin - earlyOffset);
          checkInH = Math.floor(totalMin / 60);
          checkInM = totalMin % 60;
          checkInS = 15;
          checkOutH = 17;
          checkOutM = 30 + (eIdx % 25);
          checkOutS = 45;
          isLate = false;
          status = 'Present';
          const diffMs = (checkOutH * 3600 + checkOutM * 60) - (checkInH * 3600 + checkInM * 60);
          workHours = Math.round((diffMs / 3600) * 100) / 100;
        }

        const checkInTimeStr = `${String(checkInH).padStart(2, '0')}:${String(checkInM).padStart(2, '0')}:${String(checkInS).padStart(2, '0')}`;
        const checkOutTimeStr = `${String(checkOutH).padStart(2, '0')}:${String(checkOutM).padStart(2, '0')}:${String(checkOutS).padStart(2, '0')}`;

        const inTs = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), checkInH, checkInM, checkInS).getTime();
        const outTs = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), checkOutH, checkOutM, checkOutS).getTime();

        const attRecord = {
          id: `ATT-DEMO-${d}-${emp.id}`,
          employeeId: emp.id,
          date: dateStr,
          checkIn: checkInTimeStr,
          checkInTimestamp: inTs,
          checkOut: checkOutTimeStr,
          checkOutTimestamp: outTs,
          workHours,
          isLate,
          status,
          verificationType: 'Standard Web Check-in',
          isDemo: true
        };

        Storage.saveAttendanceRecord(attRecord, companyId);
      }
    }

    // 4. Seed 4 Realistic Announcements
    const ANNOUNCEMENTS = [
      {
        id: 'ANN-DEMO-1001',
        title: 'Monthly All-Hands Meeting & Departmental Review',
        content: 'Please join our monthly company-wide gathering this coming Friday at 3:00 PM. We will celebrate team achievements, review monthly KPI metrics, and discuss roadmap goals.',
        priority: 'normal',
        authorName: 'Chief Executive Office'
      },
      {
        id: 'ANN-DEMO-1002',
        title: 'Updated Attendance & Clock-In Policy Reminder',
        content: 'All team members are reminded to clock in using the HCM Lite self-service portal upon arrival. The official office start time is 09:00 AM. Thank you for your daily punctuality.',
        priority: 'high',
        authorName: 'Human Resources'
      },
      {
        id: 'ANN-DEMO-1003',
        title: 'Professional Upskilling: Modern Cloud & AI Workshop',
        content: 'Engineering and HR are organizing an interactive workshop on cloud scalable architectures and generative AI integration next Tuesday. Lunch and refreshments provided.',
        priority: 'normal',
        authorName: 'Engineering & People Ops'
      },
      {
        id: 'ANN-DEMO-1004',
        title: 'Official Holiday Notice: Upcoming Public Observance',
        content: 'In observance of the upcoming national public holiday, company offices will remain closed. Standard business operations will resume promptly the following working day.',
        priority: 'normal',
        authorName: 'Management'
      }
    ];

    for (let a = 0; a < ANNOUNCEMENTS.length; a++) {
      const ann = ANNOUNCEMENTS[a];
      Storage.saveAnnouncement({
        id: ann.id,
        title: ann.title,
        content: ann.content,
        priority: ann.priority,
        authorName: ann.authorName,
        isDemo: true
      }, companyId);
    }

    Storage.logActivity('Demo Data Generated', `Seeded 20 employees, 30 days attendance, 10 leaves, and 4 announcements into ${company.name}`, 'admin', 'System Demo Seeder', companyId);

    // Notify listeners for in-page instant reactivity
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('hcm_storage_change', {
        detail: { key: `hcm_${companyId}_demo_data`, value: 'generated' }
      }));
    }

    return {
      employeesCount: createdEmployees.length,
      leavesCount: LEAVE_SPECS.length,
      announcementsCount: ANNOUNCEMENTS.length
    };
  }

  // Remove ONLY demo data, strictly preserving all real users and company settings
  function removeDemoData(overrideCompanyId = null) {
    const company = Storage.getCompany(overrideCompanyId);
    const companyId = overrideCompanyId || (company ? company.id : Storage.getActiveCompanyId());

    // 1. Filter out demo users
    const allUsers = Storage.getUsers(companyId);
    const realUsers = allUsers.filter(u => !(u.isDemo === true || (u.email && u.email.endsWith('@example.test'))));
    Storage.set(Storage.getScopedKey('users', companyId), realUsers);

    // 2. Filter out demo attendance
    const allAtt = Storage.getAttendance(companyId);
    const realAtt = allAtt.filter(a => !(a.isDemo === true || (String(a.id).startsWith('ATT-DEMO-'))));
    Storage.set(Storage.getScopedKey('attendance', companyId), realAtt);

    // 3. Filter out demo leaves
    const allLeaves = Storage.getLeaves(companyId);
    const realLeaves = allLeaves.filter(l => !(l.isDemo === true || (String(l.id).startsWith('LV-DEMO-'))));
    Storage.set(Storage.getScopedKey('leaves', companyId), realLeaves);

    // 4. Filter out demo announcements
    const allAnn = Storage.getAnnouncements(companyId);
    const realAnn = allAnn.filter(ann => !(ann.isDemo === true || (String(ann.id).startsWith('ANN-DEMO-'))));
    Storage.set(Storage.getScopedKey('announcements', companyId), realAnn);

    Storage.logActivity('Demo Data Removed', `Cleaned all demo records while strictly preserving real records in ${company ? company.name : companyId}`, 'admin', 'System Demo Seeder', companyId);

    // Notify listeners for in-page instant reactivity
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('hcm_storage_change', {
        detail: { key: `hcm_${companyId}_demo_data`, value: 'removed' }
      }));
    }

    return true;
  }

  // Render development-only controls and indicators in the DOM
  function initDevControls() {
    if (!isDevMode()) return; // Never render in production deployment
    if (typeof document === 'undefined') return;

    const session = Storage.getSession();
    if (!session || session.role !== 'admin') return;

    renderBannerAndButtons();

    // Re-render when storage changes
    window.addEventListener('hcm_storage_change', () => {
      renderBannerAndButtons();
    });
  }

  function renderBannerAndButtons() {
    if (!isDevMode()) return;
    const contentBody = document.querySelector('.content-body');
    if (!contentBody) return;

    const isSeeded = hasDemoData();

    // 1. Manage Banner
    let banner = document.getElementById('demo-data-indicator');
    if (isSeeded) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'demo-data-indicator';
        banner.className = 'demo-data-banner';
        contentBody.insertBefore(banner, contentBody.firstChild);
      }
      banner.innerHTML = `
        <div class="demo-data-banner-content">
          <span class="demo-badge">DEMO DATA ACTIVE</span>
          <span>Development dataset populated: <strong>20 Pakistani employees</strong>, <strong>30-day attendance</strong>, <strong>10 leaves</strong>, and <strong>4 notices</strong>.</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button type="button" class="btn btn-outline btn-sm" id="btn-demo-remove" style="border-color: #D97706; color: #D97706;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>Remove Demo Data</span>
          </button>
        </div>
      `;

      const removeBtn = banner.querySelector('#btn-demo-remove');
      if (removeBtn) {
        removeBtn.onclick = () => {
          UI.showConfirmModal({
            title: 'Remove Demo Data?',
            message: 'Are you sure you want to remove all generated demo records?<br><br><strong>Guarantee:</strong> All genuine user records, your Admin login, and company configuration are completely preserved.',
            confirmText: 'Remove Demo Data',
            isDestructive: true,
            onConfirm: () => {
              removeDemoData();
              UI.showToast('Demo data removed successfully.', 'info');
              // Trigger real-time page updates without reload
              if (typeof EmployeesPage !== 'undefined' && EmployeesPage.renderTable) {
                EmployeesPage.populateDepartmentFilter();
                EmployeesPage.renderTable();
              }
            }
          });
        };
      }
    } else {
      if (banner) {
        banner.remove();
      }
    }

    // 2. Manage "Generate Demo Data" button in toolbar
    const pageActions = document.querySelector('.page-actions');
    if (pageActions) {
      let genBtn = document.getElementById('btn-generate-demo-data');
      if (!isSeeded) {
        if (!genBtn) {
          genBtn = document.createElement('button');
          genBtn.type = 'button';
          genBtn.id = 'btn-generate-demo-data';
          genBtn.className = 'btn btn-secondary';
          genBtn.title = 'Development Sandbox: Populate realistic demo records';
          genBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px; color: #D97706;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            <span>Generate Demo Data</span>
          `;
          pageActions.insertBefore(genBtn, pageActions.firstChild);
        }

        genBtn.onclick = () => {
          UI.showConfirmModal({
            title: 'Generate Realistic Demo Data?',
            message: 'Populate the workspace with <strong>20 Pakistani employees</strong>, <strong>30 calendar days of attendance</strong> (on-time, late, half-days, absences), <strong>10 leave requests</strong>, and <strong>4 company announcements</strong>?<br><br><em>Existing real data will not be modified or overwritten.</em>',
            confirmText: 'Generate Demo Data',
            onConfirm: async () => {
              try {
                const res = await generateDemoData();
                UI.showToast(`Populated ${res.employeesCount} employees, 30 days of attendance, and ${res.leavesCount} leaves!`, 'success');
                // Trigger real-time page updates without reload
                if (typeof EmployeesPage !== 'undefined' && EmployeesPage.renderTable) {
                  EmployeesPage.populateDepartmentFilter();
                  EmployeesPage.renderTable();
                }
              } catch (err) {
                UI.showToast(err.message, 'error');
              }
            }
          });
        };
      } else {
        if (genBtn) {
          genBtn.remove();
        }
      }
    }
  }

  return {
    isDevMode,
    hasDemoData,
    generateDemoData,
    removeDemoData,
    initDevControls
  };
})();
