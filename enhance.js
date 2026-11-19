/* Atlas — experience upgrades
   Layered on top of app.js through the small window.Atlas public surface.
   Nothing here changes trading math or persistence semantics. */

const A = window.Atlas;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const money = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ------------------------------------------------------------------ *
 * 1. Live quotes — the market moves while you watch it.
 * ------------------------------------------------------------------ */
const TICK_MS = 2400;

function flash(el, direction) {
  if (!el) return;
  el.classList.remove('flash-up', 'flash-down');
  void el.offsetWidth; // restart the animation
  el.classList.add(direction > 0 ? 'flash-up' : 'flash-down');
}

function tick() {
  if (!A) return;
  const market = A.market;
  const before = market[4];
  const digits = market[0] === 'EURUSD' ? 5 : 2;
  const step = before * (Math.random() - 0.5) * 0.0009;
  const next = Number((before + step).toFixed(digits));
  if (next === before) return;

  market[4] = next;
  const bars = A.bars;
  const last = bars && bars[bars.length - 1];
  if (last) {
    last.c = next;
    last.h = Math.max(last.h, next);
    last.l = Math.min(last.l, next);
  }

  A.render(); // refreshes quote, watchlist, OHLC legend and canvas
  const direction = next - before;
  flash($('#detail-price'), direction);
  flash($$('.watch-row').find((row) => row.dataset.symbol === market[0]), direction);
}

if (A) setInterval(tick, TICK_MS);

/* ------------------------------------------------------------------ *
 * 2. Portfolio metrics — equity, performance and exposure at a glance.
 * ------------------------------------------------------------------ */
function setMetric(key, value) {
  const el = $(`[data-m="${key}"]`);
  if (el) el.textContent = value;
}

function netCash(orders, symbol) {
  return orders.reduce(
    (sum, o) => o.symbol === symbol ? sum + (o.side === 'buy' ? 1 : -1) * o.qty * o.price : sum,
    0
  );
}

function updateMetrics() {
  if (!A) return;
  const prices = Object.fromEntries(A.markets.map((m) => [m[0], m[4]]));
  const quantities = {};
  for (const o of A.orders) {
    quantities[o.symbol] = (quantities[o.symbol] || 0) + (o.side === 'buy' ? o.qty : -o.qty);
  }

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

  setMetric('equity', money(equity));
  setMetric('unrealized', (unrealized < 0 ? '−' : '+') + money(Math.abs(unrealized)));
  setMetric('exposure', exposure.toFixed(1) + '%');
  setMetric('positions', String(positions));
  $('[data-m="unrealized"]')?.classList.toggle('negative', unrealized < -1e-9);
}

if (A) {
  updateMetrics();
  setInterval(updateMetrics, 1000);
}

/* Keep the toolbar badge honest when indicators are toggled. */
function syncIndicatorCount() {
  const count = ($('#sma')?.checked ? 1 : 0) + ($('#volume-toggle')?.checked ? 1 : 0);
  const badge = $('#indicators .count');
  if (badge) badge.textContent = String(count);
}
$('#sma')?.addEventListener('change', syncIndicatorCount);
$('#volume-toggle')?.addEventListener('change', syncIndicatorCount);
syncIndicatorCount();

/* ------------------------------------------------------------------ *
 * 3. Command palette and keyboard shortcuts.
 * ------------------------------------------------------------------ */
function openPalette() {
  $('#symbol')?.click(); // reuses app.js's search setup and focus handling
}

$('#shortcuts')?.addEventListener('click', () => $('#shortcuts-dialog')?.showModal());

const TIMEFRAMES = ['15m', '1h', '4h', '1D', '1W'];
const TOOLS = { c: 'cross', t: 'line', h: 'horizontal' };

document.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  const rect = active?.getBoundingClientRect?.();
  const typing = active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)
    && rect && rect.width > 0 && rect.height > 0 && active.offsetParent !== null;
  const key = e.key.toLowerCase();

  if ((e.metaKey || e.ctrlKey) && key === 'k') {
    e.preventDefault();
    openPalette();
    return;
  }
  if (typing) return;

  if (e.key === '/') { e.preventDefault(); openPalette(); return; }
  if (e.key === '?') { e.preventDefault(); $('#shortcuts-dialog')?.showModal(); return; }
  if (/^[1-5]$/.test(e.key)) {
    $(`[data-tf="${TIMEFRAMES[Number(e.key) - 1]}"]`)?.click();
    return;
  }

  const action = {
    b: () => $('#buy')?.click(),
    s: () => $('#sell')?.click(),
    l: () => $('#log')?.click(),
    a: () => $('#auto')?.click(),
    '0': () => $('#reset')?.click(),
  }[key] || (TOOLS[key] ? () => $(`[data-tool="${TOOLS[key]}"]`)?.click() : null);

  if (action) { e.preventDefault(); action(); }
});

/* ------------------------------------------------------------------ *
 * 4. Touch gestures — pinch zoom, double-tap reset.
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
      pinch = {
        distance: Math.hypot(p.x - q.x, p.y - q.y),
        count: A.count,
        offset: A.offset,
      };
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
