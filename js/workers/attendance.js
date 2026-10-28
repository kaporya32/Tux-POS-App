
/* =========================================================
   TUX POS — ATTENDANCE
   Hours calculation and attendance history.
   ========================================================= */

/* =========================================================
   WORKER HOURS
   ========================================================= */

function getWorkerHoursForToday(worker) {
  const today = getTodayKey();

  if (!worker || !Array.isArray(worker.attendance)) {
    return 0;
  }

  let total = 0;

  worker.attendance
    .filter(record => record.date === today)
    .forEach(record => {
      if (record.checkIn && record.checkOut) {
        total += Number(
          record.hours ||
          calculateWorkedHours(record.checkIn, record.checkOut)
        );
      } else if (record.checkIn) {
        total += calculateWorkedHours(
          record.checkIn,
          getCurrentTime()
        );
      }
    });

  return total;
}

function getWorkerTotalHours(worker) {
  if (!worker || !Array.isArray(worker.attendance)) {
    return 0;
  }

  return worker.attendance.reduce((total, record) => {
    if (!record.checkIn) return total;

    if (record.checkOut) {
      return total + Number(
        record.hours ||
        calculateWorkedHours(record.checkIn, record.checkOut)
      );
    }

    return total + calculateWorkedHours(
      record.checkIn,
      getCurrentTime()
    );
  }, 0);
}

/* =========================================================
   ATTENDANCE FORMATTING
   ========================================================= */

function formatAttendanceTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

function formatAttendanceDate(value, checkIn) {
  const date = value
    ? new Date(value + 'T12:00:00')
    : new Date(checkIn);

  if (Number.isNaN(date.getTime())) {
    return value || '—';
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function getAttendanceRecordHours(record) {
  if (!record || !record.checkIn) return 0;

  if (record.checkOut) {
    return Number(
      record.hours ||
      calculateWorkedHours(record.checkIn, record.checkOut)
    );
  }

  return calculateWorkedHours(
    record.checkIn,
    getCurrentTime()
  );
}

/* =========================================================
   ATTENDANCE HISTORY SECTION
   ========================================================= */

function renderAttendanceHistorySection(person, title) {
  const attendance = Array.isArray(person.attendance)
    ? person.attendance
    : [];

  const totalHours = getWorkerTotalHours(person);

  let html = `
    <div class="worker-section">
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      ">
        <h4 style="margin: 0;">
          ${escapeHtmlPw(title)}
        </h4>

        <span style="
          color: #f1c40f;
          font-weight: bold;
        ">
          Total: ${formatHours(totalHours)}
        </span>
      </div>
  `;

  if (attendance.length === 0) {
    html += `
      <div class="empty-worker">
        No attendance records yet
      </div>
    `;

    html += '</div>';
    return html;
  }

  html += `
    <div style="width: 100%; overflow-x: auto;">
      <div style="min-width: 620px;">

        <div style="
          display: grid;
          grid-template-columns: 1.1fr 1fr 1fr 1fr 0.9fr;
          gap: 10px;
          padding: 10px;
          background: #252525;
          border-radius: 6px;
          font-weight: bold;
          color: #f1c40f;
        ">
          <span>Date</span>
          <span>Sign In</span>
          <span>Sign Out</span>
          <span>Total Hours</span>
          <span>Status</span>
        </div>

        ${attendance.map(record => {
          const isCompleted = Boolean(record.checkOut);
          const hours = getAttendanceRecordHours(record);

          const statusText = isCompleted
            ? 'Completed'
            : 'Working';

          const statusColor = isCompleted
            ? '#2ecc71'
            : '#f1c40f';

          return `
            <div style="
              display: grid;
              grid-template-columns: 1.1fr 1fr 1fr 1fr 0.9fr;
              gap: 10px;
              padding: 12px 10px;
              border-bottom: 1px solid #383838;
              align-items: center;
            ">
              <span>
                ${escapeHtmlPw(
                  formatAttendanceDate(record.date, record.checkIn)
                )}
              </span>

              <span>
                ${escapeHtmlPw(formatAttendanceTime(record.checkIn))}
              </span>

              <span>
                ${escapeHtmlPw(formatAttendanceTime(record.checkOut))}
              </span>

              <strong style="color: #f1c40f;">
                ${formatHours(hours)}
              </strong>

              <strong style="color: ${statusColor};">
                ${statusText}
              </strong>
            </div>
          `;
        }).join('')}

      </div>
    </div>
  `;

  html += '</div>';

  return html;
}

/* =========================================================
   RENDER ADMIN AND WORKER ATTENDANCE HISTORY
   ========================================================= */



function renderSelectedWorker() {
  const container = document.getElementById(
    'selectedWorkerDetails'
  );

  if (!container) return;

  let html = '';

  const accounts = Array.isArray(workersList)
    ? workersList
    : [];

  /*
   * ADMIN ATTENDANCE
   *
   * Admin accounts are stored in workersList too,
   * but their attendance is displayed separately.
   */
  const adminAccounts = accounts.filter(function (account) {
    return account && account.role === 'admin';
  });

  if (adminAccounts.length > 0) {
    adminAccounts.forEach(function (admin) {
      html += renderAttendanceHistorySection(
        {
          id: admin.id,
          name: admin.name || 'Admin',
          attendance: Array.isArray(admin.attendance)
            ? admin.attendance
            : []
        },
        'Admin Attendance — ' + (admin.name || 'Admin')
      );
    });
  } else if (
    typeof adminAccount !== 'undefined' &&
    adminAccount
  ) {
    // Preserve compatibility with the older adminAccount object.
    html += renderAttendanceHistorySection(
      {
        name: adminAccount.name || 'Admin',
        attendance: Array.isArray(adminAccount.attendance)
          ? adminAccount.attendance
          : []
      },
      'Admin Attendance'
    );
  }

  /*
   * WORKER ATTENDANCE HISTORY
   *
   * Only worker accounts appear in this section.
   */
  const workers = accounts.filter(function (account) {
    return (
      account &&
      account.role === 'worker'
    );
  });

  if (workers.length === 0) {
    html += `
      <div class="empty-worker">
        No workers added yet
      </div>
    `;
  } else {
    workers.forEach(function (worker) {
      html += renderAttendanceHistorySection(
        worker,
        worker.name || 'Worker'
      );
    });
  }

  container.innerHTML = html;
}



/* =========================================================
   RESET COMPLETED ATTENDANCE HISTORY
   TUX ADMIN ONLY
   ========================================================= */

async function resetAttendanceHistory() {
  if (
    typeof getActiveRole !== 'function' ||
    getActiveRole() !== 'tuxadmin'
  ) {
    alert('Only Tux Admin can reset attendance history.');
    return;
  }

  const confirmed = window.confirm(
    'RESET ATTENDANCE HISTORY?\n\n' +
    'All completed attendance records will be deleted.\n' +
    'Worker accounts will remain unchanged.\n' +
    'Workers currently working will keep their active sessions.\n\n' +
    'This action cannot be undone. Continue?'
  );

  if (!confirmed) return;

  const button = document.getElementById('attendanceResetBtn');

  if (button) {
    button.disabled = true;
    button.textContent = 'Resetting...';
  }

  try {
    const { error } = await supabaseClient
      .from('attendance')
      .delete()
      .or('check_out.not.is.null,status.eq.completed');

    if (error) {
      throw error;
    }

    await loadAllAttendance();

    if (typeof renderWorkersView === 'function') {
      await renderWorkersView();
    }

    renderSelectedWorker();

    window.dispatchEvent(
      new CustomEvent('tux-attendance-updated')
    );

    alert('Completed attendance history has been reset.');
  } catch (error) {
    console.error(
      'TUX POS — Attendance reset failed:',
      error
    );

    alert(
      'Failed to reset attendance history.\n\n' +
      (error.message ||
        'Check the console and Supabase permissions.')
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '♻ Reset Attendance History';
    }     
  }
}
