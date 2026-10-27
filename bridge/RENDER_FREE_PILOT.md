# Isolated TradingView Momentum webhook — FREE Render pilot

**Not a production 24/7 system.** Branch dev/v1.26.0; production CryptoJuju main/API, Vector prospective and WATCH static site unchanged.

Pilot architecture:
- A separate Render FREE Node web service starts bridge/tv-momentum-render.mjs.
- A separate Render FREE Postgres database stores JSON observations with UNIQUE event IDs and immutable fingerprints (conflicts return 409).
- The server requires environment variables CJ_TV_WEBHOOK_TOKEN (secret 32+ random bytes) and DATABASE_URL (Render Postgres INTERNAL connection string).
- If either is missing, GET /healthz and POST /tv/momentum return **503 NOT_CONFIGURED** and **no data are accepted**.
- Authenticated requests are validated on OHLC, symbol, closed timestamps, exact Momentum version and 11 diagnostic fields.
- A 202 means database commit accepted; 200 means duplicate; 409 means conflicting observation. Database failure returns 503, not fake success.
- All report calculations compare original Pine and JS on the same TradingView OHLC. No exchange orders or trading keys.

**Free-tier caveats:** A FREE Render web service sleeps after idle and can require ~1 minute to resume, whereas TradingView webhook timeouts are about 3 seconds; initial calls can FAIL. FREE Postgres expires in 30 days. This is only a connection/payload pilot, NOT safe unattended monitoring. Quotas may cause additional bandwidth/billing under workspace terms. No paid service was authorized or created.

Operating steps:
1. In Render Dashboard, retrieve the **internal database URL** for DB "cryptojuju-tv-momentum-pilot-db".
2. Go to the separate web service "cryptojuju-tv-momentum-pilot" > Environment, set DATABASE_URL = internal URL, keep CJ_TV_WEBHOOK_TOKEN private; restart/redeploy the free web service.
3. When GET /healthz returns {"status":"READY"}, copy bridge/tradingview-momentum-readonly-alert.pine as a NEW independent Pine indicator in TradingView. Do not modify Vector or original Momentum.
4. Insert the webhook-only token in its input, activate Enable CLOSED bar audit alerts, create a TradingView alert with Any alert() function call and webhook URL https://cryptojuju-tv-momentum-pilot.onrender.com/tv/momentum. 2FA required.
5. Verify actual HTTP alert delivery status in TradingView. A 503 or timeout is **not** successful delivery; no simulated gains. Never put your TradingView login or API keys in the alert.

Links:
- https://render.com/docs/free
- https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/
No permanent storage beyond the free database expiry; back up or upgrade only with explicit user approval.
