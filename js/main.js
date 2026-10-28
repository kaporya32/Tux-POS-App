/* =========================================================
   TUX POS — APP ENTRY POINT
   Page navigation and the startup sequence.
   (Loaded last, after every other script.)
   ========================================================= */


/* =========================================================
   RESTRICTED VIEWS
   Worker cannot access these pages.
   Stock and Hawalk are intentionally excluded.
   ========================================================= */

const RESTRICTED_VIEWS = [
  'expenses',
  'sales',
  'workers',
  'gamiya',
  'settings'
];


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */


async function switchView(viewName, btnElement) {
  const role = String(
    typeof getActiveRole === 'function'
      ? getActiveRole() || ''
      : ''
  ).trim().toLowerCase();

  /*
   * TUX POS PAGE ACCESS
   *
   * Logged out:
   *   Cashier only
   *
   * Worker:
   *   Cannot access restricted admin pages
   *   Can access Stock and Hawalk
   *
   * Admin:
   *   Can access admin pages
   *
   * Tux Admin:
   *   Can access admin pages and Tux Admin controls
   */

  // Validate the requested view before changing the UI.
  const requestedView = document.getElementById(
    viewName + '-view'
  );

  if (!requestedView) {
    console.error(
      'TUX POS — View not found:',
      viewName + '-view'
    );
    return;
  }

  // BLOCK ALL NON-CASHIER PAGES WHEN LOGGED OUT.
  if (!role && viewName !== 'cashier') {
    alert('Please log in to access this page.');

    const cashierButton = document.getElementById('navCashier');

    switchView('cashier', cashierButton);
    return;
  }

  // WORKER PERMISSIONS.
  if (
    role === 'worker' &&
    viewName !== 'stock' &&
    viewName !== 'hawalk' &&
    Array.isArray(RESTRICTED_VIEWS) &&
    RESTRICTED_VIEWS.includes(viewName)
  ) {
    alert(
      'You do not have permission to access this page. ' +
      'Please log in as Admin or Tux Admin.'
    );

    return;
  }

  // Only change views after the access checks pass.
  document.querySelectorAll('.view-section').forEach(function (el) {
    el.classList.remove('active');
  });

  document.querySelectorAll('.nav-btn').forEach(function (el) {
    el.classList.remove('active');
  });

  requestedView.classList.add('active');

  const actualButton =
    btnElement || document.getElementById(
      'nav' +
      viewName.charAt(0).toUpperCase() +
      viewName.slice(1)
    );

  if (actualButton) {
    actualButton.classList.add('active');
  }

  // Load the requested view.
  if (viewName === 'board') {
    loadKitchenOrdersFromSupabase();
  } else if (viewName === 'expenses') {
    populateExpenseStockSelect();
    renderExpensesTable();
  } else if (viewName === 'sales') {
    refreshReportsFromSupabase();
  } else if (viewName === 'stock') {
    renderStockView();
    renderStockSettings();
  } else if (viewName === 'hawalk') {
    renderHawalkView();
  } else if (viewName === 'workers') {
    renderWorkersView();
  } else if (viewName === 'onlineWorkers') {
    renderOnlineWorkersView();
  } else if (viewName === 'gamiya') {
    renderGamiyaView();
  } else if (viewName === 'settings') {
  renderStockSettings();
  populateRecipeItemSelect();
  renderCategoryColorsSettings();

  if (typeof initializePrintSettingsUI === 'function') {
    initializePrintSettingsUI();
  }

  if (typeof loadPrintSettings === 'function') {
    await loadPrintSettings();
  }
}
}



/* =========================================================
   WORKERS REALTIME UI UPDATE
   ========================================================= */

window.addEventListener(
  'tux-workers-updated',
  function (event) {

    console.log(
      'TUX POS — Workers UI updated from realtime:',
      event.detail
    );


    if (
      typeof renderWorkersView === 'function'
    ) {

      renderWorkersView();

    }


    if (
      typeof updateStaffUI === 'function'
    ) {

      updateStaffUI();

    }

  }
);


/* =========================================================
   ATTENDANCE REALTIME UI UPDATE
   ========================================================= */

window.addEventListener(
  'tux-attendance-updated',
  function () {

    console.log(
      'TUX POS — Attendance UI updated from realtime.'
    );


    if (
      typeof renderWorkersView === 'function'
    ) {

      renderWorkersView();

    }


    if (
      typeof renderSelectedWorker === 'function'
    ) {

      renderSelectedWorker();

    }


    if (
      typeof updateStaffUI === 'function'
    ) {

      updateStaffUI();

    }

  }
);


/* =========================================================
   SHIFTS REALTIME UI UPDATE
   ========================================================= */

window.addEventListener(
  'tux-shifts-updated',
  function () {

    console.log(
      'TUX POS — Shifts UI updated from realtime.'
    );


    if (
      typeof updateShiftUI === 'function'
    ) {

      updateShiftUI();

    }


    if (
      typeof renderShiftHistory === 'function'
    ) {

      renderShiftHistory();

    }


    if (
      typeof updateStaffUI === 'function'
    ) {

      updateStaffUI();

    }

  }
);


/* =========================================================
   STOCK REALTIME UI UPDATE
   ========================================================= */

window.addEventListener(
  'tux-stock-realtime-updated',
  function () {

    console.log(
      'TUX POS — Stock UI updated from realtime.'
    );


    if (
      typeof renderStockView === 'function'
    ) {

      renderStockView();

    }


    if (
      typeof renderStockSettings === 'function'
    ) {

      renderStockSettings();

    }


    if (
      typeof populateRecipeItemSelect === 'function'
    ) {

      populateRecipeItemSelect();

    }


    if (
      typeof renderHawalkView === 'function'
    ) {

      const hawalkView =
        document.getElementById(
          'hawalk-view'
        );


      if (
        hawalkView &&
        hawalkView.classList.contains(
          'active'
        )
      ) {

        renderHawalkView();

      }

    }

  }
);


/* =========================================================
   HAWALK REALTIME UI UPDATE
   ========================================================= */

window.addEventListener(
  'tux-hawalk-updated',
  function () {

    console.log(
      'TUX POS — Hawalk UI updated from realtime.'
    );


    if (
      typeof renderHawalkView === 'function'
    ) {

      const hawalkView =
        document.getElementById(
          'hawalk-view'
        );


      if (
        hawalkView &&
        hawalkView.classList.contains(
          'active'
        )
      ) {

        renderHawalkView();

      }

    }

  }
);


/* =========================================================
   APPLICATION STARTUP
   ========================================================= */

async function initializeApp() {

  try {

    console.log(
      'TUX POS — Starting application...'
    );


    /* =====================================================
       WORKERS
       ===================================================== */

    console.log(
      'TUX POS — Loading workers from Supabase...'
    );


    await loadWorkersFromSupabase();


    console.log(
      'TUX POS — Workers loaded:',
      workersList
    );


    /* =====================================================
       START WORKERS REALTIME
       ===================================================== */

    console.log(
      'TUX POS — Starting workers realtime...'
    );


    startWorkersRealtime();


    /* =====================================================
       ATTENDANCE
       ===================================================== */

    console.log(
      'TUX POS — Loading attendance from Supabase...'
    );


    await loadAllAttendance();


    console.log(
      'TUX POS — Attendance loaded.'
    );


    /* =====================================================
       START ATTENDANCE REALTIME
       ===================================================== */

    console.log(
      'TUX POS — Starting attendance realtime...'
    );


    startAttendanceRealtime();


/* =====================================================
   LOGIN SESSION
   ===================================================== */

console.log(
  'TUX POS — Restoring login session...'
);

if (
  typeof window.restoreLoginSession !== 'function'
) {
  throw new Error(
    'TUX POS — restoreLoginSession is unavailable. ' +
    'Check that auth.js loads before main.js.'
  );
}

await window.restoreLoginSession();

console.log(
  'TUX POS — Login session restored.'
);



    /* =====================================================
       MENU
       ===================================================== */

    console.log(
      'TUX POS — Loading menu from Supabase...'
    );


    await loadMenu();


    console.log(
      'TUX POS — Menu loaded:',
      menuItems
    );


    console.log(
      'TUX POS — Extras loaded:',
      extrasItems
    );


    /* =====================================================
       CATEGORY COLORS
       ===================================================== */

    console.log(
      'TUX POS — Loading category colors from Supabase...'
    );


    await loadCategoryColors();


    console.log(
      'TUX POS — Category colors loaded.'
    );


    /* =====================================================
       START CATEGORY COLORS REALTIME
       ===================================================== */

    console.log(
      'TUX POS — Starting category colors realtime...'
    );


    initializeCategoryColorsRealtime();


    /* =====================================================
       SHIFT
       ===================================================== */

    console.log(
      'TUX POS — Loading shift data from Supabase...'
    );


    await loadSavedShiftData();


    console.log(
      'TUX POS — Shift data loaded.'
    );


    /* =====================================================
       START SHIFTS REALTIME
       ===================================================== */

    console.log(
      'TUX POS — Starting shifts realtime...'
    );


    startShiftsRealtime();


    /* =====================================================
       STOCK
       ===================================================== */

    console.log(
      'TUX POS — Loading stock from Supabase...'
    );


    await loadStockFromSupabase();


    console.log(
      'TUX POS — Stock loaded:',
      stockInventory
    );


    /* =====================================================
       RECIPES
       ===================================================== */

    console.log(
      'TUX POS — Loading recipes from Supabase...'
    );


    await loadRecipesFromSupabase();


    console.log(
      'TUX POS — Recipes loaded:',
      recipes
    );


    /* =====================================================
       START STOCK REALTIME
       ===================================================== */

    console.log(
      'TUX POS — Starting stock realtime...'
    );


    startStockRealtime();


    /* =====================================================
       HAWALK
       ===================================================== */

    console.log(
      'TUX POS — Loading Hawalk requests from Supabase...'
    );


    await loadHawalkRequestsFromSupabase();


    console.log(
      'TUX POS — Hawalk requests loaded:',
      getHawalkRequests()
    );


    /* =====================================================
       START HAWALK REALTIME
       ===================================================== */

    console.log(
      'TUX POS — Starting Hawalk realtime...'
    );


    startHawalkRealtime();


    /* =====================================================
       EXPENSES
       ===================================================== */

    console.log(
      'TUX POS — Loading expenses from Supabase...'
    );


    await loadExpensesFromSupabase();


    console.log(
      'TUX POS — Expenses loaded:',
      expensesList
    );


    /* =====================================================
       START EXPENSES REALTIME
       ===================================================== */

    console.log(
      'TUX POS — Starting expenses realtime...'
    );


    startExpensesRealtime();


    /* =====================================================
       HISTORICAL REPORTS
       ===================================================== */

    console.log(
      'TUX POS — Loading historical reports from Supabase...'
    );


    await loadReportsFromSupabase();


    console.log(
      'TUX POS — Historical reports loaded.'
    );


    /* =====================================================
       GAM3YA
       ===================================================== */

    console.log(
      'TUX POS — Loading Gam3ya from Supabase...'
    );


    await loadGamiyaFromSupabase();


    console.log(
      'TUX POS — Gam3ya loaded:',
      gamiyaOrders
    );


    /* =====================================================
       START GAM3YA REALTIME
       ===================================================== */

    console.log(
      'TUX POS — Starting Gam3ya realtime...'
    );


    startGamiyaRealtime();

/* =====================================================
   KITCHEN ORDERS
   ===================================================== */

console.log(
  'TUX POS — Loading Kitchen orders from Supabase...'
);

if (typeof window.loadKitchenOrdersFromSupabase !== 'function') {
  throw new Error(
    'loadKitchenOrdersFromSupabase is unavailable. ' +
    'Check js/kitchen/kitchen.js for syntax errors.'
  );
}

await window.loadKitchenOrdersFromSupabase();

console.log(
  'TUX POS — Kitchen orders loaded:',
  kitchenOrders
);
    /* =====================================================
       START ORDERS REALTIME
       ===================================================== */

    console.log(
      'TUX POS — Starting orders realtime...'
    );


    startOrdersRealtime();


    /* =====================================================
       OLD DATA MIGRATION
       ===================================================== */

    migrateWorkerData();


    /* =====================================================
       RENDER APPLICATION
       ===================================================== */

    renderMenu();

    renderExtras();

    renderStockView();

    renderStockSettings();

    populateRecipeItemSelect();

    populateDeleteMenuSelect();

    populateExpenseStockSelect();

    renderExpensesTable();

    renderWorkersView();

    renderGamiyaView();

    renderShiftHistory();

    renderSalesReport();

    updateShiftUI();

    updateLiveClock();

    updateStaffUI();

    applyRolePermissions();

    applyHawalkRoleUI();

    renderHawalkView();

    renderCategoryColorsSettings();

    applyCategoryColorsToMenu();


    /* =====================================================
       LIVE CLOCK
       ===================================================== */

    setInterval(
      updateLiveClock,
      1000
    );


    /* =====================================================
       PERIODIC UI UPDATE
       ===================================================== */

    setInterval(
      function () {

        const workersView =
          document.getElementById(
            'workers-view'
          );


        if (
          workersView &&
          workersView.classList.contains(
            'active'
          )
        ) {

          renderWorkersView();

        }


        const hawalkView =
          document.getElementById(
            'hawalk-view'
          );


        if (
          hawalkView &&
          hawalkView.classList.contains(
            'active'
          )
        ) {

          renderHawalkView();

        }


        updateStaffUI();

      },
      30000
    );


    console.log(
      'TUX POS — Application started successfully.'
    );

  }

  catch (error) {

    console.error(
      'TUX POS — Application startup failed:',
      error
    );


    alert(
      'TUX POS could not load the application data. Please refresh the page and try again.'
    );

  }

}


/* =========================================================
   START APPLICATION
   Supports dynamically loaded main.js.
   ========================================================= */

if (document.readyState === 'complete') {
  initializeApp();
} else {
  window.addEventListener('load', initializeApp, {
    once: true
  });
}



 
 
/* ========================================================= 
   TUX POS — GLOBAL BEAUTIFUL NOTIFICATION SYSTEM 
   Requires the tuxAlertModal HTML and CSS. 
   ========================================================= */ 
 
let tuxAlertQueue = []; 
let tuxAlertIsOpen = false; 
let tuxAlertCurrentResolve = null; 
 
 
/* ========================================================= 
   NOTIFICATION CONFIGURATION 
   ========================================================= */ 
 
function getTuxAlertConfig(type) { 
 
  const configs = { 
    success: { 
      title: 'Success', 
      icon: '✓', 
      className: 'tux-alert-success' 
    }, 
 
    error: { 
      title: 'Something Went Wrong', 
      icon: '✕', 
      className: 'tux-alert-error' 
    }, 
 
    warning: { 
      title: 'Warning', 
      icon: '!', 
      className: 'tux-alert-warning' 
    }, 
 
    info: { 
      title: 'Notification', 
      icon: 'i', 
      className: 'tux-alert-info' 
    }, 
 
    confirm: { 
      title: 'Confirm Action', 
      icon: '?', 
      className: 'tux-alert-confirm' 
    } 
  }; 
 
  return configs[type] || configs.info; 
} 
 
 
/* ========================================================= 
   SHOW NOTIFICATION 
   ========================================================= */ 
 
function tuxAlert(message, type = 'info', options = {}) { 
 
  return new Promise(function (resolve) { 
 
    tuxAlertQueue.push({ 
      message: String(message ?? ''), 
      type: type, 
      options: options, 
      resolve: resolve 
    }); 
 
    processTuxAlertQueue(); 
 
  }); 
} 
 
 
/* ========================================================= 
   PROCESS NOTIFICATION QUEUE 
   ========================================================= */ 
 
function processTuxAlertQueue() { 
 
  if (tuxAlertIsOpen || tuxAlertQueue.length === 0) { 
    return; 
  } 
 
  const modal = document.getElementById('tuxAlertModal'); 
 
  const title = document.getElementById('tuxAlertTitle'); 
  const message = document.getElementById('tuxAlertMessage'); 
  const icon = document.getElementById('tuxAlertIcon'); 
 
  const confirmButton = document.getElementById( 
    'tuxAlertConfirmBtn' 
  ); 
 
  const cancelButton = document.getElementById( 
    'tuxAlertCancelBtn' 
  ); 
 
  if ( 
    !modal || 
    !title || 
    !message || 
    !icon || 
    !confirmButton || 
    !cancelButton 
  ) { 
 
    console.error( 
      'TUX POS — Notification modal HTML is missing.' 
    ); 
 
    const pending = tuxAlertQueue.splice(0); 
 
    pending.forEach(function (item) { 
      item.resolve(false); 
    }); 
 
    return; 
  } 
 
  const item = tuxAlertQueue.shift(); 
 
  const config = getTuxAlertConfig(item.type); 
 
  tuxAlertIsOpen = true; 
  tuxAlertCurrentResolve = item.resolve; 
 
  title.textContent = 
    item.options.title || config.title; 
 
  message.textContent = item.message; 
 
  icon.textContent = config.icon; 
 
  icon.className = 
    'tux-alert-icon ' + config.className; 
 
  confirmButton.textContent = 
    item.options.confirmText || 'OK'; 
 
  cancelButton.textContent = 
    item.options.cancelText || 'Cancel'; 
 
  cancelButton.style.display = 
    item.type === 'confirm' ? '' : 'none'; 
 
  modal.style.display = 'flex'; 
 
  requestAnimationFrame(function () { 
    modal.classList.add('tux-alert-visible'); 
  }); 
 
  confirmButton.onclick = function () { 
    closeTuxAlert(true); 
  }; 
 
  cancelButton.onclick = function () { 
    closeTuxAlert(false); 
  }; 
 
  modal.onclick = function (event) { 
 
    if (event.target === modal) { 
 
      if (item.type === 'confirm') { 
        closeTuxAlert(false); 
      } 
 
    } 
 
  }; 
 
  function handleKeydown(event) { 
 
    if (event.key === 'Escape') { 
 
      event.preventDefault(); 
 
      closeTuxAlert( 
        item.type === 'confirm' ? false : true 
      ); 
 
    } 
 
    if (event.key === 'Enter') { 
 
      if ( 
        document.activeElement !== cancelButton 
      ) { 
 
        event.preventDefault(); 
        closeTuxAlert(true); 
 
      } 
 
    } 
 
  } 
 
  item.handleKeydown = handleKeydown;

tuxAlertActiveKeyHandler = handleKeydown;

document.addEventListener(
  'keydown',
  handleKeydown
);
 
  setTimeout(function () { 
    confirmButton.focus(); 
  }, 50); 
 
} 
 
 
/* ========================================================= 
   CLOSE NOTIFICATION 
   ========================================================= */ 
 
function closeTuxAlert(result) { 
 
  if (!tuxAlertIsOpen) { 
    return; 
  } 
 
  const modal = document.getElementById('tuxAlertModal'); 
 
  if (modal) { 
 
    modal.classList.remove('tux-alert-visible'); 
 
    modal.style.display = 'none'; 
 
    modal.onclick = null; 
 
  } 
 
  const itemResolve = tuxAlertCurrentResolve; 
 
  tuxAlertCurrentResolve = null; 
  tuxAlertIsOpen = false; 
 
  // Remove the current notification's keyboard listener. 
  // The listener is also removed safely by the next open. 
  if (tuxAlertActiveKeyHandler) { 
 
    document.removeEventListener( 
      'keydown', 
      tuxAlertActiveKeyHandler 
    ); 
 
    tuxAlertActiveKeyHandler = null; 
 
  } 
 
  if (typeof itemResolve === 'function') { 
    itemResolve(Boolean(result)); 
  } 
 
  setTimeout(function () { 
    processTuxAlertQueue(); 
  }, 180); 
 
} 
 
 
/* ========================================================= 
   KEYBOARD HANDLER TRACKING 
   ========================================================= */ 
 
let tuxAlertActiveKeyHandler = null; 
 
 
/* ========================================================= 
   COMPATIBLE CONFIRMATION API 
   ========================================================= */ 
 
function tuxConfirm(message, options = {}) { 
 
  return tuxAlert( 
    message, 
    'confirm', 
    { 
      title: options.title || 'Confirm Action', 
      confirmText: options.confirmText || 'Confirm', 
      cancelText: options.cancelText || 'Cancel' 
    } 
  ); 
 
} 
 

/* =========================================================
   TUX POS — CONNECT EXISTING ALERTS TO BEAUTIFUL MODALS
   ========================================================= */

(function () {

  const originalAlert = window.alert.bind(window);

  window.alert = function (message) {

    if (typeof window.tuxAlert === 'function') {

      window.tuxAlert(
        String(message ?? ''),
        'info'
      );

      return;
    }

    // Fallback if the custom modal is unavailable.
    originalAlert(message);

  };

  console.log(
    'TUX POS — Beautiful alerts are now enabled.'
  );

})();






/* =========================================================
   TUX POS — GLOBAL BEAUTIFUL ALERT SYSTEM
   Automatically upgrades existing alert() calls.
   ========================================================= */

(function enableTuxGlobalAlerts() {

  // Prevent installing the integration more than once.
  if (window.__tuxBeautifulAlertsEnabled) {
    return;
  }

  // Preserve the original browser alert as a fallback.
  const originalBrowserAlert = window.alert.bind(window);

  // Automatically determine the notification style.
  function detectTuxAlertType(message) {

    const text = String(message || '').toLowerCase();

    // Error messages.
    if (
      text.includes('error') ||
      text.includes('failed') ||
      text.includes('failure') ||
      text.includes('could not') ||
      text.includes('unable to') ||
      text.includes('invalid') ||
      text.includes('exception') ||
      text.includes('not found') ||
      text.includes('violates')
    ) {
      return 'error';
    }

    // Successful actions.
    if (
      text.includes('successfully') ||
      text.includes('successful') ||
      text.includes('completed successfully') ||
      text.includes('saved successfully') ||
      text.includes('submitted successfully')
    ) {
      return 'success';
    }

    // Warnings and permission messages.
    if (
      text.includes('warning') ||
      text.includes('not allowed') ||
      text.includes('cannot') ||
      text.includes('can not') ||
      text.includes('only a worker') ||
      text.includes('view-only') ||
      text.includes('please enter') ||
      text.includes('must be') ||
      text.includes('already closed')
    ) {
      return 'warning';
    }

    return 'info';
  }

  // Replace browser alerts throughout the application.
  window.alert = function tuxGlobalAlert(message) {

    const notificationMessage = String(message ?? '');

    try {

      if (
        typeof window.tuxAlert === 'function' &&
        document.getElementById('tuxAlertModal')
      ) {

        const type = detectTuxAlertType(
          notificationMessage
        );

        window.tuxAlert(
          notificationMessage,
          type
        );

        return;
      }

    } catch (error) {

      console.error(
        'TUX POS — Beautiful alert failed:',
        error
      );

    }

    // Fall back to the browser alert if the custom
    // notification system is unavailable.
    originalBrowserAlert(notificationMessage);

  };

  window.__tuxBeautifulAlertsEnabled = true;

  console.log(
    'TUX POS — Beautiful alerts enabled globally.'
  );

})();

/* =========================================================
   TUX POS — NAVBAR THEME TOGGLE
   Applies theme to Navbar + Cashier only
   Saves selection in localStorage
   ========================================================= */

const TUX_THEME_STORAGE_KEY = 'tuxPosTheme';


/* =========================================================
   APPLY THEME
   ========================================================= */

function setTuxTheme(theme) {
  const selectedTheme =
    theme === 'light' ? 'light' : 'dark';

  const navbar =
    document.querySelector('.top-nav');

  const cashier =
    document.getElementById('cashier-view');

  if (navbar) {
    navbar.setAttribute(
      'data-theme',
      selectedTheme
    );
  }

  if (cashier) {
    cashier.setAttribute(
      'data-theme',
      selectedTheme
    );
  }

  try {
    localStorage.setItem(
      TUX_THEME_STORAGE_KEY,
      selectedTheme
    );
  } catch (error) {
    console.warn(
      'Unable to save TUX POS theme:',
      error
    );
  }

  updateTuxThemeButton(selectedTheme);
}


/* =========================================================
   UPDATE NAVBAR BUTTON LABEL
   ========================================================= */

function updateTuxThemeButton(theme) {
  const button =
    document.getElementById('tuxThemeToggle');

  if (!button) {
    return;
  }

  if (theme === 'light') {
    button.textContent = '🌙 Dark Mode';

    button.title =
      'Switch to dark mode';
  } else {
    button.textContent = '☀️ Light Mode';

    button.title =
      'Switch to light mode';
  }

  button.setAttribute(
    'aria-label',
    button.title
  );
}

/* =========================================================
   TOGGLE THEME
   ========================================================= */

function toggleTuxTheme() {
  const navbar =
    document.querySelector('.top-nav');

  const cashier =
    document.getElementById('cashier-view');

  const currentTheme =
    navbar?.getAttribute('data-theme') ||
    cashier?.getAttribute('data-theme') ||
    getSavedTuxTheme();

  const nextTheme =
    currentTheme === 'light'
      ? 'dark'
      : 'light';

  setTuxTheme(nextTheme);
}

/* =========================================================
   GET SAVED THEME
   ========================================================= */

function getSavedTuxTheme() {
  try {
    const savedTheme =
      localStorage.getItem(
        TUX_THEME_STORAGE_KEY
      );

    return savedTheme === 'light'
      ? 'light'
      : 'dark';
  } catch (error) {
    return 'dark';
  }
}

/* =========================================================
   INITIALIZE THEME ON PAGE LOAD
   ========================================================= */

function initializeTuxTheme() {
  setTuxTheme(getSavedTuxTheme());
}


/* =========================================================
   STARTUP
   ========================================================= */

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializeTuxTheme,
    { once: true }
  );
} else {
  initializeTuxTheme();
}

/* =========================================================
   TUX POS — MERGE SAVED SHIFT HISTORY FROM SUPABASE
   ========================================================= */

async function mergeSavedShiftSnapshotsIntoHistory() {
  try {
    if (
      typeof supabaseClient === 'undefined' ||
      !supabaseClient
    ) {
      throw new Error('Supabase client is unavailable.');
    }

    const {
      data,
      error
    } = await supabaseClient
      .from('shift_history')
      .select('shift_id, snapshot, closed_at')
      .order('closed_at', {
        ascending: false
      });

    if (error) {
      throw error;
    }

    const savedSnapshots = Array.isArray(data)
      ? data
      : [];

    const existingHistory =
      Array.isArray(shiftHistory)
        ? shiftHistory
        : [];

    const historyByShiftId = new Map();

    existingHistory.forEach(snapshot => {
      if (!snapshot) return;

      const shiftId = String(
        snapshot.supabaseId ||
        snapshot.shift_id ||
        ''
      ).trim();

      if (shiftId) {
        historyByShiftId.set(
          shiftId,
          snapshot
        );
      }
    });

    savedSnapshots.forEach(row => {
      if (!row || !row.shift_id || !row.snapshot) {
        return;
      }

      const shiftId = String(row.shift_id);

      const savedSnapshot = {
        ...row.snapshot,
        supabaseId: shiftId,
        closedAt:
          row.closed_at ||
          row.snapshot.closedAt ||
          null
      };

      const existingSnapshot =
        historyByShiftId.get(shiftId);

      if (existingSnapshot) {
        historyByShiftId.set(
          shiftId,
          {
            ...savedSnapshot,
            ...existingSnapshot,
            supabaseId: shiftId
          }
        );
      } else {
        historyByShiftId.set(
          shiftId,
          savedSnapshot
        );
      }
    });

    shiftHistory = Array.from(
      historyByShiftId.values()
    ).sort((a, b) => {
      const dateA = new Date(
        a.endDate ||
        a.closedAt ||
        a.startDate ||
        0
      ).getTime();

      const dateB = new Date(
        b.endDate ||
        b.closedAt ||
        b.startDate ||
        0
      ).getTime();

      return dateB - dateA;
    });

    localStorage.setItem(
      'tuxShiftHistory',
      JSON.stringify(shiftHistory)
    );

    console.log(
      'Shift History merged successfully:',
      shiftHistory.length
    );

    return shiftHistory;

  } catch (error) {
    console.error(
      'Failed to merge saved Shift History:',
      error
    );

    throw error;
  }
}

