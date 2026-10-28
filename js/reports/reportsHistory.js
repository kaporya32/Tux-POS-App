
/* =========================================================
   TUX POS — REPORT HISTORY
   Shift History
   ========================================================= */


/* =========================================================
   PERMISSION HELPERS
   ========================================================= */

function canDeleteSavedShifts() {
  return (
    typeof getActiveRole === 'function' &&
    getActiveRole() === 'tuxadmin'
  );
}


/* =========================================================
   TUX POS — DELETE ALL SHIFT REPORTS
   TUX Admin only

   Uses the database RPC:
   delete_closed_shift_data(p_shift_id)

   Preserves:
   - Active shift
   - Current stock quantities
   - Workers
   - Bank / Overall finance values
   ========================================================= */

async function resetShiftHistory() {

  /* =====================================================
     1. PERMISSION CHECK
     ===================================================== */

  if (!canDeleteSavedShifts()) {
    alert('Only TUX Admin can delete all shift reports.');
    return;
  }


  /* =====================================================
     2. CONFIRM DELETION
     ===================================================== */

  const confirmed = confirm(
    'DELETE ALL SAVED SHIFT REPORTS?\n\n' +
    'This will permanently delete all CLOSED shifts and their associated:\n' +
    '• Shift reports\n' +
    '• Orders and order items\n' +
    '• Expenses and purchases\n' +
    '• Gam3ya orders\n\n' +
    'Your active shift, current stock quantities, workers, ' +
    'and Bank / Overall finance values will NOT be deleted.\n\n' +
    'This action cannot be undone.'
  );

  if (!confirmed) {
    return;
  }


  /* =====================================================
     3. DISABLE BUTTON
     ===================================================== */

  const button = document.getElementById(
    'shiftHistoryResetBtn'
  );

  if (button) {
    button.disabled = true;
    button.textContent = 'Deleting...';
    button.style.opacity = '0.6';
    button.style.cursor = 'wait';
  }


  try {

    /* ===================================================
       4. CHECK SUPABASE
       =================================================== */

    if (
      typeof supabaseClient === 'undefined' ||
      !supabaseClient
    ) {
      throw new Error(
        'Supabase client is not available.'
      );
    }


    /* ===================================================
       5. DELETE CLOSED SHIFTS THROUGH THE RPC

       Do not place this RPC call outside this function.
       The SQL function must delete dependent records
       before deleting their closed shifts.
       =================================================== */

    console.log(
      '[TUX POS] Starting deletion of all closed shifts...'
    );

    const {
      data: deletedCount,
      error: deleteError
    } = await supabaseClient.rpc(
      'delete_closed_shift_data',
      {
        p_shift_id: null
      }
    );


    /* ===================================================
       6. HANDLE DATABASE ERROR
       =================================================== */

    if (deleteError) {

      const errorInfo = {
        message: deleteError.message || null,
        code: deleteError.code || null,
        details: deleteError.details || null,
        hint: deleteError.hint || null
      };

      console.error(
        '[TUX POS] RPC DELETE ERROR:\n' +
        JSON.stringify(errorInfo, null, 2)
      );

      throw deleteError;
    }


    console.log(
      '[TUX POS] Closed shifts deleted:',
      deletedCount
    );


    /* ===================================================
       7. CLEAR LOCAL SHIFT HISTORY

       Only update local history after the RPC succeeds.
       =================================================== */

    shiftHistory = [];

    localStorage.setItem(
      'tuxShiftHistory',
      JSON.stringify([])
    );


    /* ===================================================
       8. PRESERVE ACTIVE SHIFT COUNTER
       =================================================== */

    if (
      !currentShift ||
      !currentShift.active
    ) {
      localStorage.setItem(
        'tuxShiftCounter',
        '0'
      );
    }


    /* ===================================================
       9. CLEAR HISTORY SELECTION
       =================================================== */

    const select = document.getElementById(
      'shiftHistorySelect'
    );

    if (select) {
      select.value = '';
    }

    renderShiftHistory();
    showShiftHistory('');


    /* ===================================================
       10. REFRESH REPORT DATA
       =================================================== */

    if (
      typeof refreshReportsFromSupabase === 'function'
    ) {

      await refreshReportsFromSupabase();

    } else if (
      typeof loadReportsFromSupabase === 'function'
    ) {

      await loadReportsFromSupabase();

    }


    /* ===================================================
       11. RE-RENDER REPORTS
       =================================================== */

    if (
      typeof renderSalesReport === 'function'
    ) {
      renderSalesReport();
    }

    if (
      typeof renderAdminReports === 'function'
    ) {
      renderAdminReports();
    }


    /* ===================================================
       12. SUCCESS MESSAGE
       =================================================== */

    if (Number(deletedCount || 0) === 0) {

      alert(
        'There are no closed shifts to delete.'
      );

    } else {

      alert(
        'Successfully deleted ' +
        deletedCount +
        ' closed shift(s) and their associated records.'
      );

    }

  } catch (error) {

    const errorInfo = {
      message: error?.message || null,
      code: error?.code || null,
      details: error?.details || null,
      hint: error?.hint || null
    };

    console.error(
      '[TUX POS] Delete all shift reports failed:\n' +
      JSON.stringify(errorInfo, null, 2)
    );

    alert(
      'Could not delete all shift reports.\n\n' +
      'Message: ' +
      (errorInfo.message || 'Unknown error') +
      '\nCode: ' +
      (errorInfo.code || 'Unknown') +
      '\nDetails: ' +
      (errorInfo.details || 'None') +
      '\nHint: ' +
      (errorInfo.hint || 'None')
    );

  } finally {

    /* ===================================================
       13. RESTORE BUTTON
       =================================================== */

    if (button) {
      button.disabled = false;
      button.textContent = '🗑 Delete All Shift Reports';
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }

  }

}


/* =========================================================
   RENDER SHIFT HISTORY
   ========================================================= */

function renderShiftHistory() {

  const select = document.getElementById(
    'shiftHistorySelect'
  );

  if (!select) {
    return;
  }


  /* =======================================================
     DELETE ALL BUTTON VISIBILITY
     ======================================================= */

  const resetButton = document.getElementById(
    'shiftHistoryResetBtn'
  );

  if (resetButton) {

    resetButton.style.display =
      canDeleteSavedShifts()
        ? 'inline-block'
        : 'none';

  }


  /* =======================================================
     PRESERVE CURRENT SELECTION
     ======================================================= */

  const oldValue = select.value;


  /* =======================================================
     RESET DROPDOWN
     ======================================================= */

  select.innerHTML =
    '<option value="">Select a saved shift</option>';


  /* =======================================================
     SORT SHIFTS BY DATE
     ======================================================= */

  const sortedShifts = [
    ...(Array.isArray(shiftHistory)
      ? shiftHistory
      : [])
  ].sort(function (a, b) {

    const dateA = new Date(
      `${a.startDate || ''} ${a.startTime || ''}`
    ).getTime();

    const dateB = new Date(
      `${b.startDate || ''} ${b.startTime || ''}`
    ).getTime();

    return dateA - dateB;

  });


  /* =======================================================
     BUILD DROPDOWN OPTIONS
     ======================================================= */

  sortedShifts.forEach(function (shift, index) {

    const option = document.createElement('option');

    option.value = shift.id;

    option.textContent =
      'Shift #' +
      (
        shift.shiftNumber ||
        index + 1
      ) +
      ' | ' +
      (
        shift.endDate ||
        shift.startDate ||
        '-'
      ) +
      ' | Sales ' +
      Number(
        shift.totalSales || 0
      ).toFixed(2) +
      ' LE';

    select.appendChild(option);

  });


  /* =======================================================
     RESTORE PREVIOUS SELECTION
     ======================================================= */

  if (
    oldValue &&
    sortedShifts.some(function (shift) {
      return String(shift.id) === String(oldValue);
    })
  ) {
    select.value = oldValue;
  }


  /* =======================================================
     UPDATE DELETE BUTTON
     ======================================================= */

  if (
    typeof updateShiftDeleteButtons === 'function'
  ) {
    updateShiftDeleteButtons();
  }

}


/* =========================================================
   SHOW SHIFT HISTORY
   ========================================================= */



/* =========================================================
   SHOW SHIFT HISTORY
   Preserves saved totals and safely derives missing values
   from the saved snapshot's sales and expenses arrays.
   ========================================================= */

function showShiftHistory(shiftId) {

  const container = document.getElementById(
    'shiftHistoryContainer'
  );

  if (!container) return;

  if (!shiftId) {
    container.innerHTML = '';
    return;
  }

  const history = Array.isArray(shiftHistory)
    ? shiftHistory
    : [];

  const shift = history.find(function (item) {

    return String(
      item.supabaseId ||
      item.shift_id ||
      item.shiftId ||
      item.id ||
      ''
    ) === String(shiftId);

  });

  if (!shift) {
    container.innerHTML = '';
    return;
  }

  function numberValue(value) {

    const number = Number(value ?? 0);

    return Number.isFinite(number)
      ? number
      : 0;

  }

  const sales = Array.isArray(shift.sales)
    ? shift.sales
    : Array.isArray(shift.completedSales)
      ? shift.completedSales
      : [];

  const completedSales = sales.filter(function (order) {

    return String(order.status || '').toLowerCase() === 'done';

  });

  const expenses = Array.isArray(shift.expenses)
    ? shift.expenses
    : [];

  let calculatedCash = 0;
  let calculatedInsta = 0;
  let calculatedVisa = 0;
  let calculatedDiscount = 0;

  completedSales.forEach(function (order) {

    calculatedCash += numberValue(order.cashPaid);
    calculatedInsta += numberValue(order.instaPaid);
    calculatedVisa += numberValue(order.visaPaid);
    calculatedDiscount += numberValue(order.discount);

  });

  const calculatedExpenses = expenses.reduce(
    function (total, expense) {

      return total + numberValue(expense.cost);

    },
    0
  );

  /*
   * Prefer explicitly saved values.
   * Calculate a value from saved order details only when
   * the corresponding saved field is missing.
   */

  const totalCash = numberValue(
    shift.totalCash ?? calculatedCash
  );

  const totalInsta = numberValue(
    shift.totalInsta ?? calculatedInsta
  );

  const totalVisa = numberValue(
    shift.totalVisa ?? calculatedVisa
  );

  const totalDiscount = numberValue(
    shift.totalDiscount ?? calculatedDiscount
  );

  const totalExpenses = numberValue(
    shift.totalExpenses ??
    shift.dailyExpenses ??
    calculatedExpenses
  );

  const totalSales = numberValue(
    shift.totalSales ??
    (totalCash + totalInsta)
  );

  const totalOrders = numberValue(
    shift.totalOrders ??
    shift.dailyOrders ??
    completedSales.length
  );

  const netProfit = numberValue(
    shift.netProfit ??
    (totalSales - totalExpenses)
  );

  const hurryApp = numberValue(
    shift.dailyHurryApp ??
    shift.hurryApp ??
    (totalVisa + totalDiscount)
  );

  const shiftNumber =
    shift.shiftNumber ??
    shift.shift_number ??
    '—';

  const safeShiftId = String(
    shift.supabaseId ||
    shift.shift_id ||
    shift.shiftId ||
    shift.id ||
    ''
  );

  const escapeHtml = function (value) {

    return String(value ?? '').replace(
      /[&<>"']/g,
      function (character) {

        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[character];

      }
    );

  };

  const startDate = escapeHtml(shift.startDate || '-');
  const startTime = escapeHtml(shift.startTime || '');
  const endDate = escapeHtml(shift.endDate || '-');
  const endTime = escapeHtml(shift.endTime || '');

  const gamiyaHtml = typeof buildGamiyaHtml === 'function'
    ? buildGamiyaHtml(
        shift.gamiyaSummary ||
        (
          typeof buildGamiyaSummary === 'function'
            ? buildGamiyaSummary(shift.gamiya, shift.id)
            : {}
        )
      )
    : '<div>No Gam3ya meals recorded.</div>';

  const gardHtml = typeof buildGardHtml === 'function'
    ? buildGardHtml(
        shift.startCount,
        shift.endCount,
        expenses
      )
    : '<div>No manual stock count recorded for this shift.</div>';

  container.innerHTML = `
    <div class="shift-history-card">

      <div>
        <strong>Shift #${escapeHtml(shiftNumber)}</strong>

        <span style="color:#888;">
          | ${startDate} ${startTime}
          → ${endDate} ${endTime}
        </span>
      </div>

      <div style="margin-top:5px;font-size:10px;">
        Cash: ${totalCash.toFixed(2)} LE
        &nbsp; | &nbsp;
        InstaPay: ${totalInsta.toFixed(2)} LE
        &nbsp; | &nbsp;
        Visa: ${totalVisa.toFixed(2)} LE
        &nbsp; | &nbsp;
        Expenses: ${totalExpenses.toFixed(2)} LE
      </div>

      <div style="margin-top:5px;font-size:10px;">
        Net Sales: ${totalSales.toFixed(2)} LE
        &nbsp; | &nbsp;
        Orders: ${totalOrders}
        &nbsp; | &nbsp;
        Net: ${netProfit.toFixed(2)} LE
        &nbsp; | &nbsp;
        Hurry App (Visa + Discount):
        ${hurryApp.toFixed(2)} LE
      </div>

      <div style="margin-top:8px;overflow-x:auto;">

        <div style="margin-bottom:8px;">

          <div style="font-size:11px;font-weight:bold;margin-bottom:3px;">
            Gam3ya
          </div>

          ${gamiyaHtml}

        </div>

        ${gardHtml}

      </div>

      <button
        style="margin-top:6px;"
        onclick="printShiftReportById('${escapeHtml(safeShiftId)}')"
      >
        Print / View Full Report
      </button>

    </div>
  `;
}






/* =========================================================
   UPDATE SAVED SHIFT DELETE BUTTON VISIBILITY
   ========================================================= */

function updateShiftDeleteButtons() {

  const button = document.getElementById(
    'deleteSelectedShiftBtn'
  );

  if (!button) {
    return;
  }

  button.style.display = canDeleteSavedShifts()
    ? 'inline-block'
    : 'none';

}


/* =========================================================
   INITIALIZE SHIFT DELETE BUTTON
   ========================================================= */

function initializeShiftDeleteButton() {
  updateShiftDeleteButtons();
}


if (document.readyState === 'loading') {

  document.addEventListener(
    'DOMContentLoaded',
    initializeShiftDeleteButton
  );

} else {

  initializeShiftDeleteButton();

}


/* =========================================================
   REFRESH BUTTON VISIBILITY ON CLICKS
   ========================================================= */

document.addEventListener('click', function () {
  updateShiftDeleteButtons();
});








/* =========================================================
   DELETE A SINGLE CLOSED SHIFT FROM SUPABASE
   TUX Admin only
   Uses the existing delete_closed_shift_data RPC
   ========================================================= */

async function deleteShiftDataFromSupabase(shiftId) {

  if (
    typeof getActiveRole !== 'function' ||
    getActiveRole() !== 'tuxadmin'
  ) {
    throw new Error(
      'Only TUX Admin can delete saved shifts.'
    );
  }

  if (!shiftId) {
    throw new Error(
      'A valid shift ID is required.'
    );
  }

  if (
    currentShift &&
    currentShift.active &&
    String(currentShift.supabaseId) === String(shiftId)
  ) {
    throw new Error(
      'The currently running shift cannot be deleted.'
    );
  }

  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {
    throw new Error(
      'Supabase client is not available.'
    );
  }

  const { data, error } = await supabaseClient.rpc(
    'delete_closed_shift_data',
    {
      p_shift_id: shiftId
    }
  );

  if (error) {
    console.error(
      '[TUX POS] Failed to delete selected shift:',
      error
    );

    throw error;
  }

  return Number(data || 0);
}



/* =========================================================
   DELETE SELECTED SHIFT
   Requires the existing deleteShiftDataFromSupabase()
   function elsewhere in the project.
   ========================================================= */

async function deleteSelectedShift() {

  if (!canDeleteSavedShifts()) {
    alert('Only TUX Admin can delete saved shifts.');
    return;
  }


  const select = document.getElementById(
    'shiftHistorySelect'
  );

  const shiftId = select
    ? select.value
    : '';


  if (!shiftId) {
    alert('Please select a saved shift first.');
    return;
  }


  /* =====================================================
     PREVENT DELETING THE ACTIVE SHIFT
     ===================================================== */

  if (
    currentShift &&
    currentShift.active &&
    String(currentShift.supabaseId) === String(shiftId)
  ) {
    alert('You cannot delete the currently running shift.');
    return;
  }


  /* =====================================================
     FIND SELECTED SHIFT
     ===================================================== */

  const selectedShift = (
    Array.isArray(shiftHistory)
      ? shiftHistory
      : []
  ).find(function (shift) {
    return String(shift.id) === String(shiftId);
  });


  if (!selectedShift) {
    alert(
      'The selected shift was not found. ' +
      'Refresh shift history and try again.'
    );
    return;
  }


  const label =
    select.options[select.selectedIndex]?.text ||
    'selected shift';


  /* =====================================================
     CONFIRM SELECTED SHIFT DELETION
     ===================================================== */

  if (
    !confirm(
      'DELETE ' + label + '?\n\n' +
      'This permanently deletes the shift, its orders and order items, ' +
      'expenses, Gam3ya records, and saved shift report.\n\n' +
      'Bank / Overall values will not be changed.'
    )
  ) {
    return;
  }


  try {

    if (
      typeof deleteShiftDataFromSupabase !== 'function'
    ) {
      throw new Error(
        'deleteShiftDataFromSupabase() is not available.'
      );
    }


    const deletedCount =
      await deleteShiftDataFromSupabase(shiftId);


    if (
      typeof loadShiftHistoryFromSupabase === 'function'
    ) {
      await loadShiftHistoryFromSupabase();
    }


    if (
      typeof refreshReportsFromSupabase === 'function'
    ) {
      await refreshReportsFromSupabase();
    }


    renderShiftHistory();
    showShiftHistory('');


    alert(
      deletedCount
        ? 'Selected shift and its linked data were deleted.'
        : 'No closed shift was deleted.'
    );

  } catch (error) {

    const errorInfo = {
      message: error?.message || null,
      code: error?.code || null,
      details: error?.details || null,
      hint: error?.hint || null
    };

    console.error(
      '[TUX POS] Delete selected shift failed:\n' +
      JSON.stringify(errorInfo, null, 2)
    );

    alert(
      'Could not delete the selected shift.\n\n' +
      'Message: ' + (errorInfo.message || 'Unknown error') +
      '\nCode: ' + (errorInfo.code || 'Unknown') +
      '\nDetails: ' + (errorInfo.details || 'None') +
      '\nHint: ' + (errorInfo.hint || 'None')
    );

  }

}

