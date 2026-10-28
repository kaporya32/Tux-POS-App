
/* =========================================================
   TUX POS — REPORT SHIFTS
   Start Shift / End Shift
   Supabase persistence and immediate UI refresh
   ========================================================= */
let isStartingShift = false;
let isEndingShift = false;

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
   TUX POS — SHIFT CONFIRMATION MODAL
   ========================================================= */

let tuxShiftConfirmCallback = null;
let tuxShiftConfirmPreviousFocus = null;

function openShiftConfirmModal(options) {
  const modal = document.getElementById('shiftConfirmModal');
  const title = document.getElementById('shiftConfirmTitle');
  const message = document.getElementById('shiftConfirmMessage');
  const cancelBtn = document.getElementById('shiftConfirmCancelBtn');
  const actionBtn = document.getElementById('shiftConfirmActionBtn');

  if (!modal || !title || !message || !cancelBtn || !actionBtn) {
    console.error('TUX POS: Shift confirmation modal elements are missing.');
    alert(options.message || 'Please confirm this action.');
    return Promise.resolve(false);
  }

  if (modal.style.display !== 'none' && tuxShiftConfirmCallback) {
    return Promise.resolve(false);
  }

  tuxShiftConfirmPreviousFocus = document.activeElement;

  title.textContent = options.title || 'Confirm Action';
  message.textContent = options.message || '';
  cancelBtn.textContent = options.cancelText || 'Cancel';
  actionBtn.textContent = options.confirmText || 'Confirm';

  actionBtn.style.background = options.confirmColor || '#e74c3c';

  modal.style.display = 'flex';

  tuxShiftConfirmCallback = null;

  return new Promise((resolve) => {
    tuxShiftConfirmCallback = async (confirmed) => {
      tuxShiftConfirmCallback = null;
      modal.style.display = 'none';

      if (tuxShiftConfirmPreviousFocus?.isConnected) {
        tuxShiftConfirmPreviousFocus.focus();
      }

      tuxShiftConfirmPreviousFocus = null;

      resolve(confirmed);

      if (confirmed && typeof options.onConfirm === 'function') {
        try {
          await options.onConfirm();
        } catch (error) {
          console.error('TUX POS: Confirmed shift action failed:', error);
        }
      }
    };

    actionBtn.focus();
  });
}


function closeShiftConfirmModal() {

  const modal = document.getElementById(
    'shiftConfirmModal'
  );

  if (modal) {

    modal.classList.remove('tux-alert-visible');

    modal.style.display = 'none';

  }

  const callback = tuxShiftConfirmCallback;

  tuxShiftConfirmCallback = null;

  if (typeof callback === 'function') {

    callback(false);

  }

}


function confirmShiftModalAction() {

  const modal = document.getElementById(
    'shiftConfirmModal'
  );

  if (modal) {

    modal.classList.remove('tux-alert-visible');

    modal.style.display = 'none';

  }

  const callback = tuxShiftConfirmCallback;

  tuxShiftConfirmCallback = null;

  if (typeof callback === 'function') {

    callback(true);

  }

}



/* =========================================================
   START SHIFT
   ========================================================= */



async function startShift() {

  // Prevent duplicate Start Shift operations.
  if (isStartingShift || isEndingShift) return;

  // Admin and TUX Admin can start shifts.
  // Workers retain their existing permissions.

  if (currentShift && currentShift.active) {
    alert('There is already an active shift.');
    return;
  }

  if (
    getActiveWorkers().length === 0 &&
    !tuxAdminActive &&
    getActiveRole() !== 'admin'
  ) {
    alert('Please login as staff first, then start the shift.');
    openStaffLogin();
    return;
  }

  const hasOldData =
    completedSales.length > 0 ||
    kitchenOrders.length > 0 ||
    expensesList.length > 0;

  const startMsg =
    'Are you sure you want to start a new shift?' +
    (
      hasOldData
        ? '\n\nThe previous current-day data (orders, kitchen board, expenses) will be cleared. Saved Shift History and Gam3ya will NOT be deleted.'
        : '\n\nOrder numbering will restart from Order #1.'
    );

  const confirmed = await openShiftConfirmModal({
    title: '▶ Start Shift',
    message: startMsg,
    confirmText: 'Start Shift',
    confirmColor: '#16a085'
  });

  if (!confirmed) return;

  // Recheck after the confirmation modal closes.
  if (isStartingShift || isEndingShift) return;

  if (currentShift && currentShift.active) {
    console.warn(
      'TUX POS: A shift is already active. Start Shift cancelled.'
    );
    return;
  }

  isStartingShift = true;

  const button = document.getElementById('start-shift-btn');

  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Starting Shift...';
  }

  try {

    await finalizeStartShift();

  } catch (error) {

    console.error(
      'TUX POS: Failed to start shift:',
      error
    );

    alert(
      'Could not start the shift.\n\n' +
      (error.message || 'Unknown error.')
    );

  } finally {

    isStartingShift = false;

    if (button) {
      button.disabled = false;
      button.textContent =
        button.dataset.originalText || 'Start Shift';

      delete button.dataset.originalText;
    }

  }

}





/* =========================================================
   START SHIFT — SUPABASE
   ========================================================= */

async function finalizeStartShift() {
  try {
    const createdShift = await createShiftInSupabase();

    if (!createdShift) {
      return;
    }

    currentOrder = [];
    kitchenOrders = [];
    completedSales = [];
    expensesList = [];
    orderCounter = 1;

    localStorage.setItem('tuxOrderCounter', '1');

    updateOrderUI();
    renderKitchenBoard();
    renderExpensesTable();
    renderGamiyaView();
    updateShiftUI();

    await refreshShiftReports();

    updateShiftUI();

    // No success alert.
    // The shift starts normally without an additional browser popup.

  } catch (error) {
    console.error('TUX POS: Failed to start shift:', error);

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



async function endShift() {

  // Prevent duplicate clicks while the shift is ending.
  if (isEndingShift || isStartingShift) return;

  // Admin and TUX Admin can end shifts.
  // Workers retain their existing permissions.

  if (!currentShift || !currentShift.active) return;

  if (blockEndShiftIfPreparing()) return;

  const endMsg =
    'Are you sure you want to end the shift?\n\n' +
    'Current stock will automatically become the opening balance for the next shift.\n\n' +
    'Ending the shift will not log workers or administrators out.';

  const confirmed = await openShiftConfirmModal({
    title: '■ End Shift',
    message: endMsg,
    confirmText: 'End Shift',
    confirmColor: '#e74c3c'
  });

  if (!confirmed) return;

  // Recheck after awaiting the confirmation modal.
  if (
    isEndingShift ||
    isStartingShift ||
    !currentShift ||
    !currentShift.active
  ) {
    return;
  }

  isEndingShift = true;

  const button = document.getElementById('end-shift-btn');

  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Ending Shift...';
  }

  try {

    await finalizeEndShift();

  } catch (error) {

    console.error(
      'TUX POS: Failed to end shift:',
      error
    );

    alert(
      'Could not end the shift.\n\n' +
      (error.message || 'Unknown error.')
    );

  } finally {

    isEndingShift = false;

    if (button) {
      button.disabled = false;
      button.textContent =
        button.dataset.originalText || 'End Shift';

      delete button.dataset.originalText;
    }

  }

}





/* =========================================================
   END SHIFT — SUPABASE
   ========================================================= */



/* =========================================================
   TUX POS — FINALIZE END SHIFT
   Permanent Supabase Shift History
   ========================================================= */




async function finalizeEndShift() {
  let endingShift = null;
  let endingShiftId = null;
  let snapshot = null;
  let shiftClosed = false;
  let monthlyFinanceProcessed = false;
  let adminReportsSaved = false;

  try {
    /* =========================================================
       1. VALIDATE ACTIVE SHIFT
       ========================================================= */

    if (
      typeof blockEndShiftIfPreparing === 'function' &&
      blockEndShiftIfPreparing()
    ) {
      return;
    }

    if (
      !currentShift ||
      !currentShift.active ||
      !currentShift.supabaseId
    ) {
      alert('There is no active shift to end.');
      return;
    }

    endingShift = {
      ...currentShift
    };

    endingShiftId = String(
      endingShift.supabaseId
    );

    /* =========================================================
       2. LOAD LATEST REPORTS AND FINANCE
       ========================================================= */

    if (
      typeof loadReportsFromSupabase === 'function'
    ) {
      await loadReportsFromSupabase();
    }

    if (
      typeof loadMonthlyFinanceFromSupabase === 'function'
    ) {
      await loadMonthlyFinanceFromSupabase();
    }

    if (
      typeof ensureMonthlyFinance === 'function'
    ) {
      ensureMonthlyFinance();
    }

    if (
      typeof ensureAdminReportFinance === 'function'
    ) {
      ensureAdminReportFinance();
    }

    /* =========================================================
       3. BUILD SNAPSHOT
       ========================================================= */

    if (
      typeof buildShiftSnapshot !== 'function'
    ) {
      throw new Error(
        'buildShiftSnapshot() is not available.'
      );
    }

    snapshot = buildShiftSnapshot();

    if (
      !snapshot ||
      typeof snapshot !== 'object'
    ) {
      throw new Error(
        'Could not build the shift history snapshot.'
      );
    }

    snapshot.shiftId = endingShiftId;
    snapshot.supabaseId = endingShiftId;

    snapshot.shiftNumber =
      endingShift.shiftNumber ??
      endingShift.shift_number ??
      snapshot.shiftNumber ??
      null;

    snapshot.businessDate =
      endingShift.businessDate ||
      endingShift.business_date ||
      snapshot.businessDate ||
      null;

    /* =========================================================
       4. VALIDATE BUSINESS DATE
       Required format: YYYY-MM-DD
       ========================================================= */

    const businessDate = String(
      endingShift.businessDate ||
      endingShift.business_date ||
      snapshot.businessDate ||
      ''
    ).trim();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)
    ) {
      throw new Error(
        'The shift business date is missing or invalid. ' +
        'Verify business_date in Supabase before ending the shift.'
      );
    }

    const [
      businessYear,
      businessMonth,
      businessDay
    ] = businessDate.split('-').map(Number);

    const parsedBusinessDate = new Date(
      Date.UTC(
        businessYear,
        businessMonth - 1,
        businessDay
      )
    );

    if (
      parsedBusinessDate.getUTCFullYear() !== businessYear ||
      parsedBusinessDate.getUTCMonth() !== businessMonth - 1 ||
      parsedBusinessDate.getUTCDate() !== businessDay
    ) {
      throw new Error(
        'The shift business date is not a valid calendar date.'
      );
    }

    const monthKey =
      `${businessYear}-${String(businessMonth).padStart(2, '0')}`;

    /* =========================================================
       5. VALIDATE FINANCE AMOUNTS
       ========================================================= */

    const bankAdded = Number(
      snapshot.totalSales || 0
    );

    const expensesAdded = Number(
      snapshot.totalExpenses || 0
    );

    const ordersAdded = Number(
      snapshot.totalOrders || 0
    );

    const hurryAppAdded = Number(
      snapshot.dailyHurryApp || 0
    );

    const financeValues = [
      bankAdded,
      expensesAdded,
      ordersAdded,
      hurryAppAdded
    ];

    if (
      financeValues.some(
        value =>
          !Number.isFinite(value) ||
          value < 0
      )
    ) {
      throw new Error(
        'Invalid finance values were found in the shift snapshot.'
      );
    }

    /* =========================================================
       6. CAPTURE ADMIN REPORTS DAILY TOTALS
       ========================================================= */

    const adminCashBeforeEnd = Number(
      adminReportFinance.cash || 0
    );

    const adminInstaPayBeforeEnd = Number(
      adminReportFinance.instaPay || 0
    );

    const adminDailyNetSalesBeforeEnd = Number(
      adminReportFinance.dailyNetSales || 0
    );

    /* =========================================================
       7. SAVE PRELIMINARY SHIFT HISTORY
       ========================================================= */

    if (
      typeof saveShiftHistorySnapshotToSupabase !== 'function'
    ) {
      throw new Error(
        'saveShiftHistorySnapshotToSupabase() is not available.'
      );
    }

    const preliminarySaved =
      await saveShiftHistorySnapshotToSupabase(snapshot);

    if (preliminarySaved !== true) {
      throw new Error(
        'The preliminary Shift History snapshot was not confirmed as saved.'
      );
    }

    /* =========================================================
       8. CLOSE SHIFT
       ========================================================= */

    if (
      typeof completeShiftInSupabase !== 'function'
    ) {
      throw new Error(
        'completeShiftInSupabase() is not available.'
      );
    }

    const closeResult =
      await completeShiftInSupabase();

    if (closeResult !== true) {
      throw new Error(
        'Supabase did not confirm that the shift was closed. ' +
        'No monthly finance update was attempted.'
      );
    }

    shiftClosed = true;

    /* =========================================================
       9. APPLY MONTHLY FINANCE ONCE
       ========================================================= */

    const {
      data: financeResult,
      error: financeError
    } = await supabaseClient.rpc(
      'apply_shift_finance_once',
      {
        p_shift_id: endingShiftId,
        p_month_key: monthKey,
        p_bank_added: bankAdded,
        p_expenses_added: expensesAdded,
        p_orders_added: ordersAdded,
        p_hurry_app_added: hurryAppAdded
      }
    );

    if (financeError) {
      console.error(
        'TUX POS — Monthly finance RPC failed:',
        financeError
      );

      throw new Error(
        'The shift is closed, but monthly finance processing failed. ' +
        'Verify shift_finance_processed and report_finance in Supabase. ' +
        'Do not manually add the amounts.'
      );
    }

    if (
      !financeResult ||
      financeResult.success !== true
    ) {
      console.error(
        'TUX POS — Unexpected finance RPC result:',
        financeResult
      );

      throw new Error(
        'The monthly finance RPC returned an unexpected result. ' +
        'Verify the database before taking further action.'
      );
    }

    monthlyFinanceProcessed = true;

    console.info(
      'TUX POS — Monthly finance result:',
      financeResult
    );

    /* =========================================================
       10. RELOAD MONTHLY FINANCE
       ========================================================= */

    if (
      typeof loadMonthlyFinanceFromSupabase === 'function'
    ) {
      await loadMonthlyFinanceFromSupabase();
    }

    if (
      typeof ensureMonthlyFinance === 'function'
    ) {
      ensureMonthlyFinance();
    }

    /* =========================================================
       11. UPDATE ADMIN REPORTS
       ========================================================= */

    if (
      typeof updateAdminReportsAtEndShift !== 'function'
    ) {
      throw new Error(
        'updateAdminReportsAtEndShift() is not available.'
      );
    }

   const adminReportsResult =
  await updateAdminReportsAtEndShift({
    shiftId: endingShiftId,
    businessDate: businessDate
  });

    if (adminReportsResult !== true) {
      throw new Error(
        'The shift was closed and monthly finance was processed, ' +
        'but Admin Reports could not be saved. ' +
        'Do not end another shift or manually add finance totals.'
      );
    }

    adminReportsSaved = true;

    /* =========================================================
       12. BUILD FINAL SNAPSHOT
       ========================================================= */

    snapshot.shiftId = endingShiftId;
    snapshot.supabaseId = endingShiftId;

    snapshot.shiftNumber =
      endingShift.shiftNumber ??
      endingShift.shift_number ??
      snapshot.shiftNumber ??
      null;

    snapshot.businessDate = businessDate;
    snapshot.closedAt = new Date().toISOString();

    snapshot.status = 'closed';
    snapshot.active = false;

    snapshot.monthlyFinanceProcessed = true;
    snapshot.monthlyFinanceMonthKey = monthKey;

    snapshot.monthlyFinanceAlreadyProcessed =
      financeResult.already_processed === true;

    snapshot.totalSales = bankAdded;
    snapshot.totalExpenses = expensesAdded;
    snapshot.totalOrders = ordersAdded;
    snapshot.dailyHurryApp = hurryAppAdded;

    snapshot.adminCashBeforeEnd =
      adminCashBeforeEnd;

    snapshot.adminInstaPayBeforeEnd =
      adminInstaPayBeforeEnd;

    snapshot.adminDailyNetSalesBeforeEnd =
      adminDailyNetSalesBeforeEnd;

    if (
      typeof monthlyFinance !== 'undefined' &&
      monthlyFinance
    ) {
      snapshot.bank =
        Number(monthlyFinance.bank || 0);

      snapshot.overallExpenses =
        Number(monthlyFinance.overallExpenses || 0);

      snapshot.overallOrders =
        Number(monthlyFinance.overallOrders || 0);

      snapshot.hurryApp =
        Number(monthlyFinance.hurryApp || 0);
    }

    if (
      typeof adminReportFinance !== 'undefined' &&
      adminReportFinance
    ) {
      snapshot.adminBank =
        Number(adminReportFinance.bank || 0);

      snapshot.adminProfit =
        Number(adminReportFinance.profit || 0);
    }

    /* =========================================================
       13. SAVE FINAL HISTORY SNAPSHOT
       ========================================================= */

    const finalSaved =
      await saveShiftHistorySnapshotToSupabase(snapshot);

    if (finalSaved !== true) {
      throw new Error(
        'The shift and finance updates succeeded, ' +
        'but the final Shift History snapshot was not confirmed as saved.'
      );
    }

    /* =========================================================
       14. UPDATE LOCAL HISTORY WITHOUT DUPLICATES
       ========================================================= */

    if (!Array.isArray(shiftHistory)) {
      shiftHistory = [];
    }

    const existingHistoryIndex =
      shiftHistory.findIndex(item =>
        String(
          item.supabaseId ||
          item.shiftId ||
          item.id ||
          ''
        ) === endingShiftId
      );

    const localHistoryEntry = {
      ...snapshot,
      supabaseId: endingShiftId,
      shiftId: endingShiftId,
      status: 'closed',
      active: false
    };

    if (existingHistoryIndex >= 0) {
      shiftHistory[existingHistoryIndex] = {
        ...shiftHistory[existingHistoryIndex],
        ...localHistoryEntry
      };
    } else {
      shiftHistory.unshift(localHistoryEntry);
    }

    /* =========================================================
       15. END ATTENDANCE AND RELEASE WORKER SESSIONS
       ========================================================= */

    if (
      typeof endAttendanceForShift === 'function'
    ) {
      await endAttendanceForShift(endingShiftId);
    }

    if (
      typeof releaseWorkerSessionsForShift === 'function'
    ) {
      await releaseWorkerSessionsForShift(endingShiftId);
    }

    /* =========================================================
       16. CLEAR LIVE SHIFT STATE
       ========================================================= */

    currentShift = null;
    currentOrder = null;

    if (Array.isArray(kitchenOrders)) {
      kitchenOrders = [];
    }

    if (Array.isArray(completedSales)) {
      completedSales = [];
    }

    if (Array.isArray(expensesList)) {
      expensesList = [];
    }

    orderCounter = 1;

    /* =========================================================
       17. PRESERVE LOGIN SESSION
       ========================================================= */

    if (
      typeof saveLoginSession === 'function'
    ) {
      saveLoginSession();
    }

    /* =========================================================
       18. REFRESH UI
       ========================================================= */

    if (
      typeof renderShiftHistory === 'function'
    ) {
      renderShiftHistory();
    }

    if (
      typeof renderSalesReport === 'function'
    ) {
      renderSalesReport();
    }

    if (
      typeof renderKitchenBoard === 'function'
    ) {
      renderKitchenBoard();
    }

    if (
      typeof renderExpenses === 'function'
    ) {
      renderExpenses();
    }

    if (
      typeof updateShiftUI === 'function'
    ) {
      updateShiftUI();
    }

    alert(
      `Shift ${snapshot.shiftNumber ?? ''} ended successfully.\n` +
      `Business date: ${businessDate}\n` +
      `Monthly finance period: ${monthKey}\n` +
      `Monthly finance: ${
        financeResult.already_processed
          ? 'already processed; no duplicate amounts added'
          : 'updated successfully'
      }\n` +
      `Admin Reports: saved successfully`
    );

  } catch (error) {
    console.error(
      'TUX POS — End Shift failed:',
      error
    );

    console.error(
      'TUX POS — End Shift progress:',
      {
        endingShiftId,
        shiftClosed,
        monthlyFinanceProcessed,
        adminReportsSaved
      }
    );

    let recoveryMessage = '';

    if (shiftClosed) {
      recoveryMessage =
        '\n\nThe shift has already been closed. ' +
        'Do not attempt to end it again.';

      if (monthlyFinanceProcessed) {
        recoveryMessage +=
          '\nMonthly finance was confirmed as processed.';
      }

      if (!adminReportsSaved) {
        recoveryMessage +=
          '\nAdmin Reports may require recovery. ' +
          'Check the saved values in Supabase before retrying any update.';
      }

      recoveryMessage +=
        '\nDo not manually add finance totals.';
    }

    alert(
      'End Shift did not complete all steps.\n\n' +
      String(error?.message || error) +
      recoveryMessage
    );
  }
}




