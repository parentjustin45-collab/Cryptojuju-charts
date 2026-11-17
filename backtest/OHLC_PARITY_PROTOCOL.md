# CryptoJuju V1.26.0 — Protocole de parité OHLC (lecture seule)

## Objectif
Comparer les OHLC réellement contenus dans le navigateur CryptoJuju **sur la branche `dev/v1.26.0`** avec :
1. Le point d'accès officiel public Bitunix futures `/api/v1/futures/market/kline`.
2. Le proxy du serveur CryptoJuju qui retransmet les mêmes données Bitunix.

Ce test **n'est pas** une comparaison indépendante avec TradingView. Les trois chemins peuvent être d'accord sur une erreur provenant de la source Bitunix.

## Périmètre
- Marché : `BTCUSDT` futures linéaires.
- Unités de temps : `15m`, `1h`, `4h`.
- 48 chandelles déjà **clôturées** par TF (144 au total).
- Ignore la chandelle en cours ainsi que la dernière clôturée pour éviter les délais de publication à la frontière.
- Un horodatage = l'heure UTC d'**ouverture** de la chandelle.
- Compare O, H, L et C avec une tolérance absolue de **0,011 USDT**.
- Rejette les trous temporels, les duplications et les enveloppes OHLC impossibles.
- **Aucun prix n'est inventé, modifié ni remplacé**. Des prix invalides bloquent la validation destinée aux backtests.

## Lancer et lire le rapport
Action : [DEV CryptoJuju OHLC parity BTCUSDT 15m 1h 4h](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/workflows/ohlc-frontend-parity-audit.yml).

L'action est déclenchée automatiquement lors des changements des fichiers du comparateur sur `dev/v1.26.0`, ou manuellement par `workflow_dispatch` (sélectionner **dev/v1.26.0**).

Résultats dans l'artifact `cj-bitunix-ohlc-parity-15m-1h-4h` :
- `cj-ohlc-parity-report.json` : statut de qualité par TF, trous, données invalides, mismatches, timestamps et valeurs.
- `cj-ohlc-parity-BTCUSDT.csv` : toutes les paires de prix CryptoJuju vs Bitunix officiel par minute d'ouverture.

**Important :** GitHub ne déclenche les événements `schedule` que pour les workflows présents sur la branche par défaut. Comme nous ne touchons pas à `main`, un déclenchement horaire autonome n'est **pas encore configuré**. Ne pas confondre la surveillance d'un résultat et l'exécution d'un nouveau test.

## Comparaison ultérieure avec TradingView
L'utilisateur peut exporter le graphique **BTCUSDT Bitunix Futures** depuis TradingView, en **15m, 1h ou 4h**, puis fournir un **CSV** (plus précis que des photos).

Le CSV TradingView doit contenir les colonnes `time,open,high,low,close`. Le champ `time` doit être un epoch Unix (secondes ou millisecondes) ou une date explicite avec `Z` / décalage UTC. Le fichier n'atteste **pas lui-même** de sa bourse de provenance : vérifier manuellement que le graphique est bien `BITUNIX:BTCUSDT` futures linéaires.

Commande avec un CSV TradingView et l'artifact extrait :
```bash
node backtest/ohlc-compare-tv-csv.mjs --csv tradingview-export.csv --reference cj-ohlc-parity-BTCUSDT.csv --tf 15m
```

Les plages UTC des deux fichiers doivent se chevaucher. Les erreurs de période, d'horodatage et les données insuffisantes empêchent un faux résultat « identique ».

## Premier test — 17 novembre 2026
Le premier audit GitHub a comparé 48 chandelles par TF.
- 1H et 4H : 48/48 correspondances CryptoJuju / API officielle, données valides.
- 15m : 47/47 chandelles valides correspondent. Une chandelle du **2026-11-17 05:00:00 UTC** contient O=65014,6 et H=65010,4 : maximum inférieur à l'ouverture. Cette même anomalie existe via navigateur, REST officiel et proxy. Le rapport la marque comme **BLOCKED**, même sans différence de prix entre chemins.
- Le test ne démontre pas encore la correspondance indépendante TradingView, ni la fiabilité de tous les historiques anciens. Poursuivre la validation avant backtests Vector.
