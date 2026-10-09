/* =========================================================
   TUX POS — REPORT GARD
   Stock Count / Gard Report
   ========================================================= */


/* =========================================================
   STOCK COUNT (GARD) REPORT
   ========================================================= */

function diffCellHtml(
  counted,
  system
) {

  const d =
    round2(
      counted -
      system
    );

  let color =
    '#2ecc71';

  if (
    d < 0
  ) {

    color =
      '#e74c3c';

  }

  else if (
    d > 0
  ) {

    color =
      '#e67e22';

  }

  const sign =
    d > 0
      ? '+'
      : '';

  return (
    '<td style="color:' +
    color +
    '; font-weight:bold;">' +
    sign +
    fmtQty(d) +
    '</td>'
  );

}


/* =========================================================
   BUILD GARD
   ========================================================= */

function buildGardHtml(
  startCount,
  endCount,
  expenses
) {

  if (
    !startCount &&
    !endCount
  ) {

    return `
      <div style="color:#888; font-size:10px; padding:4px;">
        No manual stock count recorded for this shift.
      </div>
    `;

  }

  const purchased = {};

  (expenses || [])
    .forEach(
      function (e) {

        if (
          e.stockKey &&
          Number(e.qty) > 0
        ) {

          purchased[e.stockKey] =
            (
              purchased[e.stockKey] ||
              0
            ) +
            Number(e.qty);

        }

      }
    );

  const keys = [];

  [
    startCount,
    endCount
  ].forEach(
    function (c) {

      if (
        c &&
        c.items
      ) {

        Object.keys(
          c.items
        ).forEach(
          function (k) {

            if (
              keys.indexOf(k) === -1
            ) {

              keys.push(k);

            }

          }
        );

      }

    }
  );

  const cell =
    'padding:4px; border-bottom:1px solid #666; text-align:left;';

  let html =
    '';

  if (startCount) {

    html +=
      '<div style="font-size:10px; margin-bottom:2px;">' +
      'Count In (start): ' +
      escapeHtmlPw(startCount.date) +
      ' ' +
      escapeHtmlPw(startCount.time) +
      ' | By: ' +
      escapeHtmlPw(startCount.by) +
      '</div>';

  }

  if (endCount) {

    html +=
      '<div style="font-size:10px; margin-bottom:4px;">' +
      'Count Out (end): ' +
      escapeHtmlPw(endCount.date) +
      ' ' +
      escapeHtmlPw(endCount.time) +
      ' | By: ' +
      escapeHtmlPw(endCount.by) +
      '</div>';

  }

  else {

    html +=
      '<div style="font-size:10px; margin-bottom:4px; color:#888;">' +
      'Count Out (end): not done yet' +
      '</div>';

  }

  html +=
    '<table style="width:100%; border-collapse:collapse; font-size:10px;">' +
    '<thead><tr>' +
    '<th style="' +
    cell +
    '">Item</th>' +
    '<th style="' +
    cell +
    '">Unit</th>' +
    '<th style="' +
    cell +
    '">Start Shift (System)</th>' +
    '<th style="' +
    cell +
    '">Bought (+)</th>' +
    '<th style="' +
    cell +
    '">Used (System)</th>' +
    '<th style="' +
    cell +
    '">End Shift (System)</th>' +
    '<th style="' +
    cell +
    '">Count In</th>' +
    '<th style="' +
    cell +
    '">Count Out</th>' +
    '<th style="' +
    cell +
    '">Worker Diff</th>' +
    '</tr></thead><tbody>';

  keys.forEach(
    function (k) {

      const s =
        startCount &&
        startCount.items
          ? startCount.items[k]
          : null;

      const e =
        endCount &&
        endCount.items
          ? endCount.items[k]
          : null;

      const ref =
        s ||
        e;

      const bought =
        round2(
          purchased[k] || 0
        );

      let endSystem =
        null;

      if (e) {

        endSystem =
          e.system;

      }

      else if (
        stockInventory[k]
      ) {

        endSystem =
          round2(
            stockInventory[k].current
          );

      }

      const usedSystem =
        (
          s &&
          endSystem !== null
        )
          ? round2(
              s.system +
              bought -
              endSystem
            )
          : null;

      const workerDiff =
        (
          s &&
          e
        )
          ? round2(
              s.counted +
              bought -
              e.counted
            )
          : null;

      let diffColor =
        'inherit';

      if (
        workerDiff !== null &&
        usedSystem !== null
      ) {

        const gap =
          round2(
            workerDiff -
            usedSystem
          );

        diffColor =
          gap === 0
            ? '#2ecc71'
            : (
                gap > 0
                  ? '#e74c3c'
                  : '#e67e22'
              );

      }

      html +=
        '<tr>' +

        '<td style="' +
        cell +
        '">' +
        '<strong>' +
        escapeHtmlPw(ref.name) +
        '</strong>' +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        escapeHtmlPw(ref.unit) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          s
            ? fmtQty(s.system)
            : '-'
        ) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          bought > 0
            ? '+' +
              fmtQty(bought)
            : '-'
        ) +
        '</td>' +

        '<td style="' +
        cell +
        ' font-weight:bold;">' +
        (
          usedSystem === null
            ? '-'
            : fmtQty(usedSystem)
        ) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          endSystem === null
            ? '-'
            : fmtQty(endSystem)
        ) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          s
            ? fmtQty(s.counted)
            : '-'
        ) +
        '</td>' +

        '<td style="' +
        cell +
        '">' +
        (
          e
            ? fmtQty(e.counted)
            : '-'
        ) +
        '</td>' +

        '<td style="' +
        cell +
        ' font-weight:bold; color:' +
        diffColor +
        ';">' +
        (
          workerDiff === null
            ? '-'
            : fmtQty(workerDiff)
        ) +
        '</td>' +

        '</tr>';

    }
  );

  html +=
    '</tbody></table>' +

    '<div style="font-size:9px; color:#888; margin-top:3px;">' +

    'Used (System) = Start + Bought − End. ' +
    'Worker Diff = Count In + Bought − Count Out ' +
    '(what the workers\' counts say was used). ' +
    'Green = matches Used (System), red = workers\' counts show MORE used than the system (shortage), orange = less.' +

    (
      endCount
        ? ''
        : ' Shift still open: End Shift (System) is the current stock and Worker Diff appears after the closing count.'
    ) +

    '</div>';

  return html;

}


/* =========================================================
   RENDER GARD
   ========================================================= */

function renderGardReport() {

  const el =
    document.getElementById(
      'gardReportContainer'
    );

  if (!el) {
    return;
  }

  if (
    !currentShift ||
    !currentShift.active
  ) {

    el.innerHTML =
      '<div style="color:#666; font-size:10px; padding:4px;">No active shift.</div>';

    return;

  }

  let gardExpenses =
    [];

  if (
    typeof getReportExpensesForCurrentShift ===
    'function'
  ) {

    gardExpenses =
      getReportExpensesForCurrentShift();

  }

  if (
    gardExpenses.length === 0
  ) {

    gardExpenses =
      expensesList;

  }

  el.innerHTML =
    buildGardHtml(
      currentShift.startCount,
      currentShift.endCount,
      gardExpenses
    );

}