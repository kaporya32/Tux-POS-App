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

    return (
        role === 'admin' ||
        role === 'tuxadmin'
    );
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

            console.error(
                'TUX POS — Failed to load Hawalk requests:',
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
   CREATE REQUEST
   ========================================================= */

async function createHawalkRequest(items) {

    if (!hawalkCanCreateRequest()) {

        throw new Error(
            'Only a Worker can create a Hawalk request.'
        );
    }

    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {

        throw new Error(
            'Please enter a quantity for at least one stock item.'
        );
    }

    const worker =
        getCurrentHawalkWorker();

    if (!worker) {

        throw new Error(
            'No active worker is logged in.'
        );
    }


    const validatedItems = [];


    for (const item of items) {

        if (!item) {
            continue;
        }


        const stockItemId =
            String(item.stockItemId || '');

        const requestedQuantity =
            Number(item.quantity);


        if (
            !stockItemId ||
            !Number.isFinite(requestedQuantity) ||
            requestedQuantity <= 0
        ) {

            continue;
        }


        /*
         * Find the exact item in the current stock.
         */

        const stockItem =
            stockInventory &&
            stockInventory[stockItemId];


        if (!stockItem) {

            throw new Error(
                `Stock item "${item.itemName || stockItemId}" is no longer available.`
            );
        }


        if (stockItem.active === false) {

            throw new Error(
                `Stock item "${stockItem.name}" is inactive.`
            );
        }


        const currentQuantity =
            Number(stockItem.current || 0);


        if (currentQuantity <= 0) {

            throw new Error(
                `${stockItem.name} is currently out of stock.`
            );
        }


        /*
         * Worker cannot request more
         * than what currently exists.
         */

        if (
            requestedQuantity >
            currentQuantity
        ) {

            throw new Error(
                `${stockItem.name}: requested quantity (${requestedQuantity}) cannot be greater than available stock (${currentQuantity}).`
            );
        }


        validatedItems.push({

            stockItemId:
                String(stockItem.id),

            itemName:
                String(stockItem.name),

            unit:
                String(stockItem.unit || 'piece'),

            quantity:
                requestedQuantity

        });
    }


    if (
        validatedItems.length === 0
    ) {

        throw new Error(
            'Please enter a valid quantity for at least one stock item.'
        );
    }


    /*
     * IMPORTANT:
     *
     * This INSERT does NOT change stock.
     *
     * Stock will only be changed when
     * Admin accepts the request.
     */

    const {
        data,
        error
    } = await supabaseClient
        .from('hawalk_requests')
        .insert({

            worker_id:
                String(worker.id),

            worker_name:
                String(worker.name || 'Unknown Worker'),

            items:
                validatedItems,

            status:
                'Pending'

        })
        .select()
        .single();


    if (error) {

        console.error(
            'TUX POS — Failed to create Hawalk request:',
            error
        );

        throw error;
    }


    if (!Array.isArray(hawalkRequests)) {
        hawalkRequests = [];
    }


    hawalkRequests.unshift(data);


    window.dispatchEvent(
        new CustomEvent(
            'tux-hawalk-updated'
        )
    );


    console.log(
        'TUX POS — Hawalk request created:',
        data
    );


    return data;
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
   ACCEPT REQUEST
   ========================================================= */

async function acceptHawalkRequest(requestId) {

    if (!hawalkCanReviewRequest()) {

        throw new Error(
            'Only Admin or Tux Admin can accept a Hawalk request.'
        );
    }


    const id =
        Number(requestId);


    if (!Number.isFinite(id)) {

        throw new Error(
            'Invalid Hawalk request ID.'
        );
    }


    const reviewer =
        getHawalkReviewerName();


    /*
     * The Supabase RPC performs the actual
     * stock deduction atomically.
     */

    const {
        data,
        error
    } = await supabaseClient.rpc(
        'accept_hawalk_request',
        {
            p_request_id:
                id,

            p_reviewer:
                reviewer
        }
    );


    if (error) {

        console.error(
            'TUX POS — Failed to accept Hawalk request:',
            error
        );

        throw error;
    }


    /*
     * Refresh Hawalk requests.
     */

    await loadHawalkRequestsFromSupabase();


    /*
     * Refresh stock so the new quantity
     * appears immediately.
     */

    if (
        typeof loadStockFromSupabase ===
        'function'
    ) {

        await loadStockFromSupabase();
    }


    window.dispatchEvent(
        new CustomEvent(
            'tux-stock-realtime-updated'
        )
    );


    window.dispatchEvent(
        new CustomEvent(
            'tux-hawalk-updated'
        )
    );


    console.log(
        'TUX POS — Hawalk request accepted:',
        data
    );


    return data;
}


/* =========================================================
   DECLINE REQUEST
   ========================================================= */

async function declineHawalkRequest(requestId) {

    if (!hawalkCanReviewRequest()) {

        throw new Error(
            'Only Admin or Tux Admin can decline a Hawalk request.'
        );
    }


    const id =
        Number(requestId);


    if (!Number.isFinite(id)) {

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
            p_request_id:
                id,

            p_reviewer:
                reviewer
        }
    );


    if (error) {

        console.error(
            'TUX POS — Failed to decline Hawalk request:',
            error
        );

        throw error;
    }


    await loadHawalkRequestsFromSupabase();


    window.dispatchEvent(
        new CustomEvent(
            'tux-hawalk-updated'
        )
    );


    console.log(
        'TUX POS — Hawalk request declined:',
        data
    );


    return data;
}


/* =========================================================
   REALTIME
   ========================================================= */

let hawalkRealtimeChannel = null;


function startHawalkRealtime() {

    try {

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
                .channel(
                    'tux-hawalk-realtime'
                )
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
                .subscribe(
                    function (status) {

                        console.log(
                            'TUX POS — Hawalk realtime status:',
                            status
                        );

                    }
                );

    } catch (error) {

        console.error(
            'TUX POS — Failed to start Hawalk realtime:',
            error
        );
    }
}