# Historical indicator state diagnostics V1 — 2026-11-27

**PASS, real production PostgreSQL (read-only), 09:27:15 UTC / 04:27:15 EST.**

- 25/25 symbol/timeframe pairs; 617,151 candles; exact full ordered event parity 360,092/360,092 (150 channel replays, six channels for five indicators).
- All V1 pivot category totals reproduced. Research features only on chronological training 70%, at offsets -2,-1,0 relative to confirmed signal or missed pivot; the original 30% holdout was already descriptively inspected in the preceding study, not used here to develop features. Reserve new unseen data for final evaluation.
- Exact native Momentum, SPEED and Cipher outputs; instrumented Vector and Frank research copies checked against original output at every bar. Original implementations unchanged. Frank divergence still confirms two candles after its own pivot. SPEED baseline classifies volume levels and candle direction; speedPercent is diagnostic, not itself a trigger.
- Code e4f41ac2153389b6c61fe1a6141faccc4a5eee43; CI run 45973605290 success; Render deploy dep-dc4kp9dbedkc73dnjng0, API commit 586426f070cb8c6379c6c4479a8a8998f44bb3d9; cleanup startup removal API commit abe7e141e71dc453073ae652612dc79658b6e45d.

## Training-only descriptive findings

| Indicator | Observation | Candidate hypothesis (not implemented) |
|---|---|---|
| Vector | 4,749 on-pivot signals average 4.19 confirmations and 2.39x relative volume; 34,267 missed pivot cases average 2.02 confirmations and 1.37x relative volume at pivot; 43.64% already in the desired direction immediately before pivot. | Study confirmation components and distinguish already aligned from actual missed entry. |
| Momentum | 346 on-pivot and 4,783 late associated signals have directional EMA aligned by construction; of 41,839 missed pivots, 35.31% align and only 1.65% show directional threshold cross on pivot. | Isolate EMA gate vs oscillator crossing; no blanket removal. |
| SPEED | 10,074 redundant training events have mean volume 195.66%, 214.75%, 241.30% over t-2,t-1,t; 6,849 on-pivot cases have 142.65%, 186.40%, 240.76%. | Investigate repeated high-volume clusters and suppression of redundant events without sacrificing first signal. |
| Cipher | 749 on-pivot signals mean direction-adjusted WT gap -2.41 at t-1; 28,035 late signals -3.33 at t-1. At 15,367 missed pivots mean signed gap -9.16 at pivot, signed WT1 slope -7.57. | Evaluate causal gap compression / slope before confirmation; no hindsight signal. |
| Frank | 41,722 missed cross pivots: EMA direction aligned on 21.63%; confirmed cross signals all align by construction. Divergence matching uses actual confirmation index; right-side confirmation needs two candles. | Separate cross gate from divergence confirmation, distinguish early warning from confirmed divergence. |

All values are pooled descriptive means over training cases, not predictive accuracy, causes, or profitable trade results. Matched signals and missed pivots are measured at different event-relative timestamps; compare equivalent contexts before proposing a parameter change. Existing aligned positions may be valid non-signals. Off-pivot events are not necessarily bad.

## Research memory

- [aggregate.json](research/state-2026-11-27/aggregate.json): all five markets, 70 nonempty channel/category/direction groups; exact full-history pair totals.
- [BTC](research/state-2026-11-27/BTCUSDT.json), [ETH](research/state-2026-11-27/ETHUSDT.json), [SOL](research/state-2026-11-27/SOLUSDT.json), [HYPE](research/state-2026-11-27/HYPEUSDT.json): 1,335 per-pair groups and 280 representative 1h snapshots. Counts checked against prior V1 pivot study.
- 1000PEPE included in the verified run and aggregate; detailed export was blocked by the Render connector rate limit (429). Its stratified output remains in Render logs; export is not yet committed.
- Feature moments encoded [finite observation count, sum, sum of squares]; sum fields serialized to 11 significant digits. emaGapPct is actually a fraction, not multiplied by 100.
- No historical rows, archived original reports, main branch, trading rules or parameters changed. No optimization or live trade.

Next: finish detailed 1000PEPE export, then isolate one hypothesis per indicator, use matched comparable pivot contexts and training-only walk-forward experiments with frozen baseline. Test costs, direction, timeframe and false signal burden; reserve independent future validation; keep all candidate versions in dev pending approval.
