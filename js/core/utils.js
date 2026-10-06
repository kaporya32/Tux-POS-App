/* =========================================================
   TUX POS — SHARED HELPERS (no dependency on app state)
   ========================================================= */

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function fmtQty(v) {
  return Number(v || 0).toFixed(2).replace(/\.?0+$/, '');
}

function escapeHtmlPw(text) {
  return String(text).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function calculateWorkedHours(checkIn, checkOut) {

  if (!checkIn || !checkOut) return 0;

  const parseTime = function (timeString) {

    const parts = timeString.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!parts) return null;

    let hour = parseInt(parts[1], 10);
    const minute = parseInt(parts[2], 10);
    let ampm = parts[3];

    if (ampm) {
      ampm = ampm.toUpperCase();
      if (ampm === 'PM' && hour !== 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
    }

    return hour * 60 + minute;
  };

  const start = parseTime(checkIn);
  const end = parseTime(checkOut);

  if (start === null || end === null) return 0;

  let diffMinutes = end - start;
  if (diffMinutes < 0) diffMinutes += 24 * 60;

  return diffMinutes / 60;
}

function formatHours(hours) {
  if (!hours || hours <= 0) return '0h 0m';
  const totalMinutes = Math.round(hours * 60);
  return Math.floor(totalMinutes / 60) + 'h ' + (totalMinutes % 60) + 'm';
}

function updateLiveClock() {

  const clock = document.getElementById('liveClock');
  if (!clock) return;

  const now = new Date();

  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  clock.innerText = date + ' | ' + time;
}
