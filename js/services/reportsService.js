/* =========================================================
   TUX POS — REPORTS SERVICE
   Loads historical sales and expenses from Supabase.
   Keeps historical report data separate from current-shift
   operational data.
   ========================================================= */


/* =========================================================
   REPORT STATE
   ========================================================= */

let reportSales = [];

let reportExpenses = [];


/* =========================================================
   REPORTS REALTIME
   ========================================================= */

let reportsRealtimeChannel = null;

let reportsRealtimeStarted = false;

let reportsRealtimeRefreshTimer = null;


/* =========================================================
   LOAD ALL SALES
   ========================================================= */

async function loadReportSalesFromSupabase() {

  try {

    const { data, error } =
      await supabaseClient
        .from('orders')
        .select(`
          id,
          order_number,
          shift_id,
          staff_id,
          staff_name,
          total,
          cash_paid,
          insta_paid,
          visa_paid,
          discount,
          status,
          created_at,
          completed_at,
          order_items (
            id,
            menu_item_id,
            name,
            price,
            quantity,
            extras,
            created_at
          )
        `)
        .order('created_at', {
          ascending: false
        });


    if (error) {

      console.error(
        'TUX POS — Failed to load report sales:',
        error
      );

      reportSales = [];

      return [];

    }


    reportSales =
      (data || []).map(
        function (order) {

          const createdAt =
            order.created_at
              ? new Date(order.created_at)
              : new Date();


          const items =
            (order.order_items || [])
              .map(function (item) {

                return {

                  id:
                    item.id,

                  menuItemId:
                    item.menu_item_id || null,

                  name:
                    item.name || '',

                  price:
                    Number(
                      item.price || 0
                    ),

                  qty:
                    Number(
                      item.quantity || 0
                    ),

                  quantity:
                    Number(
                      item.quantity || 0
                    ),

                  extras:
                    item.extras || []

                };

              });


          return {

            id:
              order.id,

            supabaseId:
              order.id,

            orderNum:
              Number(
                order.order_number || 0
              ),

            orderNumber:
              Number(
                order.order_number || 0
              ),

            shiftId:
              order.shift_id || null,

            staffId:
              order.staff_id || null,

            staffName:
              order.staff_name || '-',

            total:
              Number(
                order.total || 0
              ),

            cashPaid:
              Number(
                order.cash_paid || 0
              ),

            instaPaid:
              Number(
                order.insta_paid || 0
              ),

            visaPaid:
              Number(
                order.visa_paid || 0
              ),

            discount:
              Number(
                order.discount || 0
              ),

            status:
              order.status || 'preparing',

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
              order.created_at,

            completedAt:
              order.completed_at || null,

            items:
              items

          };

        }
      );


    return reportSales;

  }

  catch (error) {

    console.error(
      'TUX POS — Report sales loading failed:',
      error
    );

    reportSales = [];

    return [];

  }

}


/* =========================================================
   LOAD ALL EXPENSES
   ========================================================= */

async function loadReportExpensesFromSupabase() {

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
        'TUX POS — Failed to load report expenses:',
        error
      );

      reportExpenses = [];

      return [];

    }


    reportExpenses =
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

            stockKey:
              expense.stock_key || null,

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


    return reportExpenses;

  }

  catch (error) {

    console.error(
      'TUX POS — Report expenses loading failed:',
      error
    );

    reportExpenses = [];

    return [];

  }

}


/* =========================================================
   LOAD ALL REPORT DATA
   ========================================================= */

async function loadReportsFromSupabase() {

  console.log(
    'TUX POS — Loading historical report data...'
  );


  const sales =
    await loadReportSalesFromSupabase();


  const expenses =
    await loadReportExpensesFromSupabase();


  console.log(
    'TUX POS — Historical report sales loaded:',
    sales.length
  );


  console.log(
    'TUX POS — Historical report expenses loaded:',
    expenses.length
  );


  return {

    sales:
      sales,

    expenses:
      expenses

  };

}


/* =========================================================
   GET CURRENT SHIFT SALES FOR REPORTS
   ========================================================= */

function getReportSalesForCurrentShift() {

  if (
    !currentShift ||
    !currentShift.supabaseId
  ) {

    return [];

  }


  return reportSales.filter(
    function (order) {

      return (
        order.shiftId ===
        currentShift.supabaseId
      );

    }
  );

}


/* =========================================================
   GET CURRENT SHIFT EXPENSES FOR REPORTS
   ========================================================= */

function getReportExpensesForCurrentShift() {

  if (
    !currentShift ||
    !currentShift.supabaseId
  ) {

    return [];

  }


  return reportExpenses.filter(
    function (expense) {

      return (
        expense.shiftId ===
        currentShift.supabaseId
      );

    }
  );

}


/* =========================================================
   GET CURRENT SHIFT DONE SALES
   ========================================================= */

function getCurrentShiftDoneSalesForReport() {

  return getReportSalesForCurrentShift()
    .filter(
      function (order) {

        return (
          order.status ===
          'done'
        );

      }
    );

}


/* =========================================================
   GET CURRENT SHIFT EXPENSES
   ========================================================= */

function getCurrentShiftExpensesForReport() {

  return getReportExpensesForCurrentShift();

}


/* =========================================================
   TOTAL SALES
   Cash + InstaPay
   CURRENT SHIFT ONLY
   ========================================================= */

function getReportTotalSales() {

  const sales =
    getCurrentShiftDoneSalesForReport();


  return sales.reduce(
    function (total, order) {

      return (
        total +
        Number(
          order.cashPaid || 0
        ) +
        Number(
          order.instaPaid || 0
        )
      );

    },
    0
  );

}


/* =========================================================
   TOTAL CASH
   CURRENT SHIFT ONLY
   ========================================================= */

function getReportTotalCash() {

  const sales =
    getCurrentShiftDoneSalesForReport();


  return sales.reduce(
    function (total, order) {

      return (
        total +
        Number(
          order.cashPaid || 0
        )
      );

    },
    0
  );

}


/* =========================================================
   TOTAL INSTAPAY
   CURRENT SHIFT ONLY
   ========================================================= */

function getReportTotalInsta() {

  const sales =
    getCurrentShiftDoneSalesForReport();


  return sales.reduce(
    function (total, order) {

      return (
        total +
        Number(
          order.instaPaid || 0
        )
      );

    },
    0
  );

}


/* =========================================================
   TOTAL VISA
   CURRENT SHIFT ONLY
   ========================================================= */

function getReportTotalVisa() {

  const sales =
    getCurrentShiftDoneSalesForReport();


  return sales.reduce(
    function (total, order) {

      return (
        total +
        Number(
          order.visaPaid || 0
        )
      );

    },
    0
  );

}


/* =========================================================
   TOTAL DISCOUNT
   CURRENT SHIFT ONLY
   ========================================================= */

function getReportTotalDiscount() {

  const sales =
    getCurrentShiftDoneSalesForReport();


  return sales.reduce(
    function (total, order) {

      return (
        total +
        Number(
          order.discount || 0
        )
      );

    },
    0
  );

}


/* =========================================================
   TOTAL ORDERS
   CURRENT SHIFT ONLY
   ========================================================= */

function getReportTotalOrders() {

  const sales =
    getCurrentShiftDoneSalesForReport();


  return sales.length;

}


/* =========================================================
   TOTAL EXPENSES
   CURRENT SHIFT ONLY
   ========================================================= */

function getReportTotalExpenses() {

  const expenses =
    getCurrentShiftExpensesForReport();


  return expenses.reduce(
    function (total, expense) {

      return (
        total +
        Number(
          expense.cost || 0
        )
      );

    },
    0
  );

}


/* =========================================================
   TOTAL HURRY APP
   Visa + Discount
   CURRENT SHIFT ONLY
   ========================================================= */

function getReportTotalHurryApp() {

  return (
    getReportTotalVisa() +
    getReportTotalDiscount()
  );

}


/* =========================================================
   CLEAR CURRENT REPORT VIEW
   ========================================================= */

function clearCurrentShiftReportView() {

  /*
   * We intentionally keep reportSales and reportExpenses
   * because they contain historical Supabase data.
   *
   * The functions above use currentShift.supabaseId,
   * so when currentShift becomes null after End Shift,
   * all Daily Report totals automatically become zero.
   */

  if (
    typeof renderSalesReport ===
    'function'
  ) {

    renderSalesReport();

  }

}


/* =========================================================
   REALTIME REFRESH
   Prevents several rapid database events from causing
   several full report reloads at the exact same moment.
   ========================================================= */

function scheduleReportsRealtimeRefresh() {

  if (reportsRealtimeRefreshTimer) {

    clearTimeout(
      reportsRealtimeRefreshTimer
    );

  }


  reportsRealtimeRefreshTimer =
    setTimeout(
      async function () {

        reportsRealtimeRefreshTimer =
          null;

        await refreshReportsFromSupabase();

      },
      150
    );

}


/* =========================================================
   START REPORTS REALTIME
   ========================================================= */

function subscribeToReportsRealtime() {

  if (reportsRealtimeStarted) {

    console.log(
      'TUX POS — Reports Realtime already active.'
    );

    return;

  }


  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {

    console.error(
      'TUX POS — Supabase client is not available for Reports Realtime.'
    );

    return;

  }


  reportsRealtimeStarted = true;


  reportsRealtimeChannel =
    supabaseClient
      .channel('tux-pos-reports-realtime')


      /* =====================================================
         ORDERS
         ===================================================== */

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        function (payload) {

          console.log(
            'TUX POS — Reports Realtime order change:',
            payload.eventType
          );

          scheduleReportsRealtimeRefresh();

        }
      )


      /* =====================================================
         EXPENSES
         ===================================================== */

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses'
        },
        function (payload) {

          console.log(
            'TUX POS — Reports Realtime expense change:',
            payload.eventType
          );

          scheduleReportsRealtimeRefresh();

        }
      )


      .subscribe(
        function (status) {

          console.log(
            'TUX POS — Reports Realtime status:',
            status
          );


          if (
            status === 'SUBSCRIBED'
          ) {

            console.log(
              'TUX POS — Reports Realtime connected.'
            );

          }


          if (
            status === 'CHANNEL_ERROR'
          ) {

            console.error(
              'TUX POS — Reports Realtime channel error.'
            );

          }


          if (
            status === 'TIMED_OUT'
          ) {

            console.error(
              'TUX POS — Reports Realtime connection timed out.'
            );

          }

        }
      );

}


/* =========================================================
   STOP REPORTS REALTIME
   ========================================================= */

async function unsubscribeFromReportsRealtime() {

  if (
    reportsRealtimeRefreshTimer
  ) {

    clearTimeout(
      reportsRealtimeRefreshTimer
    );

    reportsRealtimeRefreshTimer =
      null;

  }


  if (
    reportsRealtimeChannel
  ) {

    try {

      await supabaseClient.removeChannel(
        reportsRealtimeChannel
      );

    }

    catch (error) {

      console.error(
        'TUX POS — Failed to remove Reports Realtime channel:',
        error
      );

    }

  }


  reportsRealtimeChannel =
    null;

  reportsRealtimeStarted =
    false;


  console.log(
    'TUX POS — Reports Realtime stopped.'
  );

}


/* =========================================================
   REFRESH REPORT DATA
   ========================================================= */

async function refreshReportsFromSupabase() {

  await loadReportsFromSupabase();


  if (
    typeof renderSalesReport ===
    'function'
  ) {

    renderSalesReport();

  }


  if (
    typeof renderShiftHistory ===
    'function'
  ) {

    renderShiftHistory();

  }

}


/* =========================================================
   START REPORTS REALTIME AUTOMATICALLY
   ========================================================= */

subscribeToReportsRealtime();