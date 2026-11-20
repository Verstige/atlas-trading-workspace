# Path to TradingView parity

## The blunt version

Atlas cannot **literally** replace TradingView for real trading decisions yet, and the reason is not the interface. It is the data. Every price in the app is generated locally by a seeded random walk. That is fine for learning the interface and testing order mechanics, but nobody should make a real decision on a synthetic candle.

To cross that line, the first requirement is a real market data feed. Everything else on this list is polish by comparison. I will not label simulated prices as live or invent a feed that does not exist.

## What already matches

| TradingView capability | Atlas status |
|---|---|
| Symbol search, timeframes, chart types | Present |
| Multi-chart layout with sync | 1/2/4 panes, shared timeframe and range |
| Drawing tools | Crosshair, trend, horizontal, **Fibonacci retracement + extension**, clear, undo/redo, per-symbol persistence |
| Indicators | SMA 20 + volume, toggleable |
| Order entry | Market, limit, stop, bracket SL/TP, pending queue |
| Account view | Equity, unrealized, exposure, FIFO realized P&L, win rate, profit factor |
| Alerts | Price alerts on watchlist rows, persistent |
| Workflow | Command palette, hotkeys, PWA install, offline shell |

## The actual gaps, in order

### T0 — Real market data (blocking)

- **Crypto first:** Binance public WebSocket is free, keyless, and gives live trades + klines. Wire it for BTC/ETH/SOL and aggregate 1m → 5m/15m/1h/4h/1D.
- **Stocks, forex, indices:** needs a keyed provider (Twelve Data, Finnhub, Polygon). Delayed vs real-time depends on the plan and exchange licensing.
- **Adapter layer:** one datafeed interface with `subscribe`, `history`, `symbols`, `reconnect`, and an explicit "LIVE / DELAYED / SIMULATED" badge in the UI.
- **Backfill on load** so the chart is never empty, plus reconnect with backoff and a visible stale-data state.
- **Licensing:** do not scrape TradingView's feed or reuse its data. Use provider APIs with the correct entitlements.

### T1 — Charting depth

- More intervals: 1m, 5m, 30m, monthly.
- Chart types: Heikin-Ashi, bars, line, area, Renko.
- Indicators with separate panes and editable settings: EMA, Bollinger Bands, VWAP, RSI, MACD, ATR, Stochastic, Ichimoku.
- Indicator search + saved templates.
- Crosshair and time sync across panes (currently symbol/timeframe/range only).
- **Bar replay** — scrub history bar by bar. Highest-value learning feature TradingView has.

### T2 — Drawing and study toolkit

- **Fibonacci retracement and extension — done.** Selectable studies with draggable
  endpoints, a numeric High/Low editor, undo/redo and persistence.
- Still missing: Fib fan, Fib channel, parallel channel, ray, rectangle, text, arrows, brush, measure tool.
- Magnet snapping to candle highs/lows, per-drawing style editor, duplicate/delete, undo/redo history depth beyond the current stack.

### T3 — Execution

- Broker connectivity (paper first, then live) through a real brokerage API.
- OCO orders, trailing stops, position sizing calculator.
- Order analytics: average fill quality, slippage, exposure over time.

### T4 — Workflow

- Screener with sortable watchlist columns and filters.
- Real news and economic calendar from a licensed feed.
- Saved layouts per workspace, chart snapshots, shareable links.
- Configurable hotkeys.

## Recommended next move

Wire the **Binance public feed** for crypto first: no API key, real ticks, and it validates the whole adapter layer. Then add a keyed provider for stocks and forex once you decide which one fits your budget and licensing needs.

I can build T0 and T1 in that order. I need your call on the data provider for non-crypto instruments before touching that part.

## What I will not do

- Present simulated data as live.
- Claim parity while a core capability is missing.
- Use TradingView's proprietary feed or scraped data.
