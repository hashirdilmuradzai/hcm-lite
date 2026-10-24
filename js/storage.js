/**
 * HCM Lite — LocalStorage Multi-Company Data Access Layer
 * Supports isolated company workspaces with safe, idempotent migration from single-company schema.
 *
 * Architecture:
 * - hcm_companies: Registry of all company workspaces [{ id, code, name, createdAt }, ...]
 * - hcm_session: Active authenticated session { companyId, userId, role, name, email, loginTime }
 * - hcm_active_company_id: Selected workspace context when outside an active session
 * - hcm_preferences: Shared browser preferences (theme: light/dark)
 * - hcm_legacy_backup: Recoverable backup created during legacy data migration
 *
 * Company-scoped keys (complete namespace isolation):
 * - hcm_{companyId}_company
 * - hcm_{companyId}_users
 * - hcm_{companyId}_attendance
 * - hcm_{companyId}_leaves
 * - hcm_{companyId}_announcements
 * - hcm_{companyId}_holidays
 * - hcm_{companyId}_activity_log
 */

const Storage = (() => {
  const GLOBAL_KEYS = {
    COMPANIES: 'hcm_companies',
    SESSION: 'hcm_session',
    ACTIVE_COMPANY_ID: 'hcm_active_company_id',
    PREFERENCES: 'hcm_preferences',
    LEGACY_BACKUP: 'hcm_legacy_backup'
  };

  // Safe JSON parse with fallback
  function get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null || item === undefined || item === '') {
        return defaultValue;
      }
      return JSON.parse(item);
    } catch (e) {
      console.error(`[Storage] Error reading key "${key}":`, e);
      return defaultValue;
    }
  }

  // Safe JSON stringify
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // Dispatch custom storage event for in-page reactivity
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hcm_storage_change', { detail: { key, value } }));
      }
      return true;
    } catch (e) {
      console.error(`[Storage] Error writing key "${key}":`, e);
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hcm_storage_change', { detail: { key, value: null } }));
      }
      return true;
    } catch (e) {
      console.error(`[Storage] Error removing key "${key}":`, e);
      return false;
    }
  }

  // --- Automatic, Safe, Idempotent Legacy Single-Company Migration ---
  function runLegacyMigration() {
    try {
      const rawLegacyCompany = localStorage.getItem('hcm_company');
      const companies = get(GLOBAL_KEYS.COMPANIES, []);

      // Migrate only if legacy single-company data exists and multi-company registry is not yet populated
      if (rawLegacyCompany && companies.length === 0) {
        const legacyComp = JSON.parse(rawLegacyCompany);
        if (legacyComp && legacyComp.name) {
          // 1. Create a recoverable backup before migration
          const backupData = {
            migratedAt: new Date().toISOString(),
            company: legacyComp,
            users: get('hcm_users', []),
            attendance: get('hcm_attendance', []),
            leaves: get('hcm_leaves', []),
            announcements: get('hcm_announcements', []),
            holidays: get('hcm_holidays', []),
            activityLog: get('hcm_activity_log', []),
            session: get('hcm_session', null)
          };
          set(GLOBAL_KEYS.LEGACY_BACKUP, backupData);

          const compId = legacyComp.id || 'CMP-1001';
          let compCode = legacyComp.code;
          if (!compCode) {
            compCode = legacyComp.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'MAIN';
          }

          const registryEntry = {
            id: compId,
            code: compCode,
            name: legacyComp.name,
            createdAt: legacyComp.createdAt || new Date().toISOString()
          };

          // 2. Write to company registry
          set(GLOBAL_KEYS.COMPANIES, [registryEntry]);

          // 3. Move collections into company-isolated keys
          set(`hcm_${compId}_company`, { ...legacyComp, id: compId, code: compCode });
          set(`hcm_${compId}_users`, get('hcm_users', []));
          set(`hcm_${compId}_attendance`, get('hcm_attendance', []));
          set(`hcm_${compId}_leaves`, get('hcm_leaves', []));
          set(`hcm_${compId}_announcements`, get('hcm_announcements', []));
          set(`hcm_${compId}_holidays`, get('hcm_holidays', []));
          set(`hcm_${compId}_activity_log`, get('hcm_activity_log', []));

          // 4. Update session if active
          const activeSession = get(GLOBAL_KEYS.SESSION, null);
          if (activeSession && activeSession.userId) {
            set(GLOBAL_KEYS.SESSION, { ...activeSession, companyId: compId });
          }

          setActiveCompanyId(compId);

          // 5. Safely clean up raw legacy keys
          localStorage.removeItem('hcm_company');
          localStorage.removeItem('hcm_users');
          localStorage.removeItem('hcm_attendance');
          localStorage.removeItem('hcm_leaves');
          localStorage.removeItem('hcm_announcements');
          localStorage.removeItem('hcm_holidays');
          localStorage.removeItem('hcm_activity_log');

          console.log(`[Storage] Migrated legacy company "${legacyComp.name}" to workspace ${compId} (${compCode})`);
        }
      }
    } catch (err) {
      console.warn('[Storage] Legacy migration notice:', err);
    }
  }

  // Run migration on script initialization
  runLegacyMigration();

  // --- Multi-Company Registry & Workspace Management ---
  function getCompanies() {
    return get(GLOBAL_KEYS.COMPANIES, []);
  }

  function getCompanySummary(companyId) {
    const list = getCompanies();
    return list.find(c => String(c.id) === String(companyId)) || null;
  }

  function getCompanyByCode(code) {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    const list = getCompanies();
    return list.find(c => (c.code || '').trim().toUpperCase() === clean) || null;
  }

  function getCompanyByName(name) {
    if (!name) return null;
    const clean = name.trim().toLowerCase();
    const list = getCompanies();
    return list.find(c => (c.name || '').trim().toLowerCase() === clean) || null;
  }

  function getActiveCompanyId() {
    // 1. If user is logged in, their session determines companyId
    const session = get(GLOBAL_KEYS.SESSION, null);
    if (session && session.companyId) {
      return String(session.companyId);
    }
    // 2. Explicitly selected workspace (e.g. on login screen)
    const selected = localStorage.getItem(GLOBAL_KEYS.ACTIVE_COMPANY_ID);
    if (selected) {
      return selected;
    }
    // 3. First registered company
    const companies = getCompanies();
    if (companies.length > 0) {
      return String(companies[0].id);
    }
    // 4. Default fallback
    return 'default';
  }

  function setActiveCompanyId(companyId) {
    if (companyId) {
      localStorage.setItem(GLOBAL_KEYS.ACTIVE_COMPANY_ID, String(companyId));
    } else {
      localStorage.removeItem(GLOBAL_KEYS.ACTIVE_COMPANY_ID);
    }
  }

  function getScopedKey(baseKey, overrideCompanyId = null) {
    const cid = overrideCompanyId || getActiveCompanyId();
    return `hcm_${cid}_${baseKey}`;
  }

  // Create a brand new company workspace
  function createCompanyWorkspace(companyData) {
    const companies = getCompanies();

    // Generate unique internal ID: CMP-1001, CMP-1002, etc.
    let maxNum = 1000;
    companies.forEach(c => {
      const match = String(c.id).match(/CMP-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const companyId = `CMP-${maxNum + 1}`;

    // Clean and validate company code (workspace slug)
    let companyCode = companyData.code ? companyData.code.trim().toUpperCase() : '';
    if (!companyCode) {
      const baseSlug = (companyData.name || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'CORP';
      companyCode = baseSlug;
      let counter = 1;
      while (companies.some(c => (c.code || '').toUpperCase() === companyCode)) {
        companyCode = `${baseSlug}${counter}`;
        counter++;
      }
    } else {
      // Check duplicate code if explicitly provided
      if (companies.some(c => (c.code || '').toUpperCase() === companyCode)) {
        throw new Error(`A company with workspace code "${companyCode}" already exists. Please choose a different code.`);
      }
    }

    const registryEntry = {
      id: companyId,
      code: companyCode,
      name: companyData.name.trim(),
      createdAt: new Date().toISOString()
    };

    companies.push(registryEntry);
    set(GLOBAL_KEYS.COMPANIES, companies);

    // Initialize isolated company settings
    const fullCompanySettings = {
      ...companyData,
      id: companyId,
      code: companyCode,
      name: companyData.name.trim(),
      startTime: companyData.startTime || '09:00',
      graceMinutes: (companyData.graceMinutes !== undefined && companyData.graceMinutes !== null && companyData.graceMinutes !== '' && !isNaN(Number(companyData.graceMinutes))) ? Math.max(0, parseInt(companyData.graceMinutes, 10)) : 15,
      workingDays: Array.isArray(companyData.workingDays) ? companyData.workingDays.map(Number) : [1, 2, 3, 4, 5],
      leaveQuota: parseInt(companyData.leaveQuota, 10) || 18,
      officeLat: companyData.officeLat || null,
      officeLng: companyData.officeLng || null,
      officeRadius: companyData.officeRadius || 150,
      cameraVerification: !!companyData.cameraVerification,
      gpsVerification: !!companyData.gpsVerification,
      setupCompleted: true,
      nextEmployeeSeq: 1000,
      createdAt: new Date().toISOString()
    };

    set(getScopedKey('company', companyId), fullCompanySettings);
    // Initialize empty collections for this company
    set(getScopedKey('users', companyId), []);
    set(getScopedKey('attendance', companyId), []);
    set(getScopedKey('leaves', companyId), []);
    set(getScopedKey('announcements', companyId), []);
    set(getScopedKey('holidays', companyId), []);
    set(getScopedKey('activity_log', companyId), []);

    setActiveCompanyId(companyId);

    return fullCompanySettings;
  }

  // --- Company Settings (Scoped to Active Company) ---
  function getCompany(overrideCompanyId = null) {
    const key = getScopedKey('company', overrideCompanyId);
    return get(key, null);
  }

  function saveCompany(companyData, overrideCompanyId = null) {
    const cid = overrideCompanyId || getActiveCompanyId();
    const existing = getCompany(cid) || {};
    const updated = {
      ...existing,
      ...companyData,
      updatedAt: new Date().toISOString()
    };

    // Update in registry as well if name or code changed
    if (companyData.name || companyData.code) {
      const companies = getCompanies();
      const idx = companies.findIndex(c => String(c.id) === String(cid));
      if (idx >= 0) {
        if (companyData.name) companies[idx].name = companyData.name;
        if (companyData.code) companies[idx].code = companyData.code;
        set(GLOBAL_KEYS.COMPANIES, companies);
      }
    }

    return set(getScopedKey('company', cid), updated);
  }

  function isSetupCompleted() {
    const companies = getCompanies();
    return companies.length > 0;
  }

  // --- Users (Admin & Employees Scoped to Company) ---
  function getUsers(overrideCompanyId = null) {
    const key = getScopedKey('users', overrideCompanyId);
    return get(key, []);
  }

  function getUserById(id, overrideCompanyId = null) {
    const users = getUsers(overrideCompanyId);
    return users.find(u => String(u.id) === String(id)) || null;
  }

  function getUserByEmail(email, overrideCompanyId = null) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    const users = getUsers(overrideCompanyId);
    return users.find(u => u.email.trim().toLowerCase() === clean) || null;
  }

  // Find all accounts across all locally stored companies matching email
  function findAccountByEmail(email) {
    if (!email) return [];
    const clean = email.trim().toLowerCase();
    const matches = [];
    const companies = getCompanies();

    companies.forEach(comp => {
      const users = getUsers(comp.id);
      const user = users.find(u => (u.email || '').trim().toLowerCase() === clean);
      if (user) {
        matches.push({
          company: comp,
          user
        });
      }
    });

    return matches;
  }

  // Check if email exists in any company
  function getUserByEmailGlobal(email) {
    const matches = findAccountByEmail(email);
    return matches.length > 0 ? matches[0] : null;
  }

  function saveUser(user, overrideCompanyId = null) {
    const targetCompId = overrideCompanyId || getActiveCompanyId();
    const key = getScopedKey('users', targetCompId);
    const users = getUsers(targetCompId);
    const cleanEmail = (user.email || '').trim().toLowerCase();

    // Enforce unique login emails globally across all registered companies
    if (cleanEmail) {
      const existingMatch = getUserByEmailGlobal(cleanEmail);
      if (existingMatch && (existingMatch.company.id !== targetCompId || String(existingMatch.user.id) !== String(user.id))) {
        throw new Error('An account with this email address already exists.');
      }
    }

    const index = users.findIndex(u => String(u.id) === String(user.id));
    if (index >= 0) {
      users[index] = { ...users[index], ...user, updatedAt: new Date().toISOString() };
    } else {
      users.push({
        ...user,
        createdAt: new Date().toISOString()
      });
    }
    const success = set(key, users);
    if (!success) {
      throw new Error('Failed to save employee record to browser storage. Storage quota may be full.');
    }
    return true;
  }

  function deleteUser(id, overrideCompanyId = null) {
    const key = getScopedKey('users', overrideCompanyId);
    const users = getUsers(overrideCompanyId).filter(u => String(u.id) !== String(id));
    const success = set(key, users);
    if (!success) {
      throw new Error('Failed to remove employee record from browser storage.');
    }
    logActivity('Deleted Employee', `Removed employee account ID ${id}`, 'admin', '', overrideCompanyId);
    return true;
  }

  // Format local date string YYYY-MM-DD
  function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // --- Attendance (Scoped to Company) ---
  function getAttendance(overrideCompanyId = null) {
    const key = getScopedKey('attendance', overrideCompanyId);
    return get(key, []);
  }

  function getAttendanceForEmployee(empId, overrideCompanyId = null) {
    const all = getAttendance(overrideCompanyId);
    return all.filter(a => String(a.employeeId) === String(empId));
  }

  function getAttendanceForDate(dateStr, overrideCompanyId = null) {
    const all = getAttendance(overrideCompanyId);
    return all.filter(a => a.date === dateStr);
  }

  function getTodayAttendanceForEmployee(empId, overrideCompanyId = null) {
    const today = getLocalDateString();
    const records = getAttendanceForEmployee(empId, overrideCompanyId);
    return records.find(r => r.date === today) || null;
  }

  function saveAttendanceRecord(record, overrideCompanyId = null) {
    const key = getScopedKey('attendance', overrideCompanyId);
    const all = getAttendance(overrideCompanyId);
    const index = all.findIndex(r => String(r.id) === String(record.id) || (String(r.employeeId) === String(record.employeeId) && r.date === record.date));
    if (index >= 0) {
      all[index] = { ...all[index], ...record };
    } else {
      all.push({
        id: record.id || `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...record,
        createdAt: new Date().toISOString()
      });
    }
    return set(key, all);
  }

  // --- Leaves (Scoped to Company) ---
  function getLeaves(overrideCompanyId = null) {
    const key = getScopedKey('leaves', overrideCompanyId);
    return get(key, []);
  }

  function getLeavesForEmployee(empId, overrideCompanyId = null) {
    const all = getLeaves(overrideCompanyId);
    return all.filter(l => String(l.employeeId) === String(empId));
  }

  function saveLeaveRequest(leave, overrideCompanyId = null) {
    const key = getScopedKey('leaves', overrideCompanyId);
    const all = getLeaves(overrideCompanyId);
    const index = all.findIndex(l => String(l.id) === String(leave.id));
    if (index >= 0) {
      all[index] = { ...all[index], ...leave, updatedAt: new Date().toISOString() };
    } else {
      all.push({
        id: leave.id || `LV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...leave,
        createdAt: new Date().toISOString()
      });
    }
    return set(key, all);
  }

  // --- Session Management (Global) ---
  function getSession() {
    return get(GLOBAL_KEYS.SESSION, null);
  }

  function setSession(sessionData) {
    return set(GLOBAL_KEYS.SESSION, {
      ...sessionData,
      loginTime: new Date().toISOString()
    });
  }

  function clearSession() {
    return remove(GLOBAL_KEYS.SESSION);
  }

  // --- Announcements (Scoped to Company) ---
  function getAnnouncements(overrideCompanyId = null) {
    const key = getScopedKey('announcements', overrideCompanyId);
    return get(key, []);
  }

  function saveAnnouncement(announcement, overrideCompanyId = null) {
    const key = getScopedKey('announcements', overrideCompanyId);
    const all = getAnnouncements(overrideCompanyId);
    const item = {
      id: announcement.id || `ANN-${Date.now()}`,
      authorName: 'Management',
      priority: 'normal',
      date: getLocalDateString(),
      ...announcement,
      createdAt: announcement.createdAt || new Date().toISOString()
    };
    all.unshift(item);
    return set(key, all);
  }

  function deleteAnnouncement(id, overrideCompanyId = null) {
    const key = getScopedKey('announcements', overrideCompanyId);
    const filtered = getAnnouncements(overrideCompanyId).filter(a => String(a.id) !== String(id));
    return set(key, filtered);
  }

  // --- Holidays (Scoped to Company) ---
  function getHolidays(overrideCompanyId = null) {
    const key = getScopedKey('holidays', overrideCompanyId);
    return get(key, []);
  }

  function saveHoliday(holiday, overrideCompanyId = null) {
    const key = getScopedKey('holidays', overrideCompanyId);
    const all = getHolidays(overrideCompanyId);
    all.push({
      id: holiday.id || `HOL-${Date.now()}`,
      name: holiday.name,
      date: holiday.date
    });
    return set(key, all);
  }

  function deleteHoliday(id, overrideCompanyId = null) {
    const key = getScopedKey('holidays', overrideCompanyId);
    const filtered = getHolidays(overrideCompanyId).filter(h => String(h.id) !== String(id));
    return set(key, filtered);
  }

  // --- Preferences (Shared Theme) ---
  function getPreferences() {
    return get(GLOBAL_KEYS.PREFERENCES, { theme: 'light' });
  }

  function savePreferences(prefs) {
    const existing = getPreferences();
    return set(GLOBAL_KEYS.PREFERENCES, { ...existing, ...prefs });
  }

  // --- Activity Audit Log (Scoped to Company) ---
  function getActivityLog(overrideCompanyId = null) {
    const key = getScopedKey('activity_log', overrideCompanyId);
    return get(key, []);
  }

  function logActivity(action, details, actorRole = 'system', actorName = '', overrideCompanyId = null) {
    const key = getScopedKey('activity_log', overrideCompanyId);
    const all = getActivityLog(overrideCompanyId);
    const entry = {
      id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      details,
      actorRole,
      actorName,
      timestamp: new Date().toISOString()
    };
    all.unshift(entry);
    if (all.length > 100) all.length = 100;
    return set(key, all);
  }

  // --- Backup & Restore (Scoped or Full) ---
  function exportAllData(companyId = null) {
    const cid = companyId || getActiveCompanyId();
    const exportObj = {
      version: '2.0',
      workspaceType: 'multi-company',
      exportedAt: new Date().toISOString(),
      companyId: cid,
      company: getCompany(cid),
      users: getUsers(cid),
      attendance: getAttendance(cid),
      leaves: getLeaves(cid),
      announcements: getAnnouncements(cid),
      holidays: getHolidays(cid),
      preferences: getPreferences(),
      activityLog: getActivityLog(cid)
    };
    return JSON.stringify(exportObj, null, 2);
  }

  function importAllData(jsonString, targetCompanyId = null) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON format');
      }
      const cid = targetCompanyId || data.companyId || getActiveCompanyId();
      if (data.company) set(getScopedKey('company', cid), data.company);
      if (Array.isArray(data.users)) set(getScopedKey('users', cid), data.users);
      if (Array.isArray(data.attendance)) set(getScopedKey('attendance', cid), data.attendance);
      if (Array.isArray(data.leaves)) set(getScopedKey('leaves', cid), data.leaves);
      if (Array.isArray(data.announcements)) set(getScopedKey('announcements', cid), data.announcements);
      if (Array.isArray(data.holidays)) set(getScopedKey('holidays', cid), data.holidays);
      if (data.preferences) set(GLOBAL_KEYS.PREFERENCES, data.preferences);
      if (Array.isArray(data.activityLog)) set(getScopedKey('activity_log', cid), data.activityLog);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Wipe all HCM data (multi-company registry, scoped data, session)
  function clearAllData() {
    const keysToRemove = new Set();
    try {
      if (typeof Object.keys === 'function') {
        Object.keys(localStorage).forEach(k => {
          if (k && k.startsWith('hcm_')) keysToRemove.add(k);
        });
      }
    } catch (e) {}

    try {
      if (typeof localStorage.length === 'number') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('hcm_')) keysToRemove.add(k);
        }
      }
    } catch (e) {}

    keysToRemove.forEach(k => localStorage.removeItem(k));
    return true;
  }

  return {
    GLOBAL_KEYS,
    get,
    set,
    remove,
    getCompanies,
    getCompanySummary,
    getCompanyByCode,
    getCompanyByName,
    getActiveCompanyId,
    setActiveCompanyId,
    getScopedKey,
    createCompanyWorkspace,
    getCompany,
    saveCompany,
    isSetupCompleted,
    getUsers,
    getUserById,
    getUserByEmail,
    findAccountByEmail,
    getUserByEmailGlobal,
    saveUser,
    deleteUser,
    getLocalDateString,
    getAttendance,
    getAttendanceForEmployee,
    getAttendanceForDate,
    getTodayAttendanceForEmployee,
    saveAttendanceRecord,
    getLeaves,
    getLeavesForEmployee,
    saveLeaveRequest,
    getSession,
    setSession,
    clearSession,
    getAnnouncements,
    saveAnnouncement,
    deleteAnnouncement,
    getHolidays,
    saveHoliday,
    deleteHoliday,
    getPreferences,
    savePreferences,
    getActivityLog,
    logActivity,
    exportAllData,
    importAllData,
    clearAllData
  };
})();
