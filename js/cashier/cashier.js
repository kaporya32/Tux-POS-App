
/* =========================================================
   TUX POS — CASHIER
   Menu grid, extras, cart, payments, send order, Gam3ya,
   WhatsApp, menu management, and low-stock blocking.
   ========================================================= */

/* =========================================================
   ADMIN VIEW-ONLY PROTECTION
   ========================================================= */

function isTuxPosCashierAdminReadOnly() {
  return (
    typeof adminActive !== 'undefined' &&
    adminActive === true
  );
}

function blockTuxPosCashierMutation(action) {
  if (!isTuxPosCashierAdminReadOnly()) {
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
   LOGIN GUARD
   ========================================================= */

function requireStaffLogin() {
  if (getActiveWorkers().length === 0) {
    alert('Please login as staff first.');
    openStaffLogin();
    return false;
  }

  return true;
}

/* =========================================================
   CATEGORY CLASS
   ========================================================= */

function getMenuCategoryClass(category) {
  const normalizedCategory =
    String(category || '').trim().toLowerCase();

  const categoryMap = {
    sandwiches: 'category-sandwiches',
    combos: 'category-combos',
    fries: 'category-fries',
    hawawshi: 'category-hawawshi',
    drinks: 'category-drinks',
    dessert: 'category-zalabya',
    zalabya: 'category-zalabya',
    extras: 'category-extras'
  };

  return (
    categoryMap[normalizedCategory] ||
    'category-default'
  );
}

/* =========================================================
   MENU CARD
   ========================================================= */

function menuCardHtml(category, item, idx, extraStyle) {
  const categoryClass =
    getMenuCategoryClass(category);

  const safeName =
    escapeHtmlPw(item.name);

  const safePrice =
    Number(item.price || 0);

  return `
    <div
      class="item-card ${categoryClass}"
      data-category="${escapeHtmlPw(category)}"
      style="${extraStyle || ''}"
      data-name="${safeName}"
      onclick="addItem(this.dataset.name, ${safePrice})"
    >
      <span class="item-name">${safeName}</span>
      <span class="item-price">${safePrice.toFixed(2)} LE</span>
    </div>
  `;
}

/* =========================================================
   MENU
   ========================================================= */

function renderMenu() {
  const container =
    document.getElementById('menuPanelContainer');

  if (!container) return;

  let html = '';

  html += `
    <div class="section-title category-title-sandwiches">
      SANDWICHES & BURGERS
    </div>

    <div
      class="menu-grid"
      style="grid-template-columns: repeat(4, 1fr);"
    >
  `;

  (menuItems.sandwiches || []).forEach(function (item, idx) {
    html += menuCardHtml('sandwiches', item, idx);
  });

  html += `
    </div>

    <div class="section-title category-title-combos">
      COMBOS (MEALS)
    </div>

    <div
      class="menu-grid"
      style="grid-template-columns: repeat(5, 1fr);"
    >
  `;

  (menuItems.combos || []).forEach(function (item, idx) {
    html += menuCardHtml('combos', item, idx);
  });

  html += `
    </div>

    <div class="section-title category-title-fries">
      FRIES & LOADED
    </div>

    <div
      class="menu-grid"
      style="grid-template-columns: repeat(3, 1fr);"
    >
  `;

  (menuItems.fries || []).forEach(function (item, idx) {
    html += menuCardHtml('fries', item, idx);
  });

  html += `
    </div>

    <div class="hawawshi-drinks-row">
      <div class="hawawshi-column">
        <div class="section-title category-title-hawawshi">
          HAWAWSHI
        </div>

        <div
          class="menu-grid"
          style="grid-template-columns: repeat(2, 1fr);"
        >
  `;

  (menuItems.hawawshi || []).forEach(function (item, idx) {
    html += menuCardHtml('hawawshi', item, idx);
  });

  html += `
        </div>
      </div>

      <div class="drinks-column">
        <div class="section-title category-title-drinks">
          DRINKS
        </div>

        <div
          class="menu-grid"
          style="grid-template-columns: repeat(2, 1fr);"
        >
  `;

  (menuItems.drinks || []).forEach(function (item, idx) {
    html += menuCardHtml('drinks', item, idx);
  });

  html += `
        </div>
      </div>
    </div>

    <div class="section-title category-title-zalabya">
      ZALABYA (DESSERT)
    </div>

    <div
      class="menu-grid"
      style="grid-template-columns: repeat(4, 1fr);"
    >
  `;

  (menuItems.dessert || []).forEach(function (item, idx) {
    html += menuCardHtml('dessert', item, idx);
  });

  html += '</div>';

  container.innerHTML = html;
}

/* =========================================================
   EXTRAS
   ========================================================= */

function renderExtras() {
  const container =
    document.getElementById('extrasGridContainer');

  if (!container) return;

  let html = '';

  (extrasItems || []).forEach(function (item) {
    const safeName =
      escapeHtmlPw(item.name);

    const safePrice =
      Number(item.price || 0);

    html += `
      <div
        class="item-card category-extras"
        data-category="extras"
        data-name="${safeName}"
        onclick="addItem(this.dataset.name, ${safePrice})"
      >
        <span class="item-name">${safeName}</span>
        <span class="item-price">${safePrice.toFixed(2)} LE</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* =========================================================
   MENU MANAGEMENT — DELETE SELECT
   ========================================================= */

function populateDeleteMenuSelect() {
  const select =
    document.getElementById('deleteMenuItemSelect');

  if (!select) return;

  select.innerHTML = '';

  Object.keys(menuItems).forEach(function (cat) {
    const arr = menuItems[cat];

    if (!Array.isArray(arr)) return;

    arr.forEach(function (item) {
      const opt = document.createElement('option');

      opt.value = 'menu:' + item.id;

      opt.textContent =
        (MENU_CATEGORY_LABELS[cat] || cat) +
        ' - ' +
        item.name +
        ' (' +
        Number(item.price).toFixed(2) +
        ' LE)';

      select.appendChild(opt);
    });
  });

  (extrasItems || []).forEach(function (item) {
    const opt = document.createElement('option');

    opt.value = 'extra:' + item.id;

    opt.textContent =
      (MENU_CATEGORY_LABELS.extras || 'Extras') +
      ' - ' +
      item.name +
      ' (' +
      Number(item.price).toFixed(2) +
      ' LE)';

    select.appendChild(opt);
  });
}

/* =========================================================
   DELETE MENU ITEM
   ========================================================= */

async function deleteMenuItem() {
  if (blockTuxPosCashierMutation('delete menu items')) {
    return;
  }

  const select =
    document.getElementById('deleteMenuItemSelect');

  if (!select || !select.value) return;

  const parts = select.value.split(':');
  const type = parts[0];
  const itemId = parts.slice(1).join(':');

  if (!itemId) return;

  if (type === 'menu') {
    let foundItem = null;
    let foundCategory = null;

    Object.keys(menuItems).some(function (cat) {
      const arr = menuItems[cat];

      if (!Array.isArray(arr)) return false;

      const item = arr.find(function (entry) {
        return String(entry.id) === String(itemId);
      });

      if (item) {
        foundItem = item;
        foundCategory = cat;
        return true;
      }

      return false;
    });

    if (!foundItem) {
      alert('Menu item could not be found.');
      return;
    }

    if (!confirm('Delete "' + foundItem.name + '" from the menu?')) {
      return;
    }

    try {
      await deleteMenuItemFromSupabase(foundItem.id);

      menuItems[foundCategory] =
        menuItems[foundCategory].filter(function (item) {
          return String(item.id) !== String(foundItem.id);
        });

      if (allSellableItemNames().indexOf(foundItem.name) === -1) {
        delete recipes[foundItem.name];
        saveRecipesToStorage();
      }

      renderMenu();
      renderExtras();
      populateRecipeItemSelect();
      populateDeleteMenuSelect();

      alert('Item deleted from the menu.');
    } catch (error) {
      console.error(
        'TUX POS — Failed to delete menu item:',
        error
      );

      alert('Failed to delete the menu item. Please try again.');
    }

    return;
  }

  if (type === 'extra') {
    const item = (extrasItems || []).find(function (entry) {
      return String(entry.id) === String(itemId);
    });

    if (!item) {
      alert('Extra could not be found.');
      return;
    }

    if (!confirm('Delete "' + item.name + '" from the extras?')) {
      return;
    }

    try {
      await deleteExtraFromSupabase(item.id);

      extrasItems = extrasItems.filter(function (extra) {
        return String(extra.id) !== String(item.id);
      });

      renderMenu();
      renderExtras();
      populateRecipeItemSelect();
      populateDeleteMenuSelect();

      alert('Extra deleted from the menu.');
    } catch (error) {
      console.error(
        'TUX POS — Failed to delete extra:',
        error
      );

      alert('Failed to delete the extra. Please try again.');
    }
  }
}

/* =========================================================
   ADD NEW MENU ITEM
   ========================================================= */

async function addNewMenuItem() {
  if (blockTuxPosCashierMutation('add menu items')) {
    return;
  }

  const nameInput =
    document.getElementById('newMenuItemName');

  const priceInput =
    document.getElementById('newMenuItemPrice');

  const categoryInput =
    document.getElementById('newMenuItemCategory');

  if (!nameInput || !priceInput || !categoryInput) {
    alert('Menu item form could not be found.');
    return;
  }

  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value);
  const cat = categoryInput.value;

  if (!name || isNaN(price) || price < 0) {
    alert('Please enter a valid item name and price!');
    return;
  }

  try {
    if (cat === 'extras') {
      await addExtraToSupabase(name, price);
      renderExtras();
    } else {
      await addMenuItemToSupabase(name, price, cat);
      renderMenu();
    }

    nameInput.value = '';
    priceInput.value = '';

    populateRecipeItemSelect();
    populateDeleteMenuSelect();

    alert('Item added successfully!');
  } catch (error) {
    console.error(
      'TUX POS — Failed to add menu item:',
      error
    );

    alert('Failed to add the item. Please try again.');
  }
}

/* =========================================================
   CURRENT ORDER
   ========================================================= */

function addItem(name, price) {
  if (blockTuxPosCashierMutation('add items to the order')) {
    return;
  }

  if (!requireStaffLogin()) return;
  if (!requireActiveShift()) return;

  const existing = currentOrder.find(function (item) {
    return item.name === name;
  });

  if (existing) {
    existing.qty += 1;
  } else {
    currentOrder.push({
      name: name,
      price: price,
      qty: 1
    });
  }

  updateOrderUI();
}

function changeQty(index, delta) {
  if (blockTuxPosCashierMutation('change order quantities')) {
    return;
  }

  if (!requireStaffLogin()) return;
  if (!currentOrder[index]) return;

  currentOrder[index].qty += delta;

  if (currentOrder[index].qty <= 0) {
    currentOrder.splice(index, 1);
  }

  updateOrderUI();
}

function removeItem(index) {
  if (blockTuxPosCashierMutation('remove items from the order')) {
    return;
  }

  if (!requireStaffLogin()) return;
  if (!currentOrder[index]) return;

  currentOrder.splice(index, 1);
  updateOrderUI();
}

function cancelLastItem() {
  if (blockTuxPosCashierMutation('cancel order items')) {
    return;
  }

  if (!requireStaffLogin()) return;

  if (currentOrder.length > 0) {
    currentOrder.pop();
    updateOrderUI();
  } else {
    alert('Order is already empty!');
  }
}

/* =========================================================
   ORDER UI
   ========================================================= */

function updateOrderUI() {
  const container =
    document.getElementById('cartContent');

  const totalEl =
    document.getElementById('grandTotal');

  if (!container || !totalEl) return;

  if (currentOrder.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>No items yet</strong>
        Add products from the menu
      </div>
    `;

    totalEl.innerText = '0.00';
    calcRemaining();
    return;
  }

  let html = '';
  let total = 0;

  currentOrder.forEach(function (item, index) {
    const itemTotal = item.price * item.qty;
    total += itemTotal;

    html += `
      <div class="cart-item">
        <span
          class="cart-item-name"
          title="${escapeHtmlPw(item.name)}"
        >
          ${escapeHtmlPw(item.name)}
        </span>

        <div class="cart-item-qty">
          <div class="qty-controls">
            <button
              class="qty-btn"
              onclick="changeQty(${index}, -1)"
            >-</button>

            <span class="cart-qty-value">${item.qty}</span>

            <button
              class="qty-btn"
              onclick="changeQty(${index}, 1)"
            >+</button>
          </div>
        </div>

        <span class="cart-item-total">
          ${itemTotal.toFixed(2)}

          <span
            class="cart-item-delete"
            onclick="removeItem(${index})"
            title="Delete"
          >🗑️</span>
        </span>
      </div>
    `;
  });

  container.innerHTML = html;
  totalEl.innerText = total.toFixed(2);

  calcRemaining();
}

/* =========================================================
   PAYMENT CALCULATION
   ========================================================= */

function calcRemaining() {
  const total =
    parseFloat(
      document.getElementById('grandTotal')?.innerText
    ) || 0;

  const cash =
    parseFloat(
      document.getElementById('cashPaid')?.value
    ) || 0;

  const insta =
    parseFloat(
      document.getElementById('instaPaid')?.value
    ) || 0;

  const visa =
    parseFloat(
      document.getElementById('visaPaid')?.value
    ) || 0;

  const disc =
    parseFloat(
      document.getElementById('discount')?.value
    ) || 0;

  const paid = cash + insta + visa + disc;
  const diff = total - paid;

  const diffText =
    document.getElementById('diffText');

  if (!diffText) return;

  diffText.innerText =
    'Diff: ' + diff.toFixed(2) + ' EGP';

  diffText.style.color =
    Math.abs(diff) < 0.01 ? 'green' : '#ff4757';
}

/* =========================================================
   CLEAR ORDER
   ========================================================= */

function clearOrder() {
  if (blockTuxPosCashierMutation('clear the current order')) {
    return;
  }

  currentOrder = [];

  const cash = document.getElementById('cashPaid');
  const insta = document.getElementById('instaPaid');
  const visa = document.getElementById('visaPaid');
  const discount = document.getElementById('discount');

  if (cash) cash.value = 0;
  if (insta) insta.value = 0;
  if (visa) visa.value = 0;
  if (discount) discount.value = 0;

  updateOrderUI();
}


/* =========================================================
   SEND ORDER TO KITCHEN
   Blocks the order when any active stock item is low.
   ========================================================= */


/* =========================================================
   SEND ORDER TO KITCHEN
   1. Validate order and payment.
   2. Validate extra quantities.
   3. Validate ingredient availability.
   4. Save and send the order.
   ========================================================= */


async function sendOrder() {
  if (
    blockTuxPosCashierMutation(
      'send orders to the kitchen'
    )
  ) {
    return;
  }

  if (!requireActiveShift()) return;

  const activeWorkers = getActiveWorkers();

  if (activeWorkers.length === 0) {
    alert('Please login as staff first.');
    openStaffLogin();
    return;
  }

  if (
    !Array.isArray(currentOrder) ||
    currentOrder.length === 0
  ) {
    alert('Order is empty!');
    return;
  }

  /* =====================================================
     STEP 1 — VALIDATE PAYMENT
     ===================================================== */

  const total =
    parseFloat(
      document.getElementById('grandTotal')?.innerText
    ) || 0;

  const cash =
    parseFloat(
      document.getElementById('cashPaid')?.value
    ) || 0;

  const insta =
    parseFloat(
      document.getElementById('instaPaid')?.value
    ) || 0;

  const visa =
    parseFloat(
      document.getElementById('visaPaid')?.value
    ) || 0;

  const disc =
    parseFloat(
      document.getElementById('discount')?.value
    ) || 0;

  const paid = cash + insta + visa + disc;

  if (Math.abs(total - paid) > 0.01) {
    alert(
      'Error: Payment and discount total must equal order total exactly!'
    );
    return;
  }

  /* =====================================================
     STEP 2 — VALIDATE EXTRA QUANTITIES
     ===================================================== */

  let totalSandwichesCount = 0;
  let totalExtrasWithCondition = 0;

  currentOrder.forEach(function (item) {
    const n = String(item.name || '').toLowerCase();

    if (
      n.includes('smashed') ||
      n.includes('tuxify') ||
      n.includes('hawawshi') ||
      n.includes('double double') ||
      n.includes('single double') ||
      n.includes('quad') ||
      n.includes('johnny') ||
      n.includes('twowawshi')
    ) {
      totalSandwichesCount += Number(item.qty || 0);
    }

    if (
      n.includes('extra wedges') ||
      n.includes('extra tux fries') ||
      n.includes('extra doppy fries')
    ) {
      totalExtrasWithCondition += Number(item.qty || 0);
    }
  });

  if (
    totalExtrasWithCondition >
    totalSandwichesCount
  ) {
    alert(
      'Warning: Extra items (Wedges, Tux Fries, Doppy Fries) cannot exceed the number of sandwiches in the order!'
    );
    return;
  }

  /* =====================================================
     STEP 3 — PREPARE ORDER
     Stock availability does NOT block orders.
     Stock is allowed to become negative.
     ===================================================== */

  const currentWorker = activeWorkers[0];

  const orderData = {
    items: [...currentOrder],
    total: total,
    cashPaid: cash,
    instaPaid: insta,
    visaPaid: visa,
    discount: disc,

    orderNum: orderCounter++,

    time: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }),

    status: 'preparing',

    staffId: currentWorker.id,
    staffName: currentWorker.name,

    activeStaff: activeWorkers.map(function (worker) {
      return {
        id: worker.id,
        name: worker.name
      };
    })
  };

  /* =====================================================
     STEP 4 — SAVE TO SUPABASE
     ===================================================== */

  let savedOrder;

  try {
    savedOrder =
      await saveOrderToSupabase(orderData);
  } catch (error) {
    console.error(
      'TUX POS — Failed to save order:',
      error
    );

    orderCounter--;

    alert(
      'Failed to send the order to the kitchen. Please try again.'
    );

    return;
  }

  if (!savedOrder) {
    orderCounter--;
    return;
  }

  /* =====================================================
     STEP 5 — UPDATE LOCAL ORDER LISTS
     ===================================================== */

  orderData.supabaseId = savedOrder.id;

  kitchenOrders.unshift(orderData);
  completedSales.unshift(orderData);

  renderSalesReport();
  saveCurrentShiftData();

  alert(
    'Order #' +
    orderData.orderNum +
    ' sent to kitchen successfully!'
  );

  clearOrder();
}


/* =========================================================
   GAM3YA
   ========================================================= */

/* =========================================================
   GAM3YA
   1. Validate worker and shift.
   2. Confirm worker password.
   3. Check required ingredient stock.
   4. Save Gam3ya to Supabase.
   5. Deduct stock after successful save.
   ========================================================= */

async function sendToGamiya() {
  if (
    blockTuxPosCashierMutation(
      'register Gam3ya meals'
    )
  ) {
    return;
  }

  if (!requireStaffLogin()) return;
  if (!requireActiveShift()) return;

  if (
    !Array.isArray(currentOrder) ||
    currentOrder.length === 0
  ) {
    alert('Order is empty!');
    return;
  }

  /* STEP 1 — CONFIRM WORKER PASSWORD */

  let password = prompt(
    "Enter the worker's password to confirm this is his Gam3ya meal:"
  );

  if (password === null) return;

  password = password.trim();

  if (!password) {
    alert('Please enter a password.');
    return;
  }

  const worker = workersList.find(function (w) {
    return String(w.password) === String(password);
  });

  let workerIdForRecord = null;
  let workerNameForRecord = '';

  if (worker) {
    workerIdForRecord = worker.id;
    workerNameForRecord = worker.name;
  } else if (
    typeof adminAccount !== 'undefined' &&
    adminAccount &&
    String(password) === String(adminAccount.password)
  ) {
    workerIdForRecord = 'admin_account';
    workerNameForRecord = adminAccount.name;
  } else {
    alert('Incorrect password!');
    return;
  }

  /* STEP 2 — CALCULATE MEAL TOTAL */

  let total = 0;

  currentOrder.forEach(function (item) {
    total +=
      Number(item.price || 0) *
      Number(item.qty || 0);
  });

  /* STEP 3 — CHECK INGREDIENT STOCK BEFORE SAVING */

  let lowStockItems;

  try {
    if (
      typeof getCashierLowStockItems !== 'function'
    ) {
      throw new Error(
        'The stock validation function is unavailable.'
      );
    }

    lowStockItems =
      getCashierLowStockItems(currentOrder);
  } catch (error) {
    console.error(
      'TUX POS — Gam3ya stock validation failed:',
      error
    );

    alert(
      'Could not verify stock availability. ' +
      'The Gam3ya meal was NOT registered.\n\n' +
      (error.message || String(error))
    );

    return;
  }

  if (!Array.isArray(lowStockItems)) {
    alert(
      'Could not verify stock availability. ' +
      'The Gam3ya meal was NOT registered.'
    );

    return;
  }

  if (lowStockItems.length > 0) {
    if (
      typeof showCashierLowStockPopup === 'function'
    ) {
      showCashierLowStockPopup(lowStockItems);
    } else {
      alert(
        'Insufficient stock. The Gam3ya meal was NOT registered.\n\n' +
        lowStockItems.map(function (item) {
          return (
            item.name +
            ': required ' + item.required +
            ', available ' + item.current +
            ', short by ' + item.shortBy
          );
        }).join('\n')
      );
    }

    return;
  }

  /* STEP 4 — PREPARE GAM3YA RECORD */

  const record = {
    shiftId: currentShift ? currentShift.id : null,
    workerId: workerIdForRecord,
    workerName: workerNameForRecord,
    items: currentOrder.map(function (item) {
      return {
        name: item.name,
        price: Number(item.price || 0),
        qty: Number(item.qty || 0)
      };
    }),
    total: total,
    time: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }),
    date: new Date().toLocaleDateString()
  };

  /* STEP 5 — SAVE GAM3YA TO SUPABASE */

  let savedGamiya;

  try {
    savedGamiya =
      await saveGamiyaToSupabase(record);
  } catch (error) {
    console.error(
      'TUX POS — Failed to save Gam3ya:',
      error
    );

    alert(
      'Failed to register the Gam3ya meal. Please try again.'
    );

    return;
  }

  if (!savedGamiya) return;

  /* STEP 6 — DEDUCT STOCK AFTER SUCCESSFUL SAVE */

  try {
    await deductStockForOrder({
      supabaseId: savedGamiya.id,
      type: 'gamiya',
      isGamiya: true,
      workerName: workerNameForRecord,
      items: record.items
    });
  } catch (error) {
    console.error(
      'TUX POS — Gam3ya stock deduction failed:',
      error
    );

    alert(
      'Gam3ya was registered, but stock deduction failed.\n\n' +
      (error.message || String(error))
    );

    return;
  }

  /* STEP 7 — CONFIRM SUCCESS */

  alert(
    workerNameForRecord +
    "'s meal has been registered in Gam3ya and deducted from stock."
  );

  clearOrder();
}
/* =========================================================
   GAM3YA VIEW
   ADMIN / TUX ADMIN ONLY
   ========================================================= */

function renderGamiyaView() {
  if (typeof getActiveRole === 'function') {
    const role = getActiveRole();

    if (role !== 'admin' && role !== 'tuxadmin') {
      return;
    }
  }

  const tbody =
    document.getElementById('gamiyaTableBody');

  const totalOrdersEl =
    document.getElementById('gamiyaTotalOrders');

  const totalItemsEl =
    document.getElementById('gamiyaTotalItems');

  const totalValueEl =
    document.getElementById('gamiyaTotalValue');

  const workerFilter =
    document.getElementById('gamiyaWorkerFilter');

  if (!tbody) return;

  if (workerFilter) {
    const oldValue = workerFilter.value || 'all';

    workerFilter.innerHTML =
      '<option value="all">All Workers</option>';

    (workersList || []).forEach(function (worker) {
      const option = document.createElement('option');

      option.value = worker.id;
      option.textContent = worker.name;

      workerFilter.appendChild(option);
    });

    if (
      typeof adminAccount !== 'undefined' &&
      adminAccount
    ) {
      const adminOption = document.createElement('option');

      adminOption.value = 'admin_account';
      adminOption.textContent = adminAccount.name + ' (Admin)';

      workerFilter.appendChild(adminOption);
    }

    if (
      [...workerFilter.options].some(function (option) {
        return String(option.value) === String(oldValue);
      })
    ) {
      workerFilter.value = oldValue;
    }
  }

  const selectedWorker =
    workerFilter ? workerFilter.value : 'all';

  const safeGamiyaOrders =
    Array.isArray(gamiyaOrders) ? gamiyaOrders : [];

  const orders =
    selectedWorker === 'all'
      ? safeGamiyaOrders
      : safeGamiyaOrders.filter(function (rec) {
          return String(rec.workerId) === String(selectedWorker);
        });

  if (orders.length === 0) {
    tbody.innerHTML =
      '<tr>' +
      '<td colspan="4" style="text-align:center; color:#666;">' +
      (
        selectedWorker === 'all'
          ? 'No staff meals recorded yet'
          : 'No Gam3ya meals recorded for this worker'
      ) +
      '</td>' +
      '</tr>';

    if (totalOrdersEl) totalOrdersEl.innerText = '0';
    if (totalItemsEl) totalItemsEl.innerText = '0';
    if (totalValueEl) totalValueEl.innerText = '0.00 LE';

    return;
  }

  let html = '';
  let totalItemsCount = 0;
  let totalValue = 0;

  orders.forEach(function (rec) {
    const safeItems =
      Array.isArray(rec.items) ? rec.items : [];

    const itemsText = safeItems.map(function (item) {
      return (
        escapeHtmlPw(item.name) +
        ' (x' +
        Number(item.qty || 0) +
        ')'
      );
    }).join(', ');

    safeItems.forEach(function (item) {
      totalItemsCount += Number(item.qty || 0);
    });

    totalValue += Number(rec.total || 0);

    html +=
      '<tr>' +
      '<td>' +
      escapeHtmlPw(rec.date) +
      ' - ' +
      escapeHtmlPw(rec.time) +
      '</td>' +
      '<td><strong>' +
      escapeHtmlPw(rec.workerName) +
      '</strong></td>' +
      '<td>' +
      itemsText +
      '</td>' +
      '<td style="color:#16a085; font-weight:bold;">' +
      Number(rec.total || 0).toFixed(2) +
      ' LE</td>' +
      '</tr>';
  });

  tbody.innerHTML = html;

  if (totalOrdersEl) {
    totalOrdersEl.innerText = orders.length;
  }

  if (totalItemsEl) {
    totalItemsEl.innerText = totalItemsCount;
  }

  if (totalValueEl) {
    totalValueEl.innerText =
      totalValue.toFixed(2) + ' LE';
  }
}

/* =========================================================
   WHATSAPP
   ========================================================= */

function sendToWhatsApp() {
  if (blockTuxPosCashierMutation('send orders through WhatsApp')) {
    return;
  }

  if (!requireStaffLogin()) return;

  if (!Array.isArray(currentOrder) || currentOrder.length === 0) {
    alert('Order is empty!');
    return;
  }

  const phoneInput =
    document.getElementById('whatsappNumber');

  if (!phoneInput) {
    alert('WhatsApp number field could not be found.');
    return;
  }

  const phone = phoneInput.value.trim();

  if (!phone) {
    alert('Please enter WhatsApp number first!');
    return;
  }

  const cleanPhone = phone.replace(/[^\d]/g, '');

  const total =
    document.getElementById('grandTotal')?.innerText || '0.00';

  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  let hours = now.getHours();

  const minutes =
    String(now.getMinutes()).padStart(2, '0');

  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12 || 12;

  const time =
    `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

  const dateTime =
    `${year}-${month}-${day} ${time}`;

  let msg =
    `TUX Restaurant
Tel: 01151960048

Thank you for choosing TUX! Your order is currently being prepared.

Order No.: ${orderCounter}
Date & Time: ${dateTime}

Order Details:
`;

  currentOrder.forEach(function (item) {
    const itemTotal = item.price * item.qty;

    msg +=
      `- ${item.qty}x ${item.name} = ${itemTotal.toFixed(0)} EGP\n`;

    if (item.extras && Array.isArray(item.extras)) {
      item.extras.forEach(function (extra) {
        const extraName =
          extra.name || extra.title || 'Extra';

        const extraPrice =
          Number(extra.price || 0);

        msg +=
          `  + ${extraName} = ${extraPrice.toFixed(0)} EGP\n`;
      });
    }
  });

  msg +=
    `
Total: ${total} EGP

We appreciate your order and hope you enjoy your meal!`;

  const whatsappUrl =
    `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;

  window.location.href = whatsappUrl;
}