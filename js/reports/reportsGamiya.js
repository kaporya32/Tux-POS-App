/* =========================================================
   TUX POS — REPORT GAMIYA
   Gam3ya / Staff Meals
   ========================================================= */


/* =========================================================
   GAM3YA
   ========================================================= */

function buildGamiyaSummary(
  records,
  shiftId
) {

  const map = {};

  (records || [])
    .forEach(
      function (rec) {

        const key =
          String(
            rec.workerId
          );

        if (!map[key]) {

          map[key] = {

            workerName:
              rec.workerName,

            items: {},

            orders: 0,

            total: 0,

            shiftTotal: 0

          };

        }

        const w =
          map[key];

        w.orders +=
          1;

        w.total +=
          Number(
            rec.total || 0
          );

        if (
          shiftId &&
          rec.shiftId ===
            shiftId
        ) {

          w.shiftTotal +=
            Number(
              rec.total || 0
            );

        }

        (
          rec.items || []
        ).forEach(
          function (i) {

            w.items[i.name] =
              (
                w.items[i.name] ||
                0
              ) +
              Number(
                i.qty || 0
              );

          }
        );

      }
    );

  return Object.keys(
    map
  ).map(
    function (k) {

      return map[k];

    }
  );

}


/* =========================================================
   GAM3YA HTML
   ========================================================= */

function buildGamiyaHtml(
  summary
) {

  if (
    !summary ||
    summary.length === 0
  ) {

    return `
      <div style="color:#888; font-size:10px; padding:4px;">
        No Gam3ya meals recorded.
      </div>
    `;

  }

  const cell =
    'padding:4px; border-bottom:1px solid #666; text-align:left; vertical-align:top;';

  let grandTotal =
    0;

  let grandShift =
    0;

  let html =
    '<table style="width:100%; border-collapse:collapse; font-size:10px;">' +
    '<thead><tr>' +
    '<th style="' +
    cell +
    '">Worker</th>' +
    '<th style="' +
    cell +
    '">Orders Taken</th>' +
    '<th style="' +
    cell +
    '">This Shift (LE)</th>' +
    '<th style="' +
    cell +
    '">Total (LE)</th>' +
    '</tr></thead><tbody>';

  summary.forEach(
    function (w) {

      grandTotal +=
        Number(
          w.total || 0
        );

      grandShift +=
        Number(
          w.shiftTotal || 0
        );

      const itemsText =
        Object.keys(
          w.items || {}
        )
        .map(
          function (name) {

            return (
              escapeHtmlPw(name) +
              ' x' +
              fmtQty(
                w.items[name]
              )
            );

          }
        )
        .join(', ');

      html +=
        '<tr>' +

        '<td style="' +
        cell +
        '">' +

        '<strong>' +
        escapeHtmlPw(
          w.workerName
        ) +
        '</strong>' +

        '<br>' +

        '<span style="color:#888;">' +
        Number(
          w.orders || 0
        ) +
        ' order(s)' +
        '</span>' +

        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          itemsText ||
          '-'
        ) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        Number(
          w.shiftTotal || 0
        ).toFixed(2) +
        '</td>' +

        '<td style="' +
        cell +
        ' font-weight:bold;">' +
        Number(
          w.total || 0
        ).toFixed(2) +
        '</td>' +

        '</tr>';

    }
  );

  html +=
    '<tr>' +

    '<td style="' +
    cell +
    '" colspan="2">' +

    '<strong>All Gam3ya</strong>' +

    '</td>' +

    '<td style="' +
    cell +
    '">' +

    '<strong>' +
    grandShift.toFixed(2) +
    '</strong>' +

    '</td>' +

    '<td style="' +
    cell +
    '">' +

    '<strong>' +
    grandTotal.toFixed(2) +
    '</strong>' +

    '</td>' +

    '</tr></tbody></table>';

  return html;

}


/* =========================================================
   RENDER GAM3YA
   ========================================================= */

function renderGamiyaReport() {

  const el =
    document.getElementById(
      'gamiyaReportContainer'
    );

  if (!el) {
    return;
  }

  el.innerHTML =
    buildGamiyaHtml(
      buildGamiyaSummary(
        gamiyaOrders,
        currentShift
          ? currentShift.id
          : null
      )
    );

}


/* =========================================================
   RESET GAM3YA
   ========================================================= */

function resetGamiya() {

  if (
    getActiveRole() !==
    'tuxadmin'
  ) {

    alert(
      'Only Tux Admin can reset Gam3ya.'
    );

    return;

  }

  if (
    !confirm(
      'Delete ALL Gam3ya (staff meals) records?\n\nThe stock that was already deducted will NOT be returned.'
    )
  ) {

    return;

  }

  gamiyaOrders = [];

  saveCurrentShiftData();

  renderGamiyaView();

  renderGamiyaReport();

  alert(
    'Gam3ya was reset.'
  );

}