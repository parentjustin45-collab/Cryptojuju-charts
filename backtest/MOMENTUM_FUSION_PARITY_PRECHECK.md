# Momentum Fusion — parité TradingView/Pine (protocole)

## Statut

**Pas encore validé à l'identique avec TradingView** : aucune série de référence exportée par TradingView n'a été reçue, aucun compte TradingView connecté n'est utilisé, et les chandelles Bitunix de CryptoJuju peuvent différer de la source affichée sur un graphique TradingView. Une validation syntaxique JavaScript ou les tests unitaires **ne peuvent pas se substituer à une vraie comparaison de valeurs**.

## Référence fournie par l'utilisateur

Le script d'origine Pine v6 `Momentum Fusion` conserve RSI 14, Stoch RSI 14 lissé SMA 3, Momentum 10 rang 100, composite EMA 3, poids 1/1/1, EMA 21/55, pivots 5/5 et maximum 60. Les signaux restent ceux du script original. Fichiers source JS dans `backtest/momentum-fusion-v1.mjs`; aucune modification des indicateurs Vector.

## Prérequis de parité à effectuer

1. Dans TradingView Pine Editor, créer un **nouvel indicateur de diagnostic**, sans remplacer l'original, et coller `backtest/momentum-fusion-tv-parity-probe.pine`.
2. Comparer sur **la même source de prix**, la même paire et la même unité de temps, avec **une bougie clôturée** et l'heure d'ouverture UTC précise (le script montre `time` au panneau de données).
3. Relever **plusieurs points après 150 chandelles** : composite, RSI 14, StochRSI lissé, percentrank100, EMA21, EMA55, bull/bear, pivotlow/pivothigh confirmé. Utiliser les chiffres non arrondis lorsque disponibles.
4. Comparer aux résultats JS de `calculateMomentumFusion` sur **exactement la même série de bougies**. Toute différence de chandelle, d'horizon de chargement ou de source bloque la conclusion de parité.
5. Évaluer spécialement la gestion des `na` de Stoch RSI et de `ta.sma`, les égalités de pivots, la bande plate RSI, l'initialisation EMA/RMA et les arrondis. L'audit JS a corrigé un traitement incorrect de `ta.sma` pour ignorer les valeurs indisponibles comme Pine, mais **ne prétend pas** que la parité complète est acquise.
6. La **divergence** doit être signalée à la clôture de la bougie de **confirmation** (`pivotRight=5`), même si son label apparaît graphiquement sur la bougie antérieure du pivot. Ne pas aligner l'alerte au label rétrospectif.

## Données supplémentaires

La nouvelle recherche `backtest/momentum-fusion-extended-bitunix.mjs` examine séparément **ETH 1H** et **SOL 30M** sur **2016 chandelles closes**, plutôt que 672, en conservant **135 bougies consécutives** comme minimum strict et en réinitialisant l'indicateur à chaque cassure d'historique. Elle n'apporte pas, à elle seule, une preuve de parité à TradingView ou de rentabilité.

## Verrous

Branche `dev/v1.26.0`, aucune publication sur Render, aucune altération `main`, aucune modification du Vector prospectif, aucun ordre réel Bitunix. Aucun nouveau paramètre « optimisé » n'est promu sur les fréquences rétrospectives.
