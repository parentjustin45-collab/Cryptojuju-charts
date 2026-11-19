# CryptoJuju — validation sur deux périodes 1H plus anciennes

**But :** déterminer si les conclusions observées sur les dernières
960 chandelles 1H de BTC, HYPE et 1000PEPE se reproduisent sur deux
périodes qui **ne chevauchent pas** cette fenêtre.

Deux fenêtres figées et déterminées avant lecture des résultats :
- `older_40d` : du 31 août 2026 au 10 octobre 2026 UTC, 960 bougies 1H.
- `older_80d` : du 22 juillet 2026 au 31 août 2026 UTC, 960 bougies 1H.

Pour chaque marché et fenêtre, le moteur exige un contrat Bitunix OPEN
présent dans la watchlist du site, 960 bougies fermées continues,
une deuxième lecture identique et une fenêtre Daily de 365 jours
(ou 180 jours seulement si les données anciennes manquent explicitement
et que le sous-historique de 180 jours est vérifié et relu).
Les 6 variantes Vector déjà étudiées sont ensuite simulées sur
les mêmes données, avec des coûts fixes identiques uniquement à titre
exploratoire. Toute fenêtre sans historique vérifiable est marquée
**BLOQUÉE** sans compléter artificiellement les chandelles.

Le Daily utilisé est celui de l'époque, jamais le Daily d'aujourd'hui.
Les décisions n'ont accès qu'aux chandelles Daily closes et une marge
de 120 secondes *supposée* après leur fermeture. Les deux blocs de
960 heures ne se chevauchent pas et n'incluent pas les 40 jours récents
déjà étudiés. Le retour net, le drawdown et le nombre de trades
sont rapportés indépendamment pour chaque bloc.

**Caveats** : ces blocs demeurent historiques, pas de nouvelles données
prospectives aveugles. Le système ne choisit pas automatiquement
de « meilleure » variante; il ne mesure pas encore le funding, le spread
ni la liquidité réelle de chaque produit. Le champ `runFetchedAtUtc`
de la synthèse indique la date réelle du contrôle, séparée des dates
`asOfUtc` fixées pour les fenêtres historiques.

Fichiers `prior-1h-vector-summary.md`, `prior-1h-vector-summary.json`
et les 6 rapports individuels, avec chandelles brutes, dérivées, preuves
de double lecture et résultats des six versions, dans un artefact GitHub
Actions de 7 jours. Le travail reste isolé sur `dev/ai-agents-phase1`,
aucune modification `main`, ordre réel, TradingView ni nouveau Render.
