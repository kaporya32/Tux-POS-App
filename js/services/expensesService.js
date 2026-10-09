/* =========================================================
   TUX POS — EXPENSES SERVICE
   Supabase persistence for expenses.
   ========================================================= */


/* =========================================================
   ADMIN VIEW-ONLY PROTECTION
   ========================================================= */

function isTuxPosExpensesAdminReadOnly() {

  return (
    typeof adminActive !== 'undefined' &&
    adminActive === true &&
    !(
      typeof tuxAdminActive !== 'undefined' &&
      tuxAdminActive === true
    )
  );

}


function blockTuxPosExpensesMutation(
  action
) {

  if (!isTuxPosExpensesAdminReadOnly()) {

    return false;

  }


  alert(
    'Admin is view-only. You cannot ' +
    action +
    '.'
  );


  return true;

}


/* =========================================================
   EXPENSES REALTIME
   ========================================================= */

let expensesRealtimeChannel = null;
let expensesRealtimeRefreshTimer = null;


/* =========================================================
   START EXPENSES REALTIME
   ========================================================= */

function startExpensesRealtime() {

  if (expensesRealtimeChannel) {

    supabaseClient.removeChannel(
      expensesRealtimeChannel
    );

    expensesRealtimeChannel = null;

  }


  expensesRealtimeChannel =
    supabaseClient

      .channel('tux-expenses-realtime')

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses'
        },

        function (payload) {

          console.log(
            'TUX POS — Expenses realtime event:',
            payload.eventType,
            payload
          );

          scheduleExpensesRealtimeRefresh();

        }
      )

      .subscribe(function (status) {

        console.log(
          'TUX POS — Expenses realtime status:',
          status
        );

      });

}


/* =========================================================
   SCHEDULE EXPENSES REALTIME REFRESH
   ========================================================= */

function scheduleExpensesRealtimeRefresh() {

  if (expensesRealtimeRefreshTimer) {

    clearTimeout(
      expensesRealtimeRefreshTimer
    );

  }


  expensesRealtimeRefreshTimer =
    setTimeout(
      async function () {

        expensesRealtimeRefreshTimer = null;


        try {

          await loadExpensesFromSupabase();


          if (
            typeof populateExpenseStockSelect ===
            'function'
          ) {

            populateExpenseStockSelect();

          }


          if (
            typeof renderExpensesTable ===
            'function'
          ) {

            renderExpensesTable();

          }


          if (
            typeof refreshReportsFromSupabase ===
            'function'
          ) {

            await refreshReportsFromSupabase();

          }


          if (
            typeof renderSalesReport ===
            'function'
          ) {

            renderSalesReport();

          }


          window.dispatchEvent(
            new CustomEvent(
              'tux-expenses-realtime-updated'
            )
          );


          console.log(
            'TUX POS — Expenses refreshed after realtime event.'
          );

        } catch (error) {

          console.error(
            'TUX POS — Failed to refresh expenses after realtime event:',
            error
          );

        }

      },
      300
    );

}


/* =========================================================
   STOP EXPENSES REALTIME
   ========================================================= */

function stopExpensesRealtime() {

  if (expensesRealtimeRefreshTimer) {

    clearTimeout(
      expensesRealtimeRefreshTimer
    );

    expensesRealtimeRefreshTimer = null;

  }


  if (!expensesRealtimeChannel) {

    return;

  }


  supabaseClient.removeChannel(
    expensesRealtimeChannel
  );


  expensesRealtimeChannel = null;


  console.log(
    'TUX POS — Expenses realtime stopped.'
  );

}


/* =========================================================
   LOAD EXPENSES
   ========================================================= */

async function loadExpensesFromSupabase() {

  try {

    const { data, error } =
      await supabaseClient
        .from('expenses')
        .select('*')
        .order('created_at', {
          ascending: false
        });


    if (error) {

      console.error(
        'TUX POS — Failed to load expenses:',
        error
      );

      expensesList = [];

      return [];

    }


    expensesList =
      (data || []).map(
        function (expense) {

          const createdAt =
            expense.created_at
              ? new Date(
                  expense.created_at
                )
              : new Date();


          return {

            id:
              expense.id,

            supabaseId:
              expense.id,

            shiftId:
              expense.shift_id || null,

            name:
              expense.name || '',

            category:
              expense.category || '',

            cost:
              Number(
                expense.cost || 0
              ),

            qty:
              expense.quantity !== null &&
              expense.quantity !== undefined
                ? Number(
                    expense.quantity
                  )
                : 0,

            quantity:
              expense.quantity !== null &&
              expense.quantity !== undefined
                ? Number(
                    expense.quantity
                  )
                : 0,

            unit:
              expense.unit || '',

            workerId:
              expense.worker_id || null,

            notes:
              expense.notes || '',

            time:
              createdAt.toLocaleTimeString(
                [],
                {
                  hour: '2-digit',
                  minute: '2-digit'
                }
              ),

            date:
              createdAt.toLocaleDateString(),

            createdAt:
              expense.created_at

          };

        }
      );


    return expensesList;

  }

  catch (error) {

    console.error(
      'TUX POS — Expense loading failed:',
      error
    );

    expensesList = [];

    return [];

  }

}


/* =========================================================
   CREATE EXPENSE
   ========================================================= */

async function createExpenseInSupabase(
  expenseData
) {

  if (
    blockTuxPosExpensesMutation(
      'add expenses'
    )
  ) {

    return null;

  }


  try {

    if (
      !expenseData ||
      !expenseData.name
    ) {

      alert(
        'Expense name is required.'
      );

      return null;

    }


    let shiftId = null;


    if (
      currentShift &&
      currentShift.supabaseId
    ) {

      shiftId =
        currentShift.supabaseId;

    }


    let workerId = null;


    const activeWorkers =
      typeof getActiveWorkers === 'function'
        ? getActiveWorkers()
        : [];


    if (
      activeWorkers &&
      activeWorkers.length > 0 &&
      activeWorkers[0] &&
      activeWorkers[0].id
    ) {

      workerId =
        activeWorkers[0].id;

    }


    const payload = {

      shift_id:
        shiftId,

      name:
        String(
          expenseData.name
        ).trim(),

      category:
        expenseData.category ||
        null,

      cost:
        Number(
          expenseData.cost || 0
        ),

      quantity:
        expenseData.quantity !== undefined &&
        expenseData.quantity !== null &&
        expenseData.quantity !== ''
          ? Number(
              expenseData.quantity
            )
          : null,

      unit:
        expenseData.unit ||
        null,

      worker_id:
        workerId,

      notes:
        expenseData.notes ||
        null

    };


    const { data, error } =
      await supabaseClient
        .from('expenses')
        .insert(payload)
        .select('*')
        .single();


    if (error) {

      console.error(
        'TUX POS — Failed to create expense:',
        error
      );

      alert(
        'Could not save the expense in Supabase.\n\n' +
        error.message
      );

      return null;

    }


    const createdAt =
      data.created_at
        ? new Date(
            data.created_at
          )
        : new Date();


    const expenseRecord = {

      id:
        data.id,

      supabaseId:
        data.id,

      shiftId:
        data.shift_id || null,

      name:
        data.name || '',

      category:
        data.category || '',

      cost:
        Number(
          data.cost || 0
        ),

      qty:
        data.quantity !== null &&
        data.quantity !== undefined
          ? Number(
              data.quantity
            )
          : 0,

      quantity:
        data.quantity !== null &&
        data.quantity !== undefined
          ? Number(
              data.quantity
            )
          : 0,

      unit:
        data.unit || '',

      workerId:
        data.worker_id || null,

      notes:
        data.notes || '',

      time:
        createdAt.toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit'
          }
        ),

      date:
        createdAt.toLocaleDateString(),

      createdAt:
        data.created_at

    };


    expensesList.unshift(
      expenseRecord
    );


    return expenseRecord;

  }

  catch (error) {

    console.error(
      'TUX POS — Expense creation failed:',
      error
    );

    alert(
      'Could not save the expense.\n\n' +
      error.message
    );

    return null;

  }

}


/* =========================================================
   DELETE ONE EXPENSE
   ========================================================= */

async function deleteExpenseFromSupabase(
  expenseId
) {

  if (
    blockTuxPosExpensesMutation(
      'delete expenses'
    )
  ) {

    return false;

  }


  if (!expenseId) {

    return false;

  }


  try {

    const { error } =
      await supabaseClient
        .from('expenses')
        .delete()
        .eq('id', expenseId);


    if (error) {

      console.error(
        'TUX POS — Failed to delete expense:',
        error
      );

      alert(
        'Could not delete the expense.\n\n' +
        error.message
      );

      return false;

    }


    expensesList =
      expensesList.filter(
        function (expense) {

          return (
            expense.id !== expenseId &&
            expense.supabaseId !== expenseId
          );

        }
      );


    return true;

  }

  catch (error) {

    console.error(
      'TUX POS — Expense deletion failed:',
      error
    );

    alert(
      'Could not delete the expense.\n\n' +
      error.message
    );

    return false;

  }

}


/* =========================================================
   DELETE ALL EXPENSES
   TUX ADMIN ONLY
   ========================================================= */

async function deleteAllExpensesFromSupabase() {

  if (
    typeof tuxAdminActive === 'undefined' ||
    tuxAdminActive !== true
  ) {

    alert(
      'Only Tux Admin can delete all expenses and purchases.'
    );

    return false;

  }


  if (
    !expensesList ||
    expensesList.length === 0
  ) {

    alert(
      'There are no expenses or purchases to delete.'
    );

    return false;

  }


  const confirmed =
    confirm(
      'WARNING!\n\n' +
      'This will permanently delete ALL expenses and purchases from the Expenses table.\n\n' +
      'This action cannot be undone.\n\n' +
      'Are you sure you want to continue?'
    );


  if (!confirmed) {

    return false;

  }


  try {

    const { error } =
      await supabaseClient
        .from('expenses')
        .delete()
        .not('id', 'is', null);


    if (error) {

      console.error(
        'TUX POS — Failed to delete all expenses:',
        error
      );

      alert(
        'Could not delete all expenses.\n\n' +
        error.message
      );

      return false;

    }


    expensesList = [];


    if (
      typeof renderExpensesTable ===
      'function'
    ) {

      renderExpensesTable();

    }


    if (
      typeof populateExpenseStockSelect ===
      'function'
    ) {

      populateExpenseStockSelect();

    }


    if (
      typeof refreshReportsFromSupabase ===
      'function'
    ) {

      await refreshReportsFromSupabase();

    }


    if (
      typeof renderSalesReport ===
      'function'
    ) {

      renderSalesReport();

    }


    window.dispatchEvent(
      new CustomEvent(
        'tux-expenses-all-deleted'
      )
    );


    alert(
      'All expenses and purchases have been deleted successfully.'
    );


    return true;

  }

  catch (error) {

    console.error(
      'TUX POS — Delete all expenses failed:',
      error
    );

    alert(
      'Could not delete all expenses.\n\n' +
      error.message
    );

    return false;

  }

}


/* =========================================================
   LOAD CURRENT SHIFT EXPENSES
   ========================================================= */

async function loadCurrentShiftExpensesFromSupabase() {

  try {

    if (
      !currentShift ||
      !currentShift.supabaseId
    ) {

      expensesList = [];

      return [];

    }


    const { data, error } =
      await supabaseClient
        .from('expenses')
        .select('*')
        .eq(
          'shift_id',
          currentShift.supabaseId
        )
        .order('created_at', {
          ascending: false
        });


    if (error) {

      console.error(
        'TUX POS — Failed to load current shift expenses:',
        error
      );

      expensesList = [];

      return [];

    }


    expensesList =
      (data || []).map(
        function (expense) {

          const createdAt =
            expense.created_at
              ? new Date(
                  expense.created_at
                )
              : new Date();


          return {

            id:
              expense.id,

            supabaseId:
              expense.id,

            shiftId:
              expense.shift_id || null,

            name:
              expense.name || '',

            category:
              expense.category || '',

            cost:
              Number(
                expense.cost || 0
              ),

            qty:
              expense.quantity !== null &&
              expense.quantity !== undefined
                ? Number(
                    expense.quantity
                  )
                : 0,

            quantity:
              expense.quantity !== null &&
              expense.quantity !== undefined
                ? Number(
                    expense.quantity
                  )
                : 0,

            unit:
              expense.unit || '',

            workerId:
              expense.worker_id || null,

            notes:
              expense.notes || '',

            time:
              createdAt.toLocaleTimeString(
                [],
                {
                  hour: '2-digit',
                  minute: '2-digit'
                }
              ),

            date:
              createdAt.toLocaleDateString(),

            createdAt:
              expense.created_at

          };

        }
      );


    return expensesList;

  }

  catch (error) {

    console.error(
      'TUX POS — Current shift expense loading failed:',
      error
    );

    expensesList = [];

    return [];

  }

}


/* =========================================================
   SAVE CURRENT EXPENSE DATA
   Compatibility helper
   ========================================================= */

async function saveExpenseData() {

  return true;

}