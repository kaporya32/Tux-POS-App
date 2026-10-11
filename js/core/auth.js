
/* =========================================================
   TUX POS — AUTH / ROLES / STAFF LOGIN
   Shared session version and nightly logout support
   ========================================================= */


/* =========================================================
   SHARED SESSION CONFIGURATION
   ========================================================= */

const TUX_SESSION_VERSION_KEY = 'tuxSessionVersion';
const TUX_SESSION_CHECK_INTERVAL = 5 * 1000;


/* =========================================================
   ROLE HELPERS
   ========================================================= */

function getActiveRole() {
  if (tuxAdminActive === true) return 'tuxadmin';
  if (adminActive === true) return 'admin';

  if (
    Array.isArray(activeStaffIds) &&
    activeStaffIds.length > 0
  ) {
    return 'worker';
  }

  return null;
}

function isTuxAdmin() {
  return tuxAdminActive === true;
}

function isAdminSpectateMode() {
  return adminActive === true && tuxAdminActive !== true;
}

function canEdit() {
  const role = getActiveRole();
  return role === 'tuxadmin' || role === 'worker';
}

function canEditAdminReports() {
  return tuxAdminActive === true || adminActive === true;
}

function isWorkerLoggedIn() {
  return getActiveRole() === 'worker';
}


/* =========================================================
   LOGGED-OUT NAVBAR VISIBILITY
   Keep ONLY Staff Login visible when nobody is logged in.
   Uses the actual classes and IDs in navbar.html.
   ========================================================= */

function ensureTuxNavbarVisibilityStyles() {
  if (document.getElementById('tuxNavbarVisibilityStyles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'tuxNavbarVisibilityStyles';

  style.textContent = `
    .top-nav.tux-logged-out .nav-brand,
    .top-nav.tux-logged-out .nav-tabs > .nav-btn,
    .top-nav.tux-logged-out .shift-controls,
    .top-nav.tux-logged-out .nav-clock,
    .top-nav.tux-logged-out #staffStatus,
    .top-nav.tux-logged-out #staffLogoutBtn {
      display: none !important;
    }

    .top-nav.tux-logged-out #staffLoginBtn {
      display: inline-block !important;
      visibility: visible !important;
    }

    .top-nav.tux-logged-out .staff-login-box {
      display: flex !important;
      visibility: visible !important;
      align-items: center;
    }

    .top-nav.tux-logged-out .nav-tabs {
      display: flex !important;
      visibility: visible !important;
      justify-content: flex-end;
      width: 100%;
    }
  `;

  document.head.appendChild(style);
}



/* =========================================================
   TUX POS — NIGHTLY LOGOUT
   Server-side cron owns the global session reset.
   NEVER call this from normal End Shift.
   ========================================================= */

async function logoutEveryoneAtEndOfDay() {
  console.warn(
    'TUX POS — Global logout is managed by the server-side nightly job. ' +
    'Normal End Shift must not call this function.'
  );

  return false;
}
function updateTuxNavbarVisibility() {
  ensureTuxNavbarVisibilityStyles();

  const navbar = document.querySelector('.top-nav');

  if (!navbar) {
    console.warn(
      'TUX POS — Could not find .top-nav in navbar.html.'
    );
    return;
  }

  const loggedIn = getActiveRole() !== null;

  navbar.classList.toggle(
    'tux-logged-out',
    !loggedIn
  );
}


/* =========================================================
   SHARED SESSION VERSION — SUPABASE
   ========================================================= */

async function getTuxSharedSessionVersion() {
  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {
    throw new Error('Supabase client is unavailable.');
  }

  const { data, error } =
    await supabaseClient.rpc('get_tux_session_version');

  if (error) throw error;

  if (data === null || data === undefined) {
    throw new Error(
      'Supabase returned an empty session version.'
    );
  }

  return String(data);
}


/* =========================================================
   SAVE SHARED SESSION VERSION AFTER LOGIN
   ========================================================= */

async function stampTuxSessionVersionAfterLogin() {
  const version = await getTuxSharedSessionVersion();

  // Persistent copy: survives closing and reopening the browser.
  localStorage.setItem(
    TUX_SESSION_VERSION_KEY,
    String(version)
  );

  // Compatibility copy for existing code.
  sessionStorage.setItem(
    TUX_SESSION_VERSION_KEY,
    String(version)
  );

  return version;
}



/* =========================================================
   CLEAR LOCAL LOGIN
   ========================================================= */


function clearTuxLocalLogin(options = {}) {
  const shouldReload = options.reload !== false;

  tuxAdminActive = false;
  adminActive = false;

  activeStaffIds = [];

  try {
    sessionStorage.removeItem('tuxTuxAdminActive');
    sessionStorage.removeItem('tuxAdminActive');
    sessionStorage.removeItem('tuxActiveStaffIds');
    sessionStorage.removeItem(TUX_SESSION_VERSION_KEY);

    localStorage.removeItem('tuxActiveStaffIds');
    localStorage.removeItem('tuxWorkerSessionTokens');
  } catch (error) {
    console.error(
      'TUX POS — Failed to clear local login:',
      error
    );
  }

  if (typeof updateStaffUI === 'function') {
    updateStaffUI();
  }

  if (typeof applyRolePermissions === 'function') {
    applyRolePermissions();
  }

  if (typeof updateStaffStatus === 'function') {
    updateStaffStatus();
  }

  if (shouldReload && typeof window !== 'undefined') {
    window.location.reload();
  }
}



/* =========================================================
   VALIDATE RESTORED SESSION
   ========================================================= */



async function validateTuxRestoredSession() {
  const hasWorkers =
    Array.isArray(activeStaffIds) &&
    activeStaffIds.length > 0;

  // Admin sessions retain their existing local behavior.
  if (!hasWorkers) {
    return true;
  }

  const tokens = getTuxWorkerSessionTokens();
  const workerIds = [...activeStaffIds].map(String);

  let loginChanged = false;

  for (const workerId of workerIds) {
    const token = tokens[workerId];

    // A tab without its own token must not restore the worker login.
    if (!token) {
      activeStaffIds = activeStaffIds.filter(
        id => String(id) !== workerId
      );

      loginChanged = true;
      continue;
    }

    try {
      const { data, error } = await supabaseClient.rpc(
        'check_tux_worker_session',
        {
          p_worker_id: workerId,
          p_session_token: token
        }
      );

      // Preserve the login if Supabase cannot be reached temporarily.
      if (error) {
        console.error(
          'TUX POS — Could not validate worker session:',
          workerId,
          error
        );

        continue;
      }

      // A definitive invalid result means this session is no longer active.
      if (data !== true) {
        delete tokens[workerId];

        activeStaffIds = activeStaffIds.filter(
          id => String(id) !== workerId
        );

        loginChanged = true;
      }
    } catch (error) {
      console.error(
        'TUX POS — Worker session validation failed:',
        workerId,
        error
      );
    }
  }

  if (loginChanged) {
    saveTuxWorkerSessionTokens(tokens);
    saveLoginSession();

    if (typeof updateStaffUI === 'function') {
      updateStaffUI();
    }

    if (typeof applyRolePermissions === 'function') {
      applyRolePermissions();
    }

    if (typeof updateStaffStatus === 'function') {
      updateStaffStatus();
    }
  }

  return activeStaffIds.length > 0 ||
    tuxAdminActive === true ||
    adminActive === true;
}




/* =========================================================
   SHARED SESSION WATCHER
   ========================================================= */


async function checkTuxAllWorkerSessions() {
  if (
    !Array.isArray(activeStaffIds) ||
    activeStaffIds.length === 0
  ) {
    return;
  }

  const workerIds = [...activeStaffIds].map(String);
  const tokens = getTuxWorkerSessionTokens();

  let loginChanged = false;

  for (const workerId of workerIds) {
    try {
      const valid = await checkTuxWorkerSession(workerId);

      // A network/RPC failure is not proof that the session was revoked.
      if (valid === null) {
        continue;
      }

      // This tab's worker session is still valid.
      if (valid === true) {
        continue;
      }

      // The session was revoked, expired, or has no token in this tab.
      delete tokens[workerId];

      activeStaffIds = activeStaffIds.filter(
        id => String(id) !== workerId
      );

      loginChanged = true;

      console.warn(
        'TUX POS — Worker session expired or revoked:',
        workerId
      );
    } catch (error) {
      console.error(
        'TUX POS — Unexpected worker session check failure:',
        workerId,
        error
      );
    }
  }

  if (!loginChanged) {
    return;
  }

  saveTuxWorkerSessionTokens(tokens);
  saveLoginSession();

  if (typeof updateStaffUI === 'function') {
    updateStaffUI();
  }

  if (typeof applyRolePermissions === 'function') {
    applyRolePermissions();
  }

  if (typeof updateStaffStatus === 'function') {
    updateStaffStatus();
  }

  alert(
    'Your worker session has expired or was logged out from another browser.'
  );
}






function startTuxSharedSessionWatcher() {
  if (window.tuxSharedSessionWatcher) {
    return;
  }

  async function runSessionChecks() {
    try {
      // Preserve the existing nightly shared-version check.
      await checkTuxSharedSessionVersion();

      // If the shared check logged out this browser, stop here.
      const hasWorkers =
        Array.isArray(activeStaffIds) &&
        activeStaffIds.length > 0;

      if (hasWorkers) {
        await checkTuxAllWorkerSessions();
      }
    } catch (error) {
      console.error(
        'TUX POS — Session watcher failed:',
        error
      );
    }
  }

  void runSessionChecks();

  window.tuxSharedSessionWatcher = window.setInterval(
    function () {
      void runSessionChecks();
    },
    TUX_SESSION_CHECK_INTERVAL
  );
}




/* =========================================================
   LOGIN SESSION
   ========================================================= */



function saveLoginSession() {
  try {
    // Admin sessions retain their existing behavior.
    sessionStorage.setItem(
      'tuxTuxAdminActive',
      tuxAdminActive ? 'true' : 'false'
    );

    sessionStorage.setItem(
      'tuxAdminActive',
      adminActive ? 'true' : 'false'
    );

    // Worker login state belongs to this tab only.
    // Do NOT save worker IDs to localStorage.
    sessionStorage.setItem(
      'tuxActiveStaffIds',
      JSON.stringify(
        Array.isArray(activeStaffIds)
          ? activeStaffIds.map(id => String(id))
          : []
      )
    );

    // Remove the legacy shared worker-login state.
    // The Supabase session-token storage remains untouched.
    localStorage.removeItem('tuxActiveStaffIds');
  } catch (error) {
    console.error(
      'TUX POS — Failed to save login session:',
      error
    );
  }
}



/* =========================================================
   RESTORE LOGIN SESSION
   ========================================================= */




function restoreLoginSession() {
  try {
    const savedTuxAdmin =
      sessionStorage.getItem('tuxTuxAdminActive');

    const savedAdmin =
      sessionStorage.getItem('tuxAdminActive');

    // Worker IDs must come ONLY from this tab's sessionStorage.
    // Never restore a worker login from shared localStorage.
    const savedStaffIds =
      sessionStorage.getItem('tuxActiveStaffIds');

    tuxAdminActive = savedTuxAdmin === 'true';
    adminActive = savedAdmin === 'true';

    let restoredStaffIds = [];

    if (savedStaffIds) {
      try {
        const parsed = JSON.parse(savedStaffIds);

        if (Array.isArray(parsed)) {
          restoredStaffIds = [
            ...new Set(
              parsed
                .filter(id => id !== null && id !== undefined)
                .map(id => String(id))
                .filter(id => id.trim() !== '')
            )
          ];
        }
      } catch (error) {
        console.warn(
          'TUX POS — Invalid saved staff session:',
          error
        );
      }
    }

    // If the worker list has loaded, discard IDs that do not exist.
    // If it has not loaded yet, preserve the saved IDs for validation.
    const workersLoaded =
      Array.isArray(workersList) &&
      workersList.length > 0;

    if (workersLoaded) {
      const validWorkerIds = new Set(
        workersList
          .filter(worker =>
            worker &&
            worker.id !== null &&
            worker.id !== undefined
          )
          .map(worker => String(worker.id))
      );

      activeStaffIds = restoredStaffIds.filter(
        id => validWorkerIds.has(id)
      );
    } else {
      activeStaffIds = restoredStaffIds;
    }

    if (tuxAdminActive) {
      adminActive = false;
    }

    saveLoginSession();
    updateStaffUI();

    if (typeof updateStaffStatus === 'function') {
      updateStaffStatus();
    }

    console.log(
      'TUX POS — Login session restored:',
      {
        role: getActiveRole(),
        tuxAdminActive,
        adminActive,
        activeStaffIds,
        workersLoaded
      }
    );

    // Validate this tab's worker session against Supabase.
    void validateTuxRestoredSession();
  } catch (error) {
    console.error(
      'TUX POS — Failed to restore login session:',
      error
    );

    tuxAdminActive = false;
    adminActive = false;
    activeStaffIds = [];

    try {
      saveLoginSession();
    } catch (saveError) {
      console.error(
        'TUX POS — Failed to reset login session:',
        saveError
      );
    }

    updateStaffUI();
  }
}



/* =========================================================
   STAFF LOGIN MODAL
   ========================================================= */

function openStaffLogin() {
  staffModalMode = 'login';

  const modal = document.getElementById('staffLoginModal');
  const title = document.getElementById('staffModalTitle');
  const info = document.getElementById('staffModalInfo');
  const input = document.getElementById('staffPasswordInput');
  const actionButton = document.getElementById('staffModalActionBtn');

  if (title) title.textContent = '👤 Staff Login';
  if (info) info.textContent = 'Enter your staff password';
  if (input) input.value = '';
  if (actionButton) actionButton.textContent = 'Login';
  if (modal) modal.style.display = 'flex';

  setTimeout(function () {
    if (input) input.focus();
  }, 50);
}


/* =========================================================
   STAFF LOGOUT MODAL
   ========================================================= */

function openStaffLogout() {
  staffModalMode = 'logout';

  const modal = document.getElementById('staffLoginModal');
  const title = document.getElementById('staffModalTitle');
  const info = document.getElementById('staffModalInfo');
  const input = document.getElementById('staffPasswordInput');
  const actionButton = document.getElementById('staffModalActionBtn');

  if (title) title.textContent = '🚪 Staff Logout';
  if (info) info.textContent = 'Enter your password to logout';
  if (input) input.value = '';
  if (actionButton) actionButton.textContent = 'Logout';
  if (modal) modal.style.display = 'flex';

  setTimeout(function () {
    if (input) input.focus();
  }, 50);
}


/* =========================================================
   CLOSE LOGIN / LOGOUT MODAL
   ========================================================= */

function closeStaffLogin() {
  const modal = document.getElementById('staffLoginModal');
  const input = document.getElementById('staffPasswordInput');

  if (input) input.value = '';
  if (modal) modal.style.display = 'none';
}


/* =========================================================
   STAFF MODAL ACTION
   ========================================================= */

async function staffModalAction() {
  const input = document.getElementById('staffPasswordInput');

  const password = input
    ? String(input.value || '').trim()
    : '';

  if (!password) {
    alert(
      staffModalMode === 'logout'
        ? 'Please enter your password.'
        : 'Please enter your staff password.'
    );

    return;
  }

  try {
    if (staffModalMode === 'logout') {
      staffLogout(password);
    } else {
      await staffLogin(password);
    }
  } catch (error) {
    console.error(
      'TUX POS — Login action failed:',
      error
    );

    alert(
      'The login action could not be completed. Please try again.'
    );
  }
}


/* =========================================================
   STAFF LOGIN
   ========================================================= */


async function staffLogin(password) {
  const enteredPassword = String(password || '').trim();

  if (!enteredPassword) {
    alert('Please enter your password.');
    return;
  }

  /*
   * TUX ADMIN
   */

  const tuxPassword =
    adminAccount && adminAccount.tuxPassword
      ? String(adminAccount.tuxPassword)
      : DEFAULT_TUX_ADMIN_PASSWORD;

  if (enteredPassword === tuxPassword) {
    try {
      await stampTuxSessionVersionAfterLogin();
    } catch (error) {
      console.error('TUX POS — Shared session verification failed:', error);
      alert('Unable to verify the shared session. Check your connection and try again.');
      return;
    }

    tuxAdminActive = true;
    adminActive = false;
    activeStaffIds = [];

    saveLoginSession();
    closeStaffLogin();
    updateStaffUI();
    applyRolePermissions();

    alert('Tux Admin login successful.');
    return;
  }

  /*
   * ADMIN
   */

  if (
    adminAccount &&
    adminAccount.password &&
    enteredPassword === String(adminAccount.password)
  ) {
    try {
      await stampTuxSessionVersionAfterLogin();
    } catch (error) {
      console.error('TUX POS — Shared session verification failed:', error);
      alert('Unable to verify the shared session. Check your connection and try again.');
      return;
    }

    adminActive = true;
    tuxAdminActive = false;
    activeStaffIds = [];

    saveLoginSession();
    closeStaffLogin();
    updateStaffUI();
    applyRolePermissions();

    alert('Admin login successful.');
    return;
  }

  /*
   * WORKER
   */

  const worker = Array.isArray(workersList)
    ? workersList.find(
      item =>
        item &&
        String(item.password || '') === enteredPassword &&
        item.active !== false
    )
    : null;

  if (!worker) {
    alert('Invalid password.');
    return;
  }

  const workerId = String(worker.id);

  if (!workerId || workerId === 'undefined') {
    alert('This worker has an invalid ID. Please contact the administrator.');
    return;
  }

  if (!Array.isArray(activeStaffIds)) {
    activeStaffIds = [];
  }

  /*
   * Avoid acquiring a second lock for the same worker
   * in this browser.
   */

  if (
    activeStaffIds.some(id => String(id) === workerId)
  ) {
    alert(`${worker.name || 'Worker'} is already logged in on this browser.`);
    return;
  }

  let acquiredSession = false;
  let attendanceStarted = false;

  try {
    /*
     * Verify the shared nightly session version first.
     */

    await stampTuxSessionVersionAfterLogin();

    /*
     * Acquire the worker's global single-device lock.
     */

    const session = await acquireTuxWorkerSession(
      worker,
      enteredPassword
    );

    if (!session) {
      return;
    }

    acquiredSession = true;

    /*
     * Start attendance and wait for the result.
     */

    if (typeof createAttendanceSession === 'function') {
      const attendanceResult = await createAttendanceSession(worker.id);

      if (attendanceResult === false) {
        throw new Error('Attendance session creation failed.');
      }

      attendanceStarted = true;
    }

    /*
     * Complete local login only after the lock is acquired.
     */


    if (!activeStaffIds.some(id => String(id) === String(workerId))) {
      activeStaffIds.push(String(workerId));
    }

    tuxAdminActive = false;
    adminActive = false;

    worker.attendance = true;

    saveLoginSession();

    try {
      localStorage.setItem(
        'tuxWorkersList',
        JSON.stringify(workersList)
      );
    } catch (storageError) {
      console.error('TUX POS — Failed to save workers:', storageError);
    }

    closeStaffLogin();
    updateStaffUI();
    applyRolePermissions();

    if (typeof updateStaffStatus === 'function') {
      updateStaffStatus();
    }

    alert(`${worker.name || 'Worker'} logged in successfully.`);
  } catch (error) {
    console.error('TUX POS — Worker login failed:', error);

    /*
     * Roll back the lock if attendance setup failed.
     */

    if (acquiredSession) {
      try {
        if (
          attendanceStarted &&
          typeof endAttendanceSession === 'function'
        ) {
          await endAttendanceSession(worker.id);
        }
      } catch (attendanceError) {
        console.error(
          'TUX POS — Attendance rollback failed:',
          attendanceError
        );
      }

      try {
        await releaseTuxWorkerSession(worker.id);
      } catch (releaseError) {
        console.error(
          'TUX POS — Failed to release worker lock:',
          releaseError
        );
      }
    }

    alert(
      'Worker login failed. Please check your connection and try again.'
    );
  }
}

/* =========================================================
   STAFF LOGOUT
   ========================================================= */



async function staffLogout(password) {
  const enteredPassword = String(password || '').trim();

  if (!enteredPassword) {
    alert('Please enter your password.');
    return;
  }

  /*
   * TUX ADMIN LOGOUT
   */

  if (tuxAdminActive) {
    const tuxPassword =
      adminAccount && adminAccount.tuxPassword
        ? String(adminAccount.tuxPassword)
        : DEFAULT_TUX_ADMIN_PASSWORD;

    if (enteredPassword !== tuxPassword) {
      alert('Incorrect Tux Admin password.');
      return;
    }

    tuxAdminActive = false;

    saveLoginSession();
    closeStaffLogin();
    updateStaffUI();
    applyRolePermissions();

    alert('Tux Admin logged out.');
    return;
  }

  /*
   * ADMIN LOGOUT
   */

  if (adminActive) {
    if (
      !adminAccount ||
      !adminAccount.password ||
      enteredPassword !== String(adminAccount.password)
    ) {
      alert('Incorrect Admin password.');
      return;
    }

    adminActive = false;

    saveLoginSession();
    closeStaffLogin();
    updateStaffUI();
    applyRolePermissions();

    alert('Admin logged out.');
    return;
  }

  /*
   * WORKER LOGOUT
   */

  const worker = Array.isArray(workersList)
    ? workersList.find(
      item =>
        item &&
        String(item.password || '') === enteredPassword &&
        Array.isArray(activeStaffIds) &&
        activeStaffIds.some(
          id => String(id) === String(item.id)
        )
    )
    : null;

  if (!worker) {
    alert('Incorrect password or no matching logged-in worker.');
    return;
  }

  try {
    /*
     * Close attendance first.
     */

    await endAttendanceSession(worker.id);

    /*
     * Release the global worker lock.
     */

    const released = await releaseTuxWorkerSession(worker.id);

    if (!released) {
      alert(
        'Attendance was closed, but the worker session lock could not be released. Please contact the administrator before trying another device.'
      );
      return;
    }

    /*
     * Clear this worker from the local login.
     */

    activeStaffIds = activeStaffIds.filter(
      id => String(id) !== String(worker.id)
    );

    saveLoginSession();

    closeStaffLogin();
    updateStaffUI();
    applyRolePermissions();

    if (typeof updateStaffStatus === 'function') {
      updateStaffStatus();
    }

    if (typeof renderWorkersView === 'function') {
      renderWorkersView();
    }

    if (typeof renderSelectedWorker === 'function') {
      renderSelectedWorker();
    }

    window.dispatchEvent(
      new CustomEvent('tux-attendance-updated')
    );

    alert(`${worker.name || 'Worker'} logged out.`);
  } catch (error) {
    console.error('TUX POS — Worker logout failed:', error);

    alert(
      'Logout could not be completed. Please check the connection and try again.'
    );
  }
}

/* =========================================================
   UPDATE STAFF UI
   ========================================================= */

function updateStaffUI() {
  const status = document.getElementById('staffStatus');
  const loginButton = document.getElementById('staffLoginBtn');
  const logoutButton = document.getElementById('staffLogoutBtn');

  const role = getActiveRole();

  if (status) {
    if (role === 'tuxadmin') {
      status.textContent = 'Tux Admin Logged In';
    } else if (role === 'admin') {
      status.textContent = 'Admin Logged In';
    } else if (role === 'worker') {
      const names = Array.isArray(activeStaffIds)
        ? activeStaffIds
          .map(id => {
            const worker = Array.isArray(workersList)
              ? workersList.find(
                item => String(item.id) === String(id)
              )
              : null;

            return worker ? worker.name : null;
          })
          .filter(Boolean)
        : [];

      status.textContent = names.length
        ? names.join(' + ')
        : 'Worker Logged In';
    } else {
      status.textContent = 'Not Logged In';
    }
  }

  if (loginButton) {
    loginButton.style.display = 'inline-block';
  }

  if (logoutButton) {
    logoutButton.style.display = role
      ? 'inline-block'
      : 'none';
  }

  /*
     This is the main visibility fix.
     When there is no active role, navbar.html is
     switched to logged-out mode by its real .top-nav
     container. Only Staff Login remains visible.
  */

  updateTuxNavbarVisibility();
}


/* =========================================================
   ALIAS USED BY EXISTING CODE
   ========================================================= */

function updateStaffStatus() {
  updateStaffUI();
}


/* =========================================================
   ROLE PERMISSIONS
   ========================================================= */


function applyRolePermissions() {
  const role = getActiveRole();

  const restrictedViews = [
    'expenses',
    'sales',
    'workers',
    'gamiya',
    'settings'
  ];  

  restrictedViews.forEach(viewName => {
    const button = document.getElementById(
      'nav' +
      viewName.charAt(0).toUpperCase() +
      viewName.slice(1)
    );

    if (!button) return;

    button.style.display = role === 'worker' ? 'none' : '';
  });

  
  const stockButton = document.getElementById('navStock');

  if (stockButton) {
    stockButton.style.display = '';
  }

  const hawalkNav = document.getElementById('navHawalk');

  if (hawalkNav) {
    hawalkNav.style.display =
      role === 'admin' || role === 'tuxadmin'
        ? ''
        : 'none';
  }

  const hawalkCashierButton =
    document.getElementById('hawalkCashierBtn');

  if (hawalkCashierButton) {
    hawalkCashierButton.style.display =
      role === 'worker' ? 'block' : 'none';
  }

  const workersView = document.getElementById('workers-view');

  if (workersView && role === 'worker') {
    workersView.classList.remove('active');
  }

 

  if (typeof applyHawalkRoleUI === 'function') {
    applyHawalkRoleUI();
  }

  if (typeof renderStockSettings === 'function') {
    renderStockSettings();
  }

  if (typeof refreshExpensesPermissions === 'function') {
    refreshExpensesPermissions();
  }

  if (typeof refreshAdminReportPermissions === 'function') {
    refreshAdminReportPermissions();
  }

  const financeControls =
    document.getElementById('financeControls');

  if (financeControls) {
    financeControls.style.display =
      role === 'tuxadmin' ? 'flex' : 'none';
  }

  const adminAccountSection =
    document.getElementById('adminAccountSection');

  if (adminAccountSection) {
    adminAccountSection.style.display =
      role === 'tuxadmin' ? '' : 'none';
  }

  const tuxAdminSection =
    document.getElementById('tuxAdminSection');

  if (tuxAdminSection) {
    tuxAdminSection.style.display =
      role === 'tuxadmin' ? '' : 'none';
  }

  const passwordManager =
    document.getElementById('passwordsManagerSection');

  if (passwordManager) {
    passwordManager.style.display =
      role === 'tuxadmin' ? '' : 'none';
  }

  const addWorkerButton =
    document.getElementById('addWorkerBtn');

  if (addWorkerButton) {
    addWorkerButton.disabled = role !== 'tuxadmin';
  }

  const saveAdminButton =
    document.getElementById('saveAdminAccountBtn');

  if (saveAdminButton) {
    saveAdminButton.disabled = role !== 'tuxadmin';
  }

  const saveTuxButton =
    document.getElementById('saveTuxAdminBtn');

  if (saveTuxButton) {
    saveTuxButton.disabled = role !== 'tuxadmin';
  }

  const addStockButton =
    document.getElementById('addStockItemBtn');

  if (addStockButton) {
    addStockButton.style.display =
      role === 'tuxadmin' ? '' : 'none';
  }

  const hawalkView =
    document.getElementById('hawalk-view');

  if (hawalkView && role === 'worker') {
    hawalkView.classList.remove('active');
  }

  updateStaffUI();
}


/* =========================================================
   ADMIN REPORT PERMISSIONS
   ========================================================= */

function refreshAdminReportPermissions() {
  const role = getActiveRole();

  const editButton =
    document.getElementById('adminReportEditBtn');

  const resetButton =
    document.getElementById('adminReportResetBtn');

  if (editButton) {
    editButton.style.display =
      role === 'admin' || role === 'tuxadmin'
        ? 'inline-block'
        : 'none';
  }

  if (resetButton) {
    resetButton.style.display =
      role === 'tuxadmin' ? 'inline-block' : 'none';
  }
}


/* =========================================================
   EXPENSE PERMISSIONS
   ========================================================= */

function refreshExpensesPermissions() {
  const role = getActiveRole();

  const saveExpenseButton =
    document.getElementById('saveExpenseBtn');

  const deleteAllButton =
    document.getElementById('deleteAllExpensesBtn');

  if (saveExpenseButton) {
    saveExpenseButton.disabled =
      role === 'admin' || !role;
  }

  if (deleteAllButton) {
    deleteAllButton.style.display =
      role === 'tuxadmin' ? 'inline-block' : 'none';
  }
}


/* =========================================================
   ADMIN ACCOUNT
   ========================================================= */

function saveAdminAccount() {
  if (!isTuxAdmin()) {
    alert('Only Tux Admin can change the Admin account.');
    return;
  }

  const nameInput = document.getElementById('adminName');
  const passwordInput =
    document.getElementById('adminPasswordInput');

  const name = nameInput
    ? String(nameInput.value || '').trim()
    : '';

  const password = passwordInput
    ? String(passwordInput.value || '').trim()
    : '';

  if (!name) {
    alert('Please enter the Admin name.');
    return;
  }

  if (!password) {
    alert('Please enter the Admin password.');
    return;
  }

  adminAccount = {
    ...(adminAccount || {}),
    name,
    password
  };

  localStorage.setItem(
    'tuxAdminAccount',
    JSON.stringify(adminAccount)
  );

  if (nameInput) nameInput.value = '';
  if (passwordInput) passwordInput.value = '';

  renderAdminAccountStatus();

  alert('Admin account saved successfully.');
}


/* =========================================================
   ADMIN ACCOUNT STATUS
   ========================================================= */

function renderAdminAccountStatus() {
  const status =
    document.getElementById('adminAccountStatus');

  if (!status) return;

  if (adminAccount && adminAccount.name) {
    status.textContent =
      `Admin account: ${adminAccount.name}`;

    status.style.color = '#2ecc71';
  } else {
    status.textContent =
      'No Admin account configured.';

    status.style.color = '#e67e22';
  }
}


/* =========================================================
   DEFAULT PERMISSIONS INITIALIZATION
   ========================================================= */

function initializeAuthUI() {
  ensureTuxNavbarVisibilityStyles();
  updateStaffUI();
  renderAdminAccountStatus();
  applyRolePermissions();
}


/* =========================================================
   START AUTH UI AFTER DOM
   ========================================================= */

function startTuxAuthUI() {
  ensureTuxNavbarVisibilityStyles();

  /*
     Restore any saved session before determining
     whether the navbar should be visible.
  */

  restoreLoginSession();

  initializeAuthUI();
  startTuxSharedSessionWatcher();
}


if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    function () {
      startTuxAuthUI();
    },
    { once: true }
  );
} else {
  startTuxAuthUI();
}


/* =========================================================
   TUX POS — SINGLE-DEVICE WORKER LOGIN
   Each browser tab has its own worker session token.
   Supabase enforces one active session per worker.
   ========================================================= */

const TUX_WORKER_SESSION_TOKENS_KEY = 'tuxWorkerSessionTokens';


/* =========================================================
   SHARED SESSION VERSION CHECK
   Preserves the existing nightly logout mechanism.
   Does not modify End Shift or attendance.
   ========================================================= */

async function checkTuxSharedSessionVersion() {
  try {
    const currentVersion = await getTuxSharedSessionVersion();

    // Each tab checks its own saved version.
    const savedVersion = sessionStorage.getItem(
      TUX_SESSION_VERSION_KEY
    );

    // No saved version: do not infer a logout from a missing value.
    if (savedVersion === null) {
      return;
    }

    if (String(savedVersion) !== String(currentVersion)) {
      console.warn(
        'TUX POS — Shared session version changed. Logging out this tab.'
      );

      clearTuxLocalLogin();
    }
  } catch (error) {
    // Temporary connectivity problems must not cause an immediate logout.
    console.error(
      'TUX POS — Shared session version check failed:',
      error
    );
  }
}


/* =========================================================
   READ THIS TAB'S WORKER SESSION TOKENS
   ========================================================= */

function getTuxWorkerSessionTokens() {
  try {
    const stored = sessionStorage.getItem(
      TUX_WORKER_SESSION_TOKENS_KEY
    );

    if (!stored) {
      return {};
    }

    const tokens = JSON.parse(stored);

    if (
      !tokens ||
      typeof tokens !== 'object' ||
      Array.isArray(tokens)
    ) {
      return {};
    }

    return tokens;
  } catch (error) {
    console.error(
      'TUX POS — Failed to read worker session tokens:',
      error
    );

    return {};
  }
}


/* =========================================================
   SAVE THIS TAB'S WORKER SESSION TOKENS
   ========================================================= */

function saveTuxWorkerSessionTokens(tokens) {
  sessionStorage.setItem(
    TUX_WORKER_SESSION_TOKENS_KEY,
    JSON.stringify(tokens || {})
  );
}



/* =========================================================
   ACQUIRE WORKER SESSION
   Supabase revokes the previous session for this worker.
   ========================================================= */

async function acquireTuxWorkerSession(worker, password) {
  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {
    throw new Error('Supabase client is unavailable.');
  }

  if (
    !worker ||
    !worker.id ||
    !worker.name
  ) {
    throw new Error('Invalid worker information.');
  }

  const deviceLabel = [
    navigator.userAgentData?.platform ||
    navigator.platform ||
    'Unknown platform',

    navigator.userAgent.includes('Firefox/')
      ? 'Firefox'
      : navigator.userAgent.includes('Edg/')
        ? 'Edge'
        : navigator.userAgent.includes('Chrome/')
          ? 'Chrome'
          : navigator.userAgent.includes('Safari/')
            ? 'Safari'
            : 'Unknown browser'
  ].join(' - ');

  const { data, error } = await supabaseClient.rpc(
    'acquire_tux_worker_session',
    {
      p_worker_id: worker.id,
      p_password: password,
      p_worker_name: worker.name,
      p_device_label: deviceLabel
    }
  );

  if (error) {
    console.error(
      'TUX POS — Failed to acquire worker session:',
      error
    );

    throw new Error('Could not create a worker session.');
  }

  if (!data || data.ok !== true || !data.token) {
    if (data?.reason === 'invalid_credentials') {
      alert('Invalid worker credentials or inactive worker.');
      return null;
    }

    throw new Error(
      'Supabase did not return a valid worker session.'
    );
  }

  // Save the token in this tab only.
  const tokens = getTuxWorkerSessionTokens();

  tokens[String(worker.id)] = data.token;

  saveTuxWorkerSessionTokens(tokens);

  return {
    token: data.token,
    workerId: String(worker.id)
  };
}


/* =========================================================
   RELEASE WORKER SESSION
   ========================================================= */

async function releaseTuxWorkerSession(workerId) {
  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {
    throw new Error('Supabase client is unavailable.');
  }

  const key = String(workerId);
  const tokens = getTuxWorkerSessionTokens();
  const token = tokens[key];

  if (!token) {
    return false;
  }

  const { data, error } = await supabaseClient.rpc(
    'release_tux_worker_session',
    {
      p_worker_id: workerId,
      p_session_token: token
    }
  );

  if (error) {
    console.error(
      'TUX POS — Failed to release worker session:',
      error
    );

    throw new Error('Could not release the worker session.');
  }

  // Remove only this tab's token after a definitive result.
  if (data === true || data === false) {
    delete tokens[key];
    saveTuxWorkerSessionTokens(tokens);
  }

  return data === true;
}


/* =========================================================
   CHECK ONE WORKER SESSION
   ========================================================= */

async function checkTuxWorkerSession(workerId) {
  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {
    return null;
  }

  const key = String(workerId);
  const tokens = getTuxWorkerSessionTokens();
  const token = tokens[key];

  if (!token) {
    return false;
  }

  try {
    const { data, error } = await supabaseClient.rpc(
      'check_tux_worker_session',
      {
        p_worker_id: workerId,
        p_session_token: token
      }
    );

    if (error) {
      console.error(
        'TUX POS — Worker session check failed:',
        key,
        error
      );

      // Do not log out during a temporary network/RPC failure.
      return null;
    }

    return data === true;
  } catch (error) {
    console.error(
      'TUX POS — Worker session check failed:',
      key,
      error
    );

    return null;
  }
}






