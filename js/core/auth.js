/* =========================================================
   TUX POS — AUTH, ROLES AND STAFF LOGIN

   ROLES:

     WORKER
       - Cashier
       - Kitchen
       - Normal operational access

     ADMIN
       - Spectate / read-only mode
       - Can see all available screens
       - Cannot edit, add, delete, reset, or change settings

     TUX ADMIN
       - Full access
       - Can edit everything
       - Can manage Admin account
       - Can manage Tux Admin settings

   WORKERS + ATTENDANCE:
     - Workers are stored in Supabase.
     - Attendance is stored in Supabase.
     - Tux Admin / Admin login sessions remain local
       to the browser/tab.

   LOGIN SESSION:
     - Login survives page refresh.
     - Passwords are NOT stored in the login session.
     - Supabase attendance remains the source of truth
       for attendance records.
     - Login session uses sessionStorage so each browser
       tab keeps its own independent login.
   ========================================================= */


/* =========================================================
   RESTRICTED VIEWS
   ========================================================= */

const RESTRICTED_VIEWS = [
  'expenses',
  'sales',
  'stock',
  'workers',
  'gamiya',
  'settings'
];


const RESTRICTED_NAV_IDS = [
  'navExpenses',
  'navSales',
  'navStock',
  'navWorkers',
  'navGamiya',
  'navSettings'
];


/* =========================================================
   LOGIN SESSION STORAGE KEY
   ========================================================= */

const AUTH_SESSION_STORAGE_KEY =
  'tuxPosLoginSession';


/* =========================================================
   TUX ADMIN PASSWORD
   ========================================================= */

function getTuxAdminPassword() {

  return (
    localStorage.getItem('tuxAdminPassword') ||
    DEFAULT_TUX_ADMIN_PASSWORD
  );

}


/* =========================================================
   SAVE LOGIN SESSION

   sessionStorage is used intentionally.

   This means:

     Tab A = its own login
     Tab B = its own login
     Tab C = its own login

   Logging in on one tab does NOT change the login
   session of another tab.

   IMPORTANT:

   activeStaffIds is also stored in this tab's
   sessionStorage.

   Therefore a Worker can be remembered while the
   tab temporarily switches to Admin/Tux Admin.
   ========================================================= */

function saveLoginSession() {

  const session = {

    tuxAdminActive:
      Boolean(tuxAdminActive),

    adminActive:
      Boolean(adminActive),

    activeStaffIds:
      Array.isArray(activeStaffIds)
        ? activeStaffIds.map(function (id) {

            return String(id);

          })
        : []

  };


  sessionStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify(session)
  );

}


/* =========================================================
   CLEAR LOGIN SESSION
   ========================================================= */

function clearLoginSession() {

  sessionStorage.removeItem(
    AUTH_SESSION_STORAGE_KEY
  );

}


/* =========================================================
   CHECK WHETHER WORKER HAS OPEN ATTENDANCE

   Kept for attendance-related functionality.

   IMPORTANT:
   This function is NOT used to decide whether the
   browser/tab should remember a Worker login.
   ========================================================= */

function workerHasOpenAttendance(worker) {

  if (
    !worker ||
    !Array.isArray(worker.attendance)
  ) {

    return false;

  }


  return worker.attendance.some(
    function (record) {

      return (
        record &&
        record.checkIn &&
        !record.checkOut &&
        record.status === 'working'
      );

    }
  );

}


/* =========================================================
   RESTORE LOGIN SESSION

   IMPORTANT:

   The login session belongs to THIS browser tab.

   Worker login is restored from sessionStorage.

   We DO NOT validate the Worker login against
   Supabase attendance here.

   Attendance is shared between browsers/tabs, while
   login session is private to this browser tab.

   This prevents:

     Tab A = Worker
     Tab B = Admin

   from causing Tab A's Worker login to disappear.

   It also allows:

     Tab B = Worker
     Tab B = Tux Admin
     Tab B = Admin
     Tab B = Logout
     Tab B = Worker again
   ========================================================= */

async function restoreLoginSession() {

  try {

    const saved =
      sessionStorage.getItem(
        AUTH_SESSION_STORAGE_KEY
      );


    /* =====================================================
       NO LOGIN SAVED IN THIS TAB
       ===================================================== */

    if (!saved) {

      tuxAdminActive = false;

      adminActive = false;

      activeStaffIds = [];

      return;

    }


    const session =
      JSON.parse(saved);


    if (
      !session ||
      typeof session !== 'object'
    ) {

      throw new Error(
        'Invalid saved login session.'
      );

    }


    /* =====================================================
       RESTORE TUX ADMIN
       ===================================================== */

    tuxAdminActive =
      session.tuxAdminActive === true;


    /* =====================================================
       RESTORE ADMIN
       ===================================================== */

    adminActive =
      session.adminActive === true &&
      Boolean(adminAccount);


    /*
     * Tux Admin always has priority.
     */

    if (tuxAdminActive) {

      adminActive = false;

    }


    /* =====================================================
       RESTORE WORKERS

       IMPORTANT:

       Do NOT check Supabase attendance here.

       The Worker login belongs to this tab.

       Supabase attendance is shared data and must not
       erase this tab's login during page refresh.
       ===================================================== */

    const savedWorkerIds =
      Array.isArray(session.activeStaffIds)
        ? session.activeStaffIds
        : [];


    activeStaffIds =
      savedWorkerIds
        .map(function (id) {

          return String(id);

        })
        .filter(function (id) {

          return workersList.some(
            function (worker) {

              return (
                String(worker.id) ===
                String(id)
              );

            }
          );

        });


    /* =====================================================
       SAVE CLEANED SESSION
       ===================================================== */

    if (
      tuxAdminActive ||
      adminActive ||
      activeStaffIds.length > 0
    ) {

      saveLoginSession();

    }

    else {

      clearLoginSession();

    }


    console.log(
      'TUX POS — Login session restored:',
      {
        tuxAdminActive:
          tuxAdminActive,

        adminActive:
          adminActive,

        activeStaffIds:
          activeStaffIds
      }
    );


  } catch (error) {

    console.error(
      'TUX POS — Failed to restore login session:',
      error
    );


    tuxAdminActive = false;

    adminActive = false;

    activeStaffIds = [];


    clearLoginSession();

  }

}


/* =========================================================
   ACTIVE ROLE
   ========================================================= */

function getActiveRole() {

  if (tuxAdminActive) {

    return 'tuxadmin';

  }


  if (adminActive) {

    return 'admin';

  }


  return 'worker';

}


/* =========================================================
   CHECK ADMIN SPECTATE MODE
   ========================================================= */

function isAdminSpectateMode() {

  return (
    adminActive === true &&
    tuxAdminActive !== true
  );

}


/* =========================================================
   CHECK FULL ACCESS
   ========================================================= */

function isTuxAdmin() {

  return (
    tuxAdminActive === true
  );

}


/* =========================================================
   CHECK WHETHER CURRENT USER CAN EDIT
   ========================================================= */

function canEdit() {

  return (
    tuxAdminActive === true ||
    (
      tuxAdminActive !== true &&
      adminActive !== true
    )
  );

}


/* =========================================================
   BLOCK ADMIN FROM EDITING
   ========================================================= */

function requireEditPermission() {

  if (isAdminSpectateMode()) {

    alert(
      'Admin is in Spectate Mode.\n\n' +
      'You can view the data, but you cannot make changes.'
    );

    return false;

  }


  return true;

}


/* =========================================================
   PERMISSIONS
   ========================================================= */

function applyRolePermissions() {

  const role =
    getActiveRole();


  const canSeeRestricted =
    role === 'admin' ||
    role === 'tuxadmin';


  const isViewOnly =
    role === 'admin';


  /* =====================================================
     NAVIGATION
     ===================================================== */

  RESTRICTED_NAV_IDS.forEach(
    function (id) {

      const btn =
        document.getElementById(id);


      if (btn) {

        btn.style.display =
          canSeeRestricted
            ? 'flex'
            : 'none';

      }

    }
  );


  /* =====================================================
     FORCE CASHIER FOR WORKERS
     ===================================================== */

  const activeSection =
    document.querySelector(
      '.view-section.active'
    );


  if (
    activeSection &&
    !canSeeRestricted
  ) {

    const activeId =
      activeSection.id.replace(
        '-view',
        ''
      );


    if (
      RESTRICTED_VIEWS.includes(
        activeId
      )
    ) {

      const cashierBtn =
        document.getElementById(
          'navCashier'
        );


      if (cashierBtn) {

        switchView(
          'cashier',
          cashierBtn
        );

      }

    }

  }


  /* =====================================================
     ADMIN SPECTATE MODE BODY CLASS
     ===================================================== */

  if (isViewOnly) {

    document.body.classList.add(
      'admin-spectate-mode'
    );

  }

  else {

    document.body.classList.remove(
      'admin-spectate-mode'
    );

  }


  /* =====================================================
     INPUTS ADMIN CANNOT EDIT
     ===================================================== */

  const adminRestrictedInputs = [

    'expStockKey',
    'expName',
    'expQty',
    'expCost',
    'expNotes',

    'workerName',
    'workerPassword',

    'adminName',
    'adminPasswordInput',

    'newMenuItemName',
    'newMenuItemPrice',
    'newMenuItemCategory',

    'tuxCurrentPassword',
    'tuxNewPassword',
    'tuxConfirmPassword'

  ];


  adminRestrictedInputs.forEach(
    function (id) {

      const el =
        document.getElementById(id);


      if (el) {

        el.disabled =
          isViewOnly;

      }

    }
  );


  /* =====================================================
     BUTTONS ADMIN CANNOT USE
     ===================================================== */

  const adminRestrictedButtons = [

    'saveExpenseBtn',

    'addWorkerBtn',

    'addStockItemBtn',

    'addMenuItemBtn',

    'saveAdminAccountBtn',

    'saveRecipeBtn',

    'resetRecipeBtn',

    'deleteMenuItemBtn',

    'shiftHistoryResetBtn',

    'gamiyaResetBtn',

    'attendanceResetBtn',

    'saveTuxAdminPasswordBtn',

    'changeTuxAdminPasswordBtn'

  ];


  adminRestrictedButtons.forEach(
    function (id) {

      const el =
        document.getElementById(id);


      if (el) {

        el.disabled =
          isViewOnly;

      }

    }
  );


  /* =====================================================
     ADMIN ACCOUNT

     Only Tux Admin can modify Admin account.
     ===================================================== */

  [
    'adminName',
    'adminPasswordInput',
    'saveAdminAccountBtn'

  ].forEach(
    function (id) {

      const el =
        document.getElementById(id);


      if (el) {

        el.disabled =
          role !== 'tuxadmin';

      }

    }
  );


  /* =====================================================
     TUX ADMIN SECTION
     ===================================================== */

  const tuxSection =
    document.getElementById(
      'tuxAdminSection'
    );


  if (tuxSection) {

    tuxSection.style.display =
      role === 'tuxadmin'
        ? 'block'
        : 'none';

  }


  /* =====================================================
     PASSWORD MANAGER
     ===================================================== */

  const pwSection =
    document.getElementById(
      'passwordsManagerSection'
    );


  if (pwSection) {

    pwSection.style.display =
      role === 'tuxadmin'
        ? 'block'
        : 'none';

  }


  /* =====================================================
     RECIPE EDITOR
     ===================================================== */

  document.querySelectorAll(

    '#recipeEditorBody input, ' +
    '#saveRecipeBtn, ' +
    '#resetRecipeBtn, ' +
    '#deleteMenuItemSelect, ' +
    '#deleteMenuItemBtn'

  ).forEach(
    function (el) {

      el.disabled =
        isViewOnly;

    }
  );


  /* =====================================================
     FINANCE CONTROLS
     ===================================================== */

  const financeBox =
    document.getElementById(
      'financeControls'
    );


  if (financeBox) {

    financeBox.style.display =
      role === 'tuxadmin'
        ? 'flex'
        : 'none';

  }


  /* =====================================================
     RESET BUTTONS
     ===================================================== */

  [
    'shiftHistoryResetBtn',
    'gamiyaResetBtn',
    'attendanceResetBtn'

  ].forEach(
    function (id) {

      const el =
        document.getElementById(id);


      if (el) {

        el.style.display =
          role === 'tuxadmin'
            ? 'inline-block'
            : 'none';

      }

    }
  );


  /* =====================================================
     ADMIN STATUS
     ===================================================== */

  renderAdminAccountStatus();

}


/* =========================================================
   ADMIN ACCOUNT STATUS
   ========================================================= */

function renderAdminAccountStatus() {

  const el =
    document.getElementById(
      'adminAccountStatus'
    );


  if (!el) {

    return;

  }


  el.innerText =
    adminAccount

      ? (
          'Current Admin: ' +
          adminAccount.name +
          ' (leave password empty to keep it)'
        )

      : 'No Admin account set yet.';


  const nameInput =
    document.getElementById(
      'adminName'
    );


  if (
    nameInput &&
    adminAccount &&
    !nameInput.value &&
    document.activeElement !== nameInput
  ) {

    nameInput.value =
      adminAccount.name;

  }

}


/* =========================================================
   SAVE ADMIN ACCOUNT
   ========================================================= */

function saveAdminAccount() {

  if (
    getActiveRole() !== 'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can set the Admin account.'
    );

    return;

  }


  const name =
    document
      .getElementById('adminName')
      .value
      .trim();


  const pass =
    document
      .getElementById('adminPasswordInput')
      .value
      .trim();


  if (!name) {

    alert(
      'Please enter an admin name.'
    );

    return;

  }


  if (!pass && !adminAccount) {

    alert(
      'Please enter an admin password.'
    );

    return;

  }


  const finalPass =
    pass ||
    adminAccount.password;


  if (
    finalPass ===
    getTuxAdminPassword()
  ) {

    alert(
      'Admin password must be different from the Tux Admin password.'
    );

    return;

  }


  if (
    workersList.some(
      function (worker) {

        return (
          String(worker.password) ===
          String(finalPass)
        );

      }
    )
  ) {

    alert(
      'This password is already used by a worker.'
    );

    return;

  }


  adminAccount = {

    name: name,

    password: finalPass

  };


  localStorage.setItem(
    'tuxAdminAccount',
    JSON.stringify(
      adminAccount
    )
  );


  document
    .getElementById(
      'adminPasswordInput'
    )
    .value = '';


  renderPasswordsManager();

  renderAdminAccountStatus();


  alert(
    'Admin account saved successfully.' +
    (
      pass
        ? ''
        : '\n(Password unchanged)'
    )
  );

}


/* =========================================================
   CHANGE TUX ADMIN PASSWORD
   ========================================================= */

function changeTuxAdminPassword() {

  if (
    getActiveRole() !== 'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can change this password.'
    );

    return;

  }


  const current =
    document
      .getElementById(
        'tuxCurrentPassword'
      )
      .value
      .trim();


  const next =
    document
      .getElementById(
        'tuxNewPassword'
      )
      .value
      .trim();


  const confirmPass =
    document
      .getElementById(
        'tuxConfirmPassword'
      )
      .value
      .trim();


  if (
    current !==
    getTuxAdminPassword()
  ) {

    alert(
      'Current Tux Admin password is incorrect.'
    );

    return;

  }


  if (
    !next ||
    next.length < 6
  ) {

    alert(
      'New password must be at least 6 characters.'
    );

    return;

  }


  if (
    next !== confirmPass
  ) {

    alert(
      'New password and confirmation do not match.'
    );

    return;

  }


  if (
    adminAccount &&
    next ===
    String(adminAccount.password)
  ) {

    alert(
      'Tux Admin password must be different from the Admin password.'
    );

    return;

  }


  if (
    workersList.some(
      function (worker) {

        return (
          String(worker.password) ===
          next
        );

      }
    )
  ) {

    alert(
      'This password is already used by a worker.'
    );

    return;

  }


  localStorage.setItem(
    'tuxAdminPassword',
    next
  );


  renderPasswordsManager();


  document
    .getElementById(
      'tuxCurrentPassword'
    )
    .value = '';


  document
    .getElementById(
      'tuxNewPassword'
    )
    .value = '';


  document
    .getElementById(
      'tuxConfirmPassword'
    )
    .value = '';


  alert(
    'Tux Admin password changed successfully.'
  );

}


/* =========================================================
   STAFF UI
   ========================================================= */

function updateStaffUI() {

  const status =
    document.getElementById(
      'staffStatus'
    );


  const loginBtn =
    document.getElementById(
      'staffLoginBtn'
    );


  const logoutBtn =
    document.getElementById(
      'staffLogoutBtn'
    );


  if (
    !status ||
    !loginBtn ||
    !logoutBtn
  ) {

    return;

  }


  const labels = [];


  /* =====================================================
     TUX ADMIN

     If Tux Admin is logged in on THIS browser/tab,
     show ONLY Tux Admin.

     IMPORTANT:
     The previous Worker remains stored in
     activeStaffIds.
     ===================================================== */

  if (tuxAdminActive) {

    labels.push(
      '🛡 Tux Admin'
    );

  }


  /* =====================================================
     NORMAL ADMIN

     If Admin is logged in on THIS browser/tab,
     show ONLY Admin.

     IMPORTANT:
     The previous Worker remains stored in
     activeStaffIds.
     ===================================================== */

  else if (
    adminActive &&
    adminAccount
  ) {

    labels.push(
      '👁 ' +
      adminAccount.name +
      ' (Admin)'
    );

  }


  /* =====================================================
     WORKERS

     IMPORTANT:

     DO NOT use getActiveWorkers() here.

     The Worker login belongs to THIS browser/tab.

     activeStaffIds contains the Workers remembered by
     this specific tab.

     Example:

       Tab A:
         activeStaffIds = [Test]

       Tab B:
         activeStaffIds = [Test]

       Tab B -> Tux Admin:
         activeStaffIds = [Test]

       Tab B -> Admin:
         activeStaffIds = [Test]

       Tab B -> Logout:
         activeStaffIds = [Test]

       Tab B -> Test Worker
     ===================================================== */

  else {

    if (
      Array.isArray(activeStaffIds)
    ) {

      activeStaffIds.forEach(
        function (id) {

          const worker =
            workersList.find(
              function (item) {

                return (
                  String(item.id) ===
                  String(id)
                );

              }
            );


          if (worker) {

            labels.push(
              worker.name
            );

          }

        }
      );

    }

  }


  /* =====================================================
     UPDATE UI
     ===================================================== */

  if (labels.length > 0) {

    status.innerText =
      '🟢 ' +
      labels.join(', ');


    status.classList.add(
      'logged-in'
    );


    loginBtn.style.display =
      'block';


    logoutBtn.style.display =
      'block';

  }

  else {

    status.innerText =
      'Not Logged In';


    status.classList.remove(
      'logged-in'
    );


    loginBtn.style.display =
      'block';


    logoutBtn.style.display =
      'none';

  }

}


/* =========================================================
   STAFF LOGIN / LOGOUT MODAL
   ========================================================= */

function showStaffModal(mode) {

  staffModalMode =
    mode;


  const isLogin =
    mode === 'login';


  const modal =
    document.getElementById(
      'staffLoginModal'
    );


  const title =
    document.getElementById(
      'staffModalTitle'
    );


  const info =
    document.getElementById(
      'staffModalInfo'
    );


  const button =
    document.getElementById(
      'staffModalActionBtn'
    );


  const input =
    document.getElementById(
      'staffPasswordInput'
    );


  title.innerText =
    isLogin
      ? '👤 Staff Login'
      : '👤 Staff Logout';


  info.innerText =
    isLogin
      ? 'Enter your staff password'
      : 'Enter your staff password to logout';


  button.innerText =
    isLogin
      ? 'Login'
      : 'Logout';


  button.className =
    isLogin
      ? 'staff-modal-login'
      : 'staff-modal-logout';


  input.value = '';


  modal.classList.add(
    'active'
  );


  setTimeout(
    function () {

      input.focus();

    },
    100
  );

}


function openStaffLogin() {

  showStaffModal(
    'login'
  );

}


function openStaffLogout() {

  /*
   * IMPORTANT:
   * Use this tab's remembered Worker list.
   *
   * Do NOT use shared Supabase attendance to decide
   * whether this tab has a Worker logged in.
   */

  const hasRememberedWorker =
    Array.isArray(activeStaffIds) &&
    activeStaffIds.length > 0;


  if (
    !hasRememberedWorker &&
    !tuxAdminActive &&
    !adminActive
  ) {

    return;

  }


  showStaffModal(
    'logout'
  );

}


function closeStaffLogin() {

  const modal =
    document.getElementById(
      'staffLoginModal'
    );


  if (!modal) {

    return;

  }


  modal.classList.remove(
    'active'
  );

}


async function staffModalAction() {

  if (
    staffModalMode === 'logout'
  ) {

    await staffLogout();

  }

  else {

    await staffLogin();

  }

}


/* =========================================================
   STAFF LOGIN
   ========================================================= */

async function staffLogin() {

  const input =
    document.getElementById(
      'staffPasswordInput'
    );


  const password =
    input.value.trim();


  if (!password) {

    alert(
      'Please enter password.'
    );

    return;

  }


  /* =======================================================
     ROLE 1 — TUX ADMIN
     ======================================================= */

  if (
    password ===
    getTuxAdminPassword()
  ) {

    tuxAdminActive =
      true;


    /*
     * Tux Admin takes priority over normal Admin
     * on this browser/tab.
     *
     * IMPORTANT:
     * DO NOT clear activeStaffIds here.
     *
     * If Test Worker was logged in before Tux Admin,
     * this tab continues remembering Test Worker.
     */

    adminActive =
      false;


    /*
     * Tux Admin login is local to this tab.
     */

    saveLoginSession();


    closeStaffLogin();

    updateStaffUI();

    applyRolePermissions();


    alert(
      'Welcome Tux Admin! Full access unlocked.'
    );

    return;

  }


  /* =======================================================
     ROLE 2 — ADMIN
     ======================================================= */

  if (
    adminAccount &&
    String(password) ===
    String(adminAccount.password)
  ) {

    adminActive =
      true;


    /*
     * Normal Admin takes priority over Tux Admin
     * display on this browser/tab.
     *
     * IMPORTANT:
     * DO NOT clear activeStaffIds here.
     *
     * The previous Worker remains remembered by
     * this tab.
     */

    tuxAdminActive =
      false;


    /*
     * Admin login is local to this tab.
     */

    saveLoginSession();


    closeStaffLogin();

    updateStaffUI();

    applyRolePermissions();


    alert(
      'Welcome ' +
      adminAccount.name +
      '! Spectate mode enabled.\n\n' +
      'You can view the POS but cannot make changes.'
    );

    return;

  }


  /* =======================================================
     ROLE 3 — WORKER
     ======================================================= */

  if (
    workersList.length === 0
  ) {

    alert(
      'No workers have been added yet. Please add workers first.'
    );

    return;

  }


  const worker =
    workersList.find(
      function (w) {

        return (
          String(w.password) ===
          String(password)
        );

      }
    );


  if (!worker) {

    alert(
      'Incorrect password!'
    );


    input.value = '';

    input.focus();


    return;

  }


  /* =======================================================
     PREVENT DUPLICATE LOGIN
     ======================================================= */

  if (
    isStaffLoggedIn(
      worker.id
    )
  ) {

    alert(
      worker.name +
      ' is already logged in.'
    );


    input.value = '';


    return;

  }


  /* =======================================================
     CREATE ATTENDANCE SESSION
     ======================================================= */

  try {

    const session =
      await createAttendanceSession(
        worker.id
      );


    if (!worker.attendance) {

      worker.attendance = [];

    }


    /*
     * createAttendanceSession() already adds the
     * attendance record to worker.attendance.
     */

    const alreadyExists =
      worker.attendance.some(
        function (record) {

          return (
            String(record.id) ===
            String(session.id)
          );

        }
      );


    if (!alreadyExists) {

      worker.attendance.unshift({

        id: session.id,

        sessionId: session.id,

        date: session.date,

        checkIn: session.check_in,

        checkOut: '',

        hours: 0,

        status: 'working'

      });

    }


    /*
     * createAttendanceSession() already adds the
     * worker ID to activeStaffIds.
     *
     * DO NOT push it again here.
     */


    saveLoginSession();


    closeStaffLogin();

    updateStaffUI();

    applyRolePermissions();

    renderWorkersView();


    alert(
      'Welcome ' +
      worker.name +
      '!\nLogin recorded at ' +
      formatAttendanceTime(
        session.check_in
      )
    );


  } catch (error) {

    console.error(
      'Worker login attendance error:',
      error
    );


    alert(
      'Worker login failed.\n\n' +
      (
        error.message ||
        'Could not create attendance record.'
      )
    );

  }

}


/* =========================================================
   STAFF LOGOUT
   ========================================================= */

async function staffLogout() {

  const input =
    document.getElementById(
      'staffPasswordInput'
    );


  const password =
    input.value.trim();


  if (!password) {

    alert(
      'Please enter password.'
    );

    return;

  }


  /* =======================================================
     ROLE 1 — TUX ADMIN
     ======================================================= */

  if (
    password ===
    getTuxAdminPassword()
  ) {

    if (!tuxAdminActive) {

      alert(
        'Tux Admin is not currently logged in.'
      );

      return;

    }


    tuxAdminActive =
      false;


    /*
     * IMPORTANT:
     * DO NOT clear activeStaffIds.
     *
     * The Worker who was logged in before Tux Admin
     * must return after Tux Admin logout.
     */

    saveLoginSession();


    closeStaffLogin();

    updateStaffUI();

    applyRolePermissions();


    alert(
      'Tux Admin logged out.'
    );

    return;

  }


  /* =======================================================
     ROLE 2 — ADMIN
     ======================================================= */

  if (
    adminAccount &&
    String(password) ===
    String(adminAccount.password)
  ) {

    if (!adminActive) {

      alert(
        adminAccount.name +
        ' is not currently logged in.'
      );

      return;

    }


    adminActive =
      false;


    /*
     * IMPORTANT:
     * DO NOT clear activeStaffIds.
     *
     * The Worker who was logged in before Admin
     * must return after Admin logout.
     */

    saveLoginSession();


    closeStaffLogin();

    updateStaffUI();

    applyRolePermissions();


    alert(
      adminAccount.name +
      ' logged out.'
    );

    return;

  }


  /* =======================================================
     ROLE 3 — WORKER
     ======================================================= */

  const worker =
    workersList.find(
      function (w) {

        return (
          String(w.password) ===
          String(password)
        );

      }
    );


  if (!worker) {

    alert(
      'Incorrect password!'
    );


    input.value = '';

    input.focus();


    return;

  }


  if (
    !isStaffLoggedIn(
      worker.id
    )
  ) {

    alert(
      worker.name +
      ' is not currently logged in.'
    );

    return;

  }


  /* =======================================================
     FIND OPEN LOCAL SESSION
     ======================================================= */

  let localSession = null;


  if (
    worker.attendance
  ) {

    localSession =
      worker.attendance.find(
        function (record) {

          return (
            record.checkIn &&
            !record.checkOut &&
            record.status === 'working'
          );

        }
      );

  }


  /* =======================================================
     LOAD FROM SUPABASE IF NECESSARY
     ======================================================= */

  if (!localSession) {

    try {

      await loadWorkerAttendance(
        worker.id
      );


      localSession =
        worker.attendance.find(
          function (record) {

            return (
              record.checkIn &&
              !record.checkOut &&
              record.status === 'working'
            );

          }
        );


    } catch (error) {

      console.error(
        'Could not load worker attendance:',
        error
      );


      alert(
        'Could not load attendance data.\n\n' +
        (
          error.message ||
          'Please try again.'
        )
      );


      return;

    }

  }


  /* =======================================================
     NO OPEN SESSION
     ======================================================= */

  if (!localSession) {

    activeStaffIds =
      activeStaffIds.filter(
        function (id) {

          return (
            String(id) !==
            String(worker.id)
          );

        }
      );


    saveLoginSession();


    updateStaffUI();

    applyRolePermissions();

    renderWorkersView();


    alert(
      worker.name +
      ' has no open attendance session.'
    );


    return;

  }


  /* =======================================================
     CLOSE SESSION
     ======================================================= */

  try {

    const checkOut =
      new Date();


    const checkIn =
      new Date(
        localSession.checkIn
      );


    const hours =
      Math.max(
        0,
        (
          checkOut.getTime() -
          checkIn.getTime()
        ) / 3600000
      );


    const roundedHours =
      Math.round(
        hours * 100
      ) / 100;


    const updated =
      await closeAttendanceSession(
        localSession.id,
        roundedHours
      );


    /* -------------------------------------------------------
       Remove worker from THIS TAB's active staff list
       ------------------------------------------------------- */

    activeStaffIds =
      activeStaffIds.filter(
        function (id) {

          return (
            String(id) !==
            String(worker.id)
          );

        }
      );


    saveLoginSession();


    closeStaffLogin();

    updateStaffUI();

    applyRolePermissions();

    renderWorkersView();


    alert(
      'Goodbye ' +
      worker.name +
      '!\nLogout recorded at ' +
      formatAttendanceTime(
        updated.check_out
      ) +
      '\nWorked: ' +
      formatHours(
        Number(updated.hours || 0)
      )
    );


  } catch (error) {

    console.error(
      'Worker logout attendance error:',
      error
    );


    alert(
      'Worker logout failed.\n\n' +
      (
        error.message ||
        'Could not close attendance record.'
      )
    );

  }

}


/* =========================================================
   END SHIFT
   ========================================================= */

async function logoutEveryoneAtEndOfDay() {

  try {

    await closeAllAttendanceSessions();


    activeStaffIds = [];


    tuxAdminActive =
      false;


    adminActive =
      false;


    clearLoginSession();


    updateStaffUI();

    applyRolePermissions();

    renderWorkersView();


  } catch (error) {

    console.error(
      'Failed to close all attendance sessions:',
      error
    );


    alert(
      'Could not close all attendance sessions.\n\n' +
      (
        error.message ||
        'Please try again.'
      )
    );

  }

}


/* =========================================================
   ATTENDANCE TIME FORMAT
   ========================================================= */

function formatAttendanceTime(value) {

  if (!value) {

    return '';

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(value);

  }


  return date.toLocaleTimeString(
    [],
    {
      hour: '2-digit',
      minute: '2-digit'
    }
  );

}