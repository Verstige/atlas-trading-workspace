# Atlas — upgrade roadmap

Prioritized by impact on the experience, not by implementation novelty. **Tier 1 is being built in this pass.**

## Tier 1 — Feel alive / move faster (SHIPPED)

| Upgrade | Why it matters |
|---|---|
| **Live quote engine** — prices tick every ~2.4s, watchlist and detail flash green/red, last candle updates | Right now the market is frozen until you click. Nothing signals "live" like motion in the numbers. |
| **Command palette (`⌘K` / `/`) + keyboard shortcuts** | Power users should never touch the mouse to switch symbol, timeframe, tool, or order side. |
| **Pinch-to-zoom and double-tap reset on the chart** | The canvas supports wheel + drag but no touch gestures; phone users can't zoom at all today. |
| **Portfolio metrics strip** — equity, unrealized P&L, exposure, position count | Paper trading currently shows a balance and a table, no sense of performance. |

**Status:** all four shipped and verified in-browser at desktop and phone widths. See [DESIGN.md](DESIGN.md) for the design rationale.

## Tier 2 — Depth that makes it a real workspace (SHIPPED)

- **Limit and stop orders**, take-profit/stop-loss on positions. Market-only is the biggest functional gap.
- **Per-position unrealized P&L** and an equity-curve sparkline in the bottom panel.
- **Price alerts** on watchlist rows — toast + audible cue when a level is crossed.
- **Drawing persistence** — trend lines and horizontal lines survive symbol/timeframe changes and reloads.

**Status: fully shipped.** Limit/stop orders with a pending queue, FIFO realized P&L with win rate and profit factor, an equity curve, price alerts, CSV export, bracket SL/TP on any fill, per-symbol drawing persistence, and watchlist add/remove with custom symbols.
- **CSV export** of the visible OHLCV series alongside the existing PNG export.
- **Watchlist management** — the `+` currently just selects a symbol; it should add/remove and persist columns.

## Tier 3 — Scale (SHIPPED)

- **Multi-chart layout** (2–4 synchronized panes by symbol, interval, crosshair and range) — TradingView's defining power feature.
- **News / economic calendar** widget in the right rail.
- **Custom accent picker** with 4 curated palettes, saved locally.
- **Guided first-run tour** with three steps: chart, watchlist, paper account.

## Tier 4 — Engineering quality (SHIPPED)

- **Canvas render optimization** — throttle redraws to animation frames, cache the grid/axis layer, avoid full recompute on every pointer move.
- **Accessibility pass** — focus trap in dialogs, screen-reader labels on canvas interactions, visible keyboard focus throughout.
- **PWA install** with an offline shell and cached assets, so the phone link behaves like an app.
- **E2E smoke suite** covering symbol switch, order flow, dialogs and responsive breakpoints.

## Mobile chart-first layout (shipped)

Phone screens now give the chart the full viewport. The drawing rail, buy/sell ticket,
watchlist and paper-trading panel move into a collapsible bottom dock (Tools / Trade /
Markets / Account), following the compact bottom-bar pattern in the TradingView
reference. Panels are moved, not duplicated, so every event handler stays attached.
The canvas is sized from its measured container because percentage height cannot
resolve through the mobile flex chain.

## Deliberately out of scope

Real broker connectivity, real-time licensed market data, and extraction of TradingView's proprietary source. Everything here stays an independent simulated interface.
