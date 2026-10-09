
/* =========================================================
   TUX POS — AUTH / ROLES / STAFF LOGIN
   Shared session version and nightly logout support
   ========================================================= */


/* =========================================================
   SHARED SESSION CONFIGURATION
   ========================================================= */

const TUX_SESSION_VERSION_KEY = 'tuxSessionVersion';
const TUX_SESSION_CHECK_INTERVAL = 15000;


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

  sessionStorage.setItem(
    TUX_SESSION_VERSION_KEY,
    version
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
  } catch (error) {
    console.error(
      'TUX POS — Failed to clear session storage:',
      error
    );
  }

  updateStaffUI();

  if (typeof applyRolePermissions === 'function') {
    applyRolePermissions();
  }

  if (shouldReload && typeof window !== 'undefined') {
    window.location.reload();
  }
}


/* =========================================================
   VALIDATE RESTORED SESSION
   ========================================================= */

async function validateTuxRestoredSession() {
  const hasLocalLogin =
    tuxAdminActive === true ||
    adminActive === true ||
    (
      Array.isArray(activeStaffIds) &&
      activeStaffIds.length > 0
    );

  if (!hasLocalLogin) return true;

  let savedVersion = null;

  try {
    savedVersion = sessionStorage.getItem(
      TUX_SESSION_VERSION_KEY
    );
  } catch (error) {
    console.error(
      'TUX POS — Could not read the saved session version:',
      error
    );
  }

  if (!savedVersion) {
    console.warn(
      'TUX POS — Saved login has no shared session version. Logging out.'
    );

    clearTuxLocalLogin();
    return false;
  }

  try {
    const currentVersion =
      await getTuxSharedSessionVersion();

    if (String(savedVersion) !== String(currentVersion)) {
      console.warn(
        'TUX POS — Shared session changed. Logging out.'
      );

      clearTuxLocalLogin();
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      'TUX POS — Could not validate the shared session:',
      error
    );

    return false;
  }
}


/* =========================================================
   SHARED SESSION WATCHER
   ========================================================= */

async function checkTuxSharedSessionVersion() {
  const hasLocalLogin =
    tuxAdminActive === true ||
    adminActive === true ||
    (
      Array.isArray(activeStaffIds) &&
      activeStaffIds.length > 0
    );

  if (!hasLocalLogin) return;

  if (window.tuxSessionCheckInProgress === true) {
    return;
  }

  window.tuxSessionCheckInProgress = true;

  try {
    const savedVersion = sessionStorage.getItem(
      TUX_SESSION_VERSION_KEY
    );

    if (!savedVersion) {
      clearTuxLocalLogin();
      return;
    }

    const currentVersion =
      await getTuxSharedSessionVersion();

    if (String(savedVersion) !== String(currentVersion)) {
      console.warn(
        'TUX POS — Nightly session reset detected.'
      );

      clearTuxLocalLogin();
      return;
    }
  } catch (error) {
    console.error(
      'TUX POS — Shared session check failed:',
      error
    );
  } finally {
    window.tuxSessionCheckInProgress = false;
  }
}


function startTuxSharedSessionWatcher() {
  if (window.tuxSharedSessionWatcher) return;

  void checkTuxSharedSessionVersion();

  window.tuxSharedSessionWatcher =
    window.setInterval(function () {
      void checkTuxSharedSessionVersion();
    }, TUX_SESSION_CHECK_INTERVAL);
}


/* =========================================================
   LOGIN SESSION
   ========================================================= */

function saveLoginSession() {
  try {
    sessionStorage.setItem(
      'tuxTuxAdminActive',
      tuxAdminActive ? 'true' : 'false'
    );

    sessionStorage.setItem(
      'tuxAdminActive',
      adminActive ? 'true' : 'false'
    );

    sessionStorage.setItem(
      'tuxActiveStaffIds',
      JSON.stringify(
        Array.isArray(activeStaffIds)
          ? activeStaffIds
          : []
      )
    );
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

    const savedStaffIds =
      sessionStorage.getItem('tuxActiveStaffIds');

    tuxAdminActive = savedTuxAdmin === 'true';
    adminActive = savedAdmin === 'true';

    let restoredStaffIds = [];

    if (savedStaffIds) {
      try {
        const parsed = JSON.parse(savedStaffIds);

        if (Array.isArray(parsed)) {
          restoredStaffIds = parsed;
        }
      } catch (error) {
        console.warn(
          'TUX POS — Invalid saved staff session:',
          error
        );
      }
    }

    const validWorkerIds =
      Array.isArray(workersList)
        ? workersList.map(worker => String(worker.id))
        : [];

    activeStaffIds = restoredStaffIds
      .map(id => String(id))
      .filter(id => validWorkerIds.includes(id));

    if (tuxAdminActive) {
      adminActive = false;
    }

    if (!Array.isArray(activeStaffIds)) {
      activeStaffIds = [];
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
        activeStaffIds
      }
    );

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
     TUX ADMIN
  */

  const tuxPassword =
    adminAccount && adminAccount.tuxPassword
      ? String(adminAccount.tuxPassword)
      : DEFAULT_TUX_ADMIN_PASSWORD;

  if (enteredPassword === tuxPassword) {
    try {
      await stampTuxSessionVersionAfterLogin();
    } catch (error) {
      console.error(
        'TUX POS — Could not verify the shared session:',
        error
      );

      alert(
        'Unable to verify the shared session with Supabase. Please check your connection and try again.'
      );

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
     ADMIN
  */

  if (
    adminAccount &&
    adminAccount.password &&
    enteredPassword === String(adminAccount.password)
  ) {
    try {
      await stampTuxSessionVersionAfterLogin();
    } catch (error) {
      console.error(
        'TUX POS — Could not verify the shared session:',
        error
      );

      alert(
        'Unable to verify the shared session with Supabase. Please check your connection and try again.'
      );

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
     WORKER
  */

  const worker = Array.isArray(workersList)
    ? workersList.find(
        item =>
          item &&
          String(item.password || '') === enteredPassword
      )
    : null;

  if (worker) {
    try {
      await stampTuxSessionVersionAfterLogin();
    } catch (error) {
      console.error(
        'TUX POS — Could not verify the shared session:',
        error
      );

      alert(
        'Unable to verify the shared session with Supabase. Please check your connection and try again.'
      );

      return;
    }

    const workerId = String(worker.id);

    if (!Array.isArray(activeStaffIds)) {
      activeStaffIds = [];
    }

    if (
      !activeStaffIds.some(
        id => String(id) === workerId
      )
    ) {
      activeStaffIds.push(workerId);
    }

    tuxAdminActive = false;
    adminActive = false;

    try {
      if (typeof createAttendanceSession === 'function') {
        createAttendanceSession(worker.id);
      }
    } catch (error) {
      console.error(
        'TUX POS — Failed to create attendance session:',
        error
      );
    }

    worker.attendance = true;
    saveLoginSession();

    try {
      localStorage.setItem(
        'tuxWorkersList',
        JSON.stringify(workersList)
      );
    } catch (error) {
      console.error(
        'TUX POS — Failed to save workers:',
        error
      );
    }

    closeStaffLogin();
    updateStaffUI();
    applyRolePermissions();

    if (typeof updateStaffStatus === 'function') {
      updateStaffStatus();
    }

    alert(`${worker.name || 'Worker'} logged in successfully.`);
    return;
  }

  alert('Invalid password.');
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
     * Wait for Supabase to close the attendance session.
     * Do not log out locally if saving fails.
     */

    await endAttendanceSession(worker.id);

    activeStaffIds = activeStaffIds.filter(
      id => String(id) !== String(worker.id)
    );

    /*
     * Do not set worker.attendance = false.
     * Attendance must remain an array of session records.
     */

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

    console.error(
      'TUX POS — Worker logout failed:',
      error
    );

    alert(
      'Logout failed because the attendance session could not be closed. Please try again.'
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

    if (role === 'worker') {
      button.style.display = 'none';
    } else {
      button.style.display = '';
    }
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