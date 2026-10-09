/* =========================================================
   TUX POS — REPORT HISTORY
   Shift History
   ========================================================= */


/* =========================================================
   RESET SHIFT HISTORY
   ========================================================= */

function resetShiftHistory() {

  if (
    getActiveRole() !==
    'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can reset the Shift History.'
    );

    return;

  }

  if (
    !confirm(
      'Delete ALL saved shift reports?\n\nShift numbering will restart from Shift 1 (if no shift is running). Bank / Overall values are NOT affected.'
    )
  ) {

    return;

  }

  shiftHistory = [];

  localStorage.setItem(
    'tuxShiftHistory',
    '[]'
  );

  if (
    !currentShift ||
    !currentShift.active
  ) {

    localStorage.setItem(
      'tuxShiftCounter',
      '0'
    );

  }

  renderShiftHistory();

  showShiftHistory('');

  alert(
    'Shift History was reset.'
  );

}


/* =========================================================
   SHIFT HISTORY
   ========================================================= */

function renderShiftHistory() {

  const select =
    document.getElementById(
      'shiftHistorySelect'
    );

  if (!select) {
    return;
  }

  const oldValue =
    select.value;

  select.innerHTML =
    '<option value="">Select a saved shift</option>';

  shiftHistory.forEach(
    function (shift) {

      const option =
        document.createElement(
          'option'
        );

      option.value =
        shift.id;

      option.textContent =
        shift.id +
        ' | ' +
        shift.endDate +
        ' | Sales ' +
        Number(
          shift.totalSales ||
          0
        ).toFixed(2) +
        ' LE';

      select.appendChild(
        option
      );

    }
  );

  if (
    oldValue &&
    shiftHistory.some(
      function (shift) {

        return (
          shift.id ===
          oldValue
        );

      }
    )
  ) {

    select.value =
      oldValue;

  }

}


/* =========================================================
   SHOW SHIFT HISTORY
   ========================================================= */

function showShiftHistory(
  shiftId
) {

  const container =
    document.getElementById(
      'shiftHistoryContainer'
    );

  if (!container) {
    return;
  }

  if (!shiftId) {

    container.innerHTML =
      '';

    return;

  }

  const shift =
    shiftHistory.find(
      function (s) {

        return (
          s.id ===
          shiftId
        );

      }
    );

  if (!shift) {

    container.innerHTML =
      '';

    return;

  }

  container.innerHTML = `

    <div class="shift-history-card">

      <div>

        <strong>
          ${shift.id}
        </strong>

        <span style="color:#888;">

          |
          ${shift.startDate}
          ${shift.startTime}

          →

          ${shift.endDate}
          ${shift.endTime}

        </span>

      </div>

      <div style="margin-top:5px; font-size:10px;">

        Cash:
        ${Number(
          shift.totalCash ||
          0
        ).toFixed(2)} LE

        &nbsp; | &nbsp;

        InstaPay:
        ${Number(
          shift.totalInsta ||
          0
        ).toFixed(2)} LE

        &nbsp; | &nbsp;

        Visa:
        ${Number(
          shift.totalVisa ||
          0
        ).toFixed(2)} LE

        &nbsp; | &nbsp;

        Expenses:
        ${Number(
          shift.totalExpenses ||
          0
        ).toFixed(2)} LE

      </div>

      <div style="margin-top:5px; font-size:10px;">

        Net Sales:
        ${Number(
          shift.totalSales ||
          0
        ).toFixed(2)} LE

        &nbsp; | &nbsp;

        Orders:
        ${shift.totalOrders}

        &nbsp; | &nbsp;

        Net:
        ${Number(
          shift.netProfit ||
          0
        ).toFixed(2)} LE

        &nbsp; | &nbsp;

        Hurry App (Visa + Discount):
        ${
          Number(
            shift.dailyHurryApp !==
            undefined
              ? shift.dailyHurryApp
              : (
                  Number(
                    shift.totalVisa ||
                    0
                  ) +
                  Number(
                    shift.totalDiscount ||
                    0
                  )
                )
          ).toFixed(2)
        } LE

      </div>

      <div style="margin-top:8px; overflow-x:auto;">

        <div style="margin-bottom:8px;">

          <div style="font-size:11px; font-weight:bold; margin-bottom:3px;">
            Gam3ya
          </div>

          ${
            buildGamiyaHtml(
              shift.gamiyaSummary ||
              buildGamiyaSummary(
                shift.gamiya,
                shift.id
              )
            )
          }

        </div>

        ${
          buildGardHtml(
            shift.startCount,
            shift.endCount,
            shift.expenses
          )
        }

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