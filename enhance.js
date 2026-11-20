/* Atlas — experience upgrades
   Layered on top of app.js through a narrow window.Atlas surface.
   Trading math in app.js is untouched; everything here is additive. */

const A = window.Atlas;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const money = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 });

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

function holding(symbol) {
  return A.orders.reduce((sum, o) => o.symbol === symbol ? sum + (o.side === 'buy' ? o.qty : -o.qty) : sum, 0);
}
function netCash(orders, symbol) {
  return orders.reduce((sum, o) => o.symbol === symbol ? sum + (o.side === 'buy' ? 1 : -1) * o.qty * o.price : sum, 0);
}
function setText(selector, value) {
  const el = $(selector);
  if (el) el.textContent = value;
}

/* ------------------------------------------------------------------ *
 * 1. Trade analytics — FIFO lot matching, realized P&L and ratios.
 * ------------------------------------------------------------------ */
function tradeStats() {
  const lots = [];
  let realized = 0, wins = 0, grossWin = 0, grossLoss = 0, trades = 0;
  const ordered = [...A.orders].sort((a, b) => new Date(a.time) - new Date(b.time));
  for (const o of ordered) {
    if (o.side === 'buy') { lots.push({ qty: o.qty, price: o.price }); continue; }
    let need = o.qty;
    while (need > 1e-9 && lots.length) {
      const lot = lots[0];
      const qty = Math.min(need, lot.qty);
      const pnl = (o.price - lot.price) * qty;
      realized += pnl;
      trades++;
      if (pnl >= 0) { wins++; grossWin += pnl; } else { grossLoss -= pnl; }
      lot.qty -= qty;
      need -= qty;
      if (lot.qty <= 1e-9) lots.shift();
    }
  }
  return {
    realized, trades, wins,
    winRate: trades ? (wins / trades) * 100 : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : (grossWin ? Infinity : 0),
  };
}

const equityHistory = [];
function drawEquity() {
  const line = $('#equity-line');
  const area = $('#equity-area');
  if (!line || !area || equityHistory.length < 2) return;
  const min = Math.min(...equityHistory);
  const max = Math.max(...equityHistory);
  const range = Math.max(max - min, 1);
  const points = equityHistory.map((v, i) =>
    `${(i / (equityHistory.length - 1) * 240).toFixed(1)},${(48 - ((v - min) / range) * 40).toFixed(1)}`
  );
  line.setAttribute('points', points.join(' '));
  area.setAttribute('d', `M${points.join(' L')} L240,52 L0,52 Z`);
}

function updatePerformance() {
  const s = tradeStats();
  setText('[data-p="realized"]', (s.realized < 0 ? '−' : '+') + money(Math.abs(s.realized)));
  setText('[data-p="winrate"]', s.trades ? s.winRate.toFixed(0) + '%' : '—');
  setText('[data-p="pf"]', Number.isFinite(s.profitFactor) && s.trades ? s.profitFactor.toFixed(2) : '—');
  setText('[data-p="trades"]', String(s.trades));
  $('[data-p="realized"]')?.classList.toggle('negative', s.realized < -1e-9);
  drawEquity();
}

/* ------------------------------------------------------------------ *
 * 2. Portfolio metrics strip.
 * ------------------------------------------------------------------ */
function updateMetrics() {
  if (!A) return;
  const prices = Object.fromEntries(A.markets.map((m) => [m[0], m[4]]));
  const quantities = {};
  for (const o of A.orders) quantities[o.symbol] = (quantities[o.symbol] || 0) + (o.side === 'buy' ? o.qty : -o.qty);

  let holdings = 0, cost = 0, positions = 0;
  for (const [symbol, qty] of Object.entries(quantities)) {
    const price = prices[symbol];
    if (qty <= 1e-9 || !price) continue;
    positions++;
    holdings += qty * price;
    cost += netCash(A.orders, symbol);
  }

  const equity = A.balance + holdings;
  const unrealized = holdings - cost;
  const exposure = equity > 0 ? (holdings / equity) * 100 : 0;

  setText('[data-m="equity"]', money(equity));
  setText('[data-m="unrealized"]', (unrealized < 0 ? '−' : '+') + money(Math.abs(unrealized)));
  setText('[data-m="exposure"]', exposure.toFixed(1) + '%');
  setText('[data-m="positions"]', String(positions));
  $('[data-m="unrealized"]')?.classList.toggle('negative', unrealized < -1e-9);

  equityHistory.push(equity);
  if (equityHistory.length > 90) equityHistory.shift();
  updatePerformance();
}

function syncIndicatorCount() {
  const count = ($('#sma')?.checked ? 1 : 0) + ($('#volume-toggle')?.checked ? 1 : 0);
  setText('#indicators .count', String(count));
}
$('#sma')?.addEventListener('change', syncIndicatorCount);
$('#volume-toggle')?.addEventListener('change', syncIndicatorCount);
syncIndicatorCount();

/* ------------------------------------------------------------------ *
 * 3. Pending limit / stop orders.
 * ------------------------------------------------------------------ */
const PENDING_KEY = 'atlas-pending';
let pending = read(PENDING_KEY, []);

function savePending() {
  write(PENDING_KEY, pending);
  renderPending();
}
function renderPending() {
  const el = $('#pending');
  if (!el) return;
  if (!pending.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = '<span class="pending-label">PENDING ORDERS</span>' + pending.map((o) =>
    `<div class="pending-row"><span><em>${o.side.toUpperCase()}</em> ${o.type.toUpperCase()} ${o.symbol} · ${o.qty} @ ${num(o.trigger)}</span><button data-cancel-pending="${o.id}" aria-label="Cancel order">×</button></div>`
  ).join('');
}

function orderError(message) { setText('#order-error', message); }

function placePending(type) {
  const qty = Number($('#quantity').value);
  const trigger = Number($('#trigger-price').value);
  const side = $('#order-title').textContent.trim().toLowerCase().startsWith('buy') ? 'buy' : 'sell';
  if (!Number.isFinite(qty) || qty <= 0) return orderError('Enter a positive quantity.');
  if (!Number.isFinite(trigger) || trigger <= 0) return orderError('Enter a valid trigger price.');
  if (side === 'sell' && qty > holding(A.market[0]) + 1e-9) return orderError('Sell quantity exceeds your position.');
  if (side === 'buy' && qty * trigger > A.balance + 1e-9) return orderError('Insufficient practice cash for this order.');

  pending.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    symbol: A.market[0], side, qty, type, trigger,
    sl: Number($('#stop-loss').value) || null,
    tp: Number($('#take-profit').value) || null,
    time: new Date().toISOString(),
  });
  savePending();
  $('#order-dialog').close();
  A.toast(`${type} order queued for ${A.market[0]}.`);
}

function checkPending() {
  if (!pending.length) return;
  const price = A.market[4];
  const symbol = A.market[0];
  let changed = false;
  const remaining = [];
  for (const o of pending) {
    const hit = o.symbol === symbol && (
      (o.type === 'limit' && ((o.side === 'buy' && price <= o.trigger) || (o.side === 'sell' && price >= o.trigger))) ||
      (o.type === 'stop' && ((o.side === 'buy' && price >= o.trigger) || (o.side === 'sell' && price <= o.trigger)))
    );
    if (!hit) { remaining.push(o); continue; }
    const fill = o.type === 'limit' ? o.trigger : price;
    const cash = o.qty * fill;
    if (o.side === 'buy' && cash > A.balance + 1e-9) { remaining.push(o); continue; }
    if (o.side === 'sell' && o.qty > holding(o.symbol) + 1e-9) { remaining.push(o); continue; }
    A.balance += o.side === 'buy' ? -cash : cash;
    A.orders.unshift({ symbol: o.symbol, qty: o.qty, price: fill, side: o.side, time: new Date().toISOString() });
    if (o.sl || o.tp) {
      brackets.push({ id: Date.now(), symbol: o.symbol, side: o.side, qty: o.qty, sl: o.sl, tp: o.tp });
      saveBrackets();
    }
    A.store();
    A.renderOrders();
    A.toast(`${o.type} order filled · ${o.symbol}`);
    changed = true;
  }
  if (changed) { pending = remaining; savePending(); }
}

/* Capture phase runs before app.js's market-order handler on the button. */
document.addEventListener('click', (e) => {
  if (!e.target.closest?.('#place-order')) return;
  const type = $('#order-type')?.value || 'market';
  if (type === 'market') return;
  e.stopPropagation();
  e.preventDefault();
  placePending(type);
}, true);

$('#order-type')?.addEventListener('change', (e) => {
  const type = e.target.value;
  $('#trigger-wrap').hidden = type === 'market';
  if (type !== 'market' && !$('#trigger-price').value) $('#trigger-price').value = String(A.market[4]);
  setText('#order-dialog .dialog-note', type === 'market'
    ? 'Paper order · Simulated execution'
    : `Paper ${type} order · Fills when price reaches your trigger`);
});

['#buy', '#sell'].forEach((selector) => $(selector)?.addEventListener('click', () => {
  const select = $('#order-type');
  if (select) { select.value = 'market'; select.dispatchEvent(new Event('change')); }
}));

$('#pending')?.addEventListener('click', (e) => {
  const id = e.target.closest('[data-cancel-pending]')?.dataset.cancelPending;
  if (!id) return;
  pending = pending.filter((o) => o.id !== id);
  savePending();
  A.toast('Pending order cancelled.');
});
renderPending();

/* ------------------------------------------------------------------ *
 * 4. Price alerts on watchlist rows.
 * ------------------------------------------------------------------ */
const ALERT_KEY = 'atlas-alerts';
let alerts = read(ALERT_KEY, []);

function renderAlerts() {
  const list = $('#alert-list');
  if (!list) return;
  list.innerHTML = alerts.length
    ? '<div class="alert-list">' + alerts.map((a) =>
      `<div class="alert-item"><span>${a.symbol} ${a.direction === 'above' ? '≥' : '≤'} ${num(a.price)}</span><button data-del-alert="${a.id}" aria-label="Remove alert">×</button></div>`
    ).join('') + '</div>'
    : '<p class="muted dialog-note">No active alerts.</p>';
}

function openAlert(symbol) {
  setText('#alert-symbol', `${symbol} · ${money(A.market[4])}`);
  $('#alert-price').value = String(A.market[4]);
  $('#alert-direction').value = 'above';
  renderAlerts();
  $('#alert-dialog').showModal();
}

function injectBells() {
  $$('.watch-row').forEach((row) => {
    if (row.querySelector('.alert-bell')) return;
    const bell = document.createElement('span');
    bell.className = 'alert-bell';
    bell.title = 'Set price alert';
    bell.setAttribute('role', 'button');
    bell.setAttribute('tabindex', '0');
    bell.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
    bell.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); openAlert(row.dataset.symbol); });
    bell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAlert(row.dataset.symbol); }
    });
    row.firstElementChild?.appendChild(bell);
  });
}

$('#save-alert')?.addEventListener('click', () => {
  const price = Number($('#alert-price').value);
  if (!Number.isFinite(price) || price <= 0) { A.toast('Enter a valid alert price.'); return; }
  const symbol = ($('#alert-symbol').textContent || '').split(' · ')[0];
  alerts.push({ id: Date.now(), symbol, direction: $('#alert-direction').value, price });
  write(ALERT_KEY, alerts);
  renderAlerts();
  A.toast(`Alert set for ${symbol}.`);
});

$('#alert-list')?.addEventListener('click', (e) => {
  const id = e.target.closest('[data-del-alert]')?.dataset.delAlert;
  if (!id) return;
  alerts = alerts.filter((a) => String(a.id) !== String(id));
  write(ALERT_KEY, alerts);
  renderAlerts();
});

function checkAlerts() {
  if (!alerts.length) return;
  const price = A.market[4];
  const symbol = A.market[0];
  const hit = alerts.filter((a) => a.symbol === symbol &&
    ((a.direction === 'above' && price >= a.price) || (a.direction === 'below' && price <= a.price)));
  if (!hit.length) return;
  alerts = alerts.filter((a) => !hit.includes(a));
  write(ALERT_KEY, alerts);
  renderAlerts();
  A.toast(`Alert hit · ${symbol} ${hit.map((a) => `${a.direction} ${num(a.price)}`).join(', ')}`);
}

/* ------------------------------------------------------------------ *
 * 5. Live quotes — the market moves while you watch it.
 * ------------------------------------------------------------------ */
const TICK_MS = 2400;

function flash(el, direction) {
  if (!el) return;
  el.classList.remove('flash-up', 'flash-down');
  void el.offsetWidth;
  el.classList.add(direction > 0 ? 'flash-up' : 'flash-down');
}

function tick() {
  if (!A) return;
  const market = A.market;
  const before = market[4];
  const digits = market[0] === 'EURUSD' ? 5 : 2;
  const next = Number((before + before * (Math.random() - 0.5) * 0.0009).toFixed(digits));
  if (next !== before) {
    market[4] = next;
    const bars = A.bars;
    const last = bars && bars[bars.length - 1];
    if (last) {
      last.c = next;
      last.h = Math.max(last.h, next);
      last.l = Math.min(last.l, next);
    }
    A.render();
    const direction = next - before;
    flash($('#detail-price'), direction);
    flash($$('.watch-row').find((row) => row.dataset.symbol === market[0]), direction);
  }
  checkPending();
  checkAlerts();
}

if (A) {
  renderPending();
  updateMetrics();
  setInterval(tick, TICK_MS);
  setInterval(updateMetrics, 1000);
}

/* ------------------------------------------------------------------ *
 * 6. Command palette, shortcuts and data export.
 * ------------------------------------------------------------------ */
function openPalette() { $('#symbol')?.click(); }

function exportCsv() {
  if (!A) return;
  const tf = document.querySelector('[data-tf].active')?.dataset.tf || 'tf';
  const rows = [['timestamp', 'open', 'high', 'low', 'close', 'volume'],
    ...A.bars.map((b) => [new Date(b.t).toISOString(), b.o, b.h, b.l, b.c, b.v])];
  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `atlas-${A.market[0]}-${tf}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  A.toast('OHLCV data exported.');
}

$('#shortcuts')?.addEventListener('click', () => $('#shortcuts-dialog')?.showModal());
$('#csv')?.addEventListener('click', exportCsv);
$('#undo')?.addEventListener('click', () => A.undo?.());
$('#redo')?.addEventListener('click', () => A.redo?.());

const TIMEFRAMES = ['15m', '1h', '4h', '1D', '1W'];
const TOOLS = { c: 'cross', t: 'line', h: 'horizontal' };

document.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  const rect = active?.getBoundingClientRect?.();
  const typing = active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)
    && rect && rect.width > 0 && rect.height > 0 && active.offsetParent !== null;
  const key = e.key.toLowerCase();

  if ((e.metaKey || e.ctrlKey) && key === 'k') { e.preventDefault(); openPalette(); return; }
  if (typing) return;

  if ((e.metaKey || e.ctrlKey) && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) A.redo?.(); else A.undo?.();
    return;
  }
  if (e.key === '/') { e.preventDefault(); openPalette(); return; }
  if (e.key === '?') { e.preventDefault(); $('#shortcuts-dialog')?.showModal(); return; }
  if (/^[1-5]$/.test(e.key)) {
    $(`[data-tf="${TIMEFRAMES[Number(e.key) - 1]}"]`)?.click();
    return;
  }

  const action = {
    b: () => $('#buy')?.click(),
    s: () => $('#sell')?.click(),
    e: exportCsv,
    l: () => $('#log')?.click(),
    a: () => $('#auto')?.click(),
    '0': () => $('#reset')?.click(),
  }[key] || (TOOLS[key] ? () => $(`[data-tool="${TOOLS[key]}"]`)?.click() : null);

  if (action) { e.preventDefault(); action(); }
});

/* ------------------------------------------------------------------ *
 * 7. Touch gestures — pinch zoom, double-tap reset.
 * ------------------------------------------------------------------ */
const canvas = $('#chart');
if (canvas && A) {
  const pointers = new Map();
  let pinch = null;
  const originalDown = canvas.onpointerdown;
  const originalMove = canvas.onpointermove;
  const originalUp = canvas.onpointerup;

  canvas.onpointerdown = (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [p, q] = [...pointers.values()];
      pinch = { distance: Math.hypot(p.x - q.x, p.y - q.y), count: A.count, offset: A.offset };
    }
    if (pointers.size < 2 && originalDown) originalDown(e);
  };

  canvas.onpointermove = (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [p, q] = [...pointers.values()];
      const distance = Math.hypot(p.x - q.x, p.y - q.y);
      A.count = Math.max(30, Math.min(400, Math.round(pinch.count * pinch.distance / Math.max(1, distance))));
      A.offset = pinch.offset;
      A.draw();
      return;
    }
    if (originalMove) originalMove(e);
  };

  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (originalUp) originalUp(e);
  };
  canvas.onpointerup = endPointer;
  canvas.onpointercancel = endPointer;

  let lastTap = 0;
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || pointers.size) return;
    const now = Date.now();
    if (now - lastTap < 320) { $('#reset')?.click(); lastTap = 0; }
    else lastTap = now;
  });
}

/* Watchlist is rebuilt by app.js on every render; keep the alert affordance. */
if ($('#watchlist')) {
  new MutationObserver(injectBells).observe($('#watchlist'), { childList: true });
  injectBells();
}

/* ================================================================== *
 * Tier 2 remainder — bracket orders on fills
 * ================================================================== */
const BRACKET_KEY = 'atlas-brackets';
let brackets = read(BRACKET_KEY, []);

function saveBrackets() { write(BRACKET_KEY, brackets); renderBrackets(); }
function renderBrackets() {
  const el = $('#brackets');
  if (!el) return;
  if (!brackets.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = '<span class="pending-label">BRACKETS</span>' + brackets.map((b) =>
    `<div class="pending-row"><span>${b.side.toUpperCase()} ${b.symbol} · SL ${b.sl ? num(b.sl) : '—'} / TP ${b.tp ? num(b.tp) : '—'}</span><button data-del-bracket="${b.id}" aria-label="Remove bracket">×</button></div>`
  ).join('');
}

function checkBrackets() {
  if (!brackets.length) return;
  const price = A.market[4];
  let changed = false;
  for (const b of brackets) {
    const stopHit = b.side === 'buy' ? (b.sl && price <= b.sl) : (b.sl && price >= b.sl);
    const targetHit = b.side === 'buy' ? (b.tp && price >= b.tp) : (b.tp && price <= b.tp);
    if (!stopHit && !targetHit) continue;
    if (b.side === 'buy' && b.qty > holding(b.symbol) + 1e-9) continue;
    if (b.side === 'sell' && holding(b.symbol) < -1e-9) continue;
    A.balance += b.qty * price;
    A.orders.unshift({ symbol: b.symbol, qty: b.qty, price,
      side: b.side === 'buy' ? 'sell' : 'buy', time: new Date().toISOString() });
    A.store();
    A.renderOrders();
    A.toast(`${stopHit ? 'Stop loss' : 'Take profit'} hit · ${b.symbol}`);
    brackets = brackets.filter((x) => x !== b);
    changed = true;
  }
  if (changed) saveBrackets();
}

$('#brackets')?.addEventListener('click', (e) => {
  const id = e.target.closest('[data-del-bracket]')?.dataset.delBracket;
  if (!id) return;
  brackets = brackets.filter((b) => String(b.id) !== String(id));
  saveBrackets();
  A.toast('Bracket removed.');
});

/* Market orders use app.js's handler; this bubble listener attaches SL/TP after the fill. */
document.addEventListener('click', (e) => {
  if (!e.target.closest?.('#place-order')) return;
  const sl = Number($('#stop-loss').value) || null;
  const tp = Number($('#take-profit').value) || null;
  if (!sl && !tp) return;
  const newest = A.orders[0];
  if (!newest) return;
  brackets.push({ id: Date.now(), symbol: newest.symbol, side: newest.side, qty: newest.qty, sl, tp });
  saveBrackets();
  A.toast(`Bracket set on ${newest.symbol}.`);
});
renderBrackets();
setInterval(checkBrackets, 2400);

/* ================================================================== *
 * Tier 2 remainder — watchlist management
 * ================================================================== */
const HIDDEN_KEY = 'atlas-hidden';
const CUSTOM_KEY = 'atlas-custom';
let hiddenSet = new Set(read(HIDDEN_KEY, []));
for (const market of read(CUSTOM_KEY, [])) {
  if (!A.markets.some((m) => m[0] === market[0])) A.markets.push(market);
}

function applyWatchVisibility() {
  $$('.watch-row').forEach((row) => { row.hidden = hiddenSet.has(row.dataset.symbol); });
}
if ($('#watchlist')) {
  new MutationObserver(applyWatchVisibility).observe($('#watchlist'), { childList: true });
  applyWatchVisibility();
}

function renderManage() {
  const list = $('#manage-list');
  if (!list) return;
  list.innerHTML = A.markets.map((m) =>
    `<div class="manage-row"><label><input type="checkbox" data-watch-toggle="${m[0]}" ${hiddenSet.has(m[0]) ? '' : 'checked'}> ${m[0]} · ${m[2]}</label>${m[3] === 'Custom' ? `<button data-del-custom="${m[0]}" class="text-btn">Remove</button>` : ''}</div>`
  ).join('');
  $$('[data-watch-toggle]').forEach((cb) => {
    cb.onchange = () => {
      const symbol = cb.dataset.watchToggle;
      if (cb.checked) hiddenSet.delete(symbol); else hiddenSet.add(symbol);
      write(HIDDEN_KEY, [...hiddenSet]);
      applyWatchVisibility();
    };
  });
}

$('#manage-watch')?.addEventListener('click', () => { renderManage(); $('#manage-dialog').showModal(); });
$('#manage-list')?.addEventListener('click', (e) => {
  const symbol = e.target.closest('[data-del-custom]')?.dataset.delCustom;
  if (!symbol) return;
  const index = A.markets.findIndex((m) => m[0] === symbol);
  if (index >= 0) A.markets.splice(index, 1);
  write(CUSTOM_KEY, A.markets.filter((m) => m[3] === 'Custom'));
  hiddenSet.add(symbol);
  write(HIDDEN_KEY, [...hiddenSet]);
  renderManage();
  A.render();
});
$('#add-custom')?.addEventListener('click', () => {
  const symbol = ($('#new-symbol').value || '').trim().toUpperCase();
  const price = Number($('#new-price').value);
  if (!symbol || A.markets.some((m) => m[0] === symbol)) { A.toast('Symbol is empty or already present.'); return; }
  if (!Number.isFinite(price) || price <= 0) { A.toast('Enter a valid starting price.'); return; }
  A.markets.push([symbol, symbol, symbol, 'Custom', price, symbol[0], 0]);
  write(CUSTOM_KEY, A.markets.filter((m) => m[3] === 'Custom'));
  hiddenSet.delete(symbol);
  write(HIDDEN_KEY, [...hiddenSet]);
  $('#new-symbol').value = '';
  $('#new-price').value = '';
  renderManage();
  A.render();
  A.toast(`${symbol} added to the watchlist.`);
});

/* ================================================================== *
 * Tier 3 — synchronized multi-chart panes
 * ================================================================== */
let paneCount = 1;
const paneSeries = new Map();
const paneCanvases = [];

function seriesFor(symbol, tf) {
  const key = `${symbol}:${tf}`;
  if (paneSeries.has(key)) return paneSeries.get(key);
  let seed = [...key].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const market = A.markets.find((m) => m[0] === symbol);
  const base = market ? market[4] : 100;
  let price = base * 0.85;
  const bars = Array.from({ length: 320 }, () => {
    const o = price;
    const c = o * (1 + (rnd() - 0.475) * 0.02);
    const h = Math.max(o, c) * (1 + rnd() * 0.005);
    const l = Math.min(o, c) * (1 - rnd() * 0.005);
    price = c;
    return { o, c, h, l };
  });
  const scale = base / bars[bars.length - 1].c;
  bars.forEach((b) => { for (const k of ['o', 'c', 'h', 'l']) b[k] *= scale; });
  paneSeries.set(key, bars);
  return bars;
}

function drawPane(canvas, symbol) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const styles = getComputedStyle(document.body);
  const bg = styles.getPropertyValue('--bg').trim() || '#0A0C11';
  const line = styles.getPropertyValue('--line').trim() || 'rgba(255,255,255,.08)';
  const muted = styles.getPropertyValue('--muted').trim() || '#8B94A7';
  const accent = styles.getPropertyValue('--accent').trim() || '#6E96FF';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, rect.width, rect.height);

  const tf = document.querySelector('[data-tf].active')?.dataset.tf || '4h';
  const view = seriesFor(symbol, tf).slice(-A.count);
  const left = 8, right = rect.width - 8, top = 26, bottom = rect.height - 8;
  if (right <= left || bottom <= top) return;
  const low = Math.min(...view.map((b) => b.l));
  const high = Math.max(...view.map((b) => b.h));
  const pad = (high - low) * 0.08 || 1;
  const lo = low - pad, hi = high + pad;
  const y = (v) => top + (hi - v) / (hi - lo) * (bottom - top);
  const x = (i) => left + (i + 0.5) / view.length * (right - left);

  ctx.strokeStyle = line;
  ctx.lineWidth = 0.6;
  for (let i = 0; i <= 3; i++) {
    const py = top + (bottom - top) * i / 3;
    ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
  }
  const step = (right - left) / view.length;
  view.forEach((b, i) => {
    const up = b.c >= b.o;
    ctx.strokeStyle = up ? '#26C281' : '#F0606E';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.moveTo(x(i), y(b.h)); ctx.lineTo(x(i), y(b.l)); ctx.stroke();
    ctx.fillRect(x(i) - Math.max(0.6, step * 0.3), Math.min(y(b.o), y(b.c)),
      Math.max(1, step * 0.6), Math.max(1, Math.abs(y(b.o) - y(b.c))));
  });
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = accent;
  ctx.beginPath(); ctx.moveTo(left, y(view[view.length - 1].c)); ctx.lineTo(right, y(view[view.length - 1].c)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = muted;
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillText(`${symbol} · ${tf}`, 9, 16);
}

function updatePanes() {
  if (!paneCanvases.length) return;
  const others = A.markets.filter((m) => m[0] !== A.market[0]);
  paneCanvases.forEach((canvas, i) => {
    const label = canvas.parentElement.querySelector('.pane-label');
    if (label.textContent === 'SELECTING…') label.textContent = others[i % others.length][0];
    drawPane(canvas, label.textContent);
  });
}

function buildPanes() {
  const wrap = $('.canvas-wrap');
  paneCanvases.forEach((canvas) => canvas.parentElement?.remove());
  paneCanvases.length = 0;
  wrap.classList.remove('multi-2', 'multi-4');
  if (paneCount > 1) wrap.classList.add(paneCount === 2 ? 'multi-2' : 'multi-4');
  for (let i = 0; i < paneCount - 1; i++) {
    const pane = document.createElement('div');
    pane.className = 'pane';
    const label = document.createElement('span');
    label.className = 'pane-label';
    label.textContent = 'SELECTING…';
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.title = 'Click to change symbol';
    canvas.setAttribute('aria-label', 'Secondary chart. Click to change symbol.');
    canvas.addEventListener('click', () => {
      const index = A.markets.findIndex((m) => m[0] === label.textContent);
      label.textContent = A.markets[(index + 1) % A.markets.length][0];
      drawPane(canvas, label.textContent);
    });
    pane.append(canvas, label);
    wrap.appendChild(pane);
    paneCanvases.push(canvas);
  }
  updatePanes();
}

$$('#layout [data-layout]').forEach((button) => {
  button.addEventListener('click', () => {
    paneCount = Number(button.dataset.layout);
    $$('#layout [data-layout]').forEach((b) => b.classList.toggle('active', b === button));
    buildPanes();
    fillCanvas();
  });
});
if ($('.canvas-wrap')) new ResizeObserver(updatePanes).observe($('.canvas-wrap'));
setInterval(updatePanes, 2400);

/* ================================================================== *
 * Tier 3 — market wire and calendar
 * ================================================================== */
const CALENDAR = [
  ['08:30', 'CPI (MoM)', 'HIGH'], ['10:00', 'FOMC statement', 'HIGH'],
  ['13:30', 'Initial claims', 'MED'], ['15:00', 'Crude inventories', 'LOW'],
];
function renderNews() {
  const symbol = A.market[0];
  const name = A.markets.find((m) => m[0] === symbol)?.[2] || symbol;
  const stories = [
    `${name} liquidity builds as the simulated session opens`,
    `${symbol} holds its range while traders weigh macro data`,
    `Volume clusters near the session's opening level`,
    `Analysts watch the next hourly close for direction`,
  ];
  const list = $('#news-list');
  if (list) list.innerHTML = stories.map((s, i) =>
    `<div class="news-item"><b>${String(i + 1).padStart(2, '0')}</b>${s}</div>`).join('');
  const cal = $('#calendar-list');
  if (cal) cal.innerHTML = CALENDAR.map(([time, label, impact]) =>
    `<div class="cal-item"><span>${time} · ${label}</span><span class="cal-impact">${impact}</span></div>`).join('');
}
renderNews();
setInterval(renderNews, 15000);

/* ================================================================== *
 * Tier 3 — accent picker, and first-run tour
 * ================================================================== */
const PALETTES = {
  blue: { hex: '#6E96FF', rgb: '110,150,255' },
  teal: { hex: '#1FBFA0', rgb: '31,191,160' },
  amber: { hex: '#E8A838', rgb: '232,168,56' },
  rose: { hex: '#F0738B', rgb: '240,115,139' },
};
function applyAccent(name) {
  const palette = PALETTES[name] || PALETTES.blue;
  document.body.style.setProperty('--accent', palette.hex);
  document.body.style.setProperty('--accent-rgb', palette.rgb);
  write('atlas-accent', name);
  $$('#swatches button').forEach((b) => b.classList.toggle('active', b.dataset.accent === name));
}
$$('#swatches [data-accent]').forEach((b) => b.addEventListener('click', () => applyAccent(b.dataset.accent)));
$('#appearance')?.addEventListener('click', () => $('#accent-dialog').showModal());
applyAccent(read('atlas-accent', 'blue'));

const TOUR = [
  ['Your chart', 'Change symbol, timeframe and chart type from the bar above. Scroll or pinch to zoom, drag to pan.'],
  ['Watchlist and alerts', 'Pick any market from the right rail. The bell on each row creates a price alert that survives reloads.'],
  ['Paper trading', 'Market, limit and stop orders fill against simulated prices. Add a stop loss or take profit before placing an order.'],
];
let tourStep = 0;
function renderTour() {
  setText('#tour-title', TOUR[tourStep][0]);
  setText('#tour-copy', TOUR[tourStep][1]);
  setText('#tour-step', `${tourStep + 1} / ${TOUR.length}`);
  setText('#tour-next', tourStep === TOUR.length - 1 ? 'Finish' : 'Next');
}
$('#tour-next')?.addEventListener('click', () => {
  tourStep++;
  if (tourStep >= TOUR.length) { $('#tour-dialog').close(); write('atlas-tour', true); }
  else renderTour();
});
if (!read('atlas-tour', false)) setTimeout(() => { renderTour(); $('#tour-dialog').showModal(); }, 1200);

/* ================================================================== *
 * Tier 4 — focus trapping and offline shell
 * ================================================================== */
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.disabled && el.getBoundingClientRect().width > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

/* ================================================================== *
 * Mobile chart-first dock — move real panels in and out of a sheet so
 * every existing event handler stays attached to its original element.
 * ================================================================== */
const SHEET_TARGETS = {
  tools: '.tools',
  trade: '.quote-buttons',
  markets: 'aside',
  account: '.bottom-panel',
};
const dock = $('#mobile-dock');
const sheet = $('#mobile-sheet');
const sheetBody = $('#sheet-body');
const sheetBackdrop = $('#sheet-backdrop');
const mobileQuery = matchMedia('(max-width:680px)');
const sheetOrigins = new Map();
let activeSheet = null;

function closeSheet() {
  if (!activeSheet) return;
  const element = $(SHEET_TARGETS[activeSheet]);
  const origin = sheetOrigins.get(element);
  if (element && origin) {
    origin.parent.insertBefore(element, origin.next);
    sheetOrigins.delete(element);
  }
  sheetBody.querySelectorAll('[data-sheet-note]').forEach((note) => note.remove());
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  sheetBackdrop.hidden = true;
  $$('#mobile-dock button').forEach((button) => {
    button.classList.remove('active');
    button.setAttribute('aria-expanded', 'false');
  });
  activeSheet = null;
}

function openSheet(name) {
  if (!mobileQuery.matches || !SHEET_TARGETS[name]) return;
  if (activeSheet === name) { closeSheet(); return; }
  closeSheet();

  const element = $(SHEET_TARGETS[name]);
  if (!element) return;
  sheetOrigins.set(element, { parent: element.parentElement, next: element.nextSibling });

  if (name === 'trade') {
    const note = document.createElement('p');
    note.className = 'muted dialog-note sheet-note';
    note.dataset.sheetNote = '1';
    note.textContent = 'Paper orders · simulated execution';
    sheetBody.appendChild(note);
  }
  sheetBody.appendChild(element);

  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  sheetBackdrop.hidden = false;
  $$('#mobile-dock button').forEach((button) => {
    const on = button.dataset.sheet === name;
    button.classList.toggle('active', on);
    button.setAttribute('aria-expanded', String(on));
  });
  activeSheet = name;
}

dock?.addEventListener('click', (e) => {
  const button = e.target.closest('[data-sheet]');
  if (button) openSheet(button.dataset.sheet);
});
sheetBackdrop?.addEventListener('click', closeSheet);
$('#sheet-close')?.addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && activeSheet) closeSheet(); }, true);

const onBreakpoint = (e) => { if (!e.matches) closeSheet(); };
if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', onBreakpoint);
else mobileQuery.addListener(onBreakpoint);

/* Percentage canvas height cannot resolve through the mobile flex chain;
   assign the measured height directly and let app.js redraw into it. */
function fillCanvas() {
  const wrap = $('.canvas-wrap');
  const canvas = $('#chart');
  if (!wrap || !canvas || !mobileQuery.matches) return;
  const rows = wrap.classList.contains('multi-4') ? 2 : 1;
  const height = Math.max(80, Math.round(wrap.clientHeight / rows));
  if (canvas.style.height !== height + 'px') {
    canvas.style.height = height + 'px';
    A.draw();
  }
  paneCanvases.forEach((pane) => {
    const paneHeight = Math.round(pane.parentElement.clientHeight);
    if (paneHeight > 0 && pane.style.height !== paneHeight + 'px') pane.style.height = paneHeight + 'px';
  });
}
if ($('.canvas-wrap')) new ResizeObserver(fillCanvas).observe($('.canvas-wrap'));
fillCanvas();

const onResizeBreakpoint = (e) => {
  if (!e.matches && $('#chart')) $('#chart').style.height = '';
  else fillCanvas();
};
if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', onResizeBreakpoint);
else mobileQuery.addListener(onResizeBreakpoint);



