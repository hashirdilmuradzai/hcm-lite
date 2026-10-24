/**
 * HCM Lite — Payroll Calculation Module
 * Strict adherence to official hackathon formula:
 * - Per-day salary = Monthly Salary / Working Days in Month
 * - Deduction = Per-Day Salary * (Absent Days + 0.5 * Half Days)
 * - Net Salary = Monthly Salary - Deduction
 * Rules:
 * - Approved leave is authorized paid leave (no deduction)
 * - Late alone has no salary deduction
 * - Dynamic working day calculation based on Admin settings and holidays
 */

const Payroll = (() => {
  // Format currency with commas
  function formatCurrency(amount, currency = 'PKR') {
    if (isNaN(amount)) return `${currency} 0.00`;
    return `${currency} ${Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  // Calculate monthly payslip for an employee for specified year and month
  function calculateMonthlyPayslip(employeeId, year, month) {
    const employee = Storage.getUserById(employeeId);
    if (!employee) throw new Error('Employee not found');

    const monthlySalary = parseFloat(employee.salary) || 0;
    const attendanceStats = Attendance.getEmployeeMonthlyAttendance(employeeId, year, month);

    if (!attendanceStats) {
      throw new Error('Unable to compute attendance statistics for employee.');
    }

    const {
      workingDaysInMonth,
      presentDays,
      lateDays,
      halfDays,
      absentDays,
      approvedLeaveDays,
      totalWorkedHours
    } = attendanceStats;

    // Per-day salary formula
    // If working days in month is 0, avoid division by zero
    const perDaySalary = workingDaysInMonth > 0 ? (monthlySalary / workingDaysInMonth) : 0;

    // Absence and half-day deductions
    const absentDeduction = perDaySalary * absentDays;
    const halfDayDeduction = perDaySalary * (0.5 * halfDays);
    const totalDeductions = absentDeduction + halfDayDeduction;

    // Net payable salary formula
    const netSalary = Math.max(0, monthlySalary - totalDeductions);

    // Get month name
    const monthDate = new Date(year, month - 1, 1);
    const monthName = monthDate.toLocaleString('default', { month: 'long' });

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      employeeEmail: employee.email,
      department: employee.department || 'General',
      designation: employee.designation || 'Staff',
      joiningDate: employee.joiningDate || 'N/A',
      year,
      month,
      monthName,
      monthlySalary,
      workingDaysInMonth,
      presentDays,
      lateDays,
      halfDays,
      absentDays,
      approvedLeaveDays,
      totalWorkedHours,
      perDaySalary: Math.round(perDaySalary * 100) / 100,
      absentDeduction: Math.round(absentDeduction * 100) / 100,
      halfDayDeduction: Math.round(halfDayDeduction * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      netSalary: Math.round(netSalary * 100) / 100
    };
  }

  // Calculate total monthly payroll for all employees (used by Admin Smart Helper and dashboard)
  function calculateTotalMonthlyPayroll(year, month) {
    const employees = Storage.getUsers().filter(u => u.role === 'employee' && u.status !== 'inactive');
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    employees.forEach(emp => {
      try {
        const slip = calculateMonthlyPayslip(emp.id, year, month);
        totalGross += slip.monthlySalary;
        totalDeductions += slip.totalDeductions;
        totalNet += slip.netSalary;
      } catch (e) {
        console.error(`Payroll error for ${emp.id}:`, e);
      }
    });

    return {
      employeeCount: employees.length,
      year,
      month,
      totalGross: Math.round(totalGross * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100
    };
  }

  return {
    formatCurrency,
    calculateMonthlyPayslip,
    calculateTotalMonthlyPayroll
  };
})();
