/* =========================================================
   TUX POS — HAWALK

   Worker stock request + Admin approval
   ========================================================= */


/* =========================================================
   HELPERS
   ========================================================= */

function formatHawalkNumber(value) {

  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return '0';
  }

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(3).replace(/\.?0+$/, '');

}


function escapeHawalkHtml(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


/* =========================================================
   CREATE DELETE BUTTON AUTOMATICALLY
   ========================================================= */



function ensureHawalkDeleteButton() {
  const refreshButton = document.getElementById(
    'refreshHawalkBtn'
  );

  const deleteButton = document.getElementById(
    'deleteHawalkDataBtn'
  );

  // The Hawalk HTML may not have loaded yet.
  if (!refreshButton) {
    if (!window.__hawalkButtonObserver && document.documentElement) {
      window.__hawalkButtonObserver = new MutationObserver(() => {
        const refreshExists = document.getElementById(
          'refreshHawalkBtn'
        );

        if (refreshExists) {
          window.__hawalkButtonObserver.disconnect();
          window.__hawalkButtonObserver = null;

          ensureHawalkDeleteButton();
        }
      });

      window.__hawalkButtonObserver.observe(
        document.documentElement,
        {
          childList: true,
          subtree: true
        }
      );
    }

    return null;
  }

  if (!deleteButton) {
    console.warn(
      'TUX POS — #deleteHawalkDataBtn was not found.'
    );

    return null;
  }

  // Keep Delete Data beside Refresh.
  if (refreshButton.nextElementSibling !== deleteButton) {
    refreshButton.insertAdjacentElement(
      'afterend',
      deleteButton
    );
  }

  console.log(
    'TUX POS — Hawalk Refresh and Delete Data buttons found.'
  );

  return deleteButton;
}





/* =========================================================
   ROLE
   ========================================================= */

function applyHawalkRoleUI() {

  /*
   * Make sure the Delete button exists first.
   */

  ensureHawalkDeleteButton();


  const role =
    typeof getActiveRole === 'function'
      ? getActiveRole()
      : null;


  /* =======================================================
     HAWALK NAVIGATION
     ======================================================= */

  const navHawalk =
    document.getElementById(
      'navHawalk'
    );


  if (navHawalk) {

    navHawalk.style.display =
      role === 'worker' ||
        role === 'admin' ||
        role === 'tuxadmin'
        ? ''
        : 'none';

  }


  /* =======================================================
     CASHIER HAWALK BUTTON
     ======================================================= */

  const cashierButton =
    document.getElementById(
      'hawalkCashierBtn'
    );


  if (cashierButton) {

    cashierButton.style.display =
      role === 'worker'
        ? 'block'
        : 'none';

  }


  /* =======================================================
     WORKER SECTION
     ======================================================= */

  const workerSection =
    document.getElementById(
      'hawalkWorkerSection'
    );


  if (workerSection) {

    workerSection.style.display =
      role === 'worker'
        ? ''
        : 'none';

  }


  /* =======================================================
     ADMIN SECTION
     ======================================================= */

  const adminSection =
    document.getElementById(
      'hawalkAdminSection'
    );


  if (adminSection) {

    adminSection.style.display =
      role === 'admin' ||
        role === 'tuxadmin'
        ? ''
        : 'none';

  }


  /* =======================================================
     DELETE HAWALK DATA BUTTON

     TUX ADMIN ONLY
     ======================================================= */

  const deleteButton =
    document.getElementById(
      'deleteHawalkDataBtn'
    );


  if (deleteButton) {

    deleteButton.style.display =
      role === 'tuxadmin'
        ? 'inline-block'
        : 'none';

  }


  console.log(
    'TUX POS — Hawalk role:',
    role
  );

}


/* =========================================================
   OPEN HAWALK FROM CASHIER
   ========================================================= */

function openHawalkFromCashier() {

  if (
    typeof getActiveRole === 'function' &&
    getActiveRole() !== 'worker'
  ) {

    alert(
      'Only a Worker can create a Hawalk request.'
    );

    return;

  }


  if (
    typeof switchView === 'function'
  ) {

    switchView('hawalk');

  }

}


/* =========================================================
   WORKER STOCK TABLE
   ========================================================= */

async function renderHawalkWorkerRequestTable() {

  const tbody =
    document.getElementById(
      'hawalkStockRequestBody'
    );


  if (!tbody) {

    console.warn(
      'TUX POS — Hawalk stock request table was not found.'
    );

    return;

  }


  if (
    typeof loadStockFromSupabase === 'function'
  ) {

    await loadStockFromSupabase();

  }


  tbody.innerHTML = '';


  const availableItems = [];


  Object.keys(
    stockInventory || {}
  ).forEach(
    function (key) {

      const item =
        stockInventory[key];


      if (!item) {
        return;
      }


      if (
        item.active === false
      ) {

        return;

      }


      const current =
        Number(
          item.current || 0
        );


      if (
        current <= 0
      ) {

        return;

      }


      availableItems.push({
        key: key,
        item: item
      });

    }
  );


  availableItems.sort(
    function (a, b) {

      return String(
        a.item.name || ''
      ).localeCompare(
        String(
          b.item.name || ''
        )
      );

    }
  );


  if (
    availableItems.length === 0
  ) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="4"
          style="
            text-align:center;
            padding:25px;
            color:#888;
          "
        >
          No stock items are currently available.
        </td>
      </tr>
    `;

    return;

  }


  availableItems.forEach(
    function (entry) {

      const item =
        entry.item;


      const current =
        Number(
          item.current || 0
        );


      const step =
        item.unit === 'kg'
          ? '0.001'
          : '1';


      const tr =
        document.createElement('tr');


      /* ITEM NAME */

      const nameTd =
        document.createElement('td');


      nameTd.innerHTML =
        `<strong>${escapeHawalkHtml(item.name)}</strong>`;


      tr.appendChild(
        nameTd
      );


      /* AVAILABLE */





      const availableTd =
        document.createElement('td');


      availableTd.textContent =
        formatHawalkNumber(
          current
        );


      availableTd.style.fontWeight =
        'bold';


      availableTd.style.color =
        '#2ecc71';

      availableTd.style.textAlign = 'center';

      tr.appendChild(
        availableTd
      );


      /* QUANTITY */

      const quantityTd =
        document.createElement('td');


      quantityTd.style.textAlign =
        'center';


      const input =
        document.createElement('input');


      input.type =
        'number';


      input.className =
        'hawalk-quantity-input';


      input.dataset.stockItemId =
        String(item.id);


      input.dataset.itemName =
        String(item.name || '');


      input.dataset.unit =
        String(
          item.unit || 'piece'
        );


      input.min =
        '0';


      input.max =
        String(current);


      input.step =
        step;


      input.value =
        '0';


      input.placeholder =
        '0';


      input.style.width =
        '120px';


      input.style.height =
        '38px';


      input.style.padding =
        '6px 10px';


      input.style.background =
        '#11111c';


      input.style.border =
        '2px solid #8e44ad';


      input.style.borderRadius =
        '6px';


      input.style.color =
        '#ffffff';


      input.style.fontSize =
        '16px';


      input.style.fontWeight =
        'bold';


      input.style.textAlign =
        'center';


      input.style.outline =
        'none';


      input.addEventListener(
        'input',
        function () {

          let value =
            Number(
              input.value
            );


          if (
            !Number.isFinite(value) ||
            value < 0
          ) {

            input.value =
              '0';

            return;

          }


          if (
            value > current
          ) {

            input.value =
              formatHawalkNumber(
                current
              );

          }

        }
      );


      quantityTd.appendChild(
        input
      );


      tr.appendChild(
        quantityTd
      );


      /* UNIT */

      const unitTd =
        document.createElement('td');


      unitTd.textContent =
        String(
          item.unit || 'piece'
        );

      unitTd.style.textAlign = "center";

      tr.appendChild(
        unitTd
      );


      tbody.appendChild(
        tr
      );

    }
  );


  console.log(
    'TUX POS — Hawalk worker stock inputs rendered:',
    availableItems
  );

}


/* =========================================================
   SUBMIT HAWALK REQUEST
   ========================================================= */

async function submitHawalkRequest() {

  if (
    typeof getActiveRole === 'function' &&
    getActiveRole() !== 'worker'
  ) {

    alert(
      'Only a Worker can submit a Hawalk request.'
    );

    return;

  }


  const inputs =
    document.querySelectorAll(
      '#hawalkStockRequestBody .hawalk-quantity-input'
    );


  const items = [];


  inputs.forEach(
    function (input) {

      const quantity =
        Number(
          input.value
        );


      if (
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {

        return;

      }


      const stockItemId =
        String(
          input.dataset.stockItemId || ''
        );


      const stockItem =
        stockInventory &&
        stockInventory[stockItemId];


      if (!stockItem) {
        return;
      }


      const available =
        Number(
          stockItem.current || 0
        );


      if (
        quantity > available
      ) {

        throw new Error(
          stockItem.name +
          ': requested quantity cannot be greater than available stock.'
        );

      }


      items.push({

        stockItemId:
          String(
            stockItem.id
          ),

        itemName:
          String(
            stockItem.name
          ),

        unit:
          String(
            stockItem.unit || 'piece'
          ),

        quantity:
          quantity

      });

    }
  );


  if (
    items.length === 0
  ) {

    alert(
      'Please enter a quantity for at least one stock item.'
    );

    return;

  }


  const summary =
    items
      .map(
        function (item) {

          return (
            item.itemName +
            ' × ' +
            formatHawalkNumber(
              item.quantity
            ) +
            ' ' +
            item.unit
          );

        }
      )
      .join('\n');


  const confirmed =
    confirm(
      'Send this Hawalk request?\n\n' +
      summary +
      '\n\n' +
      'Stock will NOT be deducted until Admin accepts the request.'
    );


  if (!confirmed) {
    return;
  }


  try {

    const submitButton =
      document.getElementById(
        'submitHawalkRequestBtn'
      );


    if (submitButton) {

      submitButton.disabled =
        true;

      submitButton.textContent =
        '⏳ Sending...';

    }


    await createHawalkRequest(
      items
    );


    inputs.forEach(
      function (input) {

        input.value =
          '0';

      }
    );


    alert(
      'Hawalk request sent successfully!\n\n' +
      'Admin can now review your request.'
    );


    if (
      typeof renderHawalkAdminRequests ===
      'function'
    ) {

      await renderHawalkAdminRequests();

    }


  } catch (error) {

    console.error(
      'TUX POS — Hawalk request submission failed:',
      error
    );


    alert(
      'Could not submit the Hawalk request.\n\n' +
      (
        error.message ||
        'Unknown error.'
      )
    );


  } finally {

    const submitButton =
      document.getElementById(
        'submitHawalkRequestBtn'
      );


    if (submitButton) {

      submitButton.disabled =
        false;

      submitButton.textContent =
        '📦 Submit Hawalk Request';

    }

  }

}


/* =========================================================
   ADMIN REQUEST TABLE
   ========================================================= */

async function renderHawalkAdminRequests() {

  const tbody =
    document.getElementById(
      'hawalkRequestsTableBody'
    );


  if (!tbody) {
    return;
  }


  if (
    typeof loadHawalkRequestsFromSupabase ===
    'function'
  ) {

    await loadHawalkRequestsFromSupabase();

  }


  const requests =
    typeof getHawalkRequests === 'function'
      ? getHawalkRequests()
      : [];


  tbody.innerHTML =
    '';


  if (
    !requests.length
  ) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="5"
          style="
            text-align:center;
            padding:20px;
            color:#777;
          "
        >
          No Hawalk requests yet.
        </td>
      </tr>
    `;

    return;

  }


  requests.forEach(
    function (request) {

      const tr =
        document.createElement('tr');


      const date =
        request.created_at
          ? new Date(
            request.created_at
          ).toLocaleString()
          : '-';


      const items =
        Array.isArray(
          request.items
        )
          ? request.items
          : [];


      const itemText =
        items.length
          ? items
            .map(
              function (item) {

                return (
                  escapeHawalkHtml(
                    item.itemName
                  ) +
                  ' × ' +
                  formatHawalkNumber(
                    item.quantity
                  ) +
                  ' ' +
                  escapeHawalkHtml(
                    item.unit || ''
                  )
                );

              }
            )
            .join('<br>')
          : '-';


      let statusHtml =
        '';


      if (
        request.status === 'Accepted'
      ) {

        statusHtml = `
          <span
            style="
              color:#2ecc71;
              font-weight:bold;
            "
          >
            ✓ Accepted
          </span>
        `;

      }

      else if (
        request.status === 'Declined'
      ) {

        statusHtml = `
          <span
            style="
              color:#e74c3c;
              font-weight:bold;
            "
          >
            ✕ Declined
          </span>
        `;

      }

      else {

        statusHtml = `
          <span
            style="
              color:#f1c40f;
              font-weight:bold;
            "
          >
            ⏳ Pending
          </span>
        `;

      }


      let actionHtml =
        '-';


      if (
        request.status === 'Pending'
      ) {

        actionHtml = `
          <div
            style="
              display:flex;
              gap:6px;
              flex-wrap:wrap;
            "
          >

            <button
              type="button"
              onclick="acceptHawalk('${request.id}')"
              style="
                background:#27ae60;
                color:#fff;
                border:none;
                padding:7px 12px;
                border-radius:5px;
                cursor:pointer;
                font-weight:bold;
              "
            >
              ✓ Accept
            </button>

            <button
              type="button"
              onclick="declineHawalk('${request.id}')"
              style="
                background:#c0392b;
                color:#fff;
                border:none;
                padding:7px 12px;
                border-radius:5px;
                cursor:pointer;
                font-weight:bold;
              "
            >
              ✕ Decline
            </button>

          </div>
        `;

      }


      tr.innerHTML =
        `
          <td>
            ${escapeHawalkHtml(date)}
          </td>

          <td>
            <strong>
              ${escapeHawalkHtml(
          request.worker_name || '-'
        )}
            </strong>
          </td>

          <td>
            ${itemText}
          </td>

          <td>
            ${statusHtml}
          </td>

          <td>
            ${actionHtml}
          </td>
        `;


      tbody.appendChild(
        tr
      );

    }
  );

}


/* =========================================================
   ADMIN ACCEPT
   ========================================================= */

async function acceptHawalk(requestId) {

  if (
    typeof getActiveRole === 'function'
  ) {

    const role =
      getActiveRole();


    if (
      role !== 'admin' &&
      role !== 'tuxadmin'
    ) {

      alert(
        'Only Admin or Tux Admin can accept a Hawalk request.'
      );

      return;

    }

  }


  const confirmed =
    confirm(
      'Accept this Hawalk request?\n\n' +
      'The requested quantities will be deducted from Stock immediately.'
    );


  if (!confirmed) {
    return;
  }


  try {

    await acceptHawalkRequest(
      requestId
    );


    alert(
      'Hawalk request accepted.\n\n' +
      'Stock has been deducted.'
    );


    await renderHawalkAdminRequests();


    if (
      typeof renderHawalkWorkerRequestTable ===
      'function'
    ) {

      await renderHawalkWorkerRequestTable();

    }


  } catch (error) {

    console.error(
      'TUX POS — Hawalk accept failed:',
      error
    );


    alert(
      'Could not accept the Hawalk request.\n\n' +
      (
        error.message ||
        'Unknown error.'
      )
    );

  }

}


/* =========================================================
   ADMIN DECLINE
   ========================================================= */

async function declineHawalk(requestId) {

  if (
    typeof getActiveRole === 'function'
  ) {

    const role =
      getActiveRole();


    if (
      role !== 'admin' &&
      role !== 'tuxadmin'
    ) {

      alert(
        'Only Admin or Tux Admin can decline a Hawalk request.'
      );

      return;

    }

  }


  const confirmed =
    confirm(
      'Decline this Hawalk request?\n\n' +
      'Stock will NOT be changed.'
    );


  if (!confirmed) {
    return;
  }


  try {

    await declineHawalkRequest(
      requestId
    );


    alert(
      'Hawalk request declined.'
    );


    await renderHawalkAdminRequests();


  } catch (error) {

    console.error(
      'TUX POS — Hawalk decline failed:',
      error
    );


    alert(
      'Could not decline the Hawalk request.\n\n' +
      (
        error.message ||
        'Unknown error.'
      )
    );

  }

}


/* =========================================================
   DELETE ALL HAWALK DATA
   ========================================================= */

/* =========================================================
   HAWALK — DELETE ALL REQUESTS
   TUX Admin only
   Deletes both:
   1. Hawalk Requests
   2. 📝 Other Requests
   ========================================================= */


/* =========================================================
   TUX POS — DELETE ALL HAWALK DATA
   Deletes both Hawalk Requests and Other Requests
   Tux Admin only
   ========================================================= */

async function deleteAllHawalkData() {
    try {
        /* =========================================
           PERMISSION CHECK
           ========================================= */

        const role =
            typeof getActiveRole === 'function'
                ? getActiveRole()
                : null;

        if (role !== 'tuxadmin') {
            alert(
                'Only Tux Admin can delete Hawalk data.'
            );

            return false;
        }


        /* =========================================
           SUPABASE CLIENT CHECK
           ========================================= */

        if (
            typeof supabaseClient === 'undefined' ||
            !supabaseClient
        ) {
            alert(
                'Supabase client is unavailable.'
            );

            return false;
        }


        /* =========================================
           FIRST CONFIRMATION
           ========================================= */

        const firstConfirmation = confirm(
            'DELETE ALL HAWALK DATA?\n\n' +
            'This will permanently delete:\n' +
            '• Hawalk Requests\n' +
            '• 📝 Other Requests\n\n' +
            'Stock quantities will not be changed.\n\n' +
            'Do you want to continue?'
        );

        if (!firstConfirmation) {
            return false;
        }


        /* =========================================
           SECOND CONFIRMATION
           ========================================= */

        const secondConfirmation = confirm(
            'FINAL CONFIRMATION\n\n' +
            'Both Hawalk request lists will be cleared.\n' +
            'This action cannot be undone.\n\n' +
            'Delete everything?'
        );

        if (!secondConfirmation) {
            return false;
        }


        /* =========================================
           DELETE HAWALK REQUESTS
           ========================================= */

        const {
            error: hawalkError
        } = await supabaseClient
            .from('hawalk_requests')
            .delete()
            .not('id', 'is', null);

        if (hawalkError) {
            console.error(
                'Failed to delete Hawalk Requests:',
                hawalkError
            );

            throw new Error(
                'Could not delete Hawalk Requests: ' +
                hawalkError.message
            );
        }


        /* =========================================
           DELETE OTHER REQUESTS
           ========================================= */

        const {
            error: otherError
        } = await supabaseClient
            .from('hawalk_other_requests')
            .delete()
            .not('id', 'is', null);

        if (otherError) {
            console.error(
                'Failed to delete Other Requests:',
                otherError
            );

            throw new Error(
                'Hawalk Requests were deleted, but Other Requests ' +
                'could not be deleted: ' +
                otherError.message
            );
        }


        /* =========================================
           RELOAD BOTH LISTS
           ========================================= */

        await Promise.all([
            loadHawalkRequestsFromSupabase(),
            loadHawalkOtherRequestsFromSupabase()
        ]);


        /* =========================================
           NOTIFY THE UI
           ========================================= */

        window.dispatchEvent(
            new CustomEvent('tux-hawalk-updated')
        );

        window.dispatchEvent(
            new CustomEvent('tux-hawalk-other-updated')
        );


        /* =========================================
           SUCCESS
           ========================================= */

        console.log(
            'TUX POS — All Hawalk data deleted successfully.'
        );

        alert(
            'Success!\n\n' +
            'Hawalk Requests and 📝 Other Requests have been deleted.'
        );

        return true;

    } catch (error) {
        console.error(
            'TUX POS — Delete All Hawalk Data Error:',
            error
        );

        alert(
            'Failed to delete all Hawalk data.\n\n' +
            (error.message || 'Unknown error') +
            '\n\nCheck the browser console for details.'
        );

        return false;
    }
}




/* =========================================================
   FULL HAWALK VIEW
   ========================================================= */

async function renderHawalkView() {

  /*
   * Make sure the button exists every time
   * Hawalk is opened.
   */

  ensureHawalkDeleteButton();


  applyHawalkRoleUI();
  await renderHawalkOtherRequestsUI();

  const role =
    typeof getActiveRole === 'function'
      ? getActiveRole()
      : null;


  if (
    role === 'worker'
  ) {

    await renderHawalkWorkerRequestTable();

  }


  if (
    role === 'admin' ||
    role === 'tuxadmin'
  ) {

    await renderHawalkAdminRequests();

  }

}


/* =========================================================
   REFRESH
   ========================================================= */

function refreshHawalk() {

  renderHawalkView();

}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  function () {

    /*
     * Wait a tiny moment because the HTML
     * may be rendered by the main application
     * after DOMContentLoaded.
     */

    setTimeout(
      function () {

        ensureHawalkDeleteButton();

        applyHawalkRoleUI();

      },
      300
    );

  }
);


/* =========================================================
   HAWALK REALTIME
   ========================================================= */

window.addEventListener(
  'tux-hawalk-updated',
  function () {

    const hawalkView =
      document.getElementById(
        'hawalk-view'
      );


    if (
      hawalkView &&
      hawalkView.classList.contains('active')
    ) {

      renderHawalkView();

    }

  }
);


window.addEventListener(
  'tux-stock-realtime-updated',
  function () {

    const hawalkView =
      document.getElementById(
        'hawalk-view'
      );


    if (
      hawalkView &&
      hawalkView.classList.contains('active')
    ) {

      renderHawalkView();

    }

  }
);
/* =========================================================
   TUX POS — HAWALK OTHER REQUESTS
   Expense requests + new stock item requests
   ========================================================= */


/* =========================================================
   CREATE WORKER FORM
   ========================================================= */



/* =========================================================
   WORKER OTHER REQUEST FORM
   Use the existing two-field form from the HTML.
   Do NOT generate the old Expense / New Stock Item form.
   ========================================================= */

function ensureHawalkOtherWorkerForm() {
  const activeRole =
    typeof getActiveRole === 'function'
      ? String(getActiveRole()).trim().toLowerCase()
      : '';

  const existingSection = document.getElementById(
    'hawalkOtherRequestSection'
  );

  if (activeRole !== 'worker') {
    if (existingSection) {
      existingSection.style.display = 'none';
    }

    return null;
  }

  if (!existingSection) {
    console.warn(
      'TUX POS — Existing #hawalkOtherRequestSection was not found in the HTML.'
    );

    return null;
  }

  existingSection.style.display = '';

  return existingSection;
}






/* =========================================================
   SHOW/HIDE STOCK ITEM FIELDS
   ========================================================= */

function updateHawalkOtherRequestFields() {
  const type = document.getElementById(
    'hawalkOtherType'
  );

  const quantityGroup = document.getElementById(
    'hawalkOtherQuantityGroup'
  );

  const unitGroup = document.getElementById(
    'hawalkOtherUnitGroup'
  );

  const quantityInput = document.getElementById(
    'hawalkOtherQuantity'
  );

  const unitInput = document.getElementById(
    'hawalkOtherUnit'
  );

  const nameLabel = document.getElementById(
    'hawalkOtherNameLabel'
  );

  const nameInput = document.getElementById(
    'hawalkOtherName'
  );

  if (
    !type ||
    !quantityGroup ||
    !unitGroup ||
    !quantityInput ||
    !unitInput ||
    !nameLabel ||
    !nameInput
  ) {
    return;
  }

  const isStockItem =
    type.value === 'New Stock Item';

  quantityGroup.style.display =
    isStockItem ? 'block' : 'none';

  unitGroup.style.display =
    isStockItem ? 'block' : 'none';

  quantityInput.required = isStockItem;
  unitInput.required = isStockItem;

  nameLabel.textContent = isStockItem
    ? 'New Stock Item Name'
    : 'Expense Name';

  nameInput.placeholder = isStockItem
    ? 'Enter the item name'
    : 'Enter the expense name';

  quantityInput.disabled = !isStockItem;
  unitInput.disabled = !isStockItem;

  if (!isStockItem) {
    quantityInput.value = '';
    unitInput.value = '';
  }
}


/* =========================================================
   SUBMIT OTHER REQUEST
   ========================================================= */



async function submitHawalkOtherRequest() {

  // Only workers can submit requests.
  if (
    typeof getActiveRole === 'function' &&
    String(getActiveRole()).trim().toLowerCase() !== 'worker'
  ) {
    alert('Only a Worker can submit this request.');
    return;
  }

  // Get the two input fields.
  const type = document.getElementById('hawalkOtherType');
  const quantity = document.getElementById('hawalkOtherQuantity');

  const submitButton = document.getElementById(
    'submitHawalkOtherRequestBtn'
  );

  if (!type || !quantity || !submitButton) {
    alert('The Other Request form could not be found.');
    return;
  }

  // Validate Request Type.
  const requestType = type.value.trim();

  if (!requestType) {
    alert('Please enter the request type.');
    type.focus();
    return;
  }

  // Validate Quantity.
  const quantityValue = quantity.value.trim();
  const requestQuantity =
    quantityValue === '' ? NaN : Number(quantityValue);

  if (
    !Number.isFinite(requestQuantity) ||
    requestQuantity <= 0
  ) {
    alert('Please enter a quantity greater than zero.');
    quantity.focus();
    return;
  }

  // Confirm submission.
  const confirmed = confirm(
    'Submit this Other Request?\n\n' +
    'Request Type: ' + requestType + '\n' +
    'Quantity: ' + requestQuantity + '\n\n' +
    'Admin will review this request.'
  );

  if (!confirmed) {
    return;
  }

  try {

    submitButton.disabled = true;
    submitButton.textContent = '⏳ Submitting...';

    // Save the request.
    await createHawalkOtherRequest({
      requestType: requestType,
      quantity: requestQuantity
    });

    // Clear the two fields after successful submission.
    type.value = '';
    quantity.value = '';

    alert(
      'Other Request submitted successfully.\n\n' +
      'Admin can now review it.'
    );

    // Refresh the requests list.
    if (typeof renderHawalkOtherRequestsUI === 'function') {
      await renderHawalkOtherRequestsUI();
    }

  } catch (error) {

    console.error(
      'TUX POS — Other Request submission failed:',
      error
    );

    alert(
      'Could not submit the request.\n\n' +
      (error.message || 'Unknown error.')
    );

  } finally {

    submitButton.disabled = false;
    submitButton.textContent = '📨 Submit Other Request';

  }
}



/* =========================================================
   ADMIN OTHER REQUESTS CONTAINER
   ========================================================= */

function ensureHawalkOtherAdminContainer() {
  const adminSection = document.getElementById(
    'hawalkAdminSection'
  );

  if (!adminSection) {
    return null;
  }

  let container = document.getElementById(
    'hawalkOtherAdminRequests'
  );

  if (container) {
    return container;
  }

  container = document.createElement('div');

  container.id = 'hawalkOtherAdminRequests';

  container.style.cssText = `
        margin-top:24px;
        padding:20px;
        background:#171725;
        border:1px solid #34344a;
        border-radius:12px;
    `;

  container.innerHTML = `
        <h3 style="margin-top:0;color:#fff;">
            📝 Other Requests
        </h3>

        <p style="color:#aaa;font-size:13px;">
            Accepting or declining a request changes only its status.
            Add accepted expenses or stock items manually in their
            respective Admin sections.
        </p>

        <div style="overflow-x:auto;">
            <table style="
                width:100%;
                border-collapse:collapse;
                color:#fff;
                min-width:850px;
            ">
                <thead>
                    <tr style="background:#222235;">
                        <th style="padding:10px;text-align:left;">Date</th>
                        <th style="padding:10px;text-align:left;">Worker</th>
                        <th style="padding:10px;text-align:left;">Type</th>
                        <th style="padding:10px;text-align:left;">Request</th>
                        <th style="padding:10px;text-align:left;">Details</th>
                        <th style="padding:10px;text-align:left;">Reason</th>
                        <th style="padding:10px;text-align:left;">Status</th>
                        <th style="padding:10px;text-align:left;">Actions</th>
                    </tr>
                </thead>

                <tbody id="hawalkOtherAdminRequestsBody">
                    <tr>
                        <td colspan="8" style="padding:20px;text-align:center;">
                            Loading requests...
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

  adminSection.appendChild(container);

  return container;
}


/* =========================================================
   RENDER WORKER REQUEST HISTORY
   ========================================================= */

function renderHawalkOtherWorkerHistory(requests) {
  const container = document.getElementById(
    'hawalkOtherWorkerHistory'
  );

  if (!container) {
    return;
  }

  const role =
    typeof getActiveRole === 'function'
      ? getActiveRole()
      : null;

  if (role !== 'worker') {
    container.innerHTML = '';
    return;
  }

  let worker = null;

  if (
    typeof getCurrentHawalkWorker === 'function'
  ) {
    worker = getCurrentHawalkWorker();
  }

  const workerId = worker
    ? String(worker.id)
    : null;

  const workerName = worker
    ? String(worker.name || '')
    : null;

  const ownRequests = (requests || []).filter(
    function (request) {
      if (
        workerId &&
        request.worker_id !== null &&
        request.worker_id !== undefined
      ) {
        return String(request.worker_id) === workerId;
      }

      return (
        workerName &&
        String(request.worker_name || '') === workerName
      );
    }
  );

  container.innerHTML = `
        <h4 style="color:#fff;">My Other Requests</h4>
        <div id="hawalkOtherWorkerHistoryRows"></div>
    `;

  const rows = document.getElementById(
    'hawalkOtherWorkerHistoryRows'
  );

  if (!ownRequests.length) {
    rows.innerHTML = `
            <p style="color:#999;">
                You haven't submitted any Other Requests yet.
            </p>
        `;
    return;
  }

  ownRequests.forEach(function (request) {
    const card = document.createElement('div');

    card.style.cssText = `
            margin-bottom:10px;
            padding:12px;
            background:#11111c;
            border:1px solid #34344a;
            border-radius:8px;
        `;

    const statusColors = {
      Pending: '#f1c40f',
      Accepted: '#2ecc71',
      Declined: '#e74c3c'
    };

    const statusColor =
      statusColors[request.status] || '#aaa';

    const details = [];

    if (
      request.request_type === 'New Stock Item'
    ) {
      details.push(
        'Quantity: ' +
        formatHawalkNumber(request.quantity) +
        ' ' +
        escapeHawalkHtml(request.unit || '')
      );
    }

    if (
      request.cost !== null &&
      request.cost !== undefined
    ) {
      details.push(
        'Estimated cost: ' +
        formatHawalkNumber(request.cost) +
        ' EGP'
      );
    }

    card.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                <strong style="color:#fff;">
                    ${escapeHawalkHtml(request.name)}
                </strong>

                <strong style="color:${statusColor};">
                    ${escapeHawalkHtml(request.status)}
                </strong>
            </div>

            <div style="margin-top:6px;color:#bbb;">
                ${escapeHawalkHtml(request.request_type)}
            </div>

            ${details.length
        ? `
                        <div style="margin-top:6px;color:#bbb;">
                            ${details.join(' • ')}
                        </div>
                    `
        : ''
      }

            <div style="margin-top:8px;color:#aaa;white-space:pre-wrap;">
                ${escapeHawalkHtml(request.reason || '')}
            </div>

            <div style="margin-top:8px;color:#777;font-size:12px;">
                Submitted: ${request.created_at
        ? escapeHawalkHtml(
          new Date(request.created_at).toLocaleString()
        )
        : '-'
      }
            </div>
        `;

    container.querySelector(
      '#hawalkOtherWorkerHistoryRows'
    ).appendChild(card);
  });
}


/* =========================================================
   RENDER ADMIN OTHER REQUESTS
   ========================================================= */

async function renderHawalkOtherAdminRequests() {
  const tbody = document.getElementById(
    'hawalkOtherAdminRequestsBody'
  );

  if (!tbody) {
    return;
  }

  try {
    await loadHawalkOtherRequestsFromSupabase();

    const requests = Array.isArray(
      window.hawalkOtherRequests
    )
      ? window.hawalkOtherRequests
      : [];

    tbody.innerHTML = '';

    if (!requests.length) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="padding:20px;text-align:center;color:#999;">
                        No Other Requests yet.
                    </td>
                </tr>
            `;
      return;
    }

    requests.forEach(function (request) {
      const tr = document.createElement('tr');

      tr.style.borderBottom = '1px solid #34344a';

      const date = request.created_at
        ? new Date(request.created_at).toLocaleString()
        : '-';

      const details = [];

      if (
        request.request_type === 'New Stock Item'
      ) {
        details.push(
          'Quantity: ' +
          formatHawalkNumber(request.quantity) +
          ' ' +
          String(request.unit || '')
        );
      }

      if (
        request.cost !== null &&
        request.cost !== undefined
      ) {
        details.push(
          'Estimated cost: ' +
          formatHawalkNumber(request.cost) +
          ' EGP'
        );
      }

      const statusColors = {
        Pending: '#f1c40f',
        Accepted: '#2ecc71',
        Declined: '#e74c3c'
      };

      const statusColor =
        statusColors[request.status] || '#aaa';

      const dateTd = document.createElement('td');
      dateTd.style.padding = '10px';
      dateTd.textContent = date;

      const workerTd = document.createElement('td');
      workerTd.style.padding = '10px';
      workerTd.textContent = request.worker_name || '-';

      const typeTd = document.createElement('td');
      typeTd.style.padding = '10px';
      typeTd.textContent = request.request_type || '-';

      const nameTd = document.createElement('td');
      nameTd.style.padding = '10px';
      nameTd.textContent = request.name || '-';

      const detailsTd = document.createElement('td');
      detailsTd.style.padding = '10px';
      detailsTd.textContent = details.join(' • ') || '-';

      const reasonTd = document.createElement('td');
      reasonTd.style.padding = '10px';
      reasonTd.style.whiteSpace = 'pre-wrap';
      reasonTd.textContent = request.reason || '-';

      const statusTd = document.createElement('td');
      statusTd.style.padding = '10px';
      statusTd.style.color = statusColor;
      statusTd.style.fontWeight = 'bold';
      statusTd.textContent = request.status || 'Pending';

      const actionTd = document.createElement('td');
      actionTd.style.padding = '10px';

      if (request.status === 'Pending') {
        const acceptButton = document.createElement('button');

        acceptButton.type = 'button';
        acceptButton.textContent = '✓ Accept';

        acceptButton.style.cssText = `
                    padding:7px 10px;
                    margin:2px;
                    background:#27ae60;
                    color:#fff;
                    border:0;
                    border-radius:5px;
                    cursor:pointer;
                    font-weight:bold;
                `;

        acceptButton.addEventListener(
          'click',
          function () {
            acceptHawalkOtherRequestFromUI(request.id);
          }
        );

        const declineButton = document.createElement('button');

        declineButton.type = 'button';
        declineButton.textContent = '✕ Decline';

        declineButton.style.cssText = `
                    padding:7px 10px;
                    margin:2px;
                    background:#c0392b;
                    color:#fff;
                    border:0;
                    border-radius:5px;
                    cursor:pointer;
                    font-weight:bold;
                `;

        declineButton.addEventListener(
          'click',
          function () {
            declineHawalkOtherRequestFromUI(request.id);
          }
        );

        actionTd.appendChild(acceptButton);
        actionTd.appendChild(declineButton);

      } else {
        actionTd.textContent = '-';
      }

      [
        dateTd,
        workerTd,
        typeTd,
        nameTd,
        detailsTd,
        reasonTd,
        statusTd,
        actionTd
      ].forEach(function (td) {
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error(
      'TUX POS — Could not render Other Requests:',
      error
    );

    tbody.innerHTML = `
            <tr>
                <td colspan="8" style="padding:20px;text-align:center;color:#e74c3c;">
                    Could not load Other Requests.
                    Check the browser console for details.
                </td>
            </tr>
        `;
  }
}


/* =========================================================
   ADMIN ACCEPT OTHER REQUEST
   Status only — no expense or stock insertion.
   ========================================================= */

async function acceptHawalkOtherRequestFromUI(requestId) {
  if (
    typeof getActiveRole === 'function' &&
    !['admin', 'tuxadmin'].includes(getActiveRole())
  ) {
    alert('Only Admin or Tux Admin can accept this request.');
    return;
  }

  const confirmed = confirm(
    'Accept this Other Request?\n\n' +
    'This will only change its status to Accepted.\n\n' +
    'No expense or stock item will be created automatically.'
  );

  if (!confirmed) {
    return;
  }

  try {
    await acceptHawalkOtherRequest(requestId);

    alert(
      'Request accepted.\n\n' +
      'Its status has been updated. ' +
      'Add the expense or stock item manually if required.'
    );

    await renderHawalkOtherRequestsUI();

  } catch (error) {
    console.error(
      'TUX POS — Accept Other Request failed:',
      error
    );

    alert(
      'Could not accept the request.\n\n' +
      (error.message || 'Unknown error.')
    );
  }
}


/* =========================================================
   ADMIN DECLINE OTHER REQUEST
   Status only — no expense or stock insertion.
   ========================================================= */

async function declineHawalkOtherRequestFromUI(requestId) {
  if (
    typeof getActiveRole === 'function' &&
    !['admin', 'tuxadmin'].includes(getActiveRole())
  ) {
    alert('Only Admin or Tux Admin can decline this request.');
    return;
  }

  const confirmed = confirm(
    'Decline this Other Request?\n\n' +
    'Its status will change to Declined.\n' +
    'Stock and expenses will remain unchanged.'
  );

  if (!confirmed) {
    return;
  }

  try {
    await declineHawalkOtherRequest(requestId);

    alert('Other Request declined.');

    await renderHawalkOtherRequestsUI();

  } catch (error) {
    console.error(
      'TUX POS — Decline Other Request failed:',
      error
    );

    alert(
      'Could not decline the request.\n\n' +
      (error.message || 'Unknown error.')
    );
  }
}


/* =========================================================
   RENDER OTHER REQUESTS BY ROLE
   ========================================================= */


/* =========================================================
   RENDER OTHER REQUESTS BY ROLE
   ========================================================= */


/* =========================================================
   RENDER OTHER REQUESTS BY ROLE
   ========================================================= */

async function renderHawalkOtherRequestsUI() {
  const role =
    typeof getActiveRole === 'function'
      ? String(getActiveRole()).trim().toLowerCase()
      : '';

  const workerSection = document.getElementById(
    'hawalkOtherRequestSection'
  );

  if (role === 'worker') {
    ensureHawalkOtherWorkerForm();

    try {
      await loadHawalkOtherRequestsFromSupabase();

      renderHawalkOtherWorkerHistory(
        window.hawalkOtherRequests
      );
    } catch (error) {
      console.error(
        'TUX POS — Could not load worker Other Requests:',
        error
      );
    }

    return;
  }

  if (workerSection) {
    workerSection.style.display = 'none';
  }

  if (role === 'admin' || role === 'tuxadmin') {
    ensureHawalkOtherAdminContainer();

    await renderHawalkOtherAdminRequests();
  }
}







/* =========================================================
   OTHER REQUESTS REALTIME REFRESH
   ========================================================= */

window.addEventListener(
  'tux-hawalk-other-updated',
  function () {
    const hawalkView = document.getElementById(
      'hawalk-view'
    );

    if (
      hawalkView &&
      hawalkView.classList.contains('active')
    ) {
      renderHawalkOtherRequestsUI();
    }
  }
);