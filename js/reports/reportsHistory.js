
/* =========================================================
   TUX POS — REPORT HISTORY
   Shift History
   ========================================================= */


/* =========================================================
   RESET SHIFT HISTORY
   ========================================================= */

function resetShiftHistory() {
  if (
    typeof getActiveRole !== 'function' ||
    getActiveRole() !== 'tuxadmin'
  ) {
    alert('Only Tux Admin can reset the Shift History.');
    return;
  }

  if (
    !confirm(
      'Delete ALL saved shift reports?\n\n' +
      'Shift numbering will restart from Shift 1 ' +
      '(if no shift is running). Bank / Overall values are NOT affected.'
    )
  ) {
    return;
  }

  shiftHistory = [];

  localStorage.setItem('tuxShiftHistory', '[]');

  if (!currentShift || !currentShift.active) {
    localStorage.setItem('tuxShiftCounter', '0');
  }

  renderShiftHistory();
  showShiftHistory('');

  alert('Shift History was reset.');
}


/* =========================================================
   SHIFT HISTORY
   ========================================================= */

function renderShiftHistory() {
  const select = document.getElementById('shiftHistorySelect');

  if (!select) return;

  const oldValue = select.value;

  select.innerHTML =
    '<option value="">Select a saved shift</option>';

  const sortedShifts = [...shiftHistory].sort(function (a, b) {
    const dateA = new Date(
      `${a.startDate || ''} ${a.startTime || ''}`
    ).getTime();

    const dateB = new Date(
      `${b.startDate || ''} ${b.startTime || ''}`
    ).getTime();

    return dateA - dateB;
  });

  sortedShifts.forEach(function (shift, index) {
    const option = document.createElement('option');

    option.value = shift.id;

    option.textContent =
      'Shift #' +
      (index + 1) +
      ' | ' +
      (shift.endDate || shift.startDate || '-') +
      ' | Sales ' +
      Number(shift.totalSales || 0).toFixed(2) +
      ' LE';

    select.appendChild(option);
  });

  if (
    oldValue &&
    sortedShifts.some(function (shift) {
      return String(shift.id) === String(oldValue);
    })
  ) {
    select.value = oldValue;
  }

  updateShiftDeleteButtons();
}


/* =========================================================
   SHOW SHIFT HISTORY
   ========================================================= */

function showShiftHistory(shiftId) {
  const container = document.getElementById('shiftHistoryContainer');

  if (!container) return;

  if (!shiftId) {
    container.innerHTML = '';
    return;
  }

  const shift = shiftHistory.find(function (s) {
    return String(s.id) === String(shiftId);
  });

  if (!shift) {
    container.innerHTML = '';
    return;
  }

  const sortedShifts = [...shiftHistory].sort(function (a, b) {
    const dateA = new Date(
      `${a.startDate || ''} ${a.startTime || ''}`
    ).getTime();

    const dateB = new Date(
      `${b.startDate || ''} ${b.startTime || ''}`
    ).getTime();

    return dateA - dateB;
  });

  const shiftNumber =
    sortedShifts.findIndex(function (s) {
      return String(s.id) === String(shift.id);
    }) + 1;

  container.innerHTML = `
    <div class="shift-history-card">
      <div>
        <strong>Shift #${shiftNumber}</strong>

        <span style="color:#888;">
          |
          ${shift.startDate || '-'}
          ${shift.startTime || ''}

          →

          ${shift.endDate || '-'}
          ${shift.endTime || ''}
        </span>
      </div>

      <div style="margin-top:5px; font-size:10px;">
        Cash: ${Number(shift.totalCash || 0).toFixed(2)} LE
        &nbsp; | &nbsp;
        InstaPay: ${Number(shift.totalInsta || 0).toFixed(2)} LE
        &nbsp; | &nbsp;
        Visa: ${Number(shift.totalVisa || 0).toFixed(2)} LE
        &nbsp; | &nbsp;
        Expenses: ${Number(shift.totalExpenses || 0).toFixed(2)} LE
      </div>

      <div style="margin-top:5px; font-size:10px;">
        Net Sales: ${Number(shift.totalSales || 0).toFixed(2)} LE
        &nbsp; | &nbsp;
        Orders: ${shift.totalOrders ?? 0}
        &nbsp; | &nbsp;
        Net: ${Number(shift.netProfit || 0).toFixed(2)} LE
        &nbsp; | &nbsp;
        Hurry App (Visa + Discount):
        ${Number(
          shift.dailyHurryApp !== undefined
            ? shift.dailyHurryApp
            : (
                Number(shift.totalVisa || 0) +
                Number(shift.totalDiscount || 0)
              )
        ).toFixed(2)} LE
      </div>

      <div style="margin-top:8px; overflow-x:auto;">
        <div style="margin-bottom:8px;">
          <div style="font-size:11px; font-weight:bold; margin-bottom:3px;">
            Gam3ya
          </div>

          ${buildGamiyaHtml(
            shift.gamiyaSummary ||
            buildGamiyaSummary(shift.gamiya, shift.id)
          )}
        </div>

        ${buildGardHtml(
          shift.startCount,
          shift.endCount,
          shift.expenses
        )}
      </div>

      <button
        style="margin-top:6px;"
        onclick="printShiftReportById('${shift.id}')"
      >
        Print / View Full Report
      </button>
    </div>
  `;
}


/* =========================================================
   DELETE BUTTON VISIBILITY
   ========================================================= */

function canDeleteSavedShifts() {
  return (
    typeof getActiveRole === 'function' &&
    getActiveRole() === 'tuxadmin'
  );
}

function updateShiftDeleteButtons() {
  const button = document.getElementById('deleteSelectedShiftBtn');

  if (!button) return;

  button.style.display = canDeleteSavedShifts()
    ? 'inline-block'
    : 'none';
}


/* =========================================================
   REFRESH BUTTON WHEN REPORTS VIEW IS OPENED
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

// Refresh when the user clicks or switches to the Reports view.
document.addEventListener('click', function () {
  updateShiftDeleteButtons();
});


/* =========================================================
   DELETE SAVED SHIFT DATA FROM SUPABASE
   ========================================================= */

async function deleteShiftDataFromSupabase(shiftId = null) {
  const { data, error } = await supabaseClient.rpc(
    'delete_closed_shift_data',
    {
      p_shift_id: shiftId
    }
  );

  if (error) throw error;

  return Number(data || 0);
}


/* =========================================================
   DELETE SELECTED SHIFT
   ========================================================= */

async function deleteSelectedShift() {
  if (!canDeleteSavedShifts()) {
    alert('Only Tux Admin can delete saved shifts.');
    return;
  }

  const select = document.getElementById('shiftHistorySelect');
  const shiftId = select ? select.value : '';

  if (!shiftId) {
    alert('Please select a saved shift first.');
    return;
  }

  if (
    currentShift &&
    currentShift.active &&
    String(currentShift.supabaseId) === String(shiftId)
  ) {
    alert('You cannot delete the currently running shift.');
    return;
  }

  const selectedShift = shiftHistory.find(
    shift => String(shift.id) === String(shiftId)
  );

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
    const deletedCount =
      await deleteShiftDataFromSupabase(shiftId);

    await loadShiftHistoryFromSupabase();

    if (typeof refreshReportsFromSupabase === 'function') {
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
    console.error(
      'TUX POS — Delete selected shift failed:',
      error
    );

    alert(
      'Could not delete the selected shift.\n\n' +
      (error.message || String(error))
    );
  }
}
