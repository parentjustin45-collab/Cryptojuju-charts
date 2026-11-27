# Hourly Bitunix anchor recovery — 2026-11-27

## Root cause (actual PostgreSQL read-only archive audit)
10 blocked hourly slots, 13 configurations, 0 missing archived summaries. All 13 first reads returned exactly 483 raw candles; zero missing, duplicate or out-of-range timestamps. Each had one unresolved UNCONFIRMED_OPEN_ENVELOPE at the oldest fetched anchor, previousClose=null. Second read was not started. No evidence of a transport outage in these cases.

## Validated repair
Code commit 160827cf4b82e4832b53911ac90c19ec8fc3ead0. Fixed accepted 480-candle boundaries; bounded anchor counts [3,4,5,6,8,12] only for a single oldest-anchor anomaly with complete source and no page errors. Existing raw overlap must be identical; genuine preceding candle required. Full independent second read with identical bounds/anchors; conflicts remain blocked. Original failed evidence archived. Hourly summary reports failedChecks and recoveredChecks. Existing full-cohort gate unchanged.

- CI run 45972215654: 48/48 strict/regression tests, 13/13 real recovered windows, all with 4 anchors, both reads stable. PG18 integration run 45972215697 success. No changes to historical collector, original indicators, historical library or main.
- API deployment commit bab2b14f6299dd2fa8a7329ca4396f20b8d1a24e; Render deploy dep-dc4kkstbedkc73dne3s0. Runtime observation of future hourly cycles is still required; no guarantee of other failure modes.
- Deferred: partial-cohort execution and other retry categories until actual failures justify them; never relax proof or reuse stale data as fresh.

| UTC slot | Pair | TF | Anchors | Verified candles |
|---|---|---|---:|---:|
| 2026-11-25T02:00:00.000Z | ETHUSDT | 1h | 4 | 480 |
| 2026-11-25T18:00:00.000Z | ETHUSDT | 1h | 4 | 480 |
| 2026-11-25T19:00:00.000Z | BTCUSDT | 30m | 4 | 480 |
| 2026-11-25T19:00:00.000Z | ETHUSDT | 30m | 4 | 480 |
| 2026-11-26T00:00:00.000Z | ETHUSDT | 1h | 4 | 480 |
| 2026-11-26T04:00:00.000Z | 1000PEPEUSDT | 15m | 4 | 480 |
| 2026-11-26T06:00:00.000Z | ETHUSDT | 30m | 4 | 480 |
| 2026-11-26T06:00:00.000Z | 1000PEPEUSDT | 30m | 4 | 480 |
| 2026-11-26T10:00:00.000Z | HYPEUSDT | 30m | 4 | 480 |
| 2026-11-26T15:00:00.000Z | HYPEUSDT | 30m | 4 | 480 |
| 2026-11-26T15:00:00.000Z | 1000PEPEUSDT | 30m | 4 | 480 |
| 2026-11-26T16:00:00.000Z | SOLUSDT | 15m | 4 | 480 |
| 2026-11-27T02:00:00.000Z | ETHUSDT | 30m | 4 | 480 |

Source: [CI recovery validation](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/45972215654), [PG18 integration](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/45972215697).
