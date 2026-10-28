/* =========================================================
   TUX POS — ADMIN REPORTS
   Admin + Tux Admin can edit Admin Cash / InstaPay
   Worker can only view
   Tux Admin can reset all Admin Reports
   ========================================================= */


/* =========================================================
   STATE
   ========================================================= */

let adminReportFinance = {
  monthKey: '',
  cash: 0,
  instaPay: 0,
  dailyNetSales: 0,
  bank: 0,
  profit: 0
};

let adminReportFinanceChannel = null;
let adminReportFinanceRealtimeStarted = false;
let adminReportFinanceLoading = false;


/* =========================================================
   MONTH KEY
   ========================================================= */

function getAdminReportMonthKey() {

  const now = new Date();

  return (
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0')
  );

}


/* =========================================================
   ENSURE STATE
   ========================================================= */

function ensureAdminReportFinance() {

  const monthKey = getAdminReportMonthKey();

  if (
    !adminReportFinance ||
    typeof adminReportFinance !== 'object'
  ) {

    adminReportFinance = {
      monthKey: monthKey,
      cash: 0,
      instaPay: 0,
      dailyNetSales: 0,
      bank: 0,
      profit: 0
    };

  }

  if (
    typeof adminReportFinance.monthKey !== 'string' ||
    !adminReportFinance.monthKey
  ) {

    adminReportFinance.monthKey = monthKey;

  }

  if (
    adminReportFinance.monthKey !== monthKey
  ) {

    adminReportFinance = {
      monthKey: monthKey,
      cash: 0,
      instaPay: 0,
      dailyNetSales: 0,
      bank: 0,
      profit: 0
    };

  }

  if (
    typeof adminReportFinance.cash !== 'number'
  ) {

    adminReportFinance.cash =
      Number(
        adminReportFinance.cash || 0
      );

  }

  if (
    typeof adminReportFinance.instaPay !== 'number'
  ) {

    adminReportFinance.instaPay =
      Number(
        adminReportFinance.instaPay || 0
      );

  }

  if (
    typeof adminReportFinance.bank !== 'number'
  ) {

    adminReportFinance.bank =
      Number(
        adminReportFinance.bank || 0
      );

  }

  adminReportFinance.cash =
    Math.max(
      0,
      Number(
        adminReportFinance.cash
      ) || 0
    );

  adminReportFinance.instaPay =
    Math.max(
      0,
      Number(
        adminReportFinance.instaPay
      ) || 0
    );

  adminReportFinance.bank =
    Math.max(
      0,
      Number(
        adminReportFinance.bank
      ) || 0
    );


  /* ---------------------------------------------------------
     AUTOMATIC DAILY NET SALES
     --------------------------------------------------------- */

  adminReportFinance.dailyNetSales =
    adminReportFinance.cash +
    adminReportFinance.instaPay;


  /* ---------------------------------------------------------
     AUTOMATIC PROFIT
     --------------------------------------------------------- */

  let overallExpenses = 0;

  try {

    ensureMonthlyFinance();

    overallExpenses =
      Number(
        monthlyFinance &&
        monthlyFinance.overallExpenses
          ? monthlyFinance.overallExpenses
          : 0
      );

  } catch (error) {

    overallExpenses = 0;

  }

  adminReportFinance.profit =
    adminReportFinance.bank -
    overallExpenses;

}


/* =========================================================
   CHECK ADMIN REPORT EDIT PERMISSION
   ADMIN + TUX ADMIN CAN EDIT CASH / INSTAPAY
   WORKER CANNOT EDIT
   ========================================================= */

function canEditAdminReports() {

  try {

    if (
      typeof getActiveRole !== 'function'
    ) {

      return false;

    }

    const role =
      String(
        getActiveRole() || ''
      )
        .toLowerCase()
        .trim();

    return (
      role === 'admin' ||
      role === 'tuxadmin' ||
      role === 'tux_admin' ||
      role === 'tux-admin'
    );

  } catch (error) {

    console.error(
      'canEditAdminReports error:',
      error
    );

    return false;

  }

}


/* =========================================================
   CHECK TUX ADMIN RESET PERMISSION
   ONLY TUX ADMIN CAN RESET
   ========================================================= */

function canResetAdminReports() {

  try {

    if (
      typeof getActiveRole !== 'function'
    ) {

      return false;

    }

    const role =
      String(
        getActiveRole() || ''
      )
        .toLowerCase()
        .trim();

    return (
      role === 'tuxadmin' ||
      role === 'tux_admin' ||
      role === 'tux-admin'
    );

  } catch (error) {

    console.error(
      'canResetAdminReports error:',
      error
    );

    return false;

  }

}


/* =========================================================
   LOAD FROM SUPABASE
   ========================================================= */

async function loadAdminReportFinanceFromSupabase() {

  if (
    adminReportFinanceLoading
  ) {

    return;

  }

  adminReportFinanceLoading = true;

  try {

    ensureAdminReportFinance();

    const monthKey =
      getAdminReportMonthKey();


    const { data, error } =
      await supabaseClient
        .from('report_finance')
        .select(
          'month_key, admin_cash, admin_instapay, admin_daily_net_sales, admin_bank, admin_profit'
        )
        .eq(
          'month_key',
          monthKey
        )
        .maybeSingle();


    if (error) {

      console.error(
        'Failed to load Admin Reports:',
        error
      );

      return;

    }


    if (data) {

      adminReportFinance = {

        monthKey:
          monthKey,

        cash:
          Math.max(
            0,
            Number(
              data.admin_cash || 0
            )
          ),

        instaPay:
          Math.max(
            0,
            Number(
              data.admin_instapay || 0
            )
          ),

        dailyNetSales:
          0,

        bank:
          Math.max(
            0,
            Number(
              data.admin_bank || 0
            )
          ),

        profit:
          0

      };

    } else {

      adminReportFinance = {

        monthKey:
          monthKey,

        cash:
          0,

        instaPay:
          0,

        dailyNetSales:
          0,

        bank:
          0,

        profit:
          0

      };

    }


    ensureAdminReportFinance();

    renderAdminReports();

  } catch (error) {

    console.error(
      'loadAdminReportFinanceFromSupabase error:',
      error
    );

  } finally {

    adminReportFinanceLoading =
      false;

  }

}


/* =========================================================
   SAVE TO SUPABASE
   ========================================================= */

async function saveAdminReportFinanceToSupabase() {
  ensureAdminReportFinance();

  const monthKey =
    getAdminReportMonthKey();

  const payload = {
    month_key: monthKey,

    admin_cash:
      Number(adminReportFinance.cash || 0),

    admin_instapay:
      Number(adminReportFinance.instaPay || 0),

    admin_daily_net_sales:
      Number(adminReportFinance.dailyNetSales || 0),

    admin_bank:
      Number(adminReportFinance.bank || 0),

    admin_profit:
      Number(adminReportFinance.profit || 0),

    updated_at:
      new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from('report_finance')
    .upsert(
      payload,
      {
        onConflict: 'month_key'
      }
    );

  if (error) {
    console.error(
      'Failed to save Admin Reports:',
      error
    );

    throw error;
  }
}

/* =========================================================
   REALTIME
   ========================================================= */

function startAdminReportFinanceRealtime() {

  if (
    adminReportFinanceRealtimeStarted &&
    adminReportFinanceChannel
  ) {

    return;

  }


  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {

    return;

  }


  adminReportFinanceRealtimeStarted =
    true;


  adminReportFinanceChannel =
    supabaseClient
      .channel(
        'tux-admin-report-finance-realtime'
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'report_finance'
        },
        async function () {

          await loadAdminReportFinanceFromSupabase();

        }
      )
      .subscribe(
        function (status) {

          console.log(
            'Admin Reports realtime:',
            status
          );

        }
      );

}


/* =========================================================
   FORMAT MONEY
   ========================================================= */

function formatAdminReportMoney(value) {

  const number =
    Number(
      value || 0
    );

  return (
    number.toFixed(2) +
    ' LE'
  );

}


/* =========================================================
   RENDER ADMIN REPORTS
   ========================================================= */

function renderAdminReports() {

  ensureAdminReportFinance();


  /* ---------------------------------------------------------
     ADMIN CASH
     --------------------------------------------------------- */

  const cashElement =
    document.getElementById(
      'adminReportCash'
    );

  if (cashElement) {

    cashElement.textContent =
      formatAdminReportMoney(
        adminReportFinance.cash
      );

  }


  /* ---------------------------------------------------------
     ADMIN INSTAPAY
     --------------------------------------------------------- */

  const instaElement =
    document.getElementById(
      'adminReportInstaPay'
    );

  if (instaElement) {

    instaElement.textContent =
      formatAdminReportMoney(
        adminReportFinance.instaPay
      );

  }


  /* ---------------------------------------------------------
     ADMIN DAILY NET SALES
     --------------------------------------------------------- */

  const dailyNetElement =
    document.getElementById(
      'adminReportDailyNetSales'
    );

  if (dailyNetElement) {

    dailyNetElement.textContent =
      formatAdminReportMoney(
        adminReportFinance.dailyNetSales
      );

  }


  /* ---------------------------------------------------------
     ADMIN BANK
     --------------------------------------------------------- */

  const bankElement =
    document.getElementById(
      'adminReportBank'
    );

  if (bankElement) {

    bankElement.textContent =
      formatAdminReportMoney(
        adminReportFinance.bank
      );

  }


  /* ---------------------------------------------------------
     ADMIN PROFIT
     --------------------------------------------------------- */

  const profitElement =
    document.getElementById(
      'adminReportProfit'
    );

  if (profitElement) {

    profitElement.textContent =
      formatAdminReportMoney(
        adminReportFinance.profit
      );

  }


  /* =========================================================
     EDIT BUTTON
     ========================================================= */

  const editButton =
    document.getElementById(
      'adminReportEditBtn'
    );


  if (editButton) {

    if (
      canEditAdminReports()
    ) {

      editButton.style.display =
        'inline-block';

    } else {

      editButton.style.display =
        'none';

    }

  }


  /* =========================================================
     RESET BUTTON
     ONLY TUX ADMIN
     ========================================================= */

  const resetButton =
    document.getElementById(
      'adminReportResetBtn'
    );


  if (resetButton) {

    if (
      canResetAdminReports()
    ) {

      resetButton.style.display =
        'inline-block';

    } else {

      resetButton.style.display =
        'none';

    }

  }


  /* =========================================================
     EDIT INPUTS
     ========================================================= */

  const cashInput =
    document.getElementById(
      'adminReportCashInput'
    );

  const instaInput =
    document.getElementById(
      'adminReportInstaPayInput'
    );


  const canEdit =
    canEditAdminReports();


  if (cashInput) {

    cashInput.disabled =
      !canEdit;

  }


  if (instaInput) {

    instaInput.disabled =
      !canEdit;

  }

}


/* =========================================================
   OPEN ADMIN EDIT PANEL
   ========================================================= */

function openAdminReportEditPanel() {

  if (
    !canEditAdminReports()
  ) {

    alert(
      'Only Admin or Tux Admin can edit Admin Reports.'
    );

    return;

  }


  ensureAdminReportFinance();


  const panel =
    document.getElementById(
      'adminReportEditPanel'
    );

  const cashInput =
    document.getElementById(
      'adminReportCashInput'
    );

  const instaInput =
    document.getElementById(
      'adminReportInstaPayInput'
    );


  if (!panel) {

    console.error(
      'adminReportEditPanel was not found.'
    );

    return;

  }


  if (cashInput) {

    cashInput.value =
      Number(
        adminReportFinance.cash || 0
      ).toFixed(2);

  }


  if (instaInput) {

    instaInput.value =
      Number(
        adminReportFinance.instaPay || 0
      ).toFixed(2);

  }


  panel.style.display =
    'block';


  if (cashInput) {

    setTimeout(
      function () {

        cashInput.focus();

        cashInput.select();

      },
      50
    );

  }

}


/* =========================================================
   CLOSE EDIT PANEL
   ========================================================= */

function closeAdminReportEditPanel() {

  const panel =
    document.getElementById(
      'adminReportEditPanel'
    );

  if (panel) {

    panel.style.display =
      'none';

  }

}


/* =========================================================
   SAVE EDIT PANEL
   ========================================================= */

async function saveAdminReportEditPanel() {

  if (
    !canEditAdminReports()
  ) {

    alert(
      'Only Admin or Tux Admin can edit Admin Reports.'
    );

    return;

  }


  const cashInput =
    document.getElementById(
      'adminReportCashInput'
    );

  const instaInput =
    document.getElementById(
      'adminReportInstaPayInput'
    );


  if (
    !cashInput ||
    !instaInput
  ) {

    alert(
      'Admin edit fields were not found.'
    );

    return;

  }


  const cash =
    Number(
      cashInput.value
    );

  const instaPay =
    Number(
      instaInput.value
    );


  if (
    !Number.isFinite(cash) ||
    cash < 0
  ) {

    alert(
      'Admin Cash must be a valid number greater than or equal to 0.'
    );

    cashInput.focus();

    return;

  }


  if (
    !Number.isFinite(instaPay) ||
    instaPay < 0
  ) {

    alert(
      'Admin InstaPay must be a valid number greater than or equal to 0.'
    );

    instaInput.focus();

    return;

  }


  ensureAdminReportFinance();


  adminReportFinance.cash =
    cash;

  adminReportFinance.instaPay =
    instaPay;


  adminReportFinance.dailyNetSales =
    adminReportFinance.cash +
    adminReportFinance.instaPay;


  let overallExpenses =
    0;

  try {

    ensureMonthlyFinance();

    overallExpenses =
      Number(
        monthlyFinance &&
        monthlyFinance.overallExpenses
          ? monthlyFinance.overallExpenses
          : 0
      );

  } catch (error) {

    overallExpenses =
      0;

  }


  adminReportFinance.profit =
    adminReportFinance.bank -
    overallExpenses;


  const saveButton =
    document.querySelector(
      '#adminReportEditPanel button[onclick="saveAdminReportEditPanel()"]'
    );


  if (saveButton) {

    saveButton.disabled =
      true;

    saveButton.textContent =
      'Saving...';

  }


  try {

    await saveAdminReportFinanceToSupabase();

    ensureAdminReportFinance();

    renderAdminReports();

    closeAdminReportEditPanel();

  } catch (error) {

    console.error(
      'saveAdminReportEditPanel error:',
      error
    );

    alert(
      'Failed to save Admin Reports. Please try again.'
    );

  } finally {

    if (saveButton) {

      saveButton.disabled =
        false;

      saveButton.textContent =
        '💾 Save';

    }

  }

}


/* =========================================================
   RESET ADMIN REPORTS
   TUX ADMIN ONLY
   ========================================================= */

async function resetAdminReports() {

  if (
    !canResetAdminReports()
  ) {

    alert(
      'Only Tux Admin can reset Admin Reports.'
    );

    return;

  }


  const confirmed =
    confirm(
      '⚠️ RESET ADMIN REPORTS\n\n' +
      'This will reset ALL Admin Reports for the current month:\n\n' +
      '• Admin Cash → 0\n' +
      '• Admin InstaPay → 0\n' +
      '• Admin Daily Net Sales → 0\n' +
      '• Admin Bank → 0\n' +
      '• Admin Profit → 0\n\n' +
      'This action cannot be undone.\n\n' +
      'Are you sure you want to continue?'
    );


  if (!confirmed) {

    return;

  }


  const resetButton =
    document.getElementById(
      'adminReportResetBtn'
    );


  if (resetButton) {

    resetButton.disabled =
      true;

    resetButton.textContent =
      'Resetting...';

  }


  try {

    ensureAdminReportFinance();


    /* ---------------------------------------------------------
       RESET ALL ADMIN VALUES
       --------------------------------------------------------- */

    adminReportFinance.cash =
      0;

    adminReportFinance.instaPay =
      0;

    adminReportFinance.dailyNetSales =
      0;

    adminReportFinance.bank =
      0;

    adminReportFinance.profit =
      0;


    /* ---------------------------------------------------------
       SAVE RESET TO SUPABASE
       --------------------------------------------------------- */

    await saveAdminReportFinanceToSupabase();


    /* ---------------------------------------------------------
       REFRESH UI
       --------------------------------------------------------- */

    ensureAdminReportFinance();

    renderAdminReports();

    closeAdminReportEditPanel();


    alert(
      'Admin Reports were reset successfully.'
    );

  } catch (error) {

    console.error(
      'resetAdminReports error:',
      error
    );

    alert(
      'Failed to reset Admin Reports. Please try again.'
    );

  } finally {

    if (resetButton) {

      resetButton.disabled =
        false;

      resetButton.textContent =
        '♻ Reset Admin Reports';

    }

  }

}


/* =========================================================
   END SHIFT
   ADMIN BANK ACCUMULATION
   ========================================================= */


/* =========================================================
   TUX POS — UPDATE ADMIN REPORTS AT END SHIFT
   ========================================================= */

async function updateAdminReportsAtEndShift(options = {}) {
try {
/* =======================================================
1. GET THE CLOSED SHIFT DETAILS
======================================================= */

const shiftId = String(
  options.shiftId ||
  currentShift?.supabaseId ||
  currentShift?.id ||
  ''
).trim();

const businessDate = String(
  options.businessDate ||
  currentShift?.businessDate ||
  currentShift?.business_date ||
  ''
).trim();

if (!shiftId) {
  throw new Error(
    'Cannot update Admin Reports: the shift ID is missing.'
  );
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
  throw new Error(
    'Cannot update Admin Reports: the business date is invalid.'
  );
}

const [year, month, day] = businessDate.split('-').map(Number);

const parsedDate = new Date(
  Date.UTC(year, month - 1, day)
);

if (
  parsedDate.getUTCFullYear() !== year ||
  parsedDate.getUTCMonth() !== month - 1 ||
  parsedDate.getUTCDate() !== day
) {
  throw new Error(
    'Cannot update Admin Reports: the business date is invalid.'
  );
}

const monthKey =
  `${year}-${String(month).padStart(2, '0')}`;

/* =======================================================
   2. ENSURE FINANCE OBJECTS EXIST
   ======================================================= */

ensureAdminReportFinance();
ensureMonthlyFinance();

/* =======================================================
   3. CAPTURE DAILY VALUES
   ======================================================= */

const cashAdded = Number(
  adminReportFinance.cash || 0
);

const instaPayAdded = Number(
  adminReportFinance.instaPay || 0
);

if (
  !Number.isFinite(cashAdded) ||
  !Number.isFinite(instaPayAdded) ||
  cashAdded < 0 ||
  instaPayAdded < 0
) {
  throw new Error(
    'Admin Reports contains invalid Cash or InstaPay values.'
  );
}

/* =======================================================
   4. APPLY THE IDEMPOTENT SUPABASE TRANSACTION
   ======================================================= */

const { data, error } = await supabaseClient.rpc(
  'apply_shift_admin_reports_once',
  {
    p_shift_id: shiftId,
    p_month_key: monthKey,
    p_cash_added: cashAdded,
    p_instapay_added: instaPayAdded
  }
);

if (error) {
  console.error(
    'TUX POS — Admin Reports RPC failed:',
    error
  );

  throw error;
}

if (!data || data.success !== true) {
  throw new Error(
    'The Admin Reports transaction returned an unexpected result.'
  );
}

/* =======================================================
   5. RELOAD THE SAVED FINANCE ROW
   ======================================================= */

const {
  data: financeRow,
  error: financeLoadError
} = await supabaseClient
  .from('report_finance')
  .select(`
    admin_cash,
    admin_instapay,
    admin_daily_net_sales,
    admin_bank,
    admin_profit
  `)
  .eq('month_key', monthKey)
  .maybeSingle();

if (financeLoadError) {
  console.error(
    'TUX POS — Admin Reports finance reload failed:',
    financeLoadError
  );

  throw financeLoadError;
}

if (!financeRow) {
  throw new Error(
    `The Admin Reports finance row for ${monthKey} was not found.`
  );
}

/* =======================================================
   6. SYNCHRONIZE LOCAL VALUES
   ======================================================= */

adminReportFinance.cash =
  Number(financeRow.admin_cash || 0);

adminReportFinance.instaPay =
  Number(financeRow.admin_instapay || 0);

adminReportFinance.dailyNetSales =
  Number(financeRow.admin_daily_net_sales || 0);

adminReportFinance.bank =
  Number(financeRow.admin_bank || 0);

adminReportFinance.profit =
  Number(financeRow.admin_profit || 0);

/* =======================================================
   7. REFRESH THE UI
   ======================================================= */

if (typeof renderAdminReports === 'function') {
  renderAdminReports();
}

if (typeof renderSalesReport === 'function') {
  renderSalesReport();
}

console.log(
  'TUX POS — Admin Reports processed:',
  {
    shiftId,
    monthKey,
    alreadyProcessed: data.already_processed === true,
    bank: adminReportFinance.bank,
    profit: adminReportFinance.profit
  }
);

return true;


} catch (error) {
console.error(
'TUX POS — Admin Reports processing failed:',
error
);


return false;


}
}






/* =========================================================
   SNAPSHOT
   ========================================================= */

function addAdminReportFieldsToSnapshot(snapshot) {

  ensureAdminReportFinance();


  if (
    !snapshot ||
    typeof snapshot !== 'object'
  ) {

    return snapshot;

  }


  snapshot.adminReports = {

    cash:
      Number(
        adminReportFinance.cash || 0
      ),

    instaPay:
      Number(
        adminReportFinance.instaPay || 0
      ),

    dailyNetSales:
      Number(
        adminReportFinance.dailyNetSales || 0
      ),

    bank:
      Number(
        adminReportFinance.bank || 0
      ),

    profit:
      Number(
        adminReportFinance.profit || 0
      )

  };


  return snapshot;

}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializeAdminReports() {

  ensureAdminReportFinance();

  renderAdminReports();

  startAdminReportFinanceRealtime();

  await loadAdminReportFinanceFromSupabase();

  renderAdminReports();

}


/* =========================================================
   KEEP ADMIN REPORTS UPDATED WHEN ROLE CHANGES
   ========================================================= */

function refreshAdminReportsPermissions() {

  try {

    renderAdminReports();

  } catch (error) {

    console.error(
      'refreshAdminReportsPermissions error:',
      error
    );

  }

}


/* =========================================================
   AUTO INITIALIZATION
   ========================================================= */

if (
  document.readyState === 'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    function () {

      initializeAdminReports();

    }
  );

} else {

  initializeAdminReports();

}