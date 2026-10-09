/* =========================================================
   TUX POS — REPORT SALES
   Sales Report
   ========================================================= */


/* =========================================================
   SALES REPORT
   ========================================================= */

function renderSalesReport() {

  renderGardReport();

  ensureMonthlyFinance();


  /* =======================================================
     SOURCE DATA
     ======================================================= */

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


  let dailySales =
    [];


  let dailyExpenses =
    [];


  /* =======================================================
     IMPORTANT
     
     Daily report values are ONLY allowed when there is
     an ACTIVE shift.

     This prevents old shift data from remaining visible
     after End Shift.
     ======================================================= */

  const hasActiveShift =
    !!(
      currentShift &&
      currentShift.active === true &&
      currentShift.supabaseId
    );


  if (
    hasActiveShift
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
     * NO ACTIVE SHIFT
     *
     * This is the important part for End Shift.
     *
     * Historical report data remains in reportSales and
     * reportExpenses, but Daily Report values become zero.
     */

    dailySales =
      [];

    dailyExpenses =
      [];

  }


  /* =======================================================
     DAILY CALCULATIONS
     ======================================================= */

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


  /* =======================================================
     OVERALL VALUES
     
     These values come from report_finance in Supabase.
     They are NOT recalculated from current orders here.
     ======================================================= */

  const overallSales =
    Number(
      monthlyFinance.bank ||
      0
    );


  const overallExpenses =
    Number(
      monthlyFinance.overallExpenses ||
      0
    );


  const overallOrders =
    Math.trunc(
      Number(
        monthlyFinance.overallOrders ||
        0
      )
    );


  const hurryApp =
    Number(
      monthlyFinance.hurryApp ||
      0
    );


  const bank =
    overallSales;


  const netProfit =
    bank -
    overallExpenses;


  /* =======================================================
     DAILY HURRY APP
     ======================================================= */

  const dailyHurryEl =
    document.getElementById(
      'repDailyHurry'
    );


  if (dailyHurryEl) {

    dailyHurryEl.innerText =
      dailyHurryApp.toFixed(2) +
      ' LE';

  }


  /* =======================================================
     OVERALL HURRY APP
     ======================================================= */

  const hurryEl =
    document.getElementById(
      'repHurry'
    );


  if (hurryEl) {

    hurryEl.innerText =
      hurryApp.toFixed(2) +
      ' LE';

  }


  /* =======================================================
     GAM3YA
     ======================================================= */

  renderGamiyaReport();


  /* =======================================================
     DAILY CASH
     ======================================================= */

  const cashEl =
    document.getElementById(
      'repTotalCash'
    );


  if (cashEl) {

    cashEl.innerText =
      dailyCash.toFixed(2) +
      ' LE';

  }


  /* =======================================================
     DAILY INSTAPAY
     ======================================================= */

  const instaEl =
    document.getElementById(
      'repTotalInsta'
    );


  if (instaEl) {

    instaEl.innerText =
      dailyInsta.toFixed(2) +
      ' LE';

  }


  /* =======================================================
     DAILY VISA
     ======================================================= */

  const visaEl =
    document.getElementById(
      'repTotalVisa'
    );


  if (visaEl) {

    visaEl.innerText =
      dailyVisa.toFixed(2) +
      ' LE';

  }


  /* =======================================================
     DAILY DISCOUNT
     ======================================================= */

  const discEl =
    document.getElementById(
      'repTotalDisc'
    );


  if (discEl) {

    discEl.innerText =
      dailyDisc.toFixed(2) +
      ' LE';

  }


  /* =======================================================
     DAILY SALES
     ======================================================= */

  const salesEl =
    document.getElementById(
      'repTotalSales'
    );


  if (salesEl) {

    salesEl.innerText =
      dailySalesTotal.toFixed(2) +
      ' LE';

  }


  /* =======================================================
     BANK — SUPABASE FINANCE
     ======================================================= */

  const bankEl =
    document.getElementById(
      'repBank'
    );


  if (bankEl) {

    bankEl.innerText =
      bank.toFixed(2) +
      ' LE';

  }


  /* =======================================================
     DAILY EXPENSES
     ======================================================= */

  const dailyExpensesEl =
    document.getElementById(
      'repDailyExpenses'
    );


  if (dailyExpensesEl) {

    dailyExpensesEl.innerText =
      dailyExpensesTotal.toFixed(2) +
      ' LE';

  }


  /* =======================================================
     OVERALL EXPENSES
     ======================================================= */

  const totalExpensesEl =
    document.getElementById(
      'repTotalExpenses'
    );


  if (totalExpensesEl) {

    totalExpensesEl.innerText =
      overallExpenses.toFixed(2) +
      ' LE';

  }


  /* =======================================================
     OVERALL ORDERS
     ======================================================= */

  const overallOrdersEl =
    document.getElementById(
      'repOverallOrders'
    );


  if (overallOrdersEl) {

    overallOrdersEl.innerText =
      overallOrders;

  }


  /* =======================================================
     PROFIT
     ======================================================= */

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


  /* =======================================================
     DAILY ORDERS
     ======================================================= */

  const totalOrdersEl =
    document.getElementById(
      'repTotalOrders'
    );


  if (totalOrdersEl) {

    totalOrdersEl.innerText =
      dailyOrders;

  }


  /* =======================================================
     SALES LIST
     
     IMPORTANT:
     The Sales List remains historical.
     We do NOT clear reportSales because old sales are
     needed for Shift History / historical reports.
     ======================================================= */

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