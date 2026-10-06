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

  const container = document.getElementById('selectedWorkerDetails');
  if (!container) return;

  if (workersList.length === 0) {
    container.innerHTML = '<div class="empty-worker">No workers added yet</div>';
    return;
  }

  let html = '';

  workersList.forEach(worker => {

    const totalHours = getWorkerTotalHours(worker);

    html += `
      <div class="worker-section">

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h4 style="margin: 0;">${worker.name}</h4>
          <span style="color: #f1c40f; font-weight: bold;">Total: ${formatHours(totalHours)}</span>
        </div>
    `;

    if (!worker.attendance || worker.attendance.length === 0) {

      html += `<div class="empty-worker">No attendance records yet</div>`;

    } else {

      worker.attendance.forEach(record => {

        let hours = 0;

        if (record.checkIn && record.checkOut) {
          hours = Number(record.hours || calculateWorkedHours(record.checkIn, record.checkOut));
        } else if (record.checkIn) {
          hours = calculateWorkedHours(record.checkIn, getCurrentTime());
        }

        const statusText = record.checkOut ? 'Completed' : 'Working';
        const statusColor = record.checkOut ? '#2ecc71' : '#f1c40f';

        html += `
          <div class="attendance-row">

            <span><strong>${record.date}</strong></span>

            <span>
              ${record.checkIn ? 'In: ' + record.checkIn : '-'}
              ${record.checkOut ? ' | Out: ' + record.checkOut : ' | Working'}
            </span>

            <strong style="color: #f1c40f;">${formatHours(hours)}</strong>

            <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>

          </div>
        `;
      });
    }

    html += `</div>`;
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
