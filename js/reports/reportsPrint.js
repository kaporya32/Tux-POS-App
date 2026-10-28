
/* =========================================================
   TUX POS — REPORT PRINT
   Shift Snapshot and Printing
   ========================================================= */


/* =========================================================
   HAWALK REPORT HELPERS
   ========================================================= */

function getHawalkShiftBoundary(dateValue, timeValue) {
  if (!dateValue || !timeValue || timeValue === '-') {
    return null;
  }

  const parsed = new Date(`${dateValue} ${timeValue}`);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}


function getHawalkRequestsForShift(shift) {
  const requests =
    typeof getHawalkRequests === 'function'
      ? getHawalkRequests()
      : Array.isArray(hawalkRequests)
        ? hawalkRequests
        : [];

  if (!Array.isArray(requests) || !shift) {
    return [];
  }

  const start = getHawalkShiftBoundary(
    shift.startDate,
    shift.startTime
  );

  const end = getHawalkShiftBoundary(
    shift.endDate,
    shift.endTime
  );

  if (!start || !end) {
    return [];
  }

  return requests.filter(function (request) {
    if (!request || !request.created_at) {
      return false;
    }

    const createdAt = new Date(request.created_at);

    if (Number.isNaN(createdAt.getTime())) {
      return false;
    }

    return (
      createdAt >= start &&
      createdAt <= end
    );
  });
}


function buildHawalkHtml(requests) {
  const list = Array.isArray(requests)
    ? requests
    : [];

  if (list.length === 0) {
    return '<p>No Hawalk requests found for this shift.</p>';
  }

  const escapeHtml = function (value) {
    if (typeof escapeHawalkHtml === 'function') {
      return escapeHawalkHtml(value == null ? '' : String(value));
    }

    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const rows = list.map(function (request) {
    const date = request.created_at
      ? new Date(request.created_at).toLocaleString()
      : '-';

    const items = Array.isArray(request.items)
      ? request.items.map(function (item) {
        const name = escapeHtml(
          item.itemName || item.name || 'Unknown item'
        );

        const quantity = Number(item.quantity || 0);

        const unit = escapeHtml(item.unit || 'piece');

        return `${name} × ${quantity} ${unit}`;
      }).join('<br>')
      : '-';

    return `
      <tr>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(request.worker_name || '-')}</td>
        <td>${items || '-'}</td>
        <td>${escapeHtml(request.status || '-')}</td>
      </tr>
    `;
  }).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Date/Time</th>
          <th>Worker</th>
          <th>Requested Items</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}


/* =========================================================
   SHIFT SNAPSHOT
   ========================================================= */

function buildShiftSnapshot() {
  let totalCash = 0;
  let totalInsta = 0;
  let totalVisa = 0;
  let totalDisc = 0;
  let totalSales = 0;
  let totalExpenses = 0;
  let deliveryToday = 0;
  let cancelledOrders = 0;

  let snapshotSales = [];
  let snapshotExpenses = [];

  if (
    typeof getReportSalesForCurrentShift === 'function'
  ) {
    snapshotSales = getReportSalesForCurrentShift();
  }

  if (!Array.isArray(snapshotSales)) {
    snapshotSales = [];
  }

  if (snapshotSales.length === 0) {
    snapshotSales =
      Array.isArray(completedSales)
        ? completedSales
        : [];
  }

  if (
    typeof getReportExpensesForCurrentShift === 'function'
  ) {
    snapshotExpenses = getReportExpensesForCurrentShift();
  }

  if (!Array.isArray(snapshotExpenses)) {
    snapshotExpenses = [];
  }

  if (snapshotExpenses.length === 0) {
    snapshotExpenses =
      Array.isArray(expensesList)
        ? expensesList
        : [];
  }

  /*
  
  * Include completed sales in financial totals.
  * Count cancelled orders separately.
    */
  snapshotSales.forEach(function (ord) {
    const status = String(ord.status || '').toLowerCase();


    if (



      status === 'cancelled' ||
      status === 'canceled'
    ) {
      cancelledOrders++;
      return;
    }

    if (status !== 'done') {
      return;
    }

    totalCash += Number(ord.cashPaid || 0);
    totalInsta += Number(ord.instaPaid || 0);
    totalVisa += Number(ord.visaPaid || 0);
    totalDisc += Number(ord.discount || 0);

    totalSales +=
      Number(ord.cashPaid || 0) +
      Number(ord.instaPaid || 0);

    deliveryToday += Math.max(
      0,
      Number(ord.deliveryFee ?? ord.delivery_fee ?? 0)
    );


  });

  snapshotExpenses.forEach(function (exp) {
    totalExpenses += Number(exp.cost || 0);
  });

  ensureMonthlyFinance();

  /*
  
  * Resolve accumulated delivery from existing finance state.
  * The correct property name must match your app's implementation.
    */
  let overallDelivery = 0;

  if (typeof monthlyFinance !== 'undefined' && monthlyFinance) {
    overallDelivery = Number(
      monthlyFinance.overallDelivery ??
      monthlyFinance.deliveryTotal ??
      monthlyFinance.totalDelivery ??
      0
    );
  }

  /*
  
  * ADMIN REPORT SNAPSHOT
    */
  let adminCash = 0;
  let adminInstaPay = 0;
  let adminDailyNetSales = 0;
  let adminBank = 0;
  let adminProfit = 0;

  if (typeof ensureAdminReportFinance === 'function') {
    ensureAdminReportFinance();


    adminCash = Number(adminReportFinance.cash || 0);
    adminInstaPay = Number(adminReportFinance.instaPay || 0);
    adminDailyNetSales = Number(adminReportFinance.dailyNetSales || 0);
    adminBank = Number(adminReportFinance.bank || 0);
    adminProfit = Number(adminReportFinance.profit || 0);


  }

  const snapshot = {
    id: currentShift
      ? currentShift.id
      : 'S' + Date.now(),


    supabaseId: currentShift
      ? currentShift.supabaseId || null
      : null,

    startDate: currentShift
      ? currentShift.startDate
      : new Date().toLocaleDateString(),

    startTime: currentShift
      ? currentShift.startTime
      : '-',

    endDate: new Date().toLocaleDateString(),

    endTime: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }),

    totalCash: totalCash,
    totalInsta: totalInsta,
    totalVisa: totalVisa,
    totalDiscount: totalDisc,
    totalSales: totalSales,
    totalExpenses: totalExpenses,
    dailyExpenses: totalExpenses,
    netProfit: totalSales - totalExpenses,
    totalOrders: snapshotSales.filter(function (ord) {
      return String(ord.status || '').toLowerCase() === 'done';
    }).length,

    dailyOrders: snapshotSales.filter(function (ord) {
      return String(ord.status || '').toLowerCase() === 'done';
    }).length,

    deliveryToday: deliveryToday,
    overallDelivery: overallDelivery,
    cancelledOrders: cancelledOrders,

    bank: monthlyFinance.bank,
    overallExpenses: monthlyFinance.overallExpenses,
    overallOrders: monthlyFinance.overallOrders,
    hurryApp: monthlyFinance.hurryApp || 0,
    dailyHurryApp: totalVisa + totalDisc,

    adminReports: {
      cash: adminCash,
      instaPay: adminInstaPay,
      dailyNetSales: adminDailyNetSales,
      bank: adminBank,
      profit: adminProfit
    },

    gamiyaSummary: buildGamiyaSummary(
      gamiyaOrders,
      currentShift ? currentShift.id : null
    ),

    sales: JSON.parse(JSON.stringify(snapshotSales)),
    expenses: JSON.parse(JSON.stringify(snapshotExpenses)),

    gamiya: JSON.parse(
      JSON.stringify(
        gamiyaOrders.filter(function (rec) {
          return (
            currentShift &&
            rec.shiftId === currentShift.id
          );
        })
      )
    )


  };

  snapshot.hawalkRequests = getHawalkRequestsForShift(snapshot);

  return snapshot;
}



/* =========================================================
   SHIFT DISPLAY NUMBER
   ========================================================= */

function getShiftDisplayNumber(shiftId) {
  const sortedShifts = [...(shiftHistory || [])].sort(function (a, b) {
    const dateA = new Date(
      `${a.startDate || ''} ${a.startTime || ''}`
    ).getTime();

    const dateB = new Date(
      `${b.startDate || ''} ${b.startTime || ''}`
    ).getTime();

    // Put shifts with unparseable dates at the end.
    if (Number.isNaN(dateA)) return 1;
    if (Number.isNaN(dateB)) return -1;

    return dateA - dateB;
  });

  const index = sortedShifts.findIndex(function (shift) {
    return String(shift.id) === String(shiftId);
  });

  return index === -1
    ? String(shiftId)
    : `Shift #${index + 1}`;
}


/* =========================================================
   PRINT SHIFT REPORT
   ========================================================= */

function printShiftReport(snapshot) {

  /* =========================================================
     SOURCE DATA
     ========================================================= */

  const sales = Array.isArray(snapshot.sales)
    ? snapshot.sales
    : [];

  const expenses = Array.isArray(snapshot.expenses)
    ? snapshot.expenses
    : [];


  /* =========================================================
     HELPER FUNCTIONS
     ========================================================= */

  const escapeHtml = function (value) {

    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  };


  const getDeliveryFee = function (order) {

    return Math.max(
      0,
      Number(
        order.deliveryFee ??
        order.delivery_fee ??
        0
      ) || 0
    );

  };


  const isCancelledOrder = function (order) {

    const status = String(
      order.status || ''
    ).toLowerCase();

    return (
      status === 'cancelled' ||
      status === 'canceled'
    );

  };


  const isCompletedOrder = function (order) {

    return (
      String(order.status || '').toLowerCase() === 'done'
    );

  };


  const formatMoney = function (value) {

    return Number(value || 0).toFixed(2);

  };


  /* =========================================================
     DELIVERY TODAY
     Counts delivery fees for completed orders only.
     ========================================================= */

  const calculatedDeliveryToday = sales.reduce(
    function (total, order) {

      if (!isCompletedOrder(order)) {
        return total;
      }

      return total + getDeliveryFee(order);

    },
    0
  );


  const deliveryToday = Number(
    snapshot.deliveryToday ??
    snapshot.dailyDelivery ??
    calculatedDeliveryToday
  ) || 0;


  /* =========================================================
     OVERALL DELIVERY
     Use the saved overall value when available.
     ========================================================= */

  let overallDelivery = 0;

  if (
    snapshot.overallDelivery !== undefined &&
    snapshot.overallDelivery !== null
  ) {

    overallDelivery = Number(
      snapshot.overallDelivery
    ) || 0;

  } else if (
    typeof monthlyFinance !== 'undefined' &&
    monthlyFinance
  ) {

    overallDelivery = Number(
      monthlyFinance.overallDelivery ??
      monthlyFinance.deliveryTotal ??
      monthlyFinance.totalDelivery ??
      0
    ) || 0;

  }


  /* =========================================================
     CANCELLED ORDERS
     ========================================================= */

  const calculatedCancelledOrders = sales.filter(
    function (order) {
      return isCancelledOrder(order);
    }
  ).length;


  const cancelledOrders = Number(
    snapshot.cancelledOrders ??
    calculatedCancelledOrders
  ) || 0;


  /* =========================================================
     SALES TABLE ROWS
     ========================================================= */

  const salesRows = sales.length

    ? [...sales]

      .sort(function (a, b) {

        return (
          Number(a.orderNum || a.orderNumber || 0) -
          Number(b.orderNum || b.orderNumber || 0)
        );

      })

      .map(function (ord) {

        const items = (
          Array.isArray(ord.items)
            ? ord.items
            : []
        )

          .map(function (item) {

            const itemName = escapeHtml(
              item.name || 'Item'
            );

            const quantity = Number(
              item.qty ??
              item.quantity ??
              0
            );

            const extras = Array.isArray(item.extras)
              ? item.extras
              : [];

            const extrasText = extras

              .map(function (extra) {

                if (typeof extra === 'string') {
                  return escapeHtml(extra);
                }

                return escapeHtml(
                  extra.name ||
                  extra.itemName ||
                  ''
                );

              })

              .filter(Boolean)

              .join(', ');

            return `
              <div>
                ${itemName} × ${quantity}

                ${extrasText
                ? `<br><small>Extras: ${extrasText}</small>`
                : ''
              }
              </div>
            `;

          })

          .join('');


        const orderNumber = escapeHtml(
          ord.orderNum ??
          ord.orderNumber ??
          '-'
        );


        const orderTime = escapeHtml(
          ord.time || '-'
        );


        const cashPaid = Number(
          ord.cashPaid ??
          ord.cash_paid ??
          0
        );


        const instaPaid = Number(
          ord.instaPaid ??
          ord.insta_paid ??
          0
        );


        const visaPaid = Number(
          ord.visaPaid ??
          ord.visa_paid ??
          0
        );


        const discount = Number(
          ord.discount || 0
        );


        const total = Number(
          ord.total || 0
        );


        const deliveryFee = getDeliveryFee(ord);


        const status = String(
          ord.status || 'unknown'
        ).toLowerCase();


        let statusLabel = status;
        let statusColor = '#555';

        if (status === 'done') {

          statusLabel = 'Completed';
          statusColor = '#16803c';

        } else if (isCancelledOrder(ord)) {

          statusLabel = 'Cancelled';
          statusColor = '#c0392b';

        } else if (status === 'preparing') {

          statusLabel = 'Preparing';
          statusColor = '#b8860b';

        }


        const note = String(
          ord.note || ''
        ).trim();


        const staffName = escapeHtml(
          ord.staffName ||
          ord.staff_name ||
          '-'
        );


        return `
          <tr>

            <td>
              #${orderNumber}
            </td>

            <td>
              ${orderTime}
            </td>

            <td>
              ${items || '-'}
            </td>

            <td>
              ${staffName}
            </td>

            <td>
              ${formatMoney(cashPaid)}
            </td>

            <td>
              ${formatMoney(instaPaid)}
            </td>

            <td>
              ${formatMoney(visaPaid)}
            </td>

            <td>
              ${formatMoney(discount)}
            </td>

            <td>
              ${formatMoney(deliveryFee)}
            </td>

            <td>
              ${formatMoney(total)}
            </td>

            <td style="
              color:${statusColor};
              font-weight:bold;
            ">
              ${escapeHtml(statusLabel)}
            </td>

            <td style="
              white-space:pre-wrap;
              overflow-wrap:anywhere;
            ">
              ${escapeHtml(note || '-')}
            </td>

          </tr>
        `;

      })

      .join('')

    : `
      <tr>
        <td colspan="12">
          No orders found for this shift.
        </td>
      </tr>
    `;


  /* =========================================================
     EXPENSE TABLE ROWS
     ========================================================= */

  const expenseRows = expenses.length

    ? expenses

      .map(function (exp) {

        const date = escapeHtml(
          exp.date || '-'
        );

        const time = escapeHtml(
          exp.time || ''
        );

        const name = escapeHtml(
          exp.name || '-'
        );

        const quantity = escapeHtml(
          exp.qty ?? exp.quantity ?? 0
        );

        const cost = Number(
          exp.cost || 0
        );

        const notes = escapeHtml(
          exp.notes || '-'
        );


        return `
          <tr>

            <td>
              ${date} ${time}
            </td>

            <td>
              ${name}
            </td>

            <td>
              ${quantity}
            </td>

            <td>
              ${formatMoney(cost)}
            </td>

            <td>
              ${notes}
            </td>

          </tr>
        `;

      })

      .join('')

    : `
      <tr>
        <td colspan="5">
          No expenses recorded.
        </td>
      </tr>
    `;


  /* =========================================================
     ADMIN REPORT VALUES
     ========================================================= */

  const adminReports = snapshot.adminReports || {

    cash: 0,
    instaPay: 0,
    dailyNetSales: 0,
    bank: 0,
    profit: 0

  };


  const adminCash = Number(
    adminReports.cash || 0
  );


  const adminInstaPay = Number(
    adminReports.instaPay || 0
  );


  const adminDailyNetSales = Number(
    adminReports.dailyNetSales || 0
  );


  const adminBank = Number(
    adminReports.bank || 0
  );


  const adminProfit = Number(
    adminReports.profit || 0
  );


  /* =========================================================
     HAWALK REQUESTS
     ========================================================= */

  const hawalkRequests = Array.isArray(
    snapshot.hawalkRequests
  )

    ? snapshot.hawalkRequests

    : (
      typeof getHawalkRequestsForShift === 'function'
        ? getHawalkRequestsForShift(snapshot)
        : []
    );


  /* =========================================================
     SHIFT DISPLAY
     ========================================================= */

  const shiftDisplayNumber =
    typeof getShiftDisplayNumber === 'function'

      ? getShiftDisplayNumber(snapshot.id)

      : String(snapshot.id || '-');


  /* =========================================================
     BUILD PRINT HTML
     ========================================================= */

  const html = `

    <!DOCTYPE html>

    <html>

    <head>

      <meta charset="UTF-8">

      <title>
        TUX Shift Report ${escapeHtml(shiftDisplayNumber)}
      </title>

      <style>

        * {
          box-sizing: border-box;
        }

        body {
          font-family: Arial, sans-serif;
          color: #000;
          padding: 20px;
          font-size: 12px;
        }

        h1 {
          margin-bottom: 8px;
        }

        h2 {
          margin-top: 24px;
          margin-bottom: 8px;
          border-bottom: 1px solid #999;
          padding-bottom: 5px;
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
          vertical-align: top;
          overflow-wrap: anywhere;
        }

        th {
          background: #eee;
        }

        .shift-info {
          margin: 5px 0;
          line-height: 1.6;
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin: 15px 0;
        }

        .admin-summary {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          margin: 15px 0;
        }

        .box {
          border: 1px solid #999;
          padding: 8px;
          overflow-wrap: anywhere;
        }

        .admin-box {
          border: 1px solid #3498db;
          padding: 8px;
          overflow-wrap: anywhere;
        }

        .delivery-box {
          border: 1px solid #d4a900;
          padding: 8px;
          background: #fffbea;
          overflow-wrap: anywhere;
        }

        .cancelled-box {
          border: 1px solid #c0392b;
          padding: 8px;
          background: #fff0f0;
          overflow-wrap: anywhere;
        }

        .section-note {
          font-size: 11px;
          color: #444;
          line-height: 1.5;
        }

        @media print {

          body {
            padding: 0;
            font-size: 10px;
          }

          h2 {
            page-break-after: avoid;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          .summary,
          .admin-summary {
            break-inside: avoid;
          }

        }

      </style>

    </head>


    <body>

      <h1>TUX - Shift Report</h1>


      <div class="shift-info">

        <div>
          <strong>Shift:</strong>
          ${escapeHtml(shiftDisplayNumber)}
        </div>

        <div>
          <strong>Start:</strong>
          ${escapeHtml(snapshot.startDate || '-')}
          ${escapeHtml(snapshot.startTime || '-')}
        </div>

        <div>
          <strong>End:</strong>
          ${escapeHtml(snapshot.endDate || '-')}
          ${escapeHtml(snapshot.endTime || '-')}
        </div>

      </div>


      <!-- ===================================================
           FINANCIAL SUMMARY
           =================================================== -->

      <h2>Shift Summary</h2>

      <div class="summary">

        <div class="box">
          <strong>Cash</strong><br>
          ${formatMoney(snapshot.totalCash)} LE
        </div>

        <div class="box">
          <strong>InstaPay</strong><br>
          ${formatMoney(snapshot.totalInsta)} LE
        </div>

        <div class="box">
          <strong>Visa</strong><br>
          ${formatMoney(snapshot.totalVisa)} LE
        </div>

        <div class="box">
          <strong>Discount</strong><br>
          ${formatMoney(snapshot.totalDiscount)} LE
        </div>


        <div class="box">
          <strong>Daily Net Sales (Cash + InstaPay)</strong><br>
          ${formatMoney(snapshot.totalSales)} LE
        </div>

        <div class="box">
          <strong>Bank</strong><br>
          ${formatMoney(snapshot.bank)} LE
        </div>

        <div class="box">
          <strong>Daily Expenses</strong><br>
          ${formatMoney(
    snapshot.dailyExpenses ??
    snapshot.totalExpenses ??
    0
  )} LE
        </div>

        <div class="box">
          <strong>Overall Expenses</strong><br>
          ${formatMoney(snapshot.overallExpenses)} LE
        </div>


        <div class="box">
          <strong>Daily Orders</strong><br>
          ${Number(
    snapshot.dailyOrders ??
    snapshot.totalOrders ??
    0
  )}
        </div>

        <div class="box">
          <strong>Overall Orders</strong><br>
          ${Number(snapshot.overallOrders || 0)}
        </div>

        <div class="box">
          <strong>Daily Hurry App (Visa + Discount)</strong><br>
          ${formatMoney(snapshot.dailyHurryApp)} LE
        </div>

        <div class="box">
          <strong>Hurry App (Total)</strong><br>
          ${formatMoney(snapshot.hurryApp)} LE
        </div>


        <div class="box">
          <strong>Profit</strong><br>
          ${formatMoney(
    Number(snapshot.bank || 0) -
    Number(snapshot.overallExpenses || 0)
  )} LE
        </div>


        <!-- DELIVERY TODAY -->

     <div class="box">
  <strong>Delivery Today</strong><br>
  ${deliveryToday.toFixed(2)} LE
</div>

<div class="box">
  <strong>Overall Delivery</strong><br>
  ${overallDelivery.toFixed(2)} LE
</div>

<div class="box">
  <strong>Cancelled Orders</strong><br>
  ${cancelledOrders}
</div>

      </div>


      <!-- ===================================================
           ADMIN REPORTS
           =================================================== -->

      <h2>Admin Reports</h2>

      <div class="admin-summary">

        <div class="admin-box">
          <strong>Admin Cash</strong><br>
          ${formatMoney(adminCash)} LE
        </div>

        <div class="admin-box">
          <strong>Admin InstaPay</strong><br>
          ${formatMoney(adminInstaPay)} LE
        </div>

        <div class="admin-box">
          <strong>Admin Daily Net Sales</strong><br>
          ${formatMoney(adminDailyNetSales)} LE
        </div>

        <div class="admin-box">
          <strong>Admin Bank</strong><br>
          ${formatMoney(adminBank)} LE
        </div>

        <div class="admin-box">
          <strong>Admin Profit</strong><br>
          ${formatMoney(adminProfit)} LE
        </div>

      </div>


      <!-- ===================================================
           SALES DETAILS
           =================================================== -->

      <h2>Sales Details</h2>

      <table>

        <thead>

          <tr>
            <th>Order</th>
            <th>Time</th>
            <th>Items</th>
            <th>Staff</th>
            <th>Cash</th>
            <th>InstaPay</th>
            <th>Visa</th>
            <th>Discount</th>
            <th>Delivery Fee</th>
            <th>Total</th>
            <th>Status</th>
            <th>Order Note</th>
          </tr>

        </thead>

        <tbody>
          ${salesRows}
        </tbody>

      </table>


      <!-- ===================================================
           EXPENSES
           =================================================== -->

      <h2>Expenses</h2>

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


      <!-- ===================================================
           GAM3YA
           =================================================== -->

      <h2>Gam3ya</h2>

      ${typeof buildGamiyaHtml === 'function'

      ? buildGamiyaHtml(
        snapshot.gamiyaSummary ||
        (
          typeof buildGamiyaSummary === 'function'

            ? buildGamiyaSummary(
              snapshot.gamiya,
              snapshot.id
            )

            : null
        )
      )

      : '<p>Gam3ya report is unavailable.</p>'
    }


      <!-- ===================================================
           HAWALK REQUESTS
           =================================================== -->

      <h2>Hawalk Requests</h2>

      <p class="section-note">
        Requests shown here were created between the shift
        start and end times. Stock is deducted only when an
        authorized reviewer accepts a request.
      </p>

      ${typeof buildHawalkHtml === 'function'

      ? buildHawalkHtml(hawalkRequests)

      : '<p>Hawalk report is unavailable.</p>'
    }


      <!-- ===================================================
           FOOTER
           =================================================== -->

      <p>
        <strong>
          Report saved automatically in TUX Shift History.
        </strong>
      </p>


    </body>

    </html>

  `;


  /* =========================================================
     OPEN PRINT WINDOW
     ========================================================= */

  const reportWindow = window.open(
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

  reportWindow.document.write(html);

  reportWindow.document.close();

  reportWindow.focus();


  setTimeout(function () {

    reportWindow.print();

  }, 300);

}


/* =========================================================
   PRINT CURRENT SHIFT
   ========================================================= */

async function printCurrentShiftReport() {
  if (!currentShift || !currentShift.active) {
    alert(
      'There is no active shift report to print. Select a saved shift from Shift History instead.'
    );

    return;
  }

  await loadMonthlyFinanceFromSupabase();

  if (typeof loadReportsFromSupabase === 'function') {
    await loadReportsFromSupabase();
  }

  if (typeof loadAdminReportFinanceFromSupabase === 'function') {
    await loadAdminReportFinanceFromSupabase();
  }

  if (typeof loadHawalkRequestsFromSupabase === 'function') {
    await loadHawalkRequestsFromSupabase();
  }

  const snapshot = buildShiftSnapshot();

  snapshot.bank =
    Number(monthlyFinance.bank || 0) +
    Number(snapshot.totalSales || 0);

  snapshot.overallExpenses =
    Number(monthlyFinance.overallExpenses || 0) +
    Number(snapshot.totalExpenses || 0);

  snapshot.overallOrders =
    Number(monthlyFinance.overallOrders || 0) +
    Number(snapshot.totalOrders || 0);

  snapshot.hurryApp =
    Number(monthlyFinance.hurryApp || 0) +
    Number(snapshot.dailyHurryApp || 0);

  printShiftReport(snapshot);
}


/* =========================================================
   PRINT SAVED SHIFT
   ========================================================= */


function printShiftReportById(shiftId) {
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
    alert('The selected shift report could not be found.');
    return;
  }

  // Print the selected shift's report only.
  printShiftReport(shift);
}


