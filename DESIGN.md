# Atlas — Design research & rationale

Deep design pass on the simulated market workspace. The goal was not a skin: it was to keep TradingView's information architecture while rebuilding the material language around Apple's Liquid Glass, then make the result easier to scan than either.

## Thesis

**TradingView's structure, Liquid Glass's material, a calmer hierarchy.**

TradingView and Liquid Glass pull in opposite directions — one is a dense utilitarian terminal, the other is an expressive optical material. The resolution: keep the *spatial logic* of a professional charting workstation (where every control lives and what it does), and apply the material as a thin optical layer that never competes with price data. Data stays near-monochrome; color is reserved for state.

## What the research established

### TradingView interface anatomy
TradingView's own Charting Library docs divide the surface into: the **widget bar** (object tree, watchlist, details, news), the **chart pane** (series and indicator panes), the **toolbar** (symbol, resolution, chart type, indicators), and, on the trading platform, the **order ticket**, **positions**, and **depth of market**. The left drawing rail and right watchlist/details column are the defining spatial signatures. Multiple synchronized chart layouts exist but are out of scope for a single-pane demo.

The classic dark chart recipe is consistent across trader references: near-black canvas, faint grid, distinct green up / red down candles, and a restrained accent for the active control.

### Liquid Glass (WWDC 2025)
Apple describes three composited layers: **highlight** (specular light that moves), **shadow** (separation from the background), and **illumination** (the material's own translucency). Because browsers cannot read pixels behind an element directly, the practical web implementation is `backdrop-filter` blur + saturation for refraction, layered gradients for tint, an inset 1px rim for edge refraction, and a specular highlight that tracks the pointer. SVG `feTurbulence` + `feDisplacementMap` can approximate true refraction, but on a full-viewport blurred orb it is a serious mobile GPU cost.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Layout | Top symbol/timeframe bar, left drawing rail, center chart pane, right watchlist + details, bottom positions | Matches TradingView's learned spatial map — zero re-orientation for existing users |
| Material | `backdrop-filter: blur(22px) saturate(155%)` over a drifting 3-orb field, layered white tint, `inset 0 1px 0` rim, gradient top edge, pointer-tracked radial specular | Reads as refractive glass while the field behind it provides something to refract |
| Refraction filter | SVG displacement evaluated and **dropped from production** | It hung the renderer at 2× DPR on a phone-sized viewport. The CSS layer carries the look at a fraction of the cost |
| Accent | One electric blue, `#6E96FF`, saturation under 80% | TradingView's blue heritage without the violet "AI gradient" tell |
| Semantic color | Up `#26C281`, down `#F0606E` | Trading-native, desaturated enough to sit beside the accent without shouting |
| Type | Outfit for interface, JetBrains Mono for every number | Geometric display face with tabular data that stays aligned while prices update |
| Density | 4/10, not cockpit mode | "Easy interface" meant removing competition, not adding panels |

### What changed for ease
- One accent instead of a multi-color per-element scheme; the eye tracks the active control immediately.
- Buy/Sell promoted to large, full-width-on-phone targets with prices inside them.
- Resting specular glow on every glass surface, so the material reads as physical even before the pointer moves.
- Range, timeframe, and chart-type controls grouped into discrete pills rather than a flat row of buttons.

### Deliberately not changed
All trading logic, simulated price generation, OHLC math, order accounting, localStorage persistence, and keyboard/pointer chart gestures. The redesign touched structure and presentation; `app.js` only received palette constants, an axis-tick count for narrow screens, and a canvas font swap.

## Responsive notes

- **Desktop (≥1240px):** three columns — 58px rail, fluid chart, 292px right rail.
- **Tablet (900–1240px):** right rail narrows, insight card drops.
- **Phone (≤900px):** right rail moves below the chart; body scrolls vertically; no horizontal overflow at 390px.
- **Phone (≤680px):** toolbar wraps, symbol label condenses, chart gets 500px minimum height, three date ticks instead of six, and the least useful table column is hidden so the Close action stays tappable.

## Verification performed

- `npm run build -- --base=./` — passes.
- `node scripts/check.mjs` — chart generation, OHLC validity, symbol/timeframe switching, buy/sell accounting, oversell and invalid-quantity rejection all pass.
- Rendered in a real browser at 1512×950 and 390×844; confirmed glass translucency, specular rim, candle/volume/SMA rendering, and no horizontal overflow.
- Interaction walkthrough on phone: symbol search → ETHUSD, monogram sync, buy ticket → balance update, light/dark toggle → restored.

## Status

Built and staged locally in `docs/`. **Not pushed to GitHub Pages** — publishing needs an explicit go-ahead.
