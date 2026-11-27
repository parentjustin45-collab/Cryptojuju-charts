# Binance vs Bitunix paired study — 2026-11-27

PASS: 25/25 pairs, 26250 paired evaluation candles (each venue), 160 additional warm-up bars per configuration, 150 original-indicator channel comparisons. UTC 2026-09-01 inclusive to 2026-10-01 exclusive. Source code 7dc2d791f8af299c617745f3419a89d22c1d217f; CI [46031158308](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/46031158308), two unit tests and five live jobs passed. Initial synthetic test failed on timestamp 0; fixture corrected without weakening production validation.

Binance official USD-M monthly archives: 75 ZIP checksums verified. Bitunix independently fetched twice, adaptive anchors, strict continuity and OHLC/source proof. No PostgreSQL writes, no Render deployment, no main changes. Identical original algorithms and common current Bitunix price-step parameter on both feeds; not a verification of Binance historical tick metadata. Volume ratio refers to reported base-volume fields, not an independently reconciled contract-unit or quote-notional conversion. Relative volume: current volume / trailing 20-bar mean. Warm-up fixed 160 bars, Daily evaluation only 30 bars; overlapping timeframes not independent. Matching same direction, one-to-one greedy nearest within tolerance; F1 = 2*matches/(events_A+events_B), not win rate or profitability. Only original indicator channels; experimental candidates not evaluated. This overlapping period already belongs to the historical study, not independent performance validation.

| Channel | Exact F1 | ±1 bar | ±3 bars |
|---|---:|---:|---:|
| vector | 67.36% | 70.19% | 74.10% |
| momentum | 96.92% | 98.78% | 98.78% |
| speed | 76.62% | 77.67% | 79.40% |
| cipher | 97.80% | 99.38% | 99.38% |
| frank_cross | 97.57% | 98.31% | 98.45% |
| frank_divergence | 93.45% | 94.62% | 95.34% |

| Symbol (15m) | Binance/Bitunix reported volume | Relative volume Pearson r | Mean absolute close gap (bps) |
|---|---:|---:|---:|
| BTCUSDT | 5.20 | 0.9097 | 0.0729 |
| ETHUSDT | 5.64 | 0.9295 | 0.1320 |
| SOLUSDT | 6.65 | 0.8667 | 0.5480 |
| HYPEUSDT | 15.23 | 0.7723 | 0.3758 |
| 1000PEPEUSDT | 15.05 | 0.8938 | 0.6978 |

Close gap means across 25 configurations 0.0151–0.8333 bps; return correlations 0.999388–1.000000. Strong cross-venue similarity for price-based signals; lower agreement for volume-sensitive Vector/SPEED. Recommendation: separate exchange namespace and provenance, Binance as complementary historical research source, Bitunix as reference and execution-specific validation. No large import yet; next verify historical availability, completeness, instrument mapping and storage estimates; do not splice feeds. Validate volume-sensitive indicators separately. More periods/regimes and independent data before any promotion.

Evidence: [BTCUSDT](research/cross-exchange-2026-11-27/BTCUSDT.json), [ETHUSDT](research/cross-exchange-2026-11-27/ETHUSDT.json), [SOLUSDT](research/cross-exchange-2026-11-27/SOLUSDT.json), [HYPEUSDT](research/cross-exchange-2026-11-27/HYPEUSDT.json), [1000PEPEUSDT](research/cross-exchange-2026-11-27/1000PEPEUSDT.json). Detailed per-window source receipts in CI output artifacts. Aggregated metrics below.

```json
{
  "passed": 25,
  "bars": 26250,
  "archives": 75,
  "minReturnCorrelation": 0.9993884266619881,
  "maxReturnCorrelation": 0.9999999619140483,
  "minRelativeVolumeCorrelation": 0.7723347212955434,
  "maxRelativeVolumeCorrelation": 0.9868714128826704,
  "minCloseMeanBps": 0.015114252046662576,
  "maxCloseMeanBps": 0.8333229410004693,
  "aggregate": {
    "vector": {
      "exact": {
        "matched": 1000,
        "bitunix": 1548,
        "binance": 1421,
        "f1": 0.6736274840013473
      },
      "within1": {
        "matched": 1042,
        "bitunix": 1548,
        "binance": 1421,
        "f1": 0.7019198383294039
      },
      "within3": {
        "matched": 1100,
        "bitunix": 1548,
        "binance": 1421,
        "f1": 0.740990232401482
      }
    },
    "momentum": {
      "exact": {
        "matched": 677,
        "bitunix": 698,
        "binance": 699,
        "f1": 0.9692197566213314
      },
      "within1": {
        "matched": 690,
        "bitunix": 698,
        "binance": 699,
        "f1": 0.9878310665712241
      },
      "within3": {
        "matched": 690,
        "bitunix": 698,
        "binance": 699,
        "f1": 0.9878310665712241
      }
    },
    "speed": {
      "exact": {
        "matched": 3503,
        "bitunix": 4760,
        "binance": 4384,
        "f1": 0.7661854768153981
      },
      "within1": {
        "matched": 3551,
        "bitunix": 4760,
        "binance": 4384,
        "f1": 0.7766841644794401
      },
      "within3": {
        "matched": 3630,
        "bitunix": 4760,
        "binance": 4384,
        "f1": 0.7939632545931758
      }
    },
    "cipher": {
      "exact": {
        "matched": 3952,
        "bitunix": 4032,
        "binance": 4050,
        "f1": 0.9779757485770849
      },
      "within1": {
        "matched": 4016,
        "bitunix": 4032,
        "binance": 4050,
        "f1": 0.993813412521653
      },
      "within3": {
        "matched": 4016,
        "bitunix": 4032,
        "binance": 4050,
        "f1": 0.993813412521653
      }
    },
    "frank_cross": {
      "exact": {
        "matched": 662,
        "bitunix": 682,
        "binance": 675,
        "f1": 0.9756816507000737
      },
      "within1": {
        "matched": 667,
        "bitunix": 682,
        "binance": 675,
        "f1": 0.9830508474576272
      },
      "within3": {
        "matched": 668,
        "bitunix": 682,
        "binance": 675,
        "f1": 0.9845246868091379
      }
    },
    "frank_divergence": {
      "exact": {
        "matched": 3751,
        "bitunix": 4018,
        "binance": 4010,
        "f1": 0.9344793223716991
      },
      "within1": {
        "matched": 3798,
        "bitunix": 4018,
        "binance": 4010,
        "f1": 0.9461883408071748
      },
      "within3": {
        "matched": 3827,
        "bitunix": 4018,
        "binance": 4010,
        "f1": 0.9534130543099153
      }
    }
  },
  "bySymbol": {
    "BTCUSDT": {
      "volumeRatio": 5.202033484515626,
      "closeBps": 0.07285280372539506,
      "relativeVolumeCorr": 0.9097368176011926,
      "aggregate": {
        "vector": {
          "exact": {
            "matched": 221,
            "bitunix": 310,
            "binance": 307,
            "f1": 0.7163695299837926
          },
          "within1": {
            "matched": 229,
            "bitunix": 310,
            "binance": 307,
            "f1": 0.7423014586709886
          },
          "within3": {
            "matched": 241,
            "bitunix": 310,
            "binance": 307,
            "f1": 0.7811993517017828
          }
        },
        "momentum": {
          "exact": {
            "matched": 142,
            "bitunix": 144,
            "binance": 144,
            "f1": 0.9861111111111112
          },
          "within1": {
            "matched": 143,
            "bitunix": 144,
            "binance": 144,
            "f1": 0.9930555555555556
          },
          "within3": {
            "matched": 143,
            "bitunix": 144,
            "binance": 144,
            "f1": 0.9930555555555556
          }
        },
        "speed": {
          "exact": {
            "matched": 782,
            "bitunix": 1026,
            "binance": 934,
            "f1": 0.7979591836734694
          },
          "within1": {
            "matched": 785,
            "bitunix": 1026,
            "binance": 934,
            "f1": 0.8010204081632653
          },
          "within3": {
            "matched": 799,
            "bitunix": 1026,
            "binance": 934,
            "f1": 0.8153061224489796
          }
        },
        "cipher": {
          "exact": {
            "matched": 788,
            "bitunix": 802,
            "binance": 804,
            "f1": 0.9813200498132005
          },
          "within1": {
            "matched": 800,
            "bitunix": 802,
            "binance": 804,
            "f1": 0.9962640099626401
          },
          "within3": {
            "matched": 800,
            "bitunix": 802,
            "binance": 804,
            "f1": 0.9962640099626401
          }
        },
        "frank_cross": {
          "exact": {
            "matched": 133,
            "bitunix": 135,
            "binance": 136,
            "f1": 0.981549815498155
          },
          "within1": {
            "matched": 134,
            "bitunix": 135,
            "binance": 136,
            "f1": 0.988929889298893
          },
          "within3": {
            "matched": 134,
            "bitunix": 135,
            "binance": 136,
            "f1": 0.988929889298893
          }
        },
        "frank_divergence": {
          "exact": {
            "matched": 759,
            "bitunix": 788,
            "binance": 779,
            "f1": 0.9687300574345884
          },
          "within1": {
            "matched": 765,
            "bitunix": 788,
            "binance": 779,
            "f1": 0.9763880025526483
          },
          "within3": {
            "matched": 766,
            "bitunix": 788,
            "binance": 779,
            "f1": 0.9776643267389917
          }
        }
      }
    },
    "ETHUSDT": {
      "volumeRatio": 5.639696954002644,
      "closeBps": 0.13201930123701822,
      "relativeVolumeCorr": 0.9294535779403128,
      "aggregate": {
        "vector": {
          "exact": {
            "matched": 197,
            "bitunix": 294,
            "binance": 271,
            "f1": 0.6973451327433628
          },
          "within1": {
            "matched": 202,
            "bitunix": 294,
            "binance": 271,
            "f1": 0.7150442477876107
          },
          "within3": {
            "matched": 210,
            "bitunix": 294,
            "binance": 271,
            "f1": 0.7433628318584071
          }
        },
        "momentum": {
          "exact": {
            "matched": 136,
            "bitunix": 141,
            "binance": 141,
            "f1": 0.9645390070921985
          },
          "within1": {
            "matched": 140,
            "bitunix": 141,
            "binance": 141,
            "f1": 0.9929078014184397
          },
          "within3": {
            "matched": 140,
            "bitunix": 141,
            "binance": 141,
            "f1": 0.9929078014184397
          }
        },
        "speed": {
          "exact": {
            "matched": 800,
            "bitunix": 984,
            "binance": 923,
            "f1": 0.8390141583639223
          },
          "within1": {
            "matched": 802,
            "bitunix": 984,
            "binance": 923,
            "f1": 0.8411116937598322
          },
          "within3": {
            "matched": 811,
            "bitunix": 984,
            "binance": 923,
            "f1": 0.8505506030414264
          }
        },
        "cipher": {
          "exact": {
            "matched": 778,
            "bitunix": 791,
            "binance": 793,
            "f1": 0.9823232323232324
          },
          "within1": {
            "matched": 787,
            "bitunix": 791,
            "binance": 793,
            "f1": 0.9936868686868687
          },
          "within3": {
            "matched": 787,
            "bitunix": 791,
            "binance": 793,
            "f1": 0.9936868686868687
          }
        },
        "frank_cross": {
          "exact": {
            "matched": 131,
            "bitunix": 136,
            "binance": 134,
            "f1": 0.9703703703703703
          },
          "within1": {
            "matched": 132,
            "bitunix": 136,
            "binance": 134,
            "f1": 0.9777777777777777
          },
          "within3": {
            "matched": 133,
            "bitunix": 136,
            "binance": 134,
            "f1": 0.9851851851851852
          }
        },
        "frank_divergence": {
          "exact": {
            "matched": 776,
            "bitunix": 820,
            "binance": 818,
            "f1": 0.9474969474969475
          },
          "within1": {
            "matched": 784,
            "bitunix": 820,
            "binance": 818,
            "f1": 0.9572649572649573
          },
          "within3": {
            "matched": 791,
            "bitunix": 820,
            "binance": 818,
            "f1": 0.9658119658119658
          }
        }
      }
    },
    "SOLUSDT": {
      "volumeRatio": 6.646479780254577,
      "closeBps": 0.5480225906007827,
      "relativeVolumeCorr": 0.8667215100065427,
      "aggregate": {
        "vector": {
          "exact": {
            "matched": 184,
            "bitunix": 297,
            "binance": 265,
            "f1": 0.6548042704626335
          },
          "within1": {
            "matched": 194,
            "bitunix": 297,
            "binance": 265,
            "f1": 0.6903914590747331
          },
          "within3": {
            "matched": 208,
            "bitunix": 297,
            "binance": 265,
            "f1": 0.7402135231316725
          }
        },
        "momentum": {
          "exact": {
            "matched": 147,
            "bitunix": 153,
            "binance": 153,
            "f1": 0.9607843137254902
          },
          "within1": {
            "matched": 151,
            "bitunix": 153,
            "binance": 153,
            "f1": 0.9869281045751634
          },
          "within3": {
            "matched": 151,
            "bitunix": 153,
            "binance": 153,
            "f1": 0.9869281045751634
          }
        },
        "speed": {
          "exact": {
            "matched": 623,
            "bitunix": 894,
            "binance": 812,
            "f1": 0.7303634232121923
          },
          "within1": {
            "matched": 640,
            "bitunix": 894,
            "binance": 812,
            "f1": 0.7502930832356389
          },
          "within3": {
            "matched": 655,
            "bitunix": 894,
            "binance": 812,
            "f1": 0.7678780773739742
          }
        },
        "cipher": {
          "exact": {
            "matched": 798,
            "bitunix": 807,
            "binance": 811,
            "f1": 0.9864029666254636
          },
          "within1": {
            "matched": 805,
            "bitunix": 807,
            "binance": 811,
            "f1": 0.9950556242274413
          },
          "within3": {
            "matched": 805,
            "bitunix": 807,
            "binance": 811,
            "f1": 0.9950556242274413
          }
        },
        "frank_cross": {
          "exact": {
            "matched": 142,
            "bitunix": 146,
            "binance": 148,
            "f1": 0.9659863945578231
          },
          "within1": {
            "matched": 145,
            "bitunix": 146,
            "binance": 148,
            "f1": 0.9863945578231292
          },
          "within3": {
            "matched": 145,
            "bitunix": 146,
            "binance": 148,
            "f1": 0.9863945578231292
          }
        },
        "frank_divergence": {
          "exact": {
            "matched": 739,
            "bitunix": 790,
            "binance": 790,
            "f1": 0.9354430379746835
          },
          "within1": {
            "matched": 741,
            "bitunix": 790,
            "binance": 790,
            "f1": 0.9379746835443038
          },
          "within3": {
            "matched": 744,
            "bitunix": 790,
            "binance": 790,
            "f1": 0.9417721518987342
          }
        }
      }
    },
    "HYPEUSDT": {
      "volumeRatio": 15.232215195635204,
      "closeBps": 0.37576288418601655,
      "relativeVolumeCorr": 0.7723347212955434,
      "aggregate": {
        "vector": {
          "exact": {
            "matched": 184,
            "bitunix": 329,
            "binance": 303,
            "f1": 0.5822784810126582
          },
          "within1": {
            "matched": 195,
            "bitunix": 329,
            "binance": 303,
            "f1": 0.6170886075949367
          },
          "within3": {
            "matched": 211,
            "bitunix": 329,
            "binance": 303,
            "f1": 0.6677215189873418
          }
        },
        "momentum": {
          "exact": {
            "matched": 132,
            "bitunix": 134,
            "binance": 135,
            "f1": 0.9814126394052045
          },
          "within1": {
            "matched": 133,
            "bitunix": 134,
            "binance": 135,
            "f1": 0.9888475836431226
          },
          "within3": {
            "matched": 133,
            "bitunix": 134,
            "binance": 135,
            "f1": 0.9888475836431226
          }
        },
        "speed": {
          "exact": {
            "matched": 600,
            "bitunix": 945,
            "binance": 839,
            "f1": 0.672645739910314
          },
          "within1": {
            "matched": 617,
            "bitunix": 945,
            "binance": 839,
            "f1": 0.6917040358744395
          },
          "within3": {
            "matched": 643,
            "bitunix": 945,
            "binance": 839,
            "f1": 0.7208520179372198
          }
        },
        "cipher": {
          "exact": {
            "matched": 797,
            "bitunix": 816,
            "binance": 824,
            "f1": 0.9719512195121951
          },
          "within1": {
            "matched": 814,
            "bitunix": 816,
            "binance": 824,
            "f1": 0.9926829268292683
          },
          "within3": {
            "matched": 814,
            "bitunix": 816,
            "binance": 824,
            "f1": 0.9926829268292683
          }
        },
        "frank_cross": {
          "exact": {
            "matched": 125,
            "bitunix": 131,
            "binance": 125,
            "f1": 0.9765625
          },
          "within1": {
            "matched": 125,
            "bitunix": 131,
            "binance": 125,
            "f1": 0.9765625
          },
          "within3": {
            "matched": 125,
            "bitunix": 131,
            "binance": 125,
            "f1": 0.9765625
          }
        },
        "frank_divergence": {
          "exact": {
            "matched": 729,
            "bitunix": 804,
            "binance": 812,
            "f1": 0.9022277227722773
          },
          "within1": {
            "matched": 746,
            "bitunix": 804,
            "binance": 812,
            "f1": 0.9232673267326733
          },
          "within3": {
            "matched": 756,
            "bitunix": 804,
            "binance": 812,
            "f1": 0.9356435643564357
          }
        }
      }
    },
    "1000PEPEUSDT": {
      "volumeRatio": 15.050130683048016,
      "closeBps": 0.6977920146603525,
      "relativeVolumeCorr": 0.8937909494063245,
      "aggregate": {
        "vector": {
          "exact": {
            "matched": 214,
            "bitunix": 318,
            "binance": 275,
            "f1": 0.7217537942664418
          },
          "within1": {
            "matched": 222,
            "bitunix": 318,
            "binance": 275,
            "f1": 0.7487352445193929
          },
          "within3": {
            "matched": 230,
            "bitunix": 318,
            "binance": 275,
            "f1": 0.7757166947723441
          }
        },
        "momentum": {
          "exact": {
            "matched": 120,
            "bitunix": 126,
            "binance": 126,
            "f1": 0.9523809523809523
          },
          "within1": {
            "matched": 123,
            "bitunix": 126,
            "binance": 126,
            "f1": 0.9761904761904762
          },
          "within3": {
            "matched": 123,
            "bitunix": 126,
            "binance": 126,
            "f1": 0.9761904761904762
          }
        },
        "speed": {
          "exact": {
            "matched": 698,
            "bitunix": 911,
            "binance": 876,
            "f1": 0.7811975377728035
          },
          "within1": {
            "matched": 707,
            "bitunix": 911,
            "binance": 876,
            "f1": 0.7912702853945159
          },
          "within3": {
            "matched": 722,
            "bitunix": 911,
            "binance": 876,
            "f1": 0.8080581980973699
          }
        },
        "cipher": {
          "exact": {
            "matched": 791,
            "bitunix": 816,
            "binance": 818,
            "f1": 0.9681762545899633
          },
          "within1": {
            "matched": 810,
            "bitunix": 816,
            "binance": 818,
            "f1": 0.9914320685434517
          },
          "within3": {
            "matched": 810,
            "bitunix": 816,
            "binance": 818,
            "f1": 0.9914320685434517
          }
        },
        "frank_cross": {
          "exact": {
            "matched": 131,
            "bitunix": 134,
            "binance": 132,
            "f1": 0.9849624060150376
          },
          "within1": {
            "matched": 131,
            "bitunix": 134,
            "binance": 132,
            "f1": 0.9849624060150376
          },
          "within3": {
            "matched": 131,
            "bitunix": 134,
            "binance": 132,
            "f1": 0.9849624060150376
          }
        },
        "frank_divergence": {
          "exact": {
            "matched": 748,
            "bitunix": 816,
            "binance": 811,
            "f1": 0.9194837123540258
          },
          "within1": {
            "matched": 762,
            "bitunix": 816,
            "binance": 811,
            "f1": 0.9366933005531654
          },
          "within3": {
            "matched": 770,
            "bitunix": 816,
            "binance": 811,
            "f1": 0.9465273509526736
          }
        }
      }
    }
  },
  "byTF": {
    "15m": {
      "vector": {
        "exact": {
          "matched": 513,
          "bitunix": 856,
          "binance": 763,
          "f1": 0.6337245213094502
        },
        "within1": {
          "matched": 542,
          "bitunix": 856,
          "binance": 763,
          "f1": 0.6695491043854231
        },
        "within3": {
          "matched": 578,
          "bitunix": 856,
          "binance": 763,
          "f1": 0.7140210006176653
        }
      },
      "momentum": {
        "exact": {
          "matched": 380,
          "bitunix": 396,
          "binance": 393,
          "f1": 0.9632446134347274
        },
        "within1": {
          "matched": 389,
          "bitunix": 396,
          "binance": 393,
          "f1": 0.9860583016476553
        },
        "within3": {
          "matched": 389,
          "bitunix": 396,
          "binance": 393,
          "f1": 0.9860583016476553
        }
      },
      "speed": {
        "exact": {
          "matched": 1823,
          "bitunix": 2576,
          "binance": 2333,
          "f1": 0.7427174577306987
        },
        "within1": {
          "matched": 1849,
          "bitunix": 2576,
          "binance": 2333,
          "f1": 0.753310246486046
        },
        "within3": {
          "matched": 1898,
          "bitunix": 2576,
          "binance": 2333,
          "f1": 0.7732735791403544
        }
      },
      "cipher": {
        "exact": {
          "matched": 2179,
          "bitunix": 2226,
          "binance": 2238,
          "f1": 0.9762544802867383
        },
        "within1": {
          "matched": 2220,
          "bitunix": 2226,
          "binance": 2238,
          "f1": 0.9946236559139785
        },
        "within3": {
          "matched": 2220,
          "bitunix": 2226,
          "binance": 2238,
          "f1": 0.9946236559139785
        }
      },
      "frank_cross": {
        "exact": {
          "matched": 325,
          "bitunix": 337,
          "binance": 332,
          "f1": 0.9715994020926756
        },
        "within1": {
          "matched": 327,
          "bitunix": 337,
          "binance": 332,
          "f1": 0.9775784753363229
        },
        "within3": {
          "matched": 327,
          "bitunix": 337,
          "binance": 332,
          "f1": 0.9775784753363229
        }
      },
      "frank_divergence": {
        "exact": {
          "matched": 1984,
          "bitunix": 2150,
          "binance": 2139,
          "f1": 0.9251573793425041
        },
        "within1": {
          "matched": 2015,
          "bitunix": 2150,
          "binance": 2139,
          "f1": 0.9396129633947307
        },
        "within3": {
          "matched": 2033,
          "bitunix": 2150,
          "binance": 2139,
          "f1": 0.9480065283282817
        }
      }
    },
    "30m": {
      "vector": {
        "exact": {
          "matched": 317,
          "bitunix": 465,
          "binance": 430,
          "f1": 0.7083798882681565
        },
        "within1": {
          "matched": 329,
          "bitunix": 465,
          "binance": 430,
          "f1": 0.735195530726257
        },
        "within3": {
          "matched": 343,
          "bitunix": 465,
          "binance": 430,
          "f1": 0.7664804469273743
        }
      },
      "momentum": {
        "exact": {
          "matched": 176,
          "bitunix": 179,
          "binance": 181,
          "f1": 0.9777777777777777
        },
        "within1": {
          "matched": 178,
          "bitunix": 179,
          "binance": 181,
          "f1": 0.9888888888888889
        },
        "within3": {
          "matched": 178,
          "bitunix": 179,
          "binance": 181,
          "f1": 0.9888888888888889
        }
      },
      "speed": {
        "exact": {
          "matched": 1012,
          "bitunix": 1364,
          "binance": 1260,
          "f1": 0.7713414634146342
        },
        "within1": {
          "matched": 1031,
          "bitunix": 1364,
          "binance": 1260,
          "f1": 0.7858231707317073
        },
        "within3": {
          "matched": 1055,
          "bitunix": 1364,
          "binance": 1260,
          "f1": 0.8041158536585366
        }
      },
      "cipher": {
        "exact": {
          "matched": 1092,
          "bitunix": 1118,
          "binance": 1118,
          "f1": 0.9767441860465116
        },
        "within1": {
          "matched": 1110,
          "bitunix": 1118,
          "binance": 1118,
          "f1": 0.9928443649373881
        },
        "within3": {
          "matched": 1110,
          "bitunix": 1118,
          "binance": 1118,
          "f1": 0.9928443649373881
        }
      },
      "frank_cross": {
        "exact": {
          "matched": 172,
          "bitunix": 179,
          "binance": 178,
          "f1": 0.9635854341736695
        },
        "within1": {
          "matched": 175,
          "bitunix": 179,
          "binance": 178,
          "f1": 0.9803921568627451
        },
        "within3": {
          "matched": 176,
          "bitunix": 179,
          "binance": 178,
          "f1": 0.9859943977591037
        }
      },
      "frank_divergence": {
        "exact": {
          "matched": 1072,
          "bitunix": 1146,
          "binance": 1139,
          "f1": 0.9382932166301969
        },
        "within1": {
          "matched": 1084,
          "bitunix": 1146,
          "binance": 1139,
          "f1": 0.9487964989059081
        },
        "within3": {
          "matched": 1092,
          "bitunix": 1146,
          "binance": 1139,
          "f1": 0.9557986870897155
        }
      }
    },
    "1h": {
      "vector": {
        "exact": {
          "matched": 134,
          "bitunix": 178,
          "binance": 179,
          "f1": 0.7507002801120448
        },
        "within1": {
          "matched": 135,
          "bitunix": 178,
          "binance": 179,
          "f1": 0.7563025210084033
        },
        "within3": {
          "matched": 141,
          "bitunix": 178,
          "binance": 179,
          "f1": 0.7899159663865546
        }
      },
      "momentum": {
        "exact": {
          "matched": 86,
          "bitunix": 87,
          "binance": 89,
          "f1": 0.9772727272727273
        },
        "within1": {
          "matched": 87,
          "bitunix": 87,
          "binance": 89,
          "f1": 0.9886363636363636
        },
        "within3": {
          "matched": 87,
          "bitunix": 87,
          "binance": 89,
          "f1": 0.9886363636363636
        }
      },
      "speed": {
        "exact": {
          "matched": 530,
          "bitunix": 659,
          "binance": 631,
          "f1": 0.8217054263565892
        },
        "within1": {
          "matched": 532,
          "bitunix": 659,
          "binance": 631,
          "f1": 0.8248062015503876
        },
        "within3": {
          "matched": 538,
          "bitunix": 659,
          "binance": 631,
          "f1": 0.834108527131783
        }
      },
      "cipher": {
        "exact": {
          "matched": 534,
          "bitunix": 541,
          "binance": 547,
          "f1": 0.9816176470588235
        },
        "within1": {
          "matched": 539,
          "bitunix": 541,
          "binance": 547,
          "f1": 0.9908088235294118
        },
        "within3": {
          "matched": 539,
          "bitunix": 541,
          "binance": 547,
          "f1": 0.9908088235294118
        }
      },
      "frank_cross": {
        "exact": {
          "matched": 119,
          "bitunix": 120,
          "binance": 119,
          "f1": 0.99581589958159
        },
        "within1": {
          "matched": 119,
          "bitunix": 120,
          "binance": 119,
          "f1": 0.99581589958159
        },
        "within3": {
          "matched": 119,
          "bitunix": 120,
          "binance": 119,
          "f1": 0.99581589958159
        }
      },
      "frank_divergence": {
        "exact": {
          "matched": 538,
          "bitunix": 561,
          "binance": 570,
          "f1": 0.9513704686118479
        },
        "within1": {
          "matched": 541,
          "bitunix": 561,
          "binance": 570,
          "f1": 0.9566755083996463
        },
        "within3": {
          "matched": 544,
          "bitunix": 561,
          "binance": 570,
          "f1": 0.9619805481874447
        }
      }
    },
    "4h": {
      "vector": {
        "exact": {
          "matched": 30,
          "bitunix": 43,
          "binance": 42,
          "f1": 0.7058823529411765
        },
        "within1": {
          "matched": 30,
          "bitunix": 43,
          "binance": 42,
          "f1": 0.7058823529411765
        },
        "within3": {
          "matched": 32,
          "bitunix": 43,
          "binance": 42,
          "f1": 0.7529411764705882
        }
      },
      "momentum": {
        "exact": {
          "matched": 30,
          "bitunix": 31,
          "binance": 31,
          "f1": 0.967741935483871
        },
        "within1": {
          "matched": 31,
          "bitunix": 31,
          "binance": 31,
          "f1": 1
        },
        "within3": {
          "matched": 31,
          "bitunix": 31,
          "binance": 31,
          "f1": 1
        }
      },
      "speed": {
        "exact": {
          "matched": 132,
          "bitunix": 153,
          "binance": 147,
          "f1": 0.88
        },
        "within1": {
          "matched": 133,
          "bitunix": 153,
          "binance": 147,
          "f1": 0.8866666666666667
        },
        "within3": {
          "matched": 133,
          "bitunix": 153,
          "binance": 147,
          "f1": 0.8866666666666667
        }
      },
      "cipher": {
        "exact": {
          "matched": 127,
          "bitunix": 127,
          "binance": 127,
          "f1": 1
        },
        "within1": {
          "matched": 127,
          "bitunix": 127,
          "binance": 127,
          "f1": 1
        },
        "within3": {
          "matched": 127,
          "bitunix": 127,
          "binance": 127,
          "f1": 1
        }
      },
      "frank_cross": {
        "exact": {
          "matched": 32,
          "bitunix": 32,
          "binance": 32,
          "f1": 1
        },
        "within1": {
          "matched": 32,
          "bitunix": 32,
          "binance": 32,
          "f1": 1
        },
        "within3": {
          "matched": 32,
          "bitunix": 32,
          "binance": 32,
          "f1": 1
        }
      },
      "frank_divergence": {
        "exact": {
          "matched": 133,
          "bitunix": 136,
          "binance": 137,
          "f1": 0.9743589743589743
        },
        "within1": {
          "matched": 134,
          "bitunix": 136,
          "binance": 137,
          "f1": 0.9816849816849816
        },
        "within3": {
          "matched": 134,
          "bitunix": 136,
          "binance": 137,
          "f1": 0.9816849816849816
        }
      }
    },
    "1d": {
      "vector": {
        "exact": {
          "matched": 6,
          "bitunix": 6,
          "binance": 7,
          "f1": 0.9230769230769231
        },
        "within1": {
          "matched": 6,
          "bitunix": 6,
          "binance": 7,
          "f1": 0.9230769230769231
        },
        "within3": {
          "matched": 6,
          "bitunix": 6,
          "binance": 7,
          "f1": 0.9230769230769231
        }
      },
      "momentum": {
        "exact": {
          "matched": 5,
          "bitunix": 5,
          "binance": 5,
          "f1": 1
        },
        "within1": {
          "matched": 5,
          "bitunix": 5,
          "binance": 5,
          "f1": 1
        },
        "within3": {
          "matched": 5,
          "bitunix": 5,
          "binance": 5,
          "f1": 1
        }
      },
      "speed": {
        "exact": {
          "matched": 6,
          "bitunix": 8,
          "binance": 13,
          "f1": 0.5714285714285714
        },
        "within1": {
          "matched": 6,
          "bitunix": 8,
          "binance": 13,
          "f1": 0.5714285714285714
        },
        "within3": {
          "matched": 6,
          "bitunix": 8,
          "binance": 13,
          "f1": 0.5714285714285714
        }
      },
      "cipher": {
        "exact": {
          "matched": 20,
          "bitunix": 20,
          "binance": 20,
          "f1": 1
        },
        "within1": {
          "matched": 20,
          "bitunix": 20,
          "binance": 20,
          "f1": 1
        },
        "within3": {
          "matched": 20,
          "bitunix": 20,
          "binance": 20,
          "f1": 1
        }
      },
      "frank_cross": {
        "exact": {
          "matched": 14,
          "bitunix": 14,
          "binance": 14,
          "f1": 1
        },
        "within1": {
          "matched": 14,
          "bitunix": 14,
          "binance": 14,
          "f1": 1
        },
        "within3": {
          "matched": 14,
          "bitunix": 14,
          "binance": 14,
          "f1": 1
        }
      },
      "frank_divergence": {
        "exact": {
          "matched": 24,
          "bitunix": 25,
          "binance": 25,
          "f1": 0.96
        },
        "within1": {
          "matched": 24,
          "bitunix": 25,
          "binance": 25,
          "f1": 0.96
        },
        "within3": {
          "matched": 24,
          "bitunix": 25,
          "binance": 25,
          "f1": 0.96
        }
      }
    }
  }
}
```
