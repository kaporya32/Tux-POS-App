
/* =========================================================
   TUX POS — MENU SERVICE
   Supabase menu items + extras
   ========================================================= */


/* =========================================================
   MENU PERMISSIONS
   Admin and TUX Admin can manage menu items and extras.
   Worker permissions remain unchanged.
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


function blockTuxPosMenuMutation(action) {
  if (!isTuxPosMenuAdminReadOnly()) {
    return false;
  }

  alert(
    'View only - Admin cannot ' +
    String(action || 'modify menu items') +
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
  const { data, error } = await supabaseClient
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

  (data || []).forEach(function (item) {
    const category = String(
      item.category || ''
    ).toLowerCase();

    if (!categories[category]) {
      categories[category] = [];
    }

    categories[category].push({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      sortOrder: Number(item.sort_order || 0),
      active: item.active !== false
    });
  });

  menuItems = categories;

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
  const { data, error } = await supabaseClient
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

  extrasItems = (data || []).map(function (item) {
    return {
      id: item.id,
      name: item.name,
      price: Number(item.price),
      sortOrder: Number(item.sort_order || 0),
      active: item.active !== false
    };
  });

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
    menuItems: menuItems,
    extrasItems: extrasItems
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
  if (blockTuxPosMenuMutation('add menu items')) {
    return null;
  }

  const existingItems = menuItems[category] || [];

  const nextSortOrder = existingItems.length > 0
    ? Math.max(
        ...existingItems.map(function (item) {
          return Number(item.sortOrder || 0);
        })
      ) + 1
    : 0;

  const { data, error } = await supabaseClient
    .from('menu_items')
    .insert({
      name: name,
      price: Number(price),
      category: category,
      sort_order: nextSortOrder,
      active: true
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
    id: data.id,
    name: data.name,
    price: Number(data.price),
    sortOrder: Number(data.sort_order || 0),
    active: data.active !== false
  };

  if (!menuItems[category]) {
    menuItems[category] = [];
  }

  menuItems[category].push(newItem);

  return newItem;
}


/* =========================================================
   ADD EXTRA
   ========================================================= */

async function addExtraToSupabase(
  name,
  price
) {
  if (blockTuxPosMenuMutation('add extras')) {
    return null;
  }

  const nextSortOrder = extrasItems.length > 0
    ? Math.max(
        ...extrasItems.map(function (item) {
          return Number(item.sortOrder || 0);
        })
      ) + 1
    : 0;

  const { data, error } = await supabaseClient
    .from('extras')
    .insert({
      name: name,
      price: Number(price),
      sort_order: nextSortOrder,
      active: true
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
    id: data.id,
    name: data.name,
    price: Number(data.price),
    sortOrder: Number(data.sort_order || 0),
    active: data.active !== false
  };

  extrasItems.push(newExtra);

  return newExtra;
}



/* =========================================================
   DELETE MENU ITEM — SUPABASE
   Soft-deletes a menu item by setting active = false.
   Includes detailed diagnostics for failed updates.
   ========================================================= */

async function deleteMenuItemFromSupabase(itemId) {
  if (blockTuxPosMenuMutation('delete menu items')) {
    console.warn(
      'TUX DEBUG — Menu item deletion blocked by permissions.'
    );

    return null;
  }

  if (!itemId) {
    throw new Error(
      'Cannot delete menu item: item ID is missing.'
    );
  }

  console.log(
    'TUX DEBUG — Deleting menu item:',
    {
      itemId: itemId,
      itemIdType: typeof itemId
    }
  );

  let result;

  try {
    result = await supabaseClient
      .from('menu_items')
      .update({
        active: false
      })
      .eq('id', itemId)
      .select('*')
      .maybeSingle();
  } catch (requestError) {
    console.error(
      'TUX DEBUG — Menu item request threw an exception:',
      {
        itemId: itemId,
        message: requestError.message,
        error: requestError
      }
    );

    throw requestError;
  }

  const data = result.data;
  const error = result.error;

  console.log(
    'TUX DEBUG — Supabase menu update result:',
    {
      itemId: itemId,
      data: data,
      error: error
        ? {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          }
        : null
    }
  );

  if (error) {
    console.error(
      'TUX DEBUG — Menu item deletion failed:',
      {
        itemId: itemId,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }
    );

    throw error;
  }

  if (!data) {
    const noRowError = new Error(
      'Supabase returned no updated menu item. Check the item ID, request response, and database permissions.'
    );

    console.error(
      'TUX DEBUG — No menu item was updated:',
      {
        itemId: itemId,
        table: 'menu_items',
        operation: 'UPDATE',
        requestedChanges: {
          active: false
        }
      }
    );

    throw noRowError;
  }

  console.log(
    'TUX DEBUG — Menu item updated successfully:',
    {
      id: data.id,
      name: data.name,
      active: data.active
    }
  );

  return data;
}



/* =========================================================
   DELETE EXTRA
   Soft delete: active = false
   ========================================================= */

async function deleteExtraFromSupabase(extraId) {
  if (blockTuxPosMenuMutation('delete extras')) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from('extras')
    .update({
      active: false
    })
    .eq('id', extraId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error(
      'TUX POS — Failed to delete extra:',
      error
    );

    throw error;
  }

  if (!data) {
    const noRowError = new Error(
      'No extra was updated. The extra may not exist, or database permissions may prevent the update.'
    );

    console.error(
      'TUX POS — No extra was updated:',
      {
        extraId: extraId,
        table: 'extras'
      }
    );

    throw noRowError;
  }

  return data;
}


/* =========================================================
   UPDATE MENU SORT ORDER
   ========================================================= */

async function saveMenuSortOrder(category) {
  if (blockTuxPosMenuMutation('change menu order')) {
    return false;
  }

  const items = menuItems[category] || [];

  for (
    let index = 0;
    index < items.length;
    index++
  ) {
    const item = items[index];

    const { error } = await supabaseClient
      .from('menu_items')
      .update({
        sort_order: index
      })
      .eq('id', item.id);

    if (error) {
      console.error(
        'TUX POS — Failed to update menu sort order:',
        error
      );

      throw error;
    }

    item.sortOrder = index;
  }
}


/* =========================================================
   UPDATE EXTRAS SORT ORDER
   ========================================================= */

async function saveExtrasSortOrder() {
  if (blockTuxPosMenuMutation('change extras order')) {
    return false;
  }

  for (
    let index = 0;
    index < extrasItems.length;
    index++
  ) {
    const item = extrasItems[index];

    const { error } = await supabaseClient
      .from('extras')
      .update({
        sort_order: index
      })
      .eq('id', item.id);

    if (error) {
      console.error(
        'TUX POS — Failed to update extras sort order:',
        error
      );

      throw error;
    }

    item.sortOrder = index;
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
  if (menuRealtimeRefreshTimer) {
    clearTimeout(menuRealtimeRefreshTimer);
  }

  menuRealtimeRefreshTimer = setTimeout(
    async function () {
      menuRealtimeRefreshTimer = null;

      try {
        await loadMenu();

        if (typeof renderMenu === 'function') {
          renderMenu();
        }

        if (typeof renderExtras === 'function') {
          renderExtras();
        }

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
      } catch (error) {
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
  if (menuRealtimeStarted) {
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

  menuRealtimeStarted = true;

  menuRealtimeChannel = supabaseClient
    .channel('tux-pos-menu-realtime')

    /* MENU ITEMS */

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

    /* EXTRAS */

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

    .subscribe(function (status) {
      console.log(
        'TUX POS — Menu Realtime status:',
        status
      );

      if (status === 'SUBSCRIBED') {
        console.log(
          'TUX POS — Menu Realtime connected.'
        );
      }

      if (status === 'CHANNEL_ERROR') {
        console.error(
          'TUX POS — Menu Realtime channel error.'
        );
      }

      if (status === 'TIMED_OUT') {
        console.error(
          'TUX POS — Menu Realtime connection timed out.'
        );
      }
    });
}


/* =========================================================
   STOP MENU REALTIME
   ========================================================= */

async function unsubscribeFromMenuRealtime() {
  if (menuRealtimeRefreshTimer) {
    clearTimeout(menuRealtimeRefreshTimer);
    menuRealtimeRefreshTimer = null;
  }

  if (menuRealtimeChannel) {
    try {
      await supabaseClient.removeChannel(
        menuRealtimeChannel
      );
    } catch (error) {
      console.error(
        'TUX POS — Failed to remove Menu Realtime channel:',
        error
      );
    }
  }

  menuRealtimeChannel = null;
  menuRealtimeStarted = false;

  console.log(
    'TUX POS — Menu Realtime stopped.'
  );
}


/* =========================================================
   GLOBAL FUNCTIONS
   Make functions available to other script files.
   ========================================================= */

window.loadMenu = loadMenu;
window.loadMenuFromSupabase = loadMenuFromSupabase;
window.loadExtrasFromSupabase = loadExtrasFromSupabase;

window.addMenuItemToSupabase = addMenuItemToSupabase;
window.addExtraToSupabase = addExtraToSupabase;

window.deleteMenuItemFromSupabase = deleteMenuItemFromSupabase;
window.deleteExtraFromSupabase = deleteExtraFromSupabase;

window.saveMenuSortOrder = saveMenuSortOrder;
window.saveExtrasSortOrder = saveExtrasSortOrder;
window.saveMenuToStorage = saveMenuToStorage;

window.subscribeToMenuRealtime = subscribeToMenuRealtime;
window.unsubscribeFromMenuRealtime = unsubscribeFromMenuRealtime;


/* =========================================================
   START MENU REALTIME AUTOMATICALLY
   ========================================================= */

subscribeToMenuRealtime();

