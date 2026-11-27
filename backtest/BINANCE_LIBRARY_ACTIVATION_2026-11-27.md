# Independent Binance historical library — 2026-11-27

Scope: 1,775 USD-M archives, 1,280,806 targeted closed bars from 2021-11-24 to 2026-11-24, adjusted to actual listing dates. Separate cj_binance_um_* tables, no writes to Bitunix historical candle tables. Public archives, no authenticated trading or keys. Exact inventory plan, published checksum and boundary pin, strict ZIP/CSV continuity and OHLC, per-candle and sequence SHA, archive byte persistence and transactional readback. Durable lease with bounded retry and failure status, never overwrite existing candles. 10 GB configured database budget, logical guard 7 GB and memory guard. No main change.

Scheduling: six archives maximum every ten minutes at :07/:17/:27/:37/:47/:57 if no specialist completed and the supervisor is idle, three on startup. Bitunix extension and V4 schedule remain unchanged. A slow or busy cycle may defer collection; no throughput guarantee. 
Code 3eedc8841ede11480667abe942aa8e75a2d3fac2; CI 46036154086, 10/10 tests, actual public downloads and PostgreSQL18 integration passed (three archives, first two 57 candles; third continuity checked). Existing PG18, API and phase1 workflows passed.
API 35ac8b71a57e3f70accc7f9fca569d8ad9068456; deploy dep-dc4r79etlv9c738kvfig status at last check: update_in_progress. Production import receipt not yet observed; do not count test DB candles as production.
```json
[]
```
Next while collection proceeds: implement chunked replay parity (preserve recursive state, pivot confirmation, exact events, no look-ahead), source-specific reading and audits, then separate validation of frozen candidates on older unseen periods. Continue planning feedback and bounded hypothesis generation. Do not use newly reserved validation data for tuning. 
