# CryptoJuju V1.26 — TradingView to Momentum Fusion webhook (DEV ONLY)

**Research prototype: NOT DEPLOYED and NOT connected to the TradingView account.**
Isolated from production CryptoJuju API, main, the public Render static preview and the locked Vector forward test. No trade execution functions, broker keys, or Bitunix order routes.

## Architecture

TradingView indicator (bridge/tradingview-momentum-readonly-alert.pine)
→ user-created alert (Any alert() function call, one chart per alert)
→ dedicated authenticated HTTPS POST /tv/momentum on isolated server
→ fsync-committed append-only NDJSON in durable storage
→ private read-only report: node bridge/tv-momentum-report.mjs /durable/path/alerts.ndjson

On EACH confirmed realtime candle, the Pine diagnostic sends original Momentum Fusion default values: RSI14, StochRSI14/SMA3, momentum(close,10), percentrank100, composite EMA3, EMA21/55, LONG/SHORT booleans and oscillator pivot-confirmation booleans. Also sent: same-chart OHLC, bar-open/bar-close Unix milliseconds, TradingView exchange:ticker and timeframe (15/30/60/240). It does NOT send account information or order instructions, and does NOT backfill history automatically.

## Private standalone webhook token

TradingView alert() webhooks cannot attach a custom authorization header. The receiver therefore requires a SINGLE-PURPOSE revocable webhook token in the JSON body, configured privately via a Pine input and the server-side CJ_TV_WEBHOOK_TOKEN environment variable. The token must be at least 32 random bytes (43+ base64url characters). The receiver never saves this token or prints it. Neither user nor ChatGPT should put credentials in the repository or in chat.

IMPORTANT: TradingView will store the alert payload and Pine inputs. A webhook-only token is a credential, although limited in scope. TradingView advises against sending sensitive passwords or login keys in webhook bodies or URLs. NEVER use a TradingView login password, Bitunix API key, GitHub personal token or broker credential. HTTPS-only; keep the dedicated token separate and revoke if leaked.

Generate a random dedicated token in your own private terminal:
    node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

Run isolated local diagnostics; DO NOT paste your actual token into messages:
    CJ_TV_WEBHOOK_TOKEN='<webhook-only token>' CJ_TV_WEBHOOK_STORE='/secure/durable/alerts.ndjson' PORT=3000 node bridge/tv-momentum-server.mjs

Default HOST is 127.0.0.1 (NOT reachable from TradingView); public deployment would require a separate HTTPS service and an actual persistent disk/database, plus configuring HOST=0.0.0.0. A normal Render free web service may have an EPHEMERAL filesystem and cannot be claimed to preserve alerts during redeploy/restart. Creating paid infrastructure requires the user's explicit consent; we have NOT created or billed anything.

## Security design

- Starts ONLY with both a strong dedicated token and an explicit store path.
- Fixed path/method, strict JSON schema and 8KiB maximum request size.
- Authorization checked before descriptive validation, using timing-safe SHA-256 digest comparison.
- Requires UTC-aligned CLOSED candle and delivery within 48h after close or at most 2min ahead of expected close.
- Requires sane OHLC, 7 numeric or null outputs, 4 booleans; excludes action/order fields and unexpected fields.
- Appends observed record without token, fsyncs before responding 202.
- Exact retries yield 200 DUPLICATE; conflicting same time/chart yields 409 and never overwrite. Replay suppression persists on restart.
- 503 on storage failure; no fake success; oversized/malformed/future/unauthorized payloads rejected.
- /healthz has no credentials or trading data. The endpoint has no public data read route.
- Optional extra defense: allowlist published TradingView IPs in a TRUSTED ingress firewall and update when TradingView changes its list. Do not trust incoming X-Forwarded-For as an authorization mechanism.
- NDJSON older than 50MB must be archived by operator; no silent truncation.

## Setup once separate private hosting is approved

1. Enable 2FA on TradingView. Webhooks may depend on plan/account availability.
2. Save bridge/tradingview-momentum-readonly-alert.pine as a NEW independent indicator, without replacing the original or Vector.
3. On each chosen chart (for example BTCUSDT 1H), enable its CLOSED-bar research alerts. Configure the dedicated token privately in indicator inputs. Never send me the token.
4. Create a new alert whose condition is the diagnostic script -> Any alert() function call, with the dedicated isolated HTTPS endpoint URL provided by hosting.
5. Confirm the TradingView alert log webhook status and receiver's private report. Start with one chart.
6. Recreate relevant alert snapshots after script/parameter changes and rotate the token if exposed.
7. Ensure persistent storage, backups and an actual scheduler for periodic reports; merely leaving a browser tab open is not background automation.

TradingView currently says: requests POST with application/json for valid JSON; requires HTTPS/ports 80 or 443; endpoint must respond within around 3s; delivery can fail occasionally; 2FA required. The server currently has not been exposed publicly or exercised from an actual TradingView account.

Official docs:
https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/
https://www.tradingview.com/support/solutions/43000722015-using-credentials-for-webhooks/
https://www.tradingview.com/pine-script-docs/concepts/alerts/

## Parity prerequisites

The parity report matches Pine and JS on the received TradingView OHLC only, after 200 CONTIGUOUS REALTIME alerts per chart and 150 discarded warmup bars. At 1h this needs ~8 days of uninterrupted bars. A CSV export from TradingView is the shorter route for historical crosschecks. Webhook deliveries that are missed require restarting clean warmup. Results are NOT profitability, a Bitunix feed parity certification, nor forecast accuracy.

## Files and no-deploy policy

- bridge/tv-momentum-core.mjs — strict input and timestamps.
- bridge/tv-momentum-server.mjs — standalone authenticated append-only local/test server.
- bridge/tv-momentum-report.mjs — grouped same-source math comparison, no network.
- bridge/tradingview-momentum-readonly-alert.pine — non-trading, closed-bar JSON source.
- bridge/tv-momentum.test.mjs — unit and localhost HTTP integration tests.
- .github/workflows/tradingview-momentum-webhook-bridge.yml — DEV-only testing, artifacts, no automatic deployment.

No main changes, no Render service changes, no CryptoJuju production API changes, no Vector changes. Actual live setup requires durable hosting and user configuration in TradingView.
