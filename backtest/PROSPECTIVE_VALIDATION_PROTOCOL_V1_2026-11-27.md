# Prospective validation protocol V1 — frozen 2026-11-27

**Operational readiness PASS, not independent performance validation.** Actual production PostgreSQL read-only inventory completed 2026-11-27T15:03:32.884175239Z. 25/25 contiguous and SHA-verified configurations, 3,130/3,130 closed bars from 2026-11-24 00:00 UTC to each timeframe's aligned 2026-11-27 14:00 UTC boundary. 325 variant-prefix checks and 975 simulation smoke cases on previously known training data; smoke performance intentionally not published. 17/17 CI tests ([run 46021339423](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/46021339423)).

Frozen code commit 776807fa87694ddda988420e7c064ba74588706b; original candidate source pin be19897265943f23e38bffe6f46fbbe770dc4624; API b3f0f9beb21dbf6618091a8fa5bd636386737a7c; Render dep-dc4pnc59el5s73br9qb0; cleanup API 8d780d1d3b5a0b9341eb6840d2ec8fc370e8ec6f.

## Preregistered forward window
- Start inclusive 2026-11-28 00:00 UTC (after protocol freeze).
- 30-day checkpoint exclusive 2026-12-28 00:00 UTC, descriptive only.
- 90-day initial final exclusive 2027-02-26 00:00 UTC. No tuning between checkpoints. If insufficient sample, report as such rather than pick winners; 30 completed trades minimum per variant/market/timeframe is a screening floor, not statistical significance.
- 480 verified preceding closed bars for indicator initialization; flat account at boundary, original archived priceStep; price tick changes would require separate documented protocol.
- Six original channels and seven candidates: Vector V3, Momentum V2, SPEED V2/V3, Cipher V2/V3, Frank divergence V3. Frank cross original only. Provisional alerts are research-only streams distinct from confirmed signals; not production replacements.
- Per configuration and variant, isolated 1x notional equity simulation; signal after close, next open entry, opposite reversal at next open, 12 complete bars maximum holding; ignore repetitions and ambiguous simultaneous opposing signals. Open at cutoff marked separately; no forced completed trade. Fees and slippage per side scenarios (0/0, 5/2.5, 10/5 bps). No actual funding, execution, liquidity, liquidation, leverage or shared portfolio model. No trading.
- 25×13×3 = 975 simulation scenarios per checkpoint; 325 prefix checks. Report metrics by symbol, timeframe, side, channel and version; never choose parameters using forward period and call it independent afterward.
- Executable runner modes inventory/checkpoint/final; future modes refuse early execution and fail on missing/hash-conflicting bars. Evaluation runs are not scheduled yet. Existing hourly data ingestion continues. A future evaluation must use the frozen code, preserve its output, and check data availability.

## Capacity and operational blocker
2026-11-27 14:55 UTC logical PG size 399,316,671 bytes; actual plan 1 GB, 0.1 CPU/256 MB. Existing history write guard is 70% of 1 GiB (751,619,276 bytes). Logical size is not physical disk usage. This capacity may be insufficient for continuous 30/90-day archive growth; verify physical disk and upgrade with user approval, align all capacity guards before expansion. No plan changes made. 09:05 EST hourly SOLUSDT 4h failed because a REST page expected 150 and returned zero (distinct from old anchor error); inventory has complete coverage through its fixed cutoff. Preserve strict validation, monitor new data continuity.

## Evidence
```json
{
  "pass": {
    "status": "PASS",
    "mode": "inventory",
    "pairs": 25,
    "ready": 25,
    "checks": 325,
    "simulations": 975,
    "variants": 13,
    "protocol": "CJ_PROSPECTIVE_VALIDATION_V1_20261127",
    "noTrading": true,
    "readOnly": true,
    "independentResults": false,
    "timestamp": "2026-11-27T15:03:32.884175239Z"
  },
  "inventory": [
    {
      "status": "INVENTORY",
      "symbol": "BTCUSDT",
      "timeframe": "15m",
      "expected": 344,
      "available": 344,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795787100000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:30.074827044Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "BTCUSDT",
      "timeframe": "30m",
      "expected": 172,
      "available": 172,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795786200000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:30.179297334Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "BTCUSDT",
      "timeframe": "1h",
      "expected": 86,
      "available": 86,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795784400000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:30.37376842Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "BTCUSDT",
      "timeframe": "4h",
      "expected": 21,
      "available": 21,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795766400000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:30.568060363Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "BTCUSDT",
      "timeframe": "1d",
      "expected": 3,
      "available": 3,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795651200000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:30.665806837Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "ETHUSDT",
      "timeframe": "15m",
      "expected": 344,
      "available": 344,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795787100000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:30.967445133Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "ETHUSDT",
      "timeframe": "30m",
      "expected": 172,
      "available": 172,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795786200000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:31.081210905Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "ETHUSDT",
      "timeframe": "1h",
      "expected": 86,
      "available": 86,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795784400000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:31.17390485Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "ETHUSDT",
      "timeframe": "4h",
      "expected": 21,
      "available": 21,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795766400000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:31.269546148Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "ETHUSDT",
      "timeframe": "1d",
      "expected": 3,
      "available": 3,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795651200000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:31.287045658Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "SOLUSDT",
      "timeframe": "15m",
      "expected": 344,
      "available": 344,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795787100000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:31.66902148Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "SOLUSDT",
      "timeframe": "30m",
      "expected": 172,
      "available": 172,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795786200000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:31.705584665Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "SOLUSDT",
      "timeframe": "1h",
      "expected": 86,
      "available": 86,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795784400000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:31.78819094Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "SOLUSDT",
      "timeframe": "4h",
      "expected": 21,
      "available": 21,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795766400000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:31.879340611Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "SOLUSDT",
      "timeframe": "1d",
      "expected": 3,
      "available": 3,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795651200000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:31.894720025Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "HYPEUSDT",
      "timeframe": "15m",
      "expected": 344,
      "available": 344,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795787100000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:32.070031235Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "HYPEUSDT",
      "timeframe": "30m",
      "expected": 172,
      "available": 172,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795786200000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:32.171578542Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "HYPEUSDT",
      "timeframe": "1h",
      "expected": 86,
      "available": 86,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795784400000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:32.199138361Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "HYPEUSDT",
      "timeframe": "4h",
      "expected": 21,
      "available": 21,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795766400000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:32.284729731Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "HYPEUSDT",
      "timeframe": "1d",
      "expected": 3,
      "available": 3,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795651200000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:32.367248465Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "1000PEPEUSDT",
      "timeframe": "15m",
      "expected": 344,
      "available": 344,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795787100000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:32.574942978Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "1000PEPEUSDT",
      "timeframe": "30m",
      "expected": 172,
      "available": 172,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795786200000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:32.671431345Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "1000PEPEUSDT",
      "timeframe": "1h",
      "expected": 86,
      "available": 86,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795784400000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:32.771238604Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "1000PEPEUSDT",
      "timeframe": "4h",
      "expected": 21,
      "available": 21,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795766400000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:32.868961648Z"
    },
    {
      "status": "INVENTORY",
      "symbol": "1000PEPEUSDT",
      "timeframe": "1d",
      "expected": 3,
      "available": 3,
      "verified": true,
      "reason": null,
      "first": "1795478400000",
      "last": "1795651200000",
      "smokeVariants": 13,
      "smokeSimulations": 39,
      "timestamp": "2026-11-27T15:03:32.883095385Z"
    }
  ]
}
```
