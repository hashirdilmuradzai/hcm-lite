/**
 * HCM Lite — LocalStorage Data Access Layer
 * Strict adherence to the official hackathon keys:
 * - hcm_company
 * - hcm_users
 * - hcm_attendance
 * - hcm_leaves
 * - hcm_session
 * Bonus keys:
 * - hcm_announcements
 * - hcm_holidays
 * - hcm_preferences
 * - hcm_activity_log
 */

const Storage = (() => {
  const KEYS = {
    COMPANY: 'hcm_company',
    USERS: 'hcm_users',
    ATTENDANCE: 'hcm_attendance',
    LEAVES: 'hcm_leaves',
    SESSION: 'hcm_session',
    ANNOUNCEMENTS: 'hcm_announcements',
    HOLIDAYS: 'hcm_holidays',
    PREFERENCES: 'hcm_preferences',
    ACTIVITY_LOG: 'hcm_activity_log'
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
      window.dispatchEvent(new CustomEvent('hcm_storage_change', { detail: { key, value } }));
      return true;
    } catch (e) {
      console.error(`[Storage] Error writing key "${key}":`, e);
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      window.dispatchEvent(new CustomEvent('hcm_storage_change', { detail: { key, value: null } }));
      return true;
    } catch (e) {
      console.error(`[Storage] Error removing key "${key}":`, e);
      return false;
    }
  }

  // --- Company Settings ---
  function getCompany() {
    return get(KEYS.COMPANY, null);
  }

  function saveCompany(companyData) {
    const existing = getCompany() || {};
    const updated = {
      ...existing,
      ...companyData,
      updatedAt: new Date().toISOString()
    };
    return set(KEYS.COMPANY, updated);
  }

  function isSetupCompleted() {
    const company = getCompany();
    const users = getUsers();
    return !!(company && company.name && users.some(u => u.role === 'admin'));
  }

  // --- Users (Admin & Employees) ---
  function getUsers() {
    return get(KEYS.USERS, []);
  }

  function getUserById(id) {
    const users = getUsers();
    return users.find(u => String(u.id) === String(id)) || null;
  }

  function getUserByEmail(email) {
    if (!email) return null;
    const users = getUsers();
    return users.find(u => u.email.trim().toLowerCase() === email.trim().toLowerCase()) || null;
  }

  function saveUser(user) {
    const users = getUsers();
    const index = users.findIndex(u => String(u.id) === String(user.id));
    if (index >= 0) {
      users[index] = { ...users[index], ...user, updatedAt: new Date().toISOString() };
    } else {
      users.push({
        ...user,
        createdAt: new Date().toISOString()
      });
    }
    return set(KEYS.USERS, users);
  }

  function deleteUser(id) {
    const users = getUsers().filter(u => String(u.id) !== String(id));
    set(KEYS.USERS, users);
    // Deletion policy: We keep attendance and leave history tagged to the deleted employee ID
    // for audit, or optionally tag them as inactive. As per business rule, we mark user inactive or remove
    // while keeping records intact.
    logActivity('Deleted Employee', `Removed employee account ID ${id}`, 'admin');
    return true;
  }

  // --- Attendance ---
  function getAttendance() {
    return get(KEYS.ATTENDANCE, []);
  }

  function getAttendanceForEmployee(empId) {
    const all = getAttendance();
    return all.filter(a => String(a.employeeId) === String(empId));
  }

  function getAttendanceForDate(dateStr) {
    const all = getAttendance();
    return all.filter(a => a.date === dateStr);
  }

  // Format local date string YYYY-MM-DD (consistent across timezones)
  function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getTodayAttendanceForEmployee(empId) {
    const today = getLocalDateString();
    const records = getAttendanceForEmployee(empId);
    return records.find(r => r.date === today) || null;
  }

  function saveAttendanceRecord(record) {
    const all = getAttendance();
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
    return set(KEYS.ATTENDANCE, all);
  }

  // --- Leaves ---
  function getLeaves() {
    return get(KEYS.LEAVES, []);
  }

  function getLeavesForEmployee(empId) {
    const all = getLeaves();
    return all.filter(l => String(l.employeeId) === String(empId));
  }

  function saveLeaveRequest(leave) {
    const all = getLeaves();
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
    return set(KEYS.LEAVES, all);
  }

  // --- Session Management ---
  function getSession() {
    return get(KEYS.SESSION, null);
  }

  function setSession(sessionData) {
    return set(KEYS.SESSION, {
      ...sessionData,
      loginTime: new Date().toISOString()
    });
  }

  function clearSession() {
    return remove(KEYS.SESSION);
  }

  // --- Announcements ---
  function getAnnouncements() {
    return get(KEYS.ANNOUNCEMENTS, []);
  }

  function saveAnnouncement(announcement) {
    const all = getAnnouncements();
    const item = {
      id: announcement.id || `ANN-${Date.now()}`,
      title: announcement.title,
      content: announcement.content,
      authorName: announcement.authorName || 'Management',
      priority: announcement.priority || 'normal',
      date: getLocalDateString(),
      createdAt: new Date().toISOString()
    };
    all.unshift(item);
    return set(KEYS.ANNOUNCEMENTS, all);
  }

  function deleteAnnouncement(id) {
    const filtered = getAnnouncements().filter(a => String(a.id) !== String(id));
    return set(KEYS.ANNOUNCEMENTS, filtered);
  }

  // --- Holidays ---
  function getHolidays() {
    return get(KEYS.HOLIDAYS, []);
  }

  function saveHoliday(holiday) {
    const all = getHolidays();
    all.push({
      id: holiday.id || `HOL-${Date.now()}`,
      name: holiday.name,
      date: holiday.date
    });
    return set(KEYS.HOLIDAYS, all);
  }

  function deleteHoliday(id) {
    const filtered = getHolidays().filter(h => String(h.id) !== String(id));
    return set(KEYS.HOLIDAYS, filtered);
  }

  // --- Preferences (Dark Mode, etc.) ---
  function getPreferences() {
    return get(KEYS.PREFERENCES, { theme: 'light' });
  }

  function savePreferences(prefs) {
    const existing = getPreferences();
    return set(KEYS.PREFERENCES, { ...existing, ...prefs });
  }

  // --- Activity Audit Log ---
  function getActivityLog() {
    return get(KEYS.ACTIVITY_LOG, []);
  }

  function logActivity(action, details, actorRole = 'system', actorName = '') {
    const all = getActivityLog();
    const entry = {
      id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      details,
      actorRole,
      actorName,
      timestamp: new Date().toISOString()
    };
    all.unshift(entry);
    // Keep max 100 items
    if (all.length > 100) all.length = 100;
    return set(KEYS.ACTIVITY_LOG, all);
  }

  // --- Backup & Restore ---
  function exportAllData() {
    const exportObj = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      company: getCompany(),
      users: getUsers(),
      attendance: getAttendance(),
      leaves: getLeaves(),
      announcements: getAnnouncements(),
      holidays: getHolidays(),
      preferences: getPreferences(),
      activityLog: getActivityLog()
    };
    return JSON.stringify(exportObj, null, 2);
  }

  function importAllData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON format');
      }
      if (data.company) set(KEYS.COMPANY, data.company);
      if (Array.isArray(data.users)) set(KEYS.USERS, data.users);
      if (Array.isArray(data.attendance)) set(KEYS.ATTENDANCE, data.attendance);
      if (Array.isArray(data.leaves)) set(KEYS.LEAVES, data.leaves);
      if (Array.isArray(data.announcements)) set(KEYS.ANNOUNCEMENTS, data.announcements);
      if (Array.isArray(data.holidays)) set(KEYS.HOLIDAYS, data.holidays);
      if (data.preferences) set(KEYS.PREFERENCES, data.preferences);
      if (Array.isArray(data.activityLog)) set(KEYS.ACTIVITY_LOG, data.activityLog);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  function clearAllData() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    return true;
  }

  return {
    KEYS,
    get,
    set,
    remove,
    getCompany,
    saveCompany,
    isSetupCompleted,
    getUsers,
    getUserById,
    getUserByEmail,
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
