# Atlas trading workspace

An independent TradingView-style workspace, built with JavaScript, Canvas, and Vite.

## Run

```sh
npm install
npm run dev
```

Production: `npm run build`. Functional checks: `node scripts/check.mjs`.

## Features

- Seven searchable simulated markets; five timeframes; candle, line, and area charts.
- Scroll to zoom, drag to pan, arrow keys to pan, +/- to zoom.
- SMA 20 and volume; trend lines (select two points), horizontal lines, clear drawings.
- Paper market orders, position closing, order history, cash validation, and oversell protection.
- Layout preferences and practice account persist in browser local storage.
- Light/dark themes and PNG chart export.
- Live simulated quotes with green/red flash feedback on the price and watchlist.
- Command palette (`⌘K` / `/`), keyboard shortcuts and a built-in shortcut reference.
- Pinch-to-zoom and double-tap reset on the chart canvas.
- Portfolio strip: equity, unrealized P&L, exposure and open position count.

## Design

Liquid Glass material system over TradingView's information architecture — Outfit + JetBrains Mono, one accent, pointer-tracked specular highlights. Research, decisions, and verification are in [`DESIGN.md`](DESIGN.md).

All prices and executions are simulated. No brokerage connection or real-time data feed is included. This is an independently built interface, not extracted TradingView source. REA analysis was blocked by the available Node 22.16.0 runtime; no REA reconstruction or internal TradingView behavior is claimed.
