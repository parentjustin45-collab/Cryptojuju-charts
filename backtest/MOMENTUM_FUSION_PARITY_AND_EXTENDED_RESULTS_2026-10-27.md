# Momentum Fusion — Contrôle de parité Pine et récupération d'historique ETH 1H / SOL 30M

**Contrôle du 27 octobre 2026 vers 09:01 UTC** · [GitHub Actions #40477618531](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40477618531) **réussi** · Régressions [#40477618385](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40477618385) **réussies**. Artefact `momentum-fusion-extended-bitunix-eth-sol` contenant la qualité des données, toutes les fenêtres admissibles, les comptages et les récapitulatifs CSV.

**Important : les tests JavaScript sont validés, pas la parité chiffrée avec TradingView/Pine.** Le fichier `backtest/momentum-fusion-tv-parity-probe.pine` est un indicateur de diagnostic prêt à copier dans TradingView pour recueillir les références réelles. Sans série exportée/valeurs exactes comparables, **aucune affirmation de parité parfaite**.

## Bug méthodologique corrigé dans le port JavaScript

Pine `ta.sma(source,n)` ignore les observations `na` et prend les **n dernières valeurs numériques disponibles**. Le port de Momentum Fusion rejetait précédemment une fenêtre SMA entière après un `na` de Stoch RSI. La correction du 27 octobre rend le calcul de moyenne robuste à cet écart, sans changer l'oscillateur proposé par l'utilisateur. Deux tests distincts verrouillent le traitement de périodes plates et l'absence d'anticipation des divergences.

Sources documentaires sur la règle : [TradingView — Functions FAQ](https://www.tradingview.com/pine-script-docs/faq/functions/) (la fonction `ta.sma` ignore les `na`). La conformité numérique du port complet `ta.stoch/ta.rsi/ta.percentrank/ta.pivot*` doit encore être comparée à TradingView sur les mêmes valeurs.

## Étude Bitunix de qualité : 2016 bougies demandées par marché

Les deux couples **ETHUSDT 1H** et **SOLUSDT 30M** bloqués par l'ancienne fenêtre de 672 chandelles ont été réévalués avec **2016 bougies clôturées chacun**, sans changer les paramètres ni le seuil **135 chandelles contiguës et valides**. Le service public Bitunix `LAST_PRICE` a été lu via le proxy CryptoJuju en lecture seule, sans ordre.

| Résultat | ETHUSDT 1H | SOLUSDT 30M |
|---|---:|---:|
| Bougies attendues et reçues | 2016 | 2016 |
| Bougies individuellement invalides | 27 | 21 |
| Bougies manquantes | 0 | 0 |
| Fenêtres admissibles de 135+ | 4 | 4 |
| Plus longue suite valide | 218 | 364 |
| Bougies présentes dans les fenêtres qualifiantes | 701 | 975 |
| Valeurs de composite effectivement disponibles après warmup | 265 | 539 |
| Bougies non retenues, dont fragments trop courts | 1315 | 1041 |
| Segment qualifiant jusqu'au **dernier chandelier fermé** | **Non** | **Non** |
| Signaux bull historiques dans fenêtres qualifiantes | 5 | 6 |
| Signaux bear historiques | 2 | 6 |
| Divergences historiques (quatre types) | 3 | 12 |

Pour ETH 1H, le dernier composite exploitable dans les fenêtres acceptées ouvre à **2026-09-29 17:00 UTC**; pour SOL 30M, à **2026-10-14 03:00 UTC**. La dernière tranche historique clôturée demandée se termine le **27 octobre 09:00 UTC** (exclusive). En raison des bougies invalides/segments insuffisants entre-temps, **ne pas présenter ces valeurs comme des signaux actuels**.

La présence de 2016 OHLC avec 1–2 % seulement de chandelles individuellement invalides **ne garantit pas** une disponibilité de 2016 valeurs de composite : chaque anomalie coupe la continuité et force une nouvelle période de chauffe.

## Ce que les tests prouvent, et ce qu'ils ne prouvent pas

**Prouvé :** le nouveau code respecte ses tests déterministes (dont no-lookahead, pivotRight cinq barres et correction SMA), les deux couples possèdent maintenant au moins une série historique valable, tous les OHLC incohérents restent en quarantaine, et le workflow n'a pas échoué. **Non prouvé :** parité complète TradingView du port (arrondis, EMA, RMA, ta.stoch et gestion des égalités pivot), efficacité prédictive des signaux et rentabilité.

Les 7 signaux ETH et 12 signaux SOL dans ce tableau sont des **comptages rétrospectifs** de fenêtres qualifiées, pas des transactions ni des chances de réussite.

## Ce qui suit

Valider quelques **points exacts TradingView** par comparaison de chandelles identiques, idéalement après au moins 150 bars de chauffage, grâce au script `backtest/momentum-fusion-tv-parity-probe.pine` et au Data Window du graphique; vérifier au besoin une comparaison historique indépendante sur la même source OHLC. Ensuite seulement programmer des tests de signal et de risque sur une période réellement future verrouillée, séparée de Vector.

**Aucune publication sur `main`, aucune mise à jour Render, aucun changement au moteur Vector prospectif ou à ses transactions simulées.**
