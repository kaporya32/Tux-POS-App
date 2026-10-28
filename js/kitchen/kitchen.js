
/* =========================================================
   TUX POS — KITCHEN BOARD (KDS)
   Supabase-connected Kitchen Display System
   Supports order notes
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
   TUX POS — LOAD KITCHEN ORDERS FROM SUPABASE
   ========================================================= */

window.loadKitchenOrdersFromSupabase = async function () {

  try {

    if (!currentShift || !currentShift.supabaseId) {

      kitchenOrders = [];

      renderKitchenBoard();

      return [];

    }

    const orders = await loadCurrentShiftOrdersFromSupabase();

    kitchenOrders = (orders || []).map(function (order) {

      const items = Array.isArray(order.order_items)
        ? order.order_items.map(function (item) {

            return {
              menuItemId: item.menu_item_id || null,
              name: item.name,
              price: Number(item.price || 0),
              qty: Number(item.quantity || 1),
              extras: Array.isArray(item.extras) ? item.extras : []
            };

          })
        : [];

      return {

        supabaseId: order.id,

        orderNum: Number(order.order_number),

        note: String(order.note || ''),

        items: items,

        subtotal: Number(order.subtotal || 0),

        deliveryFee: Number(
          order.delivery_fee ??
          order.deliveryFee ??
          0
        ),

        total: Number(order.total || 0),

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
        ),

        discount: Number(order.discount || 0),

        status: order.status || 'preparing',

        createdAt: order.created_at || null,

        time: order.created_at
          ? new Date(order.created_at).toLocaleTimeString(
              [],
              {
                hour: '2-digit',
                minute: '2-digit'
              }
            )
          : '',

        staffId: order.staff_id || null,

        staffName: order.staff_name || null

      };

    });

    renderKitchenBoard();

    console.log(
      'TUX POS — Kitchen orders loaded:',
      kitchenOrders
    );

    console.table(
      kitchenOrders.map(function (order) {
        return {
          orderNum: order.orderNum,
          deliveryFee: order.deliveryFee,
          total: order.total
        };
      })
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

};








/* =========================================================
   KITCHEN DISPLAY HELPERS
   ========================================================= */

function getKitchenRelativeTime(createdAt) {
  if (!createdAt) {
    return '';
  }

  const created = new Date(createdAt);

  if (Number.isNaN(created.getTime())) {
    return '';
  }

  const diff = Date.now() - created.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return 'Just now';
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return (
      minutes +
      (minutes === 1 ? ' minute ago' : ' minutes ago')
    );
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return (
      hours +
      (hours === 1 ? ' hour ago' : ' hours ago')
    );
  }

  const days = Math.floor(hours / 24);

  return (
    days +
    (days === 1 ? ' day ago' : ' days ago')
  );
}


function getKitchenFullDate(createdAt) {
  if (!createdAt) {
    return '';
  }

  const date = new Date(createdAt);

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
   SAFE HTML DISPLAY HELPER
   ========================================================= */

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


/* =========================================================
   PAYMENT DISPLAY HELPER
   ========================================================= */

function getKitchenPaymentMethod(ord) {
  const payments = [];

  const cash = Number(ord.cashPaid || 0);
  const visa = Number(ord.visaPaid || 0);
  const insta = Number(ord.instaPaid || 0);

  if (cash > 0) {
    payments.push(`Cash ${cash.toFixed(2)} LE`);
  }

  if (visa > 0) {
    payments.push(`Visa ${visa.toFixed(2)} LE`);
  }

  if (insta > 0) {
    payments.push(`InstaPay ${insta.toFixed(2)} LE`);
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
  const container = document.getElementById(
    'kdsOrdersContainer'
  );

  if (!container) {
    return;
  }

  if (
    !Array.isArray(kitchenOrders) ||
    kitchenOrders.length === 0
  ) {
    container.innerHTML = `
      <div style="
        color:#666;
        text-align:center;
        grid-column:span 3;
        margin-top:30px;
      ">
        No active orders... waiting for cashier
      </div>
    `;

    return;
  }

  let html = '';

  kitchenOrders.forEach(function (ord, index) {
    const statusClass = ord.status;

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

    if (Array.isArray(ord.items)) {
      ord.items.forEach(function (it) {
        const itemTotal =
          Number(it.price || 0) *
          Number(it.qty || 1);

        let extrasHtml = '';

        if (
          Array.isArray(it.extras) &&
          it.extras.length > 0
        ) {
          it.extras.forEach(function (extra) {
            const extraName =
              getKitchenExtraName(extra);

            const extraPrice =
              getKitchenExtraPrice(extra);

            if (!extraName) {
              return;
            }

            extrasHtml += `
              <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:10px;
                padding-left:22px;
                margin-top:4px;
                font-size:13px;
                color:#bdbdbd;
              ">
                <span>
                  + ${escapeKitchenPrintText(extraName)}
                </span>

                <strong style="
                  color:#d6d6d6;
                  white-space:nowrap;
                ">
                  ${extraPrice.toFixed(2)} LE
                </strong>
              </div>
            `;
          });
        }

        itemsHtml += `
          <div style="margin-bottom:12px;">
            <div class="oc-item-row" style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:12px;
            ">
              <span>
                ${Number(it.qty || 1)}×
                ${escapeKitchenPrintText(it.name)}
              </span>

              <strong style="white-space:nowrap;">
                ${itemTotal.toFixed(2)} LE
              </strong>
            </div>

            ${extrasHtml}
          </div>
        `;
      });
    }

    /*
     * PERMISSIONS
     *
     * Admin and Tux Admin can change kitchen orders.
     * The Done button remains disabled for completed orders.
     */

    const doneBtnDisabled =
      ord.status === 'done'
        ? 'opacity:0.5; pointer-events:none;'
        : '';

    const cancelBtnDisabled =
      ord.status === 'cancelled'
        ? 'opacity:0.5; pointer-events:none;'
        : '';

    const relativeTime =
      getKitchenRelativeTime(ord.createdAt);

    const fullDate =
      getKitchenFullDate(ord.createdAt);

    const paymentMethod =
      getKitchenPaymentMethod(ord);

    /*
     * DISPLAY ORDER NOTE
     */

    const noteHtml =
      String(ord.note || '').trim()
        ? `
          <div style="
            margin:10px 0;
            padding:10px;
            background:#352f17;
            border-left:4px solid #f1c40f;
            border-radius:5px;
            color:#f1c40f;
            overflow-wrap:anywhere;
          ">
            <div style="
              font-size:11px;
              font-weight:bold;
              margin-bottom:5px;
            ">
              📝 ORDER NOTE
            </div>

            <div style="
              font-size:14px;
              white-space:pre-wrap;
              line-height:1.5;
            ">${escapeKitchenPrintText(ord.note)}</div>
          </div>
        `
        : '';

    html += `
      <div class="order-card ${statusClass}">

        <div class="oc-top">
          <span>
            Order #${Number(ord.orderNum)}
          </span>

          <button
            class="oc-btn btn-print"
            style="
              flex:0;
              padding:2px 6px;
              font-size:9px;
            "
            onclick="printKitchenOrder(${index})">
            Print
          </button>
        </div>

        <div style="
          display:flex;
          flex-direction:column;
          gap:3px;
          margin:4px 0 12px;
        ">
          <span style="
            font-size:13px;
            color:#d0d0d0;
          ">
            ${escapeKitchenPrintText(relativeTime)}
          </span>

          <span style="
            font-size:12px;
            color:#888;
          ">
            ${escapeKitchenPrintText(fullDate)}
          </span>
        </div>

        <div class="oc-items">
          ${itemsHtml}
        </div>

        ${noteHtml}

        <!-- ORDER TOTAL — NO DISCOUNT DISPLAY -->

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          padding-top:10px;
          margin-top:4px;
          border-top:1px solid rgba(255,255,255,0.08);
        ">
          <strong style="
            font-size:14px;
            color:#f0f0f0;
          ">
            Order Total
          </strong>

          <strong style="
            font-size:16px;
            color:#fff;
            white-space:nowrap;
          ">
            ${Number(ord.total || 0).toFixed(2)} LE
          </strong>
        </div>

        <div style="
          display:flex;
          justify-content:flex-end;
          align-items:center;
          margin-top:8px;
        ">
          <span class="oc-status" style="
            background:${statusBg};
            color:white;
          ">
            ${statusText}
          </span>
        </div>

        <div class="oc-buttons">
          <button
            class="oc-btn btn-done"
            style="${doneBtnDisabled}"
            ${ord.status === 'done' ? 'disabled' : ''}
            onclick="updateOrderStatus(${index}, 'done')">
            Done
          </button>

          <button
            class="oc-btn btn-k-cancel"
            style="${cancelBtnDisabled}"
            ${ord.status === 'cancelled' ? 'disabled' : ''}
            onclick="updateOrderStatus(${index}, 'cancelled')">
            Cancel
          </button>
        </div>

      </div>
    `;
  });

  container.innerHTML = html;
}





/* =========================================================
   UPDATE ORDER STATUS
   ========================================================= */


async function updateOrderStatus(index, newStatus) {
  /*
   * AUTHORIZATION
   * Admin and Tux Admin can change kitchen order statuses.
   * Workers retain their existing behavior.
   */

  const activeRole =
    typeof getActiveRole === 'function'
      ? getActiveRole()
      : null;

  const isAdmin =
    activeRole === 'admin' ||
    activeRole === 'tuxadmin';

  const activeWorkers =
    typeof getActiveWorkers === 'function'
      ? getActiveWorkers()
      : [];

  if (
    !isAdmin &&
    activeWorkers.length === 0
  ) {
    alert('Please login as staff first.');
    return;
  }

  /*
   * FIND ORDER
   */

  const ord = kitchenOrders[index];

  if (!ord) {
    return;
  }

  if (!ord.supabaseId) {
    alert(
      'This order is not connected to Supabase.'
    );
    return;
  }

  /*
   * VALIDATE STATUS
   */

  const allowedStatuses = [
    'preparing',
    'done',
    'cancelled'
  ];

  if (!allowedStatuses.includes(newStatus)) {
    alert('Invalid order status.');
    return;
  }

  /*
   * DEDUCT STOCK ONLY WHEN TRANSITIONING TO DONE
   */

  if (
    ord.status !== 'done' &&
    newStatus === 'done'
  ) {
    if (
      typeof deductStockForOrder !== 'function'
    ) {
      alert('Stock service is not available.');
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
   * SAVE STATUS TO SUPABASE
   */

  let updatedOrder;

  try {
    updatedOrder =
      await updateOrderStatusInSupabase(
        ord.supabaseId,
        newStatus
      );
  } catch (error) {
    console.error(
      'TUX POS — Failed to update order status:',
      error
    );

    alert(
      'Could not update the order status in Supabase.'
    );

    return;
  }

  if (!updatedOrder) {
    alert(
      'Could not update the order status in Supabase.'
    );
    return;
  }

  ord.status = updatedOrder.status;

  /*
   * UPDATE MATCHING LOCAL SALES RECORDS
   */

  if (Array.isArray(completedSales)) {
    completedSales.forEach(function (sale) {
      if (sale.orderNum === ord.orderNum) {
        sale.status = updatedOrder.status;
      }
    });
  }

  /*
   * REFRESH UI
   */

  if (typeof renderKitchenBoard === 'function') {
    renderKitchenBoard();
  }

  if (typeof renderSalesReport === 'function') {
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
   TUX branded receipt with logo and menu image.
   Preserves order items, extras, notes, and total.
   ========================================================= */

/* =========================================================
   PRINT KITCHEN ORDER
   TUX Receipt + Logo + Scannable Menu QR Code
   Includes items, extras, notes, payment summary and footer.
   ========================================================= */


async function printKitchenOrder(index) {

  /* =========================================================
     GET ORDER
     ========================================================= */

  const ord = kitchenOrders[index];

  if (!ord) {
    alert('Order not found!');
    return;
  }

  console.log('PRINT ORDER DATA:', ord);

  /* =========================================================
     HELPERS
     ========================================================= */

  function money(amount) {
    return 'E£' + Number(amount || 0).toFixed(2);
  }

  function escape(value) {
    return escapeKitchenPrintText(value);
  }

  /* =========================================================
     LOAD SHARED PRINT SETTINGS
     ========================================================= */

  let printSettings = {
    print_format: 'thermal',
    thermal_width_mm: 80
  };

  try {
    if (typeof getTuxPrintSettings === 'function') {
      printSettings = await getTuxPrintSettings();
    } else {
      console.warn(
        'Shared print settings service unavailable. Using 80 mm thermal.'
      );
    }
  } catch (error) {
    console.error(
      'Could not load shared print settings:',
      error
    );

    alert(
      'Could not load the shared print settings. ' +
      'Please check your connection and try printing again.'
    );

    return;
  }

  const printFormat =
    printSettings.print_format === 'a4'
      ? 'a4'
      : 'thermal';

  const thermalWidthMm =
    Math.max(
      20,
      Math.min(
        300,
        Number(printSettings.thermal_width_mm) || 80
      )
    );

  /* =========================================================
     ORDER INFORMATION
     ========================================================= */

  const orderId =
    ord.supabaseId ||
    ord.id ||
    null;

  const orderNum =
    ord.orderNum ??
    ord.order_number ??
    ord.orderNumber ??
    'N/A';

  let total = Number(ord.total || 0);

  let discount = Number(ord.discount || 0);

  let subtotal = Number(
    ord.subtotal ??
    ord.sub_total ??
    0
  );

  /* =========================================================
     DELIVERY FEE AND SAVED ORDER TOTALS
     ========================================================= */

  let deliveryFee = Number(
    ord.deliveryFee ??
    ord.delivery_fee ??
    0
  );

  if (
    orderId &&
    typeof supabaseClient !== 'undefined'
  ) {
    try {
      const {
        data: savedOrder,
        error
      } = await supabaseClient
        .from('orders')
        .select(
          'delivery_fee, total, subtotal, discount'
        )
        .eq('id', orderId)
        .maybeSingle();

      if (error) {
        console.error(
          'Could not retrieve saved order totals:',
          error
        );
      } else if (savedOrder) {
        deliveryFee = Number(
          savedOrder.delivery_fee ?? deliveryFee
        );

        total = Number(
          savedOrder.total ?? total
        );

        subtotal = Number(
          savedOrder.subtotal ?? subtotal
        );

        discount = Number(
          savedOrder.discount ?? discount
        );
      }
    } catch (error) {
      console.error(
        'Saved order lookup failed:',
        error
      );
    }
  }

  /* =========================================================
     PAYMENT INFORMATION
     ========================================================= */

  const paymentMethod =
    typeof getKitchenPaymentMethod === 'function'
      ? getKitchenPaymentMethod(ord)
      : 'Not specified';

  const workerName =
    ord.staffName ||
    ord.staff_name ||
    'Not specified';

  const orderType =
    ord.orderType ||
    ord.order_type ||
    'Not specified';

  const cashPaid = Number(
    ord.cashPaid ??
    ord.cash_paid ??
    0
  );

  const visaPaid = Number(
    ord.visaPaid ??
    ord.visa_paid ??
    0
  );

  const instaPaid = Number(
    ord.instaPaid ??
    ord.insta_paid ??
    0
  );

  const note = String(
    ord.note || ''
  ).trim();

  /* =========================================================
     ORDER ITEMS
     ========================================================= */

  const items = Array.isArray(ord.items)
    ? ord.items
    : Array.isArray(ord.order_items)
      ? ord.order_items
      : Array.isArray(ord.savedItems)
        ? ord.savedItems
        : [];

  let itemsSubtotal = 0;
  let itemsHTML = '';

  items.forEach(function (item) {

    const itemName = item.name || 'Item';

    const quantity = Number(
      item.qty ??
      item.quantity ??
      1
    );

    const price = Number(item.price || 0);

    const lineTotal = price * quantity;

    itemsSubtotal += lineTotal;

    itemsHTML += `
      <tr>
        <td>${escape(itemName)}</td>
        <td class="numeric">${quantity}</td>
        <td class="numeric">${money(price)}</td>
        <td class="numeric">${money(lineTotal)}</td>
      </tr>
    `;

    const extras = Array.isArray(item.extras)
      ? item.extras
      : [];

    extras.forEach(function (extra) {

      const extraName =
        typeof getKitchenExtraName === 'function'
          ? getKitchenExtraName(extra)
          : (
              typeof extra === 'string'
                ? extra
                : extra.name || 'Extra'
            );

      const extraPrice = Number(
        typeof getKitchenExtraPrice === 'function'
          ? getKitchenExtraPrice(extra)
          : (
              typeof extra === 'object'
                ? extra.price || 0
                : 0
            )
      );

      const extraTotal = extraPrice * quantity;

      itemsSubtotal += extraTotal;

      itemsHTML += `
        <tr class="extra-row">
          <td>&nbsp;&nbsp;+ ${escape(extraName)}</td>
          <td class="numeric">${quantity}</td>
          <td class="numeric">${money(extraPrice)}</td>
          <td class="numeric">${money(extraTotal)}</td>
        </tr>
      `;

    });

  });

  /* =========================================================
     SUBTOTAL FALLBACK
     ========================================================= */

  if (!Number.isFinite(subtotal) || subtotal < 0) {
    subtotal = itemsSubtotal;
  }

  /* =========================================================
     RECEIPT HTML
     ========================================================= */

  const logoPath = 'assets/tux-logo.jpeg';
  const menuImagePath = 'menu.jpg';

  const date = new Date(
    ord.createdAt ||
    ord.created_at ||
    Date.now()
  );

  const pageCSS = printFormat === 'a4'
    ? `
      @page {
        size: A4;
        margin: 12mm;
      }

      body {
        width: 100%;
        max-width: none;
        margin: 0;
        padding: 0;
        font-size: 12px;
      }

      .logo {
        width: 110px;
        max-height: 110px;
      }

      .brand {
        font-size: 28px;
      }

      table {
        font-size: 12px;
      }

      th,
      td {
        padding: 8px 6px;
      }

      .extra-row {
        font-size: 11px;
      }

      .grand-total {
        font-size: 20px;
      }

      .menu-image {
        max-width: 100%;
        width: auto;
        max-height: 180mm;
        object-fit: contain;
      }
    `
    : `
      @page {
        size: ${thermalWidthMm}mm auto;
        margin: 0;
      }

      body {
        width: ${thermalWidthMm}mm;
        max-width: ${thermalWidthMm}mm;
        margin: 0 auto;
        padding: 3mm;
        font-size: 12px;
      }

      .logo {
        width: 90px;
        max-height: 90px;
      }

      .brand {
        font-size: 23px;
      }

      table {
        font-size: 10px;
      }

      th,
      td {
        padding: 5px 2px;
      }

      .extra-row {
        font-size: 9px;
      }

      .grand-total {
        font-size: 16px;
      }

      .menu-image {
        width: 100%;
        height: auto;
      }
    `;

  const receiptHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">

      <title>TUX Receipt - Order #${escape(orderNum)}</title>

      <style>
        * {
          box-sizing: border-box;
        }

        html,
        body {
          font-family: Arial, sans-serif;
          color: #111;
        }

        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .header {
          text-align: center;
          margin-bottom: 12px;
        }

        .logo {
          object-fit: contain;
        }

        .brand {
          font-weight: 900;
          margin: 5px 0;
        }

        .divider {
          border-top: 1px dashed #333;
          margin: 10px 0;
        }

        .info-row,
        .summary-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin: 6px 0;
        }

        .info-row span:last-child,
        .summary-row strong {
          text-align: right;
          overflow-wrap: anywhere;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: auto;
        }

        th,
        td {
          border-bottom: 1px dotted #ccc;
          vertical-align: top;
        }

        th {
          border-top: 1px solid #111;
          border-bottom: 1px solid #111;
        }

        th:first-child,
        td:first-child {
          text-align: left;
          overflow-wrap: anywhere;
        }

        .numeric {
          text-align: right;
          white-space: nowrap;
        }

        .delivery-row {
          font-weight: bold;
        }

        .grand-total {
          font-weight: 900;
          border-top: 2px solid #111;
          border-bottom: 2px solid #111;
          padding: 8px 0;
          margin-top: 10px;
        }

        .note-box {
          border: 1px dashed #333;
          padding: 8px;
          margin-top: 10px;
          overflow-wrap: anywhere;
        }

        .footer,
        .qr-section,
        .menu-section {
          text-align: center;
          margin-top: 15px;
          line-height: 1.5;
        }

        #qrcode {
          display: flex;
          justify-content: center;
          margin: 8px auto;
        }

        .menu-image {
          height: auto;
        }

        ${pageCSS}

        @media print {
          body {
            break-inside: auto;
          }

          table,
          .summary-row,
          .note-box {
            break-inside: avoid;
          }
        }
      </style>
    </head>

    <body>

      <div class="header">
        <img
          src="${logoPath}"
          class="logo"
          alt="TUX Logo"
          onerror="this.style.display='none'"
        >

        <div class="brand">TUX Burger Truck</div>
        <div>Order Receipt</div>
      </div>

      <div class="divider"></div>

      <div class="info-row">
        <span>Order Number</span>
        <strong>#${escape(orderNum)}</strong>
      </div>

      <div class="info-row">
        <span>Date</span>
        <span>${escape(date.toLocaleDateString())}</span>
      </div>

      <div class="info-row">
        <span>Time</span>
        <span>
          ${escape(
            ord.time ||
            date.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })
          )}
        </span>
      </div>

      <div class="info-row">
        <span>Staff</span>
        <span>${escape(workerName)}</span>
      </div>

      <div class="info-row">
        <span>Order Type</span>
        <span>${escape(orderType)}</span>
      </div>

      <div class="info-row">
        <span>Payment Method</span>
        <span>${escape(paymentMethod)}</span>
      </div>

      <div class="divider"></div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="numeric">Qty</th>
            <th class="numeric">Price</th>
            <th class="numeric">Total</th>
          </tr>
        </thead>

        <tbody>
          ${itemsHTML || `
            <tr>
              <td colspan="4">No items found</td>
            </tr>
          `}
        </tbody>
      </table>

      <div class="divider"></div>

      <div class="summary-row">
        <span>Items Subtotal</span>
        <strong>${money(itemsSubtotal)}</strong>
      </div>

      <div class="summary-row delivery-row">
        <span>Delivery Fee</span>
        <strong>${money(deliveryFee)}</strong>
      </div>

      ${
        discount > 0
          ? `
            <div class="summary-row">
              <span>Discount</span>
              <strong>-${money(discount)}</strong>
            </div>
          `
          : ''
      }

      <div class="summary-row grand-total">
        <span>TOTAL</span>
        <strong>${money(total)}</strong>
      </div>

      <div class="summary-row">
        <span>Paid by Cash</span>
        <strong>${money(cashPaid)}</strong>
      </div>

      <div class="summary-row">
        <span>Paid by Visa</span>
        <strong>${money(visaPaid)}</strong>
      </div>

      <div class="summary-row">
        <span>Paid by InstaPay</span>
        <strong>${money(instaPaid)}</strong>
      </div>

      <div class="summary-row">
        <span>Cash Received</span>
        <strong>Not recorded</strong>
      </div>

      <div class="summary-row">
        <span>Change</span>
        <strong>Not recorded</strong>
      </div>

      ${
        note
          ? `
            <div class="note-box">
              <strong>ORDER NOTE</strong>
              <div>${escape(note)}</div>
            </div>
          `
          : ''
      }

      <div class="footer">
        Thank you for ordering from TUX!
        <br>
        For delivery, call:
        <br>
        <strong>011-5196-0048</strong>
      </div>

      <div class="qr-section">
        <div>Scan to view our menu</div>
        <div id="qrcode"></div>
      </div>

      <div class="menu-section">
        <strong>Our Menu</strong>

        <img
          src="${menuImagePath}"
          class="menu-image"
          alt="TUX Menu"
          onerror="this.style.display='none'"
        >
      </div>

      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>

      <script>
        window.onload = function () {
          try {
            if (typeof QRCode !== 'undefined') {
              new QRCode(
                document.getElementById('qrcode'),
                {
                  text: '${menuImagePath}',
                  width: 110,
                  height: 110
                }
              );
            }
          } catch (error) {
            console.error(
              'QR code generation failed:',
              error
            );
          }

          setTimeout(function () {
            window.print();
          }, 700);
        };
      <\/script>

    </body>
    </html>
  `;

  /* =========================================================
     OPEN PRINT WINDOW
     ========================================================= */

  const printWindow = window.open(
    '',
    '_blank',
    'width=420,height=750'
  );

  if (!printWindow) {
    alert('Please allow pop-ups to print the receipt.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(receiptHTML);
  printWindow.document.close();

}







