# Independent Binance historical library — 2026-11-27

Scope: 1,775 USD-M archives, 1,280,806 targeted closed bars from 2021-11-24 to 2026-11-24, adjusted to actual listing dates. Separate cj_binance_um_* tables, no writes to Bitunix historical candle tables. Public archives, no authenticated trading or keys. Exact inventory plan, published checksum and boundary pin, strict ZIP/CSV continuity and OHLC, per-candle and sequence SHA, archive byte persistence and transactional readback. Durable lease with bounded retry and failure status, never overwrite existing candles. 10 GB configured database budget, logical guard 7 GB and memory guard. No main change.

Scheduling: six archives maximum every ten minutes at :07/:17/:27/:37/:47/:57 if no specialist completed and the supervisor is idle, three on startup. Bitunix extension and V4 schedule remain unchanged. A slow or busy cycle may defer collection; no throughput guarantee. 
Code 3eedc8841ede11480667abe942aa8e75a2d3fac2; CI 46036154086, 10/10 tests, actual public downloads and PostgreSQL18 integration passed (three archives, first two 57 candles; third continuity checked). Existing PG18, API and phase1 workflows passed.
API 35ac8b71a57e3f70accc7f9fca569d8ad9068456; deploy dep-dc4r79etlv9c738kvfig status: LIVE. Production receipts verified at 16:46:06 UTC: Binance 88 candles in 3 archives, Bitunix older history 1,592 candles (6 windows), second autonomous V4 experiment completed. No failed initial import. 

```json
[
  {
    "timestamp": "2026-11-27T16:46:03.685934686Z",
    "status": "OLDER_HISTORY_BATCH_COMPLETE",
    "attempted": 3,
    "inserted": 1151,
    "verifiedBars": 1592,
    "targetBars": 123517,
    "counts": [
      {
        "status": "VERIFIED",
        "windows": 6,
        "bars": 1592
      },
      {
        "status": "PENDING",
        "windows": 263,
        "bars": 121925
      }
    ],
    "samples": [
      {
        "symbol": "1000PEPEUSDT",
        "timeframe": "1d",
        "bars": 251,
        "inserted": 251,
        "status": "VERIFIED"
      },
      {
        "symbol": "BTCUSDT",
        "timeframe": "4h",
        "bars": 480,
        "inserted": 480,
        "status": "VERIFIED"
      },
      {
        "symbol": "BTCUSDT",
        "timeframe": "4h",
        "bars": 420,
        "inserted": 420,
        "status": "VERIFIED"
      }
    ],
    "noTrading": true,
    "reservedForIndependentEvaluation": true
  },
  {
    "timestamp": "2026-11-27T16:46:03.783996352Z",
    "status": "COMPLETED",
    "symbol": "BTCUSDT",
    "timeframe": "1d",
    "channel": "momentum",
    "hypothesis": "V3 EMA compression 0.5 -> 1 ATR",
    "review": {
      "status": "RETAIN_BASELINE_OR_INSUFFICIENT_EVIDENCE",
      "base": {
        "events": 13,
        "matched": 7,
        "eligible": 12,
        "samples": 12,
        "precision": 0.5833333333333334,
        "meanGrossBps": 126.51337119024997
      },
      "candidate": {
        "events": 13,
        "matched": 7,
        "eligible": 12,
        "samples": 12,
        "precision": 0.5833333333333334,
        "meanGrossBps": 126.51337119024997
      },
      "foldWins": 0,
      "noPromotion": true,
      "independentValidation": false
    },
    "reportSha256": "5a1f20eab76f42e2e9a156e07d7ab64682f2bc0789667ce0a045e9c5cc223328",
    "prefixChecks": 2,
    "noTrading": true
  },
  {
    "timestamp": "2026-11-27T16:46:06.523005998Z",
    "status": "BINANCE_BATCH_COMPLETE",
    "verifiedBars": 88,
    "verifiedArchives": 3,
    "targetBars": 1280806,
    "targetArchives": 1775,
    "counts": [
      {
        "status": "PENDING",
        "archives": 1772,
        "bars": 1280718
      },
      {
        "status": "VERIFIED",
        "archives": 3,
        "bars": 88
      }
    ],
    "results": [
      {
        "key": "data/futures/um/monthly/klines/1000PEPEUSDT/1d/1000PEPEUSDT-1d-2023-05.zip",
        "bars": 27,
        "status": "VERIFIED",
        "sha": "c8b057366929c1684f953d526661843eed349611f2c8d1fb63ea67f2bb2db2de"
      },
      {
        "key": "data/futures/um/monthly/klines/1000PEPEUSDT/1d/1000PEPEUSDT-1d-2023-06.zip",
        "bars": 30,
        "status": "VERIFIED",
        "sha": "ca4123cdde0b4200788e77e3bb25da875a1a1eb078392fc79d9d8ca27f07facd"
      },
      {
        "key": "data/futures/um/monthly/klines/1000PEPEUSDT/1d/1000PEPEUSDT-1d-2023-07.zip",
        "bars": 31,
        "status": "VERIFIED",
        "sha": "5142e0efa32f6a4a79c7b64c3c5705c62d8df9124d19a162ca6f6bf62a80866c"
      }
    ],
    "noTrading": true
  }
]
```
Next while collection proceeds: implement chunked replay parity (preserve recursive state, pivot confirmation, exact events, no look-ahead), source-specific reading and audits, then separate validation of frozen candidates on older unseen periods. Continue planning feedback and bounded hypothesis generation. Do not use newly reserved validation data for tuning. 
