# CryptoJuju — quatrième unité de temps de recherche : DAILY 1D

Cette branche ajoute `1d` aux intervalles reconnus par le moteur de recherche
des backtests Bitunix. Les neuf marchés / unités déjà testés en
15M, 1H et 4H **restent inchangés**.

## Pilote indépendant : cinq marchés différents
`BTCUSDT` (grande crypto), `HYPEUSDT` (altcoin),
`1000PEPEUSDT` (meme), `XAUUSDT` (contrat lié à l'or) et
`NVDAUSDT` (contrat lié à un symbole d'action).

Chaque contrat doit être présent dans la watchlist CryptoJuju et être marqué
OPEN dans le registre public Bitunix (avec quotePrecision valide).
Le pilote tente **365 chandelles DAILY fermées**, excluant la bougie UTC
encore ouverte. Il n'accepte **180 chandelles** que si la première tentative
montre explicitement une lacune limitée aux plus anciennes données :
l'intégralité des 183 dernières barres (180 + 3 ancres) doit être présente.
La version plus courte est lue de nouveau depuis zéro, deux fois,
et conservée comme fenêtre plus courte, non comparable en durée à 365 jours.

À chaque fenêtre acceptée : validation OHLC et des anomalies de la source,
conservation des chandelles brutes, preuves des corrections, double
lecture même fenêtre, port Vector V1.1, comparaison expérimentale
V1.2 `follow_close_1` et `break_extreme_2`, diagnostics de
retournements et de régimes. Aucun signal du jour en cours ne peut être
utilisé; les confirmations sont datées au close UTC et les entrées
simulées à l'ouverture suivante.

Les simulations ont des frais et slippage fixes purement exploratoires :
on ne prétend **pas** que le même coût représente des meme coins,
l'or lié au contrat, les actions liées à un ticker et Bitcoin.
Les résultats d'entraînement et de validation historiques sont déjà
des recherches, pas une preuve de rentabilité future.

## Ce que le pilote ne fait PAS
- Le Daily n'est pas encore un filtre exécuté sur les signaux intraday.
- Il ne remplace pas les contrats dérivés par des prix spot ni Forex.
- Il ne certifie ni données TradingView ni taux de réussite.
- Il n'entraîne aucune transaction, aucun déploiement sur `main`,
  et aucun abonnement Render.

Sorties sur GitHub Actions : `daily-vector-summary.md`,
`daily-vector-summary.json` et
`<symbol>-1d-evidence.json` (rétention de 7 jours).
Un marché insuffisant ou dont la deuxième lecture diffère est marqué
BLOQUÉ, jamais remplacé par des chandelles inventées.
