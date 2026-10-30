/* =========================================================
   TUX POS — STOCK / RECIPES SERVICE
   Supabase data access for stock and recipes.
   ========================================================= */


/* =========================================================
   STOCK REALTIME
   ========================================================= */

let stockRealtimeChannel = null;
let stockRealtimeRefreshTimer = null;


/* =========================================================
   PERMISSION HELPERS
   ========================================================= */

/*
 * Stock configuration changes are Tux Admin only.
 *
 * This protects:
 * - Add stock item
 * - Update stock item
 * - Delete stock item
 * - Save recipes
 * - Delete recipes
 */

function requireTuxAdminForStockManagement() {
  const role =
    typeof getActiveRole === 'function'
      ? getActiveRole()
      : null;

  if (
    role !== 'admin' &&
    role !== 'tuxadmin'
  ) {
    alert(
      'Permission denied. Admin or Tux Admin access is required.'
    );

    return false;
  }

  return true;
}

/*
 * Stock deduction is different.
 *
 * A normal worker can complete a kitchen order,
 * which legitimately causes stock to decrease.
 *
 * A Gam3ya meal also legitimately causes stock
 * to decrease.
 *
 * Admin Spectate cannot perform either operation.
 */


function requireStockOperationPermission() {

  const role =
    typeof getActiveRole === 'function'
      ? getActiveRole()
      : null;

  // Admin and TUX Admin can perform stock operations.
  if (
    role === 'admin' ||
    role === 'tuxadmin'
  ) {
    return true;
  }

  // Preserve existing permissions for other roles.
  if (
    typeof adminActive !== 'undefined' &&
    adminActive === true &&
    typeof tuxAdminActive !== 'undefined' &&
    tuxAdminActive !== true
  ) {

    console.warn(
      'TUX POS — Admin Spectate attempted a stock-changing operation.'
    );

    alert(
      'Admin is in Spectate Mode.\n\n' +
      'Stock cannot be changed from Admin mode.'
    );

    return false;
  }

  return true;
}



/* =========================================================
   START STOCK REALTIME
   ========================================================= */

function startStockRealtime() {

  /*
   * Prevent duplicate realtime channels.
   */

  if (stockRealtimeChannel) {

    supabaseClient.removeChannel(
      stockRealtimeChannel
    );

    stockRealtimeChannel = null;

  }


  stockRealtimeChannel =
    supabaseClient

      .channel('tux-stock-realtime')


      /* =====================================================
         STOCK ITEMS
         ===================================================== */

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_items'
        },

        function (payload) {

          console.log(
            'TUX POS — Stock realtime event:',
            payload.eventType,
            payload
          );


          scheduleStockRealtimeRefresh();

        }
      )


      /* =====================================================
         STOCK MOVEMENTS
         ===================================================== */

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_movements'
        },

        function (payload) {

          console.log(
            'TUX POS — Stock movement realtime event:',
            payload.eventType,
            payload
          );


          scheduleStockRealtimeRefresh();

        }
      )


      /* =====================================================
         RECIPES
         ===================================================== */

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recipes'
        },

        function (payload) {

          console.log(
            'TUX POS — Recipe realtime event:',
            payload.eventType,
            payload
          );


          scheduleStockRealtimeRefresh();

        }
      )


      /* =====================================================
         SUBSCRIBE
         ===================================================== */

      .subscribe(function (status) {

        console.log(
          'TUX POS — Stock realtime status:',
          status
        );

      });

}


/* =========================================================
   SCHEDULE STOCK REALTIME REFRESH
   ========================================================= */

function scheduleStockRealtimeRefresh() {

  /*
   * Combine multiple realtime events into one refresh.
   */

  if (stockRealtimeRefreshTimer) {

    clearTimeout(
      stockRealtimeRefreshTimer
    );

  }


  stockRealtimeRefreshTimer =
    setTimeout(
      async function () {

        stockRealtimeRefreshTimer = null;


        try {

          /* =================================================
             RELOAD STOCK
             ================================================= */

          await loadStockFromSupabase();


          /* =================================================
             RELOAD RECIPES
             ================================================= */

          await loadRecipesFromSupabase();


          /* =================================================
             UPDATE STOCK UI
             ================================================= */

          if (
            typeof renderStockView ===
            'function'
          ) {

            renderStockView();

          }


          /* =================================================
             UPDATE STOCK SETTINGS UI
             ================================================= */

          if (
            typeof renderStockSettings ===
            'function'
          ) {

            renderStockSettings();

          }


          /* =================================================
             UPDATE RECIPE SELECT
             ================================================= */

          if (
            typeof populateRecipeItemSelect ===
            'function'
          ) {

            populateRecipeItemSelect();

          }


          /* =================================================
             NOTIFY OTHER MODULES
             ================================================= */

          window.dispatchEvent(
            new CustomEvent(
              'tux-stock-realtime-updated'
            )
          );


          console.log(
            'TUX POS — Stock and recipes refreshed after realtime event.'
          );


        } catch (error) {

          console.error(
            'TUX POS — Failed to refresh stock after realtime event:',
            error
          );

        }

      },
      300
    );

}


/* =========================================================
   STOP STOCK REALTIME
   ========================================================= */

function stopStockRealtime() {

  if (stockRealtimeRefreshTimer) {

    clearTimeout(
      stockRealtimeRefreshTimer
    );

    stockRealtimeRefreshTimer = null;

  }


  if (!stockRealtimeChannel) {

    return;

  }


  supabaseClient.removeChannel(
    stockRealtimeChannel
  );


  stockRealtimeChannel = null;


  console.log(
    'TUX POS — Stock realtime stopped.'
  );

}


/* =========================================================
   STOCK
   ========================================================= */

async function loadStockFromSupabase() {

  try {

    const {
      data,
      error
    } = await supabaseClient
      .from('stock_items')
      .select('*')
      .eq(
        'active',
        true
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      );


    if (error) {

      console.error(
        'TUX POS — Failed to load stock:',
        error
      );

      return [];

    }


    stockInventory = {};


    (data || []).forEach(
      function (item) {

        stockInventory[item.id] = {

          id:
            item.id,

          name:
            item.name,

          unit:
            item.unit,

          opening:
            Number(
              item.opening_quantity || 0
            ),

          current:
            Number(
              item.current_quantity || 0
            ),

          min:
            Number(
              item.minimum_quantity || 0
            ),

          active:
            item.active

        };

      }
    );


    console.log(
      'TUX POS — Stock loaded from Supabase:',
      stockInventory
    );


    return data || [];


  } catch (error) {

    console.error(
      'TUX POS — Stock loading failed:',
      error
    );

    return [];

  }

}


/* =========================================================
   ADD STOCK ITEM
   ========================================================= */


async function addStockItemToSupabase(
  name,
  unit,
  openingQuantity,
  minimumQuantity
) {

  // Allow Admin and TUX Admin only.
  if (
    !requireTuxAdminForStockManagement()
  ) {
    return null;
  }

  try {

    const payload = {

      name:
        String(name).trim(),

      unit:
        String(unit).trim(),

      opening_quantity:
        Number(openingQuantity || 0),

      current_quantity:
        Number(openingQuantity || 0),

      minimum_quantity:
        Number(minimumQuantity || 0),

      active:
        true

    };


    const {
      data,
      error
    } = await supabaseClient
      .from('stock_items')
      .insert(payload)
      .select('*')
      .single();


    if (error) {

      console.error(
        'TUX POS — Failed to add stock item:',
        error
      );

      alert(
        'Could not add the stock item to Supabase.\n\n' +
        error.message
      );

      return null;

    }


    stockInventory[data.id] = {

      id:
        data.id,

      name:
        data.name,

      unit:
        data.unit,

      opening:
        Number(data.opening_quantity || 0),

      current:
        Number(data.current_quantity || 0),

      min:
        Number(data.minimum_quantity || 0),

      active:
        data.active

    };


    console.log(
      'TUX POS — Stock item added:',
      data
    );


    return data;

  } catch (error) {

    console.error(
      'TUX POS — Stock item creation failed:',
      error
    );

    alert(
      'Could not add the stock item.\n\n' +
      error.message
    );

    return null;

  }

}





/* =========================================================
   UPDATE STOCK ITEM
   ========================================================= */

async function updateStockItemInSupabase(
  stockId,
  openingQuantity,
  currentQuantity,
  minimumQuantity
) {

  if (
    !requireTuxAdminForStockManagement()
  ) {

    return null;

  }


  try {

    const payload = {

      opening_quantity:
        Number(
          openingQuantity || 0
        ),

      current_quantity:
        Number(
          currentQuantity || 0
        ),

      minimum_quantity:
        Number(
          minimumQuantity || 0
        )

    };


    const {
      data,
      error
    } = await supabaseClient
      .from('stock_items')
      .update(
        payload
      )
      .eq(
        'id',
        stockId
      )
      .select('*')
      .single();


    if (error) {

      console.error(
        'TUX POS — Failed to update stock item:',
        error
      );

      alert(
        'Could not update the stock item.\n\n' +
        error.message
      );

      return null;

    }


    stockInventory[data.id] = {

      id:
        data.id,

      name:
        data.name,

      unit:
        data.unit,

      opening:
        Number(
          data.opening_quantity || 0
        ),

      current:
        Number(
          data.current_quantity || 0
        ),

      min:
        Number(
          data.minimum_quantity || 0
        ),

      active:
        data.active

    };


    console.log(
      'TUX POS — Stock item updated:',
      data
    );


    return data;


  } catch (error) {

    console.error(
      'TUX POS — Stock update failed:',
      error
    );

    alert(
      'Could not update the stock item.\n\n' +
      error.message
    );

    return null;

  }

}


/* =========================================================
   PERMANENT DELETE STOCK ITEM
   ========================================================= */

async function deleteStockItemFromSupabase(
  stockId
) {

  if (
    !requireTuxAdminForStockManagement()
  ) {

    return false;

  }


  try {

    if (!stockId) {

      alert(
        'Invalid stock item.'
      );

      return false;

    }


    /*
     * Check that the stock item exists.
     */

    const {
      data: stockItem,
      error: stockCheckError
    } =
      await supabaseClient
        .from('stock_items')
        .select('*')
        .eq(
          'id',
          stockId
        )
        .single();


    if (stockCheckError) {

      console.error(
        'TUX POS — Failed to find stock item before deletion:',
        stockCheckError
      );

      alert(
        'Could not find the stock item in Supabase.\n\n' +
        stockCheckError.message
      );

      return false;

    }


    /*
     * Delete stock movements.
     */

    const {
      error: movementDeleteError
    } =
      await supabaseClient
        .from('stock_movements')
        .delete()
        .eq(
          'stock_item_id',
          stockId
        );


    if (movementDeleteError) {

      console.error(
        'TUX POS — Failed to delete stock movements:',
        movementDeleteError
      );

      alert(
        'Could not delete the stock movement history.\n\n' +
        movementDeleteError.message
      );

      return false;

    }


    /*
     * Delete recipes using this stock item.
     */

    const {
      error: recipeDeleteError
    } =
      await supabaseClient
        .from('recipes')
        .delete()
        .eq(
          'stock_item_id',
          stockId
        );


    if (recipeDeleteError) {

      console.error(
        'TUX POS — Failed to delete stock recipes:',
        recipeDeleteError
      );

      alert(
        'Stock history was deleted, but the recipe could not be deleted.\n\n' +
        recipeDeleteError.message
      );

      return false;

    }


    /*
     * Permanently delete stock item.
     */

    const {
      data,
      error: stockDeleteError
    } =
      await supabaseClient
        .from('stock_items')
        .delete()
        .eq(
          'id',
          stockId
        )
        .select('*')
        .single();


    if (stockDeleteError) {

      console.error(
        'TUX POS — Failed to permanently delete stock item:',
        stockDeleteError
      );

      alert(
        'Could not permanently delete the stock item.\n\n' +
        stockDeleteError.message
      );

      return false;

    }


    /*
     * Remove from local state.
     */

    delete stockInventory[
      stockId
    ];


    /*
     * Remove stale recipe references.
     */

    Object.keys(
      recipes || {}
    ).forEach(
      function (menuItemId) {

        if (
          recipes[menuItemId] &&
          Object.prototype.hasOwnProperty.call(
            recipes[menuItemId],
            stockId
          )
        ) {

          delete recipes[menuItemId][
            stockId
          ];

        }

      }
    );


    console.log(
      'TUX POS — Stock item permanently deleted:',
      data
    );


    return true;


  } catch (error) {

    console.error(
      'TUX POS — Permanent stock deletion failed:',
      error
    );

    alert(
      'Could not permanently delete the stock item.\n\n' +
      error.message
    );

    return false;

  }

}


/* =========================================================
   RECIPES
   ========================================================= */

async function loadRecipesFromSupabase() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from('recipes')
        .select('*')
        .order(
          'created_at',
          {
            ascending: true
          }
        );


    if (error) {

      console.error(
        'TUX POS — Failed to load recipes:',
        error
      );

      recipes = {};

      return [];

    }


    recipes = {};


    /*
     * Convert relational Supabase structure into:
     *
     * recipes[menuItemId][stockItemId] = quantity
     */

    (data || []).forEach(
      function (recipe) {

        if (
          !recipes[
            recipe.menu_item_id
          ]
        ) {

          recipes[
            recipe.menu_item_id
          ] = {};

        }


        recipes[
          recipe.menu_item_id
        ][
          recipe.stock_item_id
        ] =
          Number(
            recipe.quantity || 0
          );

      }
    );


    console.log(
      'TUX POS — Recipes loaded from Supabase:',
      recipes
    );


    return data || [];


  } catch (error) {

    console.error(
      'TUX POS — Recipe loading failed:',
      error
    );

    recipes = {};

    return [];

  }

}


/* =========================================================
   SAVE RECIPE
   Saves all ingredients for one menu item.
   ========================================================= */

async function saveRecipeToSupabase(
  menuItemId,
  recipeData
) {

  if (
    !requireTuxAdminForStockManagement()
  ) {

    return false;

  }


  try {

    if (!menuItemId) {

      alert(
        'This recipe is not connected to a menu item.'
      );

      return false;

    }


    const {
      error: deleteError
    } =
      await supabaseClient
        .from('recipes')
        .delete()
        .eq(
          'menu_item_id',
          menuItemId
        );


    if (deleteError) {

      console.error(
        'TUX POS — Failed to clear old recipe:',
        deleteError
      );

      alert(
        'Could not update the recipe.\n\n' +
        deleteError.message
      );

      return false;

    }


    const rows = [];


    Object.keys(
      recipeData || {}
    ).forEach(
      function (stockItemId) {

        const quantity =
          Number(
            recipeData[
              stockItemId
            ] || 0
          );


        if (
          quantity > 0 &&
          stockInventory[
            stockItemId
          ]
        ) {

          rows.push({

            menu_item_id:
              menuItemId,

            stock_item_id:
              stockItemId,

            quantity:
              quantity

          });

        }

      }
    );


    if (
      rows.length > 0
    ) {

      const {
        data,
        error
      } =
        await supabaseClient
          .from('recipes')
          .insert(
            rows
          )
          .select('*');


      if (error) {

        console.error(
          'TUX POS — Failed to save recipe:',
          error
        );

        alert(
          'Could not save the recipe.\n\n' +
          error.message
        );

        return false;

      }


      recipes[
        menuItemId
      ] = {};


      (data || []).forEach(
        function (recipe) {

          recipes[
            menuItemId
          ][
            recipe.stock_item_id
          ] =
            Number(
              recipe.quantity || 0
            );

        }
      );

    }

    else {

      recipes[
        menuItemId
      ] = {};

    }


    console.log(
      'TUX POS — Recipe saved:',
      menuItemId,
      recipes[
        menuItemId
      ]
    );


    return true;


  } catch (error) {

    console.error(
      'TUX POS — Recipe save failed:',
      error
    );

    alert(
      'Could not save the recipe.\n\n' +
      error.message
    );

    return false;

  }

}


/* =========================================================
   DELETE RECIPE
   ========================================================= */

async function deleteRecipeFromSupabase(
  menuItemId
) {

  if (
    !requireTuxAdminForStockManagement()
  ) {

    return false;

  }


  try {

    const {
      error
    } =
      await supabaseClient
        .from('recipes')
        .delete()
        .eq(
          'menu_item_id',
          menuItemId
        );


    if (error) {

      console.error(
        'TUX POS — Failed to delete recipe:',
        error
      );

      return false;

    }


    delete recipes[
      menuItemId
    ];


    return true;


  } catch (error) {

    console.error(
      'TUX POS — Recipe deletion failed:',
      error
    );

    return false;

  }

}


/* =========================================================
   GET RECIPE FOR MENU ITEM
   ========================================================= */

function getRecipeForMenuItem(
  menuItemId
) {

  if (!menuItemId) {

    return {};

  }


  return (
    recipes[
      menuItemId
    ] || {}
  );

}


/* =========================================================
   FIND MENU ITEM BY NAME
   ========================================================= */

function findMenuItemByName(
  itemName
) {

  let found = null;


  Object.keys(
    menuItems || {}
  ).some(
    function (category) {

      const items =
        menuItems[
          category
        ];


      if (
        !Array.isArray(items)
      ) {

        return false;

      }


      const match =
        items.find(
          function (item) {

            return (
              String(
                item.name
              )
              .trim()
              .toLowerCase()
            ) ===
            (
              String(
                itemName
              )
              .trim()
              .toLowerCase()
            );

          }
        );


      if (match) {

        found =
          match;

        return true;

      }


      return false;

    }
  );


  return found;

}












/* =========================================================
   STOCK DEDUCTION
   =========================================================
   Called when:

   1. A normal Kitchen order becomes Done.
   2. A Gam3ya staff meal is registered.

   Normal order:
     movement_type = "sale"

   Gam3ya:
     movement_type = "gamiya"
   ========================================================= */

/* =========================================================
   TUX POS — DEDUCT STOCK FOR ORDER
   Atomic Supabase RPC version

   Permissions:
   - TUX Admin: Allowed
   - Worker: Allowed
   - Admin Spectate: Blocked

   Behavior:
   - Deduct stock when an order is completed.
   - Prevent duplicate deductions.
   - Update local stock cache after successful RPC.
   - Keep stock and movement changes atomic in Supabase.
   ========================================================= */

/* =========================================================
   TUX POS — DEDUCT STOCK FOR ORDER
   Atomic Supabase RPC version

   Permissions:
   - TUX Admin: Allowed
   - Worker: Allowed
   - Admin Spectate: Blocked

   Behavior:
   - Deduct stock when an order is completed.
   - Prevent duplicate deductions.
   - Update local stock cache after successful RPC.
   - Keep stock and movement changes atomic in Supabase.
   ========================================================= */


/* =========================================================
   TUX POS — DEDUCT STOCK FOR ORDER
   Uses stockInventory object + atomic Supabase RPC

   Permissions:
   - TUX Admin: Allowed
   - Worker: Allowed
   - Admin Spectate: Blocked

   Requires:
   - supabaseClient
   - stockInventory
   - deduct_stock_for_order Supabase RPC
   - Existing product recipe data
   ========================================================= */



async function deductStockForOrder(ord) {

  /* =======================================================
     1. VALIDATE ORDER
     ======================================================= */

  if (!ord || typeof ord !== 'object') {
    console.error(
      'TUX POS — Invalid order passed to stock deduction.',
      ord
    );
    return false;
  }

  if (
    typeof requireStockOperationPermission === 'function' &&
    !requireStockOperationPermission()
  ) {
    console.warn(
      'TUX POS — Stock deduction blocked by permissions.'
    );
    return false;
  }

  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {
    console.error(
      'TUX POS — Supabase client is unavailable.'
    );

    alert(
      'Could not deduct stock.\n\n' +
      'Supabase is not initialized.'
    );

    return false;
  }

  const referenceId = String(
    ord.supabaseId ||
    ord.orderId ||
    ''
  ).trim();

  if (!referenceId) {
    console.error(
      'TUX POS — Missing order reference ID.',
      ord
    );

    alert(
      'Could not deduct stock.\n\n' +
      'The order has no valid reference ID.'
    );

    return false;
  }

  if (!Array.isArray(ord.items) || ord.items.length === 0) {
    console.warn(
      'TUX POS — Order contains no items.',
      ord
    );

    return true;
  }


  /* =======================================================
     2. DETERMINE ORDER TYPE
     ======================================================= */

  const isGamiya =
    String(ord.type || '').toLowerCase() === 'gamiya' ||
    ord.isGamiya === true;

  const movementType = isGamiya
    ? 'gamiya'
    : 'sale';

  const orderLabel =
    ord.orderNumber ??
    ord.order_number ??
    ord.orderId ??
    referenceId;

  const movementNote = isGamiya
    ? `Stock deducted for Gam3ya Order #${orderLabel}`
    : `Stock deducted for Order #${orderLabel}`;


  /* =======================================================
     3. VALIDATE STOCK INVENTORY
     ======================================================= */

  if (
    typeof stockInventory === 'undefined' ||
    !stockInventory ||
    typeof stockInventory !== 'object' ||
    Array.isArray(stockInventory)
  ) {

    console.warn(
      'TUX POS — Stock inventory unavailable. Order will proceed without stock deduction.',
      {
        referenceId,
        orderLabel
      }
    );

    return true;
  }


  if (Object.keys(stockInventory).length === 0) {

    console.info(
      'TUX POS — Stock inventory is empty. Order will proceed without stock deduction.',
      {
        referenceId,
        orderLabel
      }
    );

    return true;
  }


  /* =======================================================
     4. VALIDATE RECIPES
     ======================================================= */

  if (
    typeof recipes === 'undefined' ||
    !recipes ||
    typeof recipes !== 'object' ||
    Array.isArray(recipes)
  ) {

    console.warn(
      'TUX POS — Recipes unavailable. Order will proceed without stock deduction.',
      {
        referenceId,
        orderLabel
      }
    );

    return true;
  }


  /* =======================================================
     5. CALCULATE STOCK DEDUCTIONS
     ======================================================= */

  const deductions = new Map();
  const skippedProducts = [];

  for (const orderItem of ord.items) {

    if (!orderItem || typeof orderItem !== 'object') {
      console.error(
        'TUX POS — Invalid order item.',
        orderItem
      );

      return false;
    }

    const itemQuantity = Number(
      orderItem.quantity ??
      orderItem.qty ??
      1
    );

    if (
      !Number.isFinite(itemQuantity) ||
      itemQuantity <= 0
    ) {
      console.error(
        'TUX POS — Invalid order quantity.',
        orderItem
      );

      alert(
        'Could not deduct stock.\n\n' +
        'An order item has an invalid quantity.'
      );

      return false;
    }

    const productId = String(
      orderItem.product_id ??
      orderItem.productId ??
      orderItem.menu_item_id ??
      orderItem.menuItemId ??
      orderItem.id ??
      ''
    ).trim();

    const productName =
      orderItem.product_name ||
      orderItem.productName ||
      orderItem.name ||
      productId ||
      'Unknown product';


    /* PRODUCTS WITHOUT IDs ARE SKIPPED */

    if (!productId) {

      skippedProducts.push({
        productId: '',
        productName
      });

      console.warn(
        'TUX POS — Product skipped: missing product ID.',
        orderItem
      );

      continue;
    }


    const recipe = recipes[productId];


    /* =====================================================
       NO RECIPE = NO STOCK DEDUCTION
       ===================================================== */

    if (
      recipe === undefined ||
      recipe === null ||
      (
        typeof recipe === 'object' &&
        !Array.isArray(recipe) &&
        Object.keys(recipe).length === 0
      )
    ) {

      skippedProducts.push({
        productId,
        productName
      });

      console.info(
        'TUX POS — Product skipped: no ingredients configured.',
        {
          productId,
          productName
        }
      );

      continue;
    }


    /* VALIDATE RECIPE STRUCTURE */

    if (
      typeof recipe !== 'object' ||
      Array.isArray(recipe)
    ) {

      console.error(
        'TUX POS — Invalid recipe structure.',
        {
          productId,
          recipe
        }
      );

      alert(
        'Could not deduct stock.\n\n' +
        'The recipe for "' +
        productName +
        '" is invalid.'
      );

      return false;
    }


    /* PROCESS RECIPE INGREDIENTS */

    for (const [stockItemId, rawQuantity] of Object.entries(recipe)) {

      const quantityPerProduct = Number(rawQuantity);

      if (
        !Number.isFinite(quantityPerProduct) ||
        quantityPerProduct <= 0
      ) {

        console.error(
          'TUX POS — Invalid recipe quantity.',
          {
            productId,
            stockItemId,
            rawQuantity
          }
        );

        alert(
          'Could not deduct stock.\n\n' +
          'A recipe contains an invalid ingredient quantity.'
        );

        return false;
      }

      const totalQuantity =
        quantityPerProduct * itemQuantity;

      deductions.set(
        stockItemId,
        (deductions.get(stockItemId) || 0) +
        totalQuantity
      );
    }
  }


  /* =======================================================
     6. HANDLE ORDERS WITHOUT CONFIGURED RECIPES
     ======================================================= */

  if (deductions.size === 0) {

    console.info(
      'TUX POS — No stock deduction required. Order can proceed.',
      {
        referenceId,
        orderLabel,
        skippedProducts
      }
    );

    return true;
  }


  /* =======================================================
     7. VALIDATE CALCULATED DEDUCTIONS
     ======================================================= */

  const deductionTasks = [];

  for (const [stockItemId, quantity] of deductions.entries()) {

    const stockItem = stockInventory[stockItemId];


    /* MISSING STOCK ITEM = SKIP INGREDIENT */

    if (!stockItem) {

      console.warn(
        'TUX POS — Stock item unavailable. Skipping ingredient.',
        {
          stockItemId,
          quantity
        }
      );

      continue;
    }


    /* INACTIVE STOCK ITEM = SKIP INGREDIENT */

    if (stockItem.active === false) {

      console.warn(
        'TUX POS — Stock item inactive. Skipping ingredient.',
        {
          stockItemId,
          stockItemName: stockItem.name,
          quantity
        }
      );

      continue;
    }


    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {

      console.error(
        'TUX POS — Invalid calculated stock quantity.',
        {
          stockItemId,
          quantity
        }
      );

      return false;
    }


    deductionTasks.push({
      stockItemId,
      quantity,
      stockItem
    });
  }


  /* =======================================================
     8. HANDLE NO AVAILABLE STOCK ITEMS
     ======================================================= */

  if (deductionTasks.length === 0) {

    console.info(
      'TUX POS — No available stock items to deduct. Order can proceed.',
      {
        referenceId,
        orderLabel
      }
    );

    return true;
  }


  /* =======================================================
     9. SELECT AUTHENTICATED SUPABASE CLIENT
     ======================================================= */

  try {

    const activeRole =
      typeof getActiveRole === 'function'
        ? getActiveRole()
        : '';

    const deductionClient =
      activeRole === 'tuxadmin'
        ? (
            typeof tuxAdminAuthClient !== 'undefined'
              ? tuxAdminAuthClient
              : null
          )
        : supabaseClient;


    if (!deductionClient) {

      throw new Error(
        'The Supabase authentication client is unavailable.'
      );
    }


    /* =====================================================
       10. CHECK AUTHENTICATION SESSION
       ===================================================== */

    const {
      data: sessionData,
      error: sessionError
    } = await deductionClient.auth.getSession();

    const session =
      sessionData?.session || null;


    console.log(
      'TUX POS — STOCK AUTH DEBUG:',
      {
        activeRole,

        selectedClient:
          activeRole === 'tuxadmin'
            ? 'tuxAdminAuthClient'
            : 'supabaseClient',

        hasSession:
          !!session,

        userId:
          session?.user?.id || null,

        accessTokenExists:
          !!session?.access_token,

        sessionError:
          sessionError?.message || null
      }
    );


    console.log(
      'TUX POS — AUTH CLIENT DETAILS:',
      {
        activeRole,

        clientUrl:
          deductionClient.supabaseUrl || null,

        clientHasAuth:
          !!deductionClient.auth,

        sessionUserId:
          session?.user?.id || null
      }
    );


    if (sessionError) {

      throw new Error(
        'Could not verify the authentication session: ' +
        sessionError.message
      );
    }


    if (!session || !session.access_token) {

      console.error(
        'TUX POS — Missing authenticated session.',
        {
          activeRole
        }
      );

      alert(
        'Could not deduct stock.\n\n' +
        'Your Supabase session is missing or expired.'
      );

      return false;
    }


    /* =====================================================
       11. EXECUTE SUPABASE DEDUCTIONS
       ===================================================== */

    for (const task of deductionTasks) {

      const {
        stockItemId,
        quantity,
        stockItem
      } = task;


      const {
        data: deductionResult,
        error: deductionError
      } = await deductionClient.rpc(
        'deduct_stock_for_order',
        {
          p_stock_item_id: stockItemId,
          p_quantity: quantity,
          p_reference_id: referenceId,
          p_movement_type: movementType,
          p_note: movementNote
        }
      );


      if (deductionError) {

        console.error(
          'TUX POS — Atomic stock deduction failed.',
          {
            stockItemId,
            stockItemName: stockItem.name,
            quantity,
            referenceId,
            movementType,
            activeRole,
            userId: session.user.id,
            error: deductionError
          }
        );

        alert(
          'Could not deduct stock for "' +
          String(stockItem.name || stockItemId) +
          '".\n\n' +
          deductionError.message
        );

        return false;
      }


      if (
        !deductionResult ||
        deductionResult.success !== true
      ) {

        console.error(
          'TUX POS — Unexpected stock deduction response.',
          {
            stockItemId,
            deductionResult
          }
        );

        alert(
          'Could not deduct stock for "' +
          String(stockItem.name || stockItemId) +
          '".\n\n' +
          'Supabase returned an unexpected response.'
        );

        return false;
      }


      /* UPDATE LOCAL STOCK QUANTITY */

      const newQuantity = Number(
        deductionResult.current_quantity
      );

      if (Number.isFinite(newQuantity)) {
        stockItem.current = newQuantity;
      }


      console.log(
        'TUX POS — Stock deduction completed.',
        {
          stockItemId,
          stockItemName: stockItem.name,

          requestedDeduction:
            quantity,

          actualDeduction:
            deductionResult.already_deducted === true
              ? 0
              : quantity,

          remaining:
            stockItem.current,

          referenceId,
          movementType,

          alreadyDeducted:
            deductionResult.already_deducted === true
        }
      );
    }


    /* =====================================================
       12. REFRESH STOCK UI
       ===================================================== */

    if (typeof renderStock === 'function') {
      renderStock();
    } else if (typeof renderStockItems === 'function') {
      renderStockItems();
    } else if (typeof renderStockView === 'function') {
      renderStockView();
    }


    /* =====================================================
       13. NOTIFY OTHER COMPONENTS
       ===================================================== */

    document.dispatchEvent(
      new CustomEvent(
        'tux-stock-deduction-completed',
        {
          detail: {
            referenceId,
            orderLabel,
            movementType,
            isGamiya,

            items: deductionTasks.map(function (task) {
              return {
                stockItemId: task.stockItemId,
                stockItemName: task.stockItem.name,
                quantity: task.quantity
              };
            }),

            skippedProducts
          }
        }
      )
    );


    /* =====================================================
       14. FINISH
       ===================================================== */

    console.info(
      'TUX POS — Stock deduction processing completed.',
      {
        referenceId,
        orderLabel,

        stockItemsProcessed:
          deductionTasks.length,

        productsSkippedWithoutRecipes:
          skippedProducts.length,

        skippedProducts
      }
    );

    return true;

  } catch (error) {

    console.error(
      'TUX POS — Unexpected stock deduction exception.',
      error
    );

    alert(
      'Could not deduct stock.\n\n' +
      (
        error && error.message
          ? error.message
          : 'An unexpected error occurred.'
      )
    );

    return false;
  }
}




/* =========================================================
   TUX POS — ORDER-SPECIFIC STOCK VALIDATION
   ========================================================= */

/*
 * Calculates the total ingredients required by the current
 * order using the saved recipes and current stock quantities.
 *
 * The minimum-stock threshold is NOT a blocking condition.
 * An order is blocked only when available stock is insufficient.
 */


/* =========================================================
   TUX POS — ORDER-SPECIFIC STOCK VALIDATION
   ========================================================= */

/*
 * Calculates the total ingredients required by the current
 * order using saved recipes and current stock quantities.
 *
 * Gam3ya:
 *   Stock shortages do not block the order.
 *
 * Regular orders:
 *   Existing stock validation remains unchanged.
 *
 * Minimum-stock thresholds are not blocking conditions.
 */

function getCashierLowStockItems(orderItems) {

  const items = Array.isArray(orderItems)
    ? orderItems
    : [];

  const requiredStock = {};


  /* =======================================================
     1. CALCULATE REQUIRED INGREDIENTS
     ======================================================= */

  for (let i = 0; i < items.length; i++) {

    const item = items[i];

    if (!item) continue;

    const menuItem = item.menuItemId
      ? { id: item.menuItemId }
      : findMenuItemByName(item.name);

    if (!menuItem || !menuItem.id) {

      console.warn(
        'TUX POS — Cannot find menu item for stock validation:',
        item.name
      );

      continue;
    }

    const recipe =
      getRecipeForMenuItem(menuItem.id) || {};

    const itemQuantity =
      Number(item.qty || 1);

    if (
      !Number.isFinite(itemQuantity) ||
      itemQuantity <= 0
    ) {
      continue;
    }

    Object.keys(recipe).forEach(
      function (stockItemId) {

        const recipeQuantity =
          Number(recipe[stockItemId] || 0);

        const requiredQuantity =
          recipeQuantity * itemQuantity;

        if (
          !Number.isFinite(requiredQuantity) ||
          requiredQuantity <= 0
        ) {
          return;
        }

        if (!requiredStock[stockItemId]) {
          requiredStock[stockItemId] = 0;
        }

        requiredStock[stockItemId] +=
          requiredQuantity;

      }
    );

  }


  /* =======================================================
     2. CHECK CURRENT STOCK
     ======================================================= */

  const shortages = [];

  Object.keys(requiredStock).forEach(
    function (stockItemId) {

      const stockItem =
        stockInventory[stockItemId];

      const required =
        requiredStock[stockItemId];

      if (
        !stockItem ||
        stockItem.active === false
      ) {

        shortages.push({

          id: stockItemId,

          name: stockItem
            ? stockItem.name
            : 'Missing stock item',

          required: required,

          current: 0,

          shortBy: required,

          unit: stockItem
            ? stockItem.unit || ''
            : ''

        });

        return;
      }

      const available =
        Number(stockItem.current);

      if (!Number.isFinite(available)) {

        shortages.push({

          id: stockItemId,

          name: stockItem.name,

          required: required,

          current: 0,

          shortBy: required,

          unit: stockItem.unit || ''

        });

        return;
      }

      /*
       * Minimum stock is a warning threshold, not a blocker.
       */

      if (
        available + 0.0000001 < required
      ) {

        shortages.push({

          id: stockItemId,

          name: stockItem.name,

          required: required,

          current: available,

          shortBy: Math.round(
            (required - available) * 10000
          ) / 10000,

          unit: stockItem.unit || ''

        });

      }

    }
  );


  /* =======================================================
     3. RETURN SHORTAGES
     ======================================================= */

  return shortages;

}



/* =========================================================
   DISPLAY ORDER-SPECIFIC STOCK SHORTAGES
   ========================================================= */

  function showCashierLowStockPopup(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const details = items.map(function (item) {
      const unit = item.unit ? ' ' + item.unit : '';

      return (
        '• ' + item.name + '\n' +
        '  Required: ' + item.required + unit + '\n' +
        '  Available: ' + item.current + unit + '\n' +
        '  Short by: ' + item.shortBy + unit
      );
    }).join('\n\n');

    alert(
      'CANNOT SEND ORDER TO KITCHEN\n\n' +
      'The current order requires more stock than is available:\n\n' +
      details +
      '\n\nPlease update the stock before sending this order.'
    );
  }