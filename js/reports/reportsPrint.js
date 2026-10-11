
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

  let snapshotSales = [];
  let snapshotExpenses = [];

  if (
    typeof getReportSalesForCurrentShift === 'function'
  ) {
    snapshotSales = getReportSalesForCurrentShift();
  }

  if (snapshotSales.length === 0) {
    snapshotSales = completedSales;
  }

  if (
    typeof getReportExpensesForCurrentShift === 'function'
  ) {
    snapshotExpenses = getReportExpensesForCurrentShift();
  }

  if (snapshotExpenses.length === 0) {
    snapshotExpenses = expensesList;
  }

  const validSales = snapshotSales.filter(function (ord) {
    return ord.status === 'done';
  });

  validSales.forEach(function (ord) {
    totalCash += Number(ord.cashPaid || 0);
    totalInsta += Number(ord.instaPaid || 0);
    totalVisa += Number(ord.visaPaid || 0);
    totalDisc += Number(ord.discount || 0);

    totalSales +=
      Number(ord.cashPaid || 0) +
      Number(ord.instaPaid || 0);
  });

  snapshotExpenses.forEach(function (exp) {
    totalExpenses += Number(exp.cost || 0);
  });

  ensureMonthlyFinance();


  /* =========================================================
     ADMIN REPORT SNAPSHOT
     ========================================================= */

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
    totalOrders: validSales.length,
    dailyOrders: validSales.length,

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
/*   =========================================================    
                       shift display number 
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
  const sales = Array.isArray(snapshot.sales)
    ? snapshot.sales
    : [];

  const expenses = Array.isArray(snapshot.expenses)
    ? snapshot.expenses
    : [];

  const salesRows = sales.length
    ? [...sales]
      .sort(function (a, b) {
        return Number(a.orderNum) - Number(b.orderNum);
      })
      .map(function (ord) {
        const items = (ord.items || [])
          .map(function (item) {
            return (
              (item.name || 'Item') +
              ' x' +
              (item.qty || 0)
            );
          })
          .join(', ');

        return `
            <tr>
              <td>#${ord.orderNum}</td>
              <td>${ord.time || '-'}</td>
              <td>${items}</td>
              <td>${Number(ord.cashPaid || 0).toFixed(2)}</td>
              <td>${Number(ord.instaPaid || 0).toFixed(2)}</td>
              <td>${Number(ord.visaPaid || 0).toFixed(2)}</td>
              <td>${Number(ord.discount || 0).toFixed(2)}</td>
              <td>${Number(ord.total || 0).toFixed(2)}</td>
            </tr>
          `;
      })
      .join('')
    : `
        <tr>
          <td colspan="8">No sales</td>
        </tr>
      `;

  const expenseRows = expenses.length
    ? expenses
      .map(function (exp) {
        return `
            <tr>
              <td>${exp.date || '-'} ${exp.time || ''}</td>
              <td>${exp.name || '-'}</td>
              <td>${exp.qty || 0}</td>
              <td>${Number(exp.cost || 0).toFixed(2)}</td>
              <td>${exp.notes || '-'}</td>
            </tr>
          `;
      })
      .join('')
    : `
        <tr>
          <td colspan="5">No expenses</td>
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

  const adminCash = Number(adminReports.cash || 0);
  const adminInstaPay = Number(adminReports.instaPay || 0);
  const adminDailyNetSales = Number(adminReports.dailyNetSales || 0);
  const adminBank = Number(adminReports.bank || 0);
  const adminProfit = Number(adminReports.profit || 0);

  const hawalkRequests = Array.isArray(snapshot.hawalkRequests)
    ? snapshot.hawalkRequests
    : getHawalkRequestsForShift(snapshot);


  const html = `
    <html>
    <head>
   <title>TUX Shift Report ${getShiftDisplayNumber(snapshot.id)}</title>

      <style>
        body {
          font-family: Arial, sans-serif;
          color: #000;
          padding: 20px;
          font-size: 12px;
        }

        h1, h2 {
          margin-bottom: 5px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0 20px;
        }

        th, td {
          border: 1px solid #999;
          padding: 5px;
          text-align: left;
          vertical-align: top;
          overflow-wrap: anywhere;
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

        .admin-summary {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          margin: 15px 0;
        }

        .box {
          border: 1px solid #999;
          padding: 8px;
        }

        .admin-box {
          border: 1px solid #3498db;
          padding: 8px;
        }

        @media print {
          body {
            padding: 0;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      </style>
    </head>

    <body>
      <h1>TUX - Shift Report</h1>

    <div>
  <strong>Shift:</strong>
  ${getShiftDisplayNumber(snapshot.id)}
</div>
      <div>
        <strong>Start:</strong>
        ${snapshot.startDate} ${snapshot.startTime}
      </div>

      <div>
        <strong>End:</strong>
        ${snapshot.endDate} ${snapshot.endTime}
      </div>

      <div class="summary">
        <div class="box">
          <strong>Cash</strong><br>
          ${Number(snapshot.totalCash || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>InstaPay</strong><br>
          ${Number(snapshot.totalInsta || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Visa</strong><br>
          ${Number(snapshot.totalVisa || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Discount</strong><br>
          ${Number(snapshot.totalDiscount || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Daily Net Sales (Cash + InstaPay)</strong><br>
          ${Number(snapshot.totalSales || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Bank</strong><br>
          ${Number(snapshot.bank || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Daily Expenses</strong><br>
          ${Number(
    snapshot.dailyExpenses ||
    snapshot.totalExpenses ||
    0
  ).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Overall Expenses</strong><br>
          ${Number(snapshot.overallExpenses || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Daily Orders</strong><br>
          ${Number(snapshot.dailyOrders || snapshot.totalOrders || 0)}
        </div>

        <div class="box">
          <strong>Overall Orders</strong><br>
          ${Number(snapshot.overallOrders || 0)}
        </div>

        <div class="box">
          <strong>Daily Hurry App (Visa + Discount)</strong><br>
          ${Number(snapshot.dailyHurryApp || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Hurry App (Total)</strong><br>
          ${Number(snapshot.hurryApp || 0).toFixed(2)} LE
        </div>

        <div class="box">
          <strong>Profit</strong><br>
          ${(
      Number(snapshot.bank || 0) -
      Number(snapshot.overallExpenses || 0)
    ).toFixed(2)} LE
        </div>
      </div>


      <h2>Admin Reports</h2>

      <div class="admin-summary">
        <div class="admin-box">
          <strong>Admin Cash</strong><br>
          ${adminCash.toFixed(2)} LE
        </div>

        <div class="admin-box">
          <strong>Admin InstaPay</strong><br>
          ${adminInstaPay.toFixed(2)} LE
        </div>

        <div class="admin-box">
          <strong>Admin Daily Net Sales</strong><br>
          ${adminDailyNetSales.toFixed(2)} LE
        </div>

        <div class="admin-box">
          <strong>Admin Bank</strong><br>
          ${adminBank.toFixed(2)} LE
        </div>

        <div class="admin-box">
          <strong>Admin Profit</strong><br>
          ${adminProfit.toFixed(2)} LE
        </div>
      </div>


      <h2>Sales Details</h2>

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


      <h2>Gam3ya</h2>

      ${buildGamiyaHtml(
      snapshot.gamiyaSummary ||
      buildGamiyaSummary(snapshot.gamiya, snapshot.id)
    )
    }


      <h2>Hawalk Requests</h2>

      <p>
        Requests shown here were created between the shift start and end times.
        Stock is deducted only when an authorized reviewer accepts a request.
      </p>

      ${buildHawalkHtml(hawalkRequests)}


      <p>
        <strong>
          Report saved automatically in TUX Shift History.
        </strong>
      </p>
    </body>
    </html>
  `;

  const reportWindow = window.open('', '_blank');

  if (!reportWindow) {
    alert('Please allow pop-ups so the Shift Report can be printed.');
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
  const shift = shiftHistory.find(function (item) {
    return item.id === shiftId;
  });

  if (!shift) {
    return;
  }

  printShiftReport(shift);
}