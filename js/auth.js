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

    // Save company info
    const company = {
      name: companyName.trim(),
      startTime: startTime || '09:00',
      graceMinutes: (graceMinutes !== undefined && graceMinutes !== null && graceMinutes !== '' && !isNaN(Number(graceMinutes))) ? Math.max(0, parseInt(graceMinutes, 10)) : 15,
      workingDays: Array.isArray(workingDays) ? workingDays.map(Number) : [1, 2, 3, 4, 5],
      leaveQuota: parseInt(leaveQuota, 10) || 18,
      officeLat: null,
      officeLng: null,
      officeRadius: 150,
      cameraVerification: false,
      gpsVerification: false,
      setupCompleted: true,
      createdAt: new Date().toISOString()
    };
    Storage.saveCompany(company);

    // Create Admin User
    const passwordHash = await hashPassword(adminPassword);
    const adminUser = {
      id: `ADM-1001`,
      name: adminName.trim(),
      email: adminEmail.trim().toLowerCase(),
      passwordHash,
      role: 'admin',
      department: 'Management',
      designation: 'System Administrator',
      salary: 0,
      joiningDate: Storage.getLocalDateString(),
      status: 'active',
      phone: ''
    };
    Storage.saveUser(adminUser);

    // Set Active Session
    Storage.setSession({
      userId: adminUser.id,
      role: adminUser.role,
      name: adminUser.name,
      email: adminUser.email
    });

    Storage.logActivity('Company Setup', `Setup completed for ${company.name} by ${adminUser.name}`, 'admin', adminUser.name);

    return adminUser;
  }

  // Login with email and password
  async function login(email, password) {
    if (!email || !password) {
      throw new Error('Please enter both email and password.');
    }

    const user = Storage.getUserByEmail(email);
    if (!user) {
      throw new Error('No user found with this email address.');
    }

    if (user.status && user.status === 'inactive') {
      throw new Error('This account has been deactivated. Contact your administrator.');
    }

    const inputHash = await hashPassword(password);
    if (user.passwordHash !== inputHash) {
      throw new Error('Incorrect password. Please try again.');
    }

    // Set Session
    Storage.setSession({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email
    });

    Storage.logActivity('Login', `User ${user.name} logged in`, user.role, user.name);

    return user;
  }

  // Logout
  function logout() {
    const session = Storage.getSession();
    if (session) {
      Storage.logActivity('Logout', `User ${session.name} logged out`, session.role, session.name);
    }
    Storage.clearSession();
    window.location.href = isPagesDir() ? '../index.html' : 'index.html';
  }

  // Page Navigation Guard
  function requireAuth(allowedRole = null) {
    const session = Storage.getSession();

    if (!session || !session.userId) {
      // Not logged in -> redirect to login
      window.location.href = isPagesDir() ? '../index.html' : 'index.html';
      return null;
    }

    const user = Storage.getUserById(session.userId);
    if (!user) {
      Storage.clearSession();
      window.location.href = isPagesDir() ? '../index.html' : 'index.html';
      return null;
    }

    // If page requires Admin, but logged-in user is Employee
    if (allowedRole === 'admin' && user.role !== 'admin') {
      console.warn('[Auth] Access restricted: Employees cannot access Admin pages.');
      window.location.href = isPagesDir() ? 'employee.html' : 'pages/employee.html';
      return null;
    }

    // If page is for Employee, but user is Admin
    // (Admin can optionally view employee page, but let's allow Admin or return user)
    return user;
  }

  // Change Password for current user
  async function changePassword(oldPassword, newPassword) {
    const session = Storage.getSession();
    if (!session) throw new Error('No active session.');

    const user = Storage.getUserById(session.userId);
    if (!user) throw new Error('User not found.');

    const oldHash = await hashPassword(oldPassword);
    if (user.passwordHash !== oldHash) {
      throw new Error('Current password is incorrect.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    user.passwordHash = await hashPassword(newPassword);
    Storage.saveUser(user);
    Storage.logActivity('Password Changed', `User ${user.name} updated their password`, user.role, user.name);
    return true;
  }

  // Admin-initiated password reset for an employee
  async function resetEmployeePassword(employeeId, newPassword) {
    const user = Storage.getUserById(employeeId);
    if (!user) throw new Error('Employee not found.');
    if (!newPassword || newPassword.length < 6) throw new Error('Password must be at least 6 characters.');

    user.passwordHash = await hashPassword(newPassword);
    Storage.saveUser(user);
    Storage.logActivity('Password Reset', `Admin reset password for ${user.name} (${user.id})`, 'admin');
    return true;
  }

  return {
    hashPassword,
    checkFirstRun,
    setupCompanyAndAdmin,
    login,
    logout,
    requireAuth,
    changePassword,
    resetEmployeePassword,
    isPagesDir
  };
})();
