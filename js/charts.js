/**
 * HCM Lite — Analytics & Charts Module (Bonus Feature C)
 * Chart.js CDN powered charts using actual saved application records
 * Theme-aware colors (dark / light mode adaptive)
 * Clean empty states when records are zero
 */

const AnalyticsCharts = (() => {
  const chartInstances = {};

  // Get current theme-aware colors
  function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      textColor: isDark ? '#94A3B8' : '#64748B',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#1E293B' : '#0F172A',
      tooltipText: '#F8FAFC'
    };
  }

  function destroyChart(canvasId) {
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }
  }

  // 1. Today Attendance Distribution (Doughnut)
  function renderTodayDistribution(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    destroyChart(canvasId);

    const stats = Attendance.getTodayStats();
    const colors = getThemeColors();

    const emptyContainer = canvas.parentElement.querySelector('.chart-empty-state');

    if (stats.totalEmployees === 0) {
      canvas.style.display = 'none';
      if (emptyContainer) emptyContainer.style.display = 'flex';
      return;
    } else {
      canvas.style.display = 'block';
      if (emptyContainer) emptyContainer.style.display = 'none';
    }

    const dataValues = [
      stats.presentToday - stats.lateToday,
      stats.lateToday,
      stats.onLeaveToday,
      stats.absentToday
    ];

    // If all are zero (e.g. non-working day and no one checked in), display empty
    const totalCount = dataValues.reduce((a, b) => a + b, 0);
    if (totalCount === 0) {
      canvas.style.display = 'none';
      if (emptyContainer) emptyContainer.style.display = 'flex';
      return;
    }

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['On Time', 'Late', 'On Leave', 'Absent'],
        datasets: [{
          data: dataValues,
          backgroundColor: [
            '#0D9488', // Teal on time
            '#D97706', // Amber late
            '#7C3AED', // Purple leave
            '#DC2626'  // Red absent
          ],
          borderWidth: 2,
          borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#131D31' : '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              color: colors.textColor,
              font: { family: 'Inter', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 10,
            cornerRadius: 8
          }
        },
        cutout: '68%'
      }
    });
  }

  // 2. Department Attendance (Bar Chart)
  function renderDepartmentAttendance(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    destroyChart(canvasId);

    const employees = Storage.getUsers().filter(u => u.role === 'employee' && u.status !== 'inactive');
    const todayStr = Attendance.getLocalDateString();
    const todayAtt = Storage.getAttendanceForDate(todayStr);
    const colors = getThemeColors();

    const emptyContainer = canvas.parentElement.querySelector('.chart-empty-state');

    if (employees.length === 0) {
      canvas.style.display = 'none';
      if (emptyContainer) emptyContainer.style.display = 'flex';
      return;
    } else {
      canvas.style.display = 'block';
      if (emptyContainer) emptyContainer.style.display = 'none';
    }

    // Tally by department
    const deptTotals = {};
    const deptPresent = {};

    employees.forEach(emp => {
      const d = emp.department || 'General';
      deptTotals[d] = (deptTotals[d] || 0) + 1;
      deptPresent[d] = deptPresent[d] || 0;
    });

    todayAtt.forEach(a => {
      const emp = Storage.getUserById(a.employeeId);
      if (emp) {
        const d = emp.department || 'General';
        deptPresent[d] = (deptPresent[d] || 0) + 1;
      }
    });

    const labels = Object.keys(deptTotals);
    const presentData = labels.map(l => deptPresent[l] || 0);
    const totalData = labels.map(l => deptTotals[l] || 0);

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Present Today',
            data: presentData,
            backgroundColor: '#2563EB',
            borderRadius: 4
          },
          {
            label: 'Total Headcount',
            data: totalData,
            backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#22324F' : '#E2E8F0',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              color: colors.textColor,
              font: { family: 'Inter', size: 12 }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.textColor }
          },
          y: {
            beginAtZero: true,
            grid: { color: colors.gridColor },
            ticks: {
              stepSize: 1,
              color: colors.textColor
            }
          }
        }
      }
    });
  }

  // 3. Monthly Attendance Trend (Line Chart - Past 14 Days)
  function renderMonthlyTrend(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    destroyChart(canvasId);

    const colors = getThemeColors();
    const attendance = Storage.getAttendance();
    const emptyContainer = canvas.parentElement.querySelector('.chart-empty-state');

    if (attendance.length === 0) {
      canvas.style.display = 'none';
      if (emptyContainer) emptyContainer.style.display = 'flex';
      return;
    } else {
      canvas.style.display = 'block';
      if (emptyContainer) emptyContainer.style.display = 'none';
    }

    // Generate last 14 days dates
    const labels = [];
    const counts = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = Attendance.getLocalDateString(d);
      labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      const dayRecords = attendance.filter(a => a.date === dateStr);
      counts.push(dayRecords.length);
    }

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Check-ins',
          data: counts,
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#2563EB',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.textColor }
          },
          y: {
            beginAtZero: true,
            grid: { color: colors.gridColor },
            ticks: {
              stepSize: 1,
              color: colors.textColor
            }
          }
        }
      }
    });
  }

  // 4. Leave Types Distribution (Pie Chart)
  function renderLeaveTypeDistribution(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    destroyChart(canvasId);

    const leaves = Storage.getLeaves().filter(l => l.status === 'Approved');
    const colors = getThemeColors();
    const emptyContainer = canvas.parentElement.querySelector('.chart-empty-state');

    let casualDays = 0;
    let sickDays = 0;

    leaves.forEach(l => {
      if (l.type === 'Casual') casualDays += (l.days || 0);
      else if (l.type === 'Sick') sickDays += (l.days || 0);
    });

    if (casualDays + sickDays === 0) {
      canvas.style.display = 'none';
      if (emptyContainer) emptyContainer.style.display = 'flex';
      return;
    } else {
      canvas.style.display = 'block';
      if (emptyContainer) emptyContainer.style.display = 'none';
    }

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: ['Casual Leave', 'Sick Leave'],
        datasets: [{
          data: [casualDays, sickDays],
          backgroundColor: ['#0284C7', '#D97706'],
          borderWidth: 2,
          borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#131D31' : '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              color: colors.textColor,
              font: { family: 'Inter', size: 12 }
            }
          }
        }
      }
    });
  }

  return {
    renderTodayDistribution,
    renderDepartmentAttendance,
    renderMonthlyTrend,
    renderLeaveTypeDistribution,
    destroyChart
  };
})();
