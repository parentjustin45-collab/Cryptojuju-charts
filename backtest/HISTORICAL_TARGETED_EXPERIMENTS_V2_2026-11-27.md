# Targeted indicator experiments V2 — 2026-11-27

**PASS** — read-only PostgreSQL research finished 10:18:13 UTC / 05:18:13 EST. 25 pairs, 150 comparisons across six channels/five indicators, 300 truncated-prefix checks, 19/19 CI tests. Source 61b78b5dd8ccad3e89035b6ee5e3f21f2d9c21eb; CI 45980697738; API 664146b8ee12184e86bd67428ad0137106381069; Render dep-dc4lh4m0tbcc73d8j4e0. Cleanup API commit 892c291e87ddabac184852910b7470445d649d1a.

Fixed hypotheses selected after reviewing V1 by timeframe/direction. Identical training-only 70% and three chronological folds; 47,566 retrospective pivots. Matched same-side within ±3 bars, one-to-one. No holdout used in this run. Event returns next open to 12th close, no portfolio simulation.

| Channel | Events baseline→V2 | Coverage % | Match precision % | Mean gross bps | Mean net bps at 10 bps |
|---|---:|---:|---:|---:|---:|
| Vector selective three confirmations | 25340→25550 | 28.19→28.38 | 53.06→52.99 | -0.46→-0.32 | -10.46→-10.32 |
| Momentum directional EMA compression | 11004→12422 | 12.31→14.14 | 53.39→54.33 | -2.72→-0.87 | -12.72→-10.87 |
| SPEED one-bar same-side cooldown | 75039→60559 | 43.43→42.77 | 27.61→33.69 | +1.49→+0.59 | -8.51→-9.41 |
| Cipher prealert/confirmation stream | 65141→72775 | 67.78→76.31 | 49.68→50.07 | -0.43→-0.17 | -10.43→-10.17 |
| Frank cross directional EMA compression | 11509→16804 | 12.54→19.67 | 52.07→55.94 | -5.00→-5.42 | -15.00→-15.42 |
| Frank provisional divergence | 63221→80841 | 62.36→64.70 | 47.09→38.21 | -0.43→-0.62 | -10.43→-10.62 |

## Research decisions
- Momentum: advance candidate for further development. Coverage, match precision and mean gross outcome improve in all three training folds, not independent validation.
- Cipher: 27,021/34,652 evaluable warnings followed by same-side confirmed cross within 2 bars (77.98%); 4 unresolved at boundary. On-pivot matches 747→1411. Retain separate provisional alert, original confirmed cross unchanged. Research stream substitutes recent warning for confirmation; this is not production behavior. Mean gross improves only one of three folds.
- SPEED: redundant 10060→5063, matched 20656→20343. Keep optional visual candidate; outcome worsens in all three folds, so no trading rule promotion.
- Vector: 210 extra signals and 91 extra matched pivots; selective exception has marginal benefit. Do not promote; analyze component combinations and already-aligned positions.
- Frank cross: coverage and precision improve but pooled outcome worsens; don't promote. Frank provisional divergence: 63,221/80,831 evaluable warnings confirmed at next candle with same divergence type (78.21%); 10 unresolved. Precision declines materially; keep separate, test better filters. Original two-right-bar confirmation unchanged.
- All pooled candidate mean returns after 10 bps remain negative. No candidate promoted, no claim of profitability; overlapping events, fees/slippage not realistic, no funding/leverage/portfolio simulation. Repeated training exposure requires future unseen validation. All thresholds are research choices, not user-specified or established optimal values.

Evidence: [aggregate](research/experiments-v2-2026-11-27/aggregate.json), [BTC](research/experiments-v2-2026-11-27/BTCUSDT.json), [ETH](research/experiments-v2-2026-11-27/ETHUSDT.json), [SOL](research/experiments-v2-2026-11-27/SOLUSDT.json), [HYPE](research/experiments-v2-2026-11-27/HYPEUSDT.json), [1000PEPE](research/experiments-v2-2026-11-27/1000PEPEUSDT.json). All 150 archived. Next: evaluate candidate robustness by timeframe/direction, timing of warning vs confirmed event and forward outcome; predeclare selective V3 tests; add independent forward data validation. No historical row, baseline indicator or main edits.
