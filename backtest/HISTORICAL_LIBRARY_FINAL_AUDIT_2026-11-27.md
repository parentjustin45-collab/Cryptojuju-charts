# CryptoJuju — Final historical library audit, 2026-11-27

**PASS — production PostgreSQL read-only verification.**

- Audit completed: 2026-11-27T08:55:11.084491974Z (03:55:11 EST).
- Render service: srv-da6ajk2jobas73bgodog; deployment dep-dc4kaemtlv9c738b8e8g, live 08:55:12 UTC.
- Audit code: 6e66461ea791efc1b387acfdf99bfcc0558307b6; API deployment commit 67e7e73844d71e8400e11eaf600578bbb4e77f07.
- 25/25 pairs; 617,151 closed candles; 125/125 indicator analyses; 360,092 signal events across six channels (Frank cross and divergence count as one indicator).
- Scope: 2024-11-24 inclusive to 2026-11-24 exclusive UTC, except HYPE verified listing-adjusted starts.
- Independent chronological reread from actual PostgreSQL, recomputed per-candle and sequence hashes, OHLC validation, archived gzip report integrity and report/sequence hash comparison to the 25 original logged receipts. Report structure and event fields validated; causal-prefix evidence checked, not a full fresh indicator recomputation.
- No external SQL access opened, no changes to historical rows, no market orders. Profitability is not certified; forward outcome measures exclude fees/slippage.
- Next: remove temporary startup audit hook; diagnose intermittent hourly Bitunix input rejection before independent indicator experiments. Preserve this immutable receipt baseline and original reports. Do not modify main.

| Pair | TF | Bars | Signal events | Prefix checks |
|---|---|---:|---:|---:|
| BTCUSDT | 15m | 70080 | 41257 | 4 |
| BTCUSDT | 30m | 35040 | 21025 | 4 |
| BTCUSDT | 1h | 17520 | 10740 | 4 |
| BTCUSDT | 4h | 4380 | 2662 | 4 |
| BTCUSDT | 1d | 730 | 385 | 4 |
| ETHUSDT | 15m | 70080 | 41128 | 4 |
| ETHUSDT | 30m | 35040 | 20851 | 4 |
| ETHUSDT | 1h | 17520 | 10381 | 4 |
| ETHUSDT | 4h | 4380 | 2617 | 4 |
| ETHUSDT | 1d | 730 | 400 | 4 |
| SOLUSDT | 15m | 70080 | 40074 | 4 |
| SOLUSDT | 30m | 35040 | 20435 | 4 |
| SOLUSDT | 1h | 17520 | 10321 | 4 |
| SOLUSDT | 4h | 4380 | 2598 | 4 |
| SOLUSDT | 1d | 730 | 367 | 4 |
| HYPEUSDT | 15m | 58237 | 33908 | 4 |
| HYPEUSDT | 30m | 29117 | 17345 | 4 |
| HYPEUSDT | 1h | 14557 | 8599 | 4 |
| HYPEUSDT | 4h | 3637 | 2130 | 4 |
| HYPEUSDT | 1d | 603 | 326 | 4 |
| 1000PEPEUSDT | 15m | 70080 | 39677 | 4 |
| 1000PEPEUSDT | 30m | 35040 | 20024 | 4 |
| 1000PEPEUSDT | 1h | 17520 | 10018 | 4 |
| 1000PEPEUSDT | 4h | 4380 | 2440 | 4 |
| 1000PEPEUSDT | 1d | 730 | 384 | 4 |

## Logged audit evidence

```json
{
  "completedAtUtc": "2026-11-27T08:55:11.084491974Z",
  "status": "PASS",
  "pairs": [
    {
      "status": "PAIR_VERIFIED",
      "symbol": "BTCUSDT",
      "timeframe": "15m",
      "bars": 70080,
      "sourceSequenceSha256": "0211b5127cc55833ef415af952fc231c79fd7a4f88ee901f7289ca12cfc7dcae",
      "reportSha256": "70cb2c4accc80c06731b896d295f04bd8fb86cd22aa2222fdd53c1110a5d95ba",
      "signals": 41257,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "BTCUSDT",
      "timeframe": "30m",
      "bars": 35040,
      "sourceSequenceSha256": "1a7494c8d66c02f3fb0234545f9ee0077881a7c145a4f387a7b14d820e04d846",
      "reportSha256": "8a59f5ae326a4ab67f1989fc14257c4e4006db7a55869ec0e01312138b47e6b6",
      "signals": 21025,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "BTCUSDT",
      "timeframe": "1h",
      "bars": 17520,
      "sourceSequenceSha256": "3ea831ea746015f415736a315e6dd41899ce4a46374a0b86f7108b85bdaddbba",
      "reportSha256": "c04778e00c9539bf0095ae3a914840ecb31780dc2fd49843fdc10ae36149cacc",
      "signals": 10740,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "BTCUSDT",
      "timeframe": "4h",
      "bars": 4380,
      "sourceSequenceSha256": "af5ed64478fe960440ace7ba3d182c318d408f66c5b23e7675114a55eb620402",
      "reportSha256": "ac1960cdc28c60745389b6cbe3e3ea8d4e5a0ee6688cfa51e70b0184f5611c04",
      "signals": 2662,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "BTCUSDT",
      "timeframe": "1d",
      "bars": 730,
      "sourceSequenceSha256": "3390353fb7d2c1521078f7a81018d98741e10e2339775304627a904628514cfb",
      "reportSha256": "a62da5cc4d6efd36053bd05701fd616e1167ca17115fbc2b1e2b8ded06beb620",
      "signals": 385,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "ETHUSDT",
      "timeframe": "15m",
      "bars": 70080,
      "sourceSequenceSha256": "f025e64bc4d2feb26a956a25273826b284e1b6780068e105bf78541d10a530f5",
      "reportSha256": "576f59eca30f35b2ae2c1777bfd8f2211124072bd05e8ef87b8979b6c3bf9ff6",
      "signals": 41128,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "ETHUSDT",
      "timeframe": "30m",
      "bars": 35040,
      "sourceSequenceSha256": "470b12d047336e7a8641e11876e642c4bc614a233df62373369e656fac732507",
      "reportSha256": "50521de877e88d21768ee98d8a3f6860e7eccaab987268ddcb9ce1e493897495",
      "signals": 20851,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "ETHUSDT",
      "timeframe": "1h",
      "bars": 17520,
      "sourceSequenceSha256": "6c30b7a31c368b4df04e3cedb11054d23ad66add6da6e2d862708e7db7722379",
      "reportSha256": "782e5680214232840cfecb6e619673eaa52f8ae222b76274647a6b74858f056f",
      "signals": 10381,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "ETHUSDT",
      "timeframe": "4h",
      "bars": 4380,
      "sourceSequenceSha256": "db9e0007f6cb9e2160bfb6e7f80028a65f6245424a42837ce1f75c5c00900476",
      "reportSha256": "c5b8c1a564cedd617ee8779b929868d176847a0945f346ec491fd1b64bf2c5c5",
      "signals": 2617,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "ETHUSDT",
      "timeframe": "1d",
      "bars": 730,
      "sourceSequenceSha256": "374a191312466e47969a6d23c3b82317df4a4b4851c9b24aff3f481acc5cb43d",
      "reportSha256": "43b109501bbaa633e4c9fffa67b7855e58befe488e15f224ba95832253e71f47",
      "signals": 400,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "SOLUSDT",
      "timeframe": "15m",
      "bars": 70080,
      "sourceSequenceSha256": "08c018aa55a57c11248152c45188aaa81b080ef78281365176f822d63d29ff9c",
      "reportSha256": "26bb131cb3717c3f891cb35ba8cbfde0a0764309747d9e9a3c58020a35b8c146",
      "signals": 40074,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "SOLUSDT",
      "timeframe": "30m",
      "bars": 35040,
      "sourceSequenceSha256": "6f10d1366c6d5c7530e30d78f82f27286376b503505739152f48225a78aced5f",
      "reportSha256": "b872a0266423cad30dc2f85df67d48885e8e308ae00fe6db28dbec76eeb7aab3",
      "signals": 20435,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "SOLUSDT",
      "timeframe": "1h",
      "bars": 17520,
      "sourceSequenceSha256": "4cd5b209f23f5483903e3835f3b743435ce2337a12b4b95ea280ba55857e8158",
      "reportSha256": "c680b42c4690460abee8afd48fac255842d4a1bc56b4e2b419b0b673ef1b4082",
      "signals": 10321,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "SOLUSDT",
      "timeframe": "4h",
      "bars": 4380,
      "sourceSequenceSha256": "114b332c6a600ce09849c590e20c6d97fdd196b1874b33676d354af83d9c35c9",
      "reportSha256": "241222b63489c0a234cd11cbb0854ab0314085aab061e7ed8365dc7686a8706f",
      "signals": 2598,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "SOLUSDT",
      "timeframe": "1d",
      "bars": 730,
      "sourceSequenceSha256": "500fbca5fae1e0e16385cec45797ce9e369a32c7e24341248feaa7f4d4f4503e",
      "reportSha256": "2c067b4be79ceb7ecb48a0516e65cb93adbc31920392775eb6d2ee44a6eef1b9",
      "signals": 367,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "HYPEUSDT",
      "timeframe": "15m",
      "bars": 58237,
      "sourceSequenceSha256": "9ef46ecadf2f0bbd9e4c5e703f97860e93d5371db3689895ab3f93cdbd4b4517",
      "reportSha256": "38ee12b814d90bb50850c10979b4e955143a760cc0fcbf00685d0996a4264aae",
      "signals": 33908,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "HYPEUSDT",
      "timeframe": "30m",
      "bars": 29117,
      "sourceSequenceSha256": "d9366bb771536ec2f33faf79a53d967603e03f880f1e40bfdfefc27c288accb2",
      "reportSha256": "f8f43e0017db8869a6f1510e3f7f08d6bb573f250449a836becc78f94cc198d1",
      "signals": 17345,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "HYPEUSDT",
      "timeframe": "1h",
      "bars": 14557,
      "sourceSequenceSha256": "0a1a934d853f50f015007d2cccdd6e37ef58783712fa36db797bab22334de2bb",
      "reportSha256": "ee1be497eeb448b8e4811bbd9931711b7f3b4523e478eaf4af846380e1c705a8",
      "signals": 8599,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "HYPEUSDT",
      "timeframe": "4h",
      "bars": 3637,
      "sourceSequenceSha256": "14096141dde0acadf1d0baec2c16266094c6dc1f1eb6df1c2e4b6ef1ba888805",
      "reportSha256": "4d8daa2e88bfc297568ea68b7ce10aa77157a30717bd987fa13baa51dfb78594",
      "signals": 2130,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "HYPEUSDT",
      "timeframe": "1d",
      "bars": 603,
      "sourceSequenceSha256": "ddc234922445601a87fa870ad7d56753ae8fe8f08622c023ef32196246aa5b84",
      "reportSha256": "a0272da6eb1c7405cdb251a711eb7ed6d84ab3392857c140eff61eb9a52f5ef1",
      "signals": 326,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "1000PEPEUSDT",
      "timeframe": "15m",
      "bars": 70080,
      "sourceSequenceSha256": "333500ba5075521e9cb3a213b169bb1b769fa14113d10831d2e2f6ba718199bf",
      "reportSha256": "ab7fb9e16d0eb3f2b148a18cda0d92f0c027f71d7153302e6d85beca2137fd19",
      "signals": 39677,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "1000PEPEUSDT",
      "timeframe": "30m",
      "bars": 35040,
      "sourceSequenceSha256": "3d22ee996894189b7d507d1b483753bbdddf435885a4323d954be64e699333c9",
      "reportSha256": "81c54ac8daf3215acd14a1992d32aa16070f661073da6401a2441e87ca1f77b7",
      "signals": 20024,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "1000PEPEUSDT",
      "timeframe": "1h",
      "bars": 17520,
      "sourceSequenceSha256": "2c2bf1a44709a41ea107d6a45f4f7b4ff9c94624b8530c40f0c442bc9b36bd05",
      "reportSha256": "3162da2a0eb922539e072a1a73ec2cfca7ae01d22591fc766cfc5a72f1a964b4",
      "signals": 10018,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "1000PEPEUSDT",
      "timeframe": "4h",
      "bars": 4380,
      "sourceSequenceSha256": "4eca585a0b0ff34c0ad2e2ac30c634102f4d80cf4ff45fc260489950b1d86d2e",
      "reportSha256": "455aba254baa3aa9543057f76eee761f5ceb8155e50122708224238c2b17554c",
      "signals": 2440,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    },
    {
      "status": "PAIR_VERIFIED",
      "symbol": "1000PEPEUSDT",
      "timeframe": "1d",
      "bars": 730,
      "sourceSequenceSha256": "7f3b4b2945a5603df58c1113524879633960eb3cb87fe1ba07b5420ba40866c8",
      "reportSha256": "1c5049c0da4a9a6ee7fb9fab8cf2bc61ec780b7d0eccc14d814c724570b77846",
      "signals": 384,
      "causalPrefixChecks": 4,
      "analysisCount": 5
    }
  ],
  "bars": 617151,
  "analyses": 125,
  "signals": 360092,
  "readOnly": true,
  "noTrading": true,
  "scope": "chronology, OHLC, per-candle hashes, sequence hashes, archived report hashes and content; no profitability certification"
}
```
