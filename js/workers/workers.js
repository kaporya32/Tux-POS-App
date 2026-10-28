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


/* =========================================================
   GET TUX ADMIN PASSWORD
   ========================================================= */

function getTuxAdminPassword() {

  const savedPassword = localStorage.getItem('tuxAdminPassword');

  if (savedPassword && String(savedPassword).trim()) {
    return String(savedPassword);
  }

  const legacyPassword =
    adminAccount && adminAccount.tuxPassword
      ? String(adminAccount.tuxPassword)
      : '';

  return legacyPassword;
}

/* =========================================================
   CHECK PASSWORD
   ========================================================= */

function isPasswordTaken(password, exceptKey) {

  const candidate = String(password);

  /*
   * Check the saved Tux Admin password only.
   * Do not fall back to a hardcoded default password.
   */

  const savedTuxPassword = localStorage.getItem('tuxAdminPassword');

  if (
    exceptKey !== 'tux' &&
    savedTuxPassword &&
    candidate === String(savedTuxPassword)
  ) {
    return 'This password is already used by Tux Admin.';
  }

  /*
   * Check all active accounts in the workers table,
   * including both Workers and Admins.
   */

  const clash = Array.isArray(workersList) &&
    workersList.some(function (account) {

      const accountKey = 'w_' + account.id;

      return (
        account.active !== false &&
        accountKey !== exceptKey &&
        String(account.password) === candidate
      );

    });

  if (clash) {
    return 'This password is already used by another account.';
  }

  return null;
}

/* =========================================================
   PASSWORD VISIBILITY
   ========================================================= */

function togglePasswordVisibility(key) {

  visiblePasswordKeys[key] =
    !visiblePasswordKeys[key];

  renderPasswordsManager();

}


/* =========================================================
   RENDER PASSWORDS MANAGER
   ========================================================= */


function renderPasswordsManager() {
  const tbody = document.getElementById('passwordsManagerBody');

  if (!tbody) {
    return;
  }

  if (getActiveRole() !== 'tuxadmin') {
    tbody.innerHTML = '';
    return;
  }

  const rows = [];

  /* ---------- ADMIN ACCOUNTS ---------- */

  workersList
    .filter(function (account) {
      return account.role === 'admin' && account.active !== false;
    })
    .forEach(function (admin) {
      rows.push({
        key: 'w_' + admin.id,
        role: 'Admin',
        name: admin.name,
        password: admin.password,
        editFn: "editAdminAccount('" + admin.id + "')",
        deleteFn: "deleteAdminAccount('" + admin.id + "')",
        deleteLabel: 'Delete'
      });
    });

  /* ---------- WORKERS ---------- */

  workersList
    .filter(function (worker) {
      return worker.role === 'worker' && worker.active !== false;
    })
    .forEach(function (worker) {
      rows.push({
        key: 'w_' + worker.id,
        role: 'Worker',
        name: worker.name,
        password: worker.password,
        editFn: "changeWorkerPassword('" + worker.id + "')",
        deleteFn: "deleteWorker('" + worker.id + "')",
        deleteLabel: 'Delete'
      });
    });

  /* ---------- RENDER TABLE ---------- */

  let html = '';

  rows.forEach(function (row) {
    const shown = visiblePasswordKeys[row.key];

    html +=
      '<tr>' +
      '<td>' + row.role + '</td>' +
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
      'onclick="togglePasswordVisibility(\'' + row.key + '\')" ' +
      'title="Show / Hide">' +
      (shown ? '🙈' : '👁') +
      '</span>' +
      '</td>' +
      '<td>' +
      '<button ' +
      'class="worker-btn worker-btn-edit" ' +
      'style="padding:4px 7px;" ' +
      'onclick="' + row.editFn + '">' +
      'Edit' +
      '</button> ' +
      '<button ' +
      'class="worker-btn worker-btn-delete" ' +
      'style="padding:4px 7px;" ' +
      'onclick="' + row.deleteFn + '">' +
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
    alert('Only Tux Admin can change this password.');
    return;
  }

  const next = prompt(
    'Set a new Tux Admin password (minimum 6 characters):'
  );

  if (next === null) {
    return;
  }

  const pass = next.trim();

  if (pass.length < 6) {
    alert('Password must be at least 6 characters.');
    return;
  }

  const taken = isPasswordTaken(pass, 'tux');

  if (taken) {
    alert(taken);
    return;
  }

  localStorage.setItem('tuxAdminPassword', pass);

  renderPasswordsManager();

  alert('Tux Admin password updated successfully.');
}


/* =========================================================
   ADMIN ACCOUNTS
   Stored in Supabase workers table with role = 'admin'
   Tux Admin only
   ========================================================= */


/* =========================================================
   ADD ADMIN ACCOUNT
   ========================================================= */


/* =========================================================
   ADD ADMIN ACCOUNT
   ========================================================= */

async function saveAdminAccount() {
  if (getActiveRole() !== 'tuxadmin') {
    alert('Only Tux Admin can manage Admin accounts.');
    return;
  }

  const nameInput = document.getElementById('adminName');
  const passwordInput = document.getElementById('adminPasswordInput');
  const statusElement = document.getElementById('adminAccountStatus');
  const button = document.getElementById('saveAdminAccountBtn');

  if (!nameInput || !passwordInput) {
    alert('Admin account form was not found.');
    return;
  }

  const name = nameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!name) {
    alert('Please enter an Admin name.');
    return;
  }

  if (!password) {
    alert('Please enter an Admin password.');
    return;
  }

  if (password.length < 6) {
    alert('Admin password must be at least 6 characters.');
    return;
  }

  /* ---------- CHECK DUPLICATE NAME ---------- */

  const duplicateName = workersList.some(function (account) {
    return (
      account &&
      account.active !== false &&
      String(account.name || '').trim().toLowerCase() ===
      name.toLowerCase()
    );
  });

  if (duplicateName) {
    alert('An account with this name already exists.');
    return;
  }

  /* ---------- CHECK DUPLICATE PASSWORD ---------- */

  const duplicatePassword = isPasswordTaken(password, null);

  if (duplicatePassword) {
    alert(duplicatePassword);
    return;
  }

  /* ---------- PREVENT DOUBLE SUBMISSION ---------- */

  if (button && button.disabled) {
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Saving...';
    }

    if (statusElement) {
      statusElement.textContent = 'Saving Admin account...';
    }

    /* ---------- DIAGNOSTIC LOG ---------- */

    console.log('[TUX DEBUG] Creating Admin:', {
      name: name,
      requestedRole: 'admin',
      time: new Date().toISOString()
    });

    /* ---------- CREATE EXACTLY ONE ADMIN ACCOUNT ---------- */

    const createdAccount = await addWorkerToSupabase(
      name,
      password,
      'admin'
    );

    console.log('[TUX DEBUG] Account returned from Supabase:', {
      id: createdAccount.id,
      name: createdAccount.name,
      role: createdAccount.role
    });

    if (
      !createdAccount ||
      createdAccount.role !== 'admin'
    ) {
      console.error(
        '[TUX DEBUG] Unexpected account returned:',
        createdAccount
      );

      throw new Error(
        'Supabase did not return the expected Admin account. ' +
        'Check the workers table before trying again.'
      );
    }

    /* ---------- CLEAR FORM ---------- */

    nameInput.value = '';
    passwordInput.value = '';

    /* ---------- REFRESH UI ---------- */

    renderAdminAccounts();
    renderPasswordsManager();
    renderWorkersView();

    if (statusElement) {
      statusElement.textContent =
        'Admin account created successfully.';
    }

    alert(
      'Admin account "' +
      createdAccount.name +
      '" created successfully!'
    );

  } catch (error) {
    console.error(
      '[TUX DEBUG] Create Admin account failed:',
      error
    );

    if (statusElement) {
      statusElement.textContent =
        'Could not create Admin account.';
    }

    alert(
      'Could not create Admin account.\n\n' +
      (error.message || 'Unknown error')
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '+ Add Admin';
    }
  }
}




/* =========================================================
   RENDER ADMIN ACCOUNTS
   ========================================================= */

function renderAdminAccounts() {

  const tbody = document.getElementById('adminAccountsBody');

  if (!tbody) {
    return;
  }

  if (getActiveRole() !== 'tuxadmin') {
    tbody.innerHTML = '';
    return;
  }

  const admins = Array.isArray(workersList)
    ? workersList.filter(function (account) {
      return (
        account.role === 'admin' &&
        account.active !== false
      );
    })
    : [];

  if (admins.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" style="text-align:center;color:#888;">
          No Admin accounts created yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = admins.map(function (admin) {

    const safeName = escapeHtmlPw(admin.name);
    const safeId = String(admin.id).replace(/[^a-zA-Z0-9_-]/g, '');

    return `
      <tr>
        <td class="worker-name-cell">${safeName}</td>
        <td>
          <button
            type="button"
            class="worker-btn worker-btn-edit"
            style="padding:4px 7px;"
            onclick="editAdminAccount('${safeId}')">
            Edit
          </button>

          <button
            type="button"
            class="worker-btn worker-btn-delete"
            style="padding:4px 7px;"
            onclick="deleteAdminAccount('${safeId}')">
            Delete
          </button>
        </td>
      </tr>
    `;

  }).join('');

}


/* =========================================================
   EDIT ADMIN ACCOUNT
   ========================================================= */

async function editAdminAccount(adminId) {

  if (getActiveRole() !== 'tuxadmin') {
    alert('Only Tux Admin can edit Admin accounts.');
    return;
  }

  const admin = workersList.find(function (account) {
    return (
      String(account.id) === String(adminId) &&
      account.role === 'admin'
    );
  });

  if (!admin) {
    alert('Admin account not found.');
    return;
  }

  const enteredName = prompt('Admin name:', admin.name);

  if (enteredName === null) {
    return;
  }

  const name = enteredName.trim();

  if (!name) {
    alert('Admin name cannot be empty.');
    return;
  }

  const duplicateName = workersList.some(function (account) {
    return (
      String(account.id) !== String(adminId) &&
      account.active !== false &&
      String(account.name).trim().toLowerCase() === name.toLowerCase()
    );
  });

  if (duplicateName) {
    alert('Another account already uses this name.');
    return;
  }

  const enteredPassword = prompt(
    'Enter a new password for ' + name +
    ' (leave empty to keep the current password):'
  );

  if (enteredPassword === null) {
    return;
  }

  const newPassword = enteredPassword.trim();
  const password = newPassword || admin.password;

  if (!password) {
    alert('Admin password cannot be empty.');
    return;
  }

  if (newPassword && newPassword.length < 6) {
    alert('Admin password must be at least 6 characters.');
    return;
  }

  if (newPassword) {
    const duplicatePassword = isPasswordTaken(
      newPassword,
      'w_' + adminId
    );

    if (duplicatePassword) {
      alert(duplicatePassword);
      return;
    }
  }

  try {

    const { data, error } = await supabaseClient
      .from('workers')
      .update({
        name: name,
        password: password
      })
      .eq('id', adminId)
      .eq('role', 'admin')
      .select('id, name, role, active');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error(
        'No Admin account was updated. Check Supabase permissions and the account role.'
      );
    }

    await loadWorkersFromSupabase();

    renderAdminAccounts();
    renderPasswordsManager();
    renderWorkersView();

    alert('Admin account updated successfully.');

  } catch (error) {

    console.error('Update Admin account failed:', error);

    alert(
      'Could not update Admin account.\n\n' +
      (error.message || 'Unknown error')
    );

  }
}


/* =========================================================
   DELETE ADMIN ACCOUNT
   ========================================================= */

async function deleteAdminAccount(adminId) {

  if (getActiveRole() !== 'tuxadmin') {
    alert('Only Tux Admin can delete Admin accounts.');
    return;
  }

  const admin = workersList.find(function (account) {
    return (
      String(account.id) === String(adminId) &&
      account.role === 'admin'
    );
  });

  if (!admin) {
    alert('Admin account not found.');
    return;
  }

  const confirmed = confirm(
    'Delete Admin account "' + admin.name + '"?\n\n' +
    'That account will no longer be available for login.'
  );

  if (!confirmed) {
    return;
  }

  try {

    await removeWorkerFromSupabase(adminId);

    /*
     * Do not add Admins to or remove them from worker attendance.
     */

    renderAdminAccounts();
    renderPasswordsManager();
    renderWorkersView();

    alert('Admin account deleted successfully.');

  } catch (error) {

    console.error('Delete Admin account failed:', error);

    alert(
      'Could not delete Admin account.\n\n' +
      (error.message || 'Unknown error')
    );

  }

}



/* =========================================================
   WORKERS VIEW
   ========================================================= */

function renderWorkersView() {
  renderWorkersSummary();

  renderTodayWorkers();
  renderTodayAdmins();

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
    document.getElementById('todayWorkersList');

  if (!container) {
    return;
  }

  /* =======================================================
     ACTIVE WORKERS
     ======================================================= */

  const workers = Array.isArray(workersList)
    ? workersList.filter(function (account) {
        return (
          account &&
          account.role === 'worker' &&
          account.active !== false
        );
      })
    : [];

  if (workers.length === 0) {
    container.innerHTML =
      '<div class="empty-worker">No workers added yet</div>';
    return;
  }

  /* =======================================================
     SHARED ONLINE PRESENCE
     ======================================================= */

  const presence = Array.isArray(tuxOnlinePresenceCache)
    ? tuxOnlinePresenceCache
    : [];

  const now = Date.now();
  const onlineThreshold = 90 * 1000;

  function isWorkerOnline(worker) {
    return presence.some(function (session) {
      if (
        !session ||
        String(session.role || '').toLowerCase() !== 'worker' ||
        String(session.account_id || '') !== String(worker.id || '') ||
        session.logged_out_at
      ) {
        return false;
      }

      const lastSeen = Date.parse(session.last_seen_at || '');

      return (
        Number.isFinite(lastSeen) &&
        now - lastSeen <= onlineThreshold &&
        now >= lastSeen
      );
    });
  }

  /* =======================================================
     ATTENDANCE — KEEP EXISTING LOGIC
     ======================================================= */

  const today = getTodayKey();

  let html = '';

  workers.forEach(function (worker) {
    const attendance = Array.isArray(worker.attendance)
      ? worker.attendance
      : [];

    const todaySessions = attendance.filter(function (record) {
      return record.date === today;
    });

    const hasActiveSession = todaySessions.some(function (record) {
      return (
        record.checkIn &&
        !record.checkOut &&
        record.status === 'working'
      );
    });

    let attendanceStatus =
      '<span class="worker-status-absent">Absent</span>';

    let times = '';

    if (hasActiveSession) {
      attendanceStatus =
        '<span class="worker-status-working">Working</span>';

      times =
        'Sessions: ' + todaySessions.length +
        ' | Hours: ' +
        formatHours(getWorkerHoursForToday(worker));
    } else if (todaySessions.length > 0) {
      times =
        'Sessions: ' + todaySessions.length +
        ' | Hours: ' +
        formatHours(getWorkerHoursForToday(worker));
    }

    /* =====================================================
       ONLINE STATUS — SEPARATE FROM ATTENDANCE
       ===================================================== */

    const online = isWorkerOnline(worker);

    const onlineStatus = online
      ? '<span style="' +
          'display:inline-block;' +
          'padding:3px 7px;' +
          'border-radius:10px;' +
          'background:rgba(46,204,113,0.12);' +
          'color:#2ecc71;' +
          'font-size:10px;' +
          'font-weight:600;' +
        '><span style="font-size:8px;">●</span> Online</span>'
      : '<span style="' +
          'display:inline-block;' +
          'padding:3px 7px;' +
          'border-radius:10px;' +
          'background:rgba(149,165,166,0.12);' +
          'color:#95a5a6;' +
          'font-size:10px;' +
          'font-weight:600;' +
        '><span style="font-size:8px;">●</span> Offline</span>';

    /* =====================================================
       RENDER ROW
       ===================================================== */

    html += `
      <div class="attendance-row">
        <div>
          <div class="worker-name-cell">
            ${escapeHtmlPw(worker.name)}
          </div>

          <div style="color:#777;font-size:9px;margin-top:3px;">
            ${times}
          </div>
        </div>

        <div style="
          display:flex;
          flex-direction:column;
          align-items:flex-end;
          gap:5px;
        ">
          ${onlineStatus}
          ${attendanceStatus}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}



function renderTodayAdmins() {
  const container = document.getElementById('todayAdminsList');

  if (!container) {
    return;
  }

  // Display regular Admin accounts only.
  const admins = Array.isArray(workersList)
    ? workersList.filter(function (account) {
        return (
          account &&
          account.role === 'admin' &&
          account.active !== false
        );
      })
    : [];

  if (admins.length === 0) {
    container.innerHTML =
      '<div class="empty-worker">No admin accounts added yet</div>';
    return;
  }

  const today = getTodayKey();

  let html = '';

  admins.forEach(function (admin) {
    const attendance = Array.isArray(admin.attendance)
      ? admin.attendance
      : [];

    const todaySessions = attendance.filter(function (record) {
      return record.date === today;
    });

    // An open attendance session means the admin is working.
    const hasActiveSession = todaySessions.some(function (record) {
      return (
        record.checkIn &&
        !record.checkOut &&
        record.status === 'working'
      );
    });

    let status =
      '<span class="worker-status-absent">Absent</span>';

    if (hasActiveSession) {
      status =
        '<span class="worker-status-working">Working</span>';
    }

    // Calculate today's hours using the existing helper.
    const hours = formatHours(getWorkerHoursForToday(admin));

    const times =
      'Sessions: ' + todaySessions.length +
      ' | Hours: ' + hours;

    html += `
      <div class="attendance-row">
        <div>
          <div class="worker-name-cell">
            ${escapeHtmlPw(admin.name)}
          </div>

          <div style="color:#777;font-size:9px;">
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

