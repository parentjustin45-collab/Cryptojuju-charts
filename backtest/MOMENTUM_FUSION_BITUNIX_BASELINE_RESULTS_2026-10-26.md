# Momentum Fusion V1.0 — Audit initial des réglages Pine fournis

**Date de l'exécution:** 27 octobre 2026, 01:59:43 UTC (**26 octobre, 21 h 59 au Québec**). Résultats GitHub Actions [#40435803054](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40435803054), contrôle global [#40435803111](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40435803111) : **réussis**. Le rapport de marché conserve explicitement `state: PARTIAL_QUARANTINE`, soit deux marchés sans historique admissible.

**Aucun réglage original changé, aucun ordre de trading, aucune modification Vector V1.1/V1.4, WATCH, Render ou `main`.** Recherche uniquement dans `dev/v1.26.0`.

## Protocole figé avant lecture

- RSI 14, Stoch RSI 14/SMA 3, Momentum 10/rang relatif 100, composite EMA 3, poids 1:1:1.
- EMA 21/55 activé, seuils 30/70, extrêmes 10/90, 4 divergences avec pivots 5 gauche / 5 droite et distance maximale 60.
- Derniers **672 chandeliers clôturés** disponibles par couple Bitunix public Futures `LAST_PRICE` ; BTCUSDT, ETHUSDT, SOLUSDT en 15m, 30m, 1h, 4h (12 couples).
- Une seule chandelle incohérente coupe le segment; au moins **135 chandelles consécutives valides** nécessaires pour exploiter un segment. Le calcul de l'oscillateur est encore en warmup jusqu'au ~110e chandelier d'un segment admissible; les événements après warmup seulement sont comptabilisés.
- **Interprétation : signaux et divergences bruts, PAS de résultats de trades.** Les croisements filtrés sont des **occasions rejetées par EMA**, pas automatiquement des faux signaux. Le rapprochement éventuel avec V1.1 dans les 12 chandelles suivantes est rétrospectif.
- **Parité Pine/TradingView non encore vérifiée par export indépendant** (en particulier arrondis, cas `na`, et plateaux de pivots). Ne pas comparer les counts comme de la performance.

## Signaux sur les seuls segments exploitables

| Crypto | TF | Bougies exploitables / 672 | Signaux haussiers | Signaux baissiers | Divergences détectées (4 types combinés) |
|---|---|---:|---:|---:|---:|
| BTC | 15M | 176 | 1 | 1 | 2 |
| ETH | 15M | 284 | 2 | 3 | 5 |
| SOL | 15M | 198 | 0 | 4 | 1 |
| BTC | 30M | 301 | 0 | 2 | 0 |
| ETH | 30M | 179 | 0 | 1 | 2 |
| **SOL** | **30M** | **0** | **—** | **—** | **—** |
| BTC | 1H | 361 | 0 | 2 | 5 |
| **ETH** | **1H** | **0** | **—** | **—** | **—** |
| SOL | 1H | 529 | 0 | 9 | 12 |
| BTC | 4H | 578 | 8 | 1 | 11 |
| ETH | 4H | 562 | 9 | 0 | 4 |
| SOL | 4H | 660 | 7 | 8 | 13 |

### Pourquoi deux flux sont BLOQUÉS ?

Les 672 chandelles par marché sont bien revenues de Bitunix, sans horodatage manquant signalé dans cette fenêtre; en revanche, certaines chandelles OHLC impossibles rendent des segments inutilisables. Aucune n'a été modifiée/interpolée.

| Marché | OHLC individuellement incohérentes | Plus long segment continu valide | Minimum obligatoire |
|---|---:|---:|---:|
| SOL 30M | 9 | **119 chandelles** | **135** |
| ETH 1H | 9 | **118 chandelles** | **135** |

**Ne pas confondre nombre de « bougies exclues » et nombre de bougies individuellement fausses** : une bougie invalide peut découper plusieurs séquences, et tous les fragments trop courts sont également exclus. Pour ETH 1H, WATCH pouvait réussir sur une séquence d'au moins 55; Momentum requiert 135 pour initialiser `ta.percentrank(…,100)` et les autres composantes. Il est donc **normal que leurs exigences de qualité diffèrent**.

## Premiers constats, sans sélection de gagnant

- Les **quatre horizons** ont des profils de signaux très différents. Sur BTC/ETH/SOL 1H, le filtre EMA tend à bloquer certains LONG durant les baisses, mais les nombres restent exploratoires et affectés par des fragments de données.
- Plusieurs divergences existent dans l'historique. **Elles ne sont disponibles qu'à la barre de confirmation, 5 bougies après la barre pivot.** Il serait trompeur de les attribuer au prix de la barre pivot comme s'il s'agissait d'une alerte précoce en temps réel.
- Sur 4H, tous les trois marchés offrent plus de 560 chandelles admissibles; cette TF donne de meilleurs échantillons initiaux que 15M et 30M fragmentés, **sans signifier meilleure performance**.
- Pour l'instant, le port n'a pas démontré d'avantage par rapport à Vector, ni aucune rentabilité. **Aucune recommandation de trading** ne découle des comptages.

## Suite logique

1. Faire un **contrôle de parité TradingView** de quelques valeurs précises : composite, RSI, Stoch RSI, percentrank et signal EMA sur mêmes closes + horodatages Bitunix (l'écart de source d'exchange peut empêcher toute comparaison fiable).
2. Pour SOL 30M et ETH 1H, tenter une **fenêtre d'historique plus longue préspécifiée** dans un audit distinct (pas de raccourci en réduisant le minimum de 135).
3. Si la parité est correcte, tester un moteur de comparaison à **risque, frais, slippage et sorties identiques**, d'abord rétrospectivement pour diagnostiquer puis sur une période future nouvelle et préenregistrée. **Ne pas perturber le Vector prospectif actuel.**

## Reproductibilité

- `backtest/momentum-fusion-v1.mjs`
- `backtest/momentum-fusion-v1.test.mjs`
- `backtest/momentum-fusion-bitunix-audit.mjs`
- `backtest/momentum-fusion-bitunix-audit.test.mjs`
- `backtest/MOMENTUM_FUSION_SOURCE_V1_PROTOCOL.md`
- Workflow `.github/workflows/momentum-fusion-original.yml`
- GitHub artifact de l'exécution `momentum-fusion-original-bitunix-baseline` : rapport complet JSON avec timestamps, événements et mesures de qualité + résumé JSON/CSV. Les événements de divergence distinguent `pivotTime` et `availableAt` afin de prévenir tout biais d'anticipation.
