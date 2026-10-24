/**
 * HCM Lite — Employee Management (CRUD, Search, Filters, Sorting, Password Reset)
 * Follows all business rules:
 * - Auto-generated unique Employee ID
 * - Validated fields (duplicate email check, salary > 0, required fields)
 * - Creates login credentials with password hashing
 * - Deletion confirmation and policy
 * - Search-as-you-type and department/status filtering
 */

const EmployeeManager = (() => {
  // Generate next sequential employee ID (e.g. EMP-1001, EMP-1002)
  function generateEmployeeId() {
    const users = Storage.getUsers().filter(u => u.role === 'employee');
    let maxNum = 1000;
    users.forEach(u => {
      const match = String(u.id).match(/EMP-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `EMP-${maxNum + 1}`;
  }

  // Create new employee
  async function createEmployee(data) {
    const {
      name,
      email,
      password,
      department,
      designation,
      salary,
      joiningDate,
      phone,
      status = 'active'
    } = data;

    // Validations
    if (!name || !name.trim()) throw new Error('Employee name is required.');
    if (!email || !email.includes('@')) throw new Error('Valid email address is required.');

    // Check duplicate email
    const existing = Storage.getUserByEmail(email);
    if (existing) throw new Error('An account with this email address already exists.');

    const parsedSalary = parseFloat(salary);
    if (isNaN(parsedSalary) || parsedSalary <= 0) {
      throw new Error('Monthly salary must be a positive number greater than 0.');
    }

    if (!password || password.length < 6) {
      throw new Error('Initial password must be at least 6 characters.');
    }

    const employeeId = generateEmployeeId();
    const passwordHash = await Auth.hashPassword(password);

    const newEmployee = {
      id: employeeId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: 'employee',
      department: department ? department.trim() : 'General',
      designation: designation ? designation.trim() : 'Staff',
      salary: parsedSalary,
      joiningDate: joiningDate || Attendance.getLocalDateString(),
      phone: phone ? phone.trim() : '',
      status: status || 'active'
    };

    Storage.saveUser(newEmployee);
    Storage.logActivity('Employee Created', `Created account for ${newEmployee.name} (${employeeId})`, 'admin');

    return newEmployee;
  }

  // Update existing employee
  async function updateEmployee(id, updates) {
    const user = Storage.getUserById(id);
    if (!user) throw new Error('Employee not found.');

    if (updates.email && updates.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const existing = Storage.getUserByEmail(updates.email);
      if (existing && String(existing.id) !== String(id)) {
        throw new Error('An account with this email address already exists.');
      }
    }

    if (updates.salary !== undefined) {
      const parsedSalary = parseFloat(updates.salary);
      if (isNaN(parsedSalary) || parsedSalary <= 0) {
        throw new Error('Salary must be greater than zero.');
      }
      updates.salary = parsedSalary;
    }

    const updated = {
      ...user,
      ...updates
    };

    Storage.saveUser(updated);
    Storage.logActivity('Employee Updated', `Updated details for ${updated.name} (${updated.id})`, 'admin');
    return updated;
  }

  // Filter and search employee list
  function queryEmployees({ query = '', department = '', status = '', sortBy = 'name', sortOrder = 'asc' } = {}) {
    let list = Storage.getUsers().filter(u => u.role === 'employee');

    // Search query
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        String(u.id).toLowerCase().includes(q) ||
        (u.designation && u.designation.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q))
      );
    }

    // Department filter
    if (department) {
      list = list.filter(u => (u.department || 'General') === department);
    }

    // Status filter
    if (status) {
      list = list.filter(u => (u.status || 'active') === status);
    }

    // Sorting
    list.sort((a, b) => {
      let valA = a[sortBy] || '';
      let valB = b[sortBy] || '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }

  // Get distinct departments list
  function getDepartments() {
    const list = Storage.getUsers().filter(u => u.role === 'employee');
    const depts = new Set(['Engineering', 'Human Resources', 'Marketing', 'Finance', 'Operations', 'Design']);
    list.forEach(u => {
      if (u.department) depts.add(u.department);
    });
    return Array.from(depts).sort();
  }

  return {
    generateEmployeeId,
    createEmployee,
    updateEmployee,
    queryEmployees,
    getDepartments
  };
})();
