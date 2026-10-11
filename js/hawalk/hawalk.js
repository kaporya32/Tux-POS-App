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

  /*
   * If the button already exists, do nothing.
   */

  let deleteButton =
    document.getElementById(
      'deleteHawalkDataBtn'
    );

  if (deleteButton) {
    return deleteButton;
  }


  /*
   * Find the existing Refresh button.
   *
   * We support both possible versions:
   *
   * onclick="refreshHawalk()"
   *
   * and
   *
   * onclick="renderHawalkView()"
   */

  let refreshButton =
    document.querySelector(
      '#hawalk-view button[onclick*="refreshHawalk"]'
    );


  if (!refreshButton) {

    refreshButton =
      document.querySelector(
        '#hawalk-view button[onclick*="renderHawalkView"]'
      );

  }


  /*
   * If Refresh button cannot be found,
   * do not create a random button somewhere else.
   */

  if (!refreshButton) {

    console.warn(
      'TUX POS — Hawalk Refresh button was not found.'
    );

    return null;

  }


  /*
   * Create Delete Data button.
   */

  deleteButton =
    document.createElement('button');


  deleteButton.type =
    'button';


  deleteButton.id =
    'deleteHawalkDataBtn';


  deleteButton.className =
    'tool-btn';


  deleteButton.textContent =
    '🗑️ Delete Data';


  deleteButton.title =
    'Delete all Hawalk data';


  deleteButton.style.width =
    'auto';


  deleteButton.style.padding =
    '5px 10px';


  deleteButton.style.marginLeft =
    '6px';


  deleteButton.style.background =
    '#c0392b';


  deleteButton.style.color =
    '#ffffff';


  deleteButton.style.border =
    'none';


  deleteButton.style.cursor =
    'pointer';


  deleteButton.style.display =
    'none';


  deleteButton.addEventListener(
    'click',
    function () {

      deleteAllHawalkData();

    }
  );


  /*
   * Put the button directly beside Refresh.
   */

  refreshButton.insertAdjacentElement(
    'afterend',
    deleteButton
  );


  console.log(
    'TUX POS — Hawalk Delete Data button created.'
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

async function deleteAllHawalkData() {

  const role =
    typeof getActiveRole === 'function'
      ? getActiveRole()
      : null;


  if (
    role !== 'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can delete Hawalk data.'
    );

    return;

  }


  const confirmed =
    confirm(
      '⚠️ DELETE ALL HAWALK DATA?\n\n' +
      'This will permanently delete ALL Hawalk requests and history.\n\n' +
      'Accepted, Declined, and Pending requests will all be deleted.\n\n' +
      'Stock quantities will NOT be changed.\n\n' +
      'This action cannot be undone.'
    );


  if (!confirmed) {
    return;
  }


  const secondConfirmed =
    confirm(
      'FINAL WARNING!\n\n' +
      'Delete ALL Hawalk data permanently?'
    );


  if (!secondConfirmed) {
    return;

  }


  const deleteButton =
    document.getElementById(
      'deleteHawalkDataBtn'
    );


  try {

    if (deleteButton) {

      deleteButton.disabled =
        true;

      deleteButton.textContent =
        '⏳ Deleting...';

    }


    const {
      error
    } =
      await supabaseClient
        .from('hawalk_requests')
        .delete()
        .not(
          'id',
          'is',
          null
        );


    if (error) {
      throw error;
    }


    if (
      typeof loadHawalkRequestsFromSupabase ===
      'function'
    ) {

      await loadHawalkRequestsFromSupabase();

    }


    await renderHawalkAdminRequests();


    alert(
      'All Hawalk data has been deleted successfully.'
    );


  } catch (error) {

    console.error(
      'TUX POS — Delete Hawalk data failed:',
      error
    );


    alert(
      'Could not delete Hawalk data.\n\n' +
      (
        error.message ||
        'Unknown error.'
      )
    );


  } finally {

    if (deleteButton) {

      deleteButton.disabled =
        false;

      deleteButton.textContent =
        '🗑️ Delete Data';

    }

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