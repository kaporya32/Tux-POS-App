
/* =========================================================
   TUX POS — CASHIER
   Menu grid, extras, cart, payments, send order, Gam3ya,
   WhatsApp, menu management, and low-stock blocking.
   ========================================================= */

/* =========================================================
ADMIN CASHIER PERMISSIONS
Admin and TUX Admin can process orders.
========================================================= */

function isTuxPosCashierAdminReadOnly() {
  // Admin and TUX Admin are allowed to process orders.
  // Keep this function for compatibility with existing code.
  return false;
}

function blockTuxPosCashierMutation(action) {
  // Cashier actions are allowed for Admin and TUX Admin.
  // Other existing permission checks remain in place.
  return false;
}


/* =========================================================
   LOGIN GUARD
   ========================================================= */


function requireStaffLogin() {
  const activeRole =
    typeof getActiveRole === 'function'
      ? getActiveRole()
      : null;

  // Admin and Tux Admin do not need a worker login.
  if (
    activeRole === 'admin' ||
    activeRole === 'tuxadmin' ||
    tuxAdminActive === true
  ) {
    return true;
  }

  // Preserve the existing worker login requirement.
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
  const normalizedCategory = String(category || '')
    .trim()
    .toLowerCase();

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

  if (categoryMap[normalizedCategory]) {
    return categoryMap[normalizedCategory];
  }

  const safeCategory = normalizedCategory
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return safeCategory
    ? `category-custom-${safeCategory}`
    : 'category-default';
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
  const container = document.getElementById('menuPanelContainer');

  if (!container) return;

  let html = '';

  // Existing categories and their current layout.
  const existingCategories = new Set([
    'sandwiches',
    'combos',
    'fries',
    'hawawshi',
    'drinks',
    'dessert',
    'zalabya',
    'extras'
  ]);

  // Render a category heading and its products.
  function renderCategory(category, title, columns) {
    const categoryClass = String(category || '')
      .trim()
      .toLowerCase();

    const safeCategoryClass = categoryClass
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const headerClass =
      categoryClass === 'dessert' || categoryClass === 'zalabya'
        ? 'zalabya'
        : safeCategoryClass || 'default';

    const items = Array.isArray(menuItems[category])
      ? menuItems[category]
      : [];

    html += `
      <div class="section-title category-title-${headerClass}">
        ${escapeHtmlPw(title)}
      </div>

      <div
        class="menu-grid"
        style="grid-template-columns: repeat(${columns}, 1fr);"
      >
    `;

    items.forEach(function (item, idx) {
      html += menuCardHtml(category, item, idx);
    });

    html += '</div>';
  }

  // 1. Sandwiches & Burgers.
  renderCategory('sandwiches', 'SANDWICHES & BURGERS', 4);

  // 2. Combos.
  renderCategory('combos', 'COMBOS (MEALS)', 5);

  // 3. Fries & Loaded.
  renderCategory('fries', 'FRIES & LOADED', 3);

  // 4. Hawawshi and Drinks retain their side-by-side layout.
  html += '<div class="hawawshi-drinks-row">';

  html += '<div class="hawawshi-column">';

  html += `
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

  html += '</div></div>';

  html += '<div class="drinks-column">';

  html += `
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

  html += '</div></div></div>';

  // 5. Zalabya.
  renderCategory('dessert', 'ZALABYA (DESSERT)', 4);



  // 7. Any new categories appear after the existing categories.
  Object.keys(menuItems || {}).forEach(function (category) {
    const normalizedCategory = String(category || '')
      .trim()
      .toLowerCase();

    if (existingCategories.has(normalizedCategory)) {
      return;
    }

    const items = menuItems[category];

    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const title = normalizedCategory
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, function (character) {
        return character.toUpperCase();
      });

    renderCategory(category, title, 4);
  });

  container.innerHTML = html;

  // Apply saved category colors after rebuilding the menu.
  if (typeof applyCategoryColorsToMenu === 'function') {
    applyCategoryColorsToMenu();
  }
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


/* =========================================================
   DELETE MENU ITEM
   Deletes menu items and extras through Supabase.
   Removes a recipe only when no remaining menu item
   uses the same name.
   ========================================================= */

async function deleteMenuItem() {

  if (
    typeof blockTuxPosMenuMutation === 'function' &&
    blockTuxPosMenuMutation('delete menu items')
  ) {
    return;
  }

  const select =
    document.getElementById('deleteMenuItemSelect');

  if (!select || !select.value) {
    return;
  }

  const parts = select.value.split(':');
  const type = parts[0];
  const itemId = parts.slice(1).join(':');

  if (!itemId) {
    return;
  }

  /* =====================================================
     DELETE MENU ITEM
     ===================================================== */

  if (type === 'menu') {
    let foundItem = null;
    let foundCategory = null;

    Object.keys(menuItems).some(function (category) {
      const items = menuItems[category];

      if (!Array.isArray(items)) {
        return false;
      }

      const item = items.find(function (entry) {
        return String(entry.id) === String(itemId);
      });

      if (item) {
        foundItem = item;
        foundCategory = category;
        return true;
      }

      return false;
    });

    if (!foundItem) {
      alert('Menu item could not be found.');
      return;
    }

    if (
      !confirm(
        'Delete "' + foundItem.name + '" from the menu?'
      )
    ) {
      return;
    }

    try {
      // Step 1: Update the item in Supabase.
      const deletedItem =
        await deleteMenuItemFromSupabase(foundItem.id);

      if (!deletedItem) {
        throw new Error(
          'Supabase did not confirm the menu item deletion.'
        );
      }

      // Step 2: Remove the item from the local menu.
      menuItems[foundCategory] =
        menuItems[foundCategory].filter(function (item) {
          return String(item.id) !== String(foundItem.id);
        });

      // Step 3: Check whether another menu item still
      // uses the same name.
      const remainingMenuItemUsesName =
        Object.keys(menuItems).some(function (category) {
          const items = menuItems[category];

          if (!Array.isArray(items)) {
            return false;
          }

          return items.some(function (item) {
            return (
              String(item.name || '').trim().toLowerCase() ===
              String(foundItem.name || '').trim().toLowerCase()
            );
          });
        });

      // Step 4: Remove the recipe only when no remaining
      // menu item uses this name.
      if (!remainingMenuItemUsesName) {
        if (
          typeof recipes !== 'undefined' &&
          recipes &&
          Object.prototype.hasOwnProperty.call(
            recipes,
            foundItem.name
          )
        ) {
          delete recipes[foundItem.name];

          if (typeof saveRecipesToStorage === 'function') {
            saveRecipesToStorage();
          }
        }
      }

      // Step 5: Refresh the interface.
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

      alert(
        'Failed to delete the menu item. Please check the console.'
      );
    }

    return;
  }

  /* =====================================================
     DELETE EXTRA
     ===================================================== */

  if (type === 'extra') {
    const item = (extrasItems || []).find(function (entry) {
      return String(entry.id) === String(itemId);
    });

    if (!item) {
      alert('Extra could not be found.');
      return;
    }

    if (
      !confirm(
        'Delete "' + item.name + '" from the extras?'
      )
    ) {
      return;
    }

    try {
      // Step 1: Delete the extra through Supabase.
      const deletedExtra =
        await deleteExtraFromSupabase(item.id);

      if (!deletedExtra) {
        throw new Error(
          'Supabase did not confirm the extra deletion.'
        );
      }

      // Step 2: Remove the extra from local state.
      extrasItems = extrasItems.filter(function (extra) {
        return String(extra.id) !== String(item.id);
      });

      // Step 3: Refresh the interface.
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

      alert(
        'Failed to delete the extra. Please check the console.'
      );
    }
  }
}



/* =========================================================
   ADD NEW MENU ITEM
   ========================================================= */
/* =========================================================
   ADD NEW MENU ITEM
   Admin is view-only for menu management.
   ========================================================= */

async function addNewMenuItem() {

  // Check menu-management permissions first.
  if (
    typeof blockTuxPosMenuMutation === 'function' &&
    blockTuxPosMenuMutation('add menu items')
  ) {
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

    let result;

    if (cat === 'extras') {

      result = await addExtraToSupabase(name, price);

      if (!result) {
        return;
      }

      renderExtras();

    } else {

      result = await addMenuItemToSupabase(
        name,
        price,
        cat
      );

      if (!result) {
        return;
      }

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

    alert('Failed to add the item. Please check the console.');

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
  const subtotal =
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

  const discount =
    Math.max(
      0,
      parseFloat(
        document.getElementById('discount')?.value
      ) || 0
    );

  // Delivery is excluded from Diff.
  const diff =
    subtotal - discount - cash - insta - visa;

  const diffText =
    document.getElementById('diffText');

  if (!diffText) return;

  diffText.innerText =
    'Diff: ' + diff.toFixed(2) + ' EGP';

  diffText.style.color =
    Math.abs(diff) < 0.01
      ? 'green'
      : '#ff4757';
}







/* =========================================================
   CLEAR ORDER
   ========================================================= */



function clearOrder() {

  if (blockTuxPosCashierMutation('clear the current order')) {
    return;
  }

  // Clear current order items
  currentOrder = [];

  // Clear the current order note and its display
  if (typeof clearCurrentOrderNote === 'function') {
    clearCurrentOrderNote();
  } else {
    currentOrderNote = '';

    const noteDisplay = document.getElementById('currentOrderNoteDisplay');

    if (noteDisplay) {
      noteDisplay.textContent = '';
    }
  }

  // Reset payment fields
  const cash = document.getElementById('cashPaid');
  const insta = document.getElementById('instaPaid');
  const visa = document.getElementById('visaPaid');
  const discount = document.getElementById('discount');

  if (cash) cash.value = 0;
  if (insta) insta.value = 0;
  if (visa) visa.value = 0;
  if (discount) discount.value = 0;

  // Refresh cashier UI
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

    // Admin and Tux Admin are allowed to send orders.
    if (!requireActiveShift()) return;

    /* =====================================================
       AUTHORIZATION
       ===================================================== */

    const activeWorkers = getActiveWorkers();

    const activeRole =
        typeof getActiveRole === 'function'
            ? getActiveRole()
            : null;

    const isAdmin =
        activeRole === 'admin' ||
        activeRole === 'tuxadmin';

    if (!isAdmin && activeWorkers.length === 0) {
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
       STEP 1 — CALCULATE AND VALIDATE PAYMENT
       ===================================================== */

    const subtotal =
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

    const deliveryFee =
        Math.max(
            0,
            parseFloat(
                document.getElementById('deliveryFee')?.value
            ) || 0
        );

    if (
        !Number.isFinite(subtotal) ||
        !Number.isFinite(cash) ||
        !Number.isFinite(insta) ||
        !Number.isFinite(visa) ||
        !Number.isFinite(disc) ||
        !Number.isFinite(deliveryFee)
    ) {
        alert('Please enter valid payment amounts.');
        return;
    }

    if (
        subtotal < 0 ||
        cash < 0 ||
        insta < 0 ||
        visa < 0 ||
        disc < 0 ||
        deliveryFee < 0
    ) {
        alert(
            'Food subtotal, payments, discount, and delivery cannot be negative.'
        );
        return;
    }

    if (disc > subtotal) {
        alert('Discount cannot exceed the food subtotal.');
        return;
    }

    const total =
        subtotal - disc + deliveryFee;

    const paid =
        cash + insta + visa;

    const expectedFoodPayment =
        subtotal - disc;

    const diff =
        expectedFoodPayment - paid;

    if (Math.abs(diff) > 0.01) {

        alert(
            'Payment does not match the food subtotal!\n\n' +
            'Food Subtotal: ' + subtotal.toFixed(2) + ' EGP\n' +
            'Discount: ' + disc.toFixed(2) + ' EGP\n' +
            'Delivery: ' + deliveryFee.toFixed(2) + ' EGP\n' +
            'Food Payment Required: ' +
            expectedFoodPayment.toFixed(2) + ' EGP\n' +
            'Paid: ' + paid.toFixed(2) + ' EGP\n' +
            'Diff: ' + diff.toFixed(2) + ' EGP'
        );

        return;
    }

    /* =====================================================
       STEP 2 — VALIDATE EXTRA QUANTITIES
       ===================================================== */

    let totalSandwichesCount = 0;
    let totalExtrasWithCondition = 0;

    currentOrder.forEach(function (item) {

        const n =
            String(item.name || '').toLowerCase();

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
            totalSandwichesCount +=
                Number(item.qty || 0);
        }

        if (
            n.includes('extra wedges') ||
            n.includes('extra tux fries') ||
            n.includes('extra doppy fries')
        ) {
            totalExtrasWithCondition +=
                Number(item.qty || 0);
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
       STEP 3 — RESTORE ORDER NUMBER
       ===================================================== */

    const counterRestored =
        await restoreOrderCounterForCurrentShift();

    if (!counterRestored) {

        alert(
            'Could not verify the next order number from Supabase. ' +
            'The order was not sent. Please try again.'
        );

        return;

    }

    /* =====================================================
       STEP 4 — PREPARE ORDER
       ===================================================== */

    const currentWorker =
        activeWorkers[0] || null;

    const orderStaffId =
        currentWorker
            ? currentWorker.id
            : (
                typeof activeAdminId !== 'undefined'
                    ? activeAdminId
                    : null
            );

    const orderStaffName =
        currentWorker
            ? currentWorker.name
            : (
                activeRole === 'tuxadmin'
                    ? 'Tux Admin'
                    : 'Admin'
            );

    const orderData = {

        items: [...currentOrder],

        subtotal: subtotal,
        total: total,

        cashPaid: cash,
        instaPaid: insta,
        visaPaid: visa,

        discount: disc,
        deliveryFee: deliveryFee,

        orderNum: orderCounter++,

        time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        }),

        status: 'preparing',

        staffId: orderStaffId,
        staffName: orderStaffName,

        activeStaff: activeWorkers.map(function (worker) {
            return {
                id: worker.id,
                name: worker.name
            };
        }),

        note:
            typeof currentOrderNote === 'string'
                ? currentOrderNote.trim()
                : ''

    };

    /* =====================================================
       STEP 5 — SAVE TO SUPABASE
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
       STEP 6 — UPDATE LOCAL ORDER LISTS
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

    /* =====================================================
       STEP 7 — CLEAR CURRENT ORDER AND NOTE
       ===================================================== */

    clearOrder();

    [
        'cashPaid',
        'instaPaid',
        'visaPaid',
        'discount',
        'deliveryFee'
    ].forEach(function (id) {

        const input =
            document.getElementById(id);

        if (input) {

            input.value = '';

            input.dispatchEvent(
                new Event('input', {
                    bubbles: true
                })
            );

            input.dispatchEvent(
                new Event('change', {
                    bubbles: true
                })
            );

        }

    });

    if (typeof clearCurrentOrderNote === 'function') {
        clearCurrentOrderNote();
    }

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


/* =========================================================
   SEND TO GAMIYA
   1. Validate worker and shift.
   2. Confirm worker password.
   3. Allow insufficient stock for Gam3ya meals.
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

  /* =====================================================
     STEP 1 — CONFIRM WORKER PASSWORD
     ===================================================== */

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

  /* =====================================================
     STEP 2 — CALCULATE MEAL TOTAL
     ===================================================== */

  let total = 0;

  currentOrder.forEach(function (item) {

    total +=
      Number(item.price || 0) *
      Number(item.qty || 0);

  });

  /* =====================================================
     STEP 3 — CHECK STOCK

     Insufficient stock is informational only.
     It must not prevent a Gam3ya order.
     ===================================================== */

  try {

    if (
      typeof getCashierLowStockItems === 'function'
    ) {

      const lowStockItems =
        getCashierLowStockItems(currentOrder);

      if (
        Array.isArray(lowStockItems) &&
        lowStockItems.length > 0
      ) {

        console.warn(
          'TUX POS — Gam3ya meal has insufficient stock. Proceeding with registration:',
          lowStockItems
        );

      }

    }

  } catch (error) {

    console.warn(
      'TUX POS — Gam3ya stock warning check failed. Continuing:',
      error
    );

  }

  /* =====================================================
     STEP 4 — RESOLVE PRODUCT IDS

     Use existing IDs when available.
     Otherwise, match against the loaded Supabase menu.
     ===================================================== */

  const recordItems = currentOrder.map(function (item) {

    let productId = String(
      item.product_id ??
      item.productId ??
      item.menu_item_id ??
      item.menuItemId ??
      item.id ??
      ''
    ).trim();

    if (!productId) {

      Object.keys(menuItems || {}).some(function (category) {

        const categoryItems = menuItems[category];

        if (!Array.isArray(categoryItems)) {
          return false;
        }

        const found = categoryItems.find(function (menuItem) {

          return (
            String(menuItem.name).trim().toLowerCase() ===
            String(item.name).trim().toLowerCase()
          );

        });

        if (found && found.id) {

          productId = String(found.id).trim();

          return true;

        }

        return false;

      });

    }

    return {

      product_id:
        productId || null,

      productId:
        productId || null,

      menu_item_id:
        productId || null,

      name:
        item.name,

      price:
        Number(item.price || 0),

      qty:
        Number(item.qty || 0)

    };

  });

  /* =====================================================
     STEP 5 — VALIDATE PRODUCT IDS
     ===================================================== */

  const missingProductIds = recordItems.filter(function (item) {
    return !item.product_id;
  });

  if (missingProductIds.length > 0) {

    console.error(
      'TUX POS — Gam3ya items could not be matched to menu products:',
      {
        missingProductIds: missingProductIds,
        currentOrder: currentOrder,
        menuItems: menuItems
      }
    );

    alert(
      'Cannot register Gam3ya stock deduction yet.\n\n' +
      'Some cart items could not be matched to Supabase menu products.\n\n' +
      'Check the browser console for the affected products.'
    );

    return;

  }

  /* =====================================================
     STEP 6 — PREPARE GAM3YA RECORD
     ===================================================== */

  const record = {

    shiftId:
      currentShift ? currentShift.id : null,

    workerId:
      workerIdForRecord,

    workerName:
      workerNameForRecord,

    items:
      recordItems,

    total:
      total,

    time:
      new Date().toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      ),

    date:
      new Date().toLocaleDateString()

  };

  /* =====================================================
     STEP 7 — SAVE GAM3YA TO SUPABASE
     ===================================================== */

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
      'Failed to register the Gam3ya meal.\n\n' +
      (error.message || String(error))
    );

    return;

  }

  if (!savedGamiya) {
    return;
  }

  /* =====================================================
     STEP 8 — DEDUCT STOCK

     The deduction service uses product IDs to find
     recipes and deduct the required ingredients.
     ===================================================== */

  let deductionSucceeded = false;

  try {

    deductionSucceeded = await deductStockForOrder({

      supabaseId:
        savedGamiya.id,

      type:
        'gamiya',

      isGamiya:
        true,

      workerName:
        workerNameForRecord,

      items:
        recordItems

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

  if (deductionSucceeded !== true) {

    console.error(
      'TUX POS — Gam3ya was saved, but stock deduction did not complete.',
      {
        gamiyaId: savedGamiya.id,
        items: recordItems
      }
    );

    alert(
      'Gam3ya was registered, but stock deduction failed.\n\n' +
      'Check the browser console for the exact error.'
    );

    return;

  }

  /* =====================================================
     STEP 9 — CONFIRM SUCCESS
     ===================================================== */

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