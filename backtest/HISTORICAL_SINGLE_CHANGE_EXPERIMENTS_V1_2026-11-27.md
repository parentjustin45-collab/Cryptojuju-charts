# First single-change indicator experiments — 2026-11-27

**PASS** — production PostgreSQL read-only run completed 10:09:20 UTC (05:09:20 EST).
25 pairs, 125 candidate/baseline comparisons, 250 candidate prefix checks. CI 13/13 tests ([run 45979419445](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/45979419445)). Source commit 0f8224cea833c8192ab946f1889e4a271e868630; API 8a1897819c0fec27527c658a33950049f734227a; Render dep-dc4ld10473hc739o0t70. Cleanup API commit 6e62d8c20c8c193dddc510cf302011280e8ee629.

## Fixed experimental changes
Vector minimum confirmations 4→3; Momentum EMA 21/55→13/34; SPEED suppress same-side events within 2 bars of last emitted event; Cipher WT2 smoothing 4→3; Frank cross EMA 8/21→5/13, divergence unchanged. No parameter search. Baseline event parity on training history; independent truncated prefix checks at 1/3 and 2/3 of training. Three chronological training folds, no use of remaining 30% for candidates. The previous descriptive holdout inspection means fresh independent data are needed for final validation.

## Pooled training results
Pivot matches are retrospective same-direction one-to-one within +/-3 bars; each fold excludes boundary context. Denominator 47,566 pivots (distinct from the previous unsplit training study). Precision = matched / eligible events, coverage = matched / pivots. Event count includes edge exclusions. Outcomes at next open through 12-bar close; net bps subtract hypothetical round-trip costs, not actual trade fills.

| Candidate | Events original → experimental | Pivot coverage % | Match precision % | Mean gross bps | Mean net bps at 10 bps |
|---|---:|---:|---:|---:|---:|
| Vector 3 confirmations | 25340 → 69466 | 28.19 → 68.07 | 53.06 → 46.76 | -0.46 → -0.22 | -10.46 → -10.22 |
| Momentum 13/34 | 11004 → 7756 | 12.31 → 8.93 | 53.39 → 54.95 | -2.72 → -1.17 | -12.72 → -11.17 |
| SPEED 2-bar filter | 75039 → 54947 | 43.43 → 42.33 | 27.61 → 36.75 | +1.49 → -0.08 | -8.51 → -10.08 |
| Cipher smoothing 3 | 65141 → 75058 | 67.78 → 75.62 | 49.68 → 48.11 | -0.43 → -0.29 | -10.43 → -10.29 |
| Frank cross 5/13 | 11509 → 5515 | 12.54 → 6.66 | 52.07 → 57.74 | -5.00 → -2.42 | -15.00 → -12.42 |

## Research decisions (not promotion)
- Vector: reject unconditional change for now. Event count +174%; study selective 3/5 confirmation patterns and existing direction. More matched pivots alone does not mean better trades.
- Momentum: retain baseline; test targeted EMA gate versus oscillator threshold. Coverage declines, gross outcome improvement not stable across folds.
- SPEED: promising noise reduction (redundant events 10060→3185; matched pivots 20656→20133), but gross outcome worsens. Explore one-bar cooldown or regime-aware filter before promotion.
- Cipher: coverage increases but event burden and late matches increase; test a separate early warning or gap compression condition, not backdating confirmed cross.
- Frank: cross coverage roughly halves; reject shorter EMA as general solution, test divergence prealert separately, preserving original confirmed divergence. No changes to original code.

Every pooled candidate has negative mean 12-bar outcome after hypothetical 10 bps. No profitability certification or recommendation to trade. Events overlap, no portfolio equity, funding, leverage, stop execution, realistic slippage or independent out-of-sample performance. No winner promoted. Preserve negative findings and per-fold/side/market results.

## Evidence
[Aggregate](research/experiments-v1-2026-11-27/aggregate.json), [BTC](research/experiments-v1-2026-11-27/BTCUSDT.json), [ETH](research/experiments-v1-2026-11-27/ETHUSDT.json), [SOL](research/experiments-v1-2026-11-27/SOLUSDT.json), [HYPE](research/experiments-v1-2026-11-27/HYPEUSDT.json), [1000PEPE](research/experiments-v1-2026-11-27/1000PEPEUSDT.json). All 125 comparisons archived with three folds and separate long/short counts.

Prior outstanding 1000PEPE state export completed in commit 08f7cf9e2d5a518d996cbc98942287250760a268 (331 stratified groups, 70 representative snapshots). All five state reports archived.

Next: analyze per timeframe and direction, then predeclare second targeted hypotheses and run comparative experiments on development only. Preserve main and immutable reference history.
