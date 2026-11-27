# Evidence-driven adaptive research V1 — 2026-11-27

Production activation verified 2026-11-27T17:26:52.83354519Z. First autonomous follow-up completed on BTCUSDT 1d Vector: V4 ATR-range threshold 1.2 -> 1.05 selected because matched pivots decreased 6.25% versus original. Precision also fell 8.30 percentage points; gross mean improved 30.09 bps, one fold win, 32 eligible events. Follow-up did not change matched count, precision or mean gross outcome versus V4. Decision retain original, archive counterevidence. Two prefix checks passed.

Code a7111cc18c41eae06b36e75e5e412badc9b534dc; API ceab3223418b74de30987770d73ec357cbcc9275; Render dep-dc4rqg6tlv9c738ltci0 live. CI 46041740032 21/21, existing queue, API, PG18 and phase1 passed. Prior V4 default preserved and parent results replayed exactly before each follow-up. Durable unique parent identifier, hashes, leases, max three attempts, storage and memory guards, one new hypothesis per V4 parent (maximum 150), one execution per idle :01 hourly tick plus bounded startup. Six research channels under five indicator specialties; no separate new agent per exchange. Rules select stricter/looser thresholds from predefined finite allowlist based on measured precision, pivot matches, gross horizon results and warning confirmation. Insufficient samples stored as SKIPPED. No automatic promotion, no external model, no paid calls, no main changes, no live orders. This is deterministic evidence-driven adaptation, not LLM inference or unlimited iterative self-improvement. Historical Binance data stays isolated until source audit and evaluation policy; no older Bitunix or forward validation data used for tuning. Future phase: explicit model adapter and bounded hypothesis review, cross-exchange evaluation with independent source identity. No profitability claims.

```json
[
  {
    "timestamp": "2026-11-27T17:26:50.194371652Z",
    "status": "OLDER_HISTORY_BATCH_COMPLETE",
    "attempted": 3,
    "inserted": 1440,
    "verifiedBars": 13575,
    "targetBars": 123517,
    "counts": [
      {
        "status": "VERIFIED",
        "windows": 33,
        "bars": 13575
      },
      {
        "status": "PENDING",
        "windows": 236,
        "bars": 109942
      }
    ],
    "samples": [
      {
        "symbol": "SOLUSDT",
        "timeframe": "1h",
        "bars": 480,
        "inserted": 480,
        "status": "VERIFIED"
      },
      {
        "symbol": "SOLUSDT",
        "timeframe": "1h",
        "bars": 480,
        "inserted": 480,
        "status": "VERIFIED"
      },
      {
        "symbol": "SOLUSDT",
        "timeframe": "1h",
        "bars": 480,
        "inserted": 480,
        "status": "VERIFIED"
      }
    ],
    "noTrading": true,
    "reservedForIndependentEvaluation": true
  },
  {
    "timestamp": "2026-11-27T17:26:50.302361639Z",
    "status": "COMPLETED",
    "symbol": "ETHUSDT",
    "timeframe": "1d",
    "channel": "momentum",
    "hypothesis": "V3 EMA compression 0.5 -> 1 ATR",
    "review": {
      "status": "RETAIN_BASELINE_OR_INSUFFICIENT_EVIDENCE",
      "base": {
        "events": 13,
        "matched": 4,
        "eligible": 12,
        "samples": 12,
        "precision": 0.3333333333333333,
        "meanGrossBps": 222.32834010790782
      },
      "candidate": {
        "events": 14,
        "matched": 5,
        "eligible": 13,
        "samples": 13,
        "precision": 0.38461538461538464,
        "meanGrossBps": 236.55239925137556
      },
      "foldWins": 1,
      "noPromotion": true,
      "independentValidation": false
    },
    "reportSha256": "da9878d25804e2089c94b05e6f7e55825b14aaac509da5f6e5be9c6aaf827645",
    "prefixChecks": 2,
    "noTrading": true
  },
  {
    "timestamp": "2026-11-27T17:26:52.709647977Z",
    "status": "BINANCE_BATCH_COMPLETE",
    "verifiedBars": 1276,
    "verifiedArchives": 42,
    "targetBars": 1280806,
    "targetArchives": 1775,
    "counts": [
      {
        "status": "VERIFIED",
        "archives": 42,
        "bars": 1276
      },
      {
        "status": "PENDING",
        "archives": 1733,
        "bars": 1279530
      }
    ],
    "results": [
      {
        "key": "data/futures/um/monthly/klines/1000PEPEUSDT/1d/1000PEPEUSDT-1d-2026-08.zip",
        "bars": 31,
        "status": "VERIFIED",
        "sha": "ddaf6d97f148f7369104036500dfcb68f1f9d5db549a6f46d6d503a57481773c"
      },
      {
        "key": "data/futures/um/monthly/klines/1000PEPEUSDT/1d/1000PEPEUSDT-1d-2026-09.zip",
        "bars": 30,
        "status": "VERIFIED",
        "sha": "81c70d764322e2efd791e91067b082599f41130ad2138e6f9b2b0d0de13e9395"
      },
      {
        "key": "data/futures/um/monthly/klines/1000PEPEUSDT/1d/1000PEPEUSDT-1d-2026-10.zip",
        "bars": 31,
        "status": "VERIFIED",
        "sha": "23c2eab67c6787eb10edc91be38cb4cd6dec3e7a760a53d9e55ab0bf50ccba9c"
      }
    ],
    "noTrading": true
  },
  {
    "timestamp": "2026-11-27T17:26:52.83354519Z",
    "status": "COMPLETED",
    "source": "Bitunix",
    "symbol": "BTCUSDT",
    "timeframe": "1d",
    "channel": "vector",
    "proposal": {
      "status": "HYPOTHESIS",
      "channel": "vector",
      "source": "Bitunix",
      "anchor": 1.2,
      "threshold": 1.05,
      "direction": "looser",
      "reason": "PIVOT_COVERAGE_LOSS",
      "evidence": {
        "precisionDelta": -0.08297413793103448,
        "matchDelta": -0.0625,
        "grossDelta": 30.094950263248776,
        "warningRate": null,
        "foldWins": 1,
        "samples": 32
      },
      "holdoutUsed": false,
      "noPromotion": true
    },
    "delta": {
      "matched": 0,
      "precision": 0,
      "grossBps": 0
    },
    "decision": "RETAIN_ORIGINAL_AND_ARCHIVE_COUNTEREVIDENCE",
    "reportSha256": "6b0c1f41bee6afe9c47b624e67377f660d24af422076d35b90c4ac35b38880d2",
    "prefixChecks": 2,
    "noTrading": true
  }
]
```
