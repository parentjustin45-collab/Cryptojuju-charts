# Stateful streaming replay V1 — 2026-11-27

**PASS: exact original event parity on all 25 archived Bitunix configurations, 617,151 candles and 360,092 events across six channels (150 comparisons).** Real production read-only PostgreSQL audit completed 2026-11-27T16:53:32.641598513Z. Each input candle SHA and complete sequence SHA checked; archived report gzip SHA checked; event counts and ordered event hashes identical. Independent Binance reader checked 27 actually imported 1000PEPE daily bars; diagnostic price step only, no performance claim.

Streaming keeps bounded 20-bar price and volume windows, 100 momentum values, Wilder ATR, recursive RSI/EMA, Frank confirmed pivot history and Vector direction/entry across input pages. No reinitialization at page boundaries. Original algorithms unchanged. CI 46037169695: 3/3 tests, 175,296 synthetic bars (five years 15m) in two page layouts with exact event hashes versus original full-array algorithms; the fixture has zero Vector, Momentum and Frank cross events, so real parity is essential. Short synthetic fixture also checks exact internal numeric values; SQL mock checks source separation and rejects gaps. Real audit covers all six channels. Existing PG18, API, phase1 CI passed.

Code 12b20104a6d8f2bac208088ae9068a337e4579ed; audit f501cc81a8819f2e5e4014977fda545a41496cfb; API 4c0cff5ef2909b61e4ab9b41171651106f6aa313, Render dep-dc4rao3rjlhs7388ck0g, cleanup API 768cac542cd4ef7cc6b4af72323df2ac8727dccd.

Limitations: original event engine only; not yet streaming experimental candidates, transaction simulator, persistence of intermediate state across process restart, multi-year performance reports or final complete Binance data audit. Source reader processes bounded SQL pages; 2 million bar configured upper safety bound is not a tested capacity. No modification of main or original algorithms, no historical data writes by audit, no orders. Existing collectors stay enabled. Next: source-level archive audit and frozen candidates/simulator parity; bounded hypothesis automation without touching independent evaluation periods.

```json
[
  {
    "status": "PAIR",
    "symbol": "BTCUSDT",
    "timeframe": "15m",
    "bars": 70080,
    "counts": {
      "vector": 4229,
      "momentum": 1839,
      "speed": 12593,
      "cipher": 10636,
      "frank_cross": 1663,
      "frank_divergence": 10297
    },
    "eventSha256": {
      "vector": "bb305c73af4bbdcbb7ffde7d7dcbd26d42ac5018b32bee930d66de8a5e358154",
      "momentum": "1cae8a3ddcbb0f3ad8069fdc0e3f32572a26d1bae7d94534a381bd4651ea6578",
      "speed": "076774eecb74459a4731ce0e3caca86e638de506278891a2bc161b9080ca4526",
      "cipher": "489d1ea946151bbfff02085733e9c63459b3dd5daa18d343b94eb0a496fda92b",
      "frank_cross": "afcf8cbfe36e78f9d7baa7899d1f2564f3d8423da4529574278622f69424daa8",
      "frank_divergence": "dd8f158c402fe6f8b64592a6a2cf46cd2097320f34385562e98a59e0f7228cf5"
    },
    "pages": 71,
    "timestamp": "2026-11-27T16:53:12.912271307Z"
  },
  {
    "status": "PAIR",
    "symbol": "BTCUSDT",
    "timeframe": "30m",
    "bars": 35040,
    "counts": {
      "vector": 2124,
      "momentum": 873,
      "speed": 6637,
      "cipher": 5280,
      "frank_cross": 876,
      "frank_divergence": 5235
    },
    "eventSha256": {
      "vector": "e78edded83de50f90a7d71ce9e7d4390961a17e8ef1732536af243cbab747b72",
      "momentum": "50ebeea207d48d6ffc2098518517f64c4141486508a667606b9a4a571da9ee76",
      "speed": "4ac38194e70bacc38921e280a91542c2bca0b6469b5d961d1ba874da77318c44",
      "cipher": "30e0a0d48c50b1ae1c0143dd91a7761711fdc78a5a6febd9c0baff75ab9810e7",
      "frank_cross": "2d3976bfd38f48b5ff61af4f08eef2c88ca0f7ab6e75d708051b5532ac146619",
      "frank_divergence": "52fd5eb49f64eadd6afe275011c5e45a7d096396ac1ff2579a8a1330b3ead449"
    },
    "pages": 36,
    "timestamp": "2026-11-27T16:53:14.578945838Z"
  },
  {
    "status": "PAIR",
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "bars": 17520,
    "counts": {
      "vector": 1114,
      "momentum": 453,
      "speed": 3432,
      "cipher": 2595,
      "frank_cross": 477,
      "frank_divergence": 2669
    },
    "eventSha256": {
      "vector": "61a08d7f3c9a44056ed6479b1163b8f132be02d7784c43ab6ec56cc792c775b3",
      "momentum": "6de4f05e287f21c7c764df1e209deb29d7517a075bc10a90271fd9dae667b1d0",
      "speed": "106d05f6b53204fb6a9819556ecb3da5278e67b934a95aef518ace3ca647dc7d",
      "cipher": "8e0905830c620ece1d104d20081182293dda0b96f79a1901fe9105c415644fbe",
      "frank_cross": "bf17b08c4c576f8e522bb0a7cb1508486d8eb9607b26458c3aebd58fd33f832f",
      "frank_divergence": "cb5f80be0d8645e70ba89392713a2ae87fd30165a555bc1e01b8482c62c92ad6"
    },
    "pages": 18,
    "timestamp": "2026-11-27T16:53:15.396752455Z"
  },
  {
    "status": "PAIR",
    "symbol": "BTCUSDT",
    "timeframe": "4h",
    "bars": 4380,
    "counts": {
      "vector": 273,
      "momentum": 99,
      "speed": 864,
      "cipher": 647,
      "frank_cross": 112,
      "frank_divergence": 667
    },
    "eventSha256": {
      "vector": "a09e47b25f72aff728f08bc96f70ea57f271039b12e2241e0c4b720ca508557b",
      "momentum": "6b39db684cab7f550b064462a5860024ee7bd5bca4c893b688daa1bf79251139",
      "speed": "d33afc2f9aa78da892d92e725b295e9c1db3927290bd737a1b44324d5f1f3886",
      "cipher": "3ea96e03de3399e96eacf59d57ff2439cbc71b91456fa529658d604a2b811613",
      "frank_cross": "18abb4ceae8fd3d64bb43e249bb4d94c2654b7f9847eaeef59abcae87e7253d8",
      "frank_divergence": "a8db7f7ebe11e7418ae43035be3cfc1d0f0582e71fbf32f072c29915546dfc4c"
    },
    "pages": 5,
    "timestamp": "2026-11-27T16:53:15.582988864Z"
  },
  {
    "status": "PAIR",
    "symbol": "BTCUSDT",
    "timeframe": "1d",
    "bars": 730,
    "counts": {
      "vector": 41,
      "momentum": 21,
      "speed": 90,
      "cipher": 101,
      "frank_cross": 24,
      "frank_divergence": 108
    },
    "eventSha256": {
      "vector": "438f53d4682f5bf5e7270be26cbe22a0aa9fb6eadc949610684db5d90aaeac08",
      "momentum": "27c94996625633287eb8168ed0350b7a703fa89e49821f535197ee6fe2a58992",
      "speed": "0537b188d2dfaac679f215ff3f4c5b4e0f563a18cb23214105bdf1414e1a51ce",
      "cipher": "5192a99c2e962e89c2485a56f0842d0a6a27bcc71bf1915b34f2cb0a455cfbce",
      "frank_cross": "d8f7a78916fdd8e5ad35e680726c45207e8d3b15c2caef88b9e8765b75772711",
      "frank_divergence": "66ba9555a8d48182fc279752a976d67c509b41ae1b03af8db698546cadc4c31d"
    },
    "pages": 1,
    "timestamp": "2026-11-27T16:53:15.595500137Z"
  },
  {
    "status": "PAIR",
    "symbol": "ETHUSDT",
    "timeframe": "15m",
    "bars": 70080,
    "counts": {
      "vector": 3935,
      "momentum": 1747,
      "speed": 12357,
      "cipher": 10773,
      "frank_cross": 1749,
      "frank_divergence": 10567
    },
    "eventSha256": {
      "vector": "7ad5d48064d3ac153a4e51d29ed6974bda354b2df1fccfa088375035c613d3aa",
      "momentum": "432e9b2b4b4f6d0ec5e73e4dd96b838ab80e999a2134926b0ffdea25c3f6e96b",
      "speed": "e7a8a475e79395fac4f700b72e9af2ca0a227432374d9c7c879d45cd197bbf2c",
      "cipher": "ca2ea400dd4fc50f4b2f13e558d9b8967dd304b681eca1d7849e1ab1bba1a9bd",
      "frank_cross": "26666cc41c8c3ecbc045bfe20b628c91409f1d48a359bb418d33ae116975b508",
      "frank_divergence": "16e37167daa859503a4e63714e37933ebbd42049ec4de82244489259536dd513"
    },
    "pages": 71,
    "timestamp": "2026-11-27T16:53:18.167136179Z"
  },
  {
    "status": "PAIR",
    "symbol": "ETHUSDT",
    "timeframe": "30m",
    "bars": 35040,
    "counts": {
      "vector": 1937,
      "momentum": 893,
      "speed": 6472,
      "cipher": 5339,
      "frank_cross": 905,
      "frank_divergence": 5305
    },
    "eventSha256": {
      "vector": "a50e6757e9df04ed64675e11f627fc97580880e373b790c0f9742d2f97013692",
      "momentum": "8d8c07081722b3b6de02fc46fd7406c15b48c3823970828d92f1e7384890bd8b",
      "speed": "5a89d61a52a7f925fd01a3922787daebab59889d358fcb5f0f8a463e1df1a020",
      "cipher": "d6fe6a31a371aad3976cdd0d5d0de74c2ce3a66c022d6e19eaf141e2f1fc757d",
      "frank_cross": "38a288e1df4eacfcdf66fdbcb8f14ea0f4369e3bd885fc175f272451e3b866e9",
      "frank_divergence": "24f7c16f25f6699f5cd07713fc6fa8f6996f961ff1bc5f5e94335ea72038106d"
    },
    "pages": 36,
    "timestamp": "2026-11-27T16:53:19.328624596Z"
  },
  {
    "status": "PAIR",
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "bars": 17520,
    "counts": {
      "vector": 946,
      "momentum": 414,
      "speed": 3293,
      "cipher": 2559,
      "frank_cross": 478,
      "frank_divergence": 2691
    },
    "eventSha256": {
      "vector": "42d78f957fb620b1ebcb306008c9d841eee8b94c1c23b356edb4055cb95afbf5",
      "momentum": "ddcb322f4d3a2b59b878fc9356047e4e7ccfba94d1de5af0a9e563c7699b4423",
      "speed": "38e78febc0d710341cf74aa760ab719e8b4f951ecd425cedee711eab8b54ff5f",
      "cipher": "3c51e13ae4a50e3d2fa95befea39ea57108c6c3409e470b5734fa18c7c546119",
      "frank_cross": "9e173c2142c8fe951ad7cfc66c6e969d3cbac02e0e237e4972525fff4a5b197a",
      "frank_divergence": "bf4c46321ae106d33667b7bf6eedce2219cd146557340feb87db1d05ad449099"
    },
    "pages": 18,
    "timestamp": "2026-11-27T16:53:19.906893055Z"
  },
  {
    "status": "PAIR",
    "symbol": "ETHUSDT",
    "timeframe": "4h",
    "bars": 4380,
    "counts": {
      "vector": 253,
      "momentum": 104,
      "speed": 811,
      "cipher": 653,
      "frank_cross": 135,
      "frank_divergence": 661
    },
    "eventSha256": {
      "vector": "4bc9b436fca6d7bb290caef48fcb5fed1ec18a4b5b95df2f8af431153e17ceb3",
      "momentum": "2b0c67066fbdfb9368c3197c3386e4274bdf2b4152748161fe1c35594e2afec4",
      "speed": "0105b41a4c6efb19de59e9b1747e2807e59b62dffe3539b83353a90cdea9030c",
      "cipher": "2ae19d7e6dba61fb3b463bdf7260f65c849bdb059f3f9b18cf8c7375afbcfbae",
      "frank_cross": "2e8a4e938f6d1c3bcab7439678ce2e3047c8b69814b701f1077e626c1f221722",
      "frank_divergence": "811e9cde9cf394cb4d48b49ab15485b89041689fa7e036ff69238379dfa84d5f"
    },
    "pages": 5,
    "timestamp": "2026-11-27T16:53:20.030791905Z"
  },
  {
    "status": "PAIR",
    "symbol": "ETHUSDT",
    "timeframe": "1d",
    "bars": 730,
    "counts": {
      "vector": 49,
      "momentum": 17,
      "speed": 83,
      "cipher": 110,
      "frank_cross": 26,
      "frank_divergence": 115
    },
    "eventSha256": {
      "vector": "c8d9d6ed433a933df384cfe86a2e87481e2dce31a507d0cac8f0b9d8cbdd3366",
      "momentum": "dcd7a0d9924168ffd5d6567f71782393bc2de6a6888df4951b9cc6e37df90433",
      "speed": "936166d01e1e5c32c6200326acfb867179f5ec462c3ca14f118739da7e473d1b",
      "cipher": "e3c02a26aba6fb5b845c77aa255cc018e7a80884cdbfeb650f8533204ff682c2",
      "frank_cross": "e6bdfce81adc773158fd9be25a3f618406dc1ae7e0b4df79ef5d8d8fc305ccdc",
      "frank_divergence": "597e166cc516d2c281ecf79d7581eadc5a375bf12ae556eb2b8a2e444b9f0c70"
    },
    "pages": 1,
    "timestamp": "2026-11-27T16:53:20.074044598Z"
  },
  {
    "status": "PAIR",
    "symbol": "SOLUSDT",
    "timeframe": "15m",
    "bars": 70080,
    "counts": {
      "vector": 4071,
      "momentum": 1791,
      "speed": 11832,
      "cipher": 10622,
      "frank_cross": 1748,
      "frank_divergence": 10010
    },
    "eventSha256": {
      "vector": "5365509020196153178b0f5b43bf90606aae564fce53d61b63b1a791693d0542",
      "momentum": "1950f4ad72006dda33ec2e04235b311b201769be0f39608cf6e761243a7dc272",
      "speed": "2d2464833c529f7e1eed355656dde925570fcfbb8714b80e970942960f431d32",
      "cipher": "81e3f82ed4bd6a85d7f1e572c158938fe256c4f39c412822345cb4de3227d258",
      "frank_cross": "41470a75b6a8cc9cde5678638613d15895576409ce5001c8f768dd41729ffa8c",
      "frank_divergence": "6e2fe89962c1cf12ed7d8e955dad154a89f1d2890a6d9dd233f5d5a899b9d527"
    },
    "pages": 71,
    "timestamp": "2026-11-27T16:53:22.28689356Z"
  },
  {
    "status": "PAIR",
    "symbol": "SOLUSDT",
    "timeframe": "30m",
    "bars": 35040,
    "counts": {
      "vector": 2029,
      "momentum": 921,
      "speed": 6109,
      "cipher": 5317,
      "frank_cross": 973,
      "frank_divergence": 5086
    },
    "eventSha256": {
      "vector": "091f39dace310ffe34b48fced0840dc0e776fe0d3ebadf304f5746be8f6bc598",
      "momentum": "debc632f5c5afaf872f44e2bfb9ce2c6bc1707ef0e1efbd8af04e4440a51e05c",
      "speed": "c65ec53ea1f85ab30e15405d84ab61c7485d63dd61a7be649df619395d39d9c8",
      "cipher": "e4f6db5903df7bfc5cefce58dff3ae35ff6b6dfe9d54652219dfbe8fba766db6",
      "frank_cross": "edf877853b0ff498b1d45beded112ec4f9f6e66126c5b8deb66c5a28dda27303",
      "frank_divergence": "2d0a2da85279dadb1ab62a6391a6248ee0bc7583c0388b5cddb0f80dd8ae3ae1"
    },
    "pages": 36,
    "timestamp": "2026-11-27T16:53:23.332600281Z"
  },
  {
    "status": "PAIR",
    "symbol": "SOLUSDT",
    "timeframe": "1h",
    "bars": 17520,
    "counts": {
      "vector": 1054,
      "momentum": 416,
      "speed": 3129,
      "cipher": 2631,
      "frank_cross": 511,
      "frank_divergence": 2580
    },
    "eventSha256": {
      "vector": "3eb2b54e1a7eeb1b6d898c3ba5a07e348d11457a2057c269dcfd82ba2206d124",
      "momentum": "14dd5e8301b038488a6878e9bb81d4218f3fdc2ca45382f5752f3482eff35b94",
      "speed": "fbf05f0fa829649c711f84f1857cac4952ff5ac07d8d218e73678c1aac3b0f58",
      "cipher": "254f04c9d8d223154719908daff85b2863fab51e7128deeda024b8e976183af2",
      "frank_cross": "f475c6adf1fd4fd704ee58a90c41fab65d4fcc4b35abaac3732a72669803402a",
      "frank_divergence": "3997a87783365e408ddb7f6d19274a69bbc540e9240d88535418147ab0136c79"
    },
    "pages": 18,
    "timestamp": "2026-11-27T16:53:23.865106507Z"
  },
  {
    "status": "PAIR",
    "symbol": "SOLUSDT",
    "timeframe": "4h",
    "bars": 4380,
    "counts": {
      "vector": 269,
      "momentum": 123,
      "speed": 749,
      "cipher": 659,
      "frank_cross": 142,
      "frank_divergence": 656
    },
    "eventSha256": {
      "vector": "2d52fb406ae1430eee9fdc68cce15f0702c1af903fb60f06794f028e55acff06",
      "momentum": "8649c82d5ddebb170ffdd68ae52dbcbf72b9e413babf88a096c503032614291e",
      "speed": "148e301d463a4810b7b344f00fdf991e19f60788c5604a2a877e71c0ac8d24e7",
      "cipher": "8ca7185ebb14d3d800f506aa4f87bcf6ae74b56c9708bc41db429591609366ea",
      "frank_cross": "941fdfcec03dfe61c7030cde7de28500556d154593893f98dd19ea83ad67492f",
      "frank_divergence": "e4222d125d46b68b112ae85fd57c3bbcf7acbf9b5ac0e33d405beef50154842c"
    },
    "pages": 5,
    "timestamp": "2026-11-27T16:53:23.977816991Z"
  },
  {
    "status": "PAIR",
    "symbol": "SOLUSDT",
    "timeframe": "1d",
    "bars": 730,
    "counts": {
      "vector": 38,
      "momentum": 17,
      "speed": 73,
      "cipher": 105,
      "frank_cross": 22,
      "frank_divergence": 112
    },
    "eventSha256": {
      "vector": "53f30017fcc21000242061a0647d2b7249ad9bccec1f3623d5bc33b677156270",
      "momentum": "08c5dd8911a7ca91394110b577ed2ebdd4e9618403c418140f6dd00f37a900be",
      "speed": "4f553e6c22e22943b45d2c55a3d493dea91717f9af811f8c9b82f862ee753441",
      "cipher": "0bf89e3f38da2c4ecb38eee24c0a15f5bf592fae3cef0c54e63dd78eb6d13abb",
      "frank_cross": "6d5c313e891d8074ba5e523bec1dabd348824fc7f349f3db9202048808ea7302",
      "frank_divergence": "07726857c3c978eda0072d71e4e8e211f9bf9977090f67ccc645e1ee1996e3be"
    },
    "pages": 1,
    "timestamp": "2026-11-27T16:53:23.99364479Z"
  },
  {
    "status": "PAIR",
    "symbol": "HYPEUSDT",
    "timeframe": "15m",
    "bars": 58237,
    "counts": {
      "vector": 3592,
      "momentum": 1500,
      "speed": 10407,
      "cipher": 8770,
      "frank_cross": 1481,
      "frank_divergence": 8158
    },
    "eventSha256": {
      "vector": "912527cec57a3055edbe70db9677b7cf9ccc81856ec48325d5d46202b123ee70",
      "momentum": "1de1b96d758af124ab0a552804afe08358280e66833303df6b8cf183b9592f3b",
      "speed": "ff7602ae5b70d543703f6d9dcad602322f4a8a1fa280c0d734c7dfcbfaafbb76",
      "cipher": "9054bacc8d0f9a2c3f98c18941ea39c03ee82054ff27140cf90514b60ccb1879",
      "frank_cross": "bc6c2e41a44c068acf9e9cd3db3576b1a321ffa7a7ac4e2bb0efa9883d8226fb",
      "frank_divergence": "d213d38f239a4687a39c8c0c5637d273df1bb01bc0d78202b6b0c7b906e91f6c"
    },
    "pages": 59,
    "timestamp": "2026-11-27T16:53:26.416718105Z"
  },
  {
    "status": "PAIR",
    "symbol": "HYPEUSDT",
    "timeframe": "30m",
    "bars": 29117,
    "counts": {
      "vector": 1860,
      "momentum": 741,
      "speed": 5391,
      "cipher": 4459,
      "frank_cross": 794,
      "frank_divergence": 4100
    },
    "eventSha256": {
      "vector": "bee15229cd9469f1bfa00c199de45d1afdb57ac8c4a849f54c9a70adc18ab172",
      "momentum": "c2912266fb23ed16c03d60347d8935ef7af716e9706cbfae83d4d8df775c5ea2",
      "speed": "c9d431001c05bca157f60fa6d5635de9a8aba8b16503ca9e45c20dd20e5dd5e8",
      "cipher": "ada796e61aa70e387ef09b23b9016c77ed549ba7f093e2653b09ff0ed1e1bad0",
      "frank_cross": "d75a70ee6b34f879ab35328fef4ee153b7667a90a005404a647b04a8e620d4cf",
      "frank_divergence": "3731a184b5565bfe4bb81205274c366e39ab901436b89a91198b291e5ef2dd42"
    },
    "pages": 30,
    "timestamp": "2026-11-27T16:53:27.467911076Z"
  },
  {
    "status": "PAIR",
    "symbol": "HYPEUSDT",
    "timeframe": "1h",
    "bars": 14557,
    "counts": {
      "vector": 854,
      "momentum": 371,
      "speed": 2601,
      "cipher": 2254,
      "frank_cross": 425,
      "frank_divergence": 2094
    },
    "eventSha256": {
      "vector": "ddbe1e6100799bd6c80a81ab6fad5821a5e2a6af866a0d6731b869d986539c22",
      "momentum": "c9b5c7e9f138add75a89d7342662d81c8cc3a4d7e914502a21b0bdc4e86d8bff",
      "speed": "d656802469f5687de5e79fd61d05784e5461a6980ee846a3e397e72e0214b56e",
      "cipher": "3fb828ae38611864196c613bc161c06285e79a5728b492b68775228025ecc93c",
      "frank_cross": "b4f6984388d931bebb73a83bd7d042804829edb1c9775d2c5aaabb9ad070e3a8",
      "frank_divergence": "b8658338a2896568b726bb40560f132a4813a1bf6f520847e6c8fcc10a601b56"
    },
    "pages": 15,
    "timestamp": "2026-11-27T16:53:27.907521887Z"
  },
  {
    "status": "PAIR",
    "symbol": "HYPEUSDT",
    "timeframe": "4h",
    "bars": 3637,
    "counts": {
      "vector": 216,
      "momentum": 102,
      "speed": 579,
      "cipher": 541,
      "frank_cross": 135,
      "frank_divergence": 557
    },
    "eventSha256": {
      "vector": "74ac215b12706f7615b752163f8c0b1f8d4f349a5f99959d6a6031bebfedeeb3",
      "momentum": "bbdbae9ac8e9ff5ca0bcdb08125ce8628aea9aa23f1b921d4566c0621e51c414",
      "speed": "7277f69466da3563ddbfa750111a5302258729313b4453a5c956ba821db4ba60",
      "cipher": "56ef8ca54142fc8d6e9e4bbb08ade0423c3dde66cf55b2a8268a6f72fd7561b4",
      "frank_cross": "66f1e98f4f3db5f61d29cd1f997f0e31636033efa4d031cb1463b30feddcfed3",
      "frank_divergence": "08d35d23571af9ea56a887d31291c9b2f80b56c64a7b63202680f9337af46fa1"
    },
    "pages": 4,
    "timestamp": "2026-11-27T16:53:28.018327643Z"
  },
  {
    "status": "PAIR",
    "symbol": "HYPEUSDT",
    "timeframe": "1d",
    "bars": 603,
    "counts": {
      "vector": 30,
      "momentum": 12,
      "speed": 87,
      "cipher": 89,
      "frank_cross": 32,
      "frank_divergence": 76
    },
    "eventSha256": {
      "vector": "42443411c959e0e2f1b48ab8422c1e8a68e5c36d3acef7347a9f300b43cfb2a9",
      "momentum": "6f4a7414ca41efe6eaf2aac95700ac6bbd616bdb699080c16ffb3b0eac806245",
      "speed": "9a4f9e1e2d77e47005a388b55ee8558adb807a8caadcaa292c8459d8eb004b25",
      "cipher": "f64e5d3405a6d87dbb9549ed9118e4b71e985d8b323a1822434abe1c7b35fa2b",
      "frank_cross": "fbf48043d31fe6063a0f811d7b8075ea9df8be3070d863949d23ecafed413db9",
      "frank_divergence": "ded0bfd0c6152b235fa60ade90eea906e9246bf2703a043d75bd0e7c60ab288a"
    },
    "pages": 1,
    "timestamp": "2026-11-27T16:53:28.07168847Z"
  },
  {
    "status": "PAIR",
    "symbol": "1000PEPEUSDT",
    "timeframe": "15m",
    "bars": 70080,
    "counts": {
      "vector": 3879,
      "momentum": 1761,
      "speed": 11287,
      "cipher": 10658,
      "frank_cross": 1829,
      "frank_divergence": 10263
    },
    "eventSha256": {
      "vector": "5bcb627971cf18a86f9a6ddb22a8539368203bbaf19b49125815a4fcd9c3dae4",
      "momentum": "40d2dfb263aac96032d2b9a0911d15bb9b90335097bf59e6acf30234ecfe5484",
      "speed": "1476225c24f0058bb02a5d4965f5c56ef0947677d8b9230125ae1bac1a4d9c0c",
      "cipher": "24cefbcb6b6eca0ccbb2d8190a54ce31178fa62d8d1c3426cca6bd7d378d020b",
      "frank_cross": "2026867718796d3662a2b62553a5686d3b73072b2c0f59c8c5d36f7e34380926",
      "frank_divergence": "e0913f949317870ca072292eeda21d449a7de5570971cf02a6ed0b2222104c35"
    },
    "pages": 71,
    "timestamp": "2026-11-27T16:53:30.576113226Z"
  },
  {
    "status": "PAIR",
    "symbol": "1000PEPEUSDT",
    "timeframe": "30m",
    "bars": 35040,
    "counts": {
      "vector": 1942,
      "momentum": 858,
      "speed": 5769,
      "cipher": 5285,
      "frank_cross": 941,
      "frank_divergence": 5229
    },
    "eventSha256": {
      "vector": "4c4e9feb656cf8cf26fc4e704d81982f7712cf4b320a0f498e5ecac3b3dea30f",
      "momentum": "2070be9dfca6e2dceec5fea921251ac48d8053c1b8c519603e46825aff4b44e6",
      "speed": "c8eef863c04041f34f858b39e6264da149f4131e971b6feb37e2f1cb2bca9230",
      "cipher": "bf9deffbb09df4945a1c903fe5cca1ddb3a888fc521320adb7804d56e1ea9a5f",
      "frank_cross": "e3c0ff53bc17659edf0dec206d1a072a9b23f4dd0094087d91e88c5eee58223a",
      "frank_divergence": "d0a3ac84b5f7b3ea88c0a0d221570734ca34d13a0486676bf7371eb624c44b8f"
    },
    "pages": 36,
    "timestamp": "2026-11-27T16:53:31.921245489Z"
  },
  {
    "status": "PAIR",
    "symbol": "1000PEPEUSDT",
    "timeframe": "1h",
    "bars": 17520,
    "counts": {
      "vector": 971,
      "momentum": 422,
      "speed": 2883,
      "cipher": 2581,
      "frank_cross": 511,
      "frank_divergence": 2650
    },
    "eventSha256": {
      "vector": "16093aac981fb651caf8a9b24fb05abb9bc8c05119a01da50e196b8cc1b1c019",
      "momentum": "0011545674b7ac79dd99f8b324f10dd1145333ae7b7aa8bd224890c70774ed38",
      "speed": "a755438d58c7413a1852debcb093da49c141ce7e9c6385677b707e1f29c8d498",
      "cipher": "d597c5fd36093a3ae4fb5eb65c89b596987dc6c83817afb5822e6351c556f4b4",
      "frank_cross": "f939c25ae64d0ccb086ee35ecd90a1707bcbb5c1ada1472ecb8f86e207ea90f6",
      "frank_divergence": "d3fb2d93d508336a1df7a08e18708f312ece44d99ddb19999a49505dbe0914a6"
    },
    "pages": 18,
    "timestamp": "2026-11-27T16:53:32.425624735Z"
  },
  {
    "status": "PAIR",
    "symbol": "1000PEPEUSDT",
    "timeframe": "4h",
    "bars": 4380,
    "counts": {
      "vector": 240,
      "momentum": 102,
      "speed": 660,
      "cipher": 637,
      "frank_cross": 170,
      "frank_divergence": 631
    },
    "eventSha256": {
      "vector": "7bbcc3158d9a667c8d5fe3f96b4d4b2fb6178242e7691f443bb31e005056d6a9",
      "momentum": "979ba697a38467ce647cb1771ce29d8a42dbfb2dd72ab29f153fdcde6415efa9",
      "speed": "16f21bce7affd15edb21f5cfc77477a02a3960696cbe962daff9030fbed3353c",
      "cipher": "ceaf9330906c3664f3ba15109b3f5bd7d7c01bd07eb2e730d061764e6b9e75e7",
      "frank_cross": "bcd0601810d08fc9649c567fe6cc754fad99a26a1d67f69f311e387052fc1544",
      "frank_divergence": "fde1c666e4d74d3496733dd6c916a1e2d2f65cf0eae6af0485ab887bce73ac67"
    },
    "pages": 5,
    "timestamp": "2026-11-27T16:53:32.575009979Z"
  },
  {
    "status": "PAIR",
    "symbol": "1000PEPEUSDT",
    "timeframe": "1d",
    "bars": 730,
    "counts": {
      "vector": 37,
      "momentum": 13,
      "speed": 71,
      "cipher": 112,
      "frank_cross": 40,
      "frank_divergence": 111
    },
    "eventSha256": {
      "vector": "4fdc101458985d88057c9536e2ba6a75189dc00b1fec5ec4d490a855d2f7250c",
      "momentum": "ab70b5500288bb2a5962f16444dc7f6f1a49e60fef998b424d0164336f619f83",
      "speed": "1403a30a600c794ad68307031fded82ef9e65cb69b66bc271e9be265b5ccc274",
      "cipher": "d4188e2a9bfb0394d73e42f842ef64cbef3450f4f6ccf50d0a9fd5f90fcd25a6",
      "frank_cross": "44d217ec007034524343cc513a75739963247f531d413d3b5d26070b003005bb",
      "frank_divergence": "3222138337feb0d593030f0748fd762a05274d492878d159f9be2bf42748b9f6"
    },
    "pages": 1,
    "timestamp": "2026-11-27T16:53:32.593340989Z"
  },
  {
    "status": "BINANCE_READER_SAMPLE",
    "exchange": "Binance",
    "symbol": "1000PEPEUSDT",
    "timeframe": "1d",
    "startMs": 1683244800000,
    "endMs": 1685577600000,
    "expected": 27,
    "pages": 1,
    "sequenceSha256": "471a59b23ce1a0a0daa0407bc7d9de2f9ab39dc2d49483672bfd680cd65ad15e",
    "version": "CJ_STREAM_ORIGINALS_V1_20261127",
    "bars": 27,
    "lastTime": 1685491200000,
    "counts": {
      "vector": 0,
      "momentum": 0,
      "speed": 0,
      "cipher": 2,
      "frank_cross": 0,
      "frank_divergence": 0
    },
    "eventSha256": {
      "vector": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "momentum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "speed": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "cipher": "a4f207267420d5ea13f630158651efac45abbcb49727133d32177205e49de67d",
      "frank_cross": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "frank_divergence": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    "stateWindowSizes": {
      "price": 20,
      "vector": 20,
      "momentum": 27,
      "frankPivots": 7
    },
    "noTrading": true,
    "priceStepNote": "diagnostic read only, not verified historical Binance tick; no performance claim",
    "timestamp": "2026-11-27T16:53:32.640571002Z"
  },
  {
    "status": "PASS",
    "pairs": 25,
    "bars": 617151,
    "events": 360092,
    "comparisons": 150,
    "binanceSampleBars": 27,
    "readOnly": true,
    "noTrading": true,
    "timestamp": "2026-11-27T16:53:32.641598513Z"
  }
]
```
