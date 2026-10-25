# Vector V1.1 — parité entre CryptoJuju et le moteur de backtest

**Référence vérifiable :** le code exact de `vectorAIT()` du fichier `index.html` enregistré sur la branche `dev/v1.26.0`. Le test utilise les fonctions JavaScript de l'interface `smaValues`, `rmaValues`, `intervalSeconds`, `vectorAIT` extraites automatiquement, sans recoder les calculs attendus. Il compare les bougies Vector brutes et les flèches LONG/SHORT avec `backtest/vector-ait-v1.mjs`, sur les mêmes chandelles **déjà clôturées**.

Les données du front portent des timestamps en **secondes**; les données du moteur de recherche portent des timestamps en **millisecondes**. Les tests normalisent expressément cette différence et vérifient plusieurs timeframes et prix, incluant des micro-prix, ainsi que le refus des bougies encore actives.

**Ne pas confondre :** ce contrôle est la parité **CryptoJuju frontend ↔ backtest**, pas une certification de parité avec le **Pine Script TradingView original**. Le Pine original n'est pas un fichier présent dans ce dépôt; des exports datés TradingView/Pine seront nécessaires pour une certification croisée indépendante.

Aucune modification au code HTML de production, aucun changement aux stratégies figées, aucune fusion vers `main`. Les éventuelles corrections nécessaires seront documentées et testées avant utilisation de statistiques historiques.

## Résultat de validation — 25 octobre 2026

Le premier passage du workflow a détecté un **écart réel** dans le moteur de backtest V1.1 : `minTick:1e-8` au lieu du `Number.EPSILON` utilisé dans le `vectorAIT()` de `index.html`. Sur des prix extrêmement petits, les valeurs `range`, `spread` et potentiellement les signaux divergeaient.

**Correction sur `dev/v1.26.0` uniquement** : le port de recherche utilise maintenant `minTick:Number.EPSILON`. Le frontend, la V1.2, la V1.3 et `main` n'ont pas été modifiés pour corriger ce défaut; les historiques BTC/ETH/SOL standards n'ont pas été revalidés exhaustivement au niveau tick. La correction peut affecter les anciens rapports historiques sur des altcoins aux cours microscopiques, qui devront donc être recalculés si ces actifs sont analysés.

**Workflow de parité réussi** : [GitHub Actions 40242940491](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40242940491). Les tests déterministes comparent l'exacte fonction frontend (extraite du fichier HTML) et les signaux de recherche sur 15M, 30M, 1H, 4H, 1D, sur de nombreuses bougies, avec test explicite des petites cotations et de la dernière bougie encore ouverte. Cette parité ne prouve pas une identité avec l'implémentation Pine de TradingView tant que son code source ou des exports de référence n'ont pas été comparés.
