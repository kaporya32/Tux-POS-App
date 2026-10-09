
/* =========================================================
   TUX POS — REPORT SHIFTS
   Start Shift / End Shift
   Supabase persistence and immediate UI refresh
   ========================================================= */


/* =========================================================
   SHIFT MANAGEMENT
   ========================================================= */

function updateShiftUI() {

  const statusEl =
    document.getElementById('shiftStatus');

  const startBtn =
    document.getElementById('startShiftBtn');

  const endBtn =
    document.getElementById('endShiftBtn');

  if (!statusEl) {
    return;
  }

  if (
    currentShift &&
    currentShift.active
  ) {

    statusEl.innerText =
      'Shift (' +
      (currentShift.shiftNumber || 1) +
      ') Started: ' +
      currentShift.startTime;

    statusEl.style.color =
      '#2ecc71';

    if (startBtn) {

      startBtn.disabled = true;

      startBtn.style.opacity =
        '0.45';

    }

    if (endBtn) {

      endBtn.disabled = false;

      endBtn.style.opacity =
        '1';

    }

  } else {

    statusEl.innerText =
      'Shift Not Started';

    statusEl.style.color =
      '#aaa';

    if (startBtn) {

      startBtn.disabled = false;

      startBtn.style.opacity =
        '1';

    }

    if (endBtn) {

      endBtn.disabled = true;

      endBtn.style.opacity =
        '0.45';

    }

  }

}


/* =========================================================
   REQUIRE ACTIVE SHIFT
   ========================================================= */

function requireActiveShift() {

  if (
    currentShift &&
    currentShift.active
  ) {

    return true;

  }

  alert(
    'Shift has not started!\n' +
    'Please start a shift before taking any order.'
  );

  return false;

}


/* =========================================================
   REPORT REFRESH
   Reload saved report data and redraw the report UI.
   ========================================================= */

async function refreshShiftReports() {

  try {

    if (
      typeof loadReportsFromSupabase ===
      'function'
    ) {

      await loadReportsFromSupabase();

    }

    if (
      typeof loadAdminReportFinanceFromSupabase ===
      'function'
    ) {

      await loadAdminReportFinanceFromSupabase();

    }

    if (
      typeof renderSalesReport ===
      'function'
    ) {

      renderSalesReport();

    }

    if (
      typeof renderShiftHistory ===
      'function'
    ) {

      renderShiftHistory();

    }

    return true;

  } catch (error) {

    console.error(
      'TUX POS: Failed to refresh shift reports:',
      error
    );

    return false;

  }

}


/* =========================================================
   START SHIFT
   ========================================================= */

function startShift() {

  if (
    getActiveRole() ===
    'admin'
  ) {

    alert(
      'Admin is in Spectate Mode. You cannot start a shift.'
    );

    return;

  }

  if (
    currentShift &&
    currentShift.active
  ) {

    alert(
      'There is already an active shift.'
    );

    return;

  }

  if (
    getActiveWorkers().length === 0 &&
    !tuxAdminActive
  ) {

    alert(
      'Please login as staff first, then start the shift.'
    );

    openStaffLogin();

    return;

  }

  const hasOldData =
    completedSales.length > 0 ||
    kitchenOrders.length > 0 ||
    expensesList.length > 0;

  const startMsg =
    '▶ START SHIFT\n\n' +
    'Are you sure you want to start a new shift?' +
    (
      hasOldData
        ? '\n\nThe previous current-day data (orders, kitchen board, expenses) will be cleared. Saved Shift History and Gam3ya will NOT be deleted.'
        : ''
    );

  if (
    !confirm(startMsg)
  ) {

    return;

  }

  finalizeStartShift();

}


/* =========================================================
   START SHIFT — SUPABASE
   ========================================================= */

async function finalizeStartShift() {

  try {

    const createdShift =
      await createShiftInSupabase();

    if (!createdShift) {
      return;
    }

    currentOrder = [];

    kitchenOrders = [];

    completedSales = [];

    expensesList = [];

    orderCounter = 1;

    localStorage.setItem(
      'tuxOrderCounter',
      '1'
    );

    updateOrderUI();

    renderKitchenBoard();

    renderExpensesTable();

    renderGamiyaView();

    await refreshShiftReports();

    updateShiftUI();

    alert(
      'Shift started successfully. Opening balances were updated from current stock. Order numbering restarted from Order #1.'
    );

  } catch (error) {

    console.error(
      'TUX POS: Failed to start shift:',
      error
    );

    alert(
      'Could not start the shift. Please check the connection and try again.'
    );

  }

}


/* =========================================================
   BLOCK END SHIFT IF PREPARING
   ========================================================= */

function blockEndShiftIfPreparing() {

  const pending =
    kitchenOrders.filter(
      function (ord) {

        return (
          ord.status === 'preparing'
        );

      }
    );

  if (
    pending.length === 0
  ) {

    return false;

  }

  alert(
    'Cannot end the shift!\n\n' +
    pending.length +
    ' order(s) are not finished yet: ' +
    pending
      .map(
        function (ord) {

          return (
            '#' +
            ord.orderNum
          );

        }
      )
      .join(', ') +
    '\n\nPlease mark every order as Done or Cancelled in the Kitchen Board first.'
  );

  return true;

}


/* =========================================================
   END SHIFT
   ========================================================= */

function endShift() {

  if (
    getActiveRole() ===
    'admin'
  ) {

    alert(
      'Admin is in Spectate Mode. You cannot end a shift.'
    );

    return;

  }

  if (
    !currentShift ||
    !currentShift.active
  ) {

    alert(
      'There is no active shift.'
    );

    return;

  }

  if (
    blockEndShiftIfPreparing()
  ) {

    return;

  }

  const endMsg =
    '■ END SHIFT\n\n' +
    'Are you sure you want to end the shift?\n' +
    'Current stock will automatically become the opening balance for the next shift, then ALL workers, Admin and Tux Admin will be logged out.';

  if (
    !confirm(endMsg)
  ) {

    return;

  }

  finalizeEndShift();

}


/* =========================================================
   END SHIFT — SUPABASE
   ========================================================= */

async function finalizeEndShift() {

  if (
    blockEndShiftIfPreparing()
  ) {

    return;

  }

  try {

    /* =====================================================
       LOAD CURRENT REPORT DATA
       ===================================================== */

    if (
      typeof loadReportsFromSupabase ===
      'function'
    ) {

      await loadReportsFromSupabase();

    }


    /* =====================================================
       LOAD MONTHLY FINANCE
       ===================================================== */

    await loadMonthlyFinanceFromSupabase();


    /* =====================================================
       COMPLETE SHIFT IN SUPABASE
       ===================================================== */

    const completed =
      await completeShiftInSupabase();

    if (!completed) {

      return;

    }


    /* =====================================================
       MONTHLY FINANCE
       ===================================================== */

    ensureMonthlyFinance();

    const snapshot =
      buildShiftSnapshot();

    monthlyFinance.bank +=
      Number(
        snapshot.totalSales || 0
      );

    monthlyFinance.overallExpenses +=
      Number(
        snapshot.totalExpenses || 0
      );

    monthlyFinance.overallOrders +=
      Number(
        snapshot.totalOrders || 0
      );

    monthlyFinance.hurryApp =
      Number(
        monthlyFinance.hurryApp || 0
      ) +
      Number(
        snapshot.dailyHurryApp || 0
      );


    /* =====================================================
       SAVE MONTHLY FINANCE
       ===================================================== */

    const financeSaved =
      await saveMonthlyFinanceToSupabase();

    if (!financeSaved) {

      alert(
        'The shift was completed, but monthly finance could not be saved. Please check Supabase before continuing.'
      );

      return;

    }


    /* =====================================================
       ADMIN REPORTS
       ===================================================== */

    if (
      typeof updateAdminReportsAtEndShift ===
      'function'
    ) {

      const adminReportsSaved =
        await updateAdminReportsAtEndShift();

      if (!adminReportsSaved) {

        alert(
          'The shift was completed, but Admin Reports could not be saved. Please check Supabase.'
        );

        return;

      }

      if (
        snapshot.adminReports &&
        typeof adminReportFinance ===
          'object'
      ) {

        snapshot.adminReports.bank =
          Number(
            adminReportFinance.bank || 0
          );

        snapshot.adminReports.profit =
          Number(
            adminReportFinance.profit || 0
          );

      }

    }


    /* =====================================================
       ADD MONTHLY FINANCE VALUES TO SNAPSHOT
       ===================================================== */

    snapshot.bank =
      monthlyFinance.bank;

    snapshot.overallExpenses =
      monthlyFinance.overallExpenses;

    snapshot.overallOrders =
      monthlyFinance.overallOrders;

    snapshot.hurryApp =
      monthlyFinance.hurryApp;

    snapshot.supabaseId =
      currentShift.supabaseId;


    /* =====================================================
       SAVE SHIFT HISTORY
       ===================================================== */

    shiftHistory.unshift(
      snapshot
    );

    localStorage.setItem(
      'tuxShiftHistory',
      JSON.stringify(
        shiftHistory
      )
    );


    /* =====================================================
       RESET CURRENT SHIFT STATE
       ===================================================== */

    currentShift = null;

    currentOrder = [];

    kitchenOrders = [];

    completedSales = [];

    expensesList = [];

    orderCounter = 1;

    localStorage.setItem(
      'tuxOrderCounter',
      '1'
    );


    /* =====================================================
       REFRESH OTHER UI
       ===================================================== */

    updateOrderUI();

    renderKitchenBoard();

    renderExpensesTable();

    renderGamiyaView();

    renderShiftHistory();

    updateShiftUI();


    /* =====================================================
       LOG EVERYONE OUT
       ===================================================== */

    logoutEveryoneAtEndOfDay();


    /* =====================================================
       REFRESH REPORTS IMMEDIATELY
       ===================================================== */

    await refreshShiftReports();


    /* =====================================================
       FINAL MESSAGE
       ===================================================== */

    alert(
      'Shift ended successfully. Current stock was saved as the opening balance for the next shift, the shift was saved to Supabase, monthly finance and Admin Reports were updated, the Kitchen Board was reset, reports were refreshed, and all workers, Admin and Tux Admin were logged out. The next shift will start from Order #1.'
    );

  } catch (error) {

    console.error(
      'TUX POS: Failed to finalize shift:',
      error
    );

    alert(
      'An error occurred while ending the shift. Please check the browser console and Supabase before trying again.'
    );

  }

}

