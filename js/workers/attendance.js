/* =========================================================
   TUX POS — ATTENDANCE
   Hours calculation and attendance history.
   ========================================================= */

function getWorkerHoursForToday(worker) {

  const today = getTodayKey();

  if (!worker || !worker.attendance) return 0;

  let total = 0;

  worker.attendance
    .filter(record => record.date === today)
    .forEach(record => {

      if (record.checkIn && record.checkOut) {
        total += Number(record.hours || calculateWorkedHours(record.checkIn, record.checkOut));
      } else if (record.checkIn) {
        total += calculateWorkedHours(record.checkIn, getCurrentTime());
      }
    });

  return total;
}

function getWorkerTotalHours(worker) {

  if (!worker || !worker.attendance) return 0;

  return worker.attendance.reduce((total, record) => {

    if (!record.checkIn) return total;

    if (record.checkOut) {
      return total + Number(record.hours || calculateWorkedHours(record.checkIn, record.checkOut));
    }

    return total + calculateWorkedHours(record.checkIn, getCurrentTime());

  }, 0);
}


function renderSelectedWorker() {

  const container = document.getElementById(
    'selectedWorkerDetails'
  );

  if (!container) return;

  if (!Array.isArray(workersList) || workersList.length === 0) {
    container.innerHTML =
      '<div class="empty-worker">No workers added yet</div>';
    return;
  }

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

    if (Number.isNaN(date.getTime())) return value || '—';

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);

  }

  let html = '';

  workersList.forEach(worker => {

    const totalHours = getWorkerTotalHours(worker);

    const attendance = Array.isArray(worker.attendance)
      ? worker.attendance
      : [];

    html += `
      <div class="worker-section">

        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        ">
          <h4 style="margin: 0;">
            ${worker.name}
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

    } else {

      html += `
        <div style="
          width: 100%;
          overflow-x: auto;
        ">

          <div style="
            min-width: 620px;
          ">

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

              let hours = 0;

              if (record.checkIn && record.checkOut) {

                hours = Number(
                  record.hours ||
                  calculateWorkedHours(
                    record.checkIn,
                    record.checkOut
                  )
                );

              } else if (record.checkIn) {

                hours = calculateWorkedHours(
                  record.checkIn,
                  getCurrentTime()
                );

              }

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
                    ${formatAttendanceDate(
                      record.date,
                      record.checkIn
                    )}
                  </span>

                  <span>
                    ${formatAttendanceTime(record.checkIn)}
                  </span>

                  <span>
                    ${formatAttendanceTime(record.checkOut)}
                  </span>

                  <strong style="color: #f1c40f;">
                    ${formatHours(hours)}
                  </strong>

                  <strong style="
                    color: ${statusColor};
                  ">
                    ${statusText}
                  </strong>

                </div>
              `;

            }).join('')}

          </div>
        </div>
      `;

    }

    html += '</div>';

  });

  container.innerHTML = html;

}
function resetAttendanceHistory() {

  if (getActiveRole() !== 'tuxadmin') {
    alert('Only Tux Admin can reset the attendance history.');
    return;
  }

  if (!confirm('Delete ALL workers attendance history?\n\nWorkers who are logged in right now will keep their current session.')) return;

  workersList.forEach(function (w) {
    w.attendance = (w.attendance || []).filter(function (r) {
      return r.checkIn && !r.checkOut && isStaffLoggedIn(w.id);
    });
  });

  saveWorkersToStorage();
  renderWorkersView();

  alert('Attendance history was reset.');
}
