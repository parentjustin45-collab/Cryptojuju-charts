# Targeted indicator experiments V3 — 2026-11-27

**PASS** — actual read-only PostgreSQL research completed 10:51:50 UTC / 05:51:50 EST. 25 pairs, 150 comparisons, 300 causal prefix checks; 31/31 automated tests. Source be3385ba16cecd6138286b990b1ee7c34f138f1d; CI 45985365670; API ecc2bdf3c91e96dc45d9e2c997b917e9777e063e; Render dep-dc4m0odbedkc73dp5m30. Cleanup API commit a042084fb38186ac71bbc4c4bf66acb39d049110.

Fixed hypotheses on same 70% training sample and three chronological folds. 47,566 retrospective pivots; same-side ±3 bars one-to-one; outcomes next open to 12th close; hypothetical 10 bps round-trip. No independent validation or portfolio simulation.

| Channel | Original→V3 events | Coverage % | Match precision % | Gross mean bps | Net mean bps at 10 bps |
|---|---:|---:|---:|---:|---:|
| Vector | 25340→28407 | 28.19→31.28 | 53.06→52.51 | -0.46→-0.39 | -10.46→-10.39 |
| Momentum | 11004→11249 | 12.31→12.64 | 53.39→53.60 | -2.72→-2.19 | -12.72→-12.19 |
| SPEED | 75039→65132 | 43.43→42.97 | 27.61→31.47 | 1.49→0.94 | -8.51→-9.06 |
| Cipher | 65141→70520 | 67.78→74.15 | 49.68→50.21 | -0.43→-0.07 | -10.43→-10.07 |
| Frank cross | 11509→12599 | 12.54→14.11 | 52.07→53.50 | -5.00→-5.82 | -15.00→-15.82 |
| Frank divergence warning | 63221→58415 | 62.36→52.20 | 47.09→42.65 | -0.43→-0.07 | -10.43→-10.07 |

## Decisions
- Vector V3 improves coverage modestly without the V1 signal explosion; precision slightly declines and gross outcome improves two folds, not all. Keep research candidate only.
- Momentum V2 remains preferred to V3 on pooled training coverage, precision and gross outcome; both improve original on all three folds. Freeze V2 for independent validation.
- SPEED V3 preserves 98.94% of original matched pivot count and reduces redundant events 10060→6472 (35.7%); V2 removes more noise. Original gross outcome remains stronger. Keep optional visual experiment only.
- Cipher V3 20296/25672 evaluable warnings confirmed within two bars (79.06%), 5376 unconfirmed, four unresolved; V2 27021/34652 (77.98%), 7631 unconfirmed. V3 trades coverage for modest confirmation improvement; gross pooled better than V2 but not all folds. Preserve both warning candidates separately from original confirmed crosses.
- Frank provisional divergence V3 49875/58407 evaluable warnings confirmed at next candle with same type (85.39%), 8532 unconfirmed, eight unresolved; V2 63221/80831 (78.21%), 17610 unconfirmed. V3 cuts unconfirmed warnings by 51.55%, but loses 13346 confirmed warnings and coverage. Keep as optional selective warning, not replacement. Original confirmed divergence unchanged.
- Frank cross V3 gross deteriorates on all three folds. Keep original as reference, no promotion.
- All mean returns after hypothetical 10 bps remain negative. No profitability certification, no live orders. Reused training data, selection bias, overlapping events, no realistic portfolio or independent forward testing. No main, historical rows or original indicator changes.

## Next
Freeze shortlist and define independent chronological validation with fresh untouched data, realistic trading simulation and per-market/timeframe metrics; avoid unlimited optimization on same training sample. New data availability to verify first. No live deployment of candidate indicators without approval.

Evidence: [aggregate](research/experiments-v3-2026-11-27/aggregate.json), [BTC](research/experiments-v3-2026-11-27/BTCUSDT.json), [ETH](research/experiments-v3-2026-11-27/ETHUSDT.json), [SOL](research/experiments-v3-2026-11-27/SOLUSDT.json), [HYPE](research/experiments-v3-2026-11-27/HYPEUSDT.json), [1000PEPE](research/experiments-v3-2026-11-27/1000PEPEUSDT.json). All 150 archived; cumulative 425 comparisons and 850 prefix checks.
