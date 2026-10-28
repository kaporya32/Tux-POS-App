
/* =========================================================
   TUX POS — HAWALK SERVICE
   ========================================================= */


/* =========================================================
   PERMISSIONS
   ========================================================= */

function hawalkCanCreateRequest() {
    const role =
        typeof getActiveRole === 'function'
            ? getActiveRole()
            : null;

    return role === 'worker';
}


function hawalkCanReviewRequest() {
    const role =
        typeof getActiveRole === 'function'
            ? getActiveRole()
            : null;

    return role === 'admin' || role === 'tuxadmin';
}


/* =========================================================
   CURRENT WORKER
   ========================================================= */

function getCurrentHawalkWorker() {
    if (
        !Array.isArray(activeStaffIds) ||
        activeStaffIds.length === 0
    ) {
        return null;
    }

    const workerId =
        activeStaffIds[activeStaffIds.length - 1];

    if (!Array.isArray(workersList)) {
        return null;
    }

    return (
        workersList.find(
            worker =>
                String(worker.id) === String(workerId)
        ) || null
    );
}


/* =========================================================
   SUPABASE ERROR LOGGER
   ========================================================= */

function logHawalkSupabaseError(action, error) {
    console.error(
        `TUX POS — ${action}:`,
        {
            message: error?.message || 'Unknown error',
            code: error?.code || null,
            details: error?.details || null,
            hint: error?.hint || null
        }
    );
}


/* =========================================================
   CREATE HAWALK REQUEST
   Worker submits stock requests.
   Stock is NOT deducted here.
   ========================================================= */


async function mergeSavedShiftSnapshotsIntoHistory() {
  try {
    if (
      typeof supabaseClient === 'undefined' ||
      !supabaseClient
    ) {
      throw new Error(
        'Supabase client is unavailable.'
      );
    }

    /* =========================================================
       1. LOAD SAVED SNAPSHOTS
       ========================================================= */

    const {
      data,
      error
    } = await supabaseClient
      .from('shift_history')
      .select('shift_id, snapshot, closed_at')
      .order('closed_at', {
        ascending: false
      });

    if (error) {
      throw error;
    }

    const savedSnapshots = Array.isArray(data)
      ? data
      : [];

    const existingHistory = Array.isArray(shiftHistory)
      ? shiftHistory
      : [];

    /* =========================================================
       2. INDEX REBUILT HISTORY BY SUPABASE SHIFT ID
       ========================================================= */

    const historyByShiftId = new Map();

    existingHistory.forEach(item => {
      if (!item) return;

      const shiftId = String(
        item.supabaseId ||
        item.shift_id ||
        item.shiftId ||
        item.id ||
        ''
      ).trim();

      if (!shiftId) return;

      historyByShiftId.set(shiftId, item);
    });

    /* =========================================================
       3. MERGE SAVED SNAPSHOTS
       ========================================================= */

    savedSnapshots.forEach(row => {
      if (
        !row ||
        !row.shift_id ||
        !row.snapshot ||
        typeof row.snapshot !== 'object'
      ) {
        return;
      }

      const shiftId = String(row.shift_id);

      const savedSnapshot = row.snapshot;

      const existingSnapshot =
        historyByShiftId.get(shiftId);

      /*
       * The saved snapshot owns the historical financial totals.
       * Rebuilt history supplies current order/expense detail.
       */

      const mergedSnapshot = {
        ...(existingSnapshot || {}),
        ...savedSnapshot,

        id:
          existingSnapshot?.id ||
          savedSnapshot.id ||
          shiftId,

        supabaseId: shiftId,
        shiftId: shiftId,

        shiftNumber:
          savedSnapshot.shiftNumber ??
          savedSnapshot.shift_number ??
          existingSnapshot?.shiftNumber ??
          existingSnapshot?.shift_number ??
          null,

        businessDate:
          savedSnapshot.businessDate ||
          savedSnapshot.business_date ||
          existingSnapshot?.businessDate ||
          existingSnapshot?.business_date ||
          null,

        closedAt:
          row.closed_at ||
          savedSnapshot.closedAt ||
          existingSnapshot?.closedAt ||
          null,

        /*
         * Preserve details rebuilt from the orders and expenses
         * tables when those details are available.
         */

        sales:
          existingSnapshot?.sales ??
          savedSnapshot.sales ??
          [],

        completedSales:
          existingSnapshot?.completedSales ??
          savedSnapshot.completedSales ??
          [],

        expenses:
          existingSnapshot?.expenses ??
          savedSnapshot.expenses ??
          [],

        /*
         * Preserve the saved snapshot's financial values.
         * Do not recalculate them here.
         */

        totalCash:
          savedSnapshot.totalCash ??
          existingSnapshot?.totalCash ??
          0,

        totalInsta:
          savedSnapshot.totalInsta ??
          existingSnapshot?.totalInsta ??
          0,

        totalVisa:
          savedSnapshot.totalVisa ??
          existingSnapshot?.totalVisa ??
          0,

        totalDiscount:
          savedSnapshot.totalDiscount ??
          existingSnapshot?.totalDiscount ??
          0,

        totalSales:
          savedSnapshot.totalSales ??
          existingSnapshot?.totalSales ??
          0,

        totalExpenses:
          savedSnapshot.totalExpenses ??
          existingSnapshot?.totalExpenses ??
          0,

        netProfit:
          savedSnapshot.netProfit ??
          existingSnapshot?.netProfit ??
          0,

        dailyHurryApp:
          savedSnapshot.dailyHurryApp ??
          existingSnapshot?.dailyHurryApp ??
          0,

        totalOrders:
          savedSnapshot.totalOrders ??
          existingSnapshot?.totalOrders ??
          0,

        dailyOrders:
          savedSnapshot.dailyOrders ??
          existingSnapshot?.dailyOrders ??
          0,

        bank:
          savedSnapshot.bank ??
          existingSnapshot?.bank ??
          0,

        overallExpenses:
          savedSnapshot.overallExpenses ??
          existingSnapshot?.overallExpenses ??
          0
      };

      historyByShiftId.set(
        shiftId,
        mergedSnapshot
      );
    });

    /* =========================================================
       4. SORT HISTORY
       ========================================================= */

    shiftHistory = Array.from(
      historyByShiftId.values()
    ).sort((a, b) => {
      function timestamp(item) {
        const value =
          item.end_time ||
          item.closedAt ||
          item.start_time ||
          null;

        if (!value) return 0;

        const parsed = new Date(value).getTime();

        return Number.isFinite(parsed)
          ? parsed
          : 0;
      }

      return timestamp(b) - timestamp(a);
    });

    /* =========================================================
       5. SAVE LOCAL CACHE
       ========================================================= */

    localStorage.setItem(
      'tuxShiftHistory',
      JSON.stringify(shiftHistory)
    );

    console.log(
      'Shift History merged successfully:',
      shiftHistory.length
    );

    return shiftHistory;

  } catch (error) {
    console.error(
      'Failed to merge saved Shift History:',
      error
    );

    throw error;
  }
}



/* =========================================================
   LOAD HAWALK REQUESTS
   ========================================================= */

async function loadHawalkRequestsFromSupabase() {
    try {
        const {
            data,
            error
        } = await supabaseClient
            .from('hawalk_requests')
            .select('*')
            .order('created_at', {
                ascending: false
            });

        if (error) {
            logHawalkSupabaseError(
                'Failed to load Hawalk requests',
                error
            );

            hawalkRequests = [];

            return false;
        }

        hawalkRequests =
            Array.isArray(data)
                ? data
                : [];

        console.log(
            'TUX POS — Hawalk requests loaded:',
            hawalkRequests
        );

        return true;

    } catch (error) {
        console.error(
            'TUX POS — Hawalk request loading exception:',
            error
        );

        hawalkRequests = [];

        return false;
    }
}


/* =========================================================
   GET HAWALK REQUESTS
   ========================================================= */

function getHawalkRequests() {
    return Array.isArray(hawalkRequests)
        ? hawalkRequests
        : [];
}


/* =========================================================
   REVIEWER NAME
   ========================================================= */

function getHawalkReviewerName() {
    const role =
        typeof getActiveRole === 'function'
            ? getActiveRole()
            : null;

    if (role === 'tuxadmin') {
        return 'Tux Admin';
    }

    if (role === 'admin') {
        if (
            typeof adminAccount !== 'undefined' &&
            adminAccount &&
            adminAccount.name
        ) {
            return adminAccount.name;
        }

        return 'Admin';
    }

    return 'Unknown';
}


/* =========================================================
   ACCEPT HAWALK REQUEST
   Stock deduction is handled by the Supabase RPC.
   ========================================================= */

async function acceptHawalkRequest(requestId) {
    if (!hawalkCanReviewRequest()) {
        throw new Error(
            'Only Admin or Tux Admin can accept a Hawalk request.'
        );
    }

    const id = Number(requestId);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error(
            'Invalid Hawalk request ID.'
        );
    }

    const reviewer =
        getHawalkReviewerName();

    const {
        data,
        error
    } = await supabaseClient.rpc(
        'accept_hawalk_request',
        {
            p_request_id: id,
            p_reviewer: reviewer
        }
    );

    if (error) {
        logHawalkSupabaseError(
            'Failed to accept Hawalk request',
            error
        );

        throw error;
    }

    await loadHawalkRequestsFromSupabase();

    if (
        typeof loadStockFromSupabase === 'function'
    ) {
        await loadStockFromSupabase();
    }

    window.dispatchEvent(
        new CustomEvent('tux-stock-realtime-updated')
    );

    window.dispatchEvent(
        new CustomEvent('tux-hawalk-updated')
    );

    console.log(
        'TUX POS — Hawalk request accepted:',
        data
    );

    return data;
}


/* =========================================================
   DECLINE HAWALK REQUEST
   ========================================================= */

async function declineHawalkRequest(requestId) {
    if (!hawalkCanReviewRequest()) {
        throw new Error(
            'Only Admin or Tux Admin can decline a Hawalk request.'
        );
    }

    const id = Number(requestId);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error(
            'Invalid Hawalk request ID.'
        );
    }

    const reviewer =
        getHawalkReviewerName();

    const {
        data,
        error
    } = await supabaseClient.rpc(
        'decline_hawalk_request',
        {
            p_request_id: id,
            p_reviewer: reviewer
        }
    );

    if (error) {
        logHawalkSupabaseError(
            'Failed to decline Hawalk request',
            error
        );

        throw error;
    }

    await loadHawalkRequestsFromSupabase();

    window.dispatchEvent(
        new CustomEvent('tux-hawalk-updated')
    );

    console.log(
        'TUX POS — Hawalk request declined:',
        data
    );

    return data;
}


/* =========================================================
   REALTIME — HAWALK REQUESTS
   ========================================================= */

let hawalkRealtimeChannel = null;


function startHawalkRealtime() {
    try {
        if (
            typeof supabaseClient === 'undefined' ||
            !supabaseClient
        ) {
            console.error(
                'TUX POS — Cannot start Hawalk realtime: Supabase client unavailable.'
            );

            return;
        }

        if (hawalkRealtimeChannel) {
            try {
                supabaseClient.removeChannel(
                    hawalkRealtimeChannel
                );
            } catch (error) {
                console.warn(
                    'TUX POS — Could not remove old Hawalk channel:',
                    error
                );
            }

            hawalkRealtimeChannel = null;
        }

        hawalkRealtimeChannel =
            supabaseClient
                .channel('tux-hawalk-realtime')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'hawalk_requests'
                    },
                    async function (payload) {
                        console.log(
                            'TUX POS — Hawalk realtime update:',
                            payload
                        );

                        await loadHawalkRequestsFromSupabase();

                        if (
                            typeof loadStockFromSupabase ===
                            'function'
                        ) {
                            await loadStockFromSupabase();
                        }

                        window.dispatchEvent(
                            new CustomEvent(
                                'tux-hawalk-updated'
                            )
                        );
                    }
                )
                .subscribe(function (status) {
                    console.log(
                        'TUX POS — Hawalk realtime status:',
                        status
                    );
                });

    } catch (error) {
        console.error(
            'TUX POS — Failed to start Hawalk realtime:',
            error
        );
    }
}


/* =========================================================
   TUX POS — HAWALK OTHER REQUESTS
   These requests do not automatically modify stock
   or expenses.
   ========================================================= */


/* =========================================================
   LOAD OTHER REQUESTS
   ========================================================= */

async function loadHawalkOtherRequestsFromSupabase() {
    try {
        const {
            data,
            error
        } = await supabaseClient
            .from('hawalk_other_requests')
            .select('*')
            .order('created_at', {
                ascending: false
            });

        if (error) {
            logHawalkSupabaseError(
                'Failed to load Hawalk Other Requests',
                error
            );

            throw error;
        }

        window.hawalkOtherRequests =
            Array.isArray(data)
                ? data
                : [];

        window.dispatchEvent(
            new CustomEvent('tux-hawalk-other-updated')
        );

        return window.hawalkOtherRequests;

    } catch (error) {
        console.error(
            'TUX POS — Hawalk Other Request loading error:',
            error
        );

        throw error;
    }
}


/* =========================================================
   CREATE OTHER REQUEST
   Worker fills in Request Type and Quantity only.
   ========================================================= */

async function createHawalkOtherRequest(request) {
    if (!hawalkCanCreateRequest()) {
        throw new Error(
            'Only a Worker can create a Hawalk Other Request.'
        );
    }

    if (!request || typeof request !== 'object') {
        throw new Error(
            'Invalid request information.'
        );
    }

    const worker =
        getCurrentHawalkWorker();

    if (!worker) {
        throw new Error(
            'No active worker is logged in.'
        );
    }


    /* =========================================
       VALIDATE REQUEST TYPE
       ========================================= */

    const requestType =
        String(request.requestType || '').trim();

    if (!requestType) {
        throw new Error(
            'Please enter the request type.'
        );
    }


    /* =========================================
       VALIDATE QUANTITY
       ========================================= */

    const quantity =
        request.quantity === '' ||
        request.quantity === null ||
        request.quantity === undefined
            ? NaN
            : Number(request.quantity);

    if (
        !Number.isFinite(quantity) ||
        quantity <= 0
    ) {
        throw new Error(
            'Please enter a quantity greater than zero.'
        );
    }


    /* =========================================
       CREATE OTHER REQUEST
       Does not modify stock or expenses.
       ========================================= */

    const {
        data,
        error
    } = await supabaseClient
        .from('hawalk_other_requests')
        .insert({
            worker_id: String(worker.id),

            worker_name: String(
                worker.name || 'Unknown Worker'
            ),

            request_type: requestType,

            quantity: quantity,

            status: 'Pending'
        })
        .select()
        .single();

    if (error) {
        logHawalkSupabaseError(
            'Failed to create Hawalk Other Request',
            error
        );

        throw error;
    }


    /* =========================================
       UPDATE LOCAL REQUEST LIST
       ========================================= */

    if (!Array.isArray(window.hawalkOtherRequests)) {
        window.hawalkOtherRequests = [];
    }

    window.hawalkOtherRequests.unshift(data);

    window.dispatchEvent(
        new CustomEvent('tux-hawalk-other-updated')
    );

    console.log(
        'TUX POS — Hawalk Other Request created:',
        data
    );

    return data;
}


/* =========================================================
   ACCEPT OTHER REQUEST
   Only changes the request status.
   ========================================================= */

async function acceptHawalkOtherRequest(requestId) {
    if (!hawalkCanReviewRequest()) {
        throw new Error(
            'Only Admin or Tux Admin can accept a request.'
        );
    }

    const id = Number(requestId);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error(
            'Invalid request ID.'
        );
    }

    const reviewer =
        getHawalkReviewerName();

    const {
        data,
        error
    } = await supabaseClient
        .from('hawalk_other_requests')
        .update({
            status: 'Accepted',
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewer
        })
        .eq('id', id)
        .eq('status', 'Pending')
        .select()
        .maybeSingle();

    if (error) {
        logHawalkSupabaseError(
            'Failed to accept Hawalk Other Request',
            error
        );

        throw error;
    }

    if (!data) {
        throw new Error(
            'This request was already reviewed or no longer exists.'
        );
    }

    await loadHawalkOtherRequestsFromSupabase();

    return data;
}


/* =========================================================
   DECLINE OTHER REQUEST
   Only changes the request status.
   ========================================================= */

async function declineHawalkOtherRequest(requestId) {
    if (!hawalkCanReviewRequest()) {
        throw new Error(
            'Only Admin or Tux Admin can decline a request.'
        );
    }

    const id = Number(requestId);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error(
            'Invalid request ID.'
        );
    }

    const reviewer =
        getHawalkReviewerName();

    const {
        data,
        error
    } = await supabaseClient
        .from('hawalk_other_requests')
        .update({
            status: 'Declined',
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewer
        })
        .eq('id', id)
        .eq('status', 'Pending')
        .select()
        .maybeSingle();

    if (error) {
        logHawalkSupabaseError(
            'Failed to decline Hawalk Other Request',
            error
        );

        throw error;
    }

    if (!data) {
        throw new Error(
            'This request was already reviewed or no longer exists.'
        );
    }

    await loadHawalkOtherRequestsFromSupabase();

    return data;
}

