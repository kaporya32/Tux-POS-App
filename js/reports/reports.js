/* =========================================================
   TUX POS — REPORTS AND SHIFTS
   Shift management, Gard report, Gam3ya report,
   shift history, finance values, printing and sales report.
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
      currentShift.id +
      ' • Started ' +
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

  }

  else {

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
    'Please start a shift (with the opening stock count) before taking any order.'
  );


  return false;

}


/* =========================================================
   START SHIFT
   ========================================================= */

function startShift() {

  /* ADMIN SPECTATE MODE — READ ONLY */
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
      'Please login as staff first, then start the shift and enter the opening stock count (Gard).'
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
    'Are you sure you want to start a new shift?\n' +
    'You will be asked to enter the opening stock count (Gard).' +
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


  openCountModal('start');

}


/* =========================================================
   START SHIFT — SUPABASE
   ========================================================= */

async function finalizeStartShift(count) {

  const createdShift =
    await createShiftInSupabase(count);


  if (!createdShift) {
    return;
  }


  /*
    Reset only current operational shift data.

    Historical report data is stored separately in:

    reportSales
    reportExpenses
  */

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


  /*
    Reload historical report data.

    This is important because reportSales and
    reportExpenses must remain available after
    starting a new shift.
  */

  if (
    typeof loadReportsFromSupabase ===
    'function'
  ) {

    await loadReportsFromSupabase();

  }


  renderSalesReport();

  updateShiftUI();


  alert(
    'Shift started successfully with the opening stock count. Order numbering restarted from Order #1.'
  );

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

  /* ADMIN SPECTATE MODE — READ ONLY */
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
    'You will be asked to enter the closing stock count (Gard), then ALL workers, Admin and Tux Admin will be logged out.';


  if (
    !confirm(endMsg)
  ) {

    return;

  }


  openCountModal('end');

}


/* =========================================================
   END SHIFT — SUPABASE
   ========================================================= */

async function finalizeEndShift(count) {

  if (
    blockEndShiftIfPreparing()
  ) {

    return;

  }


  /*
    Always refresh historical report data before
    closing the shift.

    This makes sure the final snapshot contains
    everything already saved in Supabase.
  */

  if (
    typeof loadReportsFromSupabase ===
    'function'
  ) {

    await loadReportsFromSupabase();

  }


  /*
    Build the snapshot BEFORE clearing currentShift.

    buildShiftSnapshot() automatically prefers:

    1. Supabase current-shift report data
    2. Current operational arrays as fallback
  */

  const completed =
    await completeShiftInSupabase(count);


  if (!completed) {

    return;

  }


  ensureMonthlyFinance();


  const snapshot =
    buildShiftSnapshot();


  /*
    Update monthly / historical finance totals.

    These are local cached totals used for saved
    Shift History. The live Reports page itself
    calculates historical values directly from
    Supabase.
  */

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


  localStorage.setItem(
    'tuxMonthlyFinance',
    JSON.stringify(
      monthlyFinance
    )
  );


  /*
    Store the updated historical totals
    inside the saved snapshot.
  */

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


  /*
    Save the completed shift locally.
  */

  shiftHistory.unshift(
    snapshot
  );


  localStorage.setItem(
    'tuxShiftHistory',
    JSON.stringify(
      shiftHistory
    )
  );


  /*
    Now reset the active shift.
  */

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


  updateOrderUI();

  renderKitchenBoard();

  renderExpensesTable();

  renderGamiyaView();

  renderShiftHistory();

  updateShiftUI();


  /*
    Log everybody out after the shift closes.
  */

  logoutEveryoneAtEndOfDay();


  /*
    IMPORTANT:

    Refresh Supabase reports BEFORE rendering the
    Reports page.

    Otherwise the UI could temporarily show stale
    historical values.
  */

  if (
    typeof loadReportsFromSupabase ===
    'function'
  ) {

    await loadReportsFromSupabase();

  }


  renderSalesReport();


  alert(
    'Shift ended successfully. The closing stock count and the shift were saved to Supabase, the Kitchen Board was reset, and all workers, Admin and Tux Admin were logged out. The next shift will start from Order #1.'
  );

}


/* =========================================================
   STOCK COUNT (GARD) REPORT
   ========================================================= */

function diffCellHtml(
  counted,
  system
) {

  const d =
    round2(
      counted -
      system
    );


  let color =
    '#2ecc71';


  if (
    d < 0
  ) {

    color =
      '#e74c3c';

  }

  else if (
    d > 0
  ) {

    color =
      '#e67e22';

  }


  const sign =
    d > 0
      ? '+'
      : '';


  return (
    '<td style="color:' +
    color +
    '; font-weight:bold;">' +
    sign +
    fmtQty(d) +
    '</td>'
  );

}


/* =========================================================
   BUILD GARD
   ========================================================= */

function buildGardHtml(
  startCount,
  endCount,
  expenses
) {

  if (
    !startCount &&
    !endCount
  ) {

    return `
      <div style="color:#888; font-size:10px; padding:4px;">
        No stock count recorded for this shift.
      </div>
    `;

  }


  const purchased = {};


  (expenses || [])
    .forEach(
      function (e) {

        if (
          e.stockKey &&
          Number(e.qty) > 0
        ) {

          purchased[e.stockKey] =
            (
              purchased[e.stockKey] ||
              0
            ) +
            Number(e.qty);

        }

      }
    );


  const keys = [];


  [
    startCount,
    endCount
  ].forEach(
    function (c) {

      if (
        c &&
        c.items
      ) {

        Object.keys(
          c.items
        ).forEach(
          function (k) {

            if (
              keys.indexOf(k) === -1
            ) {

              keys.push(k);

            }

          }
        );

      }

    }
  );


  const cell =
    'padding:4px; border-bottom:1px solid #666; text-align:left;';


  let html =
    '';


  if (startCount) {

    html +=
      '<div style="font-size:10px; margin-bottom:2px;">' +
      'Count In (start): ' +
      escapeHtmlPw(startCount.date) +
      ' ' +
      escapeHtmlPw(startCount.time) +
      ' | By: ' +
      escapeHtmlPw(startCount.by) +
      '</div>';

  }


  if (endCount) {

    html +=
      '<div style="font-size:10px; margin-bottom:4px;">' +
      'Count Out (end): ' +
      escapeHtmlPw(endCount.date) +
      ' ' +
      escapeHtmlPw(endCount.time) +
      ' | By: ' +
      escapeHtmlPw(endCount.by) +
      '</div>';

  }

  else {

    html +=
      '<div style="font-size:10px; margin-bottom:4px; color:#888;">' +
      'Count Out (end): not done yet' +
      '</div>';

  }


  html +=
    '<table style="width:100%; border-collapse:collapse; font-size:10px;">' +
    '<thead><tr>' +
    '<th style="' +
    cell +
    '">Item</th>' +
    '<th style="' +
    cell +
    '">Unit</th>' +
    '<th style="' +
    cell +
    '">Start Shift (System)</th>' +
    '<th style="' +
    cell +
    '">Bought (+)</th>' +
    '<th style="' +
    cell +
    '">Used (System)</th>' +
    '<th style="' +
    cell +
    '">End Shift (System)</th>' +
    '<th style="' +
    cell +
    '">Count In</th>' +
    '<th style="' +
    cell +
    '">Count Out</th>' +
    '<th style="' +
    cell +
    '">Worker Diff</th>' +
    '</tr></thead><tbody>';


  keys.forEach(
    function (k) {

      const s =
        startCount &&
        startCount.items
          ? startCount.items[k]
          : null;


      const e =
        endCount &&
        endCount.items
          ? endCount.items[k]
          : null;


      const ref =
        s ||
        e;


      const bought =
        round2(
          purchased[k] || 0
        );


      let endSystem =
        null;


      if (e) {

        endSystem =
          e.system;

      }

      else if (
        stockInventory[k]
      ) {

        endSystem =
          round2(
            stockInventory[k].current
          );

      }


      const usedSystem =
        (
          s &&
          endSystem !== null
        )
          ? round2(
              s.system +
              bought -
              endSystem
            )
          : null;


      const workerDiff =
        (
          s &&
          e
        )
          ? round2(
              s.counted +
              bought -
              e.counted
            )
          : null;


      let diffColor =
        'inherit';


      if (
        workerDiff !== null &&
        usedSystem !== null
      ) {

        const gap =
          round2(
            workerDiff -
            usedSystem
          );


        diffColor =
          gap === 0
            ? '#2ecc71'
            : (
                gap > 0
                  ? '#e74c3c'
                  : '#e67e22'
              );

      }


      html +=
        '<tr>' +

        '<td style="' +
        cell +
        '">' +
        '<strong>' +
        escapeHtmlPw(ref.name) +
        '</strong>' +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        escapeHtmlPw(ref.unit) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          s
            ? fmtQty(s.system)
            : '-'
        ) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          bought > 0
            ? '+' +
              fmtQty(bought)
            : '-'
        ) +
        '</td>' +

        '<td style="' +
        cell +
        ' font-weight:bold;">' +
        (
          usedSystem === null
            ? '-'
            : fmtQty(usedSystem)
        ) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          endSystem === null
            ? '-'
            : fmtQty(endSystem)
        ) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          s
            ? fmtQty(s.counted)
            : '-'
        ) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          e
            ? fmtQty(e.counted)
            : '-'
        ) +
        '</td>' +

        '<td style="' +
        cell +
        ' font-weight:bold; color:' +
        diffColor +
        ';">' +
        (
          workerDiff === null
            ? '-'
            : fmtQty(workerDiff)
        ) +
        '</td>' +

        '</tr>';

    }
  );


  html +=
    '</tbody></table>' +

    '<div style="font-size:9px; color:#888; margin-top:3px;">' +

    'Used (System) = Start + Bought − End. ' +
    'Worker Diff = Count In + Bought − Count Out ' +
    '(what the workers\' counts say was used). ' +
    'Green = matches Used (System), red = workers\' counts show MORE used than the system (shortage), orange = less.' +

    (
      endCount
        ? ''
        : ' Shift still open: End Shift (System) is the current stock and Worker Diff appears after the closing count.'
    ) +

    '</div>';


  return html;

}


/* =========================================================
   RENDER GARD
   ========================================================= */

function renderGardReport() {

  const el =
    document.getElementById(
      'gardReportContainer'
    );


  if (!el) {
    return;
  }


  if (
    !currentShift ||
    !currentShift.active
  ) {

    el.innerHTML =
      '<div style="color:#666; font-size:10px; padding:4px;">No active shift.</div>';

    return;

  }


  let gardExpenses =
    [];


  if (
    typeof getReportExpensesForCurrentShift ===
    'function'
  ) {

    gardExpenses =
      getReportExpensesForCurrentShift();

  }


  if (
    gardExpenses.length === 0
  ) {

    gardExpenses =
      expensesList;

  }


  el.innerHTML =
    buildGardHtml(
      currentShift.startCount,
      currentShift.endCount,
      gardExpenses
    );

}


/* =========================================================
   GAM3YA
   ========================================================= */

function buildGamiyaSummary(
  records,
  shiftId
) {

  const map = {};


  (records || [])
    .forEach(
      function (rec) {

        const key =
          String(
            rec.workerId
          );


        if (!map[key]) {

          map[key] = {

            workerName:
              rec.workerName,

            items: {},

            orders: 0,

            total: 0,

            shiftTotal: 0

          };

        }


        const w =
          map[key];


        w.orders +=
          1;


        w.total +=
          Number(
            rec.total || 0
          );


        if (
          shiftId &&
          rec.shiftId ===
            shiftId
        ) {

          w.shiftTotal +=
            Number(
              rec.total || 0
            );

        }


        (
          rec.items || []
        ).forEach(
          function (i) {

            w.items[i.name] =
              (
                w.items[i.name] ||
                0
              ) +
              Number(
                i.qty || 0
              );

          }
        );

      }
    );


  return Object.keys(
    map
  ).map(
    function (k) {

      return map[k];

    }
  );

}


/* =========================================================
   GAM3YA HTML
   ========================================================= */

function buildGamiyaHtml(
  summary
) {

  if (
    !summary ||
    summary.length === 0
  ) {

    return `
      <div style="color:#888; font-size:10px; padding:4px;">
        No Gam3ya meals recorded.
      </div>
    `;

  }


  const cell =
    'padding:4px; border-bottom:1px solid #666; text-align:left; vertical-align:top;';


  let grandTotal =
    0;


  let grandShift =
    0;


  let html =
    '<table style="width:100%; border-collapse:collapse; font-size:10px;">' +
    '<thead><tr>' +
    '<th style="' +
    cell +
    '">Worker</th>' +
    '<th style="' +
    cell +
    '">Orders Taken</th>' +
    '<th style="' +
    cell +
    '">This Shift (LE)</th>' +
    '<th style="' +
    cell +
    '">Total (LE)</th>' +
    '</tr></thead><tbody>';


  summary.forEach(
    function (w) {

      grandTotal +=
        Number(
          w.total || 0
        );


      grandShift +=
        Number(
          w.shiftTotal || 0
        );


      const itemsText =
        Object.keys(
          w.items || {}
        )
        .map(
          function (name) {

            return (
              escapeHtmlPw(name) +
              ' x' +
              fmtQty(
                w.items[name]
              )
            );

          }
        )
        .join(', ');


      html +=
        '<tr>' +

        '<td style="' +
        cell +
        '">' +

        '<strong>' +
        escapeHtmlPw(
          w.workerName
        ) +
        '</strong>' +

        '<br>' +

        '<span style="color:#888;">' +
        Number(
          w.orders || 0
        ) +
        ' order(s)' +
        '</span>' +

        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          itemsText ||
          '-'
        ) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        Number(
          w.shiftTotal || 0
        ).toFixed(2) +
        '</td>' +

        '<td style="' +
        cell +
        ' font-weight:bold;">' +
        Number(
          w.total || 0
        ).toFixed(2) +
        '</td>' +

        '</tr>';

    }
  );


  html +=
    '<tr>' +

    '<td style="' +
    cell +
    '" colspan="2">' +

    '<strong>All Gam3ya</strong>' +

    '</td>' +

    '<td style="' +
    cell +
    '">' +

    '<strong>' +
    grandShift.toFixed(2) +
    '</strong>' +

    '</td>' +

    '<td style="' +
    cell +
    '">' +

    '<strong>' +
    grandTotal.toFixed(2) +
    '</strong>' +

    '</td>' +

    '</tr></tbody></table>';


  return html;

}


/* =========================================================
   RENDER GAM3YA
   ========================================================= */

function renderGamiyaReport() {

  const el =
    document.getElementById(
      'gamiyaReportContainer'
    );


  if (!el) {
    return;
  }


  el.innerHTML =
    buildGamiyaHtml(
      buildGamiyaSummary(
        gamiyaOrders,
        currentShift
          ? currentShift.id
          : null
      )
    );

}


/* =========================================================
   SHIFT SNAPSHOT
   ========================================================= */

function buildShiftSnapshot() {

  let totalCash =
    0;

  let totalInsta =
    0;

  let totalVisa =
    0;

  let totalDisc =
    0;

  let totalSales =
    0;

  let totalExpenses =
    0;


  /*
    Prefer current-shift Supabase report data.

    Fallback to operational arrays only when the
    report data is not available.
  */

  let snapshotSales =
    [];


  let snapshotExpenses =
    [];


  if (
    typeof getReportSalesForCurrentShift ===
    'function'
  ) {

    snapshotSales =
      getReportSalesForCurrentShift();

  }


  if (
    snapshotSales.length === 0
  ) {

    snapshotSales =
      completedSales;

  }


  if (
    typeof getReportExpensesForCurrentShift ===
    'function'
  ) {

    snapshotExpenses =
      getReportExpensesForCurrentShift();

  }


  if (
    snapshotExpenses.length === 0
  ) {

    snapshotExpenses =
      expensesList;

  }


  const validSales =
    snapshotSales.filter(
      function (ord) {

        return (
          ord.status ===
          'done'
        );

      }
    );


  validSales.forEach(
    function (ord) {

      totalCash +=
        Number(
          ord.cashPaid || 0
        );


      totalInsta +=
        Number(
          ord.instaPaid || 0
        );


      totalVisa +=
        Number(
          ord.visaPaid || 0
        );


      totalDisc +=
        Number(
          ord.discount || 0
        );


      totalSales +=
        Number(
          ord.cashPaid || 0
        ) +
        Number(
          ord.instaPaid || 0
        );

    }
  );


  snapshotExpenses.forEach(
    function (exp) {

      totalExpenses +=
        Number(
          exp.cost || 0
        );

    }
  );


  ensureMonthlyFinance();


  return {

    id:
      currentShift
        ? currentShift.id
        : 'S' +
          Date.now(),


    supabaseId:
      currentShift
        ? currentShift.supabaseId ||
          null
        : null,


    startDate:
      currentShift
        ? currentShift.startDate
        : new Date()
            .toLocaleDateString(),


    startTime:
      currentShift
        ? currentShift.startTime
        : '-',


    endDate:
      new Date()
        .toLocaleDateString(),


    endTime:
      new Date()
        .toLocaleTimeString(
          [],
          {
            hour:
              '2-digit',
            minute:
              '2-digit'
          }
        ),


    totalCash:
      totalCash,


    totalInsta:
      totalInsta,


    totalVisa:
      totalVisa,


    totalDiscount:
      totalDisc,


    totalSales:
      totalSales,


    totalExpenses:
      totalExpenses,


    dailyExpenses:
      totalExpenses,


    netProfit:
      totalSales -
      totalExpenses,


    totalOrders:
      validSales.length,


    dailyOrders:
      validSales.length,


    bank:
      monthlyFinance.bank,


    overallExpenses:
      monthlyFinance.overallExpenses,


    overallOrders:
      monthlyFinance.overallOrders,


    hurryApp:
      monthlyFinance.hurryApp ||
      0,


    dailyHurryApp:
      totalVisa +
      totalDisc,


    gamiyaSummary:
      buildGamiyaSummary(
        gamiyaOrders,
        currentShift
          ? currentShift.id
          : null
      ),


    sales:
      JSON.parse(
        JSON.stringify(
          snapshotSales
        )
      ),


    expenses:
      JSON.parse(
        JSON.stringify(
          snapshotExpenses
        )
      ),


    gamiya:
      JSON.parse(
        JSON.stringify(
          gamiyaOrders.filter(
            function (rec) {

              return (
                currentShift &&
                rec.shiftId ===
                  currentShift.id
              );

            }
          )
        )
      ),


    startCount:
      currentShift &&
      currentShift.startCount
        ? currentShift.startCount
        : null,


    endCount:
      currentShift &&
      currentShift.endCount
        ? currentShift.endCount
        : null

  };

}


/* =========================================================
   PRINT SHIFT REPORT
   ========================================================= */

function printShiftReport(
  snapshot
) {

  const salesRows =
    snapshot.sales.length

      ? [...snapshot.sales]
          .sort(
            function (a, b) {

              return (
                Number(
                  a.orderNum
                ) -
                Number(
                  b.orderNum
                )
              );

            }
          )
          .map(
            function (ord) {

              const items =
                (
                  ord.items ||
                  []
                )
                  .map(
                    function (i) {

                      return (
                        i.name +
                        ' x' +
                        i.qty
                      );

                    }
                  )
                  .join(', ');


              return `
                <tr>
                  <td>#${ord.orderNum}</td>
                  <td>${ord.time}</td>
                  <td>${items}</td>
                  <td>${Number(ord.cashPaid || 0).toFixed(2)}</td>
                  <td>${Number(ord.instaPaid || 0).toFixed(2)}</td>
                  <td>${Number(ord.visaPaid || 0).toFixed(2)}</td>
                  <td>${Number(ord.discount || 0).toFixed(2)}</td>
                  <td>${Number(ord.total || 0).toFixed(2)}</td>
                </tr>
              `;

            }
          )
          .join('')

      : `
          <tr>
            <td colspan="8">
              No sales
            </td>
          </tr>
        `;


  const expenseRows =
    snapshot.expenses.length

      ? snapshot.expenses
          .map(
            function (exp) {

              return `
                <tr>
                  <td>${exp.date} ${exp.time}</td>
                  <td>${exp.name}</td>
                  <td>${exp.qty || 0}</td>
                  <td>${Number(exp.cost || 0).toFixed(2)}</td>
                  <td>${exp.notes || '-'}</td>
                </tr>
              `;

            }
          )
          .join('')

      : `
          <tr>
            <td colspan="5">
              No expenses
            </td>
          </tr>
        `;


  const html = `
    <html>

    <head>

      <title>
        TUX Shift Report ${snapshot.id}
      </title>

      <style>

        body {
          font-family: Arial, sans-serif;
          color: #000;
          padding: 20px;
          font-size: 12px;
        }

        h1,
        h2 {
          margin-bottom: 5px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0 20px;
        }

        th,
        td {
          border: 1px solid #999;
          padding: 5px;
          text-align: left;
        }

        th {
          background: #eee;
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin: 15px 0;
        }

        .box {
          border: 1px solid #999;
          padding: 8px;
        }

      </style>

    </head>

    <body>

      <h1>
        TUX - Shift Report
      </h1>

      <div>
        <strong>Shift:</strong>
        ${snapshot.id}
      </div>

      <div>
        <strong>Start:</strong>
        ${snapshot.startDate}
        ${snapshot.startTime}
      </div>

      <div>
        <strong>End:</strong>
        ${snapshot.endDate}
        ${snapshot.endTime}
      </div>


      <div class="summary">

        <div class="box">
          <strong>Cash</strong>
          <br>
          ${Number(snapshot.totalCash || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>InstaPay</strong>
          <br>
          ${Number(snapshot.totalInsta || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Visa</strong>
          <br>
          ${Number(snapshot.totalVisa || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Discount</strong>
          <br>
          ${Number(snapshot.totalDiscount || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>
            Daily Net Sales (Cash + InstaPay)
          </strong>
          <br>
          ${Number(snapshot.totalSales || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Bank</strong>
          <br>
          ${Number(snapshot.bank || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Daily Expenses</strong>
          <br>
          ${Number(
            snapshot.dailyExpenses ||
            snapshot.totalExpenses ||
            0
          ).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Overall Expenses</strong>
          <br>
          ${Number(
            snapshot.overallExpenses ||
            0
          ).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Daily Orders</strong>
          <br>
          ${Number(
            snapshot.dailyOrders ||
            snapshot.totalOrders ||
            0
          )}
        </div>

        <div class="box">
          <strong>Overall Orders</strong>
          <br>
          ${Number(
            snapshot.overallOrders ||
            0
          )}
        </div>

        <div class="box">
          <strong>
            Daily Hurry App (Visa + Discount)
          </strong>
          <br>
          ${Number(
            snapshot.dailyHurryApp ||
            0
          ).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>
            Hurry App (Total)
          </strong>
          <br>
          ${Number(
            snapshot.hurryApp ||
            0
          ).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Profit</strong>
          <br>
          ${(
            Number(
              snapshot.bank ||
              0
            ) -
            Number(
              snapshot.overallExpenses ||
              0
            )
          ).toFixed(2)} LE
        </div>

      </div>


      <h2>
        Sales Details
      </h2>

      <table>

        <thead>

          <tr>
            <th>Order</th>
            <th>Time</th>
            <th>Items</th>
            <th>Cash</th>
            <th>InstaPay</th>
            <th>Visa</th>
            <th>Discount</th>
            <th>Net Sales</th>
          </tr>

        </thead>

        <tbody>
          ${salesRows}
        </tbody>

      </table>


      <h2>
        Expenses
      </h2>

      <table>

        <thead>

          <tr>
            <th>Date/Time</th>
            <th>Expense</th>
            <th>Qty</th>
            <th>Cost</th>
            <th>Notes</th>
          </tr>

        </thead>

        <tbody>
          ${expenseRows}
        </tbody>

      </table>


      <h2>
        Gam3ya
      </h2>

      ${
        buildGamiyaHtml(
          snapshot.gamiyaSummary ||
          buildGamiyaSummary(
            snapshot.gamiya,
            snapshot.id
          )
        )
      }


      <h2>
        Stock Count (Gard)
      </h2>

      ${
        buildGardHtml(
          snapshot.startCount,
          snapshot.endCount,
          snapshot.expenses
        )
      }


      <p>
        <strong>
          Report saved automatically in TUX Shift History.
        </strong>
      </p>

    </body>

    </html>
  `;


  const reportWindow =
    window.open(
      '',
      '_blank'
    );


  if (!reportWindow) {

    alert(
      'Please allow pop-ups so the Shift Report can be printed.'
    );

    return;

  }


  reportWindow.document.open();

  reportWindow.document.write(
    html
  );

  reportWindow.document.close();

  reportWindow.focus();


  setTimeout(
    function () {

      reportWindow.print();

    },
    300
  );

}


/* =========================================================
   PRINT CURRENT SHIFT
   ========================================================= */

async function printCurrentShiftReport() {

  if (
    !currentShift ||
    !currentShift.active
  ) {

    alert(
      'There is no active shift report to print. Select a saved shift from Shift History instead.'
    );

    return;

  }


  ensureMonthlyFinance();


  /*
    Refresh Supabase data before printing.

    This guarantees that orders/expenses already saved
    to Supabase are included.
  */

  if (
    typeof loadReportsFromSupabase ===
    'function'
  ) {

    await loadReportsFromSupabase();

  }


  /*
    buildShiftSnapshot() already knows how to choose:

    1. Current-shift Supabase data
    2. Operational arrays as fallback

    Therefore we do NOT modify completedSales or
    expensesList here.
  */

  const snapshot =
    buildShiftSnapshot();


  /*
    For an ACTIVE shift, monthlyFinance contains
    previous completed shifts only.

    Add the current shift's values temporarily for
    the printable report.

    This does NOT modify monthlyFinance.
  */

  snapshot.bank =
    Number(
      monthlyFinance.bank ||
      0
    ) +
    Number(
      snapshot.totalSales ||
      0
    );


  snapshot.overallExpenses =
    Number(
      monthlyFinance.overallExpenses ||
      0
    ) +
    Number(
      snapshot.totalExpenses ||
      0
    );


  snapshot.overallOrders =
    Number(
      monthlyFinance.overallOrders ||
      0
    ) +
    Number(
      snapshot.totalOrders ||
      0
    );


  snapshot.hurryApp =
    Number(
      monthlyFinance.hurryApp ||
      0
    ) +
    Number(
      snapshot.dailyHurryApp ||
      0
    );


  printShiftReport(
    snapshot
  );

}


/* =========================================================
   PRINT SAVED SHIFT
   ========================================================= */

function printShiftReportById(
  shiftId
) {

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
    return;
  }


  printShiftReport(
    shift
  );

}


/* =========================================================
   FINANCE VALUES
   ========================================================= */

function editFinanceValues() {

  if (
    getActiveRole() !==
    'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can edit these values.'
    );

    return;

  }


  ensureMonthlyFinance();


  const b =
    prompt(
      'Bank (LE):',
      Number(
        monthlyFinance.bank ||
        0
      ).toFixed(2)
    );


  if (
    b === null
  ) {

    return;

  }


  const e =
    prompt(
      'Overall Expenses (LE):',
      Number(
        monthlyFinance.overallExpenses ||
        0
      ).toFixed(2)
    );


  if (
    e === null
  ) {

    return;

  }


  const o =
    prompt(
      'Overall Orders:',
      String(
        Number(
          monthlyFinance.overallOrders ||
          0
        )
      )
    );


  if (
    o === null
  ) {

    return;

  }


  const h =
    prompt(
      'Hurry App (LE):',
      Number(
        monthlyFinance.hurryApp ||
        0
      ).toFixed(2)
    );


  if (
    h === null
  ) {

    return;

  }


  const bank =
    parseFloat(b);


  const exp =
    parseFloat(e);


  const ord =
    parseInt(
      o,
      10
    );


  const hurry =
    parseFloat(h);


  if (
    isNaN(bank) ||
    isNaN(exp) ||
    isNaN(ord) ||
    isNaN(hurry) ||
    bank < 0 ||
    exp < 0 ||
    ord < 0 ||
    hurry < 0
  ) {

    alert(
      'Please enter valid non-negative numbers.'
    );

    return;

  }


  monthlyFinance.bank =
    bank;


  monthlyFinance.overallExpenses =
    exp;


  monthlyFinance.overallOrders =
    ord;


  monthlyFinance.hurryApp =
    hurry;


  localStorage.setItem(
    'tuxMonthlyFinance',
    JSON.stringify(
      monthlyFinance
    )
  );


  renderSalesReport();


  alert(
    'Bank / Overall / Hurry App values updated.'
  );

}


/* =========================================================
   RESET FINANCE
   ========================================================= */

function resetFinanceValues() {

  if (
    getActiveRole() !==
    'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can reset these values.'
    );

    return;

  }


  if (
    !confirm(
      'Reset Bank, Overall Expenses, Overall Orders and Hurry App to ZERO?\n\nSaved Shift History will NOT be deleted.'
    )
  ) {

    return;

  }


  monthlyFinance = {

    monthKey:
      getCurrentMonthKey(),

    bank: 0,

    overallExpenses: 0,

    overallOrders: 0,

    hurryApp: 0

  };


  localStorage.setItem(
    'tuxMonthlyFinance',
    JSON.stringify(
      monthlyFinance
    )
  );


  renderSalesReport();


  alert(
    'Bank, Overall Expenses, Overall Orders and Hurry App were reset to zero.'
  );

}


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
   RESET GAM3YA
   ========================================================= */

function resetGamiya() {

  if (
    getActiveRole() !==
    'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can reset Gam3ya.'
    );

    return;

  }


  if (
    !confirm(
      'Delete ALL Gam3ya (staff meals) records?\n\nThe stock that was already deducted will NOT be returned.'
    )
  ) {

    return;

  }


  gamiyaOrders = [];


  saveCurrentShiftData();


  renderGamiyaView();

  renderGamiyaReport();


  alert(
    'Gam3ya was reset.'
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


/* =========================================================
   SALES REPORT
   ========================================================= */

function renderSalesReport() {

  renderGardReport();


  /*
    Historical sales and expenses are loaded from
    Supabase through reportsService.js.
  */

  const salesData =
    (
      typeof reportSales !==
      'undefined' &&
      Array.isArray(reportSales)
    )
      ? reportSales
      : [];


  const expensesData =
    (
      typeof reportExpenses !==
      'undefined' &&
      Array.isArray(reportExpenses)
    )
      ? reportExpenses
      : [];


  /* ========================================================
     CURRENT SHIFT DATA
     ======================================================== */

  let dailySales =
    [];


  let dailyExpenses =
    [];


  if (
    currentShift &&
    currentShift.supabaseId
  ) {

    if (
      typeof getReportSalesForCurrentShift ===
      'function'
    ) {

      dailySales =
        getReportSalesForCurrentShift()
          .filter(
            function (ord) {

              return (
                ord.status ===
                'done'
              );

            }
          );

    }

    else {

      dailySales =
        salesData.filter(
          function (ord) {

            return (
              ord.shiftId ===
              currentShift.supabaseId &&
              ord.status ===
              'done'
            );

          }
        );

    }


    if (
      typeof getReportExpensesForCurrentShift ===
      'function'
    ) {

      dailyExpenses =
        getReportExpensesForCurrentShift();

    }

    else {

      dailyExpenses =
        expensesData.filter(
          function (expense) {

            return (
              expense.shiftId ===
              currentShift.supabaseId
            );

          }
        );

    }

  }

  else {

    /*
      No active shift means there is no Daily
      operational total.

      Historical data is still shown below.
    */

    dailySales = [];

    dailyExpenses = [];

  }


  /* ========================================================
     DAILY TOTALS
     ======================================================== */

  let dailyCash =
    0;


  let dailyInsta =
    0;


  let dailyVisa =
    0;


  let dailyDisc =
    0;


  let dailySalesTotal =
    0;


  dailySales.forEach(
    function (ord) {

      dailyCash +=
        Number(
          ord.cashPaid ||
          0
        );


      dailyInsta +=
        Number(
          ord.instaPaid ||
          0
        );


      dailyVisa +=
        Number(
          ord.visaPaid ||
          0
        );


      dailyDisc +=
        Number(
          ord.discount ||
          0
        );


      dailySalesTotal +=
        Number(
          ord.cashPaid ||
          0
        ) +
        Number(
          ord.instaPaid ||
          0
        );

    }
  );


  const dailyOrders =
    dailySales.length;


  /*
    IMPORTANT:

    Daily Expenses are calculated ONLY from
    expenses belonging to the current shift.
  */

  const dailyExpensesTotal =
    dailyExpenses.reduce(
      function (
        total,
        expense
      ) {

        return (
          total +
          Number(
            expense.cost ||
            0
          )
        );

      },
      0
    );


  const dailyHurryApp =
    dailyVisa +
    dailyDisc;


  /* ========================================================
     OVERALL / HISTORICAL TOTALS
     ======================================================== */

  const completedReportSales =
    salesData.filter(
      function (ord) {

        return (
          ord.status ===
          'done'
        );

      }
    );


  let overallSales =
    0;


  let overallCash =
    0;


  let overallInsta =
    0;


  let overallVisa =
    0;


  let overallDisc =
    0;


  completedReportSales.forEach(
    function (ord) {

      overallCash +=
        Number(
          ord.cashPaid ||
          0
        );


      overallInsta +=
        Number(
          ord.instaPaid ||
          0
        );


      overallVisa +=
        Number(
          ord.visaPaid ||
          0
        );


      overallDisc +=
        Number(
          ord.discount ||
          0
        );


      overallSales +=
        Number(
          ord.cashPaid ||
          0
        ) +
        Number(
          ord.instaPaid ||
          0
        );

    }
  );


  /*
    Overall Orders are ALL completed orders
    from Supabase.
  */

  const overallOrders =
    completedReportSales.length;


  /*
    Overall Expenses are ALL expenses from
    Supabase.

    This is intentionally different from
    dailyExpensesTotal.
  */

  const overallExpenses =
    expensesData.reduce(
      function (
        total,
        expense
      ) {

        return (
          total +
          Number(
            expense.cost ||
            0
          )
        );

      },
      0
    );


  /*
    Hurry App = Visa + Discount.
  */

  const hurryApp =
    overallVisa +
    overallDisc;


  /*
    Bank = total completed historical net sales.

    Net sales = Cash + InstaPay.
  */

  const bank =
    overallSales;


  /*
    Net Profit = historical sales - historical
    expenses.
  */

  const netProfit =
    bank -
    overallExpenses;


  /* ========================================================
     DAILY HURRY APP
     ======================================================== */

  const dailyHurryEl =
    document.getElementById(
      'repDailyHurry'
    );


  if (dailyHurryEl) {

    dailyHurryEl.innerText =
      dailyHurryApp.toFixed(2) +
      ' LE';

  }


  /* ========================================================
     OVERALL HURRY APP
     ======================================================== */

  const hurryEl =
    document.getElementById(
      'repHurry'
    );


  if (hurryEl) {

    hurryEl.innerText =
      hurryApp.toFixed(2) +
      ' LE';

  }


  renderGamiyaReport();


  /* ========================================================
     DAILY CASH
     ======================================================== */

  const cashEl =
    document.getElementById(
      'repTotalCash'
    );


  if (cashEl) {

    cashEl.innerText =
      dailyCash.toFixed(2) +
      ' LE';

  }


  /* ========================================================
     DAILY INSTAPAY
     ======================================================== */

  const instaEl =
    document.getElementById(
      'repTotalInsta'
    );


  if (instaEl) {

    instaEl.innerText =
      dailyInsta.toFixed(2) +
      ' LE';

  }


  /* ========================================================
     DAILY VISA
     ======================================================== */

  const visaEl =
    document.getElementById(
      'repTotalVisa'
    );


  if (visaEl) {

    visaEl.innerText =
      dailyVisa.toFixed(2) +
      ' LE';

  }


  /* ========================================================
     DAILY DISCOUNT
     ======================================================== */

  const discEl =
    document.getElementById(
      'repTotalDisc'
    );


  if (discEl) {

    discEl.innerText =
      dailyDisc.toFixed(2) +
      ' LE';

  }


  /* ========================================================
     DAILY NET SALES
     ======================================================== */

  const salesEl =
    document.getElementById(
      'repTotalSales'
    );


  if (salesEl) {

    salesEl.innerText =
      dailySalesTotal.toFixed(2) +
      ' LE';

  }


  /* ========================================================
     BANK
     ======================================================== */

  const bankEl =
    document.getElementById(
      'repBank'
    );


  if (bankEl) {

    bankEl.innerText =
      bank.toFixed(2) +
      ' LE';

  }


  /* ========================================================
     DAILY EXPENSES
     ======================================================== */

  const dailyExpensesEl =
    document.getElementById(
      'repDailyExpenses'
    );


  if (dailyExpensesEl) {

    dailyExpensesEl.innerText =
      dailyExpensesTotal.toFixed(2) +
      ' LE';

  }


  /* ========================================================
     OVERALL EXPENSES
     ======================================================== */

  const totalExpensesEl =
    document.getElementById(
      'repTotalExpenses'
    );


  if (totalExpensesEl) {

    totalExpensesEl.innerText =
      overallExpenses.toFixed(2) +
      ' LE';

  }


  /* ========================================================
     OVERALL ORDERS
     ======================================================== */

  const overallOrdersEl =
    document.getElementById(
      'repOverallOrders'
    );


  if (overallOrdersEl) {

    overallOrdersEl.innerText =
      overallOrders;

  }


  /* ========================================================
     NET PROFIT
     ======================================================== */

  const netProfitEl =
    document.getElementById(
      'repNetProfit'
    );


  if (netProfitEl) {

    netProfitEl.innerText =
      netProfit.toFixed(2) +
      ' LE';


    netProfitEl.style.color =
      netProfit >= 0
        ? '#2ecc71'
        : '#e74c3c';

  }


  /* ========================================================
     DAILY ORDERS
     ======================================================== */

  const totalOrdersEl =
    document.getElementById(
      'repTotalOrders'
    );


  if (totalOrdersEl) {

    totalOrdersEl.innerText =
      dailyOrders;

  }


  /* ========================================================
     SALES LIST
     ======================================================== */

  const listContainer =
    document.getElementById(
      'salesListContainer'
    );


  if (!listContainer) {
    return;
  }


  if (
    salesData.length === 0
  ) {

    listContainer.innerHTML = `

      <div
        style="
          color:#666;
          text-align:center;
          margin-top:20px;
        "
      >
        No sales recorded yet
      </div>

    `;

    return;

  }


  let html =
    '';


  [...salesData]
    .sort(
      function (a, b) {

        return (
          new Date(
            b.createdAt ||
            0
          ) -
          new Date(
            a.createdAt ||
            0
          )
        );

      }
    )
    .forEach(
      function (ord) {

        const itemsNames =
          (
            ord.items ||
            []
          )
          .map(
            function (i) {

              return (
                i.name +
                ' (x' +
                i.qty +
                ')'
              );

            }
          )
          .join(', ');


        const statusColor =
          ord.status ===
          'cancelled'
            ? '#e74c3c'
            : (
                ord.status ===
                'done'
                  ? '#2ecc71'
                  : '#f1c40f'
              );


        const statusLabel =
          ord.status ===
          'cancelled'
            ? 'Cancelled'
            : (
                ord.status ===
                'done'
                  ? 'Completed'
                  : 'Preparing'
              );


        html += `

          <div
            style="
              background:#1c1c2b;
              padding:6px 10px;
              border-radius:4px;
              display:flex;
              justify-content:space-between;
              align-items:center;
              font-size:11px;
              margin-bottom:4px;
            "
          >

            <div>

              <strong>
                Order #${ord.orderNum}
              </strong>

              <span style="color:#888;">
                (${ord.time})
              </span>

              <br>

              <span
                style="
                  color:#aaa;
                  font-size:10px;
                "
              >
                ${itemsNames || '-'}
              </span>

              <br>

              <span
                style="
                  color:#888;
                  font-size:9px;
                "
              >
                Staff:
                ${ord.staffName || '-'}
              </span>

              <br>

              <span
                style="
                  color:#666;
                  font-size:8.5px;
                "
              >
                ${ord.date || '-'}
              </span>

            </div>


            <div
              style="
                text-align:right;
              "
            >

              <span
                style="
                  color:#f1c40f;
                  font-weight:bold;
                "
              >
                ${Number(
                  ord.total ||
                  0
                ).toFixed(2)} LE
              </span>

              <br>

              <span
                style="
                  font-size:9.5px;
                  color:${statusColor};
                "
              >
                ${statusLabel}
              </span>

            </div>

          </div>

        `;

      }
    );


  listContainer.innerHTML =
    html;

}