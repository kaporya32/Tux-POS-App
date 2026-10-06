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


function blockTuxPosShiftsMutation(
  action
) {

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
   SHIFTS REALTIME
   ========================================================= */

let shiftsRealtimeChannel = null;

let shiftsRealtimeRefreshTimer = null;


/* =========================================================
   SCHEDULE SHIFTS REALTIME REFRESH
   ========================================================= */

function scheduleShiftsRealtimeRefresh() {

  clearTimeout(
    shiftsRealtimeRefreshTimer
  );


  shiftsRealtimeRefreshTimer =
    setTimeout(
      async function () {

        try {

          await loadCurrentShiftFromSupabase();

          await loadShiftHistoryFromSupabase();


          if (
            typeof updateShiftUI === 'function'
          ) {

            updateShiftUI();

          }


          if (
            typeof renderShiftHistory === 'function'
          ) {

            renderShiftHistory();

          }


          window.dispatchEvent(
            new CustomEvent(
              'tux-shifts-updated'
            )
          );


          console.log(
            'TUX POS — Shifts refreshed after realtime event.'
          );

        }

        catch (error) {

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

  if (
    typeof supabaseClient === 'undefined'
  ) {

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


  shiftsRealtimeChannel =
    supabaseClient
      .channel(
        'tux-shifts-realtime'
      )
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
      .subscribe(
        function (status) {

          console.log(
            'TUX POS — Shifts realtime status:',
            status
          );

        }
      );

}


/* =========================================================
   STOP SHIFTS REALTIME
   ========================================================= */

function stopShiftsRealtime() {

  if (
    shiftsRealtimeChannel
  ) {

    supabaseClient.removeChannel(
      shiftsRealtimeChannel
    );

    shiftsRealtimeChannel =
      null;

  }


  clearTimeout(
    shiftsRealtimeRefreshTimer
  );

  shiftsRealtimeRefreshTimer =
    null;


  console.log(
    'TUX POS — Shifts realtime stopped.'
  );

}


/* =========================================================
   LOAD ACTIVE SHIFT FROM SUPABASE
   ========================================================= */

async function loadCurrentShiftFromSupabase() {

  try {

    const { data, error } = await supabaseClient
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


    currentShift = {

      id:
        shift.id,

      supabaseId:
        shift.id,

      active:
        true,

      startDate:
        new Date(
          shift.start_time
        ).toLocaleDateString(),

      startTime:
        new Date(
          shift.start_time
        ).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),

      startTimestamp:
        shift.start_time,

      startCount:
        shift.opening_count || null,

      endCount:
        shift.closing_count || null,

      startedBy:
        shift.started_by || null

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

    const { data, error } = await supabaseClient
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


    shiftHistory =
      (data || []).map(
        function (shift) {

          const start =
            shift.start_time
              ? new Date(
                  shift.start_time
                )
              : null;


          const end =
            shift.end_time
              ? new Date(
                  shift.end_time
                )
              : null;


          return {

            id:
              shift.id,

            supabaseId:
              shift.id,

            startDate:
              start
                ? start.toLocaleDateString()
                : '-',

            startTime:
              start
                ? start.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '-',

            endDate:
              end
                ? end.toLocaleDateString()
                : '-',

            endTime:
              end
                ? end.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '-',

            startCount:
              shift.opening_count || null,

            endCount:
              shift.closing_count || null,

            startedBy:
              shift.started_by || null

          };

        }
      );


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
   ========================================================= */

async function createShiftInSupabase(
  openingCount
) {

  /* =======================================================
     ADMIN VIEW-ONLY CHECK
     ======================================================= */

  if (
    blockTuxPosShiftsMutation(
      'start a shift'
    )
  ) {

    return null;

  }


  try {

    const activeWorkers =
      typeof getActiveWorkers === 'function'
        ? getActiveWorkers()
        : [];


    let startedBy = null;


    /*
      Use the currently logged-in worker.
    */

    if (
      activeWorkers &&
      activeWorkers.length > 0 &&
      activeWorkers[0] &&
      activeWorkers[0].id
    ) {

      startedBy =
        activeWorkers[0].id;

    }


    const payload = {

      start_time:
        new Date().toISOString(),

      status:
        'open',

      opening_count:
        openingCount || null,

      closing_count:
        null

    };


    /*
      Add worker UUID when available.
    */

    if (startedBy) {

      payload.started_by =
        startedBy;

    }


    const { data, error } =
      await supabaseClient
        .from('shifts')
        .insert(payload)
        .select('*')
        .single();


    if (error) {

      console.error(
        'TUX POS — Failed to create shift:',
        error
      );

      alert(
        'Could not start the shift in Supabase.\n\n' +
        error.message
      );

      return null;

    }


    currentShift = {

      id:
        data.id,

      supabaseId:
        data.id,

      active:
        true,

      startDate:
        new Date(
          data.start_time
        ).toLocaleDateString(),

      startTime:
        new Date(
          data.start_time
        ).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),

      startTimestamp:
        data.start_time,

      startCount:
        data.opening_count || null,

      endCount:
        null,

      startedBy:
        data.started_by || null

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

async function completeShiftInSupabase(
  closingCount
) {

  /* =======================================================
     ADMIN VIEW-ONLY CHECK
     ======================================================= */

  if (
    blockTuxPosShiftsMutation(
      'end the shift'
    )
  ) {

    return false;

  }


  if (
    !currentShift ||
    !currentShift.supabaseId
  ) {

    alert(
      'The active shift could not be found in Supabase.'
    );

    return false;

  }


  try {

    const { data, error } =
      await supabaseClient
        .from('shifts')
        .update({

          end_time:
            new Date().toISOString(),

          status:
            'closed',

          closing_count:
            closingCount || null

        })
        .eq(
          'id',
          currentShift.supabaseId
        )
        .select('*')
        .single();


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


    currentShift.endCount =
      data.closing_count || null;


    currentShift.active =
      false;


    return true;

  } catch (error) {

    console.error(
      'TUX POS — Shift completion failed:',
      error
    );

    alert(
      'Could not end the shift.\n\n' +
      error.message
    );

    return false;

  }

}


/* =========================================================
   COMPATIBILITY
   ========================================================= */

async function saveCurrentShiftData() {

  /*
    Existing application code still calls
    this function.

    Supabase shift saving is now handled by:
      createShiftInSupabase()
      completeShiftInSupabase()
  */

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