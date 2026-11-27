# Frozen candidate streaming parity V1 — 2026-11-27

**PASS** actual Render PostgreSQL read-only audit completed 2026-11-27T17:19:58.180305485Z: 617,151 source candles SHA-verified, 431,998 known training candles replayed, 619,484 events across original and candidate variants (not unique trades), 325/325 ordered signal hash comparisons, 975/975 exact simulator result comparisons, 75/75 warning-stat comparisons. 25/25 pairs. No holdout signals or performance results published. Full source hash was checked, generation and simulation restricted to first 70%. Audit start index min(480,floor(training/3)) for short daily samples: diagnostic only, not prospective performance protocol.

Seven frozen candidates: Vector V3, Momentum V2, SPEED V2/V3, Cipher V2/V3, Frank divergence V3, plus six original channels. Streaming state retains cooldowns, directional state, EMA gaps, warning confirmations, confirmed pivots, next-open execution, reversal/time exits, fees/slippage, open position and equity/drawdown; no changes to candidate parameter rules or prospective window. 3 hypothetical cost models; 13x3 simulations per pair. No new tuning or selection. CI 46040607773: 7/7 tests, 175,296 synthetic bars in two page layouts, all event streams nonempty, exact event hash, warning and simulation parity; prefix regression and callback-free page API, conflicting signals and insolvency regression. Some candidate and baseline events on synthetic data coincide; real audit covers all.

Code bdd6ab7a16fa0077f937321fa2a05a926b63aa1e; API 12c16986ee5c3643da664764b5cb7e2c44570d66; Render dep-dc4rmd29lscs73eohkm0; cleanup API a83553ecb85fc4c9a70441581704aec091144c11 requested. No main changes, no live orders. Collectors remain configured. Limitation: streaming state across pages in one execution, not restart-persistent checkpoints. New 5-year real datasets are not complete, Binance historical tick-size mapping and final source audit pending; no five-year return or profitability claim. Next: source-specific full historical runner and evidence-driven agent hypothesis generation, keeping frozen forward and older validation periods isolated.

```json
[
  {
    "status": "PAIR",
    "symbol": "BTCUSDT",
    "timeframe": "15m",
    "bars": 49056,
    "counts": {
      "vector|original": 2983,
      "momentum|original": 1296,
      "speed|original": 8673,
      "cipher|original": 7455,
      "frank_cross|original": 1173,
      "frank_divergence|original": 7247,
      "vector|v3": 3295,
      "momentum|v2": 1454,
      "speed|v2": 6932,
      "speed|v3": 7497,
      "cipher|v2": 8319,
      "cipher|v3": 8058,
      "frank_divergence|v3": 6688
    },
    "eventSha256": {
      "vector|original": "e5c7b2683b28ad991c59f733e9f0893944ec8a8bb08bc742879b944fee7e7f3b",
      "momentum|original": "e44bbaaee4157cdd625fe2da548624441c38c0b5ed2799191a20d0530a0623df",
      "speed|original": "576b182d5cb6e27fe7a2df51c3bd0b41954b3a96148dd368a3c3bcc9513db794",
      "cipher|original": "a08ebc7f9d26bb8d0b23b78c90a965345d17a17e50d31020717e791d2a5efcd1",
      "frank_cross|original": "bf2eac412b23d6b126a4cc8f60d80fe18b84d29684f6cca9c73d20203325ece9",
      "frank_divergence|original": "8aedb0f0e0a55a4406a73cd221873c07cd271cf9a9d22fa6e9b8e97c0039c71d",
      "vector|v3": "2a3754331312f8327368412e7ee3f0e242acac0824a9261220fff6ecf93360e7",
      "momentum|v2": "5e462ec98e10a0fa55240a7ceb052c1defd58a07c0208fa17acdf86e9aea53f6",
      "speed|v2": "200c0f2e973020aede396221caa3f499bde72dc1f427ba6c556a3ec917e7b645",
      "speed|v3": "f8fd258855507a44381c01480f01ed356a3e039ef01271132658bde626eb0895",
      "cipher|v2": "ca64ac83bdb8ea96a96bf5b2246a9867e929f93cdf0667664d0c298331f2eb15",
      "cipher|v3": "4e2dcbb2ddbb4afd82e916f4558f681339f4b694247858e42ff294441688f529",
      "frank_divergence|v3": "67cdcc0f45949a5db88862c95f15adb1437e99af8384d02d3f4489109f6d8b7b"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 3976,
        "confirmed": 3112,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 2926,
        "confirmed": 2323,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 6688,
        "confirmed": 5712,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:18:44.994525008Z"
  },
  {
    "status": "PAIR",
    "symbol": "BTCUSDT",
    "timeframe": "30m",
    "bars": 24528,
    "counts": {
      "vector|original": 1486,
      "momentum|original": 626,
      "speed|original": 4552,
      "cipher|original": 3668,
      "frank_cross|original": 618,
      "frank_divergence|original": 3643,
      "vector|v3": 1656,
      "momentum|v2": 702,
      "speed|v2": 3603,
      "speed|v3": 3896,
      "cipher|v2": 4084,
      "cipher|v3": 3958,
      "frank_divergence|v3": 3430
    },
    "eventSha256": {
      "vector|original": "9a36fcbc24e8244016c85a5c165c0114258ae6f10352d35cda4d5b378f18751d",
      "momentum|original": "62f1fe3e9ca6eef26f14379ed3e1e6a9fda954f03d65e641abd570ddfc53f514",
      "speed|original": "e9f3b52bc5dfe1b55918f97643a9106b2f0e6d82128f14f1dbf9a9b2bb1ef90e",
      "cipher|original": "6a8212af72ffbe3243518da74dd01e3de9b1ca7b64dc490f043e3fb454046c27",
      "frank_cross|original": "6f2fe5e2856c721874c16ddf89d3cecff4cf7e68b34e160eedc9acb7e347b830",
      "frank_divergence|original": "3198356cd02ae8c869567a879884a6b4663454a0783857defb00eccb2b446757",
      "vector|v3": "ac8e6e103e88954c237b2d0bb9947535dfeadc81d8d6290b0ab6bb74de7ce2d1",
      "momentum|v2": "5a257b7238ed2c5b739df024c057f99bb8347d5f95f39587e719e8c0024d96b5",
      "speed|v2": "ca3292cc9bca6ef5a0927c34184b89f623defd4c7d90018c7a4bf9abf6338851",
      "speed|v3": "0bb2b396f2be6464ac359abd2b39c4f88aa83fc64502108bc42268dfebee8116",
      "cipher|v2": "48e216a9a7ececba1f3f030f15f5a06281da3b730dd80d7b81a0636b58cd682f",
      "cipher|v3": "08053a61cb74d320f7918d5a7f7022152248d0799cb39c19269b25ea1a13a691",
      "frank_divergence|v3": "461e2ba454d805b3a97dc80bcd8d217fe36441c53b2a3aa12dfa13c3d02180b0"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 1930,
        "confirmed": 1514,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 1429,
        "confirmed": 1139,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 3429,
        "confirmed": 2901,
        "unresolved": 1
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:18:51.394884678Z"
  },
  {
    "status": "PAIR",
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "bars": 12264,
    "counts": {
      "vector|original": 800,
      "momentum|original": 309,
      "speed|original": 2356,
      "cipher|original": 1790,
      "frank_cross|original": 337,
      "frank_divergence|original": 1885,
      "vector|v3": 876,
      "momentum|v2": 353,
      "speed|v2": 1858,
      "speed|v3": 2027,
      "cipher|v2": 2026,
      "cipher|v3": 1948,
      "frank_divergence|v3": 1691
    },
    "eventSha256": {
      "vector|original": "f4a73905f9910ca351078e3798c3893ccb443c4256fc7a9eafd88c78ba57a2f8",
      "momentum|original": "599f5b644fce76ca71fa69f1947b1d70c9b3f1e2d9b1c68f84d039a6b0236bbf",
      "speed|original": "eb048077ba7147076a96389607eeb8f956b39ae4ec589412b254466a4a47bb58",
      "cipher|original": "1b9e1be5b9aaf78a4c5e2d72f20a7ce52765f8619b3cb5232e369be995778512",
      "frank_cross|original": "3cb25feef73d568a8457da5500d92e5fa718309e10b0ee838b7c0f8eaac41b36",
      "frank_divergence|original": "257d288207573effd62f88cc81f0837e9aa64052c9c7a55ecf5d1c3e38f57aba",
      "vector|v3": "41d22fd2591cd1928b2f466f3defc3a117784c1ac4e79d654c8b132b578f6f07",
      "momentum|v2": "038f09ec3b2025ba358c585cffe47a7d629e81e167710de6474b61e131d4f615",
      "speed|v2": "3009474875a18acaaf748013bd5fb49e69a78a20ddcda5d0ec928a35d9a1fe97",
      "speed|v3": "3ca4758574e1a131c011de0825b5cee568f491d424c2f5cb0acad23a8b131469",
      "cipher|v2": "9a9469c603e156a2da7e54544a3d952ee6211f9ac05a5b531fa4eabf6adc1a42",
      "cipher|v3": "6e73a30bd3d45b761dfa56e2fbbdf12a1d324335d9c3d6cbf3a6f10d54ded5e6",
      "frank_divergence|v3": "bdc8ee23b7ec2c6e45ce0b8de89ef1c79441fe19b53a34145b7dd6a00f82d5e7"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 999,
        "confirmed": 763,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 732,
        "confirmed": 574,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 1691,
        "confirmed": 1462,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:18:54.377748788Z"
  },
  {
    "status": "PAIR",
    "symbol": "BTCUSDT",
    "timeframe": "4h",
    "bars": 3066,
    "counts": {
      "vector|original": 195,
      "momentum|original": 64,
      "speed|original": 604,
      "cipher|original": 456,
      "frank_cross|original": 77,
      "frank_divergence|original": 464,
      "vector|v3": 225,
      "momentum|v2": 71,
      "speed|v2": 493,
      "speed|v3": 521,
      "cipher|v2": 514,
      "cipher|v3": 497,
      "frank_divergence|v3": 410
    },
    "eventSha256": {
      "vector|original": "5449ab34730b9e01668473a1d0cd5e84e6da232a80edd90edc6d227dbb4cb07b",
      "momentum|original": "d7c3d0d60add7989b9d568fdf28ed91d50f1d792dc9cf0d17c387f76fb42c9b2",
      "speed|original": "256b84392235291f57e367fc7405f1933dbfae4f9bf6d71adf6421c5150ff8d0",
      "cipher|original": "2b56322b581ea704d13d18640684628cab8bbcc0a64d661347c1779bca81b6fc",
      "frank_cross|original": "1229c04bf4d595081d9258bd93778f376445b0d35ca69651e9518642d81bbd65",
      "frank_divergence|original": "dad366b807f5e63f36f493948b1d33e44cf4d6c7443564eab89738108b53181c",
      "vector|v3": "6b1170a1293c7519a1f619c862c5657d05005563085c20f1e85095a58d90315a",
      "momentum|v2": "93e43f7788abbcf5d151717c22f57d578f136abd9a99c7953292d8ae2fd13e5c",
      "speed|v2": "c7f8cd10baba6b24845ed44c88a7bc64c553ae1e786a3e9b4e3c7db2f992ed7c",
      "speed|v3": "08f804c84b916123e2541df2040e656d5a25176e4b96ea6f0d312009fa735a3d",
      "cipher|v2": "28ffa4029007fe21a66ab87b5de3b517fb586eed9dfef7b5f24e501bda38e419",
      "cipher|v3": "272dfd00b267f58f04dd182c18a50a5bbe388295148d6bcd3391b4d054924fd4",
      "frank_divergence|v3": "bd62e1af660feebfb7e52f7f7ec89747cd1fd3c206e2d7bf67dbb01a0bca9771"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 260,
        "confirmed": 202,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 191,
        "confirmed": 150,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 409,
        "confirmed": 355,
        "unresolved": 1
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:18:54.982932091Z"
  },
  {
    "status": "PAIR",
    "symbol": "BTCUSDT",
    "timeframe": "1d",
    "bars": 510,
    "counts": {
      "vector|original": 30,
      "momentum|original": 13,
      "speed|original": 63,
      "cipher|original": 69,
      "frank_cross|original": 15,
      "frank_divergence|original": 79,
      "vector|v3": 34,
      "momentum|v2": 14,
      "speed|v2": 56,
      "speed|v3": 58,
      "cipher|v2": 79,
      "cipher|v3": 77,
      "frank_divergence|v3": 62
    },
    "eventSha256": {
      "vector|original": "e07876ea91e6a8f40c8f10c6d9912b49bf25738593413edeb383f272b455a7eb",
      "momentum|original": "413b86e0e9c644e11042d8895af76152d0cb28b45405a96bf97b22c6e3b423d0",
      "speed|original": "6f98b7f57d9b58761a62802b747322347448976b53f8484b7b4e612705eb318b",
      "cipher|original": "c641266ffb30ea0d4c6d8607f173a2f16c4ade26a622d5298a637efaddf8deb5",
      "frank_cross|original": "3b8273437d1fdf52a672f468ba39fd4094810c83ebeed1ae1805aa3d343a7b48",
      "frank_divergence|original": "d647f4522c103f75be04b5cff9d89198db67a29f08a7674971050ba7c9643ae3",
      "vector|v3": "e08da129f577f4b1e7a4fdc8f51fc42ddf562c6747d2bf0ceff4539244e1a2a9",
      "momentum|v2": "8fa01d1c1a4688d3ab5b97b9159a156eaf8ec4feed7969836461c847926d73d2",
      "speed|v2": "0093858f891bc2ac90476f969f372faa6df06e0d03c1bc0b7696fb1bcc46a211",
      "speed|v3": "cfd475e7251b2208cd81692911352335a5a1c2c5b64000b62f300e0b1f768c95",
      "cipher|v2": "8d3ad7f1d364e0f3fac2f05733bca8aee34b899cdfde9f2a14e01999186ef14a",
      "cipher|v3": "1aa3ac6aa5873128720fcef8f410a07a48f00f6b12b2bdb2fd8716181d54b2d5",
      "frank_divergence|v3": "fb5847b17281df4f00e96165fb2c51cb1f55acade9060e1b563cb82e1c96159a"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 40,
        "confirmed": 30,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 34,
        "confirmed": 26,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 62,
        "confirmed": 55,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:18:55.076819594Z"
  },
  {
    "status": "PAIR",
    "symbol": "ETHUSDT",
    "timeframe": "15m",
    "bars": 49056,
    "counts": {
      "vector|original": 2749,
      "momentum|original": 1213,
      "speed|original": 8599,
      "cipher|original": 7515,
      "frank_cross|original": 1250,
      "frank_divergence|original": 7367,
      "vector|v3": 3073,
      "momentum|v2": 1357,
      "speed|v2": 6969,
      "speed|v3": 7524,
      "cipher|v2": 8370,
      "cipher|v3": 8099,
      "frank_divergence|v3": 6813
    },
    "eventSha256": {
      "vector|original": "808453ec58819f77da0f53f0f05cf49c76548d0f7fb3da763e13c0e692bb4f86",
      "momentum|original": "81e76cf8057947c2e153055b986c901768da64e260effc8eb64aeec1050c83c6",
      "speed|original": "0d935d6169e63bce60e44c2520752e4d47e34df5cadc36ccd132963f9fcb0a92",
      "cipher|original": "6fbedde321dc15dd004c2f4db481a57b4ee09fad7dfbe5901c955234dee64e03",
      "frank_cross|original": "96dfc84b4c45b484e4b1a1f6fa2d018206f4d67685414632c4543cd2d3c049d9",
      "frank_divergence|original": "279a122fd7fb23c385d447ad2ceb04041eddb3c656f6ae8277edafcb5182ec65",
      "vector|v3": "a8fe0e43ad1918e1e0146d75c62c444ad1f1ea01dfb0f1be5b56cb2493c618e9",
      "momentum|v2": "47db1d4f2c432711155bcc1c7d8abaa2f83b79696db52950f7b82c84d918757b",
      "speed|v2": "90c9475584fd248c61c43dd977ca56f3c1ea708040be3f36c54e6a5a4fd529b5",
      "speed|v3": "c1aabbdad697987c14c16ca6755d964730fb02acd595e04663706d1f0fdcc8ea",
      "cipher|v2": "bee4f0aae2bc3ee5a478cb9ff875db3a883f0cedf0ed513e649a3c4527d89f64",
      "cipher|v3": "26f0094ef20d636aa43810964d530a7c90aff682a6010499e5c3d549d3ab7666",
      "frank_divergence|v3": "c88148a38677351355eabc78bd10719763c61024dd13b0496580435bb4067e0c"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 3901,
        "confirmed": 3046,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 2846,
        "confirmed": 2262,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 6813,
        "confirmed": 5821,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:04.806037404Z"
  },
  {
    "status": "PAIR",
    "symbol": "ETHUSDT",
    "timeframe": "30m",
    "bars": 24528,
    "counts": {
      "vector|original": 1347,
      "momentum|original": 642,
      "speed|original": 4507,
      "cipher|original": 3732,
      "frank_cross|original": 651,
      "frank_divergence|original": 3712,
      "vector|v3": 1509,
      "momentum|v2": 718,
      "speed|v2": 3628,
      "speed|v3": 3905,
      "cipher|v2": 4159,
      "cipher|v3": 4041,
      "frank_divergence|v3": 3372
    },
    "eventSha256": {
      "vector|original": "3d6c180fe414daa70e579701beb586b8188552beb160b8730bd11cf0e7175d9b",
      "momentum|original": "b9b73da45573e0bbbf4550c77acf40e51b73cdd8de45d0e309fe05ac011b34af",
      "speed|original": "e9a74c4d2bc6e4499b2e4a220f5635f0f09ff3dc2e59085648ae887cda8fea68",
      "cipher|original": "d577706013e9bb399c40c87eebd4f16a41cd7f8e06a8fe08f5995c8ba24324d6",
      "frank_cross|original": "99a0af1cad92b88193a7056662ef36744510e56eccca4a6afb41bb21b2b8c547",
      "frank_divergence|original": "56e0269713a6bddb404deb3c24fec6260c15c035ce6af5577d171099cb90faa7",
      "vector|v3": "e3c50d94e89f67f6000b892f15067c7a29ad9f1a4660b7d9cd4826079802e663",
      "momentum|v2": "5ef8fb0b97bfd971fa8a948a6de60fd7b9e342b5326c6366744d004ba4602fd2",
      "speed|v2": "a575462dfbce960764f55a89b7033806b0c7b3fd537beecf77c02ac4c3a58f3b",
      "speed|v3": "f7ec25c1ce98fa0b3895a0d7f43369f2c8603f4f9ccd5e051c2414cfa908466d",
      "cipher|v2": "304b43b6f45ab2bf4148fdd28f340d9272e4ce26610c21eb15c4bd65e4602525",
      "cipher|v3": "118f50ea0dd72b12a159704e975060a4e88e15dd61e63c8393a8bc743d4baf1f",
      "frank_divergence|v3": "6fce6500f639024953bbde2db87e158cb5336aea9b994641c40c826b7fc0f0fa"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 1938,
        "confirmed": 1511,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 1429,
        "confirmed": 1120,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 3371,
        "confirmed": 2903,
        "unresolved": 1
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:09.280514095Z"
  },
  {
    "status": "PAIR",
    "symbol": "ETHUSDT",
    "timeframe": "1h",
    "bars": 12264,
    "counts": {
      "vector|original": 678,
      "momentum|original": 298,
      "speed|original": 2276,
      "cipher|original": 1750,
      "frank_cross|original": 346,
      "frank_divergence|original": 1868,
      "vector|v3": 754,
      "momentum|v2": 340,
      "speed|v2": 1812,
      "speed|v3": 1960,
      "cipher|v2": 1977,
      "cipher|v3": 1907,
      "frank_divergence|v3": 1675
    },
    "eventSha256": {
      "vector|original": "04eab786ad49018d92e3ceba97350812ee061d4d39a0d23e77f20c64f82d72ca",
      "momentum|original": "ca39f901ac008282bc90e82e89c5434bce68c9087e01795c5112d37a91160dc8",
      "speed|original": "daa75986f28ad1a5b04ebc9f3b41e84639e82822bbc297eb7fcba9075f4f517b",
      "cipher|original": "7de7b248272ca500a7e3f18f0e03346bf13e08725071331f080644bef5fcae9c",
      "frank_cross|original": "0cb830aa5c9234d33ec04d4369f7b853994ad4455400c3c6e8b995c5cb66f1c4",
      "frank_divergence|original": "e3d4e066bf482ec379ef83fe873a33d26ca4e9da6589931bd9a4696f96cfd2a7",
      "vector|v3": "8e2d91a56e5d90fb17157be72a35070ed2d16c6e4caea4bddaffb1214d27969b",
      "momentum|v2": "b09651a9f2e63b0b3b7dbcf68b4afc14ed16f35038ec25a9cd9085cdb9cd7ca3",
      "speed|v2": "096a9d9200ab382c81ea89b26312f5a2b46a87f23171ea7a1ed0b285c7a5b192",
      "speed|v3": "d9a37b54352adc5aab63529e146ffa7d43753056c216d649c5210f76e260bee0",
      "cipher|v2": "ff980531c8ae63aae2af7ad7d091b15242cf9e4fc711623921d39f4d8929eb99",
      "cipher|v3": "c32553d4f01fd31a710d43541a7cf4860803af5876a19b22225ecd0bb93b148f",
      "frank_divergence|v3": "2594cd753323e56780c23f16f5e4a85b7989090c9f767e1d03a697cdbcb94a1e"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 890,
        "confirmed": 663,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 681,
        "confirmed": 524,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 1675,
        "confirmed": 1437,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:11.176087096Z"
  },
  {
    "status": "PAIR",
    "symbol": "ETHUSDT",
    "timeframe": "4h",
    "bars": 3066,
    "counts": {
      "vector|original": 179,
      "momentum|original": 72,
      "speed|original": 565,
      "cipher|original": 444,
      "frank_cross|original": 94,
      "frank_divergence|original": 462,
      "vector|v3": 199,
      "momentum|v2": 79,
      "speed|v2": 461,
      "speed|v3": 484,
      "cipher|v2": 504,
      "cipher|v3": 486,
      "frank_divergence|v3": 422
    },
    "eventSha256": {
      "vector|original": "d3528279ced6398d6b1543db0e4318491f058de484cc4356d79fbc63e3e9480d",
      "momentum|original": "a714f02ab55b311f60d4e0c3be534abb653f108ca80a906751f78317393ab21d",
      "speed|original": "6883c3670ff3c0080a9da63940a85e4007a068a7a2e1081ce51594887807d18f",
      "cipher|original": "6262dce934638df94746c4ac3570ab34fe4b2b6f98307878c6f1abfbec9c2e92",
      "frank_cross|original": "49cf437771136358a451d8dcc5f9d9c521fe8710846cd40440d08adec4c44a9d",
      "frank_divergence|original": "9f2f1ff2dcb69af675934602ea50fce6b151c57ab21c50aa5d6c7f7218ac6036",
      "vector|v3": "70ca68f023302b245b286b0042c036b00d4088918ea146e016c6248f90daf55c",
      "momentum|v2": "1e8050861133dcf4de01d757618f108db9d2cdaea7272315bc1f2296da8ddb29",
      "speed|v2": "4195c40d1df7835fffd89fb34fa508971e756e7599af5cbcaf636bae356a4b95",
      "speed|v3": "524cc32bee32ab84a7bcd7f549fcbf93010e5a73ff2f2a9682154e5c5027d3f3",
      "cipher|v2": "6d6d6e9c0bbde2890ddaab42370917b6f722ecedd2f74e16cde8974a369f0e90",
      "cipher|v3": "66e88b18a2cc33ea4daff3bce7af1c2f6eadd983a84135ced29f76af2a177415",
      "frank_divergence|v3": "4456c2a9e7506c532638d41079cb67ecf8bfd01104f672f9bd596582a9796902"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 243,
        "confirmed": 183,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 182,
        "confirmed": 140,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 421,
        "confirmed": 367,
        "unresolved": 1
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:11.587862627Z"
  },
  {
    "status": "PAIR",
    "symbol": "ETHUSDT",
    "timeframe": "1d",
    "bars": 510,
    "counts": {
      "vector|original": 36,
      "momentum|original": 13,
      "speed|original": 67,
      "cipher|original": 72,
      "frank_cross|original": 21,
      "frank_divergence|original": 73,
      "vector|v3": 44,
      "momentum|v2": 16,
      "speed|v2": 53,
      "speed|v3": 55,
      "cipher|v2": 80,
      "cipher|v3": 78,
      "frank_divergence|v3": 69
    },
    "eventSha256": {
      "vector|original": "0539aa31dffabcbe99972815b25d7e60050a0eb9fdb92c8094743b7668529719",
      "momentum|original": "aeed1995ac1308aa9b9377e6870a295e306a75ad2fbad65bb9df54538162bc78",
      "speed|original": "e82f748513c6adc26babc7d42bd4d4b0965ef3bc7355eb7c8687dc09043c6758",
      "cipher|original": "3659f777cf617eacb5b3cddc0efc6eda0796565403b0996c34f6b1a937a8a52f",
      "frank_cross|original": "e09cfcb736defcbb855873db82a1a14241b6e2abb6e05fc563c0d69029da0ce6",
      "frank_divergence|original": "733ace87f1b2113b4028b9b2e76920a7dc8b34941e39c4264c02bb539c304948",
      "vector|v3": "e58d615dfd106f8e97b0b5540d7faecc4e0e92aca5b509ff268529c09c53e665",
      "momentum|v2": "1dc7bf5eabb7f7c7dfe82ffb0f9a233c8b188c0ebefb0de5a2ede8cac540f45b",
      "speed|v2": "0befeb64331a2cd6088eb393c98e060728c50c9136e334bc71687728e241a252",
      "speed|v3": "2a88a514d702afb5aea8e2fff7b0689c3fc4a47c3b5739e0a7f07fcdad983671",
      "cipher|v2": "8938069b18dbfc6dadcaf17055e22f1b530c64209dc49c416cb02a93cb9c15e8",
      "cipher|v3": "f861a4692d2f0ec9fdd9eef921ca83867456c0aaf1677e2a932a8ddbe1532efd",
      "frank_divergence|v3": "76a6bf813bf893de3e5d56b5ce7059a4d48cb5b1af0f13312203f4df780dd0c4"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 37,
        "confirmed": 29,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 27,
        "confirmed": 21,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 68,
        "confirmed": 56,
        "unresolved": 1
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:11.674633847Z"
  },
  {
    "status": "PAIR",
    "symbol": "SOLUSDT",
    "timeframe": "15m",
    "bars": 49056,
    "counts": {
      "vector|original": 2893,
      "momentum|original": 1261,
      "speed|original": 8124,
      "cipher|original": 7386,
      "frank_cross|original": 1242,
      "frank_divergence|original": 7073,
      "vector|v3": 3271,
      "momentum|v2": 1434,
      "speed|v2": 6586,
      "speed|v3": 7047,
      "cipher|v2": 8226,
      "cipher|v3": 7977,
      "frank_divergence|v3": 6591
    },
    "eventSha256": {
      "vector|original": "b94b6aa134f15719e6667041785def517df65ae519b15cf7668d979af4ecb986",
      "momentum|original": "2d761311d5918a5d57ca54582ff17a184a844a5f2ee7786f7d62407107030bd4",
      "speed|original": "953b8a0a2ef68590c89adbc55a907340bceac0762d1a9883b2519cb3b0d3cfb1",
      "cipher|original": "e07f69418b4d734bb2e0bc1d396ba343f4b2946f8cb1491d7b2af15ced1b1680",
      "frank_cross|original": "71055ff4b60a862520c08a0caf21f0e3a487afa213dcd50b67ec9196cea7b575",
      "frank_divergence|original": "d850f14263901d43399e892d3eb21d145fdbddd41570703025a84351a6a516e7",
      "vector|v3": "4ef8f42012e7e1a3a9c7bbaeafbec85e1a15bc2c6437e25296b1be9edc20d327",
      "momentum|v2": "f2d75bfaa1a43405014a555f3e3b018de46e3a6270771edd11bd3e45d9c3ebf5",
      "speed|v2": "3b0f8aad72b57fc364148c25ff405f54c5cd14abb7c69d609789ba12d232da2b",
      "speed|v3": "502dc5929ae5eff8fe59bb6e4530565a41b8ee9231cf0e9a4e4b182278394f76",
      "cipher|v2": "f870c45fc5928fbbb51d5b7c4fd8c1f733c6e60a85983e74ba2d11f9ab90fcff",
      "cipher|v3": "728c13616f1fda481301e13e5489967039ff44bf42c5ce4f0d686b64215d06d2",
      "frank_divergence|v3": "329901b9e0a5fb0ea9cc9a4e1e718e2f7512520910ba85fbe90f9e302ff17f11"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 3953,
        "confirmed": 3114,
        "unresolved": 1
      },
      "cipher|v3": {
        "tested": 2893,
        "confirmed": 2303,
        "unresolved": 1
      },
      "frank_divergence|v3": {
        "tested": 6591,
        "confirmed": 5617,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:20.895586872Z"
  },
  {
    "status": "PAIR",
    "symbol": "SOLUSDT",
    "timeframe": "30m",
    "bars": 24528,
    "counts": {
      "vector|original": 1457,
      "momentum|original": 644,
      "speed|original": 4213,
      "cipher|original": 3662,
      "frank_cross|original": 697,
      "frank_divergence|original": 3549,
      "vector|v3": 1645,
      "momentum|v2": 719,
      "speed|v2": 3322,
      "speed|v3": 3582,
      "cipher|v2": 4098,
      "cipher|v3": 3974,
      "frank_divergence|v3": 3312
    },
    "eventSha256": {
      "vector|original": "c9ae3c5cfc313dea5b07f7938e2484bcc9d6ee6954de4b5c03f2a1981601e654",
      "momentum|original": "2e4ad099b677b1aeb5d773a337d2e7fbb954df5230ac8a6ad3f205aab6cdf055",
      "speed|original": "bb346aaeefe9467f067fa96e4fe700333fd8424f5168a550fdcd4750af97462b",
      "cipher|original": "a67afd350df8dd797b321a18ea36033343a8023f9be19f2ebd4e270c164df577",
      "frank_cross|original": "4a443f60242cc7da4e5f82db80fdb6f5c6d78b8dd2b5f7a6e3bdb4c4bb4d3d9f",
      "frank_divergence|original": "8f688670004da2e5c287c28c26e376f8d3ceab2a18dcd88a83bc794c6d0030d1",
      "vector|v3": "f22de7c7c9e865a016d2a34695e8e5a609244e4ecbf0347f2563eb009204a8b6",
      "momentum|v2": "382cfda6d8e18a49f464c8b00864e6faf3cdd4c0dd97796ba88921c2a3305e3b",
      "speed|v2": "5105568deeab50a7ce70bf68638b40eb785f6b5dbb6aa595b34e1eb19fe17610",
      "speed|v3": "43b3d9794ec50407d87c663e3e81615e143349dab06ef08d0010d89794d2405b",
      "cipher|v2": "5a29d3874a48c16dc684344f2072f03ac5657a814a7fc06a2866e88ce1c80879",
      "cipher|v3": "4e14a32985e35c27a1277569535caad2e3c2330affff598bd17719ef14544c16",
      "frank_divergence|v3": "9173cb450aa7c5ae4dde2fd3f577805768fd5efcc365ff1bd5ec21dcccf875a7"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 1991,
        "confirmed": 1555,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 1519,
        "confirmed": 1207,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 3311,
        "confirmed": 2820,
        "unresolved": 1
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:25.295118306Z"
  },
  {
    "status": "PAIR",
    "symbol": "SOLUSDT",
    "timeframe": "1h",
    "bars": 12264,
    "counts": {
      "vector|original": 755,
      "momentum|original": 288,
      "speed|original": 2174,
      "cipher|original": 1816,
      "frank_cross|original": 369,
      "frank_divergence|original": 1797,
      "vector|v3": 849,
      "momentum|v2": 324,
      "speed|v2": 1714,
      "speed|v3": 1855,
      "cipher|v2": 2032,
      "cipher|v3": 1970,
      "frank_divergence|v3": 1690
    },
    "eventSha256": {
      "vector|original": "58935c40f5167071977affbb78be860dd64eda0b3c31e85490d9815e92c158dc",
      "momentum|original": "fcdd23cd7b8a6d516c122ff8d6b202d8c94fab246bd075f2cbaa148d4bee4196",
      "speed|original": "fa0da89a206019b30c3dde7c46d9366c0c3cb06d71622f78fb1f56b790747fed",
      "cipher|original": "ec908ea0fbb1041612540273d5b234acc33bf8f2210f317c8bcc8c8c77e90830",
      "frank_cross|original": "34e7a01f227a1bce26a4238fe328aa895c9abb701c191ea587ba8fde88bd4ad8",
      "frank_divergence|original": "d4b7430638f5caa7bd925ba0decd34fdc9ae4c6eef65a1a4725b13e7412f32e9",
      "vector|v3": "276787048426d5db28cdbe742daa5cf627e64cc84accc8bc0420d125e16b1e22",
      "momentum|v2": "80f78645cd847e22ebae42a4d1a365765dcbb7165f55e8e9cc1836eb842db6b8",
      "speed|v2": "d415c3c5f5030b628ef8c6fe713f5584a550dbc0f7a5abbe6c17b3725fa62f31",
      "speed|v3": "81eb378720e3aa3c8be83a5e43da82e910850adc1949c4bc3381fd585bd4349e",
      "cipher|v2": "040a6e4b3ff7f97cd21fb120f2e50efd7ee82055bd637ef7ca8b4bcf4c71f6ef",
      "cipher|v3": "adbbeb381bba19247c5380fae9c540e78d234c19254fca2a9b06bddcfa0d8bfa",
      "frank_divergence|v3": "397cf4c4e2fbe020ef70529c46498bcdcc00b2a861eba9e096c6ce1bef0ea1af"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 960,
        "confirmed": 744,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 730,
        "confirmed": 576,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 1690,
        "confirmed": 1420,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:27.488047649Z"
  },
  {
    "status": "PAIR",
    "symbol": "SOLUSDT",
    "timeframe": "4h",
    "bars": 3066,
    "counts": {
      "vector|original": 198,
      "momentum|original": 84,
      "speed|original": 528,
      "cipher|original": 466,
      "frank_cross|original": 98,
      "frank_divergence|original": 468,
      "vector|v3": 216,
      "momentum|v2": 93,
      "speed|v2": 424,
      "speed|v3": 448,
      "cipher|v2": 514,
      "cipher|v3": 498,
      "frank_divergence|v3": 432
    },
    "eventSha256": {
      "vector|original": "4fdf5d3844906439321cff982b6af147580d96981b968872f04c8db29d8374c0",
      "momentum|original": "42b62f97222630653abb7121452cf8d81bbced93e999b3813a0966b8a73f83ea",
      "speed|original": "a5788f1ee52de76577c81d495cd42b110b6292dde9b852a7edbc5dda9cab3543",
      "cipher|original": "06e718b1bdc70b7527e3f42abd3188c3013067670af0351327d7fd4b3c255b5f",
      "frank_cross|original": "a71ac92bc1e31b0246f8249d7c70c1c7e300671d9bffb9e583ddb4d9ceeed6e6",
      "frank_divergence|original": "8aedb0b5cfb86375a9bb71a01d59de74159115d9c5c00de96b307124b3c1c978",
      "vector|v3": "69240658292361c0ac96e2942ad5506a123fc5d984d1cea026369246bcfe6f94",
      "momentum|v2": "17b2a62507f34d53dc3f08f9ce5e91fb8880a878b5c977181c8d86b9e4c5937c",
      "speed|v2": "1a84ccda3b8e7fbeca84353486833d4097cb49d2ee3c94bb955eb893ad7a99d5",
      "speed|v3": "e7eda431780cdc66a3a18675ad82c6d0e9b59668ddf8bf1bb474f2e55d9feb70",
      "cipher|v2": "45fede576bc3ca9dce37082b7ea903e305fe0feb1c23f9effecf09400aef8558",
      "cipher|v3": "7972d248b615bb3bbea60e50a33dd092c426e8fe5ef4bb0ed53c6523f6fb5175",
      "frank_divergence|v3": "e55903be250bbf72bba60f56cfb70b8f1013f87abf283ab4e93baf8fe3344c6e"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 254,
        "confirmed": 206,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 191,
        "confirmed": 159,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 431,
        "confirmed": 373,
        "unresolved": 1
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:27.990746342Z"
  },
  {
    "status": "PAIR",
    "symbol": "SOLUSDT",
    "timeframe": "1d",
    "bars": 510,
    "counts": {
      "vector|original": 28,
      "momentum|original": 10,
      "speed|original": 47,
      "cipher|original": 79,
      "frank_cross|original": 16,
      "frank_divergence|original": 76,
      "vector|v3": 36,
      "momentum|v2": 10,
      "speed|v2": 42,
      "speed|v3": 45,
      "cipher|v2": 85,
      "cipher|v3": 84,
      "frank_divergence|v3": 65
    },
    "eventSha256": {
      "vector|original": "c27d0913ab66671d77a007931c1f60f853d5e0c7850d6f53dcc701feaa37f0cd",
      "momentum|original": "ff674e521690a4163a40f834fdafc3feb90bff16369271b3ae50fae9c5e5bf8e",
      "speed|original": "f3f6c5b0a1489018a510925a1a1dbaf1b92e542aa56a41256b7f9a7b9532c0c6",
      "cipher|original": "3396533b97fb0017eb21f1ae0e519041c89fc267d5eac70b77f6dbeae804c6e7",
      "frank_cross|original": "95934ddd45b1f378b11c4ad9e8802bd9897ef122a6996ff5625a9c103d236c0b",
      "frank_divergence|original": "93d49eda4ab6a5c13d90cc9edb0ca8c05beb631b66f701334ae606ef92c63c9d",
      "vector|v3": "07aed814c1b494ba17eee3fbe9d13e129490d151d09547016e5de64d48b7811d",
      "momentum|v2": "ff674e521690a4163a40f834fdafc3feb90bff16369271b3ae50fae9c5e5bf8e",
      "speed|v2": "7dc1e9125d942f9d7ae8ccce1b2f68f03b82dd6b47a5c93d9dee4b49bf4ededc",
      "speed|v3": "03d4471f40777289793903fb17de55ed2f8634dccb7c83afe640becfac3ee863",
      "cipher|v2": "71244115fab8fdcb7204c07581e8571837e70d266a92c47d2eb88a67fe4123b9",
      "cipher|v3": "9b085fd657120bcfe91970c31c4bad3f3a75e4c4f0b9f0ede237d1fc5823b3c8",
      "frank_divergence|v3": "40e2d99e38a5de98f928dc04ea22c113d6d0b2152cb6b92134f13b17419dbcab"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 39,
        "confirmed": 33,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 27,
        "confirmed": 22,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 65,
        "confirmed": 57,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:28.091299362Z"
  },
  {
    "status": "PAIR",
    "symbol": "HYPEUSDT",
    "timeframe": "15m",
    "bars": 40765,
    "counts": {
      "vector|original": 2515,
      "momentum|original": 1067,
      "speed|original": 7364,
      "cipher|original": 6119,
      "frank_cross|original": 1037,
      "frank_divergence|original": 5547,
      "vector|v3": 2771,
      "momentum|v2": 1209,
      "speed|v2": 6111,
      "speed|v3": 6495,
      "cipher|v2": 6810,
      "cipher|v3": 6609,
      "frank_divergence|v3": 5103
    },
    "eventSha256": {
      "vector|original": "3a2930e265b7173afbff861dea6e4d4235f19c05978c8e0723ecd0ecf86e796b",
      "momentum|original": "fdec126b466a3a786c49fd2e327c8bbb80c6282b5715512c4a04b9c4a093558d",
      "speed|original": "da249f2a27ca471a01ee1f779d70c3e6e453eda32b6b511f698e038434e7787c",
      "cipher|original": "cbb703c11b501f3e531e751ed8a502464964d0bd76400f0c0097dfa1835fc7d5",
      "frank_cross|original": "caca0e91ed1a1b63014911562e577d78eb456b1d64730893e0dfbe4cabfbe70a",
      "frank_divergence|original": "25e5ad3ad9aeee2449e8ed79599861352cd38781004a1620578b8809ff630176",
      "vector|v3": "ffbe72110588172bc5f48c310c739f9d8538057ed7b3805aff345ff8a6d602ac",
      "momentum|v2": "8864ef13fbac505306445e24613011596fa472309728a4d6da4626f80c7c1e3e",
      "speed|v2": "0e3b1e6b5130b76d21a4b91ef8b7e99fd7a19f2b4d681c50d05725df8d670084",
      "speed|v3": "9af77382ec626a59198fc68efb43eeb169571f8d9d8d03fa9bfc5e392c055f04",
      "cipher|v2": "be67fe93a5927ca945e3cc9788eac7eb35a6e61b83dd3fe78b11470347883ebb",
      "cipher|v3": "3185c9f0d33da1db8c5a876948eeebf5fa678dc011b983d501e0eafafba85821",
      "frank_divergence|v3": "4aea407fae3b19b249f8440fadb33f6b6369f2222d565043012994c182d9490c"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 3282,
        "confirmed": 2591,
        "unresolved": 1
      },
      "cipher|v3": {
        "tested": 2438,
        "confirmed": 1948,
        "unresolved": 1
      },
      "frank_divergence|v3": {
        "tested": 5103,
        "confirmed": 4386,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:35.595482449Z"
  },
  {
    "status": "PAIR",
    "symbol": "HYPEUSDT",
    "timeframe": "30m",
    "bars": 20381,
    "counts": {
      "vector|original": 1331,
      "momentum|original": 522,
      "speed|original": 3829,
      "cipher|original": 3141,
      "frank_cross|original": 563,
      "frank_divergence|original": 2772,
      "vector|v3": 1465,
      "momentum|v2": 611,
      "speed|v2": 3105,
      "speed|v3": 3342,
      "cipher|v2": 3489,
      "cipher|v3": 3398,
      "frank_divergence|v3": 2600
    },
    "eventSha256": {
      "vector|original": "a59e7d40432a652f3d46fb7111b203ac508d45b0310ca0b38073af1df1ee6f38",
      "momentum|original": "72db8260c7f15defdb1d099693146239fee625141d573b50fa81be0f326463ea",
      "speed|original": "8f9a75fed0468cae4610a50e7a34474aeb2775332a1df5b4d03092fc52bf5bbe",
      "cipher|original": "468e585e8cb1544bb1f174f642c7f6b1e4ecee9288d8cf282e8ee4082035dab0",
      "frank_cross|original": "457e3ce928530df25c18cd6d22a247e1bbf430d7efb896f67b7a2a46022352e5",
      "frank_divergence|original": "785f70223986c4ad4c94eb000bda881ea66ffc4d5ee0d471319e7cf40eb37480",
      "vector|v3": "8606dbfc3dc9d37c9bf5a833f009b2bf8607e618f373053812fe511edd70f248",
      "momentum|v2": "4dd02585683dfd2ce61fa7e084997c487a3658ccf996ac5bee04bf18e4d24525",
      "speed|v2": "ecd63967cf48abe53d7e33371e34db621f194f5f769db7acd262d22125e54cc9",
      "speed|v3": "05a6c6a910b28434da1c342ae06aa100ac13bb5451025cfdd470fd91af316b54",
      "cipher|v2": "432ad4071191c0538552bab42ef91b0188c0ebcb78e6c7e973b429584fa13a46",
      "cipher|v3": "ad720827ce99d205bfc129f7cbbca43e9ef423880bac2fe3e1ed548dba25cf83",
      "frank_divergence|v3": "d2d161d62713a7a61d4e4a17dc6588ac9b212a557c6abebaa9238d101e083f38"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 1645,
        "confirmed": 1297,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 1226,
        "confirmed": 969,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 2600,
        "confirmed": 2194,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:38.999764313Z"
  },
  {
    "status": "PAIR",
    "symbol": "HYPEUSDT",
    "timeframe": "1h",
    "bars": 10189,
    "counts": {
      "vector|original": 600,
      "momentum|original": 258,
      "speed|original": 1849,
      "cipher|original": 1606,
      "frank_cross|original": 302,
      "frank_divergence|original": 1475,
      "vector|v3": 686,
      "momentum|v2": 285,
      "speed|v2": 1493,
      "speed|v3": 1608,
      "cipher|v2": 1763,
      "cipher|v3": 1724,
      "frank_divergence|v3": 1384
    },
    "eventSha256": {
      "vector|original": "220578147bf50f54237ffe07ab5bc696cdec09546c326c52ef875daf7a71a136",
      "momentum|original": "89e225786fb84f23402dfeb1067348aa471923d0ce54e7c741b1fcb13f771c1b",
      "speed|original": "d8691377e8df6c859534da30135b1d44ffbaaaedae6656516219c142fcdc7c0a",
      "cipher|original": "66044361a27c7740c8de699133cfb071cfbb53290f854da7374454178ba10c70",
      "frank_cross|original": "105d0f5a2d698b26b75bc21506c13babfd920dc7b9f937f9f260f6c1feef2194",
      "frank_divergence|original": "20df0f829965463f8d163113b563b7c197ed89fe5ce1b2df16548b80779c632d",
      "vector|v3": "0c06d2143e663d4846761ba0c34fe3ff0c6d2ddca2b2b8a032aca81756af8ed1",
      "momentum|v2": "43f70d2dc5834632d6d44a6089e642187c2de0cf91c99f159afdaf855e1f8844",
      "speed|v2": "0ab0415128cb106aba6a4ba03c7d69e1a84993c62f4beed68b787c5bfe64008d",
      "speed|v3": "51f64999f43c02bf809506fcf5617ff48a5e20f076f43d84b29b205e2b7e2e1a",
      "cipher|v2": "c2fcc4fd079db40e49abab3633f5717669c67c09a53846a41216c64f3f5da4df",
      "cipher|v3": "204b618faa5c92db3433f39238e839d53724b725f0d1da08f6f991b2ab38c28e",
      "frank_divergence|v3": "2a635aa8ceeed1c1a83fc66c7324ffd8c9e28ffc8762dabf012ae58a8b7134b6"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 814,
        "confirmed": 657,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 622,
        "confirmed": 504,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 1384,
        "confirmed": 1185,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:40.775968127Z"
  },
  {
    "status": "PAIR",
    "symbol": "HYPEUSDT",
    "timeframe": "4h",
    "bars": 2545,
    "counts": {
      "vector|original": 150,
      "momentum|original": 76,
      "speed|original": 418,
      "cipher|original": 370,
      "frank_cross|original": 88,
      "frank_divergence|original": 394,
      "vector|v3": 160,
      "momentum|v2": 80,
      "speed|v2": 340,
      "speed|v3": 364,
      "cipher|v2": 421,
      "cipher|v3": 407,
      "frank_divergence|v3": 359
    },
    "eventSha256": {
      "vector|original": "ed1486fecb2883afb77996435415a0b201fb640e5d771f633148d9be47ded54a",
      "momentum|original": "1a9d21134fc094e4125ff41e4d087077ad501550b60f43bfdfa2e1a25dae0e0a",
      "speed|original": "872d81bd42fe70297198942a7157650809f641fea0a356e7f450b1f4c8b60f1e",
      "cipher|original": "2827a10a0a217178971e2d7906b56c2da39f0a25f014f05024f64119676257c2",
      "frank_cross|original": "5e2e5be85ba4f6d3d7b87c03ce6cd1f0009c1e3dbd398e50de54dfe5c8c852bb",
      "frank_divergence|original": "dfa3accf14b88c1dbcb629c31ef29c9ce0feb6aee6fa1566c95b6e55039f4daf",
      "vector|v3": "2f0578f755e6bcecda3793da97c24552759d4c8c62a7a7a5f23fdca1fad35bbe",
      "momentum|v2": "71c73db41b12bb39d80396ee1d58236736898598698b557127b825d29f6ef7dd",
      "speed|v2": "ae73a2787c5c273030ca79b9e2f425720470af2f698022e72564f439f4d113ed",
      "speed|v3": "4f46d68977be145cbd88fbd363da9e13f62518f7158119feb832c57e4eb7e762",
      "cipher|v2": "1300b009da056c283f9a284c05abfc956d5796d4f1cd38f2bba4af90a4cdd45c",
      "cipher|v3": "0c995ef9fc9972ea9199ddea81df29877a25e02c691550247712567777e46c8a",
      "frank_divergence|v3": "eb499e95fa650ffcb92da6bcc61e189b13cfc795bff0e79e665c7d4938e168d2"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 207,
        "confirmed": 156,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 150,
        "confirmed": 113,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 359,
        "confirmed": 303,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:41.080583717Z"
  },
  {
    "status": "PAIR",
    "symbol": "HYPEUSDT",
    "timeframe": "1d",
    "bars": 422,
    "counts": {
      "vector|original": 28,
      "momentum|original": 7,
      "speed|original": 75,
      "cipher|original": 65,
      "frank_cross|original": 20,
      "frank_divergence|original": 54,
      "vector|v3": 36,
      "momentum|v2": 7,
      "speed|v2": 56,
      "speed|v3": 62,
      "cipher|v2": 72,
      "cipher|v3": 71,
      "frank_divergence|v3": 51
    },
    "eventSha256": {
      "vector|original": "690dec9953ad881c191fef8b265d14c46c6b78a14ffef4bc9ec1964aa6205b84",
      "momentum|original": "1d50bc417bab68e7b97e0e10af3113b39efa781b038979117f6f4613d02d5d41",
      "speed|original": "3dc4eac591d1c20ec9b513f0152f1fcf398472fddce04c2edc8c02177e777aa2",
      "cipher|original": "6e88244f0bd583ff3a50655b8f78907b177ba59c11deaa047c9f015e4859c030",
      "frank_cross|original": "928fcda0d257602115ba8ee6e2b6e55ac5e790e82a320e7d89fa01623a9e0eac",
      "frank_divergence|original": "cde32e4742613022cf1d671d6ba150c2a865c32bfca137a896c48cdd92ccea0f",
      "vector|v3": "3c98c2d3417be94cc2731292156471f293804da3680adfc031dd9e55c3678de5",
      "momentum|v2": "1d50bc417bab68e7b97e0e10af3113b39efa781b038979117f6f4613d02d5d41",
      "speed|v2": "d591f4a9814a367b10f8c0a1cca320957093fb6f3808af6d241d64a0ef924e72",
      "speed|v3": "767ba1a4ffee193551ce93ddf4fbd5a0dabf532d8e1e152e8257770993e93a23",
      "cipher|v2": "de16779922e7cf665e79e416a00ce161c8acfe09470bb807e27eeb0d466e7b23",
      "cipher|v3": "2098414b3efd4bb68204c3e4c57fc0a67f02ad7d17a519e3fb7b2db735c864f3",
      "frank_divergence|v3": "22cf859527bb4f2721f0ed0226353a7ed476fcd976c08c070186e0d4d4956edb"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 41,
        "confirmed": 35,
        "unresolved": 1
      },
      "cipher|v3": {
        "tested": 31,
        "confirmed": 26,
        "unresolved": 1
      },
      "frank_divergence|v3": {
        "tested": 51,
        "confirmed": 43,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:41.173609667Z"
  },
  {
    "status": "PAIR",
    "symbol": "1000PEPEUSDT",
    "timeframe": "15m",
    "bars": 49056,
    "counts": {
      "vector|original": 2683,
      "momentum|original": 1256,
      "speed|original": 7737,
      "cipher|original": 7517,
      "frank_cross|original": 1286,
      "frank_divergence|original": 7209,
      "vector|v3": 3087,
      "momentum|v2": 1441,
      "speed|v2": 6326,
      "speed|v3": 6795,
      "cipher|v2": 8443,
      "cipher|v3": 8178,
      "frank_divergence|v3": 6710
    },
    "eventSha256": {
      "vector|original": "ad43bd10bb2f73a149693049f7026357459f9af32bc13ff305d307236976a7cb",
      "momentum|original": "668d4bc928dc34cd978549f14bf8b2a064e678393ca4a80ae37dcd1aa3965686",
      "speed|original": "ad005d49ad1915ae73bbdeeca9f1045f185eb6876eaca2c10c0c261d43fd7274",
      "cipher|original": "557acdc61889d3047509757afb3ae83a9e932435183bfbe9c1f47d1760db8e97",
      "frank_cross|original": "87216652c1d2692c30b3346e4943c321f56485e690b44cf3b015037ab8be9dc7",
      "frank_divergence|original": "12d1b79b46ce86788a015baadab17ac763853a5a171484702463d05b7e475d0b",
      "vector|v3": "8170aca4c88157fb8d6cdf5b23702f7599d68bf1a73893b6eeab03a6931f0df6",
      "momentum|v2": "edd7078d3ae0bfbde4601becc9cdf5602125b2ba1ae38a0f4e5963bd80aaa47f",
      "speed|v2": "b9288887aa681139886ae58692798fbf71e95b7c6d900f0d15d3420f09fe023b",
      "speed|v3": "1ad898624fc54bc5a4b9ff8a4e72656f9b1a2841b0c2bcab5ddee8ff095f2017",
      "cipher|v2": "03342dcd29850c37f5ab603d8d95f562d02f3afe07a2de6186073eaa0bfc39b1",
      "cipher|v3": "be69eb7d1df423659b8fdc48013bd33582a1dc2c0bfb67336ec98f9cf1e2b34d",
      "frank_divergence|v3": "6e3b5c14de08b737ef94fcd5b65c2260d22affbf2b4f9569b9f2a55d4aa333d4"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 4018,
        "confirmed": 3092,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 2978,
        "confirmed": 2317,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 6710,
        "confirmed": 5702,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:51.188286995Z"
  },
  {
    "status": "PAIR",
    "symbol": "1000PEPEUSDT",
    "timeframe": "30m",
    "bars": 24528,
    "counts": {
      "vector|original": 1324,
      "momentum|original": 598,
      "speed|original": 3954,
      "cipher|original": 3652,
      "frank_cross|original": 689,
      "frank_divergence|original": 3658,
      "vector|v3": 1493,
      "momentum|v2": 670,
      "speed|v2": 3187,
      "speed|v3": 3428,
      "cipher|v2": 4125,
      "cipher|v3": 3985,
      "frank_divergence|v3": 3311
    },
    "eventSha256": {
      "vector|original": "f3fda5d0a7d06e94a18c493eaa3430343d8ed11aacbdb4815481b5c5bed0fbbf",
      "momentum|original": "019fcf0f8c1303a5ee551120e693921f4fc56d75cbeb8476a2f2e67892febe98",
      "speed|original": "90f46cff757bf6d4b65a57f6de748d3bd8c1a40483f00138d95036c1fcf3c47e",
      "cipher|original": "40e186f6b8d928dff3e8650843f7150e510f6bff5b55c1c53490d17136b89778",
      "frank_cross|original": "d50b8b248f0c65db8f396c3b334e469258000a34feba9c783c50ec2fa91ae24e",
      "frank_divergence|original": "9eef1d860c525259d03d00922434a0e955393b404fcf3381a67b4ff15291a09d",
      "vector|v3": "3b5f1d81adf6b03f39da589b9ef20ce697b6fd51c5f54ce0188985c4489f4ae6",
      "momentum|v2": "3109e44fdb80faf222f42e6cbcbbe650e6a9dad3eddbb78702206195fb55a912",
      "speed|v2": "d501da5f9d3b7800a0cdecc0952c414bbc4e3fa3a0300e3a33ef50c8a6f9e96e",
      "speed|v3": "1d48f99762ae2d90a9b9b38fe36c64ad5e76a5930dfd6033070e57a3dccc2926",
      "cipher|v2": "e448f89b19edd9ac9f438ebcb801642f13b06d10e5c89a2bff72e82db51be08d",
      "cipher|v3": "8f578f19cb4ba2ada0c42dcd0b5a74089edf90c8e6925fe27e2b9719665dab8b",
      "frank_divergence|v3": "c9a4861978d856b9278f69439c83998be231cbe66b07a4b8dbf5a9515b3ae8ca"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 1986,
        "confirmed": 1514,
        "unresolved": 1
      },
      "cipher|v3": {
        "tested": 1471,
        "confirmed": 1139,
        "unresolved": 1
      },
      "frank_divergence|v3": {
        "tested": 3310,
        "confirmed": 2851,
        "unresolved": 1
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:55.496538909Z"
  },
  {
    "status": "PAIR",
    "symbol": "1000PEPEUSDT",
    "timeframe": "1h",
    "bars": 12264,
    "counts": {
      "vector|original": 696,
      "momentum|original": 303,
      "speed|original": 1977,
      "cipher|original": 1784,
      "frank_cross|original": 365,
      "frank_divergence|original": 1837,
      "vector|v3": 798,
      "momentum|v2": 341,
      "speed|v2": 1586,
      "speed|v3": 1707,
      "cipher|v2": 2002,
      "cipher|v3": 1932,
      "frank_divergence|v3": 1709
    },
    "eventSha256": {
      "vector|original": "b449c3fd60404457f6532e7294ecf5418bfa37ea3fb13a2071731ff2fd6f31f7",
      "momentum|original": "27ba8e2fa02752c2b828258c6c8b74299b3f160b94251630222419f6a8d88f92",
      "speed|original": "5cc8dc578bdac419eee86fa582901020ff39fc7317b46b2b577a007b4f229684",
      "cipher|original": "f0bc0cc311e2ed5d4c2d93fb49bb59f43c259d63d907b52c8d2e50f263bdcaca",
      "frank_cross|original": "36161969af4ccb2fd6b3f62560ed95530ee728408aaa209b4f07da0c06e89484",
      "frank_divergence|original": "8e1f34200ffa4d70de596cb8618d8a81bba89f4c7273efd956ba4f3b875d63b0",
      "vector|v3": "aa7ca67fc64848aca53671259d0d845b371f7b713e2b65ea97a125223ddd03fa",
      "momentum|v2": "8bf0ff7ce1f407c697832c51a623761511972b8c7882470b68871350ce8d7093",
      "speed|v2": "0ab0cdc1ad7228f6baccdd616aff6ef0f9fad8d3cf2440fdc04b2ad3ff47ac6c",
      "speed|v3": "b47797c1e72040b664ea0d413405070ec668828e26940321c1491b75af808886",
      "cipher|v2": "3f450c74fa8b7c107a2435ea17999afe1ccae0883cd9d50b37772e1a2ba51955",
      "cipher|v3": "3053d1e6fb481cc506f7b312dc4453cef587b9e4cc5fab38c78a3b45a6d68a5a",
      "frank_divergence|v3": "7984fd7826bb820966573013cc298f2c02236b8a3893bbe3dac52149712ecc20"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 970,
        "confirmed": 752,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 712,
        "confirmed": 564,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 1709,
        "confirmed": 1465,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:57.484035289Z"
  },
  {
    "status": "PAIR",
    "symbol": "1000PEPEUSDT",
    "timeframe": "4h",
    "bars": 3066,
    "counts": {
      "vector|original": 169,
      "momentum|original": 75,
      "speed|original": 439,
      "cipher|original": 456,
      "frank_cross|original": 126,
      "frank_divergence|original": 438,
      "vector|v3": 197,
      "momentum|v2": 84,
      "speed|v2": 361,
      "speed|v3": 383,
      "cipher|v2": 502,
      "cipher|v3": 487,
      "frank_divergence|v3": 400
    },
    "eventSha256": {
      "vector|original": "ac9c430686b081fe8ee2fa86e54b3d1b62cdba86a65af4edbea039c0e5d67336",
      "momentum|original": "4945eea92a9c0397615a087d0d4bd82659363690396b3a41d9d86826ac0cdd9a",
      "speed|original": "3e777deafde94069e1f53b771002ea41fc2dccafd4ec18aefb96d7aa9003bbb8",
      "cipher|original": "a4f3525844d9bf9dfc91d26361d859d4e7796a59e78feea9bb3d9a811a7d3b8a",
      "frank_cross|original": "17fe2ab0281d9098708320dcfd69ba80179dbebb2ebc733ab08a36b4c3203514",
      "frank_divergence|original": "7737371e538842960f42aefb42c6ef02347f8f2d5a1b08804ab6780c99bf26d9",
      "vector|v3": "46b913a3ca67121cf111a1eeabfc9a98354545c8ca7a575a5d981c5de7ab27d6",
      "momentum|v2": "e9c0c0837d74097a3703e8df6c227af21396ca3782cbfa9dd0fdf3127bc032fe",
      "speed|v2": "4a8ab01c325fd03d78c7540eedfceff63651e39a6e32aab971cf3da0a62dbbea",
      "speed|v3": "6af9d69723c61732d5c703630f8ec11af5cbd35aa4a01791c743eef55c21677f",
      "cipher|v2": "7304f7f1a1cb8376c2022244506a030c62a03f9f6c03cfb6ab8318f4264a8950",
      "cipher|v3": "0a9902d802f70026d53d3b2254fcc06a7735df7091ac27834bacd47f74ebaba4",
      "frank_divergence|v3": "468091895e96f815c9733564905d567e65eb0819ac65c9ad851fa61414d89b19"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 238,
        "confirmed": 192,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 181,
        "confirmed": 150,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 400,
        "confirmed": 331,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:58.074301371Z"
  },
  {
    "status": "PAIR",
    "symbol": "1000PEPEUSDT",
    "timeframe": "1d",
    "bars": 510,
    "counts": {
      "vector|original": 30,
      "momentum|original": 9,
      "speed|original": 49,
      "cipher|original": 71,
      "frank_cross|original": 29,
      "frank_divergence|original": 74,
      "vector|v3": 32,
      "momentum|v2": 10,
      "speed|v2": 41,
      "speed|v3": 44,
      "cipher|v2": 81,
      "cipher|v3": 77,
      "frank_divergence|v3": 66
    },
    "eventSha256": {
      "vector|original": "9a301fa2393ef961a8876bd8ab5fe710d2a978d0733494fe129e6be62a8f337b",
      "momentum|original": "a07cd13a4df98b05b2c0e31216b13cc7f9800cee2802f530a81995d95c41461b",
      "speed|original": "2e79e6c36045176a45bf8a68af3853fba1f105aeeba8648711f8c5dc6538f773",
      "cipher|original": "944c1b8566a5ca115332ef04360f731c698bcd34504d7517d8cc149c33a59e58",
      "frank_cross|original": "701efb3a186b10b716b8e0fedf1f95a9827a8f0b038d67ae17d2c919047b645f",
      "frank_divergence|original": "2e0e46fa06c77f29978920fb5113d0547a06969f0b225fc0a2ed6824ad21925b",
      "vector|v3": "766fca014b86a8770d9130e09ec80ad7f50b8d562bffbd3cbc7459369dbeb076",
      "momentum|v2": "74e86a325acb12e03d733d201d241e80ac03756a327ffa53277728499d5c82c7",
      "speed|v2": "56bb1f6aee4ef4a5e10594b3fea56eee425ae09562e541957ee4b65477ac4655",
      "speed|v3": "320a36e55f3331a7b057fcfd82e863b6718ff66602e9a9131d8f8a1bc999df07",
      "cipher|v2": "12dd87077a50c04468c48e6c448bf8fb8f4651f101708a74d7a5c69532c02c42",
      "cipher|v3": "40dc502801b5baaf1d20eff1925952cd5bf409d2aefd0215616d6420de1f8573",
      "frank_divergence|v3": "5102b4ed5b0a7a4d3cdf79278a5e849cdd2049fa3c46cd993245d4b18cab4478"
    },
    "warningStats": {
      "cipher|v2": {
        "tested": 40,
        "confirmed": 30,
        "unresolved": 0
      },
      "cipher|v3": {
        "tested": 26,
        "confirmed": 20,
        "unresolved": 0
      },
      "frank_divergence|v3": {
        "tested": 66,
        "confirmed": 59,
        "unresolved": 0
      }
    },
    "simulations": 39,
    "comparisonOnly": true,
    "timestamp": "2026-11-27T17:19:58.105667673Z"
  },
  {
    "status": "PASS",
    "pairs": 25,
    "sourceBars": 617151,
    "trainingBars": 431998,
    "events": 619484,
    "comparisons": 325,
    "simulations": 975,
    "warnings": 75,
    "holdoutUsedForSignals": false,
    "readOnly": true,
    "noTrading": true,
    "timestamp": "2026-11-27T17:19:58.180305485Z"
  }
]
```
