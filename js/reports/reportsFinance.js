/* =========================================================
   TUX POS — REPORT FINANCE
   Monthly Finance — Supabase, Realtime, Edit and Reset
   ========================================================= */


/* =========================================================
   MONTHLY FINANCE — SUPABASE
   ========================================================= */

let reportFinanceRealtimeChannel = null;
let reportFinanceRealtimeStarted = false;
let reportFinanceLoaded = false;


/* =========================================================
   LOAD MONTHLY FINANCE FROM SUPABASE
   ========================================================= */

async function loadMonthlyFinanceFromSupabase() {

  ensureMonthlyFinance();

  const monthKey =
    getCurrentMonthKey();

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from('report_finance')
        .select(
          'id, month_key, bank, overall_expenses, overall_orders, hurry_app, updated_at'
        )
        .eq(
          'month_key',
          monthKey
        )
        .maybeSingle();

    if (error) {

      console.error(
        'TUX POS — Failed to load monthly finance:',
        error
      );

      reportFinanceLoaded = false;

      return false;

    }

    if (!data) {

      monthlyFinance = {

        monthKey:
          monthKey,

        bank:
          0,

        overallExpenses:
          0,

        overallOrders:
          0,

        hurryApp:
          0

      };

      reportFinanceLoaded = true;

      return true;

    }

    monthlyFinance = {

      monthKey:
        data.month_key ||
        monthKey,

      bank:
        Number(
          data.bank ||
          0
        ),

      overallExpenses:
        Number(
          data.overall_expenses ||
          0
        ),

      overallOrders:
        Math.trunc(
          Number(
            data.overall_orders ||
            0
          )
        ),

      hurryApp:
        Number(
          data.hurry_app ||
          0
        )

    };

    reportFinanceLoaded = true;

    return true;

  }

  catch (error) {

    console.error(
      'TUX POS — Monthly finance load failed:',
      error
    );

    reportFinanceLoaded = false;

    return false;

  }

}


/* =========================================================
   SAVE MONTHLY FINANCE TO SUPABASE
   ========================================================= */

async function saveMonthlyFinanceToSupabase() {

  ensureMonthlyFinance();

  const monthKey =
    getCurrentMonthKey();

  const financeData = {

    month_key:
      monthKey,

    bank:
      Number(
        monthlyFinance.bank ||
        0
      ),

    overall_expenses:
      Number(
        monthlyFinance.overallExpenses ||
        0
      ),

    overall_orders:
      Math.trunc(
        Number(
          monthlyFinance.overallOrders ||
          0
        )
      ),

    hurry_app:
      Number(
        monthlyFinance.hurryApp ||
        0
      ),

    updated_at:
      new Date().toISOString()

  };

  try {

    const {
      error
    } =
      await supabaseClient
        .from('report_finance')
        .upsert(
          financeData,
          {
            onConflict:
              'month_key'
          }
        );

    if (error) {

      console.error(
        'TUX POS — Failed to save monthly finance:',
        error
      );

      alert(
        'Could not save Finance Values to Supabase.\n\n' +
        error.message
      );

      return false;

    }

    monthlyFinance.monthKey =
      monthKey;

    reportFinanceLoaded =
      true;

    return true;

  }

  catch (error) {

    console.error(
      'TUX POS — Monthly finance save failed:',
      error
    );

    alert(
      'Could not save Finance Values to Supabase.\n\n' +
      error.message
    );

    return false;

  }

}


/* =========================================================
   MONTHLY FINANCE REALTIME
   ========================================================= */

function subscribeToReportFinanceRealtime() {

  if (
    reportFinanceRealtimeStarted ||
    !supabaseClient
  ) {

    return;

  }

  reportFinanceRealtimeStarted =
    true;

  reportFinanceRealtimeChannel =
    supabaseClient
      .channel(
        'tux-report-finance-realtime'
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'report_finance'
        },
        async function () {

          await loadMonthlyFinanceFromSupabase();

          renderSalesReport();

        }
      )
      .subscribe();

}


/* =========================================================
   INITIALIZE MONTHLY FINANCE
   ========================================================= */

async function initializeMonthlyFinance() {

  await loadMonthlyFinanceFromSupabase();

  subscribeToReportFinanceRealtime();

  renderSalesReport();

}


/* =========================================================
   FINANCE VALUES
   ========================================================= */

async function editFinanceValues() {

  if (
    getActiveRole() !==
    'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can edit these values.'
    );

    return;

  }

  await loadMonthlyFinanceFromSupabase();

  ensureMonthlyFinance();

  showReportsEditPanel();

}


/* =========================================================
   REPORTS EDIT PANEL
   ONLY FINANCE VALUES ARE EDITABLE
   ========================================================= */

function showReportsEditPanel() {

  if (
    getActiveRole() !==
    'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can edit report details.'
    );

    return;

  }

  const existing =
    document.getElementById(
      'tuxReportsEditOverlay'
    );

  if (existing) {

    existing.remove();

  }

  ensureMonthlyFinance();

  const overlay =
    document.createElement(
      'div'
    );

  overlay.id =
    'tuxReportsEditOverlay';

  overlay.style.cssText =
    `
      position:fixed;
      inset:0;
      z-index:99999;
      background:rgba(0,0,0,0.78);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:15px;
      box-sizing:border-box;
    `;

  overlay.innerHTML = `

    <div
      style="
        width:min(700px,100%);
        max-height:92vh;
        overflow-y:auto;
        background:#11111c;
        color:#fff;
        border:1px solid #444;
        border-radius:8px;
        padding:15px;
        box-sizing:border-box;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          margin-bottom:12px;
        "
      >

        <div>

          <div
            style="
              color:#f1c40f;
              font-size:16px;
              font-weight:bold;
            "
          >
            Edit Report Finance Values
          </div>

          <div
            style="
              color:#888;
              font-size:10px;
              margin-top:3px;
            "
          >
            Tux Admin only — changes are saved directly to Supabase.
          </div>

        </div>

        <button
          type="button"
          onclick="closeReportsEditPanel()"
          style="
            padding:6px 12px;
            background:#c0392b;
            color:#fff;
            border:0;
            border-radius:4px;
            cursor:pointer;
          "
        >
          ✕ Close
        </button>

      </div>

      <div
        style="
          background:#181824;
          border:1px solid #444;
          border-radius:6px;
          padding:10px;
          margin-bottom:12px;
        "
      >

        <div
          style="
            color:#3498db;
            font-weight:bold;
            margin-bottom:8px;
          "
        >
          Overall / Finance Values
        </div>

        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(150px,1fr));
            gap:7px;
          "
        >

          <label style="font-size:10px;">
            Bank (LE)

            <input
              id="report-finance-bank"
              type="number"
              step="0.01"
              min="0"
              value="${Number(monthlyFinance.bank || 0)}"
              style="
                width:100%;
                box-sizing:border-box;
                margin-top:3px;
                padding:6px;
                background:#101018;
                color:#fff;
                border:1px solid #555;
                border-radius:4px;
              "
            >

          </label>

          <label style="font-size:10px;">
            Overall Expenses (LE)

            <input
              id="report-finance-expenses"
              type="number"
              step="0.01"
              min="0"
              value="${Number(monthlyFinance.overallExpenses || 0)}"
              style="
                width:100%;
                box-sizing:border-box;
                margin-top:3px;
                padding:6px;
                background:#101018;
                color:#fff;
                border:1px solid #555;
                border-radius:4px;
              "
            >

          </label>

          <label style="font-size:10px;">
            Overall Orders

            <input
              id="report-finance-orders"
              type="number"
              step="1"
              min="0"
              value="${Number(monthlyFinance.overallOrders || 0)}"
              style="
                width:100%;
                box-sizing:border-box;
                margin-top:3px;
                padding:6px;
                background:#101018;
                color:#fff;
                border:1px solid #555;
                border-radius:4px;
              "
            >

          </label>

          <label style="font-size:10px;">
            Hurry App (LE)

            <input
              id="report-finance-hurry"
              type="number"
              step="0.01"
              min="0"
              value="${Number(monthlyFinance.hurryApp || 0)}"
              style="
                width:100%;
                box-sizing:border-box;
                margin-top:3px;
                padding:6px;
                background:#101018;
                color:#fff;
                border:1px solid #555;
                border-radius:4px;
              "
            >

          </label>

        </div>

        <button
          type="button"
          onclick="saveAllReportFinanceValues()"
          style="
            margin-top:8px;
            padding:6px 14px;
            background:#2980b9;
            color:#fff;
            border:0;
            border-radius:4px;
            cursor:pointer;
          "
        >
          Save Finance Values
        </button>

      </div>

      <div
        style="
          margin-top:15px;
          padding:10px;
          background:#1c1c2b;
          border:1px solid #444;
          border-radius:5px;
          color:#888;
          font-size:9px;
          line-height:1.6;
        "
      >
        Orders and Expenses remain viewable on the Reports page
        but cannot be edited from this panel.

        <br><br>

        Daily values are calculated automatically from the current
        shift. Overall Finance values are stored in Supabase and
        can only be changed by Tux Admin.

        <br><br>

        Profit = Bank − Overall Expenses.
      </div>

    </div>

  `;

  document.body.appendChild(
    overlay
  );

}


/* =========================================================
   CLOSE REPORT EDIT PANEL
   ========================================================= */

function closeReportsEditPanel() {

  const panel =
    document.getElementById(
      'tuxReportsEditOverlay'
    );

  if (panel) {

    panel.remove();

  }

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeAttributePw(
  value
) {

  return String(
    value === null ||
    value === undefined
      ? ''
      : value
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    );

}


/* =========================================================
   SAVE FINANCE VALUES — SUPABASE
   ========================================================= */

async function saveAllReportFinanceValues() {

  if (
    getActiveRole() !==
    'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can edit these values.'
    );

    return;

  }

  const bankInput =
    document.getElementById(
      'report-finance-bank'
    );

  const expensesInput =
    document.getElementById(
      'report-finance-expenses'
    );

  const ordersInput =
    document.getElementById(
      'report-finance-orders'
    );

  const hurryInput =
    document.getElementById(
      'report-finance-hurry'
    );

  if (
    !bankInput ||
    !expensesInput ||
    !ordersInput ||
    !hurryInput
  ) {

    return;

  }

  const bank =
    Number(
      bankInput.value
    );

  const expenses =
    Number(
      expensesInput.value
    );

  const orders =
    Number(
      ordersInput.value
    );

  const hurry =
    Number(
      hurryInput.value
    );

  if (
    !Number.isFinite(bank) ||
    !Number.isFinite(expenses) ||
    !Number.isFinite(orders) ||
    !Number.isFinite(hurry) ||
    bank < 0 ||
    expenses < 0 ||
    orders < 0 ||
    !Number.isInteger(orders) ||
    hurry < 0
  ) {

    alert(
      'Please enter valid non-negative numbers.'
    );

    return;

  }

  ensureMonthlyFinance();

  monthlyFinance.bank =
    bank;

  monthlyFinance.overallExpenses =
    expenses;

  monthlyFinance.overallOrders =
    orders;

  monthlyFinance.hurryApp =
    hurry;

  const saved =
    await saveMonthlyFinanceToSupabase();

  if (!saved) {

    return;

  }

  renderSalesReport();

  closeReportsEditPanel();

  alert(
    'Finance values updated successfully and saved to Supabase.'
  );

}


/* =========================================================
   RESET FINANCE — SUPABASE
   ========================================================= */

async function resetFinanceValues() {

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

    bank:
      0,

    overallExpenses:
      0,

    overallOrders:
      0,

    hurryApp:
      0

  };

  const saved =
    await saveMonthlyFinanceToSupabase();

  if (!saved) {

    return;

  }

  renderSalesReport();

  alert(
    'Bank, Overall Expenses, Overall Orders and Hurry App were reset to zero and saved to Supabase.'
  );

}