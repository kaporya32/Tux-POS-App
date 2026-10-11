/* =========================================================
   TUX POS — KITCHEN BOARD (KDS)
   Supabase-connected Kitchen Display System
   ========================================================= */


/* =========================================================
   KITCHEN REALTIME EVENT LISTENER
   ========================================================= */

window.addEventListener(
  'tux-orders-realtime-updated',
  async function () {

    console.log(
      'TUX POS — Kitchen received orders realtime update.'
    );

    await loadKitchenOrdersFromSupabase();

  }
);


/* =========================================================
   LOAD CURRENT SHIFT ORDERS FROM SUPABASE
   ========================================================= */

async function loadKitchenOrdersFromSupabase() {

  try {

    if (
      !currentShift ||
      !currentShift.supabaseId
    ) {

      kitchenOrders = [];

      renderKitchenBoard();

      return [];

    }


    const orders =
      await loadCurrentShiftOrdersFromSupabase();


    kitchenOrders =
      (orders || []).map(function (order) {

        const items =
          Array.isArray(order.order_items)
            ? order.order_items.map(function (item) {

                return {
                  menuItemId:
                    item.menu_item_id || null,

                  name:
                    item.name,

                  price:
                    Number(item.price || 0),

                  qty:
                    Number(item.quantity || 1),

                  extras:
                    Array.isArray(item.extras)
                      ? item.extras
                      : []
                };

              })
            : [];


        return {

          supabaseId:
            order.id,

          orderNum:
            Number(order.order_number),

          items:
            items,

          total:
            Number(order.total || 0),

          cashPaid:
            Number(order.cash_paid || 0),

          instaPaid:
            Number(order.insta_paid || 0),

          visaPaid:
            Number(order.visa_paid || 0),

          discount:
            Number(order.discount || 0),

          status:
            order.status || 'preparing',

          createdAt:
            order.created_at || null,

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
              : '',

          staffId:
            order.staff_id || null,

          staffName:
            order.staff_name || null

        };

      });


    renderKitchenBoard();


    console.log(
      'TUX POS — Kitchen orders loaded from Supabase:',
      kitchenOrders
    );


    return kitchenOrders;

  } catch (error) {

    console.error(
      'TUX POS — Failed to load Kitchen orders:',
      error
    );

    kitchenOrders = [];

    renderKitchenBoard();

    return [];

  }

}


/* =========================================================
   KITCHEN DISPLAY HELPERS
   DISPLAY ONLY — NO ORDER LOGIC
   ========================================================= */

function getKitchenRelativeTime(createdAt) {

  if (!createdAt) {
    return '';
  }


  const created =
    new Date(createdAt);


  if (Number.isNaN(created.getTime())) {
    return '';
  }


  const diff =
    Date.now() - created.getTime();


  const seconds =
    Math.floor(diff / 1000);


  if (seconds < 60) {
    return 'Just now';
  }


  const minutes =
    Math.floor(seconds / 60);


  if (minutes < 60) {

    return (
      minutes +
      (minutes === 1 ? ' minute ago' : ' minutes ago')
    );

  }


  const hours =
    Math.floor(minutes / 60);


  if (hours < 24) {

    return (
      hours +
      (hours === 1 ? ' hour ago' : ' hours ago')
    );

  }


  const days =
    Math.floor(hours / 24);


  return (
    days +
    (days === 1 ? ' day ago' : ' days ago')
  );

}


function getKitchenFullDate(createdAt) {

  if (!createdAt) {
    return '';
  }


  const date =
    new Date(createdAt);


  if (Number.isNaN(date.getTime())) {
    return '';
  }


  return date.toLocaleString(
    [],
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  );

}


function getKitchenExtraName(extra) {

  if (!extra) {
    return '';
  }


  if (typeof extra === 'string') {
    return extra;
  }


  return (
    extra.name ||
    extra.title ||
    extra.label ||
    ''
  );

}


function getKitchenExtraPrice(extra) {

  if (!extra || typeof extra === 'string') {
    return 0;
  }


  return Number(
    extra.price ||
    extra.amount ||
    extra.extraPrice ||
    0
  );

}


/* =========================================================
   PAYMENT DISPLAY HELPER
   DISPLAY ONLY — NO PAYMENT LOGIC
   ========================================================= */

function getKitchenPaymentMethod(ord) {

  const payments = [];


  const cash =
    Number(ord.cashPaid || 0);


  const visa =
    Number(ord.visaPaid || 0);


  const insta =
    Number(ord.instaPaid || 0);


  if (cash > 0) {

    payments.push(
      `Cash ${cash.toFixed(2)} LE`
    );

  }


  if (visa > 0) {

    payments.push(
      `Visa ${visa.toFixed(2)} LE`
    );

  }


  if (insta > 0) {

    payments.push(
      `InstaPay ${insta.toFixed(2)} LE`
    );

  }


  if (payments.length === 0) {

    return 'Not specified';

  }


  return payments.join(' + ');

}


/* =========================================================
   RENDER KITCHEN BOARD
   ========================================================= */

function renderKitchenBoard() {

  const container =
    document.getElementById(
      'kdsOrdersContainer'
    );

  if (!container) return;


  if (kitchenOrders.length === 0) {

    container.innerHTML = `
      <div style="
        color: #666;
        text-align: center;
        grid-column: span 3;
        margin-top: 30px;
      ">
        No active orders... waiting for cashier
      </div>
    `;

    return;

  }


  let html = '';


  kitchenOrders.forEach(
    function (ord, index) {

      const statusClass =
        ord.status;


      const statusText =
        ord.status === 'preparing'
          ? 'Preparing'
          : (
              ord.status === 'done'
                ? 'Ready'
                : 'Cancelled'
            );


      const statusBg =
        ord.status === 'preparing'
          ? '#d4ac0d'
          : (
              ord.status === 'done'
                ? '#27ae60'
                : '#c0392b'
            );


      let itemsHtml = '';


      if (
        Array.isArray(ord.items)
      ) {

        ord.items.forEach(
          function (it) {

            const itemTotal =
              Number(it.price || 0) *
              Number(it.qty || 1);


            let extrasHtml = '';


            if (
              Array.isArray(it.extras) &&
              it.extras.length > 0
            ) {

              it.extras.forEach(
                function (extra) {

                  const extraName =
                    getKitchenExtraName(extra);


                  const extraPrice =
                    getKitchenExtraPrice(extra);


                  if (!extraName) {
                    return;
                  }


                  extrasHtml += `
                    <div
                      style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 10px;
                        padding-left: 22px;
                        margin-top: 4px;
                        font-size: 13px;
                        color: #bdbdbd;
                      "
                    >

                      <span>
                        + ${extraName}
                      </span>

                      <strong
                        style="
                          color: #d6d6d6;
                          white-space: nowrap;
                        "
                      >
                        ${extraPrice.toFixed(2)} LE
                      </strong>

                    </div>
                  `;

                }
              );

            }


            itemsHtml += `
              <div
                style="
                  margin-bottom: 12px;
                "
              >

                <div
                  class="oc-item-row"
                  style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                  "
                >

                  <span>
                    ${it.qty}× ${it.name}
                  </span>

                  <strong
                    style="
                      white-space: nowrap;
                    "
                  >
                    ${itemTotal.toFixed(2)} LE
                  </strong>

                </div>

                ${extrasHtml}

              </div>
            `;

          }
        );

      }


      /*
        Admin is view-only.

        Admin can still see the Done / Cancel buttons,
        but they are disabled so the Kitchen Board
        remains visible exactly like the operational view.
      */

      const isAdminViewOnly =
        typeof getActiveRole === 'function' &&
        getActiveRole() === 'admin';


      const doneBtnDisabled =
        ord.status === 'done' ||
        isAdminViewOnly
          ? 'opacity: 0.5; pointer-events: none;'
          : '';


      const cancelBtnDisabled =
        isAdminViewOnly
          ? 'opacity: 0.5; pointer-events: none;'
          : '';


      const relativeTime =
        getKitchenRelativeTime(
          ord.createdAt
        );


      const fullDate =
        getKitchenFullDate(
          ord.createdAt
        );


      const paymentMethod =
        getKitchenPaymentMethod(
          ord
        );


      html += `

        <div class="order-card ${statusClass}">

          <div class="oc-top">

            <span>
              Order #${ord.orderNum}
            </span>


            <button
              class="oc-btn btn-print"
              style="
                flex: 0;
                padding: 2px 6px;
                font-size: 9px;
              "
              onclick="printKitchenOrder(${index})">

              Print

            </button>

          </div>


          <div
            style="
              display: flex;
              flex-direction: column;
              gap: 3px;
              margin: 4px 0 12px;
            "
          >

            <span
              style="
                font-size: 13px;
                color: #d0d0d0;
              "
            >
              ${relativeTime}
            </span>


            <span
              style="
                font-size: 12px;
                color: #888;
              "
            >
              ${fullDate}
            </span>

          </div>


          <div class="oc-items">

            ${itemsHtml}

          </div>


          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 10px;
              padding-top: 10px;
              margin-top: 4px;
              border-top: 1px solid rgba(255,255,255,0.08);
            "
          >

            <strong
              style="
                font-size: 14px;
                color: #f0f0f0;
              "
            >
              Order Total
            </strong>


            <strong
              style="
                font-size: 16px;
                color: #ffffff;
                white-space: nowrap;
              "
            >
              ${Number(ord.total || 0).toFixed(2)} LE
            </strong>

          </div>


          ${
            Number(ord.discount || 0) > 0
              ? `
                <div
                  style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 10px;
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                  "
                >

                  <strong
                    style="
                      font-size: 13px;
                      color: #bdbdbd;
                    "
                  >
                    Discount
                  </strong>


                  <strong
                    style="
                      font-size: 13px;
                      color: #e74c3c;
                      white-space: nowrap;
                    "
                  >
                    ${Number(ord.discount || 0).toFixed(2)} LE
                  </strong>

                </div>
              `
              : ''
          }


          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 10px;
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px solid rgba(255,255,255,0.05);
            "
          >

         


        

          </div>


          <div
            style="
              display: flex;
              justify-content: flex-end;
              align-items: center;
              margin-top: 8px;
            "
          >

            <span
              class="oc-status"
              style="
                background: ${statusBg};
                color: white;
              "
            >

              ${statusText}

            </span>

          </div>


          <div class="oc-buttons">

            <button
              class="oc-btn btn-done"
              style="${doneBtnDisabled}"
              onclick="updateOrderStatus(${index}, 'done')">

              Done

            </button>


            <button
              class="oc-btn btn-k-cancel"
              style="${cancelBtnDisabled}"
              onclick="updateOrderStatus(${index}, 'cancelled')">

              Cancel

            </button>

          </div>

        </div>

      `;

    }
  );


  container.innerHTML =
    html;

}


/* =========================================================
   UPDATE ORDER STATUS
   ========================================================= */

async function updateOrderStatus(
  index,
  newStatus
) {

  /*
    =======================================================
    ADMIN READ-ONLY PROTECTION
    =======================================================

    Admin can spectate the Kitchen Board but cannot:

      - Mark orders as Done
      - Cancel orders
      - Trigger stock deduction
      - Modify order status

    Tux Admin and Worker continue normally.
    =======================================================
  */

  if (
    typeof getActiveRole === 'function' &&
    getActiveRole() === 'admin'
  ) {

    alert(
      'Admin is view-only. You cannot change kitchen orders.'
    );

    return;

  }


  const ord =
    kitchenOrders[index];


  if (!ord) {

    return;

  }


  if (
    !ord.supabaseId
  ) {

    alert(
      'This order is not connected to Supabase.'
    );

    return;

  }


  /*
    =======================================================
    STOCK DEDUCTION
    =======================================================

    Stock is deducted ONLY when:

      Preparing → Done

    It is NOT deducted when:

      Preparing → Cancelled
      Done → Done
      Done → Cancelled

    The stock service also protects against
    duplicate deductions using stock_movements.
    =======================================================
  */

  if (
    ord.status !== 'done' &&
    newStatus === 'done'
  ) {

    if (
      typeof deductStockForOrder !== 'function'
    ) {

      alert(
        'Stock service is not available.'
      );

      return;

    }


    const stockDeducted =
      await deductStockForOrder(ord);


    if (!stockDeducted) {

      alert(
        'Could not deduct stock. The order was not marked as Done.'
      );

      return;

    }

  }


  /*
    =======================================================
    SAVE ORDER STATUS TO SUPABASE
    =======================================================
  */

  const updatedOrder =
    await updateOrderStatusInSupabase(
      ord.supabaseId,
      newStatus
    );


  if (!updatedOrder) {

    alert(
      'Could not update the order status in Supabase.'
    );

    return;

  }


  /*
    =======================================================
    UPDATE LOCAL KITCHEN STATE
    =======================================================
  */

  ord.status =
    updatedOrder.status;


  /*
    =======================================================
    UPDATE LOCAL COMPLETED SALES
    =======================================================
  */

  completedSales.forEach(
    function (sale) {

      if (
        sale.orderNum ===
        ord.orderNum
      ) {

        sale.status =
          newStatus;

      }

    }
  );


  /*
    =======================================================
    RE-RENDER
    =======================================================
  */

  renderKitchenBoard();


  if (
    typeof renderSalesReport === 'function'
  ) {

    renderSalesReport();

  }


  console.log(
    'TUX POS — Order status updated:',
    updatedOrder
  );

}


/* =========================================================
   LEGACY FUNCTION
   ========================================================= */

async function loadKitchenOrders() {

  await loadKitchenOrdersFromSupabase();

}


/* =========================================================
   PRINT KITCHEN ORDER
   ========================================================= */


/* =========================================================
   PRINT KITCHEN ORDER
   Prints order items, extras, and total only.
   ========================================================= */



function printKitchenOrder(index) {
  const ord = kitchenOrders[index];

  if (!ord) {
    alert('Order not found.');
    return;
  }

  let itemsHtml = '';

  (Array.isArray(ord.items) ? ord.items : []).forEach(function (it) {
    const qty = Number(it.qty || 1);
    const itemTotal = Number(it.price || 0) * qty;

    itemsHtml += `
      <div class="item">
        <span>${escapeKitchenPrintText(it.name)} × ${qty}</span>
        <strong>${itemTotal.toFixed(2)} LE</strong>
      </div>
    `;

    (Array.isArray(it.extras) ? it.extras : []).forEach(function (extra) {
      const name = getKitchenExtraName(extra);
      if (!name) return;

      itemsHtml += `
        <div class="extra">
          <span>+ ${escapeKitchenPrintText(name)}</span>
          <span>${getKitchenExtraPrice(extra).toFixed(2)} LE</span>
        </div>
      `;
    });
  });

  const date = ord.createdAt
    ? new Date(ord.createdAt).toLocaleString()
    : (ord.time || '-');

  const receipt = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Order #${Number(ord.orderNum)}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #000;
          background: #fff;
          padding: 15px;
          font-size: 14px;
        }
        .receipt {
          width: 100%;
          max-width: 340px;
          margin: 0 auto;
        }
        h1 {
          text-align: center;
          margin: 0 0 5px;
          font-size: 26px;
        }
        .subtitle {
          text-align: center;
          margin-bottom: 15px;
        }
        .meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin: 12px 0;
        }
        .item, .extra, .total {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 7px 0;
        }
        .extra {
          padding-left: 12px;
          font-size: 12px;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 10px 0;
        }
        .total {
          font-weight: bold;
          font-size: 18px;
        }
        @media print {
          body { padding: 0; }
          .receipt { max-width: none; }
        }
      </style>
    </head>
    <body>
      <main class="receipt">
        <h1>TUX</h1>
        <div class="subtitle">Kitchen Order</div>
        <div class="divider"></div>
        <div class="meta">
          <strong>Order #${Number(ord.orderNum)}</strong>
          <span>${escapeKitchenPrintText(date)}</span>
        </div>
        <div class="divider"></div>
        ${itemsHtml}
        <div class="divider"></div>
        <div class="total">
          <span>Order Total</span>
          <span>${Number(ord.total || 0).toFixed(2)} LE</span>
        </div>
      </main>
      <script>
        window.onload = function () {
          window.focus();
          window.print();
        };
        window.onafterprint = function () {
          window.close();
        };
      <\/script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('The print window was blocked. Allow pop-ups for your TUX POS website and try again.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(receipt);
  printWindow.document.close();
}


/* Safely display text supplied by an order. */
function escapeKitchenPrintText(value) {
  return String(value ?? '').replace(/[&<>"']/g, function (char) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char];
  });
}
