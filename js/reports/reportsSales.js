
/* =========================================================
   TUX POS — REPORT SALES
   Sales Report
   ========================================================= */


/* =========================================================
   SALES REPORT
   ========================================================= */




/* =========================================================
   SALES REPORT — REPORTS PAGE
   TUX POS
   - Preserves current financial calculations
   - Preserves Admin Reports
   - Preserves Gard and Gam3ya reports
   - Displays orders from the active shift only
   ========================================================= */


function renderSalesReport() {

    /* =====================================================
       INITIALIZE REPORT COMPONENTS
       ===================================================== */

    ensureAdminReportFinance();

    startAdminReportFinanceRealtime();

    renderAdminReports();

    renderGardReport();


    /* =====================================================
       CURRENT SHIFT FINANCIAL TOTALS
       ===================================================== */

    let totalCash = 0;
    let totalInsta = 0;
    let totalVisa = 0;
    let totalDisc = 0;
    let totalSales = 0;


    const currentShiftSales =
        typeof getReportSalesForCurrentShift === 'function'
            ? getReportSalesForCurrentShift().filter(
                order =>
                    String(order.status || '').toLowerCase() === 'done'
            )
            : [];


    const totalOrders =
        currentShiftSales.length;


    currentShiftSales.forEach(function (order) {

        totalCash +=
            Number(order.cashPaid || 0);

        totalInsta +=
            Number(order.instaPaid || 0);

        totalVisa +=
            Number(order.visaPaid || 0);

        totalDisc +=
            Number(order.discount || 0);


        /*
         * Net Sales = Cash + InstaPay only.
         */

        totalSales +=
            Number(order.cashPaid || 0) +
            Number(order.instaPaid || 0);

    });


    /* =====================================================
       CURRENT SHIFT EXPENSES
       ===================================================== */

    let totalExpenses = 0;

    if (Array.isArray(expensesList)) {

        expensesList.forEach(function (expense) {

            totalExpenses +=
                Number(expense.cost || 0);

        });

    }


    /* =====================================================
       MONTHLY FINANCE
       ===================================================== */

    ensureMonthlyFinance();


    const netProfit =
        Number(monthlyFinance.bank || 0) -
        Number(monthlyFinance.overallExpenses || 0);


    /* =====================================================
       DAILY HURRY APP
       Visa + Discount
       ===================================================== */

    const dailyHurryEl =
        document.getElementById('repDailyHurry');

    if (dailyHurryEl) {

        dailyHurryEl.innerText =
            (
                totalVisa +
                totalDisc
            ).toFixed(2) + ' LE';

    }


    /* =====================================================
       MONTHLY HURRY APP
       ===================================================== */

    const hurryEl =
        document.getElementById('repHurry');

    if (hurryEl) {

        hurryEl.innerText =
            Number(
                monthlyFinance.hurryApp || 0
            ).toFixed(2) + ' LE';

    }


    /* =====================================================
       GAM3YA REPORT
       ===================================================== */

    renderGamiyaReport();


    /* =====================================================
       UPDATE REPORT FIELDS SAFELY
       ===================================================== */

    function setReportValue(elementId, value) {

        const element =
            document.getElementById(elementId);

        if (element) {

            element.innerText = value;

        }

    }


    /* =====================================================
       DELIVERY & CANCELLED ORDERS
       ===================================================== */

    const allReportOrders =
        Array.isArray(reportSales)
            ? reportSales
            : [];


    /*
     * Delivery Today:
     * Completed orders belonging to the current shift.
     */

    const dailyDelivery =
        currentShiftSales.reduce(function (total, order) {

            const deliveryFee =
                Number(
                    order.deliveryFee ??
                    order.delivery_fee ??
                    0
                ) || 0;

            return total + Math.max(0, deliveryFee);

        }, 0);


    /*
     * Overall Delivery:
     * Completed orders across all shifts.
     */

    const overallDelivery =
        allReportOrders
            .filter(function (order) {

                const status =
                    String(order.status || '').toLowerCase();

                return (
                    status === 'done' ||
                    status === 'completed'
                );

            })
            .reduce(function (total, order) {

                const deliveryFee =
                    Number(
                        order.deliveryFee ??
                        order.delivery_fee ??
                        0
                    ) || 0;

                return total + Math.max(0, deliveryFee);

            }, 0);


    /*
     * Cancelled Orders:
     * Cancelled orders belonging to the current shift.
     */

    const activeShiftId =
        currentShift &&
        currentShift.active === true &&
        currentShift.supabaseId
            ? String(currentShift.supabaseId)
            : null;


    const cancelledOrders =
        allReportOrders.filter(function (order) {

            const status =
                String(order.status || '').toLowerCase();

            const orderShiftId =
                order.shiftId ??
                order.shift_id ??
                null;

            return (
                status === 'cancelled' &&
                activeShiftId !== null &&
                orderShiftId !== null &&
                String(orderShiftId) === activeShiftId
            );

        }).length;


    /* =====================================================
       UPDATE DELIVERY & CANCELLED HTML
       ===================================================== */

    setReportValue(
        'repDailyDelivery',
        dailyDelivery.toFixed(2) + ' LE'
    );


    setReportValue(
        'repOverallDelivery',
        overallDelivery.toFixed(2) + ' LE'
    );


    setReportValue(
        'repCancelledOrders',
        cancelledOrders
    );


    /* =====================================================
       UPDATE NORMAL REPORT FIELDS
       ===================================================== */

    setReportValue(
        'repTotalCash',
        totalCash.toFixed(2) + ' LE'
    );


    setReportValue(
        'repTotalInsta',
        totalInsta.toFixed(2) + ' LE'
    );


    setReportValue(
        'repTotalVisa',
        totalVisa.toFixed(2) + ' LE'
    );


    setReportValue(
        'repTotalDisc',
        totalDisc.toFixed(2) + ' LE'
    );


    setReportValue(
        'repTotalSales',
        totalSales.toFixed(2) + ' LE'
    );


    setReportValue(
        'repBank',
        Number(
            monthlyFinance.bank || 0
        ).toFixed(2) + ' LE'
    );


    setReportValue(
        'repDailyExpenses',
        totalExpenses.toFixed(2) + ' LE'
    );


    setReportValue(
        'repTotalExpenses',
        Number(
            monthlyFinance.overallExpenses || 0
        ).toFixed(2) + ' LE'
    );


    setReportValue(
        'repOverallOrders',
        Number(
            monthlyFinance.overallOrders || 0
        )
    );


    setReportValue(
        'repNetProfit',
        netProfit.toFixed(2) + ' LE'
    );


    const netProfitElement =
        document.getElementById('repNetProfit');

    if (netProfitElement) {

        netProfitElement.style.color =
            netProfit >= 0
                ? '#2ecc71'
                : '#e74c3c';

    }


    setReportValue(
        'repTotalOrders',
        totalOrders
    );


    /* =====================================================
       ORDER DETAILS CONTAINER
       ===================================================== */

    const listContainer =
        document.getElementById('salesListContainer');


    if (!listContainer) {

        return;

    }


    /* =====================================================
       CHECK THE ACTIVE SHIFT
       ===================================================== */

    /*
     * If there is no active shift, don't show old orders
     * under "Order details for current session".
     *
     * Historical orders remain available through
     * the saved Shift History reports.
     */

    if (!activeShiftId) {

        listContainer.innerHTML = `
            <div style="
                color:#666;
                text-align:center;
                margin-top:20px;
                padding:12px;
            ">
                No active shift.<br>
                Start a shift to view its orders.
            </div>
        `;

        return;

    }


    /* =====================================================
       FILTER SUPABASE ORDERS BY ACTIVE SHIFT
       ===================================================== */

    const historicalSales =
        Array.isArray(reportSales)
            ? reportSales
            : [];


    const matchingReportSales =
        historicalSales.filter(function (order) {

            const orderShiftId =
                order.shiftId ??
                order.shift_id ??
                null;

            return (
                orderShiftId !== null &&
                String(orderShiftId) === activeShiftId
            );

        });


    /* =====================================================
       FALLBACK TO LOCAL ORDERS
       ONLY IF THEY HAVE THE ACTIVE SHIFT ID
       ===================================================== */

    const localSales =
        Array.isArray(completedSales)
            ? completedSales
            : [];


    const matchingLocalSales =
        localSales.filter(function (order) {

            const orderShiftId =
                order.shiftId ??
                order.shift_id ??
                null;

            return (
                orderShiftId !== null &&
                String(orderShiftId) === activeShiftId
            );

        });


    /*
     * Prefer Supabase report data because it includes
     * historical order details and item information.
     *
     * Use local orders only if no matching Supabase
     * orders are available for this active shift.
     */

    const sessionSales =
        matchingReportSales.length > 0
            ? matchingReportSales
            : matchingLocalSales;


    /* =====================================================
       NO ORDERS FOR THIS SHIFT
       ===================================================== */

    if (sessionSales.length === 0) {

        listContainer.innerHTML = `
            <div style="
                color:#666;
                text-align:center;
                margin-top:20px;
                padding:12px;
            ">
                No orders recorded for this shift.
            </div>
        `;

        return;

    }


    /* =====================================================
       SORT ORDERS BY CREATION TIME
       NEWEST FIRST
       ===================================================== */

    const sortedSales =
        [...sessionSales].sort(function (a, b) {

            const dateA =
                a.createdAt
                    ? new Date(a.createdAt).getTime()
                    : 0;

            const dateB =
                b.createdAt
                    ? new Date(b.createdAt).getTime()
                    : 0;

            return dateB - dateA;

        });


    /* =====================================================
       BUILD ORDER DETAILS
       ===================================================== */

    let html = '';


    sortedSales.forEach(function (order) {

        const items =
            Array.isArray(order.items)
                ? order.items
                : [];


        const itemsNames =
            items.map(function (item) {

                const itemName =
                    String(item.name || 'Item');


                const quantity =
                    Number(
                        item.qty ??
                        item.quantity ??
                        0
                    );


                return (
                    itemName +
                    ' (x' +
                    quantity +
                    ')'
                );

            }).join(', ');


        const status =
            String(
                order.status || 'preparing'
            ).toLowerCase();


        const statusColor =
            status === 'cancelled'
                ? '#e74c3c'
                : (
                    status === 'done' ||
                    status === 'completed'
                        ? '#2ecc71'
                        : '#f1c40f'
                );


        const statusLabel =
            status === 'cancelled'
                ? 'Cancelled'
                : (
                    status === 'done' ||
                    status === 'completed'
                        ? 'Completed'
                        : 'Preparing'
                );


        const orderNumber =
            order.orderNum ??
            order.orderNumber ??
            '-';


        const orderTime =
            order.time ||
            (
                order.createdAt
                    ? new Date(
                        order.createdAt
                    ).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : '-'
            );


        const staffName =
            String(
                order.staffName || '-'
            );


        const orderTotal =
            Number(
                order.total || 0
            );


        const orderNote =
            String(
                order.note || ''
            ).trim();


        html += `
            <div style="
                background:#1c1c2b;
                padding:8px 10px;
                border-radius:5px;
                display:flex;
                justify-content:space-between;
                align-items:flex-start;
                gap:12px;
                font-size:11px;
                margin-bottom:5px;
            ">

                <div style="
                    flex:1;
                    min-width:0;
                ">

                    <strong>
                        Order #${orderNumber}
                    </strong>

                    <span style="
                        color:#888;
                    ">
                        (${orderTime})
                    </span>

                    <br>

                    <span style="
                        color:#aaa;
                        font-size:10px;
                        overflow-wrap:anywhere;
                    ">
                        ${itemsNames || 'No items'}
                    </span>

                    <br>

                    <span style="
                        color:#888;
                        font-size:9px;
                    ">
                        Staff: ${staffName}
                    </span>

                    ${
                        orderNote
                            ? `
                                <br>
                                <span style="
                                    color:#f1c40f;
                                    font-size:10px;
                                    overflow-wrap:anywhere;
                                ">
                                    Note: ${orderNote}
                                </span>
                            `
                            : ''
                    }

                </div>


                <div style="
                    text-align:right;
                    flex-shrink:0;
                ">

                    <span style="
                        color:#f1c40f;
                        font-weight:bold;
                        white-space:nowrap;
                    ">
                        ${orderTotal.toFixed(2)} LE
                    </span>

                    <br>

                    <span style="
                        font-size:9.5px;
                        color:${statusColor};
                    ">
                        ${statusLabel}
                    </span>

                </div>

            </div>
        `;

    });


    /* =====================================================
       DISPLAY ACTIVE SHIFT ORDERS
       ===================================================== */

    listContainer.innerHTML = html;

}









