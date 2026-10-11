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

  if (
    typeof tuxAdminActive !== 'undefined' &&
    tuxAdminActive === true
  ) {

    return true;

  }


  alert(
    'Only Tux Admin can modify stock or recipes.'
  );


  return false;

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
        Number(
          openingQuantity || 0
        ),

      current_quantity:
        Number(
          openingQuantity || 0
        ),

      minimum_quantity:
        Number(
          minimumQuantity || 0
        ),

      active:
        true

    };


    const {
      data,
      error
    } = await supabaseClient
      .from('stock_items')
      .insert(
        payload
      )
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

async function deductStockForOrder(
  ord
) {

  /*
   * This is a legitimate operational action.
   *
   * Worker:
   *   ALLOWED
   *
   * Tux Admin:
   *   ALLOWED
   *
   * Admin Spectate:
   *   BLOCKED
   */

  if (
    !requireStockOperationPermission()
  ) {

    return false;

  }


  try {

    if (!ord) {

      console.warn(
        'TUX POS — Stock deduction received an empty order.'
      );

      return false;

    }


    /*
     * Support both:
     *
     * Normal order:
     *   ord.supabaseId
     *
     * Gam3ya:
     *   ord.supabaseId
     *
     * Fallback:
     *   ord.orderId
     */

    const referenceId =
      ord.supabaseId ||
      ord.orderId ||
      null;


    if (!referenceId) {

      console.warn(
        'TUX POS — Cannot deduct stock without order ID.'
      );

      return false;

    }


    if (
      !Array.isArray(
        ord.items
      )
    ) {

      console.warn(
        'TUX POS — Cannot deduct stock without order items.'
      );

      return false;

    }


    /*
     * Determine whether this is Gam3ya.
     */

    const isGamiya =
      ord.type === 'gamiya' ||
      ord.isGamiya === true;


    /*
     * Normal sale:
     *   sale
     *
     * Gam3ya:
     *   gamiya
     */

    const movementType =
      isGamiya
        ? 'gamiya'
        : 'sale';


    const movementNote =
      isGamiya

        ? (
            'Stock deducted for Gam3ya meal — ' +
            (
              ord.workerName ||
              'Staff'
            )
          )

        : (
            'Stock deducted for Order #' +
            (
              ord.orderNum ||
              referenceId
            )
          );


    console.log(
      'TUX POS — Starting stock deduction:',
      {
        referenceId:
          referenceId,

        type:
          movementType,

        items:
          ord.items
      }
    );


    /*
     * Build one total deduction per stock item.
     */

    const deductions = {};


    for (
      let i = 0;
      i < ord.items.length;
      i++
    ) {

      const item =
        ord.items[i];


      if (!item) {

        continue;

      }


      /*
       * Prefer menuItemId.
       *
       * Otherwise find the menu item by name.
       */

      const menuItem =
        item.menuItemId

          ? {
              id:
                item.menuItemId
            }

          : findMenuItemByName(
              item.name
            );


      if (
        !menuItem ||
        !menuItem.id
      ) {

        console.warn(
          'TUX POS — Could not find menu item for stock deduction:',
          item.name
        );

        continue;

      }


      /*
       * Get recipe.
       */

      const recipe =
        getRecipeForMenuItem(
          menuItem.id
        );


      const stockIds =
        Object.keys(
          recipe
        );


      if (
        stockIds.length === 0
      ) {

        console.log(
          'TUX POS — No recipe found for:',
          item.name
        );

        continue;

      }


      for (
        let j = 0;
        j < stockIds.length;
        j++
      ) {

        const stockItemId =
          stockIds[j];


        const recipeQuantity =
          Number(
            recipe[
              stockItemId
            ] || 0
          );


        const itemQuantity =
          Number(
            item.qty || 1
          );


        const deduction =
          recipeQuantity *
          itemQuantity;


        if (
          !(deduction > 0)
        ) {

          continue;

        }


        if (
          !deductions[
            stockItemId
          ]
        ) {

          deductions[
            stockItemId
          ] = 0;

        }


        deductions[
          stockItemId
        ] += deduction;

      }

    }


    const stockIds =
      Object.keys(
        deductions
      );


    /*
     * No recipes means nothing to deduct.
     */

    if (
      stockIds.length === 0
    ) {

      console.log(
        'TUX POS — No recipe-based stock deductions for:',
        referenceId
      );

      return true;

    }


    /*
     * Process each stock item once.
     */

    for (
      let i = 0;
      i < stockIds.length;
      i++
    ) {

      const stockItemId =
        stockIds[i];


      const deduction =
        Math.round(
          Number(
            deductions[
              stockItemId
            ]
          ) * 10000
        ) / 10000;


      if (
        !(deduction > 0)
      ) {

        continue;

      }


      const stockItem =
        stockInventory[
          stockItemId
        ];


      if (!stockItem) {

        console.warn(
          'TUX POS — Stock item not found:',
          stockItemId
        );

        continue;

      }


      /*
       * Check whether this exact stock movement
       * already exists.
       *
       * This prevents duplicate deductions
       * when Realtime or another process calls
       * the function again.
       */

      const {
        data: existingMovement,
        error: movementCheckError
      } =
        await supabaseClient
          .from('stock_movements')
          .select('id')
          .eq(
            'stock_item_id',
            stockItemId
          )
          .eq(
            'reference_id',
            referenceId
          )
          .eq(
            'movement_type',
            movementType
          )
          .limit(1);


      if (
        movementCheckError
      ) {

        console.error(
          'TUX POS — Failed to check stock movement:',
          movementCheckError
        );

        alert(
          'Could not verify stock movement.\n\n' +
          movementCheckError.message
        );

        return false;

      }


      if (
        existingMovement &&
        existingMovement.length > 0
      ) {

        console.log(
          'TUX POS — Stock already deducted:',
          referenceId,
          stockItem.name,
          movementType
        );

        continue;

      }


      /*
       * Calculate new quantity.
       */

      const newQuantity =
        Math.round(
          (
            Number(
              stockItem.current
            ) -
            deduction
          ) * 10000
        ) / 10000;


      /*
       * Update stock quantity.
       */

      const {
        data: updatedStock,
        error: stockError
      } =
        await supabaseClient
          .from('stock_items')
          .update({

            current_quantity:
              newQuantity

          })
          .eq(
            'id',
            stockItemId
          )
          .select('*')
          .single();


      if (stockError) {

        console.error(
          'TUX POS — Failed to deduct stock:',
          stockError
        );

        alert(
          'Could not deduct stock for "' +
          stockItem.name +
          '".\n\n' +
          stockError.message
        );

        return false;

      }


      /*
       * Save stock movement.
       */

      const {
        data: movement,
        error: movementError
      } =
        await supabaseClient
          .from('stock_movements')
          .insert({

            stock_item_id:
              stockItemId,

            quantity:
              -deduction,

            movement_type:
              movementType,

            reference_id:
              referenceId,

            note:
              movementNote

          })
          .select('*')
          .single();


      if (
        movementError
      ) {

        /*
         * Unique database constraint.
         *
         * Another process may have inserted
         * the exact same movement.
         */

        if (
          movementError.code === '23505'
        ) {

          console.log(
            'TUX POS — Duplicate stock movement prevented:',
            referenceId,
            stockItem.name
          );


          /*
           * Reload the real stock value.
           */

          const {
            data: realStock
          } =
            await supabaseClient
              .from('stock_items')
              .select('*')
              .eq(
                'id',
                stockItemId
              )
              .single();


          if (realStock) {

            stockItem.current =
              Number(
                realStock.current_quantity ||
                0
              );

          }


          continue;

        }


        console.error(
          'TUX POS — Failed to save stock movement:',
          movementError
        );

        alert(
          'Stock quantity was updated, but the stock movement could not be saved.\n\n' +
          movementError.message
        );

        return false;

      }


      /*
       * Update local stock state.
       */

      stockItem.current =
        Number(
          updatedStock.current_quantity ||
          0
        );


      console.log(
        'TUX POS — Stock deducted:',
        {
          item:
            stockItem.name,

          deduction:
            deduction,

          unit:
            stockItem.unit,

          remaining:
            stockItem.current,

          movementType:
            movementType,

          referenceId:
            referenceId,

          movement:
            movement
        }
      );

    }


    /*
     * Update Stock UI.
     */

    if (
      typeof renderStockView ===
      'function'
    ) {

      renderStockView();

    }


    /*
     * Notify other modules.
     */

    window.dispatchEvent(
      new CustomEvent(
        'tux-stock-deduction-completed',
        {
          detail: {
            referenceId:
              referenceId,

            movementType:
              movementType
          }
        }
      )
    );


    console.log(
      'TUX POS — Stock deduction completed:',
      {
        referenceId:
          referenceId,

        type:
          movementType
      }
    );


    return true;


  } catch (error) {

    console.error(
      'TUX POS — Stock deduction failed:',
      error
    );

    alert(
      'Could not deduct stock.\n\n' +
      error.message
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

function getCashierLowStockItems(orderItems) {
  const items = Array.isArray(orderItems) ? orderItems : [];
  const requiredStock = {};

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

    const recipe = getRecipeForMenuItem(menuItem.id) || {};
    const itemQuantity = Number(item.qty || 1);

    if (
      !Number.isFinite(itemQuantity) ||
      itemQuantity <= 0
    ) {
      continue;
    }

    Object.keys(recipe).forEach(function (stockItemId) {
      const recipeQuantity = Number(recipe[stockItemId] || 0);
      const requiredQuantity = recipeQuantity * itemQuantity;

      if (
        !Number.isFinite(requiredQuantity) ||
        requiredQuantity <= 0
      ) {
        return;
      }

      if (!requiredStock[stockItemId]) {
        requiredStock[stockItemId] = 0;
      }

      requiredStock[stockItemId] += requiredQuantity;
    });
  }

  const shortages = [];

  Object.keys(requiredStock).forEach(function (stockItemId) {
    const stockItem = stockInventory[stockItemId];
    const required = requiredStock[stockItemId];

    if (!stockItem || stockItem.active === false) {
      shortages.push({
        id: stockItemId,
        name: stockItem
          ? stockItem.name
          : 'Missing stock item',
        required: required,
        current: 0,
        shortBy: required,
        unit: stockItem ? stockItem.unit || '' : ''
      });

      return;
    }

    const available = Number(stockItem.current);

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
     * Do not compare against stockItem.min.
     * Minimum stock is a warning threshold, not a blocker.
     */

    if (available + 0.0000001 < required) {
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
  });

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