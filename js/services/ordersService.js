 /* =========================================================
   TUX POS — ORDERS SERVICE
   Supabase persistence for cashier orders.
   ========================================================= */


/* =========================================================
   ADMIN READ-ONLY PROTECTION
   ========================================================= */


function isTuxPosAdminReadOnlyOrders() {
  // Admin and Tux Admin are both allowed to modify orders.
  return false;
}




function blockTuxPosAdminOrderMutation(action) {
  const role =
    typeof getActiveRole === 'function'
      ? getActiveRole()
      : null;

  // Admin and Tux Admin are allowed to create and modify orders.
  if (role === 'admin' || role === 'tuxadmin') {
    return false;
  }

  // Preserve the existing restriction for other roles.
  if (!isTuxPosAdminReadOnlyOrders()) {
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
   ORDERS REALTIME
   ========================================================= */

let ordersRealtimeChannel = null;
let ordersRealtimeRefreshTimer = null;


/* =========================================================
   START ORDERS REALTIME
   ========================================================= */

function startOrdersRealtime() {

  /*
   * Prevent duplicate realtime channels.
   */

  if (ordersRealtimeChannel) {

    supabaseClient.removeChannel(
      ordersRealtimeChannel
    );

    ordersRealtimeChannel = null;

  }


  ordersRealtimeChannel =
    supabaseClient

      /*
       * =====================================================
       * ORDERS TABLE
       * =====================================================
       */

      .channel('tux-orders-realtime')

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },

        function (payload) {

          console.log(
            'TUX POS — Orders realtime event:',
            payload.eventType,
            payload
          );

          scheduleOrdersRealtimeRefresh();

        }
      )


      /*
       * =====================================================
       * ORDER ITEMS TABLE
       * =====================================================
       */

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items'
        },

        function (payload) {

          console.log(
            'TUX POS — Order items realtime event:',
            payload.eventType,
            payload
          );

          scheduleOrdersRealtimeRefresh();

        }
      )


      /*
       * =====================================================
       * SUBSCRIBE
       * =====================================================
       */

      .subscribe(function (status) {

        console.log(
          'TUX POS — Orders realtime status:',
          status
        );

      });

}


/* =========================================================
   SCHEDULE ORDERS REFRESH
   ========================================================= */

function scheduleOrdersRealtimeRefresh() {

  /*
   * The cashier inserts:
   *
   * 1. orders
   * 2. order_items
   *
   * We wait a short moment so both records are available
   * before loading the Kitchen data.
   *
   * This also combines multiple realtime events into
   * one refresh instead of refreshing several times.
   */

  if (ordersRealtimeRefreshTimer) {

    clearTimeout(
      ordersRealtimeRefreshTimer
    );

  }


  ordersRealtimeRefreshTimer =
    setTimeout(
      async function () {

        ordersRealtimeRefreshTimer = null;


        try {

          /* =================================================
             REFRESH KITCHEN ORDERS
             ================================================= */

          if (
            typeof loadKitchenOrdersFromSupabase ===
            'function'
          ) {

            await loadKitchenOrdersFromSupabase();

          }


          /* =================================================
             REFRESH REPORTS
             ================================================= */

          if (
            typeof refreshReportsFromSupabase ===
            'function'
          ) {

            await refreshReportsFromSupabase();

          }


          /* =================================================
             UPDATE SALES UI
             ================================================= */

          if (
            typeof renderSalesReport ===
            'function'
          ) {

            renderSalesReport();

          }


          /* =================================================
             NOTIFY OTHER MODULES
             ================================================= */

          window.dispatchEvent(
            new CustomEvent(
              'tux-orders-realtime-updated'
            )
          );


          console.log(
            'TUX POS — Orders refreshed after realtime event.'
          );


        } catch (error) {

          console.error(
            'TUX POS — Failed to refresh orders after realtime event:',
            error
          );

        }

      },
      300
    );

}


/* =========================================================
   STOP ORDERS REALTIME
   ========================================================= */

function stopOrdersRealtime() {

  if (ordersRealtimeRefreshTimer) {

    clearTimeout(
      ordersRealtimeRefreshTimer
    );

    ordersRealtimeRefreshTimer = null;

  }


  if (!ordersRealtimeChannel) {

    return;

  }


  supabaseClient.removeChannel(
    ordersRealtimeChannel
  );


  ordersRealtimeChannel = null;


  console.log(
    'TUX POS — Orders realtime stopped.'
  );

}


/* =========================================================
   SAVE ORDER TO SUPABASE
   ========================================================= */


async function saveOrderToSupabase(orderData) {

  /*
   * =======================================================
   * ADMIN READ-ONLY PROTECTION
   * =======================================================
   *
   * Admin can view orders but cannot create them.
   *
   * Worker and Tux Admin continue normally.
   * =======================================================
   */

  if (
    blockTuxPosAdminOrderMutation(
      'create orders'
    )
  ) {

    return null;

  }


  try {

    if (!orderData) {

      console.error(
        'TUX POS — Cannot save empty order.'
      );

      return null;

    }


    if (
      !currentShift ||
      !currentShift.supabaseId
    ) {

      alert(
        'There is no active Supabase shift. Please start the shift first.'
      );

      return null;

    }


    /* =====================================================
       INSERT ORDER HEADER
       ===================================================== */

    
const orderPayload = {
    order_number: orderData.orderNum,
    shift_id: currentShift.supabaseId,
    staff_id: orderData.staffId || null,
    staff_name: orderData.staffName || null,

    subtotal: Number(orderData.subtotal || 0),
    delivery_fee: Number(orderData.deliveryFee || 0),
    total: Number(orderData.total || 0),

    cash_paid: Number(orderData.cashPaid || 0),
    insta_paid: Number(orderData.instaPaid || 0),
    visa_paid: Number(orderData.visaPaid || 0),
    discount: Number(orderData.discount || 0),

    status: orderData.status || 'preparing',
    note: orderData.note || ''
};




    const {
      data: order,
      error: orderError
    } =
      await supabaseClient
        .from('orders')
        .insert(orderPayload)
        .select('*')
        .single();


    if (orderError) {

      console.error(
        'TUX POS — Failed to save order:',
        orderError
      );

      alert(
        'Could not save the order to Supabase.\n\n' +
        orderError.message
      );

      return null;

    }


    /* =====================================================
       PREPARE ORDER ITEMS
       ===================================================== */

    const items =
      Array.isArray(orderData.items)
        ? orderData.items
        : [];


    const orderItems =
      items.map(function (item) {

        let menuItemId = null;


        /*
         * Find the corresponding
         * Supabase menu item by name.
         */

        Object.keys(menuItems || {}).some(
          function (category) {

            const categoryItems =
              menuItems[category];


            if (!Array.isArray(categoryItems)) {

              return false;

            }


            const found =
              categoryItems.find(
                function (menuItem) {

                  return (
                    String(menuItem.name)
                      .trim()
                      .toLowerCase() ===
                    String(item.name)
                      .trim()
                      .toLowerCase()
                  );

                }
              );


            if (found) {

              menuItemId =
                found.id || null;

              return true;

            }


            return false;

          }
        );


        return {

          order_id:
            order.id,

          menu_item_id:
            menuItemId,

          name:
            item.name,

          price:
            Number(item.price || 0),

          quantity:
            Number(item.qty || 1),

          extras:
            Array.isArray(item.extras)
              ? item.extras
              : []

        };

      });


    /* =====================================================
       INSERT ORDER ITEMS
       ===================================================== */

    if (
      orderItems.length > 0
    ) {

      const {
        data: savedItems,
        error: itemsError
      } =
        await supabaseClient
          .from('order_items')
          .insert(orderItems)
          .select('*');


      if (itemsError) {

        console.error(
          'TUX POS — Failed to save order items:',
          itemsError
        );


        /*
         * Delete the order header so we do not
         * leave an incomplete order in Supabase.
         */

        await supabaseClient
          .from('orders')
          .delete()
          .eq(
            'id',
            order.id
          );


        alert(
          'Could not save the order items to Supabase.\n\n' +
          itemsError.message
        );

        return null;

      }


      order.savedItems =
        savedItems || [];

    }

    else {

      order.savedItems = [];

    }


    console.log(
      'TUX POS — Order saved to Supabase:',
      order
    );


    return order;

  } catch (error) {

    console.error(
      'TUX POS — Order save failed:',
      error
    );


    alert(
      'Could not save the order to Supabase.\n\n' +
      error.message
    );


    return null;

  }

}






async function restoreOrderCounterForCurrentShift() {
    try {
        if (
            !currentShift ||
            !currentShift.supabaseId ||
            !supabaseClient
        ) {
            console.warn(
                'TUX POS — Cannot restore order counter: no active shift.'
            );
            return false;
        }

        const {
            data,
            error
        } = await supabaseClient
            .from('orders')
            .select('order_number')
            .eq('shift_id', currentShift.supabaseId);

        if (error) {
            console.error(
                'TUX POS — Failed to restore order counter:',
                error
            );
            return false;
        }

        const highestOrderNumber = (data || []).reduce(
            function (highest, order) {
                const number = Number(order.order_number);

                return Number.isFinite(number)
                    ? Math.max(highest, number)
                    : highest;
            },
            0
        );

        orderCounter = highestOrderNumber + 1;

        console.log(
            'TUX POS — Next order number:',
            orderCounter
        );

        return true;

    } catch (error) {
        console.error(
            'TUX POS — Restoring order counter failed:',
            error
        );

        return false;
    }
}



/* =========================================================
   TUX POS — RESTORE ORDER COUNTER FOR CURRENT SHIFT
   ========================================================= */

async function restoreOrderCounterForCurrentShift() {

    try {

        if (
            !currentShift ||
            !currentShift.supabaseId
        ) {

            console.warn(
                'TUX POS — Cannot restore order counter: no active shift.'
            );

            return false;

        }

        const {
            data,
            error
        } = await supabaseClient
            .from('orders')
            .select('order_number')
            .eq(
                'shift_id',
                currentShift.supabaseId
            );

        if (error) {

            console.error(
                'TUX POS — Failed to restore order counter:',
                error
            );

            return false;

        }

        const highestOrderNumber = (data || [])
            .reduce(function (highest, order) {

                const number =
                    Number(order.order_number);

                if (
                    Number.isFinite(number) &&
                    number > highest
                ) {

                    return number;

                }

                return highest;

            }, 0);

        orderCounter = highestOrderNumber + 1;

        console.log(
            'TUX POS — Order counter restored. Next order:',
            orderCounter
        );

        return true;

    } catch (error) {

        console.error(
            'TUX POS — Restoring order counter failed:',
            error
        );

        return false;

    }

}





/* =========================================================
   TUX POS — CURRENT ORDER NOTE
   ========================================================= */

let currentOrderNote = '';


/* =========================================================
   OPEN NOTE EDITOR
   ========================================================= */

function openOrderNoteModal() {

    const note = prompt(
        'Write a note for this order:',
        currentOrderNote
    );

    // Keep the existing note if the user cancels.
    if (note === null) {
        return;
    }

    currentOrderNote = note.trim();

    renderCurrentOrderNote();
}


/* =========================================================
   DISPLAY CURRENT ORDER NOTE
   ========================================================= */

function renderCurrentOrderNote() {

    const display = document.getElementById(
        'currentOrderNoteDisplay'
    );

    if (!display) {
        return;
    }

    if (!currentOrderNote) {

        display.style.display = 'none';
        display.textContent = '';

        return;
    }

    display.style.display = 'block';

    display.textContent =
        '📝 Order Note: ' + currentOrderNote;
}


/* =========================================================
   RESET CURRENT ORDER NOTE
   Call this only when the current order is cleared
   or successfully sent to the kitchen.
   ========================================================= */

function clearCurrentOrderNote() {

    currentOrderNote = '';

    renderCurrentOrderNote();
}





/* =========================================================
   LOAD CURRENT SHIFT ORDERS
   Used by Kitchen.
   ========================================================= */


async function loadCurrentShiftOrdersFromSupabase() {

  try {

    if (
      !currentShift ||
      !currentShift.supabaseId
    ) {

      return [];

    }

    const {
      data,
      error
    } =
      await supabaseClient
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq(
          'shift_id',
          currentShift.supabaseId
        )
        .order(
          'created_at',
          {
            ascending: false
          }
        );

    if (error) {

      console.error(
        'TUX POS — Failed to load current shift orders:',
        error
      );

      return [];

    }

    return (data || []).map(function (order) {

      return {

        ...order,

        // Preserve the delivery fee under both names.
        deliveryFee: Number(
          order.delivery_fee ??
          order.deliveryFee ??
          0
        ),

        // Preserve the saved total and payment amounts.
        subtotal: Number(
          order.subtotal || 0
        ),

        total: Number(
          order.total || 0
        ),

        discount: Number(
          order.discount || 0
        ),

        cashPaid: Number(
          order.cash_paid ??
          order.cashPaid ??
          0
        ),

        instaPaid: Number(
          order.insta_paid ??
          order.instaPaid ??
          0
        ),

        visaPaid: Number(
          order.visa_paid ??
          order.visaPaid ??
          0
        )

      };

    });

  } catch (error) {

    console.error(
      'TUX POS — Loading current shift orders failed:',
      error
    );

    return [];

  }

}




/* =========================================================
   LOAD ALL ORDERS
   Used later by Reports.
   ========================================================= */

async function loadOrdersFromSupabase() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .order(
          'created_at',
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        'TUX POS — Failed to load orders:',
        error
      );

      return [];

    }


    return data || [];

  } catch (error) {

    console.error(
      'TUX POS — Loading orders failed:',
      error
    );

    return [];

  }

}


/* =========================================================
   UPDATE ORDER STATUS
   Used by Kitchen.
   ========================================================= */


async function updateOrderStatusInSupabase(
  orderId,
  status
) {
  try {
    /*
     * VALIDATE STATUS
     */

    const allowedStatuses = [
      'preparing',
      'done',
      'cancelled'
    ];

    if (!allowedStatuses.includes(status)) {
      console.error(
        'TUX POS — Invalid order status:',
        status
      );

      return null;
    }

    if (!orderId) {
      console.error(
        'TUX POS — Cannot update order: missing order ID.'
      );

      return null;
    }

    /*
     * PREPARE UPDATE
     */

    const updateData = {
      status: status
    };

    /*
     * SAVE COMPLETION TIMESTAMP
     */

    if (status === 'done') {
      updateData.completed_at =
        new Date().toISOString();
    }

    /*
     * CLEAR COMPLETION TIMESTAMP
     * IF ORDER RETURNS TO PREPARING
     */

    if (status === 'preparing') {
      updateData.completed_at = null;
    }

    /*
     * SAVE TO SUPABASE
     */

    const {
      data,
      error
    } = await supabaseClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) {
      console.error(
        'TUX POS — Failed to update order status:',
        error
      );

      return null;
    }

    if (!data) {
      console.error(
        'TUX POS — Supabase returned no updated order.'
      );

      return null;
    }

    console.log(
      'TUX POS — Order status saved to Supabase:',
      data
    );

    return data;

  } catch (error) {
    console.error(
      'TUX POS — Order status update failed:',
      error
    );

    return null;
  }
}
