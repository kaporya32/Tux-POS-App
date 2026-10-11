
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
  if (typeof tuxShiftConfirmCallback === 'function') {
    tuxShiftConfirmCallback(false);
  }
}

function confirmShiftModalAction() {
  if (typeof tuxShiftConfirmCallback === 'function') {
    tuxShiftConfirmCallback(true);
  }
}

/* =========================================================
   START SHIFT
   ========================================================= */


async function startShift() {
  // Prevent duplicate Start Shift operations.
  if (isStartingShift || isEndingShift) return;

  if (getActiveRole() === 'admin') {
    alert('Admin is in Spectate Mode. You cannot start a shift.');
    return;
  }

  if (currentShift && currentShift.active) {
    alert('There is already an active shift.');
    return;
  }

  if (getActiveWorkers().length === 0 && !tuxAdminActive) {
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
    console.warn('TUX POS: A shift is already active. Start Shift cancelled.');
    return;
  }

  isStartingShift = true;

  // Update this selector if your actual Start Shift button uses another ID.
  const button = document.getElementById('start-shift-btn');

  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Starting Shift...';
  }

  try {
    await finalizeStartShift();
  } catch (error) {
    console.error('TUX POS: Failed to start shift:', error);
  } finally {
    isStartingShift = false;

    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.originalText || 'Start Shift';
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
  if (isEndingShift) return;

  if (getActiveRole() === 'admin') return;
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
  if (isEndingShift || !currentShift || !currentShift.active) return;

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
    console.error('TUX POS: Failed to end shift:', error);
  } finally {
    isEndingShift = false;

    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.originalText || 'End Shift';
      delete button.dataset.originalText;
    }
  }
}



/* =========================================================
   END SHIFT — SUPABASE
   ========================================================= */


async function finalizeEndShift() {
  if (blockEndShiftIfPreparing()) {
    return;
  }

  // Capture the active shift before asynchronous operations.
  const endingShift = currentShift;

  if (!endingShift || !endingShift.supabaseId) {
    console.error(
      'TUX POS: Cannot finalize shift because the active shift or its Supabase ID is missing.',
      { currentShift }
    );

    alert(
      'Cannot end the shift because the active shift could not be identified.\n\n' +
      'Please refresh the page and check the active shift before trying again.'
    );

    return;
  }

  const endingShiftId = endingShift.supabaseId;

  try {
    // Load monthly finance without reloading reports first.
    await loadMonthlyFinanceFromSupabase();

    // Complete the shift in Supabase.
    const completed = await completeShiftInSupabase();

    if (!completed) {
      return;
    }

    // Update monthly finance.
    ensureMonthlyFinance();

    const snapshot = buildShiftSnapshot();

    monthlyFinance.bank += Number(snapshot.totalSales || 0);
    monthlyFinance.overallExpenses += Number(snapshot.totalExpenses || 0);
    monthlyFinance.overallOrders += Number(snapshot.totalOrders || 0);

    monthlyFinance.hurryApp =
      Number(monthlyFinance.hurryApp || 0) +
      Number(snapshot.dailyHurryApp || 0);

    // Save monthly finance.
    const financeSaved = await saveMonthlyFinanceToSupabase();

    if (!financeSaved) {
      alert(
        'The shift was completed, but monthly finance could not be saved. Please check Supabase before continuing.'
      );
      return;
    }

    // Update Admin Reports.
    if (typeof updateAdminReportsAtEndShift === 'function') {
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
        typeof adminReportFinance === 'object'
      ) {
        snapshot.adminReports.bank = Number(
          adminReportFinance.bank || 0
        );

        snapshot.adminReports.profit = Number(
          adminReportFinance.profit || 0
        );
      }
    }

    // Add monthly finance values to the snapshot.
    snapshot.bank = monthlyFinance.bank;
    snapshot.overallExpenses = monthlyFinance.overallExpenses;
    snapshot.overallOrders = monthlyFinance.overallOrders;
    snapshot.hurryApp = monthlyFinance.hurryApp;
    snapshot.supabaseId = endingShiftId;

    // Save shift history locally.
    shiftHistory.unshift(snapshot);

    localStorage.setItem(
      'tuxShiftHistory',
      JSON.stringify(shiftHistory)
    );

    // Reset current shift state.
    currentShift = null;
    currentOrder = [];
    kitchenOrders = [];
    completedSales = [];
    expensesList = [];
    orderCounter = 1;

    localStorage.setItem('tuxOrderCounter', '1');

    // Update the interface immediately.
    updateOrderUI();
    renderKitchenBoard();
    renderExpensesTable();
    renderGamiyaView();
    renderShiftHistory();
    updateShiftUI();

    // Refresh reports in the background.
    refreshShiftReports().catch(error => {
      console.error(
        'TUX POS: Failed to refresh reports after ending shift:',
        error
      );
    });

    // Success alert intentionally removed.
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

