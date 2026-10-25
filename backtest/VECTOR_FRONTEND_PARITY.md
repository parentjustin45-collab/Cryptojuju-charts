# Vector V1.1 — parité entre CryptoJuju et le moteur de backtest

**Référence vérifiable :** le code exact de `vectorAIT()` du fichier `index.html` enregistré sur la branche `dev/v1.26.0`. Le test utilise les fonctions JavaScript de l'interface `smaValues`, `rmaValues`, `intervalSeconds`, `vectorAIT` extraites automatiquement, sans recoder les calculs attendus. Il compare les bougies Vector brutes et les flèches LONG/SHORT avec `backtest/vector-ait-v1.mjs`, sur les mêmes chandelles **déjà clôturées**.

Les données du front portent des timestamps en **secondes**; les données du moteur de recherche portent des timestamps en **millisecondes**. Les tests normalisent expressément cette différence et vérifient plusieurs timeframes et prix, incluant des micro-prix, ainsi que le refus des bougies encore actives.

**Ne pas confondre :** ce contrôle est la parité **CryptoJuju frontend ↔ backtest**, pas une certification de parité avec le **Pine Script TradingView original**. Le Pine original n'est pas un fichier présent dans ce dépôt; des exports datés TradingView/Pine seront nécessaires pour une certification croisée indépendante.

Aucune modification au code HTML de production, aucun changement aux stratégies figées, aucune fusion vers `main`. Les éventuelles corrections nécessaires seront documentées et testées avant utilisation de statistiques historiques.
