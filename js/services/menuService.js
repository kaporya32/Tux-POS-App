/* =========================================================
   TUX POS — MENU SERVICE
   Supabase menu items + extras
   ========================================================= */


/* =========================================================
   ADMIN VIEW-ONLY PROTECTION
   ========================================================= */

function isTuxPosMenuAdminReadOnly() {

  return (
    typeof adminActive !== 'undefined' &&
    adminActive === true &&
    !(
      typeof tuxAdminActive !== 'undefined' &&
      tuxAdminActive === true
    )
  );

}


function blockTuxPosMenuMutation(
  action
) {

  if (!isTuxPosMenuAdminReadOnly()) {

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
   MENU REALTIME
   ========================================================= */

let menuRealtimeChannel = null;

let menuRealtimeStarted = false;

let menuRealtimeRefreshTimer = null;


/* =========================================================
   LOAD MENU FROM SUPABASE
   ========================================================= */

async function loadMenuFromSupabase() {

  const { data, error } =
    await supabaseClient
      .from('menu_items')
      .select('*')
      .eq('active', true)
      .order('category', {
        ascending: true
      })
      .order('sort_order', {
        ascending: true
      });


  if (error) {

    console.error(
      'TUX POS — Failed to load menu items:',
      error
    );

    throw error;

  }


  const categories = {

    sandwiches: [],

    combos: [],

    fries: [],

    hawawshi: [],

    drinks: [],

    dessert: []

  };


  (data || []).forEach(
    function (item) {

      const category =
        String(
          item.category || ''
        ).toLowerCase();


      if (!categories[category]) {

        categories[category] = [];

      }


      categories[category].push({

        id:
          item.id,

        name:
          item.name,

        price:
          Number(
            item.price
          ),

        sortOrder:
          Number(
            item.sort_order || 0
          ),

        active:
          item.active !== false

      });

    }
  );


  menuItems =
    categories;


  console.log(
    'TUX POS — Menu loaded from Supabase:',
    menuItems
  );


  return menuItems;

}


/* =========================================================
   LOAD EXTRAS FROM SUPABASE
   ========================================================= */

async function loadExtrasFromSupabase() {

  const { data, error } =
    await supabaseClient
      .from('extras')
      .select('*')
      .eq('active', true)
      .order('sort_order', {
        ascending: true
      });


  if (error) {

    console.error(
      'TUX POS — Failed to load extras:',
      error
    );

    throw error;

  }


  extrasItems =
    (data || []).map(
      function (item) {

        return {

          id:
            item.id,

          name:
            item.name,

          price:
            Number(
              item.price
            ),

          sortOrder:
            Number(
              item.sort_order || 0
            ),

          active:
            item.active !== false

        };

      }
    );


  console.log(
    'TUX POS — Extras loaded from Supabase:',
    extrasItems
  );


  return extrasItems;

}


/* =========================================================
   LOAD EVERYTHING
   ========================================================= */

async function loadMenu() {

  await loadMenuFromSupabase();

  await loadExtrasFromSupabase();


  return {

    menuItems:
      menuItems,

    extrasItems:
      extrasItems

  };

}


/* =========================================================
   ADD MENU ITEM
   ========================================================= */

async function addMenuItemToSupabase(
  name,
  price,
  category
) {

  /* =======================================================
     ADMIN VIEW-ONLY CHECK
     ======================================================= */

  if (
    blockTuxPosMenuMutation(
      'add menu items'
    )
  ) {

    return null;

  }


  const existingItems =
    menuItems[category] || [];


  const nextSortOrder =
    existingItems.length > 0
      ? Math.max(
          ...existingItems.map(
            function (item) {

              return Number(
                item.sortOrder || 0
              );

            }
          )
        ) + 1
      : 0;


  const { data, error } =
    await supabaseClient
      .from('menu_items')
      .insert({

        name:
          name,

        price:
          Number(
            price
          ),

        category:
          category,

        sort_order:
          nextSortOrder,

        active:
          true

      })
      .select('*')
      .single();


  if (error) {

    console.error(
      'TUX POS — Failed to add menu item:',
      error
    );

    throw error;

  }


  const newItem = {

    id:
      data.id,

    name:
      data.name,

    price:
      Number(
        data.price
      ),

    sortOrder:
      Number(
        data.sort_order || 0
      ),

    active:
      data.active !== false

  };


  if (!menuItems[category]) {

    menuItems[category] = [];

  }


  menuItems[category].push(
    newItem
  );


  return newItem;

}


/* =========================================================
   ADD EXTRA
   ========================================================= */

async function addExtraToSupabase(
  name,
  price
) {

  /* =======================================================
     ADMIN VIEW-ONLY CHECK
     ======================================================= */

  if (
    blockTuxPosMenuMutation(
      'add extras'
    )
  ) {

    return null;

  }


  const nextSortOrder =
    extrasItems.length > 0
      ? Math.max(
          ...extrasItems.map(
            function (item) {

              return Number(
                item.sortOrder || 0
              );

            }
          )
        ) + 1
      : 0;


  const { data, error } =
    await supabaseClient
      .from('extras')
      .insert({

        name:
          name,

        price:
          Number(
            price
          ),

        sort_order:
          nextSortOrder,

        active:
          true

      })
      .select('*')
      .single();


  if (error) {

    console.error(
      'TUX POS — Failed to add extra:',
      error
    );

    throw error;

  }


  const newExtra = {

    id:
      data.id,

    name:
      data.name,

    price:
      Number(
        data.price
      ),

    sortOrder:
      Number(
        data.sort_order || 0
      ),

    active:
      data.active !== false

  };


  extrasItems.push(
    newExtra
  );


  return newExtra;

}


/* =========================================================
   DELETE MENU ITEM
   Soft delete: active = false
   ========================================================= */

async function deleteMenuItemFromSupabase(
  itemId
) {

  /* =======================================================
     ADMIN VIEW-ONLY CHECK
     ======================================================= */

  if (
    blockTuxPosMenuMutation(
      'delete menu items'
    )
  ) {

    return null;

  }


  const { data, error } =
    await supabaseClient
      .from('menu_items')
      .update({

        active:
          false

      })
      .eq(
        'id',
        itemId
      )
      .select('*')
      .single();


  if (error) {

    console.error(
      'TUX POS — Failed to delete menu item:',
      error
    );

    throw error;

  }


  return data;

}


/* =========================================================
   DELETE EXTRA
   Soft delete: active = false
   ========================================================= */

async function deleteExtraFromSupabase(
  extraId
) {

  /* =======================================================
     ADMIN VIEW-ONLY CHECK
     ======================================================= */

  if (
    blockTuxPosMenuMutation(
      'delete extras'
    )
  ) {

    return null;

  }


  const { data, error } =
    await supabaseClient
      .from('extras')
      .update({

        active:
          false

      })
      .eq(
        'id',
        extraId
      )
      .select('*')
      .single();


  if (error) {

    console.error(
      'TUX POS — Failed to delete extra:',
      error
    );

    throw error;

  }


  return data;

}


/* =========================================================
   UPDATE MENU SORT ORDER
   ========================================================= */

async function saveMenuSortOrder(
  category
) {

  /* =======================================================
     ADMIN VIEW-ONLY CHECK
     ======================================================= */

  if (
    blockTuxPosMenuMutation(
      'change menu order'
    )
  ) {

    return false;

  }


  const items =
    menuItems[category] || [];


  for (
    let index = 0;
    index < items.length;
    index++
  ) {

    const item =
      items[index];


    const { error } =
      await supabaseClient
        .from('menu_items')
        .update({

          sort_order:
            index

        })
        .eq(
          'id',
          item.id
        );


    if (error) {

      console.error(
        'TUX POS — Failed to update menu sort order:',
        error
      );

      throw error;

    }


    item.sortOrder =
      index;

  }

}


/* =========================================================
   UPDATE EXTRAS SORT ORDER
   ========================================================= */

async function saveExtrasSortOrder() {

  /* =======================================================
     ADMIN VIEW-ONLY CHECK
     ======================================================= */

  if (
    blockTuxPosMenuMutation(
      'change extras order'
    )
  ) {

    return false;

  }


  for (
    let index = 0;
    index < extrasItems.length;
    index++
  ) {

    const item =
      extrasItems[index];


    const { error } =
      await supabaseClient
        .from('extras')
        .update({

          sort_order:
            index

        })
        .eq(
          'id',
          item.id
        );


    if (error) {

      console.error(
        'TUX POS — Failed to update extras sort order:',
        error
      );

      throw error;

    }


    item.sortOrder =
      index;

  }

}


/* =========================================================
   COMPATIBILITY FUNCTION
   Old code can still call saveMenuToStorage().
   Menu is now stored in Supabase.
   ========================================================= */

async function saveMenuToStorage() {

  console.warn(
    'TUX POS — saveMenuToStorage() is now handled by Supabase.'
  );


  return true;

}


/* =========================================================
   REALTIME REFRESH
   ========================================================= */

function scheduleMenuRealtimeRefresh() {

  if (
    menuRealtimeRefreshTimer
  ) {

    clearTimeout(
      menuRealtimeRefreshTimer
    );

  }


  menuRealtimeRefreshTimer =
    setTimeout(
      async function () {

        menuRealtimeRefreshTimer =
          null;


        try {

          await loadMenu();


          /* =================================================
             REFRESH ACTUAL MENU UI
             ================================================= */

          if (
            typeof renderMenu === 'function'
          ) {

            renderMenu();

          }


          if (
            typeof renderExtras === 'function'
          ) {

            renderExtras();

          }


          /* =================================================
             REFRESH MENU MANAGEMENT
             ================================================= */

          if (
            typeof populateDeleteMenuSelect === 'function'
          ) {

            populateDeleteMenuSelect();

          }


          if (
            typeof populateRecipeItemSelect === 'function'
          ) {

            populateRecipeItemSelect();

          }


          console.log(
            'TUX POS — Menu UI refreshed after Realtime change.'
          );

        }

        catch (error) {

          console.error(
            'TUX POS — Menu Realtime refresh failed:',
            error
          );

        }

      },
      150
    );

}


/* =========================================================
   START MENU REALTIME
   ========================================================= */

function subscribeToMenuRealtime() {

  if (
    menuRealtimeStarted
  ) {

    console.log(
      'TUX POS — Menu Realtime already active.'
    );

    return;

  }


  if (
    typeof supabaseClient === 'undefined' ||
    !supabaseClient
  ) {

    console.error(
      'TUX POS — Supabase client is not available for Menu Realtime.'
    );

    return;

  }


  menuRealtimeStarted =
    true;


  menuRealtimeChannel =
    supabaseClient
      .channel(
        'tux-pos-menu-realtime'
      )


      /* =====================================================
         MENU ITEMS
         ===================================================== */

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items'
        },
        function (payload) {

          console.log(
            'TUX POS — Menu Realtime menu_items change:',
            payload.eventType
          );


          scheduleMenuRealtimeRefresh();

        }
      )


      /* =====================================================
         EXTRAS
         ===================================================== */

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'extras'
        },
        function (payload) {

          console.log(
            'TUX POS — Menu Realtime extras change:',
            payload.eventType
          );


          scheduleMenuRealtimeRefresh();

        }
      )


      .subscribe(
        function (status) {

          console.log(
            'TUX POS — Menu Realtime status:',
            status
          );


          if (
            status === 'SUBSCRIBED'
          ) {

            console.log(
              'TUX POS — Menu Realtime connected.'
            );

          }


          if (
            status === 'CHANNEL_ERROR'
          ) {

            console.error(
              'TUX POS — Menu Realtime channel error.'
            );

          }


          if (
            status === 'TIMED_OUT'
          ) {

            console.error(
              'TUX POS — Menu Realtime connection timed out.'
            );

          }

        }
      );

}


/* =========================================================
   STOP MENU REALTIME
   ========================================================= */

async function unsubscribeFromMenuRealtime() {

  if (
    menuRealtimeRefreshTimer
  ) {

    clearTimeout(
      menuRealtimeRefreshTimer
    );

    menuRealtimeRefreshTimer =
      null;

  }


  if (
    menuRealtimeChannel
  ) {

    try {

      await supabaseClient.removeChannel(
        menuRealtimeChannel
      );

    }

    catch (error) {

      console.error(
        'TUX POS — Failed to remove Menu Realtime channel:',
        error
      );

    }

  }


  menuRealtimeChannel =
    null;

  menuRealtimeStarted =
    false;


  console.log(
    'TUX POS — Menu Realtime stopped.'
  );

}


/* =========================================================
   START MENU REALTIME AUTOMATICALLY
   ========================================================= */

subscribeToMenuRealtime();