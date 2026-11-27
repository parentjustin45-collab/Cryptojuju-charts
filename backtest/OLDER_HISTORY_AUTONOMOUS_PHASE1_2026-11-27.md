# Older history and autonomous research phase 1 — 2026-11-27

- Bitunix launchTime confirmed twice and public double-read boundary probes: 20/20 eligible pairs, 123,517 older bars targeted, 269 windows. HYPE has no pre-Nov-2024 listing history. No claim of five years of available Bitunix contracts; earlier alternate exchange data must remain separate. Probe CI 46028830992; raw evidence research/five-year-availability-2026-11-27.json.
- Collection uses a separate durable queue, up to 12 windows after hourly diagnostics (3 on startup), lease, up to 5 attempts, strict double-read and SHA, fixed listing boundaries, no overwrite of audited candles. Older period reserved for separate validation, not V4 training. The existing 617,151 baseline is unchanged. Combined target 740,668. Full merged multi-year replay is not implemented; 15m sequences exceed existing 80k-bar limit.
- Autonomous V4 queue: 150 fixed hypotheses across six channels and 25 configurations, one after hourly diagnostics plus bounded startup, persistent lease/retries, SHA-linked training-only evidence; compare against original with existing three chronological folds. No automatic promotion, no trades, no edits to main. Deterministic executor, not LLM-generated hypotheses or unlimited self-improvement. Queue stops once all registered jobs are terminal.
- Code 806eca3241c135920f6e972a3fd18cfb36432dd0, API 646823bb4daf506947207db3ca0fba8c26e0eccd, Render dep-dc4qg10473hc739v8ha0. CI 46029102647 (23/23), 46029102573 PG18, 46029102563 API, 46029102519 phase1 all passed.
- Actual startup: 441 verified older bars (BTC/ETH/SOL Daily, 147 each); first Vector BTC Daily V4 experiment completed and rejected/insufficient evidence, 2 prefix checks. No gaps in first batch. Existing 10GB budget and 7GB logical threshold retained. Forward protocol remains frozen.
- Next: monitor queue, verify merged chronology and source SHA after collection, implement chunked replay with parity before larger histories, develop evidence-driven hypothesis generation under strict resource/approval gates. No external model/API purchase made.

```json
[
  {
    "timestamp": "2026-11-27T15:56:11.826789589Z",
    "status": "OLDER_HISTORY_BATCH_COMPLETE",
    "attempted": 3,
    "inserted": 441,
    "verifiedBars": 441,
    "targetBars": 123517,
    "counts": [
      {
        "status": "PENDING",
        "windows": 266,
        "bars": 123076
      },
      {
        "status": "VERIFIED",
        "windows": 3,
        "bars": 441
      }
    ],
    "samples": [
      {
        "symbol": "BTCUSDT",
        "timeframe": "1d",
        "bars": 147,
        "inserted": 147,
        "status": "VERIFIED"
      },
      {
        "symbol": "ETHUSDT",
        "timeframe": "1d",
        "bars": 147,
        "inserted": 147,
        "status": "VERIFIED"
      },
      {
        "symbol": "SOLUSDT",
        "timeframe": "1d",
        "bars": 147,
        "inserted": 147,
        "status": "VERIFIED"
      }
    ],
    "noTrading": true,
    "reservedForIndependentEvaluation": true
  },
  {
    "timestamp": "2026-11-27T15:56:11.979880109Z",
    "status": "COMPLETED",
    "symbol": "BTCUSDT",
    "timeframe": "1d",
    "channel": "vector",
    "hypothesis": "V3 ATR-range exception 0.8 -> 1.2 ATR",
    "review": {
      "status": "RETAIN_BASELINE_OR_INSUFFICIENT_EVIDENCE",
      "base": {
        "events": 30,
        "matched": 16,
        "eligible": 29,
        "samples": 29,
        "precision": 0.5517241379310345,
        "meanGrossBps": -59.60307238708158
      },
      "candidate": {
        "events": 34,
        "matched": 15,
        "eligible": 32,
        "samples": 32,
        "precision": 0.46875,
        "meanGrossBps": -29.508122123832806
      },
      "foldWins": 1,
      "noPromotion": true,
      "independentValidation": false
    },
    "reportSha256": "10a5cefc0a25a12e855a2a87854245f2d262fb7aed5c1baa1524521909ba10d4",
    "prefixChecks": 2,
    "noTrading": true
  }
]
```
