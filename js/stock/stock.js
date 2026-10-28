/* =========================================================
   TUX POS — STOCK
   Inventory view, stock settings, expenses / purchases,
   recipes editor and the stock count (Gard) modal.
   ========================================================= */


/* =========================================================
   STOCK PERMISSION HELPERS
   ========================================================= */

function canManageStock() {
  const role = getActiveRole();

  return role === 'tuxadmin';
}

function requireStockManagementPermission() {
  if (!canManageStock()) {
    alert(
      'Permission denied. Only TUX Admin can manage stock settings.'
    );

    return false;
  }

  return true;
}

/* =========================================================
   INVENTORY
   ========================================================= */

async function openAddStockModal() {

  if (!requireStockManagementPermission()) {

    return;

  }

  const sName =
    prompt('Enter stock item name:');

  if (!sName) return;

  const sUnit =
    prompt('Enter unit:', 'kg');

  if (!sUnit) return;

  let sOpening =
    parseFloat(
      prompt('Enter opening balance:', '10')
    );

  if (isNaN(sOpening)) {
    sOpening = 0;
  }

  let sMin =
    parseFloat(
      prompt('Enter min limit:', '2')
    );

  if (isNaN(sMin)) {
    sMin = 1;
  }

  const created =
    await addStockItemToSupabase(
      sName,
      sUnit,
      sOpening,
      sMin
    );

  if (!created) return;

  renderStockView();
  renderStockSettings();
  populateExpenseStockSelect();
  populateRecipeItemSelect();

  alert(
    'Stock item added successfully!'
  );

}


/* =========================================================
   STOCK VIEW
   ========================================================= */

function renderStockView() {

 const tbody =
  document.getElementById(
    'stockTableBody'
  );

if (
  typeof renderCashierLowStockAlert === 'function'
) {
  renderCashierLowStockAlert();
}

if (!tbody) return;

  let html = '';

  for (
    let key in stockInventory
  ) {

    const item =
      stockInventory[key];

    const isLow =
      Number(item.current) <=
      Number(item.min);

    const decimals =
      item.unit === 'kg'
        ? 2
        : 0;

    const statusHtml =
      isLow
        ? `<span style="color: #e74c3c; font-weight: bold; background: rgba(231, 76, 60, 0.15); padding: 2px 6px; border-radius: 4px;">Low Stock Alert!</span>`
        : `<span style="color: #2ecc71;">Available</span>`;

    html += `
      <tr>

        <td>
          ${escapeHtmlPw(item.name)}
        </td>

        <td>
          ${escapeHtmlPw(item.unit)}
        </td>

        <td>
          ${Number(item.opening).toFixed(decimals)}
        </td>

        <td
          style="font-weight: bold; color: ${
            isLow
              ? '#e74c3c'
              : '#fff'
          };"
        >
          ${Number(item.current).toFixed(decimals)}
        </td>

        <td>
          ${Number(item.min).toFixed(decimals)}
        </td>

        <td>
          ${statusHtml}
        </td>

        <td>

          ${
            canManageStock()
              ? `
                <button
                  onclick="deleteStockItem('${key}')"
                  style="
                    background: #c0392b;
                    color: white;
                    border: none;
                    padding: 4px 9px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 10px;
                  "
                >
                  🗑️ Delete
                </button>
              `
              : `
                <span style="color:#777; font-size:10px;">
                  View only
                </span>
              `
          }

        </td>

      </tr>
    `;

  }

  tbody.innerHTML =
    html;

}


/* =========================================================
   DELETE STOCK ITEM
   PERMANENT DELETE
   ========================================================= */

async function deleteStockItem(key) {

  if (!requireStockManagementPermission()) {

    return;

  }

  const stockItem =
    stockInventory[key];

  if (!stockItem) {

    alert(
      'Stock item could not be found.'
    );

    return;

  }

  const confirmed =
    confirm(
      '⚠️ PERMANENT DELETE\n\n' +
      'Are you sure you want to permanently delete "' +
      stockItem.name +
      '"?\n\n' +
      'This will permanently delete:\n' +
      '• The stock item\n' +
      '• Its recipe connections\n' +
      '• Its stock movement history\n\n' +
      'This action CANNOT be undone.\n\n' +
      'Press OK to permanently delete.'
    );

  if (!confirmed) {

    return;

  }

  const deleted =
    await deleteStockItemFromSupabase(
      key
    );

  if (!deleted) {

    alert(
      'Could not permanently delete the stock item.'
    );

    return;

  }

  renderStockView();
  renderStockSettings();
  populateExpenseStockSelect();
  populateRecipeItemSelect();

  alert(
    stockItem.name +
    ' was permanently deleted from Supabase.'
  );

}


/* =========================================================
   STOCK SETTINGS
   ========================================================= */

function renderStockSettings() {

  const tbody =
    document.getElementById(
      'stockSettingsTableBody'
    );

  if (!tbody) return;

  const isViewOnly =
    !canManageStock();

  const dis =
    isViewOnly
      ? 'disabled'
      : '';

  const inputStyle =
    'width: 70px; padding: 2px; text-align: center;';

  let html = '';

  for (
    let key in stockInventory
  ) {

    const item =
      stockInventory[key];

    html +=
      '<tr>' +

      '<td>' +
      escapeHtmlPw(item.name) +
      ' <span style="color:#777;">(' +
      escapeHtmlPw(item.unit) +
      ')</span>' +
      '</td>' +

      '<td>' +

      '<input ' +
      'type="number" ' +
      'step="any" ' +
      'id="op_' + key + '" ' +
      'value="' +
      Number(item.opening).toFixed(2) +
      '" ' +
      dis +
      ' style="' +
      inputStyle +
      '">' +

      '</td>' +

      '<td>' +

      '<input ' +
      'type="number" ' +
      'step="any" ' +
      'id="cur_' + key + '" ' +
      'value="' +
      Number(item.current).toFixed(2) +
      '" ' +
      dis +
      ' style="' +
      inputStyle +
      '">' +

      '</td>' +

      '<td>' +

      '<input ' +
      'type="number" ' +
      'step="any" ' +
      'id="min_' + key + '" ' +
      'value="' +
      Number(item.min).toFixed(2) +
      '" ' +
      dis +
      ' style="' +
      inputStyle +
      '">' +

      '</td>' +

      '<td>' +

      '<button ' +
      'onclick="updateStockSettings(\'' +
      key +
      '\')" ' +
      dis +
      ' style="background: #27ae60; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">' +

      'Save' +

      '</button>' +

      '</td>' +

      '</tr>';

  }

  tbody.innerHTML =
    html;

}


/* =========================================================
   UPDATE STOCK SETTINGS
   ========================================================= */

async function updateStockSettings(
  key
) {

  if (!requireStockManagementPermission()) {

    return;

  }

  const stockItem =
    stockInventory[key];

  if (!stockItem) {

    alert(
      'Stock item could not be found.'
    );

    return;

  }

  const opInput =
    document.getElementById(
      'op_' + key
    );

  const curInput =
    document.getElementById(
      'cur_' + key
    );

  const minInput =
    document.getElementById(
      'min_' + key
    );

  const newOp =
    parseFloat(
      opInput.value
    );

  const newCur =
    parseFloat(
      curInput.value
    );

  const newMin =
    parseFloat(
      minInput.value
    );

  if (
    isNaN(newOp) ||
    isNaN(newCur) ||
    isNaN(newMin)
  ) {

    alert(
      'Please enter valid stock quantities.'
    );

    return;

  }

  const updated =
    await updateStockItemInSupabase(
      key,
      newOp,
      newCur,
      newMin
    );

  if (!updated) return;

  renderStockView();
  renderStockSettings();

  alert(
    'Stock settings updated successfully!'
  );

}


/* =========================================================
   EXPENSES & PURCHASES
   ========================================================= */

function populateExpenseStockSelect() {

  const select =
    document.getElementById(
      'expStockKey'
    );

  if (!select) return;

  let html =
    '<option value="">-- صنف عام (بدون ربط مخزن) --</option>';

  for (
    let key in stockInventory
  ) {

    html +=
      `<option value="${key}">${escapeHtmlPw(stockInventory[key].name)} (${escapeHtmlPw(stockInventory[key].unit)})</option>`;

  }

  select.innerHTML =
    html;

}


/* =========================================================
   EXPENSE STOCK ITEM SELECT
   ========================================================= */

function onExpenseItemSelect() {

  const select =
    document.getElementById(
      'expStockKey'
    );

  const stockKey =
    select.value;

  if (
    stockKey &&
    stockInventory[stockKey]
  ) {

    document.getElementById(
      'expName'
    ).value =
      stockInventory[stockKey].name;

  }

}


/* =========================================================
   SAVE EXPENSE / PURCHASE
   NOW SAVES TO SUPABASE
   ========================================================= */

async function saveExpense() {

  if (!requireStockManagementPermission()) {

    return;

  }

  let stockKey =
    document.getElementById(
      'expStockKey'
    ).value;

  const name =
    document.getElementById(
      'expName'
    ).value.trim();

  const qty =
    parseFloat(
      document.getElementById(
        'expQty'
      ).value
    ) || 0;

  const cost =
    parseFloat(
      document.getElementById(
        'expCost'
      ).value
    ) || 0;

  const notes =
    document.getElementById(
      'expNotes'
    ).value.trim();

  if (
    !name ||
    cost <= 0
  ) {

    alert(
      'من فضلك أدخل اسم المصروف والتكلفة بشكل صحيح!'
    );

    return;

  }


  /* =======================================================
     FIND STOCK ITEM
     ======================================================= */

  let stockItem = null;


  if (
    stockKey &&
    stockInventory[stockKey]
  ) {

    stockItem =
      stockInventory[stockKey];

  }


  /*
    If no stock item was selected,
    try to match by name.
  */

  if (!stockItem) {

    const typed =
      name.toLowerCase();


    const matchKey =
      Object.keys(
        stockInventory
      ).find(
        function (k) {

          const sName =
            String(
              stockInventory[k].name
            ).toLowerCase();


          return (
            sName === typed ||
            (
              typed.length >= 3 &&
              sName.indexOf(typed) !== -1
            )
          );

        }
      );


    if (matchKey) {

      stockKey =
        matchKey;

      stockItem =
        stockInventory[matchKey];

    }

  }


  /* =======================================================
     UPDATE STOCK
     ======================================================= */

  let stockMsg;


  if (stockItem) {

    const newQuantity =
      Math.round(
        (
          Number(stockItem.current) +
          Number(qty)
        ) * 10000
      ) / 10000;


    const updated =
      await updateStockItemInSupabase(
        stockKey,
        stockItem.opening,
        newQuantity,
        stockItem.min
      );


    if (!updated) {

      return;

    }


    stockMsg =
      'تم تحديث المخزن: ' +
      stockItem.name +
      ' +' +
      fmtQty(qty) +
      ' ' +
      stockItem.unit +
      ' (الرصيد الآن: ' +
      fmtQty(newQuantity) +
      ' ' +
      stockItem.unit +
      ')';

  }

  else {

    stockKey = '';

    stockMsg =
      '⚠ المصروف غير مرتبط بصنف في المخزن، لذلك المخزن لم يتغير.';

  }


  /* =======================================================
     SAVE EXPENSE TO SUPABASE
     ======================================================= */

  const expenseRecord =
    await createExpenseInSupabase({

      name:
        name,

      category:
        stockItem
          ? 'Purchase'
          : 'Expense',

      cost:
        cost,

      quantity:
        qty,

      unit:
        stockItem
          ? stockItem.unit
          : null,

      notes:
        notes

    });


  if (!expenseRecord) {

    return;

  }


  /* =======================================================
     CLEAR FORM
     ======================================================= */

  document.getElementById(
    'expName'
  ).value = '';


  document.getElementById(
    'expQty'
  ).value = '1';


  document.getElementById(
    'expCost'
  ).value = '';


  document.getElementById(
    'expNotes'
  ).value = '';


  document.getElementById(
    'expStockKey'
  ).value = '';


  /* =======================================================
     REFRESH UI
     ======================================================= */

  renderExpensesTable();
  renderStockView();
  renderStockSettings();


  alert(
    'تم حفظ المصروف في Supabase.\n\n' +
    stockMsg
  );

}


/* =========================================================
   EXPENSE TABLE
   ========================================================= */

function renderExpensesTable() {

  const tbody =
    document.getElementById(
      'expensesTableBody'
    );

  const totalDisplay =
    document.getElementById(
      'totalExpensesDisplay'
    );

  if (!tbody) return;


  if (
    expensesList.length === 0
  ) {

    tbody.innerHTML = `
      <tr>

        <td
          colspan="6"
          style="text-align: center; color: #666;"
        >
          لا توجد مصروفات مسجلة حتى الآن
        </td>

      </tr>
    `;


    if (totalDisplay) {

      totalDisplay.innerText =
        '0.00';

    }


    return;

  }


  let html = '';

  let totalExp = 0;


  expensesList.forEach(
    function (exp) {

      totalExp +=
        Number(
          exp.cost || 0
        );


      const stockItem =
        exp.stockKey
          ? stockInventory[
              exp.stockKey
            ]
          : null;


      html += `
        <tr>

          <td>
            ${escapeHtmlPw(exp.date)} -
            ${escapeHtmlPw(exp.time)}
          </td>

          <td>
            <strong>
              ${escapeHtmlPw(exp.name)}
            </strong>
          </td>

          <td>
            ${
              (
                stockItem &&
                Number(exp.qty) > 0
              )

                ? '+' +
                  exp.qty +
                  ' ' +
                  escapeHtmlPw(
                    stockItem.unit
                  )

                : (
                    exp.quantity &&
                    exp.unit
                      ? '+' +
                        exp.quantity +
                        ' ' +
                        escapeHtmlPw(
                          exp.unit
                        )
                      : '-'
                  )
            }
          </td>

          <td
            style="color: #e74c3c; font-weight: bold;"
          >
            ${Number(
              exp.cost || 0
            ).toFixed(2)} LE
          </td>

          <td>
            ${escapeHtmlPw(
              exp.notes || '-'
            )}
          </td>

          <td>

            ${
              canManageStock()
                ? `
                  <button
                    onclick="deleteExpense('${exp.id}')"
                    style="
                      background: #c0392b;
                      color: white;
                      border: none;
                      padding: 4px 9px;
                      border-radius: 4px;
                      cursor: pointer;
                      font-size: 10px;
                    "
                  >
                    🗑️ Delete
                  </button>
                `
                : `
                  <span style="color:#777; font-size:10px;">
                    View only
                  </span>
                `
            }

          </td>

        </tr>
      `;

    }
  );


  tbody.innerHTML =
    html;


  if (totalDisplay) {

    totalDisplay.innerText =
      totalExp.toFixed(2);

  }

}


/* =========================================================
   DELETE EXPENSE
   ========================================================= */

async function deleteExpense(
  expenseId
) {

  if (!requireStockManagementPermission()) {

    return;

  }


  if (!expenseId) {

    return;

  }


  const expense =
    expensesList.find(
      function (item) {

        return (
          String(item.id) ===
            String(expenseId) ||

          String(item.supabaseId) ===
            String(expenseId)
        );

      }
    );


  if (!expense) {

    alert(
      'Expense could not be found.'
    );

    return;

  }


  const confirmed =
    confirm(
      'Are you sure you want to delete this expense?\n\n' +
      expense.name +
      ' — ' +
      Number(
        expense.cost || 0
      ).toFixed(2) +
      ' LE'
    );


  if (!confirmed) {

    return;

  }


  const deleted =
    await deleteExpenseFromSupabase(
      expenseId
    );


  if (!deleted) {

    return;

  }


  /*
   * Update this browser immediately.
   */

  renderExpensesTable();


  /*
   * Refresh reports immediately.
   */

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


  console.log(
    'TUX POS — Expense deleted:',
    expenseId
  );

}


/* =========================================================
   RECIPES EDITOR
   ========================================================= */

/*
  Recipe quantities are stored using
  the SAME unit as the stock item.

  Example:

  Stock:
  Beef → kg

  Recipe:
  Beef → 0.100 kg

  Supabase:
  quantity = 0.100

  No grams → kilograms conversion.
*/


function getAllSellableMenuItems() {

  const items = [];


  Object.keys(
    menuItems || {}
  ).forEach(
    function (category) {

      const categoryItems =
        menuItems[category];


      if (
        !Array.isArray(
          categoryItems
        )
      ) {

        return;

      }


      categoryItems.forEach(
        function (item) {

          if (
            item &&
            item.id &&
            item.name
          ) {

            const alreadyExists =
              items.some(
                function (existing) {

                  return (
                    existing.id ===
                    item.id
                  );

                }
              );


            if (!alreadyExists) {

              items.push(item);

            }

          }

        }
      );

    }
  );


  return items;

}


/* =========================================================
   RECIPE SELECT
   ========================================================= */

function populateRecipeItemSelect() {

  const select =
    document.getElementById(
      'recipeItemSelect'
    );

  if (!select) return;


  const old =
    select.value;


  select.innerHTML =
    '';


  const items =
    getAllSellableMenuItems();


  items.forEach(
    function (item) {

      const opt =
        document.createElement(
          'option'
        );


      opt.value =
        item.id;


      opt.textContent =
        item.name;


      select.appendChild(
        opt
      );

    }
  );


  if (
    old &&
    items.some(
      function (item) {

        return item.id === old;

      }
    )
  ) {

    select.value =
      old;

  }


  renderRecipeEditor();

}


/* =========================================================
   RECIPE EDITOR
   ========================================================= */

function renderRecipeEditor() {

  const tbody =
    document.getElementById(
      'recipeEditorBody'
    );


  const select =
    document.getElementById(
      'recipeItemSelect'
    );


  if (
    !tbody ||
    !select
  ) {

    return;

  }


  const menuItemId =
    select.value;


  if (!menuItemId) {

    tbody.innerHTML =
      '';

    return;

  }


  const recipe =
    recipes[
      menuItemId
    ] || {};


  const dis =
    !canManageStock()
      ? 'disabled'
      : '';


  let html =
    '';


  for (
    let key in stockInventory
  ) {

    const storedQuantity =
      Number(
        recipe[key] || 0
      );


    const displayValue =
      storedQuantity > 0
        ? storedQuantity
        : '';


    const unit =
      stockInventory[key].unit;


    const step =
      unit === 'kg'
        ? '0.001'
        : 'any';


    html +=

      '<tr>' +

      '<td>' +
      escapeHtmlPw(
        stockInventory[key].name
      ) +
      '</td>' +

      '<td>' +

      '<input ' +
      'type="number" ' +
      'step="' + step + '" ' +
      'min="0" ' +
      'id="rcp_' + key + '" ' +
      'value="' + displayValue + '" ' +
      dis +
      ' placeholder="0" ' +
      'style="width: 90px; padding: 2px; text-align: center;">' +

      '</td>' +

      '<td>' +
      escapeHtmlPw(unit) +
      '</td>' +

      '</tr>';

  }


  tbody.innerHTML =
    html;

}


/* =========================================================
   SAVE RECIPE
   ========================================================= */

async function saveRecipe() {

  if (!requireStockManagementPermission()) {

    return;

  }


  const select =
    document.getElementById(
      'recipeItemSelect'
    );


  if (!select) return;


  const menuItemId =
    select.value;


  if (!menuItemId) {

    alert(
      'Please select a menu item.'
    );

    return;

  }


  const newRecipe =
    {};


  for (
    let key in stockInventory
  ) {

    const input =
      document.getElementById(
        'rcp_' + key
      );


    const val =
      input
        ? parseFloat(
            input.value
          )
        : NaN;


    if (
      !isNaN(val) &&
      val > 0
    ) {

      newRecipe[key] =
        Math.round(
          val * 1000000
        ) / 1000000;

    }

  }


  const saved =
    await saveRecipeToSupabase(
      menuItemId,
      newRecipe
    );


  if (!saved) return;


  renderRecipeEditor();


  const selectedOption =
    document.querySelector(
      '#recipeItemSelect option:checked'
    );


  const productName =
    selectedOption
      ? selectedOption.textContent
      : menuItemId;


  alert(
    'Deductions saved for: ' +
    productName
  );

}


/* =========================================================
   RESET RECIPE
   ========================================================= */

async function resetRecipeToDefault() {

  if (!requireStockManagementPermission()) {

    return;

  }


  const select =
    document.getElementById(
      'recipeItemSelect'
    );


  if (!select) return;


  const menuItemId =
    select.value;


  if (!menuItemId) return;


  const selectedOption =
    select.options[
      select.selectedIndex
    ];


  const productName =
    selectedOption
      ? selectedOption.textContent
      : 'this item';


  if (
    !confirm(
      'Reset the deductions of "' +
      productName +
      '" to empty?'
    )
  ) {

    return;

  }


  const deleted =
    await deleteRecipeFromSupabase(
      menuItemId
    );


  if (!deleted) {

    alert(
      'Could not reset the recipe.'
    );

    return;

  }


  renderRecipeEditor();


  alert(
    'Recipe reset successfully.'
  );

}


/* =========================================================
   RECIPE HELPERS
   ========================================================= */

function recipeFactor(
  key
) {

  return 1;

}


function recipeInputUnit(
  key
) {

  if (
    !stockInventory[key]
  ) {

    return '';

  }


  return stockInventory[key].unit;

}


/* =========================================================
   STOCK COUNT (GARD)
   The count NEVER changes the system stock.
   ========================================================= */

function openCountModal(
  mode
) {

  countModalMode =
    mode;


  document.getElementById(
    'countModalTitle'
  ).innerText =

    mode === 'start'
      ? '📋 Opening Stock Count (Gard)'
      : '📋 Closing Stock Count (Gard)';


  document.getElementById(
    'countModalInfo'
  ).innerText =

    'Count what is physically in the shop and enter it for every item. System quantities are hidden and your count will NOT change the system stock.';


  document.getElementById(
    'countModalSubmitBtn'
  ).innerText =

    mode === 'start'
      ? 'Save Count & Start Shift'
      : 'Save Count & End Shift';


  let html =
    '';


  for (
    let key in stockInventory
  ) {

    const item =
      stockInventory[key];


    html +=

      '<tr>' +

      '<td>' +
      '<strong>' +
      escapeHtmlPw(item.name) +
      '</strong>' +
      '</td>' +

      '<td>' +
      escapeHtmlPw(item.unit) +
      '</td>' +

      '<td>' +

      '<input ' +
      'type="number" ' +
      'step="any" ' +
      'min="0" ' +
      'id="cnt_' + key + '" ' +
      'style="width: 90px; padding: 4px; background: #0c0c14; border: 1px solid #33334d; border-radius: 4px; color: #fff; text-align: center;">' +

      '</td>' +

      '</tr>';

  }


  document.getElementById(
    'countModalBody'
  ).innerHTML =
    html;


  document.getElementById(
    'countModal'
  ).classList.add(
    'active'
  );

}


/* =========================================================
   CLOSE COUNT MODAL
   ========================================================= */

function closeCountModal() {

  document.getElementById(
    'countModal'
  ).classList.remove(
    'active'
  );

}


/* =========================================================
   SUBMIT STOCK COUNT
   ========================================================= */

function submitCount() {

  const items =
    {};


  for (
    let key in stockInventory
  ) {

    const input =
      document.getElementById(
        'cnt_' + key
      );


    const val =
      input
        ? parseFloat(
            input.value
          )
        : NaN;


    if (
      isNaN(val) ||
      val < 0
    ) {

      alert(
        'Please enter a valid count for: ' +
        stockInventory[key].name
      );


      if (input) {

        input.focus();

      }


      return;

    }


    items[key] = {

      name:
        stockInventory[key].name,

      unit:
        stockInventory[key].unit,

      system:
        round2(
          stockInventory[key].current
        ),

      counted:
        round2(val)

    };

  }


  if (
    !confirm(
      'Save this count? It cannot be edited afterwards.'
    )
  ) {

    return;

  }


  const by =
    [];


  if (tuxAdminActive) {

    by.push(
      'Tux Admin'
    );

  }


  getActiveWorkers().forEach(
    function (w) {

      by.push(
        w.name
      );

    }
  );


  const count = {

    date:
      new Date()
        .toLocaleDateString(),

    time:
      new Date()
        .toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit'
          }
        ),

    by:
      by.join(', ') || '-',

    items:
      items

  };


  closeCountModal();


  if (
    countModalMode === 'start'
  ) {

    finalizeStartShift(
      count
    );

  }

  else {

    finalizeEndShift(
      count
    );

  }

}
/* =========================================================
   TUX POS — LOW STOCK ALERT
   Informational only. Never blocks kitchen orders.
   ========================================================= */


/* =========================================================
   GET LOW STOCK ITEMS
   ========================================================= */

function getLowStockItems() {

  if (
    typeof stockInventory === 'undefined' ||
    !stockInventory
  ) {
    return [];
  }

  return Object.keys(stockInventory)
    .map(function (key) {

      const item = stockInventory[key];

      if (!item) {
        return null;
      }

      const current = Number(item.current);
      const minimum = Number(item.min);

      if (
        !Number.isFinite(current) ||
        !Number.isFinite(minimum)
      ) {
        return null;
      }

      if (current > minimum) {
        return null;
      }

      return {
        key: key,
        name: String(item.name || 'Unnamed item'),
        unit: String(item.unit || ''),
        current: current,
        minimum: minimum,
        outOfStock: current <= 0
      };

    })
    .filter(Boolean)
    .sort(function (a, b) {

      if (a.outOfStock !== b.outOfStock) {
        return a.outOfStock ? -1 : 1;
      }

      return a.name.localeCompare(b.name);

    });

}


/* =========================================================
   CREATE LOW STOCK MODAL
   ========================================================= */

function ensureLowStockModal() {

  let modal = document.getElementById(
    'tuxLowStockModal'
  );

  if (modal) {
    return modal;
  }

  modal = document.createElement('div');

  modal.id = 'tuxLowStockModal';

  modal.style.cssText = `
    display: none;
    position: fixed;
    inset: 0;
    z-index: 100000;
    background: rgba(0, 0, 0, 0.78);
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
  `;

  modal.innerHTML = `
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tuxLowStockTitle"
      style="
        width: 100%;
        max-width: 620px;
        max-height: 85vh;
        overflow: hidden;
        background: #151522;
        border: 1px solid #35354b;
        border-radius: 12px;
        box-shadow: 0 18px 60px rgba(0,0,0,.55);
        color: #fff;
        display: flex;
        flex-direction: column;
      "
    >

      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 18px;
        border-bottom: 1px solid #303044;
      ">

        <div>
          <div
            id="tuxLowStockTitle"
            style="font-size: 18px; font-weight: 800;"
          >
            ⚠ Low Stock Alert
          </div>

          <div
            id="tuxLowStockSubtitle"
            style="font-size: 12px; color: #a5a5bb; margin-top: 5px;"
          >
            Items that need restocking
          </div>
        </div>

        <button
          type="button"
          id="tuxLowStockClose"
          aria-label="Close low stock alert"
          style="
            background: #29293a;
            color: white;
            border: 1px solid #41415a;
            border-radius: 7px;
            padding: 7px 11px;
            cursor: pointer;
            font-size: 16px;
          "
        >✕</button>

      </div>

      <div
        id="tuxLowStockList"
        style="
          padding: 12px;
          overflow-y: auto;
          min-height: 100px;
        "
      ></div>

      <div style="
        padding: 12px 16px;
        border-top: 1px solid #303044;
        display: flex;
        justify-content: flex-end;
      ">
        <button
          type="button"
          id="tuxLowStockDone"
          style="
            background: #c0392b;
            color: #fff;
            border: none;
            border-radius: 7px;
            padding: 9px 18px;
            font-weight: 700;
            cursor: pointer;
          "
        >Close</button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', function (event) {

    if (event.target === modal) {
      closeLowStockModal();
    }

  });

  modal.querySelector('#tuxLowStockClose')
    .addEventListener('click', closeLowStockModal);

  modal.querySelector('#tuxLowStockDone')
    .addEventListener('click', closeLowStockModal);

  document.addEventListener('keydown', function (event) {

    if (
      event.key === 'Escape' &&
      modal.style.display === 'flex'
    ) {
      closeLowStockModal();
    }

  });

  return modal;

}


/* =========================================================
   RENDER LOW STOCK MODAL CONTENT
   ========================================================= */

function renderLowStockModalContent() {

  const modal = ensureLowStockModal();

  const list = modal.querySelector(
    '#tuxLowStockList'
  );

  const subtitle = modal.querySelector(
    '#tuxLowStockSubtitle'
  );

  const items = getLowStockItems();

  subtitle.textContent =
    items.length === 0
      ? 'All stock items are above their minimum limits.'
      : items.length + ' item(s) need attention';

  if (items.length === 0) {

    list.innerHTML = `
      <div style="
        padding: 30px 12px;
        text-align: center;
        color: #2ecc71;
      ">
        <div style="font-size: 34px; margin-bottom: 10px;">✓</div>
        <div style="font-size: 16px; font-weight: 700;">
          All stock levels look good
        </div>
        <div style="font-size: 12px; color: #a5a5bb; margin-top: 6px;">
          No items are currently at or below their minimum limits.
        </div>
      </div>
    `;

    return;
  }

  list.innerHTML = items.map(function (item) {

    const currentText =
      item.current.toLocaleString(undefined, {
        maximumFractionDigits: 4
      });

    const minimumText =
      item.minimum.toLocaleString(undefined, {
        maximumFractionDigits: 4
      });

    const color = item.outOfStock
      ? '#ff5c5c'
      : '#f0ad4e';

    const status = item.outOfStock
      ? 'OUT OF STOCK'
      : 'LOW STOCK';

    return `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px;
        margin-bottom: 8px;
        background: #1d1d2c;
        border: 1px solid #35354b;
        border-left: 4px solid ${color};
        border-radius: 8px;
      ">

        <div style="min-width: 0;">

          <div style="
            font-size: 14px;
            font-weight: 700;
            overflow-wrap: anywhere;
          ">
            ${escapeHtmlPw(item.name)}
          </div>

          <div style="
            color: #aaaabe;
            font-size: 12px;
            margin-top: 5px;
          ">
            Current:
            <strong style="color: ${color};">
              ${escapeHtmlPw(currentText)}
            </strong>
            ${escapeHtmlPw(item.unit)}
            <span style="padding: 0 5px;">·</span>
            Minimum:
            ${escapeHtmlPw(minimumText)}
            ${escapeHtmlPw(item.unit)}
          </div>

        </div>

        <span style="
          flex-shrink: 0;
          color: ${color};
          background: ${item.outOfStock
            ? 'rgba(255,92,92,.12)'
            : 'rgba(240,173,78,.12)'};
          border: 1px solid ${color};
          padding: 5px 7px;
          border-radius: 5px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        ">
          ${status}
        </span>

      </div>
    `;

  }).join('');

}


/* =========================================================
   OPEN / CLOSE LOW STOCK MODAL
   ========================================================= */

function openLowStockModal() {

  const modal = ensureLowStockModal();

  renderLowStockModalContent();

  modal.style.display = 'flex';

}


function closeLowStockModal() {

  const modal = document.getElementById(
    'tuxLowStockModal'
  );

  if (modal) {
    modal.style.display = 'none';
  }

}


/* =========================================================
   NAVBAR BUTTON
   Creates the button if the navbar is available.
   ========================================================= */

function renderLowStockNavbarButton() {

  const existingButton = document.getElementById(
    'tuxLowStockNavbarButton'
  );

  if (existingButton) {

    updateLowStockNavbarButton();

    return;

  }

  /*
   * Find a common navbar element.
   * If your navbar uses a different structure,
   * the button can be placed manually in navigation.html.
   */

  const nav =
    document.querySelector('.top-nav') ||
    document.querySelector('.navbar') ||
    document.querySelector('nav');

  if (!nav) {
    return;
  }

  const button = document.createElement('button');

  button.id = 'tuxLowStockNavbarButton';
  button.type = 'button';

  button.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    background: #29202a;
    color: #fff;
    border: 1px solid #754044;
    border-radius: 7px;
    padding: 7px 10px;
    margin: 3px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  `;

  button.innerHTML = `
    <span>⚠ Low Stock</span>
    <span
      id="tuxLowStockBadge"
      style="
        display: none;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;
        background: #e74c3c;
        color: #fff;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 800;
      "
    >0</span>
  `;

  button.addEventListener('click', openLowStockModal);

  nav.appendChild(button);

  updateLowStockNavbarButton();

}


/* =========================================================
   UPDATE NAVBAR BADGE
   ========================================================= */

function updateLowStockNavbarButton() {

  const button = document.getElementById(
    'tuxLowStockNavbarButton'
  );

  const badge = document.getElementById(
    'tuxLowStockBadge'
  );

  if (!button || !badge) {
    return;
  }

  const count = getLowStockItems().length;

  badge.textContent = String(count);

  badge.style.display =
    count > 0
      ? 'inline-flex'
      : 'none';

  button.style.borderColor =
    count > 0
      ? '#e74c3c'
      : '#41415a';

}


/* =========================================================
   REFRESH LOW STOCK ALERT
   Called by stock rendering and after navbar loads.
   ========================================================= */

function renderCashierLowStockAlert() {

  updateLowStockNavbarButton();

  const modal = document.getElementById(
    'tuxLowStockModal'
  );

  if (
    modal &&
    modal.style.display === 'flex'
  ) {
    renderLowStockModalContent();
  }

}


/* =========================================================
   INITIALIZE LOW STOCK FEATURE
   ========================================================= */

function initLowStockAlert() {

  renderLowStockNavbarButton();

  ensureLowStockModal();

  updateLowStockNavbarButton();

}


/* =========================================================
   RETRY INITIALIZATION
   Supports HTML components loaded asynchronously.
   ========================================================= */

(function startLowStockAlertInitialization() {

  function initialize() {

    initLowStockAlert();

  }

  if (document.readyState === 'loading') {

    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      { once: true }
    );

  } else {

    initialize();

  }

  /*
   * The navbar is loaded asynchronously in this project.
   * Retry briefly until it becomes available.
   */

  let attempts = 0;

  const timer = setInterval(function () {

    renderLowStockNavbarButton();

    attempts++;

    if (
      document.getElementById('tuxLowStockNavbarButton') ||
      attempts >= 30
    ) {
      clearInterval(timer);
    }

  }, 500);

})();