/* =========================================================
   TUX POS — GAMIYA SERVICE
   Supabase persistence + Realtime for Gam3ya staff meals.
   ========================================================= */


/* =========================================================
   ADMIN VIEW-ONLY PROTECTION
   ========================================================= */

function isTuxPosGamiyaAdminReadOnly() {

  return (
    typeof adminActive !== 'undefined' &&
    adminActive === true &&
    !(
      typeof tuxAdminActive !== 'undefined' &&
      tuxAdminActive === true
    )
  );

}


function blockTuxPosGamiyaMutation(action) {

  /*
    ONLY normal Admin is view-only.

    Worker:
      allowed

    Tux Admin:
      allowed

    Admin:
      blocked
  */

  if (!isTuxPosGamiyaAdminReadOnly()) {

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
   GAMIYA REALTIME
   ========================================================= */

let gamiyaRealtimeChannel =
  null;

let gamiyaRealtimeRefreshTimer =
  null;


/* =========================================================
   CONVERT SUPABASE RECORDS TO APP RECORDS
   ========================================================= */

function mapGamiyaRecords(
  orders,
  items
) {

  const safeOrders =
    Array.isArray(orders)
      ? orders
      : [];


  const safeItems =
    Array.isArray(items)
      ? items
      : [];


  return safeOrders.map(
    function (order) {

      const orderItems =
        safeItems
          .filter(
            function (item) {

              return String(
                item.gamiya_order_id
              ) ===
                String(
                  order.id
                );

            }
          )
          .map(
            function (item) {

              return {

                id:
                  item.id,

                name:
                  item.name,

                price:
                  Number(
                    item.price || 0
                  ),

                qty:
                  Number(
                    item.quantity || 0
                  )

              };

            }
          );


      const createdAt =
        order.created_at
          ? new Date(
            order.created_at
          )
          : new Date();


      return {

        id:
          order.id,

        supabaseId:
          order.id,

        shiftId:
          order.shift_id || null,

        workerId:
          order.worker_id || null,

        workerName:
          order.worker_name || '',

        items:
          orderItems,

        total:
          Number(
            order.total || 0
          ),

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
          order.created_at || null

      };

    }
  );

}


/* =========================================================
   LOAD GAMIYA FROM SUPABASE
   ========================================================= */

async function loadGamiyaFromSupabase() {

  try {

    const {
      data: orders,
      error: ordersError
    } =
      await supabaseClient
        .from('gamiya_orders')
        .select('*')
        .order(
          'created_at',
          {
            ascending: false
          }
        );


    if (ordersError) {

      console.error(
        'TUX POS — Failed to load Gam3ya orders:',
        ordersError
      );

      gamiyaOrders =
        [];

      return gamiyaOrders;
    }


    const orderRows =
      orders || [];


    if (
      orderRows.length === 0
    ) {

      gamiyaOrders =
        [];

      return gamiyaOrders;
    }


    const orderIds =
      orderRows.map(
        function (order) {

          return order.id;

        }
      );


    const {
      data: items,
      error: itemsError
    } =
      await supabaseClient
        .from('gamiya_order_items')
        .select('*')
        .in(
          'gamiya_order_id',
          orderIds
        );


    if (itemsError) {

      console.error(
        'TUX POS — Failed to load Gam3ya items:',
        itemsError
      );

      gamiyaOrders =
        [];

      return gamiyaOrders;
    }


    gamiyaOrders =
      mapGamiyaRecords(
        orderRows,
        items || []
      );


    console.log(
      'TUX POS — Gam3ya loaded:',
      gamiyaOrders
    );


    return gamiyaOrders;

  }

  catch (error) {

    console.error(
      'TUX POS — Gam3ya load failed:',
      error
    );

    gamiyaOrders =
      [];

    return gamiyaOrders;

  }

}


/* =========================================================
   SAVE GAMIYA ORDER
   Worker ALLOWED
   Tux Admin ALLOWED
   Normal Admin BLOCKED
   ========================================================= */

async function saveGamiyaToSupabase(
  record
) {

  /*
    IMPORTANT:

    Worker is NOT blocked here.

    Only normal Admin is blocked.
  */

  if (
    blockTuxPosGamiyaMutation(
      'register Gam3ya meals'
    )
  ) {

    return null;
  }


  if (!record) {

    return null;
  }


  try {

    /*
      worker_id must be a UUID.

      For normal workers:
        store worker UUID.

      For admin_account:
        store NULL and keep admin name
        in worker_name.
    */

    const workerId =
      record.workerId &&
        String(record.workerId) !==
        'admin_account'

        ? record.workerId

        : null;


    const orderPayload = {

      worker_id:
        workerId,

      worker_name:
        record.workerName || null,

      shift_id:
        record.shiftId || null,

      total:
        Number(
          record.total || 0
        )

    };


    const {
      data: order,
      error: orderError
    } =
      await supabaseClient
        .from('gamiya_orders')
        .insert(
          orderPayload
        )
        .select('*')
        .single();


    if (orderError) {

      console.error(
        'TUX POS — Failed to save Gam3ya order:',
        orderError
      );


      alert(
        'Could not save the Gam3ya order in Supabase.\n\n' +
        orderError.message
      );


      return null;
    }


    const items =
      Array.isArray(record.items)
        ? record.items
        : [];


    if (
      items.length === 0
    ) {

      await supabaseClient
        .from('gamiya_orders')
        .delete()
        .eq(
          'id',
          order.id
        );


      alert(
        'Cannot save an empty Gam3ya meal.'
      );


      return null;
    }


    const itemPayload =
      items.map(
        function (item) {

          return {

            gamiya_order_id:
              order.id,

            name:
              item.name,

            price:
              Number(
                item.price || 0
              ),

            quantity:
              Number(
                item.qty || 0
              )

          };

        }
      );


    const {
      error: itemsError
    } =
      await supabaseClient
        .from('gamiya_order_items')
        .insert(
          itemPayload
        );


    if (itemsError) {

      console.error(
        'TUX POS — Failed to save Gam3ya items:',
        itemsError
      );


      await supabaseClient
        .from('gamiya_orders')
        .delete()
        .eq(
          'id',
          order.id
        );


      alert(
        'Could not save the Gam3ya meal items.\n\n' +
        itemsError.message
      );


      return null;
    }


    /*
      Build the local record.

      Keep the ORIGINAL workerId here.

      This is important because the Admin
      Gam3ya filter needs the worker UUID.
    */

    const savedRecord = {

      id:
        order.id,

      supabaseId:
        order.id,

      shiftId:
        order.shift_id || null,

      workerId:
        record.workerId || null,

      workerName:
        order.worker_name || '',

      items:
        items.map(
          function (item) {

            return {

              name:
                item.name,

              price:
                Number(
                  item.price || 0
                ),

              qty:
                Number(
                  item.qty || 0
                )

            };

          }
        ),

      total:
        Number(
          order.total || 0
        ),

      time:
        order.created_at
          ? new Date(
            order.created_at
          ).toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit'
            }
          )
          : new Date().toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit'
            }
          ),

      date:
        order.created_at
          ? new Date(
            order.created_at
          ).toLocaleDateString()
          : new Date().toLocaleDateString(),

      createdAt:
        order.created_at || null

    };


    /*
      Keep local state updated.

      The Worker will not see the page because
      renderGamiyaView() is protected.

      Admin/Tux Admin can see the record.
    */

    gamiyaOrders =
      [
        savedRecord,
        ...(Array.isArray(gamiyaOrders)
          ? gamiyaOrders
          : [])
      ];


    /*
      Only render the Gam3ya UI if the
      current account is allowed to view it.
    */

    if (
      typeof getActiveRole !== 'function' ||
      getActiveRole() === 'admin' ||
      getActiveRole() === 'tuxadmin'
    ) {

      if (
        typeof renderGamiyaView === 'function'
      ) {

        renderGamiyaView();

      }


      if (
        typeof renderGamiyaReport === 'function'
      ) {

        renderGamiyaReport();

      }

    }


    console.log(
      'TUX POS — Gam3ya order saved:',
      savedRecord
    );


    return savedRecord;

  }

  catch (error) {

    console.error(
      'TUX POS — Gam3ya save failed:',
      error
    );


    alert(
      'Could not save the Gam3ya meal.\n\n' +
      error.message
    );


    return null;

  }

}


/* =========================================================
   RESET GAMIYA IN SUPABASE
   TUX ADMIN ONLY
   ========================================================= */

async function resetGamiyaInSupabase() {

  if (
    typeof getActiveRole === 'function' &&
    getActiveRole() !== 'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can reset Gam3ya.'
    );

    return false;
  }


  try {

    const {
      data: orders,
      error: ordersError
    } =
      await supabaseClient
        .from('gamiya_orders')
        .select('id');


    if (ordersError) {

      console.error(
        'TUX POS — Failed to load Gam3ya IDs for reset:',
        ordersError
      );


      alert(
        'Could not reset Gam3ya.\n\n' +
        ordersError.message
      );


      return false;
    }


    const orderIds =
      (orders || [])
        .map(
          function (order) {

            return order.id;

          }
        );


    if (
      orderIds.length === 0
    ) {

      gamiyaOrders =
        [];


      renderGamiyaView();


      if (
        typeof renderGamiyaReport === 'function'
      ) {

        renderGamiyaReport();

      }


      return true;
    }


    /*
      Delete child items first.
    */

    const {
      error: itemsDeleteError
    } =
      await supabaseClient
        .from('gamiya_order_items')
        .delete()
        .in(
          'gamiya_order_id',
          orderIds
        );


    if (itemsDeleteError) {

      console.error(
        'TUX POS — Failed to delete Gam3ya items:',
        itemsDeleteError
      );


      alert(
        'Could not reset Gam3ya items.\n\n' +
        itemsDeleteError.message
      );


      return false;
    }


    /*
      Delete parent orders.
    */

    const {
      error: ordersDeleteError
    } =
      await supabaseClient
        .from('gamiya_orders')
        .delete()
        .in(
          'id',
          orderIds
        );


    if (ordersDeleteError) {

      console.error(
        'TUX POS — Failed to delete Gam3ya orders:',
        ordersDeleteError
      );


      alert(
        'Could not reset Gam3ya orders.\n\n' +
        ordersDeleteError.message
      );


      return false;
    }


    gamiyaOrders =
      [];


    renderGamiyaView();


    if (
      typeof renderGamiyaReport === 'function'
    ) {

      renderGamiyaReport();

    }


    console.log(
      'TUX POS — Gam3ya reset completed.'
    );


    return true;

  }

  catch (error) {

    console.error(
      'TUX POS — Gam3ya reset failed:',
      error
    );


    alert(
      'Could not reset Gam3ya.\n\n' +
      error.message
    );


    return false;

  }

}


/* =========================================================
   REFRESH AFTER REALTIME
   ========================================================= */

function scheduleGamiyaRealtimeRefresh() {

  clearTimeout(
    gamiyaRealtimeRefreshTimer
  );


  gamiyaRealtimeRefreshTimer =
    setTimeout(
      async function () {

        try {

          await loadGamiyaFromSupabase();


          /*
            Only Admin/Tux Admin should
            refresh the Gam3ya UI.
          */

          const canViewGamiya =
            typeof getActiveRole !== 'function' ||
            getActiveRole() === 'admin' ||
            getActiveRole() === 'tuxadmin';


          if (canViewGamiya) {

            if (
              typeof renderGamiyaView === 'function'
            ) {

              renderGamiyaView();

            }


            if (
              typeof renderGamiyaReport === 'function'
            ) {

              renderGamiyaReport();

            }

          }


          console.log(
            'TUX POS — Gam3ya UI refreshed after Realtime change.'
          );

        }

        catch (error) {

          console.error(
            'TUX POS — Failed to refresh Gam3ya after Realtime event:',
            error
          );

        }

      },
      250
    );

}


/* =========================================================
   START GAMIYA REALTIME
   ========================================================= */

function startGamiyaRealtime() {

  if (
    typeof supabaseClient === 'undefined'
  ) {

    console.error(
      'TUX POS — Supabase client is not available for Gam3ya Realtime.'
    );

    return;
  }


  if (gamiyaRealtimeChannel) {

    console.log(
      'TUX POS — Gam3ya Realtime is already running.'
    );

    return;
  }


  console.log(
    'TUX POS — Starting Gam3ya Realtime...'
  );


  gamiyaRealtimeChannel =
    supabaseClient
      .channel(
        'tux-gamiya-realtime'
      )


      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gamiya_orders'
        },
        function (payload) {

          console.log(
            'TUX POS — Gam3ya orders Realtime event:',
            payload.eventType,
            payload
          );


          scheduleGamiyaRealtimeRefresh();

        }
      )


      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gamiya_order_items'
        },
        function (payload) {

          console.log(
            'TUX POS — Gam3ya items Realtime event:',
            payload.eventType,
            payload
          );


          scheduleGamiyaRealtimeRefresh();

        }
      )


      .subscribe(
        function (status) {

          console.log(
            'TUX POS — Gam3ya Realtime status:',
            status
          );

        }
      );

}


/* =========================================================
   STOP GAMIYA REALTIME
   ========================================================= */

function stopGamiyaRealtime() {

  if (
    gamiyaRealtimeChannel
  ) {

    supabaseClient.removeChannel(
      gamiyaRealtimeChannel
    );


    gamiyaRealtimeChannel =
      null;
  }


  clearTimeout(
    gamiyaRealtimeRefreshTimer
  );


  gamiyaRealtimeRefreshTimer =
    null;


  console.log(
    'TUX POS — Gam3ya Realtime stopped.'
  );

}

/*  handle reset button */





async function handleResetGamiya() {
  if (
    typeof getActiveRole !== 'function' ||
    getActiveRole() !== 'tuxadmin'
  ) {
    alert('Only Tux Admin can reset Gam3ya.');
    return;
  }

  if (
    !window.confirm(
      'This will permanently delete all Gam3ya orders and meal items.\n\nAre you sure?'
    )
  ) {
    return;
  }

  const button = document.getElementById('gamiyaResetBtn');

  if (button) {
    button.disabled = true;
    button.textContent = 'Resetting...';
  }

  try {
    const success = await resetGamiyaInSupabase();

    if (success) {
      alert('Gam3ya data reset successfully.');
    }
  } catch (error) {
    console.error('TUX POS — Gam3ya reset failed:', error);
    alert('Failed to reset Gam3ya data.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '♻ Reset All Data';
    }
  }
}

// separated function

function updateGamiyaResetButtonVisibility() {
  const button = document.getElementById('gamiyaResetBtn');

  if (!button) return;

  button.style.display =
    typeof getActiveRole === 'function' &&
    getActiveRole() === 'tuxadmin'
      ? 'inline-block'
      : 'none';
}

document.addEventListener(
  'DOMContentLoaded',
  updateGamiyaResetButtonVisibility
);
