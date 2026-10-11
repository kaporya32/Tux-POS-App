/* =========================================================
   TUX POS — SHIFTS SERVICE
   Supabase persistence for shift start / end / history.
   ========================================================= */


/* =========================================================
   ADMIN VIEW-ONLY PROTECTION
   ========================================================= */

function isTuxPosShiftsAdminReadOnly() {
  return (
    typeof adminActive !== 'undefined' &&
    adminActive === true &&
    !(
      typeof tuxAdminActive !== 'undefined' &&
      tuxAdminActive === true
    )
  );
}


function blockTuxPosShiftsMutation(action) {
  if (!isTuxPosShiftsAdminReadOnly()) {
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
   AUTOMATIC STOCK OPENING BALANCE
   ========================================================= */

async function syncStockOpeningBalancesFromCurrent() {
  try {
    const {
      data,
      error
    } = await supabaseClient
      .from('stock_items')
      .select('id,current_quantity')
      .eq('active', true);

    if (error) {
      console.error(
        'TUX POS — Failed to load stock for opening balance:',
        error
      );

      alert(
        'Could not update stock opening balances.\n\n' +
        error.message
      );

      return false;
    }

    const stockItems = data || [];

    for (const item of stockItems) {
      const currentQuantity =
        Number(item.current_quantity || 0);

      const {
        error: updateError
      } = await supabaseClient
        .from('stock_items')
        .update({
          opening_quantity: currentQuantity
        })
        .eq('id', item.id);

      if (updateError) {
        console.error(
          'TUX POS — Failed to update stock opening balance:',
          updateError
        );

        alert(
          'Could not update stock opening balance.\n\n' +
          updateError.message
        );

        return false;
      }
    }

    if (typeof loadStockFromSupabase === 'function') {
      try {
        await loadStockFromSupabase();
      } catch (refreshError) {
        console.error(
          'TUX POS — Stock refresh after opening balance update failed:',
          refreshError
        );
      }
    }

    console.log(
      'TUX POS — Stock opening balances synchronized from current balances.'
    );

    return true;

  } catch (error) {
    console.error(
      'TUX POS — Stock opening balance synchronization failed:',
      error
    );

    alert(
      'Could not update stock opening balances.\n\n' +
      error.message
    );

    return false;
  }
}


/* =========================================================
   BUSINESS DATE — CAIRO
   ========================================================= */

function getTuxBusinessDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const values = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  return (
    values.year +
    '-' +
    values.month +
    '-' +
    values.day
  );
}


/* =========================================================
   SHIFTS REALTIME
   ========================================================= */

let shiftsRealtimeChannel = null;
let shiftsRealtimeRefreshTimer = null;


/* =========================================================
   SCHEDULE SHIFTS REALTIME REFRESH
   ========================================================= */

function scheduleShiftsRealtimeRefresh() {
  clearTimeout(shiftsRealtimeRefreshTimer);

  shiftsRealtimeRefreshTimer = setTimeout(
    async function () {
      try {
        await loadCurrentShiftFromSupabase();
        await loadShiftHistoryFromSupabase();

        if (typeof updateShiftUI === 'function') {
          updateShiftUI();
        }

        if (typeof renderShiftHistory === 'function') {
          renderShiftHistory();
        }

        window.dispatchEvent(
          new CustomEvent('tux-shifts-updated')
        );

        console.log(
          'TUX POS — Shifts refreshed after realtime event.'
        );

      } catch (error) {
        console.error(
          'TUX POS — Failed to refresh shifts after realtime event:',
          error
        );
      }
    },
    300
  );
}


/* =========================================================
   START SHIFTS REALTIME
   ========================================================= */

function startShiftsRealtime() {
  if (typeof supabaseClient === 'undefined') {
    console.error(
      'TUX POS — Supabase client is not available for shifts realtime.'
    );
    return;
  }

  if (shiftsRealtimeChannel) {
    console.log(
      'TUX POS — Shifts realtime is already running.'
    );
    return;
  }

  console.log(
    'TUX POS — Starting shifts realtime...'
  );

  shiftsRealtimeChannel = supabaseClient
    .channel('tux-shifts-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shifts'
      },
      function (payload) {
        console.log(
          'TUX POS — Shifts realtime event:',
          payload.eventType,
          payload
        );

        scheduleShiftsRealtimeRefresh();
      }
    )
    .subscribe(function (status) {
      console.log(
        'TUX POS — Shifts realtime status:',
        status
      );
    });
}


/* =========================================================
   STOP SHIFTS REALTIME
   ========================================================= */

function stopShiftsRealtime() {
  if (shiftsRealtimeChannel) {
    supabaseClient.removeChannel(
      shiftsRealtimeChannel
    );

    shiftsRealtimeChannel = null;
  }

  clearTimeout(shiftsRealtimeRefreshTimer);
  shiftsRealtimeRefreshTimer = null;

  console.log(
    'TUX POS — Shifts realtime stopped.'
  );
}


/* =========================================================
   LOAD ACTIVE SHIFT FROM SUPABASE
   ========================================================= */

async function loadCurrentShiftFromSupabase() {
  try {
    const {
      data,
      error
    } = await supabaseClient
      .from('shifts')
      .select('*')
      .eq('status', 'open')
      .order('created_at', {
        ascending: false
      })
      .limit(1);

    if (error) {
      console.error(
        'TUX POS — Failed to load active shift:',
        error
      );

      currentShift = null;
      return null;
    }

    if (!data || data.length === 0) {
      currentShift = null;
      return null;
    }

    const shift = data[0];

    const start = shift.start_time
      ? new Date(shift.start_time)
      : new Date();

    currentShift = {
      id: shift.id,
      supabaseId: shift.id,
      active: true,

      shiftNumber: shift.shift_number,
      businessDate: shift.business_date,

      startDate: start.toLocaleDateString('en-GB', {
        timeZone: 'Africa/Cairo'
      }),

      startTime: start.toLocaleTimeString('en-GB', {
        timeZone: 'Africa/Cairo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),

      startTimestamp: shift.start_time,
      startCount: shift.opening_count || null,
      endCount: shift.closing_count || null,
      startedBy: shift.started_by || null
    };

    return currentShift;

  } catch (error) {
    console.error(
      'TUX POS — Active shift load failed:',
      error
    );

    currentShift = null;
    return null;
  }
}


/* =========================================================
   LOAD SHIFT HISTORY FROM SUPABASE
   ========================================================= */

async function loadShiftHistoryFromSupabase() {
  try {
    const {
      data,
      error
    } = await supabaseClient
      .from('shifts')
      .select('*')
      .eq('status', 'closed')
      .order('end_time', {
        ascending: false
      });

    if (error) {
      console.error(
        'TUX POS — Failed to load shift history:',
        error
      );

      shiftHistory = [];
      return [];
    }

    shiftHistory = (data || []).map(function (shift) {
      const start = shift.start_time
        ? new Date(shift.start_time)
        : null;

      const end = shift.end_time
        ? new Date(shift.end_time)
        : null;

      return {
        id: shift.id,
        supabaseId: shift.id,

        shiftNumber: shift.shift_number,
        businessDate: shift.business_date,

        startDate: start
          ? start.toLocaleDateString('en-GB', {
              timeZone: 'Africa/Cairo'
            })
          : '-',

        startTime: start
          ? start.toLocaleTimeString('en-GB', {
              timeZone: 'Africa/Cairo',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })
          : '-',

        endDate: end
          ? end.toLocaleDateString('en-GB', {
              timeZone: 'Africa/Cairo'
            })
          : '-',

        endTime: end
          ? end.toLocaleTimeString('en-GB', {
              timeZone: 'Africa/Cairo',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })
          : '-',

        startCount: shift.opening_count || null,
        endCount: shift.closing_count || null,
        startedBy: shift.started_by || null
      };
    });

    return shiftHistory;

  } catch (error) {
    console.error(
      'TUX POS — Shift history load failed:',
      error
    );

    shiftHistory = [];
    return [];
  }
}


/* =========================================================
   CREATE SHIFT IN SUPABASE
   Requires the create_shift_with_number SQL function.
   ========================================================= */

async function createShiftInSupabase() {
  if (
    blockTuxPosShiftsMutation('start a shift')
  ) {
    return null;
  }

  try {
    const stockSynced =
      await syncStockOpeningBalancesFromCurrent();

    if (!stockSynced) {
      return null;
    }

    const activeWorkers =
      typeof getActiveWorkers === 'function'
        ? getActiveWorkers()
        : [];

    const startedBy =
      activeWorkers &&
      activeWorkers.length > 0 &&
      activeWorkers[0] &&
      activeWorkers[0].id
        ? activeWorkers[0].id
        : null;

    const startTime = new Date();
    const businessDate = getTuxBusinessDate(startTime);

    const {
      data,
      error
    } = await supabaseClient.rpc(
      'create_shift_with_number',
      {
        p_start_time: startTime.toISOString(),
        p_business_date: businessDate
      }
    );

    if (error) {
      console.error(
        'TUX POS — Failed to create numbered shift:',
        error
      );

      alert(
        'Could not start the shift in Supabase.\n\n' +
        error.message
      );

      return null;
    }

    const createdShift =
      Array.isArray(data) ? data[0] : data;

    if (!createdShift) {
      alert(
        'Supabase did not return the newly created shift.'
      );
      return null;
    }

    if (startedBy) {
      const {
        error: workerUpdateError
      } = await supabaseClient
        .from('shifts')
        .update({
          started_by: startedBy
        })
        .eq('id', createdShift.id);

      if (workerUpdateError) {
        console.error(
          'TUX POS — Could not save shift worker:',
          workerUpdateError
        );
      }
    }

    const shiftStart = new Date(
      createdShift.start_time
    );

    currentShift = {
      id: createdShift.id,
      supabaseId: createdShift.id,
      active: true,

      shiftNumber: createdShift.shift_number,
      businessDate: createdShift.business_date,

      startDate: shiftStart.toLocaleDateString('en-GB', {
        timeZone: 'Africa/Cairo'
      }),

      startTime: shiftStart.toLocaleTimeString('en-GB', {
        timeZone: 'Africa/Cairo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),

      startTimestamp: createdShift.start_time,
      startCount: null,
      endCount: null,
      startedBy: startedBy
    };

    return currentShift;

  } catch (error) {
    console.error(
      'TUX POS — Shift creation failed:',
      error
    );

    alert(
      'Could not start the shift.\n\n' +
      error.message
    );

    return null;
  }
}


/* =========================================================
   COMPLETE SHIFT IN SUPABASE
   ========================================================= */


async function completeShiftInSupabase() {
  if (blockTuxPosShiftsMutation('end the shift')) {
    return false;
  }

  // Capture the active shift before any asynchronous operation.
  const shift = currentShift;

  if (!shift || !shift.supabaseId) {
    console.error(
      'TUX POS — Cannot complete shift: active shift or Supabase ID is missing.',
      { currentShift: shift }
    );

    alert(
      'The active shift could not be found in Supabase.\n\n' +
      'Please refresh the page and check the active shift before trying again.'
    );

    return false;
  }

  // Keep a stable ID even if currentShift changes while awaiting.
  const shiftId = shift.supabaseId;

  try {
    const stockSynced =
      await syncStockOpeningBalancesFromCurrent();

    if (!stockSynced) {
      return false;
    }

    const {
      data,
      error
    } = await supabaseClient
      .from('shifts')
      .update({
        end_time: new Date().toISOString(),
        status: 'closed',
        closing_count: null
      })
      .eq('id', shiftId)
      .eq('status', 'open')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error(
        'TUX POS — Failed to complete shift:',
        error
      );

      alert(
        'Could not end the shift in Supabase.\n\n' +
        error.message
      );

      return false;
    }

    if (!data) {
      alert(
        'This shift is already closed or is no longer active. Please refresh the page.'
      );

      await loadCurrentShiftFromSupabase();
      await loadShiftHistoryFromSupabase();

      if (typeof updateShiftUI === 'function') {
        updateShiftUI();
      }

      return false;
    }

    // Update the captured shift object, not a possibly changed global.
    shift.endCount = null;
    shift.active = false;

    // Clear the global only if it still refers to this shift.
    if (
      currentShift &&
      String(currentShift.supabaseId) === String(shiftId)
    ) {
      currentShift.endCount = null;
      currentShift.active = false;
    }

    await loadShiftHistoryFromSupabase();

    if (typeof renderShiftHistory === 'function') {
      renderShiftHistory();
    }

    return true;

  } catch (error) {
    console.error(
      'TUX POS — Shift completion failed:',
      error
    );

    alert(
      'Could not end the shift.\n\n' +
      (error?.message || String(error))
    );

    return false;
  }
}



/* =========================================================
   COMPATIBILITY
   ========================================================= */

async function saveCurrentShiftData() {
  return true;
}


/* =========================================================
   LOAD SHIFTS ON APPLICATION START
   ========================================================= */

async function loadSavedShiftData() {
  await loadCurrentShiftFromSupabase();
  await loadShiftHistoryFromSupabase();

  return currentShift;
}