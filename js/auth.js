/**
 * HCM Lite — Authentication & Session Guard Module
 * - SHA-256 Web Crypto password hashing
 * - First-run company setup and Admin creation
 * - Role-based authentication & redirection
 * - Page route protection
 * - Password change workflow
 */

const Auth = (() => {
  // Hash password using Web Crypto API (SHA-256) with fallback
  async function hashPassword(plainText) {
    if (!plainText) return '';
    try {
      if (window.crypto && window.crypto.subtle) {
        const msgUint8 = new TextEncoder().encode(plainText);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {
      console.warn('[Auth] Web Crypto unavailable, using fallback hash');
    }
    // Simple deterministic fallback for offline/insecure local development
    let hash = 0;
    for (let i = 0; i < plainText.length; i++) {
      const char = plainText.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'fb_' + Math.abs(hash).toString(16);
  }

  // Get current path helper (detect whether we are inside /pages/ or at root)
  function isPagesDir() {
    return window.location.pathname.includes('/pages/');
  }

  function getRootPath(target) {
    if (isPagesDir()) {
      return target.startsWith('pages/') ? target.replace('pages/', '') : `../${target}`;
    }
    return target;
  }

  // Check if first-run setup exists
  function checkFirstRun() {
    return !Storage.isSetupCompleted();
  }

  // Setup Company and first Admin
  async function setupCompanyAndAdmin(formData) {
    const {
      companyName,
      companyCode,
      adminName,
      adminEmail,
      adminPassword,
      startTime = '09:00',
      graceMinutes = 15,
      workingDays = [1, 2, 3, 4, 5],
      leaveQuota = 18
    } = formData;

    // Validate
    if (!companyName || !companyName.trim()) throw new Error('Company name is required');
    if (!adminName || !adminName.trim()) throw new Error('Admin full name is required');
    if (!adminEmail || !adminEmail.includes('@')) throw new Error('Valid admin email is required');
    if (!adminPassword || adminPassword.length < 6) throw new Error('Password must be at least 6 characters');

    // Ensure Admin email is unique globally across all workspaces
    const cleanEmail = adminEmail.trim().toLowerCase();
    const existingGlobal = Storage.getUserByEmailGlobal(cleanEmail);
    if (existingGlobal) {
      throw new Error('An account with this email address already exists. Please sign in or use a different email.');
    }

    // Auto-generate company code internally if not provided
    let code = companyCode ? companyCode.trim().toUpperCase() : '';
    if (!code) {
      const baseSlug = companyName.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'CORP';
      code = baseSlug;
      const companies = Storage.getCompanies();
      let counter = 1;
      while (companies.some(c => (c.code || '').toUpperCase() === code)) {
        code = `${baseSlug}${counter}`;
        counter++;
      }
    } else {
      const existingByCode = Storage.getCompanyByCode(code);
      if (existingByCode) {
        throw new Error(`A company workspace with code "${code}" already exists. Please choose a different workspace code.`);
      }
    }

    // Create the company workspace
    const newCompany = Storage.createCompanyWorkspace({
      name: companyName.trim(),
      code,
      startTime: startTime || '09:00',
      graceMinutes: (graceMinutes !== undefined && graceMinutes !== null && graceMinutes !== '' && !isNaN(Number(graceMinutes))) ? Math.max(0, parseInt(graceMinutes, 10)) : 15,
      workingDays: Array.isArray(workingDays) ? workingDays.map(Number) : [1, 2, 3, 4, 5],
      leaveQuota: parseInt(leaveQuota, 10) || 18,
      officeLat: null,
      officeLng: null,
      officeRadius: 150,
      cameraVerification: false,
      gpsVerification: false
    });

    // Create Admin User inside the new company's users collection
    const passwordHash = await hashPassword(adminPassword);
    const adminUser = {
      id: `ADM-1001`,
      name: adminName.trim(),
      email: cleanEmail,
      passwordHash,
      role: 'admin',
      department: 'Management',
      designation: 'System Administrator',
      salary: 0,
      joiningDate: Storage.getLocalDateString(),
      status: 'active',
      phone: ''
    };
    Storage.saveUser(adminUser, newCompany.id);

    // Explicit requirement: Do not log the Admin in automatically after company creation
    Storage.clearSession();
    Storage.setActiveCompanyId(newCompany.id);

    Storage.logActivity('Company Workspace Created', `Workspace created for ${newCompany.name} (${newCompany.code}) by ${adminUser.name}`, 'admin', adminUser.name, newCompany.id);

    return { company: newCompany, adminUser };
  }

  // Automatic Workspace Resolution Login
  // Credentials (email + password) automatically resolve company, user, and role.
  async function login(arg1, arg2) {
    let email = '';
    let password = '';

    if (typeof arg1 === 'object' && arg1 !== null) {
      email = arg1.email;
      password = arg1.password;
    } else {
      email = arg1;
      password = arg2;
    }

    if (!email || !email.trim() || !password) {
      throw new Error('Please enter both email and password.');
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Search candidate accounts across all locally registered companies
    const candidateAccounts = Storage.findAccountByEmail(cleanEmail);
    if (!candidateAccounts || candidateAccounts.length === 0) {
      throw new Error('Invalid email or password.');
    }

    // 2. Hash password and match against candidate accounts
    const inputHash = await hashPassword(password);
    const validMatches = candidateAccounts.filter(acc => acc.user.passwordHash === inputHash);

    if (validMatches.length === 0) {
      throw new Error('Invalid email or password.');
    }

    // 3. Ambiguity / Conflict detection for legacy records
    if (validMatches.length > 1) {
      throw new Error('Account conflict detected: Multiple workspaces share this email and password. Please contact support.');
    }

    const match = validMatches[0];
    const user = match.user;
    const targetCompanyId = match.company.id;

    if (user.status && user.status === 'inactive') {
      throw new Error('This account has been deactivated. Contact your administrator.');
    }

    // 4. Set Active Session with resolved companyId and userId
    const sessionData = {
      companyId: targetCompanyId,
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      loginTime: new Date().toISOString()
    };
    Storage.setSession(sessionData);
    Storage.setActiveCompanyId(targetCompanyId);

    Storage.logActivity('User Signed In', `${user.name} signed in successfully`, user.role, user.name, targetCompanyId);

    return user;
  }

  // Switch Company: clears active session and returns to login with company selector
  function switchCompany() {
    Storage.clearSession();
    window.location.replace(isPagesDir() ? '../index.html' : 'index.html');
  }

  // Logout: clears session and redirects immediately to login
  function logout() {
    const session = Storage.getSession();
    if (session) {
      Storage.logActivity('Logout', `User ${session.name} logged out`, session.role, session.name, session.companyId);
    }
    Storage.clearSession();
    window.location.replace(isPagesDir() ? '../index.html' : 'index.html');
  }

  // Page Navigation Guard (Validates both companyId and userId)
  function requireAuth(allowedRole = null) {
    const session = Storage.getSession();

    if (!session || !session.userId || !session.companyId) {
      // Not logged in -> redirect to login
      window.location.replace(isPagesDir() ? '../index.html' : 'index.html');
      return null;
    }

    const user = Storage.getUserById(session.userId, session.companyId);
    if (!user || user.status === 'inactive') {
      Storage.clearSession();
      window.location.replace(isPagesDir() ? '../index.html' : 'index.html');
      return null;
    }

    // If page requires Admin, but logged-in user is Employee
    if (allowedRole === 'admin' && user.role !== 'admin') {
      console.warn('[Auth] Access restricted: Employees cannot access Admin pages.');
      window.location.replace(isPagesDir() ? 'employee.html' : 'pages/employee.html');
      return null;
    }

    return user;
  }

  // Attach bfcache page restore guard so back button never exposes protected pages
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pageshow', (event) => {
      if (isPagesDir()) {
        const session = Storage.getSession();
        if (!session || !session.userId || !session.companyId) {
          window.location.replace('../index.html');
        }
      }
    });
  }

  // Change Password for current user
  async function changePassword(oldPassword, newPassword) {
    const session = Storage.getSession();
    if (!session || !session.companyId) throw new Error('No active session.');

    const user = Storage.getUserById(session.userId, session.companyId);
    if (!user) throw new Error('User not found.');

    const oldHash = await hashPassword(oldPassword);
    if (user.passwordHash !== oldHash) {
      throw new Error('Current password is incorrect.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    user.passwordHash = await hashPassword(newPassword);
    Storage.saveUser(user, session.companyId);
    Storage.logActivity('Password Changed', `User ${user.name} updated their password`, user.role, user.name, session.companyId);
    return true;
  }

  // Admin-initiated password reset for an employee
  async function resetEmployeePassword(employeeId, newPassword) {
    const session = Storage.getSession();
    const companyId = session ? session.companyId : null;
    const user = Storage.getUserById(employeeId, companyId);
    if (!user) throw new Error('Employee not found.');
    if (!newPassword || newPassword.length < 6) throw new Error('Password must be at least 6 characters.');

    user.passwordHash = await hashPassword(newPassword);
    Storage.saveUser(user, companyId);
    Storage.logActivity('Password Reset', `Admin reset password for ${user.name} (${user.id})`, 'admin', '', companyId);
    return true;
  }

  return {
    hashPassword,
    checkFirstRun,
    setupCompanyAndAdmin,
    login,
    logout,
    switchCompany,
    requireAuth,
    changePassword,
    resetEmployeePassword,
    isPagesDir
  };
})();
