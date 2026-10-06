/* =========================================================
   TUX POS — WORKERS PAGE
   Supabase workers + existing admin management
   ========================================================= */


/* =========================================================
   ADD WORKER
   ========================================================= */

async function addWorker() {

  if (getActiveRole() === 'admin') {
    alert('View only - Admin cannot edit.');
    return;
  }

  const nameInput = document.getElementById('workerName');
  const passwordInput = document.getElementById('workerPassword');

  const name = nameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!name) {
    alert('Please enter worker name.');
    return;
  }

  if (!password) {
    alert('Please enter worker password.');
    return;
  }


  /* ---------- CHECK NAME ---------- */

  const duplicateName = workersList.some(function (worker) {

    return worker.name.toLowerCase() === name.toLowerCase();

  });

  if (duplicateName) {
    alert('This worker already exists.');
    return;
  }


  /* ---------- CHECK PASSWORD ---------- */

  const duplicatePassword = isPasswordTaken(
    password,
    null
  );

  if (duplicatePassword) {
    alert(duplicatePassword);
    return;
  }


  /* ---------- CREATE IN SUPABASE ---------- */

  try {

    await addWorkerToSupabase(
      name,
      password,
      'worker'
    );

    nameInput.value = '';
    passwordInput.value = '';

    renderWorkersView();

    alert(
      'Worker ' + name + ' added successfully!'
    );

  } catch (error) {

    console.error(
      'Add worker failed:',
      error
    );

    alert(
      'Could not add worker.\n\n' +
      (error.message || 'Unknown error')
    );

  }

}


/* =========================================================
   CHANGE WORKER PASSWORD
   ========================================================= */

async function changeWorkerPassword(workerId) {

  if (getActiveRole() === 'admin') {
    alert('View only - Admin cannot edit.');
    return;
  }

  const worker = getWorkerById(workerId);

  if (!worker) {
    alert('Worker not found.');
    return;
  }


  const newPassword = prompt(
    'Enter new password for ' +
    worker.name +
    ':'
  );

  if (newPassword === null) {
    return;
  }

  const password = newPassword.trim();

  if (!password) {
    alert('Password cannot be empty.');
    return;
  }


  /* ---------- CHECK PASSWORD ---------- */

  const takenByOther = isPasswordTaken(
    password,
    'w_' + workerId
  );

  if (takenByOther) {
    alert(takenByOther);
    return;
  }


  /* ---------- UPDATE SUPABASE ---------- */

  try {

    await changeWorkerPasswordInSupabase(
      workerId,
      password
    );

    renderPasswordsManager();

    alert(
      'Password changed successfully for ' +
      worker.name
    );

  } catch (error) {

    console.error(
      'Change worker password failed:',
      error
    );

    alert(
      'Could not change worker password.\n\n' +
      (error.message || 'Unknown error')
    );

  }

}


/* =========================================================
   DELETE WORKER
   ========================================================= */

async function deleteWorker(workerId) {

  if (getActiveRole() === 'admin') {
    alert('View only - Admin cannot edit.');
    return;
  }

  const worker = getWorkerById(workerId);

  if (!worker) {
    alert('Worker not found.');
    return;
  }


  const confirmed = confirm(
    'Are you sure you want to delete worker ' +
    worker.name +
    '?\n\n' +
    'Attendance records will also be deleted.'
  );

  if (!confirmed) {
    return;
  }


  try {

    /* Remove from Supabase */

    await removeWorkerFromSupabase(
      workerId
    );


    /* Remove from active staff */

    activeStaffIds = activeStaffIds.filter(
      function (id) {

        return String(id) !== String(workerId);

      }
    );


    updateStaffUI();
    renderWorkersView();


  } catch (error) {

    console.error(
      'Delete worker failed:',
      error
    );

    alert(
      'Could not delete worker.\n\n' +
      (error.message || 'Unknown error')
    );

  }

}


/* =========================================================
   PASSWORDS MANAGER
   Tux Admin only
   ========================================================= */

function isPasswordTaken(password, exceptKey) {

  if (
    exceptKey !== 'tux' &&
    String(password) === String(getTuxAdminPassword())
  ) {

    return 'This password is already used by Tux Admin.';

  }


  if (
    exceptKey !== 'admin' &&
    adminAccount &&
    String(password) === String(adminAccount.password)
  ) {

    return 'This password is already used by the Admin account.';

  }


  const clash = workersList.some(function (worker) {

    return (
      ('w_' + worker.id) !== exceptKey &&
      String(worker.password) === String(password)
    );

  });


  if (clash) {

    return 'This password is already used by another worker.';

  }


  return null;
}


function togglePasswordVisibility(key) {

  visiblePasswordKeys[key] =
    !visiblePasswordKeys[key];

  renderPasswordsManager();

}


function renderPasswordsManager() {

  const tbody =
    document.getElementById(
      'passwordsManagerBody'
    );

  if (!tbody) {
    return;
  }


  if (getActiveRole() !== 'tuxadmin') {

    tbody.innerHTML = '';

    return;

  }


  const rows = [];


  /* ---------- TUX ADMIN ---------- */

  rows.push({

    key: 'tux',

    role: 'Tux Admin',

    name: '-',

    password: getTuxAdminPassword(),

    editFn:
      'editTuxAdminPasswordFromManager()',

    deleteFn:
      'resetTuxAdminPassword()',

    deleteLabel: 'Reset'

  });


  /* ---------- ADMIN ---------- */

  if (adminAccount) {

    rows.push({

      key: 'admin',

      role: 'Admin',

      name: adminAccount.name,

      password: adminAccount.password,

      editFn:
        'editAdminFromManager()',

      deleteFn:
        'deleteAdminAccount()',

      deleteLabel: 'Delete'

    });

  }


  /* ---------- WORKERS ---------- */

  workersList.forEach(function (worker) {

    rows.push({

      key: 'w_' + worker.id,

      role: 'Worker',

      name: worker.name,

      password: worker.password,

      editFn:
        'changeWorkerPassword(\'' +
        worker.id +
        '\')',

      deleteFn:
        'deleteWorker(\'' +
        worker.id +
        '\')',

      deleteLabel: 'Delete'

    });

  });


  let html = '';


  rows.forEach(function (row) {

    const shown =
      visiblePasswordKeys[row.key];


    html +=
      '<tr>' +

      '<td>' +
      row.role +
      '</td>' +

      '<td class="worker-name-cell">' +
      escapeHtmlPw(row.name) +
      '</td>' +

      '<td style="font-family: monospace; color: #f1c40f;">' +

      (
        shown
          ? escapeHtmlPw(row.password)
          : '••••••••'
      ) +

      ' <span ' +
      'style="cursor:pointer; margin-left:4px;" ' +
      'onclick="togglePasswordVisibility(\'' +
      row.key +
      '\')" ' +
      'title="Show / Hide">' +

      (
        shown
          ? '🙈'
          : '👁'
      ) +

      '</span>' +

      '</td>' +

      '<td>' +

      '<button ' +
      'class="worker-btn worker-btn-edit" ' +
      'style="padding:4px 7px;" ' +
      'onclick="' +
      row.editFn +
      '">' +

      'Edit' +

      '</button> ' +

      '<button ' +
      'class="worker-btn worker-btn-delete" ' +
      'style="padding:4px 7px;" ' +
      'onclick="' +
      row.deleteFn +
      '">' +

      row.deleteLabel +

      '</button>' +

      '</td>' +

      '</tr>';

  });


  tbody.innerHTML = html;

}


/* =========================================================
   TUX ADMIN PASSWORD
   ========================================================= */

function editTuxAdminPasswordFromManager() {

  if (getActiveRole() !== 'tuxadmin') {
    return;
  }


  const next = prompt(
    'Enter new Tux Admin password (min 6 characters):'
  );

  if (next === null) {
    return;
  }


  const pass = next.trim();


  if (pass.length < 6) {

    alert(
      'Password must be at least 6 characters.'
    );

    return;

  }


  const taken =
    isPasswordTaken(
      pass,
      'tux'
    );


  if (taken) {

    alert(taken);

    return;

  }


  localStorage.setItem(
    'tuxAdminPassword',
    pass
  );

  renderPasswordsManager();

  alert(
    'Tux Admin password changed successfully.'
  );

}


function resetTuxAdminPassword() {

  if (getActiveRole() !== 'tuxadmin') {
    return;
  }


  if (
    !confirm(
      'Reset the Tux Admin password to the default password?'
    )
  ) {

    return;

  }


  const taken =
    isPasswordTaken(
      DEFAULT_TUX_ADMIN_PASSWORD,
      'tux'
    );


  if (taken) {

    alert(
      'Cannot reset: the default password is ' +
      taken.toLowerCase()
    );

    return;

  }


  localStorage.removeItem(
    'tuxAdminPassword'
  );

  renderPasswordsManager();

  alert(
    'Tux Admin password was reset to the default.'
  );

}


/* =========================================================
   ADMIN ACCOUNT
   ========================================================= */

function editAdminFromManager() {

  if (
    getActiveRole() !== 'tuxadmin' ||
    !adminAccount
  ) {

    return;

  }


  const newName = prompt(
    'Admin name:',
    adminAccount.name
  );

  if (newName === null) {
    return;
  }


  const newPass = prompt(
    'New Admin password (leave empty to keep current):'
  );

  if (newPass === null) {
    return;
  }


  const name = newName.trim();
  const pass = newPass.trim();


  if (!name) {

    alert(
      'Admin name cannot be empty.'
    );

    return;

  }


  const finalPass =
    pass || adminAccount.password;


  const taken =
    isPasswordTaken(
      finalPass,
      'admin'
    );


  if (taken) {

    alert(taken);

    return;

  }


  adminAccount = {

    name: name,

    password: finalPass

  };


  localStorage.setItem(
    'tuxAdminAccount',
    JSON.stringify(adminAccount)
  );


  updateStaffUI();

  renderAdminAccountStatus();

  renderPasswordsManager();


  alert(
    'Admin account updated successfully.'
  );

}


function deleteAdminAccount() {

  if (
    getActiveRole() !== 'tuxadmin' ||
    !adminAccount
  ) {

    return;

  }


  if (
    !confirm(
      'Delete the Admin account "' +
      adminAccount.name +
      '"?'
    )
  ) {

    return;

  }


  adminAccount = null;

  adminActive = false;


  localStorage.removeItem(
    'tuxAdminAccount'
  );


  const nameInput =
    document.getElementById(
      'adminName'
    );


  if (nameInput) {

    nameInput.value = '';

  }


  updateStaffUI();

  applyRolePermissions();

  renderPasswordsManager();


  alert(
    'Admin account deleted.'
  );

}


/* =========================================================
   WORKERS VIEW
   ========================================================= */

function renderWorkersView() {

  renderWorkersSummary();

  renderTodayWorkers();

  renderSelectedWorker();

  renderPasswordsManager();

  applyRolePermissions();

}


/* =========================================================
   WORKERS SUMMARY
   ========================================================= */

function renderWorkersSummary() {

  const totalElement =
    document.getElementById(
      'workersTotalCount'
    );

  const presentElement =
    document.getElementById(
      'workersPresentToday'
    );

  const todayHoursElement =
    document.getElementById(
      'workersTodayHours'
    );

  const totalHoursElement =
    document.getElementById(
      'workersTotalHours'
    );


  if (totalElement) {

    totalElement.innerText =
      workersList.length;

  }


  let workingToday = 0;

  let todayHours = 0;

  let totalHours = 0;


  workersList.forEach(function (worker) {

    if (
      isStaffLoggedIn(worker.id)
    ) {

      workingToday++;

    }


    todayHours +=
      getWorkerHoursForToday(
        worker
      );


    totalHours +=
      getWorkerTotalHours(
        worker
      );

  });


  if (presentElement) {

    presentElement.innerText =
      workingToday;

  }


  if (todayHoursElement) {

    todayHoursElement.innerText =
      todayHours.toFixed(2);

  }


  if (totalHoursElement) {

    totalHoursElement.innerText =
      totalHours.toFixed(2);

  }

}


/* =========================================================
   TODAY'S WORKERS
   ========================================================= */

function renderTodayWorkers() {

  const container =
    document.getElementById(
      'todayWorkersList'
    );


  if (!container) {
    return;
  }


  if (workersList.length === 0) {

    container.innerHTML =
      '<div class="empty-worker">' +
      'No workers added yet' +
      '</div>';

    return;

  }


  const today =
    getTodayKey();


  let html = '';


  workersList.forEach(function (worker) {

    const todaySessions =
      (worker.attendance || [])
        .filter(function (record) {

          return record.date === today;

        });


    let status =
      '<span class="worker-status-absent">' +
      'Absent' +
      '</span>';


    let times = '';


    if (
      isStaffLoggedIn(
        worker.id
      )
    ) {

      status =
        '<span class="worker-status-working">' +
        'Working' +
        '</span>';


      times =
        'Hours: ' +
        formatHours(
          getWorkerHoursForToday(
            worker
          )
        );

    }

    else if (
      todaySessions.length > 0
    ) {

      status =
        '<span class="worker-status-present">' +
        'Present' +
        '</span>';


      times =
        'Sessions: ' +
        todaySessions.length +
        ' | Hours: ' +
        formatHours(
          getWorkerHoursForToday(
            worker
          )
        );

    }


    html += `

      <div class="attendance-row">

        <div>

          <div class="worker-name-cell">
            ${escapeHtmlPw(worker.name)}
          </div>

          <div style="color: #777; font-size: 9px;">
            ${times}
          </div>

        </div>

        <div>
          ${status}
        </div>

      </div>

    `;

  });


  container.innerHTML = html;

}