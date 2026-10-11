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

function switchView(
  viewName,
  btnElement
) {

  /*
   * STOCK is intentionally accessible to:
   * Worker      → View only
   * Admin       → View only
   * Tux Admin   → Full control
   *
   * HAWALK is intentionally accessible to:
   * Worker      → Request stock
   * Admin       → Approve / Decline
   * Tux Admin   → Approve / Decline
   */

  if (
    viewName !== 'stock' &&
    viewName !== 'hawalk' &&
    RESTRICTED_VIEWS.includes(viewName) &&
    getActiveRole() === 'worker'
  ) {

    alert(
      'You do not have permission to access this page. Please login as Admin or Tux Admin.'
    );

    return;
  }


  document
    .querySelectorAll('.view-section')
    .forEach(function (el) {

      el.classList.remove('active');

    });


  document
    .querySelectorAll('.nav-btn')
    .forEach(function (el) {

      el.classList.remove('active');

    });


  const view =
    document.getElementById(
      viewName + '-view'
    );


  if (view) {

    view.classList.add('active');

  }


  if (btnElement) {

    btnElement.classList.add('active');

  }


  if (viewName === 'board') {

    loadKitchenOrdersFromSupabase();

  }

  else if (viewName === 'expenses') {

    populateExpenseStockSelect();

    renderExpensesTable();

  }

  else if (viewName === 'sales') {

    refreshReportsFromSupabase();

  }

  else if (viewName === 'stock') {

    renderStockView();

    renderStockSettings();

  }

  else if (viewName === 'hawalk') {

    renderHawalkView();

  }

  else if (viewName === 'workers') {


renderWorkersView();


}

else if (viewName === 'onlineWorkers') {


renderOnlineWorkersView();


}


  else if (viewName === 'gamiya') {

    renderGamiyaView();

  }

  else if (viewName === 'settings') {

    renderStockSettings();

    populateRecipeItemSelect();

    renderCategoryColorsSettings();

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


    await restoreLoginSession();


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


    await loadKitchenOrdersFromSupabase();


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