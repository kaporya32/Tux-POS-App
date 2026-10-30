
/* =========================================================
   TUX POS — AUTH / ROLES / STAFF LOGIN
   Shared session version and nightly logout support
   ========================================================= */
const TUX_SESSION_VERSION_KEY = 'tuxSessionVersion';
const TUX_SESSION_CHECK_INTERVAL = 5 * 1000;
let activeAdminId = null;
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
/* =========================================================
   TUX POS — ROLE HELPERS
   Supports multiple simultaneously logged-in roles
   ========================================================= */

/* =========================================================
   GET ALL ACTIVE ROLES
   ========================================================= */

function getActiveRoles() {

  const roles = [];

  if (tuxAdminActive === true) {
    roles.push('tuxadmin');
  }

  if (adminActive === true) {
    roles.push('admin');
  }

  if (
    Array.isArray(activeStaffIds) &&
    activeStaffIds.length > 0
  ) {
    roles.push('worker');
  }

  return roles;

}
/* =========================================================
   CHECK WHETHER A ROLE IS ACTIVE
   ========================================================= */

function hasRole(role) {

  return getActiveRoles().includes(
    String(role).toLowerCase()
  );

}
/* =========================================================
   GET PRIMARY ROLE
   Keeps compatibility with existing functions that
   expect only one role.
   ========================================================= */
function getActiveRole() {

  if (hasRole('tuxadmin')) {
    return 'tuxadmin';
  }

  if (hasRole('admin')) {
    return 'admin';
  }

  if (hasRole('worker')) {
    return 'worker';
  }

  return null;

}
/* =========================================================
   ROLE CHECKS
   ========================================================= */
function isTuxAdmin() {

  return hasRole('tuxadmin');

}
function isAdminSpectateMode() {

  return hasRole('admin') && !hasRole('tuxadmin');

}
function canEdit() {

  return hasRole('tuxadmin') || hasRole('worker');

}
function canEditAdminReports() {
  return hasRole('tuxadmin') || hasRole('admin');
}

function isWorkerLoggedIn() {
  return (
    Array.isArray(activeStaffIds) &&
    activeStaffIds.length > 0
  );
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

/* =========================================================
   TUX POS — MULTI-ROLE NAVBAR VISIBILITY
   Keep the navbar visible while any role is logged in.
   ========================================================= */
function updateTuxNavbarVisibility() {

  ensureTuxNavbarVisibilityStyles();

  const navbar = document.querySelector('.top-nav');

  if (!navbar) {

    if (
      typeof window.__tuxNavbarVisibilityRetries !== 'number'
    ) {
      window.__tuxNavbarVisibilityRetries = 0;
    }

    if (window.__tuxNavbarVisibilityRetries < 20) {

      window.__tuxNavbarVisibilityRetries++;

      setTimeout(() => {
        updateTuxNavbarVisibility();
      }, 250);

      return;
    }

    console.warn(
      'TUX POS — Navbar .top-nav was not found after waiting for it to load.'
    );

    window.__tuxNavbarVisibilityRetries = 0;

    return;
  }

  window.__tuxNavbarVisibilityRetries = 0;


  /* =======================================================
     CHECK ALL ACTIVE ROLES
     ======================================================= */

  const roles =
    typeof getActiveRoles === 'function'
      ? getActiveRoles()
      : [];


  const loggedIn = roles.length > 0;


  /* =======================================================
     UPDATE NAVBAR STATE
     ======================================================= */

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

/* ========================================================
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
      // Check worker sessions only.
      // Shared session-version checks have been removed.
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
    // TUX Admin login state.
    sessionStorage.setItem(
      'tuxTuxAdminActive',
      tuxAdminActive ? 'true' : 'false'
    );

    // Regular Admin login state.
    sessionStorage.setItem(
      'tuxAdminActive',
      adminActive ? 'true' : 'false'
    );

    // Remember which regular Admin is logged in.
    sessionStorage.setItem(
      'tuxActiveAdminId',
      activeAdminId ? String(activeAdminId) : ''
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

    // Remove legacy shared worker-login state.
    // Keep worker session tokens untouched.
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
/* =========================================================
   TUX POS — RESTORE MULTI-ROLE LOGIN SESSION
   Restores TUX Admin, Admin, and Worker independently.
   ========================================================= */

/* =========================================================
   TUX POS — RESTORE LOGIN SESSION
   Globally accessible from main.js
   ========================================================= */

/* =========================================================
   TUX POS — RESTORE LOGIN SESSION
   ========================================================= */
window.restoreLoginSession = async function restoreLoginSession() {
  try {

    console.log(
      'TUX POS — Restoring saved login session...'
    );
    /* =====================================================
       RESTORE SAVED ROLE STATES
       ===================================================== */
    const savedTuxAdmin =
      sessionStorage.getItem('tuxTuxAdminActive');

    const savedAdmin =
      sessionStorage.getItem('tuxAdminActive');

    const savedAdminId =
      sessionStorage.getItem('tuxActiveAdminId');

    const savedStaffIds =
      sessionStorage.getItem('tuxActiveStaffIds');
    tuxAdminActive = savedTuxAdmin === 'true';
    adminActive = savedAdmin === 'true';
    activeAdminId =
      adminActive && savedAdminId
        ? String(savedAdminId)
        : null;

    /* =====================================================
       RESTORE WORKER IDS
       ===================================================== */
    let restoredStaffIds = [];

    if (savedStaffIds) {

      try {

        const parsed = JSON.parse(savedStaffIds);

        if (Array.isArray(parsed)) {

          restoredStaffIds = [
            ...new Set(
              parsed
                .filter(
                  id =>
                    id !== null &&
                    id !== undefined
                )
                .map(id => String(id))
                .filter(
                  id => id.trim() !== ''
                )
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

    /* =====================================================
       VALIDATE WORKER IDS
       ===================================================== */
    const workersLoaded =
      Array.isArray(workersList) &&
      workersList.length > 0;


    if (workersLoaded) {

      const validWorkerIds = new Set(

        workersList

          .filter(worker =>
            worker &&
            worker.id !== null &&
            worker.id !== undefined &&
            worker.role === 'worker' &&
            worker.active !== false
          )
          .map(worker => String(worker.id))

      );
      activeStaffIds = restoredStaffIds.filter(
        id => validWorkerIds.has(id)
      );

    } else {

      activeStaffIds = restoredStaffIds;
    }

    /* =====================================================
       PRESERVE INDEPENDENT ROLE STATES
       ===================================================== */

    if (!adminActive) {

      activeAdminId = null;

    }

    /* =====================================================
       SAVE SESSION
       ===================================================== */
    saveLoginSession();

    /* =====================================================
       REFRESH USER INTERFACE
       ===================================================== */
    updateStaffUI();

    if (typeof applyRolePermissions === 'function') {

      applyRolePermissions();

    }
    if (typeof updateStaffStatus === 'function') {

      updateStaffStatus();
    }
    /* =====================================================
       LOG RESTORED SESSION
       ===================================================== */
    console.log(
      'TUX POS — Login session restored:',
      {
        roles:
          typeof getActiveRoles === 'function'
            ? getActiveRoles()
            : [],

        tuxAdminActive,

        adminActive,

        activeAdminId,

        activeStaffIds,

        workersLoaded
      }
    );
    /* =====================================================
       VALIDATE RESTORED SESSION
       ===================================================== */

    if (
      typeof validateTuxRestoredSession === 'function'
    ) {

      void validateTuxRestoredSession();

    } else {

      console.warn(
        'TUX POS — validateTuxRestoredSession() is unavailable.'
      );

    }


  } catch (error) {

    console.error(
      'TUX POS — Failed to restore login session:',
      error
    );

    tuxAdminActive = false;
    adminActive = false;
    activeAdminId = null;
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
    if (typeof applyRolePermissions === 'function') {

      applyRolePermissions();
    }
  }
};

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
   TUX POS — SHARED ONLINE PRESENCE
   Independent sessions for Worker, Admin, and TUX Admin.
   ========================================================= */

const TUX_ONLINE_TOKENS_KEY = 'tuxOnlinePresenceTokens';

const TUX_ONLINE_HEARTBEAT_INTERVAL = 30000;

const TUX_ONLINE_REFRESH_INTERVAL = 30000;

let tuxOnlinePresenceWatcher = null;

let tuxOnlinePresenceRefreshTimer = null;

let tuxOnlinePresenceCache = [];


/* =========================================================
   GET LOCAL PRESENCE TOKENS
   ========================================================= */

function getTuxOnlinePresenceTokens() {
  try {
    const raw = sessionStorage.getItem(
      TUX_ONLINE_TOKENS_KEY
    );

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    return (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    )
      ? parsed
      : {};

  } catch (error) {
    console.error(
      'TUX POS — Could not read online presence tokens:',
      error
    );

    return {};
  }
}

/* =========================================================
   SAVE LOCAL PRESENCE TOKENS
   ========================================================= */

function saveTuxOnlinePresenceTokens(tokens) {
  try {
    sessionStorage.setItem(
      TUX_ONLINE_TOKENS_KEY,
      JSON.stringify(tokens)
    );

    return true;

  } catch (error) {
    console.error(
      'TUX POS — Could not save online presence tokens:',
      error
    );

    return false;
  }
}

/* =========================================================
   REGISTER ONE ONLINE SESSION
   ========================================================= */

async function registerTuxOnlinePresence({
  role,
  accountId,
  password = '',
  displayName,
  deviceLabel = 'Unknown browser'
}) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedAccountId = String(accountId || '').trim();
  const normalizedDisplayName = String(displayName || '').trim();

  if (!['worker', 'admin', 'tuxadmin'].includes(normalizedRole)) {
    throw new Error('Invalid online presence role.');
  }

  if (!normalizedAccountId || !normalizedDisplayName) {
    throw new Error('Account ID and display name are required.');
  }

  /*
   * TUX Admin must use the client that authenticated it.
   * Workers and regular Admins keep using supabaseClient.
   */
  const authClient =
    normalizedRole === 'tuxadmin'
      ? tuxAdminAuthClient
      : supabaseClient;

  if (!authClient) {
    throw new Error('Supabase authentication client is unavailable.');
  }

  /*
   * Confirm that the correct client has an authenticated session.
   */
  if (normalizedRole === 'tuxadmin') {
    const {
      data: sessionData,
      error: sessionError
    } = await authClient.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!sessionData?.session?.user?.id) {
      throw new Error(
        'TUX Admin Supabase session is missing.'
      );
    }

    if (
      String(sessionData.session.user.id) !==
      normalizedAccountId
    ) {
      throw new Error(
        'TUX Admin authenticated account does not match the login account.'
      );
    }
  }

  /*
   * Register online presence using the correct authenticated client.
   */
  const {
    data,
    error
  } = await authClient.rpc(
    'register_tux_online_session',
    {
      p_role: normalizedRole,
      p_account_id: normalizedAccountId,
      p_password: String(password || ''),
      p_display_name: normalizedDisplayName,
      p_device_label: String(deviceLabel || 'Unknown browser')
    }
  );

  if (error) {
    console.error(
      'TUX POS — Online presence registration failed:',
      error
    );

    throw error;
  }

  if (!data || data.ok !== true || !data.session_token) {
    throw new Error(
      'Online presence registration failed: ' +
      String(data?.reason || 'unknown error')
    );
  }

  /*
   * Save the session token.
   */
  const tokenKey =
    normalizedRole + ':' + normalizedAccountId;

  const tokens = getTuxOnlinePresenceTokens();

  tokens[tokenKey] = {
    role: normalizedRole,
    accountId: normalizedAccountId,
    displayName: normalizedDisplayName,
    token: data.session_token
  };

  if (!saveTuxOnlinePresenceTokens(tokens)) {
    try {
      await authClient.rpc(
        'logout_tux_online_session',
        {
          p_session_token: data.session_token
        }
      );
    } catch (cleanupError) {
      console.error(
        'TUX POS — Presence cleanup failed:',
        cleanupError
      );
    }

    throw new Error(
      'Could not save the online session in this browser.'
    );
  }

  /*
   * Synchronize Realtime Presence.
   */
  if (
    window.tuxOnlinePresenceRealtimeChannel &&
    typeof syncTuxOnlinePresenceTracking === 'function'
  ) {
    await syncTuxOnlinePresenceTracking();
  }

  /*
   * Preserve attendance displays.
   */
  if (typeof renderTodayWorkers === 'function') {
    renderTodayWorkers();
  }

  if (typeof renderTodayAdmins === 'function') {
    renderTodayAdmins();
  }

  return data.session_token;
}
/* =========================================================
   SEND HEARTBEATS FOR THIS BROWSER'S SESSIONS
   ========================================================= */

async function heartbeatTuxOnlinePresence() {
  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {
    return;
  }

  const tokens = getTuxOnlinePresenceTokens();

  for (const [key, session] of Object.entries(tokens)) {
    if (!session || !session.token) {
      continue;
    }

    try {
      const { data, error } = await supabaseClient.rpc(
        'heartbeat_tux_online_session',
        {
          p_session_token: session.token
        }
      );

      if (error) {
        console.error(
          'TUX POS — Presence heartbeat failed:',
          key,
          error
        );

        continue;
      }

      if (data !== true) {
        console.warn(
          'TUX POS — Presence session is no longer active:',
          key
        );

        const latestTokens =
          getTuxOnlinePresenceTokens();

        if (
          latestTokens[key]?.token === session.token
        ) {
          delete latestTokens[key];

          saveTuxOnlinePresenceTokens(latestTokens);
        }
      }

    } catch (error) {
      console.error(
        'TUX POS — Presence heartbeat failed:',
        key,
        error
      );
    }
  }
}

/* =========================================================
   LOAD SHARED ONLINE PRESENCE
   ========================================================= */

async function loadTuxOnlinePresence() {
  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {
    return tuxOnlinePresenceCache;
  }

  try {
    const { data, error } = await supabaseClient.rpc(
      'get_tux_online_presence'
    );

    if (error) {
      console.error(
        'TUX POS — Could not load online presence:',
        error
      );

      return tuxOnlinePresenceCache;
    }

    tuxOnlinePresenceCache = Array.isArray(data)
      ? data
      : [];

    return tuxOnlinePresenceCache;

  } catch (error) {
    console.error(
      'TUX POS — Could not load online presence:',
      error
    );

    return tuxOnlinePresenceCache;
  }
}

/* =========================================================
   START SHARED ONLINE PRESENCE WATCHER
   ========================================================= */


/* =========================================================
   TUX POS — SHARED ONLINE USERS NAVBAR
   Displays TUX Admin, Admins, and Workers across browsers
   ========================================================= */


/* =========================================================
   RENDER ONLINE USERS IN THE EXISTING NAVBAR
   ========================================================= */


function renderNavbarOnlineUsers() {

  const listElement = document.getElementById(
    'navOnlineUsersList'
  );

  if (!listElement) return;

  const sessions = Array.isArray(tuxOnlinePresenceCache)
    ? tuxOnlinePresenceCache
    : [];

  const onlineAccounts = new Map();

  sessions.forEach(function (session) {

    if (
      !session ||
      !session.account_id ||
      !session.role ||
      session.logged_out_at
    ) {
      return;
    }

    const role = String(session.role).toLowerCase();

    if (!['worker', 'admin', 'tuxadmin'].includes(role)) {
      return;
    }

    const key = role + ':' + String(session.account_id);

    if (!onlineAccounts.has(key)) {
      onlineAccounts.set(key, session);
    }

  });

  const roleOrder = {
    tuxadmin: 0,
    admin: 1,
    worker: 2
  };

  const users = Array.from(onlineAccounts.values());

  users.sort(function (a, b) {

    const roleA = String(a.role).toLowerCase();
    const roleB = String(b.role).toLowerCase();

    return (
      roleOrder[roleA] - roleOrder[roleB] ||
      String(a.display_name || '').localeCompare(
        String(b.display_name || '')
      )
    );

  });

  listElement.textContent = users.length
    ? users.map(function (user) {
        return String(
          user.display_name ||
          (String(user.role).toLowerCase() === 'tuxadmin'
            ? 'TUX Admin'
            : 'Unknown user')
        );
      }).join(' + ')
    : 'No users online';

}


/* =========================================================
   REFRESH ONLINE PRESENCE AND UPDATE THE NAVBAR
   Includes every active role in this browser.
   ========================================================= */

async function refreshTuxOnlinePresenceDisplay() {

  /*
   * Realtime Presence is the sole source for the live navbar.
   * Do not merge database sessions or locally stored tokens here.
   */

  if (
    typeof syncTuxOnlinePresenceTracking === 'function' &&
    window.tuxOnlinePresenceRealtimeChannel
  ) {
    await syncTuxOnlinePresenceTracking();
  }

  /*
   * Preserve the existing attendance displays.
   */

  if (typeof renderTodayWorkers === 'function') {
    renderTodayWorkers();
  }

  if (typeof renderTodayAdmins === 'function') {
    renderTodayAdmins();
  }
}

/* =========================================================
   START ONLINE PRESENCE WATCHER
   ========================================================= */

function startTuxOnlinePresenceWatcher() {
  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {
    console.error(
      'TUX POS — Supabase client is unavailable.'
    );
    return;
  }

  // Reuse the existing channel if it has already been created.
  if (window.tuxOnlinePresenceRealtimeChannel) {
    syncTuxOnlinePresenceTracking();
    return;
  }

  // Give each browser tab its own stable Presence key.
  let clientKey = sessionStorage.getItem(
    'tuxPresenceClientKey'
  );

  if (!clientKey) {
    clientKey =
      'tux-pos-' +
      (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Date.now() + '-' + Math.random().toString(36).slice(2)
      );

    sessionStorage.setItem(
      'tuxPresenceClientKey',
      clientKey
    );
  }

  const channel = supabaseClient.channel(
    'tux-online-presence-realtime',
    {
      config: {
        presence: {
          key: clientKey
        }
      }
    }
  );

  window.tuxOnlinePresenceRealtimeChannel = channel;

  function renderPresenceUsers() {
    const state = channel.presenceState();
    const accounts = new Map();

    Object.values(state).forEach(function (presences) {
      (presences || []).forEach(function (presence) {
        if (!presence) return;

        // Each browser tracks all roles active in that browser.
        const trackedAccounts = Array.isArray(presence.accounts)
          ? presence.accounts
          : (
              presence.account_id && presence.role
                ? [presence]
                : []
            );

        trackedAccounts.forEach(function (user) {
          if (!user || !user.account_id || !user.role) {
            return;
          }

          const role = String(user.role).toLowerCase();

          if (!['worker', 'admin', 'tuxadmin'].includes(role)) {
            return;
          }

          const key = role + ':' + String(user.account_id);

          if (!accounts.has(key)) {
            accounts.set(key, {
              role: role,
              account_id: String(user.account_id),
              display_name: String(
                user.display_name ||
                (role === 'tuxadmin' ? 'TUX Admin' : 'Unknown user')
              )
            });
          }
        });
      });
    });

    const roleOrder = {
      tuxadmin: 0,
      admin: 1,
      worker: 2
    };

    const users = Array.from(accounts.values());

    users.sort(function (a, b) {
      return (
        roleOrder[a.role] - roleOrder[b.role] ||
        a.display_name.localeCompare(b.display_name)
      );
    });

    const listElement = document.getElementById(
      'navOnlineUsersList'
    );

    if (listElement) {
      listElement.textContent = users.length
        ? users.map(function (user) {
            return user.display_name;
          }).join(' + ')
        : 'No users online';
    }

    if (typeof renderTodayWorkers === 'function') {
      renderTodayWorkers();
    }

    if (typeof renderTodayAdmins === 'function') {
      renderTodayAdmins();
    }
  }

  channel
    .on('presence', { event: 'sync' }, renderPresenceUsers)
    .on('presence', { event: 'join' }, renderPresenceUsers)
    .on('presence', { event: 'leave' }, renderPresenceUsers)
    .subscribe(async function (status, error) {
      console.log(
        'TUX POS — Realtime Presence status:',
        status
      );

      if (error) {
        console.error(
          'TUX POS — Realtime Presence error:',
          error
        );
      }

      if (status !== 'SUBSCRIBED') {
        return;
      }

      await syncTuxOnlinePresenceTracking();
      renderPresenceUsers();
    });
}

/*
 * Build the Presence payload from the application's real login state.
 * This function is also called after login/logout state changes.
 */
async function syncTuxOnlinePresenceTracking() {
  const channel = window.tuxOnlinePresenceRealtimeChannel;

  if (!channel) return;
  const accounts = [];
  const seen = new Set();

  function addAccount(role, accountId, displayName) {
    const normalizedRole = String(role || '').toLowerCase();
    const id = String(accountId || '').trim();
    const name = String(displayName || '').trim();

    if (
      !id ||
      !name ||
      !['worker', 'admin', 'tuxadmin'].includes(normalizedRole)
    ) {
      return;
    }

    const key = normalizedRole + ':' + id;

    if (seen.has(key)) return;
    seen.add(key);

    accounts.push({
      role: normalizedRole,
      account_id: id,
      display_name: name
    });
  }

  // Active workers.
  const workerIds = Array.isArray(activeStaffIds)
    ? activeStaffIds
    : [];

  workerIds.forEach(function (workerId) {
    const worker = Array.isArray(workersList)
      ? workersList.find(function (item) {
          return String(item.id) === String(workerId);
        })
      : null;

    if (worker) {
      addAccount(
        'worker',
        worker.id,
        worker.name || worker.display_name
      );
    }
  });

  // Active Admin account.
  if (adminActive === true && activeAdminId) {
    const admin = Array.isArray(workersList)
      ? workersList.find(function (item) {
          return (
            String(item.id) === String(activeAdminId) &&
            String(item.role || '').toLowerCase() === 'admin'
          );
        })
      : null;

    if (admin) {
      addAccount(
        'admin',
        activeAdminId,
        admin.name || admin.display_name
      );
    }
  }

  // Active TUX Admin account, resolved from its saved presence token.
  if (tuxAdminActive === true) {
    const tokens = typeof getTuxOnlinePresenceTokens === 'function'
      ? getTuxOnlinePresenceTokens()
      : {};

    Object.values(tokens || {}).forEach(function (entry) {
      if (
        entry &&
        String(entry.role || '').toLowerCase() === 'tuxadmin' &&
        entry.accountId
      ) {
        addAccount(
          'tuxadmin',
          entry.accountId,
          entry.displayName || 'TUX Admin'
        );
      }
    });
  }

  try {
    if (accounts.length) {
      const { error } = await channel.track({
        accounts: accounts,
        updated_at: new Date().toISOString()
      });

      if (error) {
        console.error(
          'TUX POS — Could not update Realtime Presence:',
          error
        );
      }
    } else {
      await channel.untrack();
    }
  } catch (error) {
    console.error(
      'TUX POS — Realtime Presence tracking failed:',
      error
    );
  }
}

        /* =========================================================
           STAFF LOGIN
           ========================================================= */


        /* =========================================================
           TUX POS — MULTI-ROLE STAFF LOGIN
           Supports TUX Admin + Admin + Worker role flags
           without clearing other active roles.
           ========================================================= */

async function staffLogin(password) {
  const enteredPassword = String(password || '').trim();

  if (!enteredPassword) {
    alert('Please enter your password.');
    return;
  }

  /* =======================================================
     DEVICE LABEL
     ======================================================= */

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


  /* =======================================================
     REGULAR ADMIN LOGIN
     ======================================================= */

  const admin = Array.isArray(workersList)
    ? workersList.find(account =>
        account &&
        account.role === 'admin' &&
        account.active !== false &&
        String(account.password || '') === enteredPassword
      )
    : null;

  if (admin) {
    if (!admin.id) {
      alert('This Admin account has no valid ID in Supabase.');
      return;
    }

    const adminId = String(admin.id);

    if (
      adminActive === true &&
      String(activeAdminId || '') === adminId
    ) {
      alert(
        'Admin "' +
        (admin.name || 'Admin') +
        '" is already logged in.'
      );
      return;
    }

    const previousAdminActive = adminActive;
    const previousAdminId = activeAdminId;

    let attendanceStarted = false;
    let presenceRegistered = false;

    try {
      await stampTuxSessionVersionAfterLogin();

      const attendanceStartedResult =
        await createAdminAttendanceSession(adminId);

      if (!attendanceStartedResult) {
        alert('Could not start Admin attendance. Please try again.');
        return;
      }

      attendanceStarted = true;

      await registerTuxOnlinePresence({
        role: 'admin',
        accountId: adminId,
        password: enteredPassword,
        displayName: String(admin.name || 'Admin'),
        deviceLabel
      });

      presenceRegistered = true;

      // Set the actual login state before synchronizing Presence.
      adminActive = true;
      activeAdminId = adminId;

      saveLoginSession();

      if (typeof startTuxOnlinePresenceWatcher === 'function') {
        startTuxOnlinePresenceWatcher();
      }

      if (typeof syncTuxOnlinePresenceTracking === 'function') {
        await syncTuxOnlinePresenceTracking();
      }

      closeStaffLogin();

      updateStaffUI();
      applyRolePermissions();

      if (typeof updateStaffStatus === 'function') {
        updateStaffStatus();
      }

      switchView(
        'cashier',
        document.getElementById('navCashier')
      );

      alert(
        'Admin "' +
        (admin.name || 'Admin') +
        '" logged in successfully.'
      );

    } catch (error) {
      console.error('Admin login failed:', error);

      if (presenceRegistered) {
        const tokens = getTuxOnlinePresenceTokens();
        const tokenKey = 'admin:' + adminId;
        const session = tokens[tokenKey];

        if (session?.token) {
          try {
            await tuxAdminAuthClient.rpc(
              'logout_tux_online_session',
              {
                p_session_token: session.token
              }
            );
          } catch (cleanupError) {
            console.error(
              'Admin online-presence cleanup failed:',
              cleanupError
            );
          }

          delete tokens[tokenKey];
          saveTuxOnlinePresenceTokens(tokens);
        }
      }

      if (attendanceStarted) {
        try {
          if (typeof endAdminAttendanceSession === 'function') {
            await endAdminAttendanceSession(adminId);
          }
        } catch (attendanceError) {
          console.error(
            'Admin attendance rollback failed:',
            attendanceError
          );
        }
      }

      adminActive = previousAdminActive;
      activeAdminId = previousAdminId;

      saveLoginSession();
      updateStaffUI();
      applyRolePermissions();

      if (typeof syncTuxOnlinePresenceTracking === 'function') {
        await syncTuxOnlinePresenceTracking();
      }

      alert(
        'Admin login failed. Please check the connection and try again.'
      );
    }

    return;
  }


  /* =======================================================
     WORKER LOGIN
     ======================================================= */

  const worker = Array.isArray(workersList)
    ? workersList.find(account =>
        account &&
        account.role === 'worker' &&
        String(account.password || '') === enteredPassword &&
        account.active !== false
      )
    : null;

  if (worker) {
    const workerId = String(worker.id || '');

    if (!workerId || workerId === 'undefined') {
      alert('This worker has an invalid ID.');
      return;
    }

    if (!Array.isArray(activeStaffIds)) {
      activeStaffIds = [];
    }

    if (
      activeStaffIds.some(id => String(id) === workerId)
    ) {
      alert(
        (worker.name || 'Worker') +
        ' is already logged in.'
      );
      return;
    }

    let acquiredSession = false;
    let attendanceStarted = false;
    let workerAdded = false;
    let presenceRegistered = false;

    try {
      const session = await acquireTuxWorkerSession(
        worker,
        enteredPassword
      );

      if (!session) {
        return;
      }

      acquiredSession = true;

      if (typeof createAttendanceSession === 'function') {
        const result = await createAttendanceSession(
          worker.id,
          {
            allowWorkerLogin: true
          }
        );

        if (result === false || !result) {
          throw new Error(
            'Attendance session creation failed.'
          );
        }

        attendanceStarted = true;
      } else {
        throw new Error(
          'Attendance service is unavailable.'
        );
      }

      await registerTuxOnlinePresence({
        role: 'worker',
        accountId: workerId,
        password: enteredPassword,
        displayName: String(worker.name || 'Worker'),
        deviceLabel
      });

      presenceRegistered = true;

      if (
        !activeStaffIds.some(id => String(id) === workerId)
      ) {
        activeStaffIds.push(workerId);
        workerAdded = true;
      }

      saveLoginSession();

      // Synchronize only after activeStaffIds contains this worker.
      if (typeof startTuxOnlinePresenceWatcher === 'function') {
        startTuxOnlinePresenceWatcher();
      }

      if (typeof syncTuxOnlinePresenceTracking === 'function') {
        await syncTuxOnlinePresenceTracking();
      }

      try {
        localStorage.setItem(
          'tuxWorkersList',
          JSON.stringify(workersList)
        );
      } catch (storageError) {
        console.error(
          'Failed to save workers:',
          storageError
        );
      }

      closeStaffLogin();

      updateStaffUI();
      applyRolePermissions();

      if (typeof updateStaffStatus === 'function') {
        updateStaffStatus();
      }

      switchView(
        'cashier',
        document.getElementById('navCashier')
      );

      alert(
        (worker.name || 'Worker') +
        ' logged in successfully.'
      );

    } catch (error) {
      console.error('Worker login failed:', error);

      if (presenceRegistered) {
        const tokens = getTuxOnlinePresenceTokens();
        const tokenKey = 'worker:' + workerId;
        const presenceSession = tokens[tokenKey];

        if (presenceSession?.token) {
          try {
            await supabaseClient.rpc(
              'logout_tux_online_session',
              {
                p_session_token: presenceSession.token
              }
            );
          } catch (cleanupError) {
            console.error(
              'Worker online-presence cleanup failed:',
              cleanupError
            );
          }

          delete tokens[tokenKey];
          saveTuxOnlinePresenceTokens(tokens);
        }
      }

      if (attendanceStarted) {
        try {
          await endAttendanceSession(worker.id);
        } catch (attendanceError) {
          console.error(
            'Attendance rollback failed:',
            attendanceError
          );
        }
      }

      if (acquiredSession) {
        try {
          await releaseTuxWorkerSession(worker.id);
        } catch (releaseError) {
          console.error(
            'Failed to release worker session:',
            releaseError
          );
        }
      }

      if (workerAdded) {
        activeStaffIds = activeStaffIds.filter(
          id => String(id) !== workerId
        );
      }

      saveLoginSession();

      updateStaffUI();
      applyRolePermissions();

      if (typeof syncTuxOnlinePresenceTracking === 'function') {
        await syncTuxOnlinePresenceTracking();
      }

      alert(
        'Worker login failed. Please check the connection and try again.'
      );
    }

    return;
  }


  /* =======================================================
     TUX ADMIN LOGIN — SEPARATE SUPABASE CLIENT
     ======================================================= */

  if (
    typeof tuxAdminAuthClient === 'undefined' ||
    !tuxAdminAuthClient
  ) {
    alert(
      'TUX Admin authentication is unavailable. ' +
      'Please reload the application and try again.'
    );
    return;
  }

  if (tuxAdminActive === true) {
    alert('TUX Admin is already logged in.');
    return;
  }

  let tuxAdminAuthSucceeded = false;
  let tuxAdminActivated = false;
  let tuxAdminPresenceRegistered = false;
  let tuxAdminId = null;

  try {
    const { data, error } =
      await tuxAdminAuthClient.auth.signInWithPassword({
        email: 'kaporyakak@gmail.com',
        password: enteredPassword
      });

    if (error) {
      const invalidCredentials =
        error.code === 'invalid_credentials' ||
        /invalid login credentials/i.test(
          error.message || ''
        );

      if (invalidCredentials) {
        alert('Invalid TUX Admin password.');
        return;
      }

      console.error(
        'TUX Admin authentication failed:',
        error
      );

      alert(
        'TUX Admin authentication failed. Please try again.'
      );
      return;
    }

    if (!data?.user?.id) {
      alert('TUX Admin authentication failed.');
      return;
    }

    tuxAdminAuthSucceeded = true;
    tuxAdminId = String(data.user.id);

    const {
      data: roleData,
      error: roleError
    } = await tuxAdminAuthClient
      .from('user_roles')
      .select('role')
      .eq('user_id', tuxAdminId)
      .maybeSingle();

    if (roleError) {
      throw roleError;
    }

    if (
      !roleData ||
      String(roleData.role).toLowerCase() !== 'tuxadmin'
    ) {
      alert(
        'This account does not have TUX Admin permissions.'
      );
      return;
    }

    await stampTuxSessionVersionAfterLogin();

    await registerTuxOnlinePresence({
      role: 'tuxadmin',
      accountId: tuxAdminId,
      password: '',
      displayName: 'TUX Admin',
      deviceLabel
    });

    tuxAdminPresenceRegistered = true;

    // Set the actual login state before synchronizing Presence.
    tuxAdminActive = true;
    tuxAdminActivated = true;

    saveLoginSession();

    if (typeof startTuxOnlinePresenceWatcher === 'function') {
      startTuxOnlinePresenceWatcher();
    }

    if (typeof syncTuxOnlinePresenceTracking === 'function') {
      await syncTuxOnlinePresenceTracking();
    }

    closeStaffLogin();

    updateStaffUI();
    applyRolePermissions();

    if (typeof updateStaffStatus === 'function') {
      updateStaffStatus();
    }

    switchView(
      'cashier',
      document.getElementById('navCashier')
    );

    alert('TUX Admin login successful.');

  } catch (error) {
    console.error('TUX Admin login failed:', error);

    if (tuxAdminPresenceRegistered && tuxAdminId) {
      const tokens = getTuxOnlinePresenceTokens();
      const tokenKey = 'tuxadmin:' + tuxAdminId;
      const presenceSession = tokens[tokenKey];

      if (presenceSession?.token) {
        try {
          await supabaseClient.rpc(
            'logout_tux_online_session',
            {
              p_session_token: presenceSession.token
            }
          );
        } catch (cleanupError) {
          console.error(
            'TUX Admin online-presence cleanup failed:',
            cleanupError
          );
        }

        delete tokens[tokenKey];
        saveTuxOnlinePresenceTokens(tokens);
      }
    }

    if (tuxAdminActivated) {
      tuxAdminActive = false;
    }

    saveLoginSession();

    updateStaffUI();
    applyRolePermissions();

    if (typeof syncTuxOnlinePresenceTracking === 'function') {
      await syncTuxOnlinePresenceTracking();
    }

    alert(
      'TUX Admin login failed. Please try again.'
    );

  } finally {
    /*
     * Sign out only if authentication succeeded but
     * TUX Admin activation did not complete.
     */
    if (tuxAdminAuthSucceeded && !tuxAdminActivated) {
      try {
        const { error } =
          await tuxAdminAuthClient.auth.signOut({
            scope: 'local'
          });

        if (error) {
          console.error(
            'TUX Admin authentication cleanup failed:',
            error
          );
        }
      } catch (signOutError) {
        console.error(
          'TUX Admin authentication cleanup failed:',
          signOutError
        );
      }
    }
  }
}

      /* =========================================================
         STAFF LOGOUT
         ========================================================= */

      /* =========================================================
         TUX POS — INDEPENDENT ROLE LOGOUT
         Logging out one role preserves all other active roles.
         ========================================================= */

async function staffLogout(password) {

  const enteredPassword = String(password || '').trim();

  if (!enteredPassword) {
    alert('Please enter your password.');
    return;
  }

  /* =======================================================
     CLOSE DATABASE ONLINE PRESENCE
     ======================================================= */

  async function closeOnlinePresence(role, accountId) {

    const tokenKey =
      String(role) + ':' + String(accountId);

    const tokens = getTuxOnlinePresenceTokens();
    const session = tokens[tokenKey];

    if (!session || !session.token) {
      return true;
    }

    const { data, error } = await supabaseClient.rpc(
      'logout_tux_online_session',
      {
        p_session_token: session.token
      }
    );

    if (error) {
      console.error(
        'Could not close online presence:',
        tokenKey,
        error
      );

      return false;
    }

    if (data !== true) {
      console.error(
        'Online presence was not closed:',
        tokenKey,
        data
      );

      return false;
    }

    delete tokens[tokenKey];

    if (!saveTuxOnlinePresenceTokens(tokens)) {
      console.error(
        'Could not save online presence tokens after logout.'
      );
    }

    return true;
  }


  /* =======================================================
     REFRESH LOGIN UI AND REALTIME PRESENCE
     ======================================================= */

  function refreshLoginUI() {

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

    // Update the shared Realtime Presence channel.
    if (
      typeof syncTuxOnlinePresenceTracking === 'function'
    ) {
      void syncTuxOnlinePresenceTracking();
    }

    switchView(
      'cashier',
      document.getElementById('navCashier')
    );
  }


  /* =======================================================
     GET ACTIVE ROLES
     ======================================================= */

  const activeRoles = getActiveRoles();

  if (activeRoles.length === 0) {
    alert('No role is currently logged in.');
    return;
  }


  /* =======================================================
     IDENTIFY ADMIN OR WORKER BY PASSWORD
     ======================================================= */

  let logoutRole = null;

  const matchingAdmin =
    activeRoles.includes('admin') &&
    Array.isArray(workersList)
      ? workersList.find(account =>
          account &&
          account.role === 'admin' &&
          account.active !== false &&
          String(account.password || '') === enteredPassword &&
          adminActive === true &&
          String(account.id || '') ===
            String(activeAdminId || '')
        )
      : null;

  const matchingWorker =
    activeRoles.includes('worker') &&
    Array.isArray(workersList)
      ? workersList.find(account =>
          account &&
          account.role === 'worker' &&
          account.active !== false &&
          String(account.password || '') === enteredPassword &&
          Array.isArray(activeStaffIds) &&
          activeStaffIds.some(
            id => String(id) === String(account.id)
          )
        )
      : null;

  const passwordMatches = [];

  if (matchingAdmin) {
    passwordMatches.push('admin');
  }

  if (matchingWorker) {
    passwordMatches.push('worker');
  }

  if (passwordMatches.length > 1) {
    alert(
      'This password matches more than one active account.\n\n' +
      'Please use a unique password for each account.'
    );

    return;
  }

  if (passwordMatches.length === 1) {
    logoutRole = passwordMatches[0];
  } else if (
    activeRoles.length === 1 &&
    activeRoles[0] === 'tuxadmin'
  ) {
    logoutRole = 'tuxadmin';
  } else if (
    activeRoles.includes('tuxadmin') &&
    passwordMatches.length === 0
  ) {
    logoutRole = 'tuxadmin';
  } else {
    alert(
      'Incorrect password or no matching active account.'
    );

    return;
  }


  /* =======================================================
     TUX ADMIN LOGOUT
     ======================================================= */

  if (logoutRole === 'tuxadmin') {

    if (tuxAdminActive !== true) {
      alert('TUX Admin is not logged in.');
      return;
    }

    if (
      typeof tuxAdminAuthClient === 'undefined' ||
      !tuxAdminAuthClient
    ) {
      alert(
        'TUX Admin authentication is unavailable. ' +
        'Please reload the application and try again.'
      );

      return;
    }

    let verifiedUserId = null;

    try {

      const { data, error } =
        await tuxAdminAuthClient.auth.signInWithPassword({
          email: 'kaporyakak@gmail.com',
          password: enteredPassword
        });

      if (error || !data?.user?.id) {
        console.error(
          'TUX Admin password verification failed:',
          error
        );

        alert('Incorrect TUX Admin password.');
        return;
      }

      const userId = String(data.user.id);

      const {
        data: roleData,
        error: roleError
      } = await tuxAdminAuthClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (
        roleError ||
        !roleData ||
        String(roleData.role).toLowerCase() !== 'tuxadmin'
      ) {
        console.error(
          'TUX Admin role verification failed:',
          roleError
        );

        alert(
          'This account is not authorized as TUX Admin.'
        );

        return;
      }

      verifiedUserId = userId;

    } catch (error) {

      console.error(
        'TUX Admin logout verification failed:',
        error
      );

      alert(
        'Could not verify TUX Admin credentials. ' +
        'Please try again.'
      );

      return;

    } finally {

      try {
        const { error } =
          await tuxAdminAuthClient.auth.signOut({
            scope: 'local'
          });

        if (error) {
          console.error(
            'TUX Admin verification-session cleanup failed:',
            error
          );
        }
      } catch (error) {
        console.error(
          'TUX Admin verification-session cleanup failed:',
          error
        );
      }
    }

    if (!verifiedUserId) {
      return;
    }

    if (
      !confirm(
        'Are you sure you want to log out TUX Admin?'
      )
    ) {
      return;
    }

    const presenceClosed = await closeOnlinePresence(
      'tuxadmin',
      verifiedUserId
    );

    if (!presenceClosed) {
      alert(
        'Could not close TUX Admin online presence. ' +
        'TUX Admin remains logged in.'
      );

      return;
    }

    tuxAdminActive = false;

    try {
      const { error } =
        await tuxAdminAuthClient.auth.signOut({
          scope: 'local'
        });

      if (error) {
        console.error(
          'TUX Admin sign-out failed:',
          error
        );
      }
    } catch (error) {
      console.error(
        'TUX Admin sign-out failed:',
        error
      );
    }

    refreshLoginUI();

    alert('TUX Admin logged out successfully.');

    return;
  }


  /* =======================================================
     ADMIN LOGOUT
     ======================================================= */

  if (logoutRole === 'admin') {

    if (!matchingAdmin) {
      alert(
        'Incorrect Admin password or Admin is not logged in.'
      );

      return;
    }

    const adminId = String(activeAdminId || '');

    if (!adminId) {
      alert('Could not identify the logged-in Admin.');
      return;
    }

    try {

      const presenceClosed = await closeOnlinePresence(
        'admin',
        adminId
      );

      if (!presenceClosed) {
        alert(
          'Could not close Admin online presence. ' +
          'You are still logged in.'
        );

        return;
      }

      const attendanceClosed =
        await endAdminAttendanceSession(adminId);

      if (!attendanceClosed) {
        alert(
          'Admin attendance could not be closed. ' +
          'Admin remains logged in.'
        );

        return;
      }

      adminActive = false;
      activeAdminId = null;

      refreshLoginUI();

      alert(
        'Admin "' +
        (matchingAdmin.name || 'Admin') +
        '" logged out successfully.'
      );

    } catch (error) {

      console.error('Admin logout failed:', error);

      alert(
        'Admin logout could not be completed. ' +
        'Please try again.'
      );
    }

    return;
  }


  /* =======================================================
     WORKER LOGOUT
     ======================================================= */

  if (logoutRole === 'worker') {

    if (!matchingWorker) {
      alert(
        'Incorrect Worker password or no matching ' +
        'logged-in Worker.'
      );

      return;
    }

    const workerId = String(matchingWorker.id);

    try {

      const presenceClosed = await closeOnlinePresence(
        'worker',
        workerId
      );

      if (!presenceClosed) {
        alert(
          'Could not close Worker online presence. ' +
          'The Worker remains logged in.'
        );

        return;
      }

      await endAttendanceSession(matchingWorker.id);

      const released = await releaseTuxWorkerSession(
        matchingWorker.id
      );

      if (!released) {
        alert(
          'The Worker session lock could not be released. ' +
          'Please contact the administrator.'
        );

        return;
      }

      activeStaffIds = activeStaffIds.filter(
        id => String(id) !== workerId
      );

      refreshLoginUI();

      alert(
        (matchingWorker.name || 'Worker') +
        ' logged out successfully.'
      );

    } catch (error) {

      console.error('Worker logout failed:', error);

      alert(
        'Worker logout could not be completed. ' +
        'Please try again.'
      );
    }

    return;
  }

  alert('Could not identify the account to log out.');
}


      /* =========================================================
         UPDATE STAFF UI
         ========================================================= */

      /* =========================================================
         TUX POS — MULTI-ROLE STAFF UI
         Displays every active role simultaneously.
         ========================================================= */

      function updateStaffUI() {

        const status = document.getElementById('staffStatus');

        const loginButton = document.getElementById('staffLoginBtn');

        const logoutButton = document.getElementById('staffLogoutBtn');


        /* =======================================================
           GET ALL ACTIVE ROLES
           ======================================================= */

        const roles = getActiveRoles();

        const statusLabels = [];
        /* =======================================================
           TUX ADMIN
           ======================================================= */

        if (roles.includes('tuxadmin')) {

          statusLabels.push('TUX Admin');
        }

        /* =======================================================
           REGULAR ADMIN
           ======================================================= */

        if (roles.includes('admin')) {

          statusLabels.push('Admin');

        }

        /* =======================================================
           WORKERS
           ======================================================= */
        if (roles.includes('worker')) {

          const names = Array.isArray(activeStaffIds)

            ? activeStaffIds

              .map(id => {

                const worker = Array.isArray(workersList)

                  ? workersList.find(
                    item =>
                      item &&
                      String(item.id) === String(id) &&
                      item.role === 'worker'
                  )

                  : null;


                return worker
                  ? String(worker.name || 'Worker')
                  : null;

              })

              .filter(Boolean)

            : [];


          if (names.length > 0) {

            statusLabels.push(
              ...names
            );

          } else {

            statusLabels.push('Worker');

          }

        }

        /* =======================================================
           UPDATE STATUS LABEL
           ======================================================= */
        if (status) {

          if (statusLabels.length > 0) {

            status.textContent =
              statusLabels.join(' + ') +
              ' Logged In';

            status.title =
              'Active roles: ' +
              roles.join(', ');

          } else {

            status.textContent = 'Not Logged In';

            status.title = 'No active roles';

          }

        }


        /* =======================================================
           LOGIN BUTTON
           ======================================================= */

        if (loginButton) {

          loginButton.style.display = 'inline-block';

        }


        /* =======================================================
           LOGOUT BUTTON
           ======================================================= */

        if (logoutButton) {

          logoutButton.style.display =
            roles.length > 0
              ? 'inline-block'
              : 'none';

        }

        /* =======================================================
           UPDATE NAVBAR VISIBILITY
           ======================================================= */

        if (
          typeof updateTuxNavbarVisibility === 'function'
        ) {

          updateTuxNavbarVisibility();

        }

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
        const roles =
          typeof getActiveRoles === 'function'
            ? getActiveRoles()
            : [getActiveRole()].filter(Boolean);

        const isTuxAdmin = roles.includes('tuxadmin');
        const isAdmin = roles.includes('admin');
        const isWorker = roles.includes('worker');

        /*
         * NAVBAR VISIBILITY
         *
         * Show administrative tabs when either Admin or
         * TUX Admin is logged in.
         *
         * Worker-only sessions keep the restricted tabs hidden.
         */

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

          button.style.display =
            isAdmin || isTuxAdmin ? '' : 'none';
        });


        /*
         * STOCK
         */

        const stockButton =
          document.getElementById('navStock');

        if (stockButton) {
          stockButton.style.display = '';
        }


        /*
         * HAWALK NAVIGATION
         */

        const hawalkNav =
          document.getElementById('navHawalk');

        if (hawalkNav) {
          hawalkNav.style.display =
            isAdmin || isTuxAdmin ? '' : 'none';
        }


        /*
         * HAWALK CASHIER BUTTON
         *
         * Display the worker button only when Worker is
         * logged in without an administrative role.
         */

        const hawalkCashierButton =
          document.getElementById('hawalkCashierBtn');

        if (hawalkCashierButton) {
          hawalkCashierButton.style.display =
            isWorker && !isAdmin && !isTuxAdmin
              ? 'block'
              : 'none';
        }


        /*
         * HIDE RESTRICTED VIEWS FOR WORKER-ONLY SESSIONS
         */

        if (!isAdmin && !isTuxAdmin) {
          const workersView =
            document.getElementById('workers-view');

          if (workersView) {
            workersView.classList.remove('active');
          }

          const hawalkView =
            document.getElementById('hawalk-view');

          if (hawalkView) {
            hawalkView.classList.remove('active');
          }
        }


        /*
         * EXISTING ROLE-DEPENDENT UI
         */

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


        /*
         * TUX ADMIN-ONLY SECTIONS
         */

        const tuxAdminDisplayElements = [
          {
            id: 'financeControls',
            display: 'flex'
          },
          {
            id: 'adminAccountSection',
            display: ''
          },
          {
            id: 'tuxAdminSection',
            display: ''
          },
          {
            id: 'passwordsManagerSection',
            display: ''
          }
        ];

        tuxAdminDisplayElements.forEach(item => {
          const element = document.getElementById(item.id);

          if (element) {
            element.style.display =
              isTuxAdmin ? item.display : 'none';
          }
        });


        /*
         * WORKER MANAGEMENT
         */

        const addWorkerButton =
          document.getElementById('addWorkerBtn');

        if (addWorkerButton) {
          addWorkerButton.disabled = !isTuxAdmin;
        }


        const saveAdminButton =
          document.getElementById('saveAdminAccountBtn');

        if (saveAdminButton) {
          saveAdminButton.disabled = !isTuxAdmin;
        }


        const saveTuxButton =
          document.getElementById('saveTuxAdminBtn');

        if (saveTuxButton) {
          saveTuxButton.disabled = !isTuxAdmin;
        }


        /*
         * ADD STOCK
         *
         * Admin and TUX Admin can see this button.
         */

        const addStockButton =
          document.getElementById('addStockItemBtn');

        if (addStockButton) {
          addStockButton.style.display =
            isAdmin || isTuxAdmin ? '' : 'none';
        }


        /*
         * REFRESH STAFF UI
         */

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
         TUX ADMIN + ADMIN
         ========================================================= */
      function refreshExpensesPermissions() {

        const role = getActiveRole();

        const saveExpenseButton =
          document.getElementById('saveExpenseBtn');

        const deleteAllButton =
          document.getElementById('deleteAllExpensesBtn');


        // Allow logged-in roles to use the existing Add Expense button.
        if (saveExpenseButton) {

          saveExpenseButton.disabled =
            !role;

        }


        // TUX Admin and regular Admin can see Delete All.
        // Workers and logged-out users cannot see it.
        if (deleteAllButton) {

          deleteAllButton.style.display =
            role === 'tuxadmin' || role === 'admin'
              ? 'inline-block'
              : 'none';

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

        // Ensure navbar visibility styles exist.
        ensureTuxNavbarVisibilityStyles();


        /* =======================================================
           RESTORE SAVED LOGIN SESSION
           ======================================================= */

        restoreLoginSession();


        /* =======================================================
           INITIALIZE AUTHENTICATION UI
           ======================================================= */

        initializeAuthUI();


        /* =======================================================
           START SHARED SESSION WATCHER
           ======================================================= */

        startTuxSharedSessionWatcher();


        /* =======================================================
           START ONLINE PRESENCE WATCHER
           Fixes online status after page refresh.
           ======================================================= */

        if (
          typeof startTuxOnlinePresenceWatcher === 'function'
        ) {

          startTuxOnlinePresenceWatcher();

        }

      }


      /* =========================================================
         RUN AUTH INITIALIZATION AFTER DOM IS READY
         ========================================================= */

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


