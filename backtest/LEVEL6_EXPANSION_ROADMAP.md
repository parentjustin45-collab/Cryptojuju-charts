# CryptoJuju Level 6 — Expansion and quantitative research

## 6.1 — Admission of five additional Bitunix markets

Baseline: immutable 2026-11-27 final audit (BTC, ETH, SOL, HYPE, 1000PEPE; 25 market/timeframe pairs, 617151 candles, 125 indicator analyses). Preserve existing research and reports.

Candidates (not admitted): BNBUSDT, XRPUSDT, DOGEUSDT, ADAUSDT, AVAXUSDT. Same 2024-11-24 inclusive / 2026-11-24 exclusive UTC target, adjusted only for independently verified contract listing dates plus three full aligned anchor candles. Priority Daily, 4h, 1h, 30m, 15m. Maximum 638750 additional bars.

Preflight implementation: level6-expansion-plan.mjs and unit tests. Read-only; validates two official metadata reads, baseline archived pair count, capacity guard, and a completed Level 5.5 refinement receipt. Candidate admission still requires actual metadata preflight, capacity projection (including outstanding Binance archive ingestion), double-read candle proof, immutable archive and full causal replay. Do not simply enlarge FIVE_CASES: it is an audited baseline used by other agents and tests. Introduce a separate approved expansion cohort; use the existing verified ingestion and replay primitives with explicit scope, persistent progress and resource limits. No ingestion yet.

## Subsequent roadmap

- 6.2: independently verified Bitunix and Binance studies; no pooling without source provenance.
- 6.3: extend causal structured feature grammar (RSI, EMA, ATR, WaveTrend, indicator-specific features) and resource-tested intraday diagnostics.
- 6.4: cross-agent confluence research only after individual baseline verification.
- 6.5: independent validation, fee/slippage assumptions, reproducibility and multiple-testing controls before any proposed promotion.
- 6.6: priority scheduler, compute and spending guardrails, human-reviewed promotion.

No production indicator edits, no live orders, no main changes, no budget increase. Level 5.5 first real feedback execution must be verified before enabling expansion history collection. Current state: preparation in DEV only; no Render restart requested.
